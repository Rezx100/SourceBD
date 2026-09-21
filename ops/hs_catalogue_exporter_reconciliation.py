"""Reconcile design/assets/products/hs/manifest.json's `exporters` counts
against SourceBD's own EPB-export population.

WHY THIS EXISTS
---------------
Truthfulness audit, cycle 19, BLOCKING 1: the HS photo catalogue's
`exporters` count (rendered on the product sheet as "Other exporters of
<code>") was built from the EPB government page's own exporter count for
that heading — a WIDER population than the one SourceBD itself shows,
because SourceBD excludes any (host_slug, source_ref) pair on
`epb_record_is_foreign_to_host`'s denylist (a second EPB record on that
host that actually belongs to a different company; see
supabase/migrations/0103_epb_detail_url_and_hscodes.sql). On 21 Sep 2026,
29 of the 46 catalogued headings were off by 1 or 2 for exactly this
reason (HS 6105: catalogue said 1635, SourceBD's own population is 1634).

This is not staleness and re-running `build-hs-photos.mjs` alone does not
fix it — that script only copies `manifest.json`'s numbers into
`lib/hs-catalogue.ts`. The manifest's numbers have to be corrected against
THIS query first.

THE AUTHORITATIVE POPULATION
-----------------------------
The same population `supplier_epb_hscodes(p_slug)` reads per-supplier
(supabase/migrations, search that function), aggregated across all
suppliers and grouped by 4-digit heading instead of by supplier:

  - `suppliers.is_published = true`
  - an active `source_records` row from the `EPB` source
  - `source_records.source_ref ~ '^[0-9]+$'`
  - `NOT epb_record_is_foreign_to_host(supplier.slug, source_records.source_ref)`
  - each `epb_hscodes[].code` matching `^[0-9]{4,6}$`, truncated to its
    first 4 digits (`lib/dashboard/hs-photos.ts`'s `heading4`, mirrored in
    SQL as `left(btrim(code), 4)`)

Counted as `count(distinct supplier.id)` per heading.

USAGE
-----
    export SUPABASE_DB_URL=...   # read-only credentials are enough
    python ops/hs_catalogue_exporter_reconciliation.py            # report only
    python ops/hs_catalogue_exporter_reconciliation.py --check    # exit 1 on any mismatch

This is read-only. There is no --apply: a mismatch is fixed by hand in
`manifest.json` (update `exporters` and `queried_at`), then
`node scripts/build-hs-photos.mjs` to regenerate `lib/hs-catalogue.ts`, then
the two call sites pinned to the derived `otherExporters` value
(`lib/dashboard/build-models.test.ts`, `components/dashboard/render.test.ts`)
— see the commit that added this script for the exact sequence.

Why this can never become a CI test: CI has no production database access
(AGENTS.md — dry-runs need no approval, but they still need a live
connection this repo does not carry in its test environment). This script,
re-run by hand alongside the manifest whenever the catalogue is refreshed,
plus the existing `lib/dashboard/hs-photos.test.ts` structural check
(catalogue matches manifest, files present), is the closest a repository
without production access can get to a durable guard for this class of
bug — the remaining gap (manifest itself going stale between reconciliations)
is accepted, not solved, and is the same class of gap as any other
snapshot-of-production number in this codebase.

Exit codes: 0 ran clean (and, with --check, matched); 1 --check found a
mismatch; 2 could not run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "design/assets/products/hs/manifest.json"

QUERY = """
with epb_lines as (
  select s.id as supplier_id,
         left(btrim(hs.elem->>'code'), 4) as heading4
    from public.suppliers s
    join public.source_records sr
      on sr.supplier_id = s.id
     and sr.status = 'active'
    join public.sources src
      on src.id = sr.source_id
     and src.code = 'EPB'
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
        then sr.fields->'epb_hscodes'
        else '[]'::jsonb
      end
    ) as hs(elem)
   where s.is_published = true
     and sr.source_ref ~ '^[0-9]+$'
     and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
     and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
)
select heading4, count(distinct supplier_id) as exporters
  from epb_lines
 where heading4 = any(%(headings)s)
 group by heading4;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="exit 1 if any heading's manifest count is stale")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 2

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    headings = [p["hs"] for p in manifest["products"]]
    manifest_by_heading = {p["hs"]: p["exporters"] for p in manifest["products"]}

    try:
        with psycopg.connect(dsn, prepare_threshold=None, row_factory=dict_row) as conn, conn.cursor() as cur:
            cur.execute(QUERY, {"headings": headings})
            rows = cur.fetchall()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: query failed: {exc}", file=sys.stderr)
        return 2

    live_by_heading = {r["heading4"]: r["exporters"] for r in rows}

    missing = [h for h in headings if h not in live_by_heading]
    if missing:
        print(f"WARNING: {len(missing)} manifest heading(s) had zero matching rows live: {missing}", file=sys.stderr)

    mismatches = []
    for h in headings:
        manifest_count = manifest_by_heading[h]
        live_count = live_by_heading.get(h, 0)
        if manifest_count != live_count:
            mismatches.append((h, manifest_count, live_count))

    print(f"Checked {len(headings)} headings against production ({dsn.split('@')[-1] if '@' in dsn else 'db'}).")
    if mismatches:
        print(f"{len(mismatches)} heading(s) differ from manifest.json:")
        for h, manifest_count, live_count in mismatches:
            print(f"  {h}: manifest {manifest_count} vs live {live_count} ({live_count - manifest_count:+d})")
    else:
        print("All headings match manifest.json exactly.")

    if args.check:
        return 1 if mismatches else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
