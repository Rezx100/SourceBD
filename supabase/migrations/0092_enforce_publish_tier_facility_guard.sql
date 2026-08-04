-- 0092 — enforce_publish_tier() refuses facilities (REZ-62 / REZ-57 A2).
--
-- WHY
-- ---
-- A1 added `suppliers.facility_of`. Without a publish guard, `_maybe_publish()`
-- in `etl/core/upsert.py` will re-publish any facility that still holds an
-- active Tier 1–3 `source_records` row on the next nightly re-scrape. B1's
-- backfill of ~493 facility rows is unsafe until publication is structurally
-- impossible for those rows.
--
-- WHAT
-- ----
-- Redefines `public.enforce_publish_tier()` and rebinds
-- `trg_suppliers_publish`. Behaviour chosen: **silent coerce**, not raise.
-- When `NEW.facility_of IS NOT NULL`, force `NEW.is_published := false` and
-- return — before the existing Tier 1–3 check. Raising would churn exceptions
-- on every RSC upsert for hundreds of facilities (swallowed by `_maybe_publish`
-- today) and would make B1's `UPDATE ... SET facility_of = ...` fail on
-- already-published rows. Coercion keeps B1 and the ETL quiet while still
-- making publication impossible.
--
-- The trigger column list widens from `is_published` to
-- `is_published, facility_of` so setting `facility_of` on an already-published
-- row fires the function and unpublishes it. Clearing `facility_of` does NOT
-- auto-republish; a later `_maybe_publish()` (or explicit publish) must pass
-- the unchanged Tier 1–3 check.
--
-- Tier 1–3 logic, exception text, and `errcode = 'check_violation'` are
-- preserved exactly for non-facility rows (REZ-47 will narrow
-- `_maybe_publish`'s catch to that errcode).
--
-- REVERSE
-- -------
-- Restore the pre-A2 function + trigger from 0001_phase0_core.sql:
--
--   create or replace function public.enforce_publish_tier() returns trigger as $$
--   declare ok integer;
--   begin
--     if new.is_published is true then
--       select count(*) into ok from public.source_records sr
--         where sr.supplier_id = new.id
--           and sr.status = 'active'
--           and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert');
--       if ok < 1 then
--         raise exception 'cannot publish supplier %: needs >=1 active Tier1-3 source_record', new.id
--           using errcode = 'check_violation';
--       end if;
--     end if;
--     return new;
--   end $$ language plpgsql;
--
--   drop trigger if exists trg_suppliers_publish on public.suppliers;
--   create trigger trg_suppliers_publish
--     before insert or update of is_published on public.suppliers
--     for each row execute function public.enforce_publish_tier();
--
-- Not applied in the authoring session — founder applies migrations manually.
-- APPLIED to production 4 Aug 2026. See the migration ledger in
-- context/current-state.md for live status; do not treat this header as one.

-- ---------------------------------------------------------------------------
-- 1. Function — facility coerce first, then unchanged Tier 1–3 gate.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_publish_tier() returns trigger as $$
declare ok integer;
begin
  -- Facility rows are never published. Coerce rather than raise so
  -- `_maybe_publish()` and B1 backfill do not churn check_violation on every
  -- touch of is_published / facility_of for facility rows.
  if new.facility_of is not null then
    new.is_published := false;
    return new;
  end if;

  if new.is_published is true then
    select count(*) into ok from public.source_records sr
      where sr.supplier_id = new.id
        and sr.status = 'active'
        and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert');
    if ok < 1 then
      raise exception 'cannot publish supplier %: needs >=1 active Tier1-3 source_record', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 2. Trigger — also fire when facility_of changes on an already-published row.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_suppliers_publish on public.suppliers;
create trigger trg_suppliers_publish
  before insert or update of is_published, facility_of on public.suppliers
  for each row execute function public.enforce_publish_tier();
