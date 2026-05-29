-- 0034 — Supplier Profile Editor (Spec S2, Phase 3).
--
-- Second supplier-portal spec per `context/phases.md`. A signed-in supplier
-- whose `auth.uid()` matches `suppliers.claimed_by` may edit a fixed
-- allow-list of supplier-attested fields on their own row. **Register-sourced
-- columns are never overwritten** (decision 2a, 2026-05-30) — the editor
-- writes to a parallel `supplier_*` column set; the read path COALESCEs the
-- register value first, falls back to the supplier-attested value when the
-- register has no value (only meaningful for the 5 brand-new fields; the
-- contact pair is asymmetric — see `buyer_supplier_profile` update below).
--
-- The 9 editable keys:
--   tagline, about, moq, lead_time_days, capabilities,
--   contact_name, contact_role, contact_email, contact_phone
--
-- Any key outside that allow-list raises `errcode='22023'` ("field not
-- editable") at the RPC. The smoke exercises this against `company_name`,
-- `bgmea_reg_number`, `sbi_total`, `claimed_by`, `is_published`,
-- `is_sanctioned`, `address_raw`.
--
-- No admin moderation / no review queue (decision A). Supplier-attested
-- writes are direct; ownership is `claimed_by = auth.uid()`, gated by
-- SECURITY DEFINER. If we ever need moderation it ships as a separate spec.
--
-- α/β/γ honoured: zero SBI numeric leaves the DB on either RPC.
--
-- Reversible:
--   drop function public.supplier_profile_upsert(jsonb);
--   drop function public.supplier_profile_get(uuid);
--   alter table public.suppliers
--     drop column supplier_tagline,
--     drop column supplier_about,
--     drop column supplier_moq,
--     drop column supplier_lead_time_days,
--     drop column supplier_capabilities,
--     drop column supplier_contact_name,
--     drop column supplier_contact_role,
--     drop column supplier_contact_email,
--     drop column supplier_contact_phone,
--     drop column supplier_attested_at,
--     drop column supplier_attested_by;
--   (and restore buyer_supplier_profile from 0024.)

-- ----------------------------------------------------------------------
-- columns
-- ----------------------------------------------------------------------

alter table public.suppliers
  add column if not exists supplier_tagline         text,
  add column if not exists supplier_about           text,
  add column if not exists supplier_moq             integer,
  add column if not exists supplier_lead_time_days  integer,
  add column if not exists supplier_capabilities    text[],
  add column if not exists supplier_contact_name    text,
  add column if not exists supplier_contact_role    text,
  add column if not exists supplier_contact_email   text,
  add column if not exists supplier_contact_phone   text,
  add column if not exists supplier_attested_at     timestamptz,
  add column if not exists supplier_attested_by     uuid
    references auth.users (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_tagline_len_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_tagline_len_chk
      check (supplier_tagline is null or char_length(supplier_tagline) <= 160);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_about_len_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_about_len_chk
      check (supplier_about is null or char_length(supplier_about) <= 4000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_moq_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_moq_chk
      check (supplier_moq is null or supplier_moq >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_lead_time_days_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_lead_time_days_chk
      check (supplier_lead_time_days is null
             or (supplier_lead_time_days between 0 and 365));
  end if;

  -- Per-element validation (length 1..60, non-null) is enforced in
  -- supplier_profile_upsert RPC because Postgres disallows subqueries
  -- (including unnest) in CHECK constraints. The table constraint pins
  -- only cardinality; element-level rules live in the write path.
  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_capabilities_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_capabilities_chk
      check (
        supplier_capabilities is null
        or cardinality(supplier_capabilities) <= 20
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_contact_name_len_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_contact_name_len_chk
      check (supplier_contact_name is null or char_length(supplier_contact_name) <= 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_contact_role_len_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_contact_role_len_chk
      check (supplier_contact_role is null or char_length(supplier_contact_role) <= 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_contact_email_fmt_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_contact_email_fmt_chk
      check (
        supplier_contact_email is null
        or supplier_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_supplier_contact_phone_len_chk') then
    alter table public.suppliers
      add constraint suppliers_supplier_contact_phone_len_chk
      check (supplier_contact_phone is null or char_length(supplier_contact_phone) <= 40);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- supplier_profile_get — read the editable + meta fields for one supplier
-- the caller owns. Returns NULL when the supplier is not owned by the
-- caller (the API maps NULL → 404, do not leak existence).
-- ----------------------------------------------------------------------

create or replace function public.supplier_profile_get(p_supplier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null or p_supplier_id is null then
    return null;
  end if;

  select id, slug, company_name, entity_type::text as entity_type,
         country, city, district, address_raw,
         email_primary, phones, contact_name, contact_role, website,
         supplier_tagline, supplier_about, supplier_moq, supplier_lead_time_days,
         supplier_capabilities,
         supplier_contact_name, supplier_contact_role,
         supplier_contact_email, supplier_contact_phone,
         supplier_attested_at, supplier_attested_by
    into v_row
    from public.suppliers
   where id = p_supplier_id
     and claimed_by = v_uid;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'supplier', jsonb_build_object(
      'id',           v_row.id,
      'slug',         v_row.slug,
      'company_name', v_row.company_name,
      'entity_type',  v_row.entity_type,
      'country',      v_row.country,
      'city',         v_row.city,
      'district',     v_row.district,
      'address_raw',  v_row.address_raw
    ),
    'register', jsonb_build_object(
      'email_primary', v_row.email_primary,
      'phones',        v_row.phones,
      'contact_name',  v_row.contact_name,
      'contact_role',  v_row.contact_role,
      'website',       v_row.website
    ),
    'editable', jsonb_build_object(
      'tagline',         v_row.supplier_tagline,
      'about',           v_row.supplier_about,
      'moq',             v_row.supplier_moq,
      'lead_time_days',  v_row.supplier_lead_time_days,
      'capabilities',    coalesce(v_row.supplier_capabilities, '{}'::text[]),
      'contact_name',    v_row.supplier_contact_name,
      'contact_role',    v_row.supplier_contact_role,
      'contact_email',   v_row.supplier_contact_email,
      'contact_phone',   v_row.supplier_contact_phone
    ),
    'attested_at',   v_row.supplier_attested_at,
    'attested_by',   v_row.supplier_attested_by
  );
end;
$$;

revoke all     on function public.supplier_profile_get(uuid) from public;
grant  execute on function public.supplier_profile_get(uuid) to authenticated;

comment on function public.supplier_profile_get(uuid) is
  'Spec S2 — returns editable + register fields for a supplier owned by '
  'the caller. NULL when not owned (API → 404, no existence leak).';

-- ----------------------------------------------------------------------
-- supplier_profile_upsert — partial-patch the 9 editable fields.
-- Allow-list is hard-coded; any key outside it raises 22023.
-- ----------------------------------------------------------------------

create or replace function public.supplier_profile_upsert(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_supplier_id     uuid;
  v_now             timestamptz := now();
  v_allowed         text[] := array[
    'supplier_id',
    'tagline','about','moq','lead_time_days','capabilities',
    'contact_name','contact_role','contact_email','contact_phone'
  ];
  v_key             text;
  v_capabilities    text[];
  v_cap_elem        jsonb;
  v_rowcount        integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'p_patch must be a jsonb object' using errcode = '22023';
  end if;

  -- Caller must own at least one supplier.
  if not exists (
    select 1 from public.suppliers where claimed_by = v_uid
  ) then
    raise exception 'not a claimed supplier' using errcode = '42501';
  end if;

  -- supplier_id is required.
  if not (p_patch ? 'supplier_id') then
    raise exception 'supplier_id is required' using errcode = '22023';
  end if;
  begin
    v_supplier_id := (p_patch ->> 'supplier_id')::uuid;
  exception when others then
    raise exception 'supplier_id must be a uuid' using errcode = '22023';
  end;

  -- Allow-list enforcement (this is the tier-overwrite refusal).
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'field not editable: %', v_key using errcode = '22023';
    end if;
  end loop;

  -- capabilities pre-validate (array of strings, ≤20, each 1..60 chars).
  if p_patch ? 'capabilities' then
    if jsonb_typeof(p_patch -> 'capabilities') <> 'array' then
      raise exception 'capabilities must be a jsonb array' using errcode = '22023';
    end if;
    if jsonb_array_length(p_patch -> 'capabilities') > 20 then
      raise exception 'capabilities must have at most 20 entries' using errcode = '22023';
    end if;
    v_capabilities := array[]::text[];
    for v_cap_elem in select * from jsonb_array_elements(p_patch -> 'capabilities') loop
      if jsonb_typeof(v_cap_elem) <> 'string' then
        raise exception 'capabilities entries must be strings' using errcode = '22023';
      end if;
      if char_length(btrim(v_cap_elem #>> '{}')) < 1
         or char_length(v_cap_elem #>> '{}') > 60 then
        raise exception 'capabilities entries must be 1..60 chars' using errcode = '22023';
      end if;
      v_capabilities := v_capabilities || (v_cap_elem #>> '{}');
    end loop;
  end if;

  -- Numeric pre-validate so we surface a clean 22023 (rather than the
  -- column check raising 23514).
  if p_patch ? 'moq' then
    if not (jsonb_typeof(p_patch -> 'moq') in ('number','null')) then
      raise exception 'moq must be an integer or null' using errcode = '22023';
    end if;
    if jsonb_typeof(p_patch -> 'moq') = 'number'
       and ((p_patch ->> 'moq')::numeric < 0
            or (p_patch ->> 'moq')::numeric > 2147483647) then
      raise exception 'moq must be in 0..2147483647' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'lead_time_days' then
    if not (jsonb_typeof(p_patch -> 'lead_time_days') in ('number','null')) then
      raise exception 'lead_time_days must be an integer or null' using errcode = '22023';
    end if;
    if jsonb_typeof(p_patch -> 'lead_time_days') = 'number'
       and ((p_patch ->> 'lead_time_days')::numeric < 0
            or (p_patch ->> 'lead_time_days')::numeric > 365) then
      raise exception 'lead_time_days must be in 0..365' using errcode = '22023';
    end if;
  end if;

  -- Partial-patch UPDATE. Keys absent from p_patch keep their prior value.
  update public.suppliers s
     set supplier_tagline = case when p_patch ? 'tagline'
                                 then nullif(btrim(coalesce(p_patch ->> 'tagline','')), '')
                                 else s.supplier_tagline end,
         supplier_about = case when p_patch ? 'about'
                               then nullif(btrim(coalesce(p_patch ->> 'about','')), '')
                               else s.supplier_about end,
         supplier_moq = case when p_patch ? 'moq'
                             then case when jsonb_typeof(p_patch -> 'moq') = 'null'
                                       then null
                                       else (p_patch ->> 'moq')::integer end
                             else s.supplier_moq end,
         supplier_lead_time_days = case when p_patch ? 'lead_time_days'
                             then case when jsonb_typeof(p_patch -> 'lead_time_days') = 'null'
                                       then null
                                       else (p_patch ->> 'lead_time_days')::integer end
                             else s.supplier_lead_time_days end,
         supplier_capabilities = case when p_patch ? 'capabilities'
                                      then v_capabilities
                                      else s.supplier_capabilities end,
         supplier_contact_name = case when p_patch ? 'contact_name'
                                      then nullif(btrim(coalesce(p_patch ->> 'contact_name','')), '')
                                      else s.supplier_contact_name end,
         supplier_contact_role = case when p_patch ? 'contact_role'
                                      then nullif(btrim(coalesce(p_patch ->> 'contact_role','')), '')
                                      else s.supplier_contact_role end,
         supplier_contact_email = case when p_patch ? 'contact_email'
                                       then nullif(btrim(coalesce(p_patch ->> 'contact_email','')), '')
                                       else s.supplier_contact_email end,
         supplier_contact_phone = case when p_patch ? 'contact_phone'
                                       then nullif(btrim(coalesce(p_patch ->> 'contact_phone','')), '')
                                       else s.supplier_contact_phone end,
         supplier_attested_at = v_now,
         supplier_attested_by = v_uid,
         updated_at = v_now
   where s.id = v_supplier_id
     and s.claimed_by = v_uid;

  get diagnostics v_rowcount = row_count;
  if v_rowcount = 0 then
    raise exception 'not your supplier' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok',           true,
    'supplier_id',  v_supplier_id,
    'attested_at',  v_now
  );
end;
$$;

revoke all     on function public.supplier_profile_upsert(jsonb) from public;
grant  execute on function public.supplier_profile_upsert(jsonb) to authenticated;

comment on function public.supplier_profile_upsert(jsonb) is
  'Spec S2 — partial-patch the 9 supplier-attested fields on the caller-'
  'owned supplier. Allow-list is hard-coded; any key outside it raises '
  '22023. Register-sourced columns are never touched.';

-- ----------------------------------------------------------------------
-- buyer_supplier_profile — surface the 5 new pass-through fields.
-- Contact PII remains gated (existing B2 contract preserved).
-- ----------------------------------------------------------------------

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
          'phone',        va.phone,
          'email',        va.email,
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
    't13_source_count',   (select t13   from ring),
    'pills',              (select items from pills),
    'certifications',     (select items from certs),
    'rsc_remediation',    (select obj   from rsc),
    'brand_attributions', (select items from brands),
    'sanctions',          (select items from sanc),
    'provenance',         (select items from provenance),
    'addresses',          (select items from addresses),
    'documents',          (select items from docs)
  )
  from s
$$;

revoke all on function public.buyer_supplier_profile(text) from public;
grant execute on function public.buyer_supplier_profile(text) to anon, authenticated;

comment on function public.buyer_supplier_profile(text) is
  'Buyer-facing factory profile (Spec B2, extended by S2). Returns a '
  'single jsonb document for /app/suppliers/[slug]. Excludes SBI and '
  'contact PII by design. Surfaces 5 supplier-attested pass-through '
  'fields (tagline / about / moq / lead_time / capabilities) when set.';
