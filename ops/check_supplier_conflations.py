"""Detect suppliers that hold BKMEA member records for more than one company.

WHY THIS EXISTS
---------------
On 31 Jul 2026, 82 supplier profiles were found publishing two or more companies'
data as one. `S. B. KNITWEAR` carried B. S KNITWEAR and B. S TEXTILE; `ABANTI
COLOUR TEX` carried CRONY APPARELS. Nobody noticed for months, because a
conflated supplier looks completely normal from the outside — it has a name, an
address, a worker count and a certification list. They are just not all the same
company's.

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

Records with no scraped Factory Name are reported separately and do not fail the
run. There is nothing to compare, so calling them conflations would be a guess,
and a check that cries wolf gets switched off.

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
from ops.unmerge_bkmea_suppliers import MERGED_SUPPLIERS_SQL


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

    if conflated:
        print(
            f"FAIL: {len(conflated)} supplier(s) hold BKMEA records for more than one company.\n"
            f"Repair with: python ops/unmerge_bkmea_suppliers.py  (dry run first)\n"
        )
        print("\n".join(conflated))
        return 1

    if not args.quiet:
        print(
            f"OK: no supplier holds BKMEA records for two different companies "
            f"({len(by_supplier)} supplier(s) carry multiple membership numbers; "
            f"{undecidable} of those have records with no scraped name to check)."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
