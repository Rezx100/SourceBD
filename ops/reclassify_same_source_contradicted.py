"""Reclassify same-source `contradicted` claims as `superseded`.

WHY
---
`supersede_claims` used url_hash as the proxy for "a different source
disagrees": a different URL asserting a different value retired the old claim
as `contradicted`, which stays on the /admin/evidence worklist. But a source
that MOVES its page mints a new url_hash for what is still the same source
updating itself — BKMEA re-lists members on new detail-page URLs — so every
re-listing was filed as a genuine disagreement. The 2 Aug 2026 bkmea_detail
run alone marked 396 claims contradicted across 65 suppliers; none were real.

The writer now classifies same-scraper replacement as `superseded` regardless
of URL. This script repairs the backlog written under the old rule.

WHAT IT DOES
------------
For every unreviewed `contradicted` claim, find the NEWEST other claim for the
same subject (subject_table / subject_id / subject_key) and field — the claim
that replaced it:

- Same scraper  -> the source updated itself across a page move; reclassify
  to `superseded` (bookkeeping, off the worklist).
- Different scraper -> a genuine cross-source disagreement; KEPT contradicted
  and reported by name.
- No other claim -> nothing to compare against; reported and left alone.

WHAT IT NEVER DOES
------------------
- Never touches `stale` claims (verifier territory) or already-reviewed rows.
- Never deletes anything; claims history is append-only.
- Never reclassifies across scraper codes — bkmea_web vs bkmea_detail are
  distinct codes, so list-vs-detail disagreement inside one registry stays.

USAGE
-----
    python ops/reclassify_same_source_contradicted.py            # dry run
    python ops/reclassify_same_source_contradicted.py --apply    # one transaction

Dry run is the default deliberately: this rewrites review-queue state, and the
plan should be read by a human before it runs.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from typing import Any

import psycopg
from psycopg.rows import dict_row

CANDIDATES_SQL = """
select c.id, c.subject_table, c.subject_id, c.subject_key, c.field_key,
       c.supplier_id, ed.scraper_code, s.company_name
  from public.evidence_claims c
  join public.evidence_documents ed on ed.id = c.evidence_id
  join public.suppliers s on s.id = c.supplier_id
 where c.status = 'contradicted'
   and c.reviewed_at is null
 order by s.company_name, c.field_key
"""

# The newest other claim for the same subject + field is the one that replaced
# this one. Any status qualifies: a same-scraper newest word means the source
# itself moved on, which is bookkeeping however the old row was filed.
LATEST_OTHER_SQL = """
select ed.scraper_code
  from public.evidence_claims c2
  join public.evidence_documents ed on ed.id = c2.evidence_id
 where c2.subject_table = %s
   and c2.subject_id is not distinct from %s
   and c2.subject_key is not distinct from %s
   and c2.field_key = %s
   and c2.id <> %s::uuid
 order by c2.created_at desc
 limit 1
"""

RECLASSIFY_SQL = """
update public.evidence_claims
   set status = 'superseded', updated_at = now()
 where id = %s::uuid
"""


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
            cur.execute(CANDIDATES_SQL)
            rows: list[dict[str, Any]] = cur.fetchall()

            reclassify: list[dict[str, Any]] = []
            kept: list[dict[str, Any]] = []
            orphans: list[dict[str, Any]] = []
            for row in rows:
                cur.execute(
                    LATEST_OTHER_SQL,
                    (
                        row["subject_table"], row["subject_id"], row["subject_key"],
                        row["field_key"], str(row["id"]),
                    ),
                )
                latest = cur.fetchone()
                if latest is None:
                    orphans.append(row)
                elif latest["scraper_code"] == row["scraper_code"]:
                    reclassify.append(row)
                else:
                    kept.append(row)

            by_scraper = Counter(r["scraper_code"] for r in reclassify)
            by_company = Counter(r["company_name"] for r in reclassify)
            print(f"{len(rows)} unreviewed contradicted claim(s) examined.")
            print(f"\nReclassify to superseded (same-scraper replacement): {len(reclassify)}")
            for scraper, n in by_scraper.most_common():
                print(f"  {scraper}: {n}")
            print(f"\n  across {len(by_company)} supplier(s); top:")
            for name, n in by_company.most_common(10):
                print(f"  {n:>4}  {name}")

            print(f"\nKept contradicted (genuine cross-source disagreement): {len(kept)}")
            for row in kept:
                print(
                    f"  {row['company_name']}: {row['field_key']} "
                    f"({row['scraper_code']} vs another source)"
                )
            print(f"\nNo replacing claim found (left alone): {len(orphans)}")
            for row in orphans:
                print(f"  {row['company_name']}: {row['field_key']} ({row['scraper_code']})")

            if args.apply:
                for row in reclassify:
                    cur.execute(RECLASSIFY_SQL, (str(row["id"]),))

        if args.apply:
            conn.commit()
            print(f"\nApplied: {len(reclassify)} claim(s) reclassified to superseded.")
        else:
            conn.rollback()
            print("\nDry run — nothing written. Re-run with --apply to execute.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
