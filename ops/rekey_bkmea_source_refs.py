"""Rekey BKMEA list source_records from detail-page ids to membership numbers.

WHY
---
`bkmea_web` used to prefer the detail-page id over the membership integer for
`source_records.source_ref`, despite its own comment calling the membership
integer the stable key. BKMEA re-lists members on new detail-page ids (the
21xx/22xx series) carrying the SAME membership number, and the old pages keep
serving stale data. Keying on the page id therefore minted a new
source_records row per re-listing — the REZ-34 Phase D re-listing treadmill:
both rows are scraped every run, and each `bkmea_detail` pass re-mints a fresh
contradicted-claim population.

`bkmea_web` now keys on the membership integer. This script rekeys the rows
written before that fix, so the next run's Pass-0 self-source match lands on
the existing row instead of minting a parallel one.

WHAT IT DOES
------------
Per supplier, per parsed membership integer:

- The row with the latest `fetched_at` (the most recently seen listing) wins
  and is rekeyed to the membership integer.
- Every other row in the group is a stale re-listing of the same member. Its
  `evidence_claims` subjects and the four FK references
  (`certifications`, `rsc_remediation`, `sanctions_screening`,
  `partner_factories`) are re-pointed to the winner, then the loser row is
  DELETED. Leaving it would keep its stale detail page targeted by
  `bkmea_detail` forever — the treadmill would survive the fix. The citations
  themselves survive on the winner row; only the duplicate row identity goes.

WHAT IT NEVER DOES
------------------
- Rows whose ref already contains ':' (the `{detail_id}:detail` namespace
  written by the split `bkmea_detail`) are never touched.
- A membership number found on MORE THAN ONE supplier is reported, never
  merged across suppliers — the stranded CRONY FASHION duplicate (member 376
  scraped under both ABANTI COLOUR TEX and CRONY FASHION) is exactly this
  case, and which company owns the membership is a human decision.
- Rows with an unparseable or missing membership number are reported and left
  alone.
- A rekey that would collide with another row already holding the target ref
  on the same supplier is reported and skipped, not forced.

USAGE
-----
    python ops/rekey_bkmea_source_refs.py              # dry run, prints the plan
    python ops/rekey_bkmea_source_refs.py --apply      # execute in one transaction
    python ops/rekey_bkmea_source_refs.py --apply --limit 5   # execute a slice first

Dry run is the default deliberately: this rewrites provenance identity, and
the plan should be read by a human before it runs.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from typing import Any

import psycopg
from psycopg.rows import dict_row

# "2632 - C/2026" -> "2632". Only the leading integer is the stable identity.
_MEMBERSHIP_INT_RE = re.compile(r"^\s*(\d+)")

CANDIDATES_SQL = """
select sr.id, sr.supplier_id, sr.source_ref, sr.fetched_at,
       sr.fields->>'bkmea_membership_no' as membership_no,
       sup.company_name
  from public.source_records sr
  join public.sources src on src.id = sr.source_id and src.code = 'BKMEA'
  join public.suppliers sup on sup.id = sr.supplier_id
 where position(':' in coalesce(sr.source_ref, '')) = 0
 order by sr.supplier_id, sr.fetched_at desc
"""

# References that must follow a merged row to the winner before the loser can
# be deleted. `evidence_claims.subject_id` is polymorphic, so it is gated on
# subject_table; the other four are real FK columns.
_FK_TABLES = ("certifications", "rsc_remediation", "sanctions_screening", "partner_factories")


def _membership_int(membership_no: str | None) -> str | None:
    if not membership_no:
        return None
    m = _MEMBERSHIP_INT_RE.match(membership_no)
    return m.group(1) if m else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="only process N suppliers")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(CANDIDATES_SQL)
            rows = cur.fetchall()

        by_supplier: dict[Any, list[dict]] = defaultdict(list)
        unparseable: list[dict] = []
        for row in rows:
            row["membership_int"] = _membership_int(row["membership_no"])
            if row["source_ref"] is None:
                unparseable.append(row)
            elif row["membership_int"] is None:
                unparseable.append(row)
            else:
                by_supplier[row["supplier_id"]].append(row)

        # A membership number living on more than one supplier is the stranded
        # duplicate case (CRONY FASHION holds member 376's page alongside
        # ABANTI COLOUR TEX). Reported, never merged across suppliers.
        suppliers_by_membership: dict[str, set] = defaultdict(set)
        for supplier_rows in by_supplier.values():
            for row in supplier_rows:
                suppliers_by_membership[row["membership_int"]].add(row["supplier_id"])
        multi_supplier = {m: s for m, s in suppliers_by_membership.items() if len(s) > 1}

        supplier_ids = list(by_supplier)
        if args.limit is not None:
            supplier_ids = supplier_ids[: args.limit]

        rekeys = 0
        already_stable = 0
        merges = 0
        collisions = 0

        for supplier_id in supplier_ids:
            supplier_rows = by_supplier[supplier_id]
            company_name = supplier_rows[0]["company_name"]

            groups: dict[str, list[dict]] = defaultdict(list)
            for row in supplier_rows:
                groups[row["membership_int"]].append(row)

            print(f"\n{company_name}  [{supplier_id}]")
            for membership_int, group_rows in sorted(groups.items()):
                # Winner: most recently seen listing; a row already holding the
                # target ref wins ties so a no-op group never churns.
                ordered = sorted(
                    group_rows,
                    key=lambda r: (r["fetched_at"], r["source_ref"] == membership_int),
                    reverse=True,
                )
                winner = ordered[0]
                losers = ordered[1:]
                rekey_needed = winner["source_ref"] != membership_int

                if multi_supplier.get(membership_int):
                    print(
                        f"  MULTI-SUPPLIER membership {membership_int}: present on "
                        f"{len(multi_supplier[membership_int])} suppliers — rekeying "
                        "this supplier's row(s) only; cross-supplier resolution is manual"
                    )

                if not rekey_needed and not losers:
                    already_stable += 1
                    print(f"  keep   {membership_int:<10} already stable")
                    continue

                if rekey_needed:
                    # A real collision is a row OUTSIDE this group already
                    # holding the target ref (e.g. an unparseable-membership
                    # row keyed '2632'). The group's own losers are being
                    # merged away, so they must not count as blockers.
                    group_ids = [str(r["id"]) for r in group_rows]
                    with conn.cursor() as cur:
                        cur.execute(
                            """select 1 from public.source_records
                                where supplier_id = %s
                                  and source_id = (select id from public.sources where code = 'BKMEA')
                                  and source_ref = %s
                                  and id <> all(%s::uuid[])""",
                            (supplier_id, membership_int, group_ids),
                        )
                        collision = cur.fetchone() is not None
                    if collision:
                        collisions += 1
                        print(
                            f"  COLLIDE {membership_int:<10} target ref already held by another "
                            f"row on this supplier (winner would be {winner['source_ref']!r}) — skipped"
                        )
                        continue
                    rekeys += 1
                    print(
                        f"  rekey  {winner['source_ref']!r} -> {membership_int!r} "
                        f"(fetched {winner['fetched_at']})"
                    )
                else:
                    print(f"  keep   {membership_int:<10} winner already stable, merging duplicates")

                for loser in losers:
                    merges += 1
                    print(
                        f"  merge  {loser['source_ref']!r} (fetched {loser['fetched_at']}) "
                        f"-> {membership_int!r}; claims + FK refs re-pointed, row deleted"
                    )

                if not args.apply:
                    continue

                with conn.cursor() as cur:
                    for loser in losers:
                        cur.execute(
                            """update public.evidence_claims
                                  set subject_id = %s::uuid
                                where subject_table = 'source_records'
                                  and subject_id = %s::uuid""",
                            (str(winner["id"]), str(loser["id"])),
                        )
                        for table in _FK_TABLES:
                            cur.execute(
                                f"update public.{table} set source_record_id = %s::uuid "
                                "where source_record_id = %s::uuid",
                                (str(winner["id"]), str(loser["id"])),
                            )
                        cur.execute(
                            "delete from public.source_records where id = %s::uuid",
                            (str(loser["id"]),),
                        )
                    if rekey_needed:
                        cur.execute(
                            "update public.source_records set source_ref = %s where id = %s::uuid",
                            (membership_int, str(winner["id"])),
                        )

        print(
            f"\n{len(supplier_ids)} supplier(s) examined; {rekeys} rekey(s), "
            f"{merges} duplicate row(s) merged away, {already_stable} already stable, "
            f"{collisions} collision(s) skipped, {len(unparseable)} row(s) with no "
            f"parseable membership left alone."
        )
        if multi_supplier:
            print(
                f"{len(multi_supplier)} membership number(s) live on more than one "
                f"supplier: {', '.join(sorted(multi_supplier))}. These are reported, "
                "not merged — resolve the ownership by hand."
            )
        if unparseable:
            print("Rows with no parseable membership number (left alone):")
            for row in unparseable:
                print(
                    f"  [{row['supplier_id']}] {row['company_name']}: "
                    f"ref={row['source_ref']!r} membership_no={row['membership_no']!r}"
                )

        if args.apply:
            conn.commit()
            print("Applied.")
        else:
            conn.rollback()
            print("Dry run — nothing written. Re-run with --apply to execute.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
