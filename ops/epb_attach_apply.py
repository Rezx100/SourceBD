"""Attach live EPB RMG exporters onto companies we already list.

Dry-run / plan by default. Never mints a supplier. Writes a pinned
(source_ref, host) mutation set from the frozen live dump + snapshot.
``--emit-sql-batch`` prints one INSERT batch. If the pair list moves,
the fingerprint changes and approval is void.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.core.scraper import ScrapedRecord  # noqa: E402
from etl.scrapers.epb_web import epb_registry_open_url  # noqa: E402
from ops.epb_attach_dryrun import LIVE_PATH, SNAP_PATH, match_rows  # noqa: E402

PLANS = Path(__file__).resolve().parents[1] / "ops" / "plans"
MUTATIONS_PATH = PLANS / "_epb_attach_mutations.json"

EPB_SOURCE_ID = "330ec0d1-bc9f-4cd7-8c3b-71b9975d8448"
EPB_TIER = "tier1_gov"

# Wrong-name extras already on these hosts. Do not attach a second EPB onto them.
FOREIGN_HOST_SLUGS = frozenset(
    {
        "az-apparels",
        "bsa-apparels",
        "deluxe-apparels",
        "kds-apparels",
        "mim-apparel",
        "univogue-garments-co-ltd-unit-2",
    }
)


def mutation_fingerprint(rows: list[dict[str, Any]]) -> str:
    lines = [f"{r['source_ref']}\t{r['supplier_id']}" for r in rows]
    blob = "\n".join(sorted(lines)) + ("\n" if lines else "")
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _epb_slug(detail_url: str, source_ref: str) -> str | None:
    path = urlparse(detail_url).path.rstrip("/")
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 3 and parts[0] == "exporter" and parts[1] == source_ref:
        return parts[2]
    return None


def fields_for_row(row: dict[str, Any]) -> dict[str, Any] | None:
    ref = str(row["source_ref"])
    detail = row.get("detail_url")
    if not isinstance(detail, str):
        return None
    if epb_registry_open_url(ref, detail) is None:
        return None
    slug = _epb_slug(detail, ref)
    if slug is None:
        return None
    try:
        exporter_id = int(ref)
    except ValueError:
        return None
    fields: dict[str, Any] = {
        "epb_exporter_id": exporter_id,
        "epb_slug": slug,
        "epb_detail_url": detail,
        "epb_registered": True,
    }
    reg = row.get("epb_reg_no")
    if isinstance(reg, str) and reg.strip():
        fields["epb_reg_no"] = reg.strip()
    pass_label = row.get("pass") or ""
    if pass_label.startswith("association:"):
        assoc = pass_label.split(":", 1)[1].strip()
        if assoc:
            fields["epb_associations"] = [assoc]
    return fields


def payload_hash(fields: dict[str, Any]) -> str:
    rec = ScrapedRecord(
        source_code="EPB",
        source_ref=str(fields["epb_exporter_id"]),
        company_name="x",
        payload=fields,
    )
    return rec.hash()


def build_mutations(
    live: list[dict[str, Any]],
    snap: dict[str, Any],
) -> dict[str, Any]:
    plan = match_rows(live, snap)
    skipped_foreign: list[dict[str, Any]] = []
    skipped_bad_url: list[dict[str, Any]] = []
    mutations: list[dict[str, Any]] = []
    no_match_refs = [str(r["source_ref"]) for r in plan["no_match"]]

    for row in plan["would_attach"]:
        host = row.get("host") or {}
        host_id = host.get("id")
        host_slug = host.get("slug")
        if not host_id:
            continue
        if host_slug in FOREIGN_HOST_SLUGS:
            skipped_foreign.append(
                {
                    "source_ref": row["source_ref"],
                    "host_slug": host_slug,
                    "company_name": row.get("company_name"),
                }
            )
            continue
        fields = fields_for_row(row)
        if fields is None:
            skipped_bad_url.append(
                {
                    "source_ref": row["source_ref"],
                    "detail_url": row.get("detail_url"),
                }
            )
            continue
        mutations.append(
            {
                "source_ref": str(row["source_ref"]),
                "supplier_id": host_id,
                "host_slug": host_slug,
                "company_name": row.get("company_name"),
                "fields": fields,
                "raw_hash": payload_hash(fields),
            }
        )

    mutations.sort(key=lambda r: (r["source_ref"], r["supplier_id"]))
    return {
        "generated_at": plan["generated_at"],
        "live_unique": plan["live_unique"],
        "match_buckets": plan["buckets"],
        "fingerprint": mutation_fingerprint(mutations),
        "count": len(mutations),
        "unique_hosts": len({r["supplier_id"] for r in mutations}),
        "no_match_count": len(no_match_refs),
        "no_match_refs": no_match_refs,
        "skipped_foreign_host": skipped_foreign,
        "skipped_bad_url": skipped_bad_url,
        "mutations": mutations,
    }


def apply_sql(mutations: list[dict[str, Any]]) -> str:
    payload = [
        {
            "supplier_id": r["supplier_id"],
            "source_ref": r["source_ref"],
            "fields": r["fields"],
            "raw_hash": r["raw_hash"],
        }
        for r in mutations
    ]
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"""
with incoming as (
  select *
    from jsonb_to_recordset($epb${blob}$epb$::jsonb)
      as x(supplier_id uuid, source_ref text, fields jsonb, raw_hash text)
),
ins as (
  insert into public.source_records
    (supplier_id, source_id, source_tier, source_ref, fields, raw_hash, status)
  select
    i.supplier_id,
    '{EPB_SOURCE_ID}'::uuid,
    '{EPB_TIER}'::source_tier,
    i.source_ref,
    i.fields,
    i.raw_hash,
    'active'
  from incoming i
  where exists (select 1 from public.suppliers su where su.id = i.supplier_id)
    and not exists (
      select 1
        from public.source_records sr
        join public.sources s on s.id = sr.source_id and s.code = 'EPB'
       where sr.source_ref = i.source_ref
         and sr.status = 'active'
    )
  returning supplier_id, source_ref
),
tagged as (
  update public.suppliers su
     set source_tags = (
           select array(select distinct unnest(
             coalesce(su.source_tags, '{{}}'::text[]) || array['EPB']::text[]
           ))
         ),
         entity_type = case
           when su.entity_type = 'unknown' then 'factory'
           else su.entity_type
         end
   where su.id in (select distinct supplier_id from ins)
  returning su.id
)
select
  (select count(*) from incoming) as incoming_n,
  (select count(*) from ins) as inserted,
  (select count(*) from tagged) as tagged_hosts;
"""


def rest_headers() -> dict[str, str]:
    import os

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY not set")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=ignore-duplicates",
    }


def rest_url() -> str:
    import os

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        raise SystemExit("SUPABASE_URL not set")
    return url.rstrip("/")


def apply_via_rest(mutations: list[dict[str, Any]], *, batch_size: int = 100) -> int:
    import httpx

    url = rest_url() + "/rest/v1/source_records"
    headers = rest_headers()
    inserted = 0
    with httpx.Client(timeout=60.0) as client:
        for i in range(0, len(mutations), batch_size):
            chunk = mutations[i : i + batch_size]
            payload = [
                {
                    "supplier_id": r["supplier_id"],
                    "source_id": EPB_SOURCE_ID,
                    "source_tier": EPB_TIER,
                    "source_ref": r["source_ref"],
                    "fields": r["fields"],
                    "raw_hash": r["raw_hash"],
                    "status": "active",
                }
                for r in chunk
            ]
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code not in (200, 201):
                raise SystemExit(
                    f"batch {i // batch_size} failed {resp.status_code}: {resp.text[:400]}"
                )
            inserted += len(chunk)
            print(f"posted {inserted}/{len(mutations)}", flush=True)
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Write mutations + fingerprint")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expect-fingerprint", default="")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--emit-sql-batch", type=int, default=None)
    args = parser.parse_args()

    if args.plan:
        live = json.loads(LIVE_PATH.read_text(encoding="utf-8"))
        snap = json.loads(SNAP_PATH.read_text(encoding="utf-8"))
        bundle = build_mutations(live, snap)
        MUTATIONS_PATH.write_text(
            json.dumps(bundle, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        slim = {k: v for k, v in bundle.items() if k not in {"mutations", "no_match_refs"}}
        print(json.dumps(slim, indent=2))
        print(f"wrote {MUTATIONS_PATH} count={bundle['count']} fp={bundle['fingerprint']}")
        return

    bundle = json.loads(MUTATIONS_PATH.read_text(encoding="utf-8"))
    mutations = bundle["mutations"]
    fp = bundle["fingerprint"]
    if args.apply or args.emit_sql_batch is not None:
        if not args.expect_fingerprint:
            raise SystemExit("--expect-fingerprint is required")
        if args.expect_fingerprint != fp:
            raise SystemExit(
                f"fingerprint mismatch: plan={fp} expect={args.expect_fingerprint}"
            )
    if args.apply:
        n = apply_via_rest(mutations, batch_size=min(args.batch_size, 100))
        print(json.dumps({"inserted_posted": n, "fingerprint": fp}))
        return
    if args.emit_sql_batch is None:
        raise SystemExit("pass --plan, --apply, or --emit-sql-batch N")
    size = args.batch_size
    start = args.emit_sql_batch * size
    chunk = mutations[start : start + size]
    if not chunk:
        raise SystemExit(f"empty batch {args.emit_sql_batch}")
    print(apply_sql(chunk))


if __name__ == "__main__":
    main()
