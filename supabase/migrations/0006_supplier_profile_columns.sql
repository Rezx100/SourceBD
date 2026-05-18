-- Migration 0006: surface BGMEA/BKMEA/EPB JSONB payload to typed suppliers columns.
-- Spec: progress-tracker.md "To-Do #2 — Surface JSONB payload to suppliers columns".
-- Sources: BKMEA detail (Tier 2), BGMEA web (Tier 2), EPB (Tier 1).
-- Idempotent: ALTER ADD COLUMN IF NOT EXISTS + indexes IF NOT EXISTS.

alter table public.suppliers
    add column if not exists employees_total int,
    add column if not exists employees_male int,
    add column if not exists employees_female int,
    add column if not exists production_capacity_pcs_day int,
    add column if not exists machines_sewing int,
    add column if not exists machines_knitting int,
    add column if not exists machines_dyeing int,
    add column if not exists established_date text,
    add column if not exists principal_products text[] not null default '{}',
    add column if not exists factory_types text[] not null default '{}',
    add column if not exists annual_turnover jsonb;

-- Sanity bounds (workforce numbers; keep generous to allow legitimate large RMG factories
-- which can exceed 30k workers). Reject obvious garbage.
alter table public.suppliers
    drop constraint if exists suppliers_employees_total_sane;
alter table public.suppliers
    add constraint suppliers_employees_total_sane
    check (employees_total is null or (employees_total >= 0 and employees_total <= 200000));

alter table public.suppliers
    drop constraint if exists suppliers_employees_male_sane;
alter table public.suppliers
    add constraint suppliers_employees_male_sane
    check (employees_male is null or (employees_male >= 0 and employees_male <= 200000));

alter table public.suppliers
    drop constraint if exists suppliers_employees_female_sane;
alter table public.suppliers
    add constraint suppliers_employees_female_sane
    check (employees_female is null or (employees_female >= 0 and employees_female <= 200000));

alter table public.suppliers
    drop constraint if exists suppliers_capacity_sane;
alter table public.suppliers
    add constraint suppliers_capacity_sane
    check (production_capacity_pcs_day is null or (production_capacity_pcs_day >= 0 and production_capacity_pcs_day <= 10000000));

-- Filter / search indexes (b-tree for numeric range filters used in buyer search;
-- GIN for array containment on products / factory types).
create index if not exists ix_suppliers_employees_total
    on public.suppliers (employees_total)
    where employees_total is not null;

create index if not exists ix_suppliers_capacity
    on public.suppliers (production_capacity_pcs_day)
    where production_capacity_pcs_day is not null;

create index if not exists ix_suppliers_principal_products_gin
    on public.suppliers using gin (principal_products);

create index if not exists ix_suppliers_factory_types_gin
    on public.suppliers using gin (factory_types);
