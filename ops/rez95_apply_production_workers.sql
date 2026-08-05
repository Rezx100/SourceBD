-- REZ-95 Step 2 — re-derive employees_total as production workers.
--
-- employees_total becomes Employee Male + Employee Female. BGMEA's first column
-- ("Management") is deliberately excluded: it is not reliably a management
-- headcount, so REZ-91's sum() inflated up to 590 suppliers and exactly doubled
-- the 192 records where it restates the total.
--
-- The load-bearing evidence is definitional, not statistical. BKMEA's schema
-- holds only bkmea_employees_male / _female / _total and has no management key
-- at all, and its total equals male + female on 4,037 of 4,039 records. The
-- comparison registry's total IS a sum of gendered worker cohorts by
-- construction, so Male + Female is the identical quantity rather than the
-- nearest approximation.
--
-- Run Step 1 (rez95_rollback_employees_total.sql) first. This applies on top of
-- the rolled-back state; _rez91_employees_total_snapshot_20260805 is therefore
-- also the pre-state for this apply, verified live-identical before running.
--
-- Applied to production 5 Aug 2026 via the Supabase SQL API (psycopg is
-- protocol-blocked from the dev machine). Result: 1,232 rows changed, 1,030 up,
-- 202 down, 0 sibling-column movement, 0 rows changed outside the expected set.
--
-- The UPDATE below is the employees_total statement from
-- ops/backfill_profile_columns.py verbatim. Run the script rather than this file
-- for routine backfills; this exists as the auditable record of the one-off
-- production apply.

-- ---------------------------------------------------------------- pre-flight
-- Confirm nothing has written employees_total since the Step 1 rollback.
-- Expect: live_matches_snapshot 10,912, live_differs 0, siblings_drifted 0,
-- active_locks 0. Any nonzero live_differs means something wrote over the
-- rollback — stop and re-audit rather than applying on top of it.
select
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_total is not distinct from k.employees_total) as live_matches_snapshot,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_total is distinct from k.employees_total) as live_differs,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_male is distinct from k.employees_male
       or s.employees_female is distinct from k.employees_female
       or s.machines_sewing is distinct from k.machines_sewing
       or s.production_capacity_pcs_day is distinct from k.production_capacity_pcs_day
       or s.production_capacity_dozen_yearly is distinct from k.production_capacity_dozen_yearly) as siblings_drifted,
  (select count(*) from public.supplier_field_locks where released_at is null) as active_locks;

-- ---------------------------------------------------------------- expected set
-- Materialise the intended change set BEFORE writing, so the apply can be
-- verified row for row rather than only by row count.
-- Expect 1,232 rows: 1,030 delta > 0, 202 delta < 0, 0 fills from NULL,
-- 1,232 via BGMEA, 0 via BKMEA.
create table public._rez95_production_workers_expected_20260805 as
with candidates as (
  select sr.supplier_id,
         nullif((sr.fields ->> 'bkmea_employees_total')::int, 0) as val,
         sr.source_tier, sr.fetched_at, sr.id, 'BKMEA'::text as source_code
    from source_records sr
    join sources src on src.id = sr.source_id
   where src.code = 'BKMEA'
     and sr.status = 'active'
     and (sr.fields ? 'bkmea_employees_total')
     and (sr.fields ->> 'bkmea_employees_total') ~ '^[0-9]+$'
  union all
  select sr.supplier_id,
         (select sum(nullif(regexp_replace(v.value::text, '[^0-9]', '', 'g'), '')::bigint)
            from jsonb_each_text(sr.fields -> 'employees') v
           where v.key in ('Employee Male', 'Employee Female')
             and v.value ~ '[0-9]') as val,
         sr.source_tier, sr.fetched_at, sr.id, 'BGMEA'::text as source_code
    from source_records sr
    join sources src on src.id = sr.source_id
   where src.code = 'BGMEA'
     and sr.status = 'active'
     and jsonb_typeof(sr.fields -> 'employees') = 'object'
),
x as (
  select distinct on (c.supplier_id) c.supplier_id, c.val::int as val, c.source_code
    from candidates c
   where c.val is not null and c.val <> 0
   order by c.supplier_id,
            case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
            c.fetched_at desc nulls last,
            c.id
)
select s.id as supplier_id,
       s.slug,
       s.employees_total as before_val,
       x.val             as after_val,
       x.source_code,
       (x.val - s.employees_total) as delta,
       now() as computed_at
  from public.suppliers s
  join x on x.supplier_id = s.id
 where x.val is not null
   and s.employees_total is distinct from x.val
   and x.val <= 200000
   and not exists (
     select 1 from public.supplier_field_locks l
      where l.supplier_id = s.id
        and l.column_name = 'employees_total'
        and l.released_at is null
   );

-- ---------------------------------------------------------------- apply
-- Expect rows_updated = 1232 on the first run, 0 on any re-run.
with candidates as (
  select sr.supplier_id,
         nullif((sr.fields ->> 'bkmea_employees_total')::int, 0) as val,
         sr.source_tier, sr.fetched_at, sr.id, 'BKMEA'::text as source_code
    from source_records sr
    join sources src on src.id = sr.source_id
   where src.code = 'BKMEA'
     and sr.status = 'active'
     and (sr.fields ? 'bkmea_employees_total')
     and (sr.fields ->> 'bkmea_employees_total') ~ '^[0-9]+$'
  union all
  select sr.supplier_id,
         (select sum(nullif(regexp_replace(v.value::text, '[^0-9]', '', 'g'), '')::bigint)
            from jsonb_each_text(sr.fields -> 'employees') v
           where v.key in ('Employee Male', 'Employee Female')
             and v.value ~ '[0-9]') as val,
         sr.source_tier, sr.fetched_at, sr.id, 'BGMEA'::text as source_code
    from source_records sr
    join sources src on src.id = sr.source_id
   where src.code = 'BGMEA'
     and sr.status = 'active'
     and jsonb_typeof(sr.fields -> 'employees') = 'object'
),
x as (
  select distinct on (c.supplier_id) c.supplier_id, c.val::int as val, c.source_code
    from candidates c
   where c.val is not null and c.val <> 0
   order by c.supplier_id,
            case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
            c.fetched_at desc nulls last,
            c.id
),
updated as (
  update public.suppliers s
     set employees_total = x.val,
         updated_at = now()
    from x
   where s.id = x.supplier_id
     and x.val is not null
     and s.employees_total is distinct from x.val
     and x.val <= 200000
     and not exists (
       select 1 from public.supplier_field_locks l
        where l.supplier_id = s.id
          and l.column_name = 'employees_total'
          and l.released_at is null
     )
  returning s.id
)
select count(*) as rows_updated from updated;

-- ---------------------------------------------------------------- verify
-- Expect: rows_at_expected_after 1,232, rows_mismatched 0,
-- unexpected_rows_changed 0, siblings_drifted 0, over_cap 0.
-- unexpected_rows_changed counts suppliers that moved off the snapshot value
-- without being in the expected set — i.e. collateral writes.
select
  (select count(*)
     from public._rez95_production_workers_expected_20260805 x
     join public.suppliers s on s.id = x.supplier_id
    where s.employees_total is not distinct from x.after_val) as rows_at_expected_after,
  (select count(*)
     from public._rez95_production_workers_expected_20260805 x
     join public.suppliers s on s.id = x.supplier_id
    where s.employees_total is distinct from x.after_val) as rows_mismatched,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
     left join public._rez95_production_workers_expected_20260805 x on x.supplier_id = s.id
    where x.supplier_id is null
      and s.employees_total is distinct from k.employees_total) as unexpected_rows_changed,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_male is distinct from k.employees_male
       or s.employees_female is distinct from k.employees_female
       or s.machines_sewing is distinct from k.machines_sewing
       or s.production_capacity_pcs_day is distinct from k.production_capacity_pcs_day
       or s.production_capacity_dozen_yearly is distinct from k.production_capacity_dozen_yearly) as siblings_drifted,
  (select count(*) from public.suppliers where employees_total > 200000) as over_cap;

-- Confirm the pickWorkforce() gender-split guard resolves itself. That guard
-- (components/supplier/profile-capacity-tab.tsx) suppresses the split when
-- (male + female) / total falls outside 0.9–1.1, which is what hid the split on
-- coast-to-coast while REZ-91's inflation was live. Expect newly_rendering 1,142
-- and newly_suppressed 0 — the guard was doing real work and now stands down.
with g as (
  select k.employees_total as before_total,
         s.employees_total as after_total,
         s.employees_male  as m,
         s.employees_female as f
    from public.suppliers s
    join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
   where s.employees_male > 0 and s.employees_female > 0
),
r as (
  select *,
         (m + f)::numeric / nullif(before_total, 0) as ratio_before,
         (m + f)::numeric / nullif(after_total, 0)  as ratio_after
    from g
)
select count(*) as suppliers_with_full_split,
       count(*) filter (where ratio_before between 0.9 and 1.1) as rendered_before,
       count(*) filter (where ratio_after between 0.9 and 1.1) as rendered_after,
       count(*) filter (where not (ratio_before between 0.9 and 1.1)
                          and ratio_after between 0.9 and 1.1) as newly_rendering,
       count(*) filter (where ratio_before between 0.9 and 1.1
                          and not (ratio_after between 0.9 and 1.1)) as newly_suppressed
  from r;

-- Spot-check the examples named on REZ-95. Expect coast-to-coast 710 (NOT
-- 3,450 — general:2768 still wins the record competition, which is REZ-90's
-- scope), zaber-and-zubair-fabrics 9341, saturn-textiles 4326,
-- eastern-knitwear 500. Every row should read ratio 1.0000, meaning the split
-- renders rather than being suppressed.
select s.slug,
       s.employees_total,
       s.employees_male,
       s.employees_female,
       round((s.employees_male + s.employees_female)::numeric
             / nullif(s.employees_total, 0), 4) as gender_split_ratio
  from public.suppliers s
 where s.slug in (
         'coast-to-coast', 'zaber-and-zubair-fabrics', 'fakir-fashion',
         'saturn-textiles', 'eastern-knitwear', 'akm-knitwear'
       )
 order by s.slug;
