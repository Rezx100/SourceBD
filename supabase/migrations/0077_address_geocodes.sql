-- 0077 — Barikoi geocode cache (Spec: Barikoi integration).
--
-- One row per unique normalised address string, populated by the ETL
-- `geocode-addresses` job via Barikoi's Rupantor geocode API. The web app
-- only READS this table (profile locations map); it never writes, so a
-- cache miss on a fresh address degrades to "no pin" until the next ETL
-- geocode run. Coordinates are derived from already-public registry
-- addresses — not PII — so anon read is safe.

set local statement_timeout = '60s';

create table if not exists public.address_geocodes (
  id             uuid primary key default gen_random_uuid(),
  address_norm   text not null unique,
  address_raw    text not null,
  latitude       double precision,
  longitude      double precision,
  fixed_address  text,
  district       text,
  thana          text,
  address_status text,
  confidence_pct numeric,
  provider       text not null default 'barikoi_rupantor',
  geocoded_at    timestamptz not null default now()
);

comment on table public.address_geocodes is
  'Barikoi Rupantor geocode cache keyed by normalised address string. Written only by the ETL geocode-addresses job (service role); read by the web profile locations map. latitude/longitude NULL means the provider could not resolve the address (negative result cached to avoid re-billing).';

create index if not exists idx_address_geocodes_norm
  on public.address_geocodes (address_norm);

alter table public.address_geocodes enable row level security;

drop policy if exists address_geocodes_public_read on public.address_geocodes;
create policy address_geocodes_public_read
  on public.address_geocodes
  for select
  using (true);

-- No insert/update/delete policies: only the service role (ETL) bypasses RLS.
