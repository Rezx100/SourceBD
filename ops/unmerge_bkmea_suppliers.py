"""Split suppliers that hold BKMEA member records for more than one company.

WHY
---
Found on 31 Jul 2026 while investigating the /admin/evidence worklist: 82
suppliers carried two or more BKMEA member records whose *base* membership
numbers differ, meaning they are separate BKMEA members — separate legal
entities — merged into one profile. `S. B. KNITWEAR` held B. S KNITWEAR and
B. S TEXTILE; `ABANTI COLOUR TEX` held CRONY APPARELS; `M. H APPARELS LTD` held
five records across three companies.

They were merged by `_find_existing` in `etl/core/upsert.py`, mostly by Pass 2
and Pass 3 — a shared group mailbox or switchboard number, which Bangladesh RMG
groups routinely share across legally distinct factories. Those passes now
require the names to corroborate the contact; this script repairs the rows that
were written before that guard existed.

WHAT IT DOES NOT DO
-------------------
Buyer-facing rows created against the merged profile — saved_suppliers,
message_threads, orders, claim_requests, rfq_quotes — are never moved. A buyer
who saved "M. H APPARELS LTD" saved whatever the profile showed them at the
time, and there is no honest way to decide which of the underlying companies
they meant. They stay with the surviving supplier. Splitting evidence and source
data while leaving intent alone is the conservative half, and it is the half
that fixes the data moat.

Derived profile columns on the surviving supplier are cleared for the fields
`backfill_profile_columns.py` owns, because those were max-merged across records
that are about to belong to different companies. Re-run that script afterwards
to recompute them from each supplier's own records:

    python ops/backfill_profile_columns.py

USAGE
-----
    python ops/unmerge_bkmea_suppliers.py              # dry run, prints the plan
    python ops/unmerge_bkmea_suppliers.py --apply      # execute in one transaction
    python ops/unmerge_bkmea_suppliers.py --apply --limit 5   # execute a slice first

Dry run is the default deliberately: this rewrites supplier identity, and the
plan should be read by a human before it runs.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Any

import psycopg
from psycopg.rows import dict_row
from rapidfuzz import fuzz

from etl.core.normalize import make_slug, normalize_company_name
from etl.core.upsert import _names_compatible

# Columns `backfill_profile_columns.py` max-merges from BKMEA records. Left in
# place they would keep the largest value seen across companies that are about
# to be separated — the reason KNIT GUARD APPARELS still showed 150 sewing
# machines after BKMEA corrected it to 36.
DERIVED_COLUMNS = (
    "employees_total",
    "employees_male",
    "employees_female",
    "production_capacity_pcs_day",
    "machines_sewing",
)

MERGED_SUPPLIERS_SQL = """
with recs as (
  select sr.id            as record_id,
         sr.supplier_id,
         sr.source_ref,
         sr.fields,
         sr.fields->'bkmea_raw_kv'->>'Factory Name'     as scraped_name,
         split_part(sr.fields->>'bkmea_membership_no', '-', 1) as base_no
    from public.source_records sr
    join public.sources s on s.id = sr.source_id and s.code = 'BKMEA'
   where sr.fields ? 'bkmea_membership_no'
     and nullif(trim(split_part(sr.fields->>'bkmea_membership_no', '-', 1)), '') is not null
),
merged as (
  select supplier_id
    from recs
   group by supplier_id
  having count(distinct base_no) > 1
)
select r.record_id, r.supplier_id, r.source_ref, r.scraped_name, r.base_no,
       r.fields->>'bkmea_membership_no' as membership_no,
       sup.company_name, sup.slug
  from recs r
  join merged m on m.supplier_id = r.supplier_id
  join public.suppliers sup on sup.id = r.supplier_id
 order by sup.company_name, r.base_no, r.source_ref;
"""


def _group_key(row: dict[str, Any]) -> str:
    return row["base_no"]


def _is_same_company(survivor_rows: list[dict], candidate_rows: list[dict]) -> bool:
    """Whether a differing base membership number still means the same company.

    A different base number is the *signal* that two BKMEA records are different
    members, but it is not proof: BKMEA re-issues numbers, so one company can
    hold 1449 and 489, or 863 and 325, under the same name. The first dry run of
    this script proposed splitting `A. K. KNITWEAR LTD` off `A. K. KNITWEAR LTD`
    and `SHAN HOSIERY UNIT-2` off itself, which would have manufactured
    duplicates while fixing conflations.

    So the number opens the question and the name settles it, using the same
    predicate that now governs merging in `_find_existing` — one definition of
    "these are the same company", applied in both directions.
    """
    survivors = [normalize_company_name(r["scraped_name"]) for r in survivor_rows if r["scraped_name"]]
    candidates = [normalize_company_name(r["scraped_name"]) for r in candidate_rows if r["scraped_name"]]
    if not survivors or not candidates:
        return False
    return any(_names_compatible(a, b) for a in survivors for b in candidates)


def _pick_survivor(company_name: str, groups: dict[str, list[dict]]) -> str:
    """Which membership number keeps the existing supplier row.

    The one whose scraped Factory Name is closest to the name the profile is
    already published under, so the surviving slug keeps meaning what it meant.
    Ties and nameless records fall back to the group with the most records,
    which is the one carrying the most evidence.
    """
    target = normalize_company_name(company_name or "")

    def score(base_no: str) -> tuple[float, int]:
        names = [r["scraped_name"] for r in groups[base_no] if r["scraped_name"]]
        best = max((fuzz.ratio(target, normalize_company_name(n)) for n in names), default=-1.0)
        return (best, len(groups[base_no]))

    return max(groups, key=score)


def _unique_slug(cur, base: str) -> str:
    slug = base or "supplier"
    for suffix in range(0, 100):
        candidate = slug if suffix == 0 else f"{slug}-{suffix + 1}"
        cur.execute("select 1 from public.suppliers where slug = %s", (candidate,))
        if cur.fetchone() is None:
            return candidate
    raise RuntimeError(f"could not find a free slug for {base!r}")


def _new_company_name(rows: list[dict]) -> str | None:
    for r in rows:
        if r["scraped_name"]:
            return r["scraped_name"].strip()
    return None


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
            cur.execute(MERGED_SUPPLIERS_SQL)
            rows = cur.fetchall()

        by_supplier: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            by_supplier[str(row["supplier_id"])].append(row)

        supplier_ids = list(by_supplier)
        if args.limit is not None:
            supplier_ids = supplier_ids[: args.limit]

        planned_splits = 0
        skipped_unnamed = 0
        kept_relisting = 0
        reused_member = 0
        stranded_records = 0

        # One BKMEA member can be attached to two different merged suppliers —
        # member 376 (CRONY APPARELS LTD) sits under both ABANTI COLOUR TEX and
        # CRONY FASHION. Splitting each parent independently would create two
        # suppliers for one company, trading a conflation for a duplicate. The
        # membership number is the identity, so the first split of a member wins
        # and later ones attach to it.
        supplier_for_member: dict[str, Any] = {}

        for supplier_id in supplier_ids:
            supplier_rows = by_supplier[supplier_id]
            company_name = supplier_rows[0]["company_name"]

            groups: dict[str, list[dict]] = defaultdict(list)
            for row in supplier_rows:
                groups[_group_key(row)].append(row)

            survivor = _pick_survivor(company_name, groups)
            split_here = 0
            print(f"\n{company_name}  [{supplier_id}]")
            print(f"  keep   {survivor:<10} {_names(groups[survivor])}")

            for base_no, group_rows in groups.items():
                if base_no == survivor:
                    continue
                if _is_same_company(groups[survivor], group_rows):
                    kept_relisting += 1
                    print(f"  keep   {base_no:<10} re-listing of the same company")
                    continue
                new_name = _new_company_name(group_rows)
                if not new_name:
                    # No Factory Name was ever scraped for this membership
                    # number, so there is nothing to name the new supplier
                    # after. Leaving it attached is wrong but recoverable;
                    # inventing a name is neither.
                    skipped_unnamed += 1
                    print(f"  SKIP   {base_no:<10} no scraped name on {len(group_rows)} record(s)")
                    continue

                planned_splits += 1
                split_here += 1
                already = base_no in supplier_for_member
                if already:
                    reused_member += 1
                    print(
                        f"  split  {base_no:<10} -> {new_name!r} "
                        f"({len(group_rows)} record(s), joins the supplier already split for this member)"
                    )
                else:
                    print(f"  split  {base_no:<10} -> {new_name!r} ({len(group_rows)} record(s))")

                if not args.apply:
                    supplier_for_member.setdefault(base_no, True)
                    continue

                with conn.cursor() as cur:
                    new_id = supplier_for_member.get(base_no)
                    if new_id is None:
                        slug = _unique_slug(cur, make_slug(new_name))
                        cur.execute(
                            """insert into public.suppliers (company_name, slug, company_name_norm)
                               values (%s, %s, %s)
                               returning id""",
                            (new_name, slug, normalize_company_name(new_name)),
                        )
                        new_id = cur.fetchone()["id"]
                        supplier_for_member[base_no] = new_id

                    record_ids = [r["record_id"] for r in group_rows]
                    # `source_records` is unique on (supplier_id, source_id,
                    # source_ref), and two wrongly-merged parents can each hold a
                    # scrape of the *same* BKMEA page — ABANTI COLOUR TEX and CRONY
                    # FASHION both carry source_ref 373 for member 376. Once the
                    # first parent's copy has moved, the second collides. The
                    # collision means the destination already has that page, so the
                    # duplicate is left on its original parent rather than deleted:
                    # a stranded row is visible and fixable, a deleted one is not.
                    cur.execute(
                        """update public.source_records sr
                              set supplier_id = %s
                            where sr.id = any(%s)
                              and not exists (
                                    select 1
                                      from public.source_records o
                                     where o.supplier_id = %s
                                       and o.source_id   = sr.source_id
                                       and o.source_ref  = sr.source_ref
                                       and o.id <> sr.id
                                  )
                          returning sr.id""",
                        (new_id, record_ids, new_id),
                    )
                    moved_ids = [r["id"] for r in cur.fetchall()]
                    stranded = len(record_ids) - len(moved_ids)
                    if stranded:
                        stranded_records += stranded
                        print(
                            f"         {stranded} record(s) left on the parent — "
                            f"{new_name!r} already has that source page"
                        )
                    if not moved_ids:
                        continue

                    # Claims follow only the records that actually moved.
                    cur.execute(
                        """update public.evidence_claims
                              set supplier_id = %s
                            where supplier_id = %s
                              and subject_table = 'source_records'
                              and subject_id = any(%s::uuid[])""",
                        (new_id, supplier_id, [str(r) for r in moved_ids]),
                    )

            # Only the suppliers that actually lost records have derived columns
            # max-merged across companies that no longer belong together.
            if args.apply and split_here:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""update public.suppliers
                               set {', '.join(f'{c} = null' for c in DERIVED_COLUMNS)},
                                   updated_at = now()
                             where id = %s""",
                        (supplier_id,),
                    )

        print(
            f"\n{len(supplier_ids)} candidate supplier(s); {planned_splits} split(s) planned "
            f"({reused_member} joining a member already split); "
            f"{kept_relisting} left alone as re-listings; "
            f"{skipped_unnamed} skipped for want of a name; "
            f"{stranded_records} record(s) stranded on a parent as duplicates."
        )

        if args.apply:
            conn.commit()
            print("Applied. Now run: python ops/backfill_profile_columns.py")
        else:
            conn.rollback()
            print("Dry run — nothing written. Re-run with --apply to execute.")

    return 0


def _names(rows: list[dict]) -> str:
    seen = {r["scraped_name"] for r in rows if r["scraped_name"]}
    return ", ".join(sorted(seen)) if seen else "(no scraped name)"


if __name__ == "__main__":
    sys.exit(main())
