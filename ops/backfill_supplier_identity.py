"""Backfill suppliers.slug + suppliers.company_name_norm with current normalization.

WHY
---
The 12-May-2026 supplier generation was normalized by code that has since
changed (industry words were briefly stripped and restored, `plc` was not a
recognized legal suffix until REZ-56, abbreviation rules grew). The matcher
reads the STORED columns: Pass 1 compares the incoming record's freshly
computed slug against stored slugs, and Pass 4's trigram prefilter runs on
stored `company_name_norm`. Drifted stored values make the matcher blind to
twins it would otherwise catch — observed 3 Aug 2026: 505 published suppliers
carrying drifted identity values and 26 certain duplicate clusters
(`ops/audit_cross_register_coverage.py` recomputes identity on the fly and
reports them; this script repairs the stored columns so the matcher sees it
too).

COLLISIONS
----------
Two suppliers can recompute to the same slug — that IS the duplicate class
`ops/merge_duplicate_suppliers.py` heals. `suppliers.slug` is unique, so only
one row can hold it. Collisions also chain: `T & T Company` wants `t-and-t`,
which `T & T Fashion` holds by drift and will itself vacate — so the script
runs up to five passes and stops when a pass changes nothing. Whatever still
cannot take its recomputed slug after the final pass is reported as a merge
candidate: heal it with the merge, then re-run this backfill.

On a collision the norm is still updated (no unique constraint; it only feeds
matcher visibility) and the slug waits.

USAGE
-----
    python ops/backfill_supplier_identity.py            # dry run, prints the plan
    python ops/backfill_supplier_identity.py --apply    # write, one transaction
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg
from psycopg.rows import dict_row

from etl.core.normalize import make_slug, normalize_company_name

SUPPLIERS_SQL = """
select id::text, company_name, company_name_norm, slug, is_published, created_at
  from public.suppliers
 order by created_at
"""

MAX_PASSES = 5


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(SUPPLIERS_SQL)
            rows = cur.fetchall()
        by_id = {r["id"]: r for r in rows}

        recomputed = {}
        for r in rows:
            name = r["company_name"] or ""
            recomputed[r["id"]] = (make_slug(name), normalize_company_name(name))

        # Simulated identity columns, written through to the DB under --apply.
        # Dry-run and apply therefore see identical passes: a slug vacated by
        # one supplier in pass 1 is free for the next supplier in pass 2 in
        # both modes.
        sim_slug = {r["id"]: r["slug"] for r in rows}
        sim_norm = {r["id"]: (r["company_name_norm"] or "") for r in rows}

        n_initial = sum(
            1
            for r in rows
            if recomputed[r["id"]][0]
            and (r["slug"] != recomputed[r["id"]][0] or sim_norm[r["id"]] != recomputed[r["id"]][1])
        )
        empty_name = sum(1 for r in rows if not recomputed[r["id"]][0])
        print(
            f"{len(rows)} suppliers; {n_initial} drifted at start "
            f"({sum(1 for r in rows if r['is_published'])} published total); "
            f"{empty_name} skipped (empty recomputed slug)."
        )

        total_updates = 0
        passes_run = 0
        for pass_no in range(1, MAX_PASSES + 1):
            owner: dict[str, str] = {}
            for sid, s in sim_slug.items():
                owner.setdefault(s, sid)

            planned = [
                r
                for r in rows
                if recomputed[r["id"]][0]
                and (
                    sim_slug[r["id"]] != recomputed[r["id"]][0]
                    or sim_norm[r["id"]] != recomputed[r["id"]][1]
                )
            ]
            if not planned:
                break
            passes_run = pass_no

            pass_updates = 0
            with conn.cursor() as cur:
                for r in planned:
                    sid = r["id"]
                    rec_slug, rec_norm = recomputed[sid]
                    slug_drifts = sim_slug[sid] != rec_slug
                    holder = owner.get(rec_slug)
                    slug_free = holder is None or holder == sid

                    if slug_drifts and not slug_free:
                        # Slug stays with its holder (merge candidate); the
                        # norm still heals — it only feeds matcher visibility.
                        if sim_norm[sid] != rec_norm:
                            if args.apply:
                                cur.execute(
                                    """update public.suppliers
                                          set company_name_norm = %s, updated_at = now()
                                        where id = %s::uuid""",
                                    (rec_norm, sid),
                                )
                            sim_norm[sid] = rec_norm
                            pass_updates += 1
                        continue

                    if args.apply:
                        cur.execute(
                            """update public.suppliers
                                  set slug = %s, company_name_norm = %s, updated_at = now()
                                where id = %s::uuid""",
                            (rec_slug, rec_norm, sid),
                        )
                    old = sim_slug[sid]
                    sim_slug[sid] = rec_slug
                    sim_norm[sid] = rec_norm
                    owner.pop(old, None)
                    owner[rec_slug] = sid
                    pass_updates += 1

            total_updates += pass_updates
            print(f"  pass {pass_no}: {len(planned)} drifted row(s), {pass_updates} update(s)")
            if pass_updates == 0:
                break

        # Whatever is still drifted after the final pass is blocked by another
        # supplier holding its recomputed slug — the merge-candidate set.
        remaining = [
            r
            for r in rows
            if recomputed[r["id"]][0] and sim_slug[r["id"]] != recomputed[r["id"]][0]
        ]
        if remaining:
            print(f"\n{len(remaining)} supplier(s) still blocked on a held slug (merge candidates):")
            owner: dict[str, str] = {}
            for sid, s in sim_slug.items():
                owner.setdefault(s, sid)
            for r in remaining:
                rec_slug = recomputed[r["id"]][0]
                holder = by_id.get(owner.get(rec_slug, ""), None)
                holder_desc = f"{holder['company_name']!r}[{holder['id'][:6]}]" if holder else "(unknown)"
                print(
                    f"  {'PUB' if r['is_published'] else '   '} {r['company_name']!r}[{r['id'][:6]}] "
                    f"wants {rec_slug!r}, held by {holder_desc}"
                )

        if args.apply:
            conn.commit()
            print(
                f"\nApplied: {total_updates} identity update(s) across {passes_run} pass(es); "
                f"{len(remaining)} slug-blocked row(s) left for the merge."
            )
        else:
            conn.rollback()
            print(
                f"\nDry run — nothing written. {total_updates} identity update(s) across "
                f"{passes_run} pass(es) would be made. Re-run with --apply to execute."
            )

    return 0


if __name__ == "__main__":
    sys.exit(main())
