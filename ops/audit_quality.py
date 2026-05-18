"""Audit: data quality across all 4,414 suppliers + Biswas Group investigation."""
from etl.core.db import db


def section(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


with db.conn() as c, c.cursor() as cur:
    # ============================================================
    # 1. BISWAS GROUP investigation
    # ============================================================
    section("1. BISWAS GROUP — what RSC actually returned")
    cur.execute(
        """select rsc_factory_id, rsc_factory_name, parent_group_name,
                  workers_count, progress_pct, remediation_status, training_status,
                  rsc_location, active
             from public.rsc_remediation
             where parent_group_name ilike '%biswas%'
             order by rsc_factory_id"""
    )
    rows = cur.fetchall()
    print(f"  rows under parent_group_name ilike '%biswas%' : {len(rows)}")
    for r in rows[:25]:
        print(f"    fid={r['rsc_factory_id']:<8} {r['rsc_factory_name'][:50]:<50} "
              f"workers={r['workers_count']!s:<6} prog={r['progress_pct']!s:<5}% "
              f"status={r['remediation_status']!s:<14} train={r['training_status']!s:<10} active={r['active']}")
    if len(rows) > 25:
        print(f"    ... +{len(rows)-25} more")

    # check raw payload too
    cur.execute(
        """select rsc_factory_id, rsc_factory_name,
                  raw->'supplier' as raw_supplier,
                  raw->'status' as raw_status,
                  raw->'designation' as raw_designation
             from public.rsc_remediation
             where parent_group_name ilike '%biswas%'
             limit 5""" if False else
        """select sr.source_ref, s.company_name, sr.fields->'raw' as raw
             from public.source_records sr
             join public.suppliers s on s.id = sr.supplier_id
             join public.sources src on src.id = sr.source_id
             where src.code = 'RSC'
               and (sr.fields->'raw'->'supplier'->>'name') ilike '%biswas%'
             limit 5"""
    )
    print()
    print("  Raw RSC API supplier-block samples for Biswas:")
    for r in cur.fetchall():
        raw = r["raw"] or {}
        print(f"    ref={r['source_ref']:<8} name={r['company_name'][:40]:<40} "
              f"raw.status={raw.get('status')} raw.supplier={raw.get('supplier')}")

    # ============================================================
    # 2. DUPLICATES — exact + slug + fuzzy candidates
    # ============================================================
    section("2. DUPLICATES — exact name collisions")
    cur.execute(
        """select company_name, count(*) as n
             from public.suppliers
             group by 1 having count(*) > 1
             order by n desc, company_name limit 20"""
    )
    rows = cur.fetchall()
    print(f"  Exact-name duplicates: {len(rows)} groups")
    for r in rows[:20]:
        print(f"    x{r['n']}  {r['company_name']}")

    section("2b. DUPLICATES — same normalized slug, different display names")
    cur.execute(
        """select slug, count(*) as n,
                  array_agg(company_name order by company_name) as names
             from public.suppliers
             group by 1 having count(*) > 1
             order by n desc limit 30"""
    )
    rows = cur.fetchall()
    print(f"  Same-slug groups: {len(rows)}")
    for r in rows[:30]:
        print(f"    x{r['n']}  slug={r['slug']}")
        for nm in r["names"]:
            print(f"          - {nm}")

    section("2c. DUPLICATES — likely-same fuzzy pairs (token_sort_ratio >= 92, different supplier_id)")
    # Use pg_trgm similarity as a cheap pre-filter
    cur.execute(
        """select a.id as id_a, b.id as id_b,
                  a.company_name as name_a, b.company_name as name_b,
                  similarity(a.company_name_norm, b.company_name_norm) as sim,
                  a.source_tags as tags_a, b.source_tags as tags_b
             from public.suppliers a
             join public.suppliers b
               on a.id < b.id
              and a.company_name_norm % b.company_name_norm
              and similarity(a.company_name_norm, b.company_name_norm) >= 0.85
             order by sim desc
             limit 40"""
    )
    pairs = cur.fetchall()
    print(f"  Trigram-similar pairs (sim >= 0.85): {len(pairs)} (showing top 40)")
    for r in pairs[:40]:
        print(f"    sim={r['sim']:.2f}  '{r['name_a'][:40]}'  ::  '{r['name_b'][:40]}'  "
              f"tags={r['tags_a']}/{r['tags_b']}")

    # ============================================================
    # 3. COMPLETENESS — missing fields
    # ============================================================
    section("3. COMPLETENESS")
    cur.execute(
        """select
             count(*) as total,
             count(*) filter (where company_name is null or company_name = '') as missing_name,
             count(*) filter (where slug is null or slug = '') as missing_slug,
             count(*) filter (where city is null or city = '') as missing_city,
             count(*) filter (where address_raw is null or address_raw = '') as missing_address,
             count(*) filter (where email_primary is null or email_primary = '') as missing_email,
             count(*) filter (where phones is null or array_length(phones,1) is null) as missing_phone,
             count(*) filter (where entity_type is null) as missing_entity_type,
             count(*) filter (where source_tags is null or array_length(source_tags,1) is null) as missing_source_tags
            from public.suppliers"""
    )
    r = cur.fetchone()
    total = r["total"]
    for k, v in r.items():
        if k == "total":
            continue
        pct = (v / total * 100) if total else 0
        print(f"  {k:<24}  {v:>5} / {total} ({pct:.1f}%)")

    section("3b. COMPLETENESS by source")
    cur.execute(
        """with t as (
             select unnest(source_tags) as tag, * from public.suppliers
           )
           select tag,
                  count(*) as n,
                  count(*) filter (where city is not null and city <> '') as has_city,
                  count(*) filter (where email_primary is not null and email_primary <> '') as has_email,
                  count(*) filter (where phones is not null and array_length(phones,1) is not null) as has_phone
             from t group by 1 order by n desc"""
    )
    print(f"  {'tag':<10} {'count':>6} {'city':>8} {'email':>8} {'phone':>8}")
    for r in cur.fetchall():
        print(f"  {r['tag']:<10} {r['n']:>6} {r['has_city']:>8} {r['has_email']:>8} {r['has_phone']:>8}")

    # ============================================================
    # 4. SUSPICIOUS NAMES — truncation / encoding / weirdness
    # ============================================================
    section("4. SUSPICIOUS COMPANY NAMES")
    cur.execute(
        """select company_name from public.suppliers
            where company_name ~ '\\.\\.\\.$'        -- ends with ellipsis
               or company_name ~ '\\s$'              -- trailing whitespace
               or company_name ~ '^\\s'              -- leading whitespace
               or length(company_name) < 4          -- absurdly short
               or company_name ~ '[\\u0080-\\uFFFF]' -- non-ascii (could be legit)
            limit 30"""
    )
    rows = cur.fetchall()
    print(f"  Sample suspicious names (max 30): {len(rows)}")
    for r in rows:
        print(f"    [{len(r['company_name']):>3}] '{r['company_name']}'")

    cur.execute(
        """select length(company_name) as len, count(*) as n
             from public.suppliers
             group by 1 order by 1 limit 10"""
    )
    print()
    print("  Shortest name lengths:")
    for r in cur.fetchall():
        print(f"    len={r['len']}  count={r['n']}")

    # ============================================================
    # 5. RSC-specific data quality
    # ============================================================
    section("5. RSC DATA QUALITY")
    cur.execute(
        """select
             count(*) as total,
             count(*) filter (where rsc_factory_id is null) as no_factory_id,
             count(*) filter (where workers_count is null) as no_workers,
             count(*) filter (where workers_count = 0) as zero_workers,
             count(*) filter (where progress_pct is null) as no_progress,
             count(*) filter (where progress_pct = 0) as zero_progress,
             count(*) filter (where fire_inspection_url is null
                              and structural_inspection_url is null
                              and electrical_inspection_url is null) as no_inspection_urls,
             count(*) filter (where cap_url is null) as no_cap,
             count(*) filter (where parent_group_name is null) as no_parent_group,
             count(*) filter (where remediation_status is null) as no_status,
             count(*) filter (where active = false) as inactive
            from public.rsc_remediation"""
    )
    r = cur.fetchone()
    total = r["total"]
    for k, v in r.items():
        if k == "total":
            continue
        pct = (v / total * 100) if total else 0
        print(f"  {k:<22}  {v:>5} / {total} ({pct:.1f}%)")

    section("5b. RSC remediation_status distribution")
    cur.execute(
        """select coalesce(remediation_status, '<null>') as status, count(*) as n
             from public.rsc_remediation group by 1 order by n desc"""
    )
    for r in cur.fetchall():
        print(f"  {r['status']:<24}  {r['n']}")

    section("5c. RSC training_status distribution")
    cur.execute(
        """select coalesce(training_status, '<null>') as status, count(*) as n
             from public.rsc_remediation group by 1 order by n desc"""
    )
    for r in cur.fetchall():
        print(f"  {r['status']:<24}  {r['n']}")

    section("5d. Workers_count distribution buckets")
    cur.execute(
        """select case
                    when workers_count is null then 'NULL'
                    when workers_count = 0 then '0'
                    when workers_count between 1 and 99 then '1-99'
                    when workers_count between 100 and 499 then '100-499'
                    when workers_count between 500 and 1999 then '500-1999'
                    when workers_count between 2000 and 4999 then '2000-4999'
                    when workers_count >= 5000 then '5000+'
                  end as bucket, count(*) as n
             from public.rsc_remediation group by 1 order by min(workers_count) nulls first"""
    )
    for r in cur.fetchall():
        print(f"  {r['bucket']:<14}  {r['n']}")

    # ============================================================
    # 6. ORPHANS / referential issues
    # ============================================================
    section("6. ORPHANS")
    cur.execute("select count(*) as n from public.rsc_remediation r left join public.suppliers s on s.id = r.supplier_id where s.id is null")
    print(f"  rsc_remediation rows w/ no supplier: {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.source_records sr left join public.suppliers s on s.id = sr.supplier_id where s.id is null")
    print(f"  source_records rows w/ no supplier: {cur.fetchone()['n']}")
    cur.execute("select count(*) as n from public.suppliers s where not exists (select 1 from public.source_records sr where sr.supplier_id = s.id)")
    print(f"  suppliers w/ NO source_records:    {cur.fetchone()['n']}")
