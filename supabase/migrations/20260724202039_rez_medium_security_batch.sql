-- =============================================================================
-- SourceBD — Medium security batch (REZ-14 / 15 / 16 / 19 / 20 / 21)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- REZ-16: Keep claimed_by out of public supplier reads
-- -----------------------------------------------------------------------------
revoke select (claimed_by) on public.suppliers from anon;

-- -----------------------------------------------------------------------------
-- REZ-19: Public registry views should only expose published suppliers
-- -----------------------------------------------------------------------------
create or replace view public.v_supplier_registry_ids_direct as
-- BGMEA (typed text[] column on suppliers; can be multi-value)
select s.id              as supplier_id,
       'BGMEA'::text     as source_code,
       'BGMEA Reg #'     as label,
       unnest(s.bgmea_reg_numbers) as value,
       coalesce(s.bgmea_verified, false) as verified,
       'https://www.bgmea.com.bd/'::text as source_url
  from public.suppliers s
 where s.is_published = true
   and array_length(s.bgmea_reg_numbers, 1) > 0

union all
-- BKMEA (typed single-value column on suppliers)
select s.id, 'BKMEA', 'BKMEA #',
       s.bkmea_reg_number,
       coalesce(s.bkmea_verified, false),
       'https://www.bkmea.com/'
  from public.suppliers s
 where s.is_published = true
   and s.bkmea_reg_number is not null
   and btrim(s.bkmea_reg_number) <> ''

union all
-- RSC (sidecar table)
select rr.supplier_id, 'RSC', 'RSC ID',
       rr.rsc_factory_id,
       true,
       'https://www.rsc-bd.org/'
  from public.rsc_remediation rr
  join public.suppliers s
    on s.id = rr.supplier_id
   and s.is_published = true
 where rr.rsc_factory_id is not null
   and btrim(rr.rsc_factory_id) <> ''

union all
-- EPB (Tier 1 government registry; payload-only)
select sr.supplier_id, 'EPB', 'EPB Reg #',
       sr.fields->>'epb_reg_no',
       true,
       'https://epb.gov.bd/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and s.is_published = true
 where src.code = 'EPB'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'epb_reg_no'
   and btrim(sr.fields->>'epb_reg_no') <> ''

union all
-- BGAPMEA (Tier 2 association; payload-only)
select sr.supplier_id, 'BGAPMEA', 'BGAPMEA #',
       sr.fields->>'bgapmea_membership_no',
       true,
       'https://bgapmea.org/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and s.is_published = true
 where src.code = 'BGAPMEA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'bgapmea_membership_no'
   and btrim(sr.fields->>'bgapmea_membership_no') <> ''

union all
-- BTMA (Tier 2 association; payload-only — SL # from members list)
select sr.supplier_id, 'BTMA', 'BTMA Member #SL',
       sr.fields->>'btma_sl_no',
       true,
       'https://btmadhaka.com/'
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  join public.suppliers s
    on s.id = sr.supplier_id
   and s.is_published = true
 where src.code = 'BTMA'
   and sr.status = 'active'
   and sr.supplier_id is not null
   and sr.fields ? 'btma_sl_no'
   and btrim(sr.fields->>'btma_sl_no') <> ''

union all
-- Certifications (typed cert table — GOTS / OEKO-TEX / WRAP / SA8000 / SEDEX / GRS / ...)
select c.supplier_id,
       upper(c.kind::text) as source_code,
       upper(c.kind::text) || ' Cert #' as label,
       c.certificate_no,
       true,
       c.document_url
  from public.certifications c
  join public.suppliers s
    on s.id = c.supplier_id
   and s.is_published = true
 where c.certificate_no is not null
   and btrim(c.certificate_no) <> '';

comment on view public.v_supplier_registry_ids_direct is
  'Raw, source-records / typed-column-driven registry/membership/certificate IDs per supplier. Published suppliers only. Subset of v_supplier_registry_ids; the parent view UNIONs this with inherited rows for RSC sibling/extension factories.';

create or replace view public.v_supplier_registry_ids as
select supplier_id,
       source_code,
       label,
       value,
       verified,
       source_url,
       null::uuid as inherited_from,
       null::text as inherited_from_name
  from public.v_supplier_registry_ids_direct
union all
select child.id                                 as supplier_id,
       parent_pill.source_code                  as source_code,
       parent_pill.label || ' (parent factory)' as label,
       parent_pill.value                        as value,
       parent_pill.verified                     as verified,
       parent_pill.source_url                   as source_url,
       parent.id                                as inherited_from,
       parent.company_name                      as inherited_from_name
  from public.suppliers child
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
   and parent.is_published = true
  join public.v_supplier_registry_ids_direct parent_pill
    on parent_pill.supplier_id = parent.id
 where bn.base is not null
   and child.is_published = true
   and parent_pill.source_code <> 'RSC'
   and not exists (
         select 1
           from public.v_supplier_registry_ids_direct d
          where d.supplier_id = child.id
            and d.source_code = parent_pill.source_code
            and d.value       = parent_pill.value
       );

comment on view public.v_supplier_registry_ids is
  'Long-form supplier registry/membership/certificate IDs for profile pill row (direct ∪ RSC sibling-factory inheritance). Published suppliers only. Inherited rows have label suffixed with " (parent factory)" and carry inherited_from / inherited_from_name. One row per (supplier, populated ID); never returns NULL values.';

-- -----------------------------------------------------------------------------
-- REZ-20: public.sources should not be world-readable
-- -----------------------------------------------------------------------------
drop policy if exists pol_sources_pub_read on public.sources;
create policy pol_sources_pub_read on public.sources for select using (false);
revoke select on public.sources from anon, authenticated;

-- -----------------------------------------------------------------------------
-- REZ-21: Constrain the public rl_check RPC to known buckets
-- -----------------------------------------------------------------------------
create or replace function public.rl_check(
  p_bucket text,
  p_ident text,
  p_limit_per_min int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := lower(btrim(p_bucket));
  v_ident text := btrim(p_ident);
  v_window_start timestamptz := date_trunc('minute', now());
  v_count int;
  v_remaining int;
  v_retry_after int;
begin
  if v_bucket is null or length(v_bucket) = 0 or length(v_bucket) > 64 then
    raise exception 'bucket required' using errcode = '22023';
  end if;
  if v_ident is null or length(v_ident) = 0 or length(v_ident) > 256 then
    raise exception 'ident required' using errcode = '22023';
  end if;
  if p_limit_per_min is null or p_limit_per_min <= 0 then
    raise exception 'limit_per_min must be > 0' using errcode = '22023';
  end if;

  if v_bucket not like 'email:%'
     and v_bucket <> all (
       array[
         'auth',
         'api_read',
         'api_write',
         'public_marketing'
       ]::text[]
     ) then
    raise exception 'bucket not allowed' using errcode = '22023';
  end if;

  if v_bucket like 'email:%' then
    if v_bucket <> all (
      array[
        'email:welcome',
        'email:rfq_received',
        'email:cert_expiry',
        'email:sanction_alert',
        'email:password_reset'
      ]::text[]
    ) then
      raise exception 'bucket not allowed' using errcode = '22023';
    end if;
  end if;

  -- Opportunistic TTL purge — keep the table bounded without a cron.
  delete from public.rate_limit_buckets
   where window_start < now() - interval '5 minutes';

  insert into public.rate_limit_buckets (bucket, ident, window_start, count)
  values (v_bucket, v_ident, v_window_start, 1)
  on conflict (bucket, ident, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  v_remaining := greatest(0, p_limit_per_min - v_count);
  if v_count > p_limit_per_min then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_window_start + interval '1 minute' - now())))::int
    );
  else
    v_retry_after := 0;
  end if;

  return jsonb_build_object(
    'ok', v_count <= p_limit_per_min,
    'count', v_count,
    'limit', p_limit_per_min,
    'remaining', v_remaining,
    'window_start', v_window_start,
    'retry_after_seconds', v_retry_after
  );
end;
$$;

revoke all on function public.rl_check(text, text, int) from public;
grant execute on function public.rl_check(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
