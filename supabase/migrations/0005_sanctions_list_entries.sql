-- =============================================================================
-- 0005_sanctions_list_entries
-- Persists raw sanctions list rows independent of supplier matches.
-- Allows re-matching against newly-ingested suppliers later (Phase 1 monthly job).
-- =============================================================================

create table if not exists public.sanctions_list_entries (
  id                uuid primary key default gen_random_uuid(),
  list              sanctions_list not null,
  entry_ref         text not null,                            -- stable per-list id (slug or '#')
  entity_name       text not null,
  entity_name_norm  text not null,                            -- normalized for fuzzy match
  aliases           text[] not null default '{}',
  country           text,
  merchandise       text,
  listed_date       date,
  status            text,
  status_notes      text,
  source_url        text,
  raw               jsonb not null default '{}'::jsonb,
  fetched_at        timestamptz not null default now(),
  unique (list, entry_ref)
);

create index if not exists idx_sle_list on public.sanctions_list_entries (list);
create index if not exists idx_sle_name_trgm
  on public.sanctions_list_entries using gin (entity_name_norm gin_trgm_ops);

-- Seed the missing US_WRO source row.
insert into public.sources (code, display_name, tier, base_url) values
  ('US_WRO', 'US CBP Withhold Release Orders & Findings',
   'tier5_regulatory',
   'https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings')
on conflict (code) do nothing;
