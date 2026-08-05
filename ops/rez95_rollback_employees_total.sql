-- REZ-95 Step 1 — roll back the REZ-91 employees_total apply.
--
-- REZ-91 (merge 2ef5869) replaced max() with sum() over BGMEA's three
-- employees keys and was applied to production on 5 Aug 2026, raising
-- employees_total on 1,390 suppliers. The sum() remedy was wrong: BGMEA's
-- first column ("Management") is not reliably a management headcount, so
-- adding it inflated up to 590 suppliers and exactly doubled 165.
--
-- This restores employees_total from the pre-apply snapshot. The restored
-- values are also wrong (they are the old max() cohort) but wrong in a known,
-- documented way, which beats leaving inflated figures live in front of
-- buyers. Step 2 re-derives them as Employee Male + Employee Female.
--
-- Applied to production 5 Aug 2026 via the Supabase SQL API (psycopg is
-- protocol-blocked from the dev machine: TCP connects on :6543 and :5432 but
-- the Postgres handshake times out). Result: 1,390 rows rolled back, all
-- 10,912 suppliers matching the snapshot, 0 sibling-column movement.
--
-- Only employees_total is touched. employees_male / employees_female,
-- machines_sewing and both capacity columns are read for verification only.

-- ---------------------------------------------------------------- pre-flight
-- Expect: snapshot 10,912 rows / 10,912 distinct ids, expected set 1,390 rows,
-- live_matches_after 1,390, siblings_drifted 0. If live_matches_after is below
-- 1,390 something has written employees_total since the REZ-91 apply — stop
-- and re-audit rather than rolling back over it.
select
  (select count(*) from public._rez91_employees_total_snapshot_20260805) as snapshot_rows,
  (select count(distinct id) from public._rez91_employees_total_snapshot_20260805) as snapshot_distinct_ids,
  (select count(*) from public._rez91_employees_total_expected_20260805) as expected_rows,
  (select count(*)
     from public._rez91_employees_total_expected_20260805 e
     join public.suppliers s on s.id = e.supplier_id
    where s.employees_total is not distinct from e.after_val) as live_matches_after,
  (select count(*)
     from public._rez91_employees_total_expected_20260805 e
     join public._rez91_employees_total_snapshot_20260805 k on k.id = e.supplier_id
    where k.employees_total is not distinct from e.before_val) as snapshot_matches_before,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_male is distinct from k.employees_male
       or s.employees_female is distinct from k.employees_female
       or s.machines_sewing is distinct from k.machines_sewing
       or s.production_capacity_pcs_day is distinct from k.production_capacity_pcs_day
       or s.production_capacity_dozen_yearly is distinct from k.production_capacity_dozen_yearly) as siblings_drifted;

-- ---------------------------------------------------------------- rollback
-- Restricted to the suppliers REZ-91 actually changed, and a no-op on any row
-- already holding its snapshot value, so this is safe to re-run.
-- Expect rows_rolled_back = 1390 on the first run, 0 on any re-run.
with rolled as (
  update public.suppliers s
     set employees_total = k.employees_total,
         updated_at = now()
    from public._rez91_employees_total_snapshot_20260805 k
   where s.id = k.id
     and s.id in (select supplier_id from public._rez91_employees_total_expected_20260805)
     and s.employees_total is distinct from k.employees_total
  returning s.id
)
select count(*) as rows_rolled_back from rolled;

-- ---------------------------------------------------------------- verify
-- Expect: total_matches_snapshot 10,912, total_still_differs 0,
-- restored_to_before_val 1,390, still_at_rez91_value 0, siblings_drifted 0.
select
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_total is not distinct from k.employees_total) as total_matches_snapshot,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_total is distinct from k.employees_total) as total_still_differs,
  (select count(*)
     from public._rez91_employees_total_expected_20260805 e
     join public.suppliers s on s.id = e.supplier_id
    where s.employees_total is not distinct from e.before_val) as restored_to_before_val,
  (select count(*)
     from public._rez91_employees_total_expected_20260805 e
     join public.suppliers s on s.id = e.supplier_id
    where s.employees_total is not distinct from e.after_val
      and e.after_val is distinct from e.before_val) as still_at_rez91_value,
  (select count(*)
     from public.suppliers s
     join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
    where s.employees_male is distinct from k.employees_male
       or s.employees_female is distinct from k.employees_female
       or s.machines_sewing is distinct from k.machines_sewing
       or s.production_capacity_pcs_day is distinct from k.production_capacity_pcs_day
       or s.production_capacity_dozen_yearly is distinct from k.production_capacity_dozen_yearly) as siblings_drifted;

-- Spot-check the doubled examples named on REZ-95. Expect live_now to equal
-- snapshot_val on every row: zaber-and-zubair-fabrics 9341, momo-fashions
-- 7500, sterling-denims 3702, odyssey-craft 7000, pandora-sweater 4300,
-- akm-knitwear 16815, coast-to-coast 650.
select s.slug,
       k.employees_total as snapshot_val,
       e.after_val       as rez91_val,
       s.employees_total as live_now,
       s.employees_male,
       s.employees_female
  from public.suppliers s
  join public._rez91_employees_total_snapshot_20260805 k on k.id = s.id
  left join public._rez91_employees_total_expected_20260805 e on e.supplier_id = s.id
 where s.slug in (
         'zaber-and-zubair-fabrics', 'momo-fashions', 'sterling-denims',
         'odyssey-craft', 'pandora-sweater', 'akm-knitwear', 'coast-to-coast'
       )
 order by s.slug;
