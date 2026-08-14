"""Fill HS codes on existing EPB source records from the public exporter page.

Dry-run by default. Does not mint suppliers. ``--apply`` updates
``source_records.fields.epb_hscodes`` only.

Uses Supabase REST (service role) because the Postgres pooler is unreachable
from the Windows dev machine. Never writes an empty parse over stored codes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.scrapers.epb_web import (  # noqa: E402
    _BROWSER_HEADERS,
    parse_epb_hscodes,
)

EPB_SOURCE_ID = "330ec0d1-bc9f-4cd7-8c3b-71b9975d8448"
PLAN_PATH = (
    Path(__file__).resolve().parents[1] / "ops" / "plans" / "_epb_hscodes_mutations.json"
)


def should_write_hscodes(existing: Any, parsed: list[dict[str, str]]) -> bool:
    """Never jsonb_set an empty parse over codes already stored."""
    if not parsed:
        return False
    return True


def _existing_code_count(existing: Any) -> int:
    if isinstance(existing, str):
        try:
            existing = json.loads(existing)
        except json.JSONDecodeError:
            return 0
    if not isinstance(existing, list):
        return 0
    return sum(1 for row in existing if isinstance(row, dict) and row.get("code"))


def _fingerprint(rows: list[dict[str, Any]]) -> str:
    payload = [
        {
            "id": r["id"],
            "source_ref": r["source_ref"],
            "codes": [c["code"] for c in r["hscodes"]],
        }
        for r in sorted(rows, key=lambda x: str(x["source_ref"]))
    ]
    blob = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def rest_url() -> str:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        raise SystemExit("SUPABASE_URL not set")
    return url.rstrip("/")


def rest_headers() -> dict[str, str]:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY not set")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _detail_url(fields: Any, source_ref: str) -> str | None:
    if not isinstance(fields, dict):
        return None
    url = fields.get("epb_detail_url")
    if not isinstance(url, str):
        return None
    prefix = f"https://edb.epb.gov.bd/exporter/{source_ref}/"
    return url if url.startswith(prefix) else None


def _load_rows(client: httpx.Client, limit: int | None) -> list[dict[str, Any]]:
    url = rest_url() + "/rest/v1/source_records"
    headers = {**rest_headers(), "Prefer": "count=exact"}
    out: list[dict[str, Any]] = []
    start = 0
    page = 1000
    while True:
        resp = client.get(
            url,
            headers={**headers, "Range": f"{start}-{start + page - 1}"},
            params={
                "select": "id,source_ref,supplier_id,fields",
                "source_id": f"eq.{EPB_SOURCE_ID}",
                "status": "eq.active",
                "supplier_id": "not.is.null",
                "order": "source_ref.asc",
            },
            timeout=60.0,
        )
        if resp.status_code not in (200, 206):
            raise SystemExit(f"load failed {resp.status_code}: {resp.text[:400]}")
        chunk = resp.json()
        if not isinstance(chunk, list):
            raise SystemExit("load did not return a list")
        for raw in chunk:
            ref = str(raw.get("source_ref") or "")
            if not ref.isdigit():
                continue
            detail = _detail_url(raw.get("fields"), ref)
            if not detail:
                continue
            fields = raw.get("fields") if isinstance(raw.get("fields"), dict) else {}
            out.append(
                {
                    "id": raw["id"],
                    "source_ref": ref,
                    "supplier_id": raw.get("supplier_id"),
                    "detail_url": detail,
                    "existing": fields.get("epb_hscodes"),
                }
            )
            if limit is not None and len(out) >= limit:
                return out
        if len(chunk) < page:
            break
        start += page
    return out


def _fetch_html(client: httpx.Client, url: str) -> str | None:
    try:
        resp = client.get(url, headers=_BROWSER_HEADERS, timeout=30.0)
        if resp.status_code != 200:
            return None
        return resp.text
    except httpx.HTTPError:
        return None


def _write_plan(path: Path, planned: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    slim = [
        {
            "id": r["id"],
            "source_ref": r["source_ref"],
            "hscodes": r["hscodes"],
        }
        for r in planned
    ]
    path.write_text(
        json.dumps({"fingerprint": _fingerprint(planned), "mutations": slim, **meta}, indent=2),
        encoding="utf-8",
    )


def _load_plan(path: Path) -> list[dict[str, Any]]:
    bundle = json.loads(path.read_text(encoding="utf-8"))
    mutations = bundle.get("mutations")
    if not isinstance(mutations, list):
        raise SystemExit(f"plan {path} has no mutations list")
    return mutations


def apply_via_rest(planned: list[dict[str, Any]], *, batch_size: int = 50) -> int:
    """Merge epb_hscodes into existing fields. Never PATCH an empty parse."""
    url = rest_url() + "/rest/v1/source_records"
    headers = {**rest_headers(), "Prefer": "return=minimal"}
    written = 0
    with httpx.Client(timeout=60.0) as client:
        for i in range(0, len(planned), batch_size):
            chunk = planned[i : i + batch_size]
            ids = ",".join(str(r["id"]) for r in chunk)
            got = client.get(
                url,
                headers=headers,
                params={"select": "id,fields", "id": f"in.({ids})"},
            )
            if got.status_code != 200:
                raise SystemExit(f"GET fields failed {got.status_code}: {got.text[:400]}")
            by_id = {row["id"]: row.get("fields") or {} for row in got.json()}
            for row in chunk:
                if not should_write_hscodes(None, row["hscodes"]):
                    continue
                current = by_id.get(row["id"])
                if not isinstance(current, dict):
                    raise SystemExit(f"missing fields for {row['id']}")
                if not should_write_hscodes(current.get("epb_hscodes"), row["hscodes"]):
                    continue
                merged = {**current, "epb_hscodes": row["hscodes"]}
                patch = client.patch(
                    url,
                    headers=headers,
                    params={"id": f"eq.{row['id']}"},
                    json={"fields": merged},
                )
                if patch.status_code not in (200, 204):
                    raise SystemExit(
                        f"PATCH {row['id']} failed {patch.status_code}: {patch.text[:400]}"
                    )
                written += 1
            print(f"patched {written}/{len(planned)}", flush=True)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--expect-fingerprint",
        default="",
        help="Required with --apply. Must match this run's mutation fingerprint.",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=1.0)
    parser.add_argument("--plan-out", type=Path, default=PLAN_PATH)
    parser.add_argument(
        "--from-plan",
        type=Path,
        default=None,
        help="Apply a previously fetched plan without re-GETting exporter pages.",
    )
    args = parser.parse_args()

    if args.from_plan is not None:
        planned = _load_plan(args.from_plan)
        fp = _fingerprint(planned)
        print(
            json.dumps(
                {
                    "from_plan": str(args.from_plan),
                    "with_hscodes": len(planned),
                    "fingerprint": fp,
                    "apply": args.apply,
                },
                indent=2,
            )
        )
        if not args.apply:
            print("dry-run only; pass --apply --from-plan FILE --expect-fingerprint <sha>")
            return
        if not args.expect_fingerprint:
            print("ERROR: --apply requires --expect-fingerprint", file=sys.stderr)
            raise SystemExit(2)
        if fp != args.expect_fingerprint:
            print("FINGERPRINT MISMATCH. Refusing --apply.", file=sys.stderr)
            print(f"expected {args.expect_fingerprint}", file=sys.stderr)
            print(f"got      {fp}", file=sys.stderr)
            raise SystemExit(2)
        n = apply_via_rest(planned)
        print(json.dumps({"applied": n, "fingerprint": fp}))
        return

    with httpx.Client() as client:
        rows = _load_rows(client, args.limit)

    planned: list[dict[str, Any]] = []
    failed = 0
    skipped_empty = 0
    skipped_existing = 0
    jsonl_path = args.plan_out.with_suffix(".jsonl")
    seen_ids: set[str] = set()
    if jsonl_path.exists():
        for line in jsonl_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            rid = str(rec["id"])
            if rid in seen_ids:
                continue
            seen_ids.add(rid)
            planned.append(rec)
        print(f"resuming {len(seen_ids)} already fetched from {jsonl_path}", flush=True)
    with httpx.Client() as client, jsonl_path.open("a", encoding="utf-8") as jsonl:
        for i, row in enumerate(rows, start=1):
            t0 = time.monotonic()
            if str(row["id"]) in seen_ids:
                print(f"{i}/{len(rows)} {row['source_ref']} resume_skip", flush=True)
                continue
            elif _existing_code_count(row["existing"]) > 0:
                skipped_existing += 1
                print(
                    f"{i}/{len(rows)} {row['source_ref']} skip_existing "
                    f"n={_existing_code_count(row['existing'])}",
                    flush=True,
                )
            else:
                html = _fetch_html(client, row["detail_url"])
                if html is None:
                    failed += 1
                    print(f"FAIL {row['source_ref']} {row['detail_url']}", file=sys.stderr, flush=True)
                else:
                    codes = parse_epb_hscodes(html)
                    if not should_write_hscodes(row["existing"], codes):
                        skipped_empty += 1
                        print(
                            f"{i}/{len(rows)} {row['source_ref']} "
                            f"skip_empty existing={_existing_code_count(row['existing'])}",
                            flush=True,
                        )
                    else:
                        rec = {
                            "id": row["id"],
                            "source_ref": row["source_ref"],
                            "hscodes": codes,
                        }
                        planned.append(rec)
                        jsonl.write(json.dumps(rec, ensure_ascii=True) + "\n")
                        jsonl.flush()
                        print(
                            f"{i}/{len(rows)} {row['source_ref']} hs={len(codes)}",
                            flush=True,
                        )
            elapsed = time.monotonic() - t0
            if args.sleep and elapsed < args.sleep:
                time.sleep(args.sleep - elapsed)

    fp = _fingerprint(planned)
    nonempty = sum(1 for r in planned if r["hscodes"])
    meta = {
        "rows": len(rows),
        "fetched": len(planned) + skipped_empty,
        "failed": failed,
        "skipped_empty": skipped_empty,
        "skipped_existing": skipped_existing,
        "with_hscodes": nonempty,
        "apply": args.apply,
    }
    _write_plan(args.plan_out, planned, meta)
    print(json.dumps({"fingerprint": fp, **meta, "plan": str(args.plan_out)}, indent=2))
    if not args.apply:
        print("dry-run only; pass --apply --from-plan FILE --expect-fingerprint <sha> to write epb_hscodes")
        return

    if not args.expect_fingerprint:
        print("ERROR: --apply requires --expect-fingerprint", file=sys.stderr)
        raise SystemExit(2)
    fp2 = _fingerprint(planned)
    if fp2 != args.expect_fingerprint or fp2 != fp:
        print("FINGERPRINT MISMATCH. Refusing --apply.", file=sys.stderr)
        print(f"expected {args.expect_fingerprint}", file=sys.stderr)
        print(f"got      {fp2}", file=sys.stderr)
        raise SystemExit(2)

    n = apply_via_rest(planned)
    print(f"applied {n} rows")


if __name__ == "__main__":
    main()
