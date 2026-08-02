"""Repair BKMEA registry display: frozen columns + within-provider claim noise.

WHY
---
Founder rule, 3 Aug 2026: the provider's current page is the truth and must
show without a review round-trip. Two defects violated it:

1. `suppliers.bkmea_reg_number` was written `coalesce(existing, new)` —
   first-writer-wins — so suppliers displayed frozen membership numbers that
   matched neither the current list nor the current detail page (KHADIZA
   KNITWEARS showed 642 - B/2008 while BKMEA said 503 - C/2000 on both).
   The upsert now lets the canonical detail page overwrite and the list only
   fill a NULL; this script recomputes the column for the backlog.

2. The list and the detail page both CLAIMED the membership fields, so a
   list-vs-page disagreement became a `contradicted` review item. The list no
   longer claims detail-owned fields when a detail page exists; this script
   retires the backlog those competing citations left behind.

WHAT IT DOES (all reported, dry-run default)
--------------------------------------------
A. Columns: per supplier with a BKMEA list row, the correct value is the
   `:detail` row's `bkmea_reg_number` (junk-guarded: must lead with its
   integer) when present, else the list row's. Updates only mismatches.
B. Claims, in order:
   1. unreviewed `contradicted` claims whose ACTIVE same-field replacement
      carries the SAME value (self-resolved noise) -> `superseded`.
   2. unreviewed `contradicted` bkmea_web claims on detail-owned fields whose
      newest replacement is bkmea_detail's (the canonical page won) ->
      `superseded`.
   3. ACTIVE bkmea_detail membership claims whose value is junk (no leading
      integer) -> `superseded`; any supplier+field left with no active claim
      gets its newest contradicted bkmea_web claim reactivated (it is the
      standing citation — e.g. KNIT FASHION's list value 511 - B/2000, whose
      detail page shows a blank).
   4. redundant ACTIVE bkmea_web claims on bkmea_membership_no /
      bkmea_reg_number where an ACTIVE bkmea_detail claim exists for the same
      supplier+field -> `superseded` (one canonical citation per provider).

WHAT IT NEVER DOES
------------------
- Never deletes anything; claim history is append-only.
- Never touches stale claims (verifier territory) or reviewed rows.
- Never overwrites a column with a junk or NULL value.

USAGE
-----
    python ops/repair_bkmea_registry_display.py            # dry run
    python ops/repair_bkmea_registry_display.py --apply    # one transaction
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

_MEMNO_HEAD_RE = re.compile(r"^\d+\s*-")

_DETAIL_OWNED_FIELDS = ("bkmea_membership_no", "bkmea_reg_number")

COLUMN_CANDIDATES_SQL = """
select s.id as supplier_id, s.company_name, s.bkmea_reg_number as current,
       l.fields->>'bkmea_reg_number' as list_reg,
       d.fields->>'bkmea_reg_number' as detail_reg
  from public.suppliers s
  join public.source_records l
    on l.supplier_id = s.id
   and l.source_id = (select id from public.sources where code = 'BKMEA')
   and position(':' in l.source_ref) = 0
  left join public.source_records d
    on d.supplier_id = s.id
   and d.source_id = l.source_id
   and d.source_ref = (l.fields->>'bkmea_detail_id') || ':detail'
 order by s.company_name
"""

CONTRADICTED_SQL = """
select c.id, c.supplier_id, c.field_key, c.field_value, ed.scraper_code,
       s.company_name
  from public.evidence_claims c
  join public.evidence_documents ed on ed.id = c.evidence_id
  join public.suppliers s on s.id = c.supplier_id
 where c.status = 'contradicted'
   and c.reviewed_at is null
 order by s.company_name, c.field_key
"""

ACTIVE_FOR_FIELD_SQL = """
select c.id, c.field_value, ed.scraper_code
  from public.evidence_claims c
  join public.evidence_documents ed on ed.id = c.evidence_id
 where c.supplier_id = %s::uuid
   and c.field_key = %s
   and c.status = 'active'
 order by c.created_at desc
"""

JUNK_DETAIL_SQL = """
select c.id, c.supplier_id, c.field_key, c.field_value, s.company_name
  from public.evidence_claims c
  join public.evidence_documents ed on ed.id = c.evidence_id
  join public.suppliers s on s.id = c.supplier_id
 where c.status = 'active'
   and ed.scraper_code = 'bkmea_detail'
   and c.field_key = any(%s::text[])
"""

REDUNDANT_LIST_SQL = """
select c.id, c.supplier_id, c.field_key, c.field_value, s.company_name
  from public.evidence_claims c
  join public.evidence_documents ed on ed.id = c.evidence_id
  join public.suppliers s on s.id = c.supplier_id
 where c.status = 'active'
   and ed.scraper_code = 'bkmea_web'
   and c.field_key = any(%s::text[])
   and exists (
       select 1
         from public.evidence_claims d
         join public.evidence_documents dd on dd.id = d.evidence_id
        where d.supplier_id = c.supplier_id
          and d.field_key = c.field_key
          and d.status = 'active'
          and dd.scraper_code = 'bkmea_detail'
   )
"""

SET_STATUS_SQL = """
update public.evidence_claims
   set status = %s, updated_at = now()
 where id = %s::uuid
"""

SET_COLUMN_SQL = """
update public.suppliers set bkmea_reg_number = %s where id = %s::uuid
"""


def _valid(value: str | None) -> bool:
    return bool(value) and bool(_MEMNO_HEAD_RE.match(value.strip()))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # ---- A. columns ------------------------------------------------
            cur.execute(COLUMN_CANDIDATES_SQL)
            rows = cur.fetchall()
            by_supplier: dict[Any, list[dict]] = defaultdict(list)
            for row in rows:
                by_supplier[row["supplier_id"]].append(row)

            column_fixes: list[tuple[dict, str]] = []
            for _sid, srows in by_supplier.items():
                correct = next(
                    (r["detail_reg"].strip() for r in srows if _valid(r["detail_reg"])),
                    None,
                )
                if correct is None:
                    correct = next(
                        (r["list_reg"].strip() for r in srows if _valid(r["list_reg"])),
                        None,
                    )
                current = srows[0]["current"]
                if correct and (current or "").strip() != correct:
                    column_fixes.append((srows[0], correct))

            print(f"A. registry columns: {len(by_supplier)} supplier(s) examined, "
                  f"{len(column_fixes)} frozen value(s) to repair:")
            for row, correct in column_fixes:
                print(f"  {row['company_name']}: {row['current']!r} -> {correct!r}")

            # ---- B1/B2. contradicted backlog -------------------------------
            cur.execute(CONTRADICTED_SQL)
            contradicted = cur.fetchall()
            self_resolved: list[dict] = []
            canonical_won: list[dict] = []
            kept: list[dict] = []
            for row in contradicted:
                cur.execute(ACTIVE_FOR_FIELD_SQL, (str(row["supplier_id"]), row["field_key"]))
                actives = cur.fetchall()
                if not actives:
                    kept.append(row)
                    continue
                newest = actives[0]
                if newest["field_value"] == row["field_value"]:
                    self_resolved.append(row)
                elif (row["scraper_code"] == "bkmea_web"
                      and row["field_key"] in _DETAIL_OWNED_FIELDS
                      and newest["scraper_code"] == "bkmea_detail"):
                    canonical_won.append(row)
                else:
                    kept.append(row)

            print(f"\nB1. self-resolved contradicted (active claim agrees): "
                  f"{len(self_resolved)} -> superseded")
            for row in self_resolved:
                print(f"  {row['company_name']}: {row['field_key']} = {row['field_value']!r}")
            print(f"\nB2. list-vs-detail where the canonical page won: "
                  f"{len(canonical_won)} -> superseded")
            for row in canonical_won:
                print(f"  {row['company_name']}: {row['field_key']} list {row['field_value']!r}")
            print(f"\n   kept contradicted (genuine, no active agreement): {len(kept)}")
            for row in kept:
                print(f"  {row['company_name']}: {row['field_key']} = {row['field_value']!r}")

            # ---- B3. junk detail claims + reactivation ---------------------
            cur.execute(JUNK_DETAIL_SQL, (list(_DETAIL_OWNED_FIELDS),))
            junk = [r for r in cur.fetchall() if not _valid(r["field_value"])]
            reactivate: list[dict] = []
            for row in junk:
                cur.execute(ACTIVE_FOR_FIELD_SQL, (str(row["supplier_id"]), row["field_key"]))
                remaining = [a for a in cur.fetchall() if a["id"] != row["id"]]
                if remaining:
                    continue  # another active claim stands; nothing to restore
                cur.execute(
                    """select c.id, c.field_value
                         from public.evidence_claims c
                         join public.evidence_documents ed on ed.id = c.evidence_id
                        where c.supplier_id = %s::uuid
                          and c.field_key = %s
                          and c.status = 'contradicted'
                          and ed.scraper_code = 'bkmea_web'
                        order by c.created_at desc
                        limit 1""",
                    (str(row["supplier_id"]), row["field_key"]),
                )
                fallen = cur.fetchone()
                if fallen:
                    reactivate.append({**row, "reactivate_id": fallen["id"],
                                       "reactivate_value": fallen["field_value"]})

            print(f"\nB3. junk active detail claims: {len(junk)} -> superseded; "
                  f"{len(reactivate)} list claim(s) reactivated as the standing citation")
            for row in junk:
                print(f"  supersede {row['company_name']}: {row['field_key']} = {row['field_value']!r}")
            for row in reactivate:
                print(f"  reactivate {row['company_name']}: {row['field_key']} = {row['reactivate_value']!r}")

            # ---- B4. redundant list claims ---------------------------------
            cur.execute(REDUNDANT_LIST_SQL, (list(_DETAIL_OWNED_FIELDS),))
            redundant = cur.fetchall()
            print(f"\nB4. redundant active list claims (detail claim stands for the "
                  f"same field): {len(redundant)} -> superseded")

            # ---- apply -----------------------------------------------------
            if args.apply:
                for row, correct in column_fixes:
                    cur.execute(SET_COLUMN_SQL, (correct, str(row["supplier_id"])))
                for row in (*self_resolved, *canonical_won, *junk, *redundant):
                    cur.execute(SET_STATUS_SQL, ("superseded", str(row["id"])))
                for row in reactivate:
                    cur.execute(SET_STATUS_SQL, ("active", str(row["reactivate_id"])))

        if args.apply:
            conn.commit()
            print("\nApplied.")
        else:
            conn.rollback()
            print("\nDry run — nothing written. Re-run with --apply to execute.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
