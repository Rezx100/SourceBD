-- 0007_supplier_capacity_dozen_yearly.sql
--
-- Surface BGMEA "Annual production capacity (in dozens)" as a typed column on
-- public.suppliers. BGMEA is a Tier 2 industry register (factory self-declared
-- via the BGMEA member portal), so values land as-is with their native unit
-- and basis. We do NOT convert to pcs/day -- that conversion would synthesize
-- numbers (we don't know working days/year per factory). UI surfaces the value
-- with explicit unit + source attribution alongside the existing
-- production_capacity_pcs_day (BKMEA-only) column.
--
-- Sane range: largest BGMEA factories report ~10M dozen/yr (~120M pcs/yr).
-- 200,000,000 dozen/yr (2.4B pcs/yr) is a generous outlier guard.

alter table public.suppliers
  add column if not exists production_capacity_dozen_yearly bigint;

alter table public.suppliers
  drop constraint if exists capacity_dozen_yearly_sane;

alter table public.suppliers
  add constraint capacity_dozen_yearly_sane
  check (
    production_capacity_dozen_yearly is null
    or (production_capacity_dozen_yearly >= 0
        and production_capacity_dozen_yearly <= 200000000)
  );

create index if not exists suppliers_capacity_dozen_yearly_idx
  on public.suppliers (production_capacity_dozen_yearly)
  where production_capacity_dozen_yearly is not null;
