-- =============================================================================
-- 0019_f12_drop_dead_columns
-- F12 Phase 1: drop 11 columns across 4 tables that no read path consumes.
-- Refactored writers in this same commit; payload JSONB keys (source_records.fields)
-- preserved (they back other backfills / debug surfaces).
-- Also rewrites compute_completeness() to remove dropped rsc_remediation fields
-- (fire_pct, structural_pct) in favour of progress_pct (same 18/100 weight).
-- =============================================================================

alter table public.suppliers
    drop column if exists machines_knitting,
    drop column if exists machines_dyeing,
    drop column if exists annual_turnover;

alter table public.rsc_remediation
    drop column if exists rsc_location,
    drop column if exists fire_pct,
    drop column if exists structural_pct,
    drop column if exists electrical_pct,
    drop column if exists last_inspection_at;

alter table public.rsc_industry_metrics
    drop column if exists mirror_url,
    drop column if exists raw;

alter table public.rsc_monthly_reports
    drop column if exists mirror_url;

-- ---------- compute_completeness rewrite -----------------------------------
-- Same shape as 0001; the only change is the Compliance branch reading
-- progress_pct (the live RSC field) instead of the dropped fire_pct/structural_pct.
-- Combined weight preserved at 18/100 (was 10 + 8).
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
    if r.progress_pct = 100 then score := score + 18; end if;
  end if;
  select count(*) into cert_n from public.certifications where supplier_id = p_supplier_id;
  if cert_n > 0 then score := score + 12; end if;

  -- Market (20)
  if s.claimed_by is not null then score := score + 10; end if;

  return least(100, score);
end $$;

-- =============================================================================
-- end migration 0019_f12_drop_dead_columns
-- =============================================================================
