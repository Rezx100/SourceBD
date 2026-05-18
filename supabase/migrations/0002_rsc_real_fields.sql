-- Migration 0002 — extend rsc_remediation with real RSC API fields.
--
-- The RSC public API returns overall remediation `progress` (0..1), not per-component
-- percentages. It also exposes worker count, parent supplier group, designation status,
-- training status, and direct PDF URLs for fire/structural/electrical/boiler audits and CAP.
--
-- The legacy fire_pct/structural_pct/electrical_pct columns are kept (nullable) for
-- backwards compatibility but are no longer populated by the scraper.

alter table public.rsc_remediation
  add column if not exists progress_pct              numeric(5,2),
  add column if not exists workers_count             integer,
  add column if not exists parent_group_name         text,
  add column if not exists parent_group_factory_count integer,
  add column if not exists remediation_status        text,
  add column if not exists training_status           text,
  add column if not exists fire_inspection_url       text,
  add column if not exists structural_inspection_url text,
  add column if not exists electrical_inspection_url text,
  add column if not exists boiler_inspection_url     text,
  add column if not exists cap_url                   text;

create index if not exists idx_rsc_parent_group on public.rsc_remediation (parent_group_name)
  where parent_group_name is not null;

create index if not exists idx_rsc_remediation_status on public.rsc_remediation (remediation_status)
  where remediation_status is not null;
