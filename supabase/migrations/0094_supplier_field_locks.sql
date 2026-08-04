-- 0094 — supplier_field_locks for admin manual-override survival
--       (REZ-66 / REZ-57 A6).
--
-- WHY
-- ---
-- When a human corrects a value on a supplier, the ETL must never overwrite
-- it. Today three writers touch `suppliers` columns and none know about each
-- other: `_enrich_supplier` / `_apply_source_specific` in
-- `etl/core/upsert.py`, `ops/backfill_profile_columns.py`, and the admin
-- editor. Admin-only columns happen to be safe because the ETL does not
-- write them, but `entity_type` IS written by the ETL (BRAND_* → factory)
-- and `bkmea_reg_number` is an explicit overwrite for canonical_registry
-- records. Nothing stops a future correction to `city`, `company_name`, or
-- a capacity figure from being clobbered on the next run.
--
-- WHAT
-- ----
-- Creates `public.supplier_field_locks` as a side table (columns come and
-- go; a side table does not force a migration each time). Unique index on
-- live locks `(supplier_id, column_name) WHERE released_at IS NULL`. RLS
-- enabled with NO anon/authenticated policies (service role only). A
-- BEFORE INSERT OR UPDATE trigger validates `column_name` against
-- `information_schema.columns` for `public.suppliers` — a CHECK cannot
-- query a catalog. Enforcement lives in ETL Python (`_locked_columns` in
-- upsert + lock predicates in the profile backfill), NOT a generic BEFORE
-- UPDATE trigger on `suppliers`.
--
-- REVERSE
-- -------
--   drop trigger if exists trg_supplier_field_locks_column_name
--     on public.supplier_field_locks;
--   drop function if exists public.validate_supplier_field_lock_column();
--   drop index if exists public.idx_supplier_field_locks_live;
--   drop table if exists public.supplier_field_locks;
--
-- Not applied in the authoring session — founder applies migrations manually.
-- APPLIED to production 5 Aug 2026. See the migration ledger in
-- context/current-state.md for live status; do not treat this header as one.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_field_locks (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  column_name     text not null,
  locked_value    jsonb not null,
  locked_by       text not null,
  locked_at       timestamptz not null default now(),
  reason          text not null,
  released_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. One live lock per (supplier, column)
-- ---------------------------------------------------------------------------
create unique index if not exists idx_supplier_field_locks_live
  on public.supplier_field_locks (supplier_id, column_name)
  where released_at is null;

-- ---------------------------------------------------------------------------
-- 3. Validate column_name against public.suppliers catalog
--    A CHECK cannot query information_schema; a trigger is required.
-- ---------------------------------------------------------------------------
create or replace function public.validate_supplier_field_lock_column()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'suppliers'
       and c.column_name = new.column_name
  ) then
    raise exception
      'supplier_field_locks.column_name % is not a column on public.suppliers',
      new.column_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supplier_field_locks_column_name
  on public.supplier_field_locks;
create trigger trg_supplier_field_locks_column_name
  before insert or update of column_name on public.supplier_field_locks
  for each row
  execute function public.validate_supplier_field_lock_column();

-- ---------------------------------------------------------------------------
-- 4. RLS — internal override history; no anon/authenticated policies.
--    Service role bypasses RLS automatically (same pattern as
--    resolution_edges / stripe_webhook_events).
-- ---------------------------------------------------------------------------
alter table public.supplier_field_locks enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Semantics for operators and later issues (A9 invariant check).
-- ---------------------------------------------------------------------------
comment on table public.supplier_field_locks is
  'Field-level manual overrides that the ETL must not overwrite. A live lock has released_at IS NULL. Lift a lock by setting released_at; do not DELETE. Written by ops / admin (service role); never exposed to anon or authenticated clients. Enforcement is in ETL Python, not a generic BEFORE UPDATE trigger on suppliers.';

comment on column public.supplier_field_locks.column_name is
  'Must name a real column on public.suppliers; validated by trg_supplier_field_locks_column_name.';

comment on column public.supplier_field_locks.locked_by is
  'Who locked: ''admin:<email>'' or ''founder''.';

comment on column public.supplier_field_locks.released_at is
  'Non-null means the lock was lifted; the ETL may write the column again.';
