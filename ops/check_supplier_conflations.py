"""Detect suppliers that hold registry records for a different company.

WHY THIS EXISTS
---------------
On 31 Jul 2026, 82 supplier profiles were found publishing two or more companies'
data as one. `S. B. KNITWEAR` carried B. S KNITWEAR and B. S TEXTILE; `ABANTI
COLOUR TEX` carried CRONY APPARELS. Nobody noticed for months, because a
conflated supplier looks completely normal from the outside — it has a name, an
address, a worker count and a certification list. They are just not all the same
company's.

On 4 Aug 2026 the founder found the same class again on the BGMEA side —
`Ananta Sportswear Ltd.` hiding inside `ABM Fashions Ltd.`, 808 stowaway
records in total — because this check scanned BKMEA only. It now scans BGMEA
general-member records too: any record whose scraped name is not the host
supplier's company is flagged, single record or not (the stowaway class needs
no second membership to be wrong).

`etl/core/upsert.py` now refuses the matches that caused it, and
`etl/tests/test_supplier_dedup_guards.py` pins that behaviour in CI. This script
is the third leg: it assumes those defences will eventually be circumvented — by
a new source, a threshold someone tunes, or a scraper that populates
`company_name_norm` differently — and makes the result *loud* instead of
invisible. A silent conflation is the expensive failure; a detected one is an
afternoon.

WHAT COUNTS AS A CONFLATION
---------------------------
Two BKMEA records under one supplier with different base membership numbers are
the *signal*, not the verdict: BKMEA re-issues numbers, so one company can
legitimately hold 1449 and 489. The names settle it, using `_names_compatible` —
the same predicate that governs merging in `_find_existing` and splitting in
`unmerge_bkmea_suppliers.py`. One definition of "the same company", applied
everywhere, so the detector cannot drift away from the rule it is policing.

Records with no scraped name are reported separately and do not fail the run.
There is nothing to compare, so calling them conflations would be a guess, and
a check that cries wolf gets switched off. (BGMEA records scraped before
4 Aug 2026 carry no `scraped_company_name` — they were repaired in bulk by
`ops/repair_bgmea_conflations.py` against a live-list snapshot and become
checkable here as re-scrapes refresh their fields.)

For BGMEA, a host name that merely EXTENDS the record's name (or vice versa —
"AKH Knitting & Dyeing Ltd. (Extension)" hosting "AKH Knitting & Dyeing Ltd.")
is the extension/unit class, deliberately separate suppliers, never flagged.

USAGE
-----
    python ops/check_supplier_conflations.py           # human-readable
    python ops/check_supplier_conflations.py --quiet   # only print on failure

Exit codes: 0 clean, 1 conflations found, 2 could not run the check.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

import psycopg
from psycopg.rows import dict_row

from etl.core.normalize import normalize_company_name
from etl.core.upsert import _names_compatible
from ops.repair_bgmea_conflations import _compatible as _host_record_compatible
from ops.unmerge_bkmea_suppliers import MERGED_SUPPLIERS_SQL

# Every BGMEA general record, its scraped name (present on records written
# after 4 Aug 2026), and the supplier it currently sits on.
BGMEA_RECORDS_SQL = """
select sr.id            as record_id,
       sr.supplier_id,
       sr.source_ref,
       sr.fields->>'scraped_company_name' as scraped_name,
       sup.company_name,
       sup.slug
  from public.source_records sr
  join public.sources s on s.id = sr.source_id and s.code = 'BGMEA'
  join public.suppliers sup on sup.id = sr.supplier_id
 where sr.source_ref like 'general:%'
 order by sup.company_name, sr.source_ref;
"""


def _conflated_names(groups: dict[str, list[dict]]) -> list[tuple[str, str]]:
    """Pairs of scraped names under one supplier that are not the same company."""
    named = {
        base_no: [normalize_company_name(r["scraped_name"]) for r in rows if r["scraped_name"]]
        for base_no, rows in groups.items()
    }
    bases = [b for b, names in named.items() if names]
    clashes: list[tuple[str, str]] = []
    for i, left in enumerate(bases):
        for right in bases[i + 1 :]:
            if not any(_names_compatible(a, b) for a in named[left] for b in named[right]):
                a = next(r["scraped_name"] for r in groups[left] if r["scraped_name"])
                b = next(r["scraped_name"] for r in groups[right] if r["scraped_name"])
                clashes.append((a.strip(), b.strip()))
    return clashes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="print only when the check fails")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 2

    try:
        with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(MERGED_SUPPLIERS_SQL)
                rows = cur.fetchall()
            with conn.cursor() as cur:
                cur.execute(BGMEA_RECORDS_SQL)
                bgmea_rows = cur.fetchall()
    except Exception as exc:  # noqa: BLE001
        # A check that cannot run is not a passing check.
        print(f"ERROR: could not query suppliers: {exc}", file=sys.stderr)
        return 2

    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_supplier[str(row["supplier_id"])].append(row)

    conflated: list[str] = []
    undecidable = 0

    for supplier_id, supplier_rows in by_supplier.items():
        groups: dict[str, list[dict]] = defaultdict(list)
        for row in supplier_rows:
            groups[row["base_no"]].append(row)

        clashes = _conflated_names(groups)
        if clashes:
            company = supplier_rows[0]["company_name"]
            pairs = "; ".join(f"{a!r} vs {b!r}" for a, b in clashes)
            conflated.append(f"  {company}  [{supplier_id}]\n      {pairs}")
        elif any(not r["scraped_name"] for r in supplier_rows):
            undecidable += 1

    bgmea_stowaways: list[str] = []
    bgmea_unnamed = 0
    for row in bgmea_rows:
        if not row["scraped_name"]:
            bgmea_unnamed += 1
            continue
        if not _host_record_compatible(row["company_name"], row["scraped_name"]):
            bgmea_stowaways.append(
                f"  {row['scraped_name']!r} ({row['source_ref']}) sits on "
                f"{row['company_name']!r} [{row['supplier_id']}]"
            )

    failed = False
    if conflated:
        failed = True
        print(
            f"FAIL: {len(conflated)} supplier(s) hold BKMEA records for more than one company.\n"
            f"Repair with: python ops/unmerge_bkmea_suppliers.py  (dry run first)\n"
        )
        print("\n".join(conflated))
    if bgmea_stowaways:
        failed = True
        print(
            f"FAIL: {len(bgmea_stowaways)} BGMEA record(s) sit on a different company's supplier.\n"
            f"Repair with: python ops/repair_bgmea_conflations.py  (dry run first)\n"
        )
        print("\n".join(bgmea_stowaways))
    if failed:
        return 1

    if not args.quiet:
        print(
            f"OK: no supplier holds BKMEA records for two different companies "
            f"({len(by_supplier)} supplier(s) carry multiple membership numbers; "
            f"{undecidable} of those have records with no scraped name to check), "
            f"and no named BGMEA record sits on the wrong supplier "
            f"({len(bgmea_rows)} BGMEA records scanned; {bgmea_unnamed} not yet "
            f"named — pre-4-Aug scrapes, checkable after the next bgmea_web run)."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
