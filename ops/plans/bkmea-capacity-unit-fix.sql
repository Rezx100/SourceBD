-- BKMEA capacity figures read in the wrong unit: the one-off correction.
-- Ran on production on 13 Oct 2026 on the founder's word ("fix the pieces per
-- day capacity figures"). Rehearsed first with a raise at the end, then run as
-- below with the rehearsed counts as a guard.
--
-- BKMEA's page gives "Production Capacity" as a bare number. Members fill it in
-- as pieces a day or pieces a month; we had stored every one as pieces a day,
-- and the profile multiplies by 25 to show pieces a month. The rule is
-- etl.core.projection.bkmea_capacity_pcs_day, and the CTEs below are the ones
-- in ops/backfill_profile_columns.py, so the next backfill run writes the same
-- values. What this block does that the backfill never does: it blanks the
-- figure where no page of the company gives a clear one.
--
-- Result, of 1,626 companies carrying a figure:
--   946  unchanged (a day's figure)
--   411  were a month's figure: now a day's share of it (filed / 25), so the
--        profile shows the number the member filed, as pieces a month
--   253  blanked, the unit cannot be told: 62 file no machines or workers,
--        the rest fall outside both bands or the two yardsticks disagree
--        (66 of them still show BGMEA's capacity)
--    16  blanked, BKMEA's page no longer carries a capacity at all (second
--        block; four of the live pages were read to confirm)
-- 1,357 companies carry a figure afterwards; the largest is 600,000 a day.
--
-- Scores: recomputed the same day on the founder's word ("recalculate the
-- supplier scores"), for every supplier, with etl.scoring.sbi.compute_sbi run
-- locally over a read of production (the database port is unreachable from
-- the founder's machine, so etl.scoring.runner cannot run there) and written
-- in one rehearsed upsert. 843 of 10,826 rows written: 15 new (the companies
-- split off that day had no score), 346 changed in points (205 down, 141 up),
-- 482 the same points with a new inputs hash. Of the 205 down, 197 are
-- profiles whose capacity was blanked above; of the 141 up, 133 are profiles
-- that kept a duplicate's records in that day's merges. Old rows are in
-- _snapshot_sbi_rescore_20261013 (828).
--
-- Seven of the 411 month figures do not divide by 25, so the profile shows
-- them up to 12 pieces off.
--
-- Undo: update suppliers s set production_capacity_pcs_day = b.old_value
--       from _snapshot_bkmea_capacity_20261013 b where b.supplier_id = s.id;

do $$
declare
  n_month int; n_blank int; n_other int; n_same int; n_touched int;
begin
  create table public._snapshot_bkmea_capacity_20261013 as
  with c as (
    select sr.supplier_id, sr.source_tier, sr.fetched_at, sr.id, sr.source_ref,
           (sr.fields ->> 'bkmea_production_capacity')::bigint as cap,
           case when (sr.fields ->> 'bkmea_machines_sewing') ~ '^[0-9]{1,9}$'
                then nullif((sr.fields ->> 'bkmea_machines_sewing')::bigint, 0) end as m,
           case when (sr.fields ->> 'bkmea_employees_total') ~ '^[0-9]{1,9}$'
                then nullif((sr.fields ->> 'bkmea_employees_total')::bigint, 0) end as e
      from source_records sr
      join sources src on src.id = sr.source_id
     where src.code = 'BKMEA'
       and sr.status = 'active'
       and (sr.fields ->> 'bkmea_production_capacity') ~ '^[0-9]{1,12}$'
  ),
  u as (
    select c.*,
           case when cap between 5 * m and 250 * m then 'day'
                when cap between 500 * m and 6250 * m then 'month' end as by_m,
           case when cap between 2 * e and 100 * e then 'day'
                when cap between 300 * e and 2500 * e then 'month' end as by_e
      from c
  ),
  v as (
    select u.*,
           case when m is null then by_e
                when by_e is null or by_e = by_m then by_m end as unit
      from u
  ),
  w as (
    select v.*, case unit when 'day' then cap when 'month' then (cap + 12) / 25 end as val from v
  ),
  x as (
    select distinct on (w.supplier_id) w.supplier_id, w.val::int as val, w.unit, w.cap, w.m, w.e, w.source_ref
      from w
     where w.val between 1 and 10000000
     order by w.supplier_id,
              case w.source_tier when 'tier1_gov' then 1 when 'tier2_industry' then 2 when 'tier3_cert' then 3
                                 when 'tier4_brand' then 4 when 'tier5_regulatory' then 5
                                 when 'tier6_crosscheck' then 6 else 99 end,
              w.fetched_at desc nulls last, w.id
  )
  select s.id as supplier_id, s.slug, s.is_published,
         s.production_capacity_pcs_day as old_value, x.val as new_value,
         x.unit, x.cap as filed, x.m as sewing_machines, x.e as workers, x.source_ref,
         now() as taken_at
    from suppliers s
    left join x on x.supplier_id = s.id
   where s.production_capacity_pcs_day is not null
     -- a figure with no BKMEA page behind it at all is another question: left alone
     and exists (select 1 from c where c.supplier_id = s.id)
     and not exists (select 1 from supplier_field_locks l
                      where l.supplier_id = s.id
                        and l.column_name = 'production_capacity_pcs_day'
                        and l.released_at is null);

  alter table public._snapshot_bkmea_capacity_20261013 enable row level security;
  revoke all on public._snapshot_bkmea_capacity_20261013 from anon, authenticated;

  select count(*) filter (where new_value is null),
         count(*) filter (where unit = 'month' and new_value is distinct from old_value),
         count(*) filter (where unit = 'day' and new_value is distinct from old_value),
         count(*) filter (where new_value = old_value)
    into n_blank, n_month, n_other, n_same
    from _snapshot_bkmea_capacity_20261013;

  if n_month <> 411 or n_blank <> 253 or n_other <> 0 then
    raise exception 'count guard: rehearsed 411/253/0, now %/%/%', n_month, n_blank, n_other;
  end if;

  update suppliers s
     set production_capacity_pcs_day = b.new_value, updated_at = now()
    from _snapshot_bkmea_capacity_20261013 b
   where b.supplier_id = s.id
     and s.production_capacity_pcs_day is distinct from b.new_value;
  get diagnostics n_touched = row_count;

  if n_touched <> n_blank + n_month + n_other then
    raise exception 'count guard: touched % but planned %', n_touched, n_blank + n_month + n_other;
  end if;
end $$;

-- Second block: a figure no active BKMEA page carries any more.
do $$
declare n int;
begin
  insert into _snapshot_bkmea_capacity_20261013 (supplier_id, slug, is_published, old_value, new_value, unit, taken_at)
  select s.id, s.slug, s.is_published, s.production_capacity_pcs_day, null, 'no page carries it', now()
    from suppliers s
   where s.production_capacity_pcs_day is not null
     and not exists (select 1 from _snapshot_bkmea_capacity_20261013 b where b.supplier_id = s.id)
     and not exists (select 1 from source_records sr
                       join sources src on src.id = sr.source_id
                      where sr.supplier_id = s.id and src.code = 'BKMEA' and sr.status = 'active'
                        and sr.fields ? 'bkmea_production_capacity')
     and not exists (select 1 from supplier_field_locks l where l.supplier_id = s.id
                      and l.column_name = 'production_capacity_pcs_day' and l.released_at is null);
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'count guard: expected 16, got %', n; end if;
  update suppliers s set production_capacity_pcs_day = null, updated_at = now()
    from _snapshot_bkmea_capacity_20261013 b
   where b.supplier_id = s.id and b.unit = 'no page carries it';
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'count guard: touched %', n; end if;
end $$;
