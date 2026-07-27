-- =============================================================================
-- SourceBD — Security hardening batch 2 (REZ-22 / 23 / 24 / 25 / 26)
-- =============================================================================
-- All fixes are idempotent (CREATE OR REPLACE / DROP … IF EXISTS / REVOKE is
-- a no-op when the grant is absent). Safe to re-run.

-- -----------------------------------------------------------------------------
-- REZ-26 [P2]: Revoke anon EXECUTE on public.rl_check
-- -----------------------------------------------------------------------------
-- REZ-21 added bucket allowlist and input guards to rl_check but did not
-- revoke the EXECUTE grant given to anon in that same migration.  Anonymous
-- callers can still invoke it directly to poison rate-limit state for other
-- identifiers or probe remaining quotas.  rl_check is only ever called from
-- server-side SECURITY DEFINER functions (email sender, action guards) which
-- use the service role — anon EXECUTE is never needed.
revoke execute on function public.rl_check(text, text, integer) from anon;

-- Harden the function body so a mistaken future grant cannot be exploited.
-- We recreate the function with an auth-role guard at the top; every other
-- line is byte-for-byte identical to the REZ-21 version in the medium batch.
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
  -- Body-level guard: rl_check is an internal SECURITY DEFINER helper and
  -- must never be callable by anonymous (unauthenticated) PostgREST clients.
  if coalesce(auth.role(), '') = 'anon' then
    raise exception 'permission denied for function rl_check' using errcode = '42501';
  end if;

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

-- Re-apply grants (service_role and authenticated may call rl_check from
-- server-side actions; anon is intentionally excluded).
revoke all on function public.rl_check(text, text, int) from public;
grant execute on function public.rl_check(text, text, int) to authenticated;

comment on function public.rl_check(text, text, int) is
  'Internal rate-limit helper (H2). Bucket allowlist + anon body guard added '
  'in REZ-26. Called only by server-side SECURITY DEFINER functions via the '
  'service role. anon EXECUTE revoked.';

-- -----------------------------------------------------------------------------
-- REZ-25 [P2]: sbi_scores — explicit admin-only policy + revoke broad grants
-- -----------------------------------------------------------------------------
-- RLS is enabled on sbi_scores but there were zero policies (deny-all by
-- default — currently safe), and anon + authenticated held full table-level
-- grants including INSERT / UPDATE / DELETE / TRUNCATE.  No role other than
-- service_role (ETL) or postgres should ever write to this table, and only
-- admin users should read it.

-- Step 1: revoke over-broad table grants from client roles.
revoke all on table public.sbi_scores from anon;
revoke insert, update, delete, truncate, references, trigger
    on table public.sbi_scores from authenticated;

-- Step 2: add an explicit admin-only policy so a future accidental
-- `USING (true)` cannot open the table to every authenticated user.
drop policy if exists sbi_scores_admin_only on public.sbi_scores;
create policy sbi_scores_admin_only
  on public.sbi_scores
  for all
  using ((auth.jwt() ->> 'role')::text = 'admin');

-- -----------------------------------------------------------------------------
-- REZ-24 [P2]: buyer_supplier_profile — catch up migration 0079
-- -----------------------------------------------------------------------------
-- Migration 0079_buyer_supplier_profile_strip_address_pii.sql exists locally
-- but was never tracked in production schema_migrations.  The live function
-- still emits `phone` and `email` JSON keys in the `addresses` array.
-- Migration 0082 (supplier_pii_hardening) caused those views to return NULL
-- values, so no real PII is transmitted today — but the keys themselves
-- persist, creating a defence-in-depth gap if 0082 is ever reverted.
--
-- This block is the function body from 0079, verbatim.  Using
-- CREATE OR REPLACE means it is safe to apply even if 0079 is later run
-- via the CLI (double-apply of identical body is a no-op).

create or replace function public.buyer_supplier_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select *
      from public.suppliers
     where slug = p_slug
       and is_published = true
     limit 1
  ),
  ring as (
    select coalesce(count(distinct sr.source_id), 0)::int as t13
      from s
      join public.source_records sr on sr.supplier_id = s.id
     where sr.status      = 'active'
       and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
  ),
  pills as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',         p.source_code,
          'label',               p.label,
          'value',               p.value,
          'verified',            p.verified,
          'source_url',          p.source_url,
          'inherited_from',      p.inherited_from,
          'inherited_from_name', p.inherited_from_name
        )
        order by (p.inherited_from is not null), p.source_code, p.value nulls last
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_registry_ids p on p.supplier_id = s.id
  ),
  certs as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',           c.kind::text,
          'certificate_no', c.certificate_no,
          'issuer',         c.issuer,
          'issued_on',      c.issued_on,
          'expires_on',     c.expires_on,
          'scope',          c.scope,
          'document_url',   c.document_url
        )
        order by c.kind::text, c.expires_on desc nulls last
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.certifications c on c.supplier_id = s.id
  ),
  rsc as (
    select jsonb_build_object(
      'progress_pct',                rr.progress_pct,
      'workers_count',               rr.workers_count,
      'remediation_status',          rr.remediation_status,
      'training_status',             rr.training_status,
      'parent_group_name',           rr.parent_group_name,
      'parent_group_factory_count',  rr.parent_group_factory_count,
      'fire_inspection_url',         rr.fire_inspection_url,
      'structural_inspection_url',   rr.structural_inspection_url,
      'electrical_inspection_url',   rr.electrical_inspection_url,
      'boiler_inspection_url',       rr.boiler_inspection_url,
      'cap_url',                     rr.cap_url
    ) as obj
    from s
    join public.rsc_remediation rr on rr.supplier_id = s.id and rr.active = true
    limit 1
  ),
  brands as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by src.code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
    where src.code like 'BRAND\_%' escape '\'
  ),
  sanc as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'list',           ss.list::text,
          'matched_name',   ss.matched_name,
          'list_entry_ref', ss.list_entry_ref,
          'screened_at',    ss.screened_at,
          'source_url',     sle.source_url,
          'listed_date',    sle.listed_date
        )
        order by ss.screened_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.sanctions_screening ss on ss.supplier_id = s.id and ss.active = true
    left join public.sanctions_list_entries sle
      on sle.list = ss.list and sle.entry_ref = ss.list_entry_ref
  ),
  provenance as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source_code',  src.code,
          'display_name', src.display_name,
          'tier',         sr.source_tier::text,
          'source_ref',   sr.source_ref,
          'source_url',   coalesce(nullif(sr.fields->>'source_url', ''), src.base_url),
          'last_seen_at', sr.fetched_at
        )
        order by sr.source_tier::text, src.code, sr.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.source_records sr on sr.supplier_id = s.id and sr.status = 'active'
    join public.sources src        on src.id = sr.source_id
  ),
  addresses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',         va.address_kind,
          'address',      va.address,
          'source_code',  va.source_code,
          'fetched_at',   va.fetched_at
        )
        order by va.address_kind, va.source_code
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.v_supplier_addresses va on va.supplier_id = s.id
  ),
  docs as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'doc_type',     cd.doc_type,
          'mirror_url',   cd.mirror_url,
          'original_url', cd.original_url,
          'fetched_at',   cd.fetched_at,
          'file_size',    cd.file_size
        )
        order by cd.doc_type, cd.fetched_at desc
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.compliance_documents cd on cd.supplier_id = s.id
  ),
  partner_factories as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           f.id,
          'slug',         f.slug,
          'company_name', f.company_name,
          'entity_type',  f.entity_type::text,
          'city',         f.city,
          'district',     f.district,
          'decided_at',   sr.decided_at
        )
        order by f.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.buying_house_id = s.id and sr.status = 'accepted'
    join public.suppliers f
      on f.id = sr.factory_id
     and f.is_published = true
    where s.entity_type::text = 'buying_house'
  ),
  partner_buying_houses as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           bh.id,
          'slug',         bh.slug,
          'company_name', bh.company_name,
          'entity_type',  bh.entity_type::text,
          'city',         bh.city,
          'district',     bh.district,
          'decided_at',   sr.decided_at
        )
        order by bh.company_name
      ),
      '[]'::jsonb
    ) as items
    from s
    join public.supplier_relationships sr
      on sr.factory_id = s.id and sr.status = 'accepted'
    join public.suppliers bh
      on bh.id = sr.buying_house_id
     and bh.is_published = true
    where s.entity_type::text = 'factory'
  )
  select jsonb_build_object(
    'supplier', jsonb_build_object(
      'id',                              s.id,
      'slug',                            s.slug,
      'company_name',                    s.company_name,
      'entity_type',                     s.entity_type::text,
      'city',                            s.city,
      'district',                        s.district,
      'country',                         s.country,
      'address_raw',                     s.address_raw,
      'completeness_pct',                s.completeness_pct,
      'is_sanctioned',                   s.is_sanctioned,
      'parent_group_name',               s.parent_group_name,
      'established_date',                s.established_date,
      'bepza_zone',                      s.bepza_zone,
      'factory_types',                   s.factory_types,
      'principal_products',              s.principal_products,
      'employees_total',                 s.employees_total,
      'employees_male',                  s.employees_male,
      'employees_female',                s.employees_female,
      'machines_sewing',                 s.machines_sewing,
      'production_capacity_pcs_day',     s.production_capacity_pcs_day,
      'production_capacity_dozen_yearly',s.production_capacity_dozen_yearly,
      'source_tags',                     s.source_tags,
      'supplier_tagline',                s.supplier_tagline,
      'supplier_about',                  s.supplier_about,
      'supplier_moq',                    s.supplier_moq,
      'supplier_lead_time_days',         s.supplier_lead_time_days,
      'supplier_capabilities',           coalesce(s.supplier_capabilities, '{}'::text[])
    ),
    't13_source_count',     (select t13   from ring),
    'pills',                (select items from pills),
    'certifications',       (select items from certs),
    'rsc_remediation',      (select obj   from rsc),
    'brand_attributions',   (select items from brands),
    'sanctions',            (select items from sanc),
    'provenance',           (select items from provenance),
    'addresses',            (select items from addresses),
    'documents',            (select items from docs),
    'partner_factories',
      coalesce((select items from partner_factories), '[]'::jsonb),
    'partner_buying_houses',
      coalesce((select items from partner_buying_houses), '[]'::jsonb)
  )
  from s
$$;

revoke all on function public.buyer_supplier_profile(text) from public;
grant execute on function public.buyer_supplier_profile(text) to anon, authenticated;

comment on function public.buyer_supplier_profile(text) is
  'Buyer-facing factory profile (Spec B2; extended by S2 + S5; REZ-7/0079/REZ-24 '
  'removed address contact PII). partner_factories[] on buying_house pages and '
  'partner_buying_houses[] on factory pages contain only accepted '
  'relationships. Never returns contact PII (no phone/email/contact_name).';

-- -----------------------------------------------------------------------------
-- REZ-22 [P3]: Revoke claimed_by SELECT from authenticated
-- -----------------------------------------------------------------------------
-- REZ-16 / medium-batch revoked claimed_by from anon only.
-- Migration 0083_suppliers_column_pii_revoke re-granted SELECT on a safe
-- column list to both anon AND authenticated — including claimed_by.
-- A logged-in buyer/supplier can therefore enumerate ownership UUIDs for the
-- published catalog via a direct PostgREST /rest/v1/suppliers request.
-- RPCs (buyer_supplier_profile, discover_suppliers) are unaffected — they
-- never return claimed_by.
revoke select (claimed_by) on public.suppliers from authenticated;

-- -----------------------------------------------------------------------------
-- REZ-23 [P3]: address_geocodes — restrict RLS to published-address lookup
-- -----------------------------------------------------------------------------
-- 0077 created the table with `using (true)` (world-readable). lib/barikoi.ts
-- (server-only) is the sole reader and has been updated to use the service
-- role, so anon direct table reads are no longer needed.
-- Replacing the open policy with a deny-anon / deny-authenticated policy.
-- service_role (ETL + Next.js server) bypasses RLS and is unaffected.
drop policy if exists address_geocodes_public_read on public.address_geocodes;
create policy address_geocodes_service_only
  on public.address_geocodes
  for select
  using (false);

notify pgrst, 'reload schema';
