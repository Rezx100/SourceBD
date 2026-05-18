-- =============================================================================
-- SourceBD — Phase 0 core schema
-- Migration: 0001_phase0_core
-- Purpose:  Data-moat tables, source trust hierarchy, SBI scoring, dedup,
--           verification queue, RLS baseline.
-- Spec refs: SourceBD_Data_Pipeline_Spec.md §1, §4.1, §6, §9, §10
--            SourceBD_Spec_Addendum.md (SBI 4-pillar)
--            context/architecture.md (invariants)
-- =============================================================================

-- ---------- extensions ------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";
create extension if not exists "citext";

-- ---------- enums -----------------------------------------------------------
do $$ begin
  create type entity_type     as enum ('factory','buying_house','agent','unknown');
end $$;
do $$ begin
  create type source_tier     as enum ('tier1_gov','tier2_industry','tier3_cert','tier4_brand','tier5_regulatory','tier6_crosscheck');
end $$;
do $$ begin
  create type evidence_status as enum ('active','superseded','rejected');
end $$;
do $$ begin
  create type queue_type      as enum ('fuzzy_match_review','uncorroborated_record','rsc_unmatched','sanctions_hit','cert_doc_review');
end $$;
do $$ begin
  create type queue_action    as enum ('merge','new_record','reject','escalate','approve');
end $$;
do $$ begin
  create type sanctions_list  as enum ('uflpa','us_wro','ofac_sdn','uk_ofsi','eu_sanctions','ilab_tvpra');
end $$;
do $$ begin
  create type cert_kind       as enum ('wrap','bsci','sedex_smeta','oeko_tex','gots','grs','rcs','bci','fairtrade','iso9001','iso14001','iso45001','sa8000','other');
end $$;

-- ---------- core: sources catalog ------------------------------------------
create table if not exists public.sources (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                    -- e.g. 'BGMEA','BKMEA','RSC','UFLPA'
  display_name    text not null,
  tier            source_tier not null,
  base_url        text,
  notes           text,
  created_at      timestamptz not null default now()
);

insert into public.sources (code, display_name, tier, base_url) values
  ('RSC',     'RMG Sustainability Council',                   'tier1_gov',         'https://rsc-bd.org'),
  ('RJSC',    'Registrar of Joint Stock Companies',           'tier1_gov',         'https://www.roc.gov.bd'),
  ('DIFE',    'Dept of Inspection for Factories & Establishments','tier1_gov',     'https://dife.gov.bd'),
  ('EPB',     'Export Promotion Bureau',                      'tier1_gov',         'https://epb.gov.bd'),
  ('BEPZA',   'Bangladesh Export Processing Zones Authority', 'tier1_gov',         'https://www.bepza.gov.bd'),
  ('BGMEA',   'Bangladesh Garment Manufacturers & Exporters Assoc.', 'tier2_industry','https://www.bgmea.com.bd'),
  ('BKMEA',   'Bangladesh Knitwear Manufacturers & Exporters Assoc.','tier2_industry','https://member.bkmea.com'),
  ('BTMA',    'Bangladesh Textile Mills Association',         'tier2_industry',    'https://btmadhaka.com'),
  ('BGAPMEA', 'Bangladesh Garment Accessories & Packaging MEA','tier2_industry',   'https://bgapmea.org'),
  ('WRAP',    'Worldwide Responsible Accredited Production',  'tier3_cert',        'https://wrapcompliance.org'),
  ('BSCI',    'amfori BSCI',                                  'tier3_cert',        'https://www.amfori.org'),
  ('OEKO_TEX','OEKO-TEX',                                     'tier3_cert',        'https://www.oeko-tex.com'),
  ('GOTS',    'Global Organic Textile Standard',              'tier3_cert',        'https://global-standard.org'),
  ('UFLPA',   'US CBP UFLPA Entity List',                     'tier5_regulatory',  'https://www.cbp.gov/trade/forced-labor/UFLPA'),
  ('OFAC',    'US OFAC SDN List',                             'tier5_regulatory',  'https://sanctionssearch.ofac.treas.gov'),
  ('UK_OFSI', 'UK OFSI Consolidated Sanctions',               'tier5_regulatory',  'https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets'),
  ('EU_SANC', 'EU Sanctions Map',                             'tier5_regulatory',  'https://www.sanctionsmap.eu')
on conflict (code) do nothing;

-- ---------- suppliers (the moat) -------------------------------------------
create table if not exists public.suppliers (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  company_name          text not null,
  company_name_norm     text not null,                       -- normalized for fuzzy
  entity_type           entity_type not null default 'unknown',

  -- registers (spec §4.1)
  bgmea_reg_numbers     text[] not null default '{}',
  bgmea_verified        boolean not null default false,
  bkmea_reg_number      text,
  bkmea_verified        boolean not null default false,
  bgapmea_verified      boolean not null default false,
  btma_verified         boolean not null default false,
  rjsc_reg_number       text,
  epb_erc_number        text,
  bepza_zone            text,

  -- contact
  contact_name          text,
  contact_role          text,
  email_primary         citext,
  phones                text[] not null default '{}',
  website               text,

  -- location
  address_raw           text,
  city                  text,
  district              text,
  country               text not null default 'Bangladesh',
  lat                   double precision,
  lng                   double precision,

  -- aggregate flags (denormalized for query speed; recomputed by jobs)
  source_tags           text[] not null default '{}',        -- ['BGMEA','RSC',...]
  is_sanctioned         boolean not null default false,
  is_published          boolean not null default false,      -- needs ≥1 Tier1-3 source_record
  claimed_by            uuid,                                -- profiles.id (nullable until Phase 4 auth tables)
  completeness_pct      smallint not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_suppliers_name_trgm   on public.suppliers using gin (company_name_norm gin_trgm_ops);
create index if not exists idx_suppliers_slug        on public.suppliers (slug);
create index if not exists idx_suppliers_email       on public.suppliers (email_primary);
create index if not exists idx_suppliers_bgmea       on public.suppliers using gin (bgmea_reg_numbers);
create index if not exists idx_suppliers_bkmea_reg   on public.suppliers (bkmea_reg_number);
create index if not exists idx_suppliers_published   on public.suppliers (is_published) where is_published = true;
create index if not exists idx_suppliers_sanctioned  on public.suppliers (is_sanctioned) where is_sanctioned = true;
create index if not exists idx_suppliers_city        on public.suppliers (city);
create index if not exists idx_suppliers_source_tags on public.suppliers using gin (source_tags);

-- ---------- source_records: trust hierarchy join ---------------------------
-- Every fact about a supplier traces back to ≥1 source_records row.
-- A Tier 6 row alone CANNOT publish a supplier (enforced by trigger below).
create table if not exists public.source_records (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  source_id       uuid not null references public.sources(id),
  source_tier     source_tier not null,                      -- denormalized for fast filtering
  source_ref      text,                                       -- e.g. BGMEA reg, RSC factory id, URL
  fields          jsonb not null default '{}'::jsonb,         -- raw scraped payload for this row
  fetched_at      timestamptz not null default now(),
  status          evidence_status not null default 'active',
  raw_hash        text,                                       -- sha256 of canonical payload, idempotent upserts
  unique (supplier_id, source_id, source_ref)
);

create index if not exists idx_srcrec_supplier on public.source_records (supplier_id);
create index if not exists idx_srcrec_source   on public.source_records (source_id);
create index if not exists idx_srcrec_tier     on public.source_records (source_tier);
create index if not exists idx_srcrec_active   on public.source_records (supplier_id) where status = 'active';

-- ---------- certifications --------------------------------------------------
create table if not exists public.certifications (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  kind            cert_kind not null,
  certificate_no  text,
  issuer          text,
  issued_on       date,
  expires_on      date,
  scope           text,
  source_record_id uuid references public.source_records(id),
  document_url    text,
  created_at      timestamptz not null default now(),
  unique (supplier_id, kind, certificate_no)
);

create index if not exists idx_certs_supplier on public.certifications (supplier_id);
create index if not exists idx_certs_expiring on public.certifications (expires_on) where expires_on is not null;

-- ---------- RSC remediation -------------------------------------------------
create table if not exists public.rsc_remediation (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null unique references public.suppliers(id) on delete cascade,
  rsc_factory_id      text,
  rsc_factory_name    text,
  rsc_location        text,
  fire_pct            numeric(5,2),
  structural_pct      numeric(5,2),
  electrical_pct      numeric(5,2),
  last_inspection_at  date,
  active              boolean not null default true,
  source_record_id    uuid references public.source_records(id),
  fetched_at          timestamptz not null default now()
);

create index if not exists idx_rsc_factory_id on public.rsc_remediation (rsc_factory_id);

-- ---------- sanctions screening --------------------------------------------
create table if not exists public.sanctions_screening (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  list            sanctions_list not null,
  matched_name    text not null,
  match_score     numeric(4,3),
  list_entry_ref  text,
  details         jsonb,
  source_record_id uuid references public.source_records(id),
  screened_at     timestamptz not null default now(),
  active          boolean not null default true
);

create index if not exists idx_sanc_supplier on public.sanctions_screening (supplier_id) where active = true;

-- ---------- SBI scores ------------------------------------------------------
-- 4 pillars: Legal(25) + Safety(30) + Certs(30) + Market Credibility(15) = 100
create table if not exists public.sbi_scores (
  supplier_id        uuid primary key references public.suppliers(id) on delete cascade,
  pillar1_legal      smallint not null default 0,
  pillar2_safety     smallint not null default 0,
  pillar3_certs      smallint not null default 0,
  pillar4_market     smallint not null default 0,
  total              smallint not null default 0,
  sanctioned_zero    boolean not null default false,         -- if true, total forced to 0
  inputs_hash        text,                                    -- idempotency
  computed_at        timestamptz not null default now()
);

create index if not exists idx_sbi_total on public.sbi_scores (total desc);

-- ---------- partner factories (buying house ↔ factory) --------------------
create table if not exists public.partner_factories (
  id              uuid primary key default gen_random_uuid(),
  buying_house_id uuid not null references public.suppliers(id) on delete cascade,
  factory_id      uuid not null references public.suppliers(id) on delete cascade,
  relationship    text,
  source_record_id uuid references public.source_records(id),
  created_at      timestamptz not null default now(),
  unique (buying_house_id, factory_id),
  check (buying_house_id <> factory_id)
);

-- ---------- verification queue (spec §9) -----------------------------------
create table if not exists public.verification_queue (
  id              uuid primary key default gen_random_uuid(),
  queue_type      queue_type not null,
  supplier_a_id   uuid references public.suppliers(id) on delete set null,
  supplier_b_name text,
  confidence      numeric(4,3),
  source_data     jsonb,
  admin_action    queue_action,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_vq_open on public.verification_queue (created_at) where reviewed_at is null;

-- ---------- ETL run log (observability) ------------------------------------
create table if not exists public.etl_runs (
  id              uuid primary key default gen_random_uuid(),
  scraper_code    text not null,                             -- e.g. 'bgmea_pdf','bkmea_web','rsc'
  source_id       uuid references public.sources(id),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running',           -- running|success|failed|partial
  records_seen    integer not null default 0,
  records_upserted integer not null default 0,
  records_skipped integer not null default 0,
  error           text,
  meta            jsonb
);
create index if not exists idx_etl_runs_scraper on public.etl_runs (scraper_code, started_at desc);

-- ---------- triggers --------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end $$ language plpgsql;

drop trigger if exists trg_suppliers_touch on public.suppliers;
create trigger trg_suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- Enforce: cannot publish without ≥1 Tier1-3 active source_record
create or replace function public.enforce_publish_tier() returns trigger as $$
declare ok integer;
begin
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

drop trigger if exists trg_suppliers_publish on public.suppliers;
create trigger trg_suppliers_publish before insert or update of is_published on public.suppliers
  for each row execute function public.enforce_publish_tier();

-- Sanctioned ⇒ SBI total forced to 0
create or replace function public.enforce_sanctions_zero() returns trigger as $$
begin
  if exists (select 1 from public.suppliers s where s.id = new.supplier_id and s.is_sanctioned) then
    new.sanctioned_zero := true;
    new.total := 0;
  else
    new.sanctioned_zero := false;
    new.total := least(100, greatest(0, new.pillar1_legal + new.pillar2_safety + new.pillar3_certs + new.pillar4_market));
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_sbi_zero on public.sbi_scores;
create trigger trg_sbi_zero before insert or update on public.sbi_scores
  for each row execute function public.enforce_sanctions_zero();

-- When a sanctions row is added/activated, mark supplier sanctioned + zero its score
create or replace function public.propagate_sanctions() returns trigger as $$
begin
  if new.active then
    update public.suppliers set is_sanctioned = true where id = new.supplier_id;
    update public.sbi_scores set total = 0, sanctioned_zero = true where supplier_id = new.supplier_id;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_sanc_propagate on public.sanctions_screening;
create trigger trg_sanc_propagate after insert or update on public.sanctions_screening
  for each row execute function public.propagate_sanctions();

-- ---------- completeness function (spec §10) -------------------------------
create or replace function public.compute_completeness(p_supplier_id uuid)
returns integer language plpgsql as $$
declare s public.suppliers%rowtype; r public.rsc_remediation%rowtype;
        score integer := 0; cert_n integer;
begin
  select * into s from public.suppliers where id = p_supplier_id;
  if not found then return 0; end if;

  -- Identity (30)
  if s.company_name is not null    then score := score + 5;  end if;
  if s.bgmea_verified              then score := score + 10; end if;
  if s.bkmea_verified              then score := score + 8;  end if;
  if s.rjsc_reg_number is not null then score := score + 7;  end if;

  -- Contact (20)
  if s.email_primary is not null   then score := score + 8;  end if;
  if array_length(s.phones,1) > 0  then score := score + 5;  end if;
  if s.address_raw is not null     then score := score + 4;  end if;
  if s.contact_name is not null    then score := score + 3;  end if;

  -- Compliance (30)
  select * into r from public.rsc_remediation where supplier_id = p_supplier_id;
  if found then
    if r.fire_pct = 100        then score := score + 10; end if;
    if r.structural_pct = 100  then score := score + 8;  end if;
  end if;
  select count(*) into cert_n from public.certifications where supplier_id = p_supplier_id;
  if cert_n > 0 then score := score + 12; end if;

  -- Market (20)
  if s.claimed_by is not null then score := score + 10; end if;

  return least(100, score);
end $$;

-- ---------- RLS: lock down by default --------------------------------------
alter table public.suppliers           enable row level security;
alter table public.source_records      enable row level security;
alter table public.certifications      enable row level security;
alter table public.rsc_remediation     enable row level security;
alter table public.sanctions_screening enable row level security;
alter table public.sbi_scores          enable row level security;
alter table public.partner_factories   enable row level security;
alter table public.verification_queue  enable row level security;
alter table public.etl_runs            enable row level security;
alter table public.sources             enable row level security;

-- Public read of published suppliers (Phase 1 will narrow further; contact gating
-- for non-paying buyers is enforced server-side, never via RLS exposing the column).
drop policy if exists pol_suppliers_pub_read on public.suppliers;
create policy pol_suppliers_pub_read on public.suppliers for select using (is_published = true);

drop policy if exists pol_sources_pub_read on public.sources;
create policy pol_sources_pub_read on public.sources for select using (true);

-- Service role bypasses RLS automatically (Postgres role `service_role`).
-- No anon write/update/delete policies. ETL writes use service role only.

-- =============================================================================
-- end migration 0001_phase0_core
-- =============================================================================
