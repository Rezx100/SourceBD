-- 0091 — suppliers.facility_of (REZ-61 / REZ-57 A1).
--
-- WHY
-- ---
-- RSC inspects buildings, not companies, so an extension / annex / new
-- building / numbered unit is published as its own factory record. Our ETL
-- turns each into a published supplier. A one-off
-- `UPDATE ... SET is_published = false` does not survive the nightly
-- re-scrape: `_maybe_publish()` in `etl/core/upsert.py` re-publishes any
-- supplier that still has a Tier 1–3 `source_records` row.
--
-- We need a durable, machine-readable marker saying "this row is a physical
-- facility of that other supplier, not an independent company" that survives
-- re-scrapes and that later work (A2 publish-tier refuse, B1 backfill, A7
-- attach-as-facility) can read.
--
-- WHAT
-- ----
-- Schema only. Adds a nullable self-referencing `facility_of` column on
-- `public.suppliers`, a partial index for the small non-null population, a
-- CHECK that a row cannot be its own facility, and a column comment. No
-- rows are set. `enforce_publish_tier()`, `trg_suppliers_publish`,
-- `etl/core/upsert.py`, views, RPCs, and TypeScript types are untouched.
--
-- REVERSE
-- -------
--   alter table public.suppliers
--     drop constraint if exists chk_suppliers_facility_not_self;
--   drop index if exists public.idx_suppliers_facility_of;
--   alter table public.suppliers
--     drop column if exists facility_of;
--
-- Not applied in the authoring session — founder applies migrations manually.
-- APPLIED to production 4 Aug 2026. See the migration ledger in
-- context/current-state.md for live status; do not treat this header as one.

-- ---------------------------------------------------------------------------
-- 1. Column + self-FK (on delete set null so orphaned facilities remain
--    findable if a mother company row is ever deleted).
-- ---------------------------------------------------------------------------
alter table public.suppliers
  add column if not exists facility_of uuid
    references public.suppliers(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Partial index — population is small (~493 of ~10k); every consumer
--    filters on facility_of is not null or joins by it.
-- ---------------------------------------------------------------------------
create index if not exists idx_suppliers_facility_of
  on public.suppliers (facility_of)
  where facility_of is not null;

-- ---------------------------------------------------------------------------
-- 3. A row cannot be its own facility.
-- ---------------------------------------------------------------------------
alter table public.suppliers
  drop constraint if exists chk_suppliers_facility_not_self;
alter table public.suppliers
  add constraint chk_suppliers_facility_not_self
    check (facility_of is null or facility_of <> id);

-- ---------------------------------------------------------------------------
-- 4. Semantics for operators and later issues.
-- ---------------------------------------------------------------------------
comment on column public.suppliers.facility_of is
  'Non-null means this supplier row is a physical facility (extension / annex / new building / numbered unit) of the referenced supplier, not an independent company. Facility rows are never published — see enforce_publish_tier(). Set by ops/backfill_facility_of.py.';
