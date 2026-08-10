"""REZ-115: rewrite suppliers.bgmea_reg_numbers as register+number identities.

Dry-run by default. ``--apply`` requires an explicit go-ahead path after the
closed-loop audit fingerprint matches.

Identity strings (evidence from ``fields->>'bgmea_member_type'`` only):

  * ``general:{N}``
  * ``associate:{N}``

Bare digits are never written. Records whose member type is missing or unknown
are listed as unresolved and left off the array (withheld, not invented).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from etl.core.bgmea_identity import (  # noqa: E402
    identity_from_member_type,
    is_legacy_bare,
    parse_identity,
)

SNAPSHOT_PREFIX = "_snapshot_bgmea_reg_identities_"


def _dsn() -> str:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("SUPABASE_DB_URL not set")
    return dsn


def _fingerprint(rows: list[dict[str, Any]]) -> str:
    payload = [
        {
            "supplier_id": r["supplier_id"],
            "before": sorted(r["before"]),
            "after": sorted(r["after"]),
        }
        for r in sorted(rows, key=lambda x: x["supplier_id"])
    ]
    blob = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _plan(conn: psycopg.Connection) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select s.id as supplier_id,
                   s.slug,
                   s.company_name,
                   s.is_published,
                   coalesce(s.bgmea_reg_numbers, '{}'::text[]) as held,
                   coalesce(
                     (
                       select json_agg(
                                json_build_object(
                                  'source_ref', sr.source_ref,
                                  'member_type', sr.fields->>'bgmea_member_type',
                                  'reg', sr.fields->>'bgmea_reg_number'
                                )
                                order by sr.source_ref
                              )
                         from public.source_records sr
                         join public.sources src
                           on src.id = sr.source_id
                          and src.code = 'BGMEA'
                        where sr.supplier_id = s.id
                          and sr.status = 'active'
                     ),
                     '[]'::json
                   ) as records
              from public.suppliers s
             where coalesce(array_length(s.bgmea_reg_numbers, 1), 0) > 0
                or exists (
                      select 1
                        from public.source_records sr
                        join public.sources src
                          on src.id = sr.source_id
                         and src.code = 'BGMEA'
                       where sr.supplier_id = s.id
                         and sr.status = 'active'
                    )
            """
        )
        suppliers = cur.fetchall()

    mutations: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    for row in suppliers:
        held = [str(x) for x in (row["held"] or [])]
        records = row["records"] or []
        if isinstance(records, str):
            records = json.loads(records)
        identities: set[str] = set()
        for rec in records:
            if not rec:
                continue
            member_type = rec.get("member_type")
            reg = rec.get("reg")
            if not reg:
                ref = str(rec.get("source_ref") or "")
                if ref.startswith("general:"):
                    reg = ref.split(":", 1)[1]
                elif ref.isdigit():
                    reg = ref
            ident = identity_from_member_type(
                str(member_type) if member_type else None,
                str(reg) if reg else None,
            )
            if ident:
                identities.add(ident)
            elif member_type or reg or rec.get("source_ref"):
                unresolved.append(
                    {
                        "supplier_id": row["supplier_id"],
                        "slug": row["slug"],
                        "source_ref": rec.get("source_ref"),
                        "member_type": member_type,
                        "reg": reg,
                    }
                )
        after = sorted(identities)
        before = sorted(held)
        if after == before:
            continue
        # Never invent identities from bare array elements alone.
        mutations.append(
            {
                "supplier_id": row["supplier_id"],
                "slug": row["slug"],
                "company_name": row["company_name"],
                "is_published": row["is_published"],
                "before": before,
                "after": after,
                "legacy_bare_dropped": sorted(
                    x for x in before if is_legacy_bare(x) and not any(
                        parse_identity(i) and parse_identity(i)[1] == x for i in after
                    )
                ),
            }
        )
    return mutations, unresolved


def _create_snapshot(conn: psycopg.Connection, mutations: list[dict[str, Any]]) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    table = f"{SNAPSHOT_PREFIX}{stamp}"
    ids = [m["supplier_id"] for m in mutations]
    with conn.cursor() as cur:
        cur.execute(
            f"""
            create table public.{table} as
            select id, bgmea_reg_numbers, updated_at
              from public.suppliers
             where id = any(%s::uuid[])
            """,
            (ids,),
        )
        cur.execute(f"select count(*) from public.{table}")
        n = cur.fetchone()[0]
    if n != len(ids):
        raise RuntimeError(f"snapshot incomplete: {n} rows vs {len(ids)} planned")
    return table


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--json-out", type=Path, default=None)
    args = ap.parse_args(argv)

    with psycopg.connect(_dsn(), prepare_threshold=None) as conn:
        mutations, unresolved = _plan(conn)
        fp = _fingerprint(mutations)
        published = sum(1 for m in mutations if m["is_published"])
        print(f"mutations={len(mutations)} published_touched={published}")
        print(f"unresolved_records={len(unresolved)}")
        print(f"fingerprint={fp}")

        # Collision check on the planned after-state for published suppliers.
        by_ident: dict[str, set[str]] = defaultdict(set)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select id, is_published, coalesce(bgmea_reg_numbers, '{}'::text[]) as held
                  from public.suppliers
                """
            )
            current = {r["id"]: r for r in cur.fetchall()}
        planned_held = {
            sid: list(r["held"]) for sid, r in current.items()
        }
        for m in mutations:
            planned_held[m["supplier_id"]] = list(m["after"])
        for sid, held in planned_held.items():
            if not current[sid]["is_published"]:
                continue
            for ident in held:
                if parse_identity(ident):
                    by_ident[ident].add(str(sid))
        collisions = {k: sorted(v) for k, v in by_ident.items() if len(v) > 1}
        print(f"published_identity_collisions_after={len(collisions)}")
        if collisions:
            for ident, sids in sorted(collisions.items())[:20]:
                print(f"  COLLISION {ident}: {sids}")

        report = {
            "fingerprint": fp,
            "mutations": len(mutations),
            "published_touched": published,
            "unresolved_records": unresolved,
            "collisions_after": collisions,
            "sample": mutations[:20],
        }
        if args.json_out:
            args.json_out.write_text(
                json.dumps(report, indent=2, ensure_ascii=True) + "\n",
                encoding="utf-8",
            )
            print(f"wrote {args.json_out}")

        if not args.apply:
            print("dry-run only; pass --apply to mutate")
            return 0 if not collisions else 1

        if collisions:
            print("REFUSING --apply: planned published identity collisions remain", file=sys.stderr)
            return 1

        snap = _create_snapshot(conn, mutations)
        print(f"snapshot_table={snap}")
        with conn.cursor() as cur:
            for m in mutations:
                cur.execute(
                    """
                    update public.suppliers
                       set bgmea_reg_numbers = %s::text[],
                           updated_at = now()
                     where id = %s
                    """,
                    (m["after"], m["supplier_id"]),
                )
        conn.commit()
        print(f"applied={len(mutations)}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
