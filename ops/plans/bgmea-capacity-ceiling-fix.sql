-- BGMEA capacity figures beyond what the company's own machines could make:
-- hidden on production on 13 Oct 2026 on the founder's word ("hide the 333
-- BGMEA capacity figures"). Rehearsed first, then run as below.
--
-- BGMEA states its unit ("Production Capacity (Yearly in dozen)"), so this is
-- not the BKMEA unit problem (bkmea-capacity-unit-fix.sql). But a figure of
-- more than 6,250 dozen a sewing machine a year is more than 250 pieces a
-- machine a day, and most such rows look like pieces filed as dozens; which
-- ones cannot be told, so the figure is not shown. The rule is
-- etl.core.projection.bgmea_capacity_dozen_yearly, mirrored in
-- ops/backfill_profile_columns.py, so the next backfill does not put them back.
--
-- Result: 330 profiles blanked (325 published), 3,771 keep a BGMEA figure.
-- The check the day before counted 333 by each company's newest page; this
-- block blanks a profile only when no active page of it carries a believable
-- figure, which is what the backfill does. 290 of the 330 now show no
-- capacity at all; 40 still show BKMEA's.
--
-- Seen and left alone: 10 profiles whose shown figure is not the one on their
-- BGMEA page (the backfill has not run since their entries changed), and 1
-- with a figure that no active BGMEA page carries or that is locked.
--
-- Scores were recomputed afterwards for every supplier (see the end).
--
-- Undo: update suppliers s set production_capacity_dozen_yearly = b.old_value
--       from _snapshot_bgmea_capacity_20261013 b where b.supplier_id = s.id;

do $$
declare n_blank int; n_touched int;
begin
  create table public._snapshot_bgmea_capacity_20261013 as
  with c as (
    select sr.supplier_id,
           (sr.fields ->> 'production_capacity_dozen_yearly')::bigint as cap,
           case when (sr.fields ->> 'num_machines') ~ '^[0-9]{1,9}$' then nullif((sr.fields ->> 'num_machines')::bigint, 0) end as m
      from source_records sr join sources src on src.id = sr.source_id
     where src.code = 'BGMEA' and sr.status = 'active'
       and (sr.fields ->> 'production_capacity_dozen_yearly') ~ '^[0-9]{1,15}$'
       and (sr.fields ->> 'production_capacity_dozen_yearly')::bigint > 0
  )
  select s.id as supplier_id, s.slug, s.is_published,
         s.production_capacity_dozen_yearly as old_value, null::bigint as new_value,
         (select max(c.m) from c where c.supplier_id = s.id and c.cap = s.production_capacity_dozen_yearly) as sewing_machines,
         now() as taken_at
    from suppliers s
   where s.production_capacity_dozen_yearly is not null
     and exists (select 1 from c where c.supplier_id = s.id)
     -- no page of the company carries a figure its own machines could make
     and not exists (select 1 from c where c.supplier_id = s.id and coalesce(c.cap <= 6250 * c.m, true) and c.cap <= 200000000)
     and not exists (select 1 from supplier_field_locks l where l.supplier_id = s.id
                      and l.column_name = 'production_capacity_dozen_yearly' and l.released_at is null);
  alter table public._snapshot_bgmea_capacity_20261013 enable row level security;
  revoke all on public._snapshot_bgmea_capacity_20261013 from anon, authenticated;
  select count(*) into n_blank from _snapshot_bgmea_capacity_20261013;
  if n_blank <> 330 then raise exception 'count guard: rehearsed 330, now %', n_blank; end if;
  update suppliers s set production_capacity_dozen_yearly = null, updated_at = now()
    from _snapshot_bgmea_capacity_20261013 b where b.supplier_id = s.id;
  get diagnostics n_touched = row_count;
  if n_touched <> 330 then raise exception 'count guard: touched %', n_touched; end if;
end $$;

-- Scores, the same day. Every supplier was scored with etl.scoring.sbi.compute_sbi
-- run locally over a read of production, loaded into a private holding table and
-- written in one rehearsed upsert (the database port is unreachable from the
-- founder's machine, so etl.scoring.runner cannot run there).
--
-- The recompute an hour earlier had skipped rows whose inputs hash matched. That
-- hash carried only the year, so a certificate running out or a year of tenure
-- passing never reached the row: 136 scores were stale, 105 of them still
-- crediting an expired certificate. The hash now carries which certificates are
-- in date and the years in operation (formula version 3), and all 10,826 rows
-- were rewritten with it. 419 changed in points: 388 down (273 by the one
-- capacity point, 115 lost certificate points) and 31 up by a year of tenure.
-- The 419 old rows are in _snapshot_sbi_rescore_20261013b.
