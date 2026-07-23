#!/usr/bin/env python3
"""Probe discover_suppliers RPC and sample address data."""
from __future__ import annotations

import os
import sys

import psycopg


def main() -> None:
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url:
        raise SystemExit("SUPABASE_DB_URL not set")

    with psycopg.connect(url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for t in (
                "search_concepts",
                "search_terms",
                "search_stopwords",
                "search_concept_groups",
            ):
                cur.execute("select to_regclass(%s) is not null", (f"public.{t}",))
                print(f"{t}: {cur.fetchone()[0]}")

            try:
                cur.execute(
                    """
                    select count(*) from public.discover_suppliers(
                      p_q := null, p_entity_types := null, p_min_sources := null,
                      p_cert_kinds := null, p_rsc_min := null, p_city := null,
                      p_district := null, p_category := null, p_sort := 'default',
                      p_limit := 5, p_offset := 0, p_registries := null,
                      p_factory_types := null, p_brand_codes := null,
                      p_completeness_min := null, p_workers_min := null
                    )
                    """
                )
                print("discover_suppliers OK, rows:", cur.fetchone()[0])
            except Exception as exc:
                print("discover_suppliers ERROR:", type(exc).__name__, exc, file=sys.stderr)

            cur.execute(
                """
                select company_name, slug, left(address_raw, 80), city, district
                  from public.suppliers
                 where company_name ilike '%robintex%'
                 limit 3
                """
            )
            for row in cur.fetchall():
                print("SUPPLIER:", row)

            cur.execute(
                """
                select count(*) filter (where city is not null),
                       count(*) filter (where district is not null),
                       count(*)
                  from public.suppliers
                 where is_published = true
                """
            )
            print("published city/district counts:", cur.fetchone())

            cur.execute(
                """
                select pg_get_functiondef(p.oid)
                  from pg_proc p
                  join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public'
                   and p.proname = 'supplier_search_candidates'
                """
            )
            defn = cur.fetchone()[0]
            print("0069 hotfix applied:", "null::text as matched_product" in defn)

            for label, sql, params in (
                (
                    "gulshan robintex",
                    """
                    select company_name, slug, left(address_raw, 100), city, district
                      from public.suppliers
                     where address_raw ilike '%gulshan%'
                       and company_name ilike '%robintex%'
                     limit 5
                    """,
                    None,
                ),
                (
                    "taher tower",
                    """
                    select company_name, slug, left(address_raw, 100), city, district
                      from public.suppliers
                     where address_raw ilike '%taher tower%'
                     limit 5
                    """,
                    None,
                ),
            ):
                cur.execute(sql)
                print(f"{label}:")
                for row in cur.fetchall():
                    print(" ", row)


if __name__ == "__main__":
    main()
