-- 0036 — Spec S5 (Phase 3 final). Factory ↔ Buying-house relationships.
--
-- Bidirectional partner graph with consent. Either side (a claimed
-- buying_house or a claimed factory) can REQUEST a partnership; the
-- counterparty must ACCEPT or REJECT it. Either side may REVOKE an
-- accepted relationship.
--
-- Hard invariants:
--   * Only the user who has CLAIMED one side may act on its behalf
--     (`suppliers.claimed_by = auth.uid()`). Both sides must be
--     `is_published = true and is_sanctioned = false`.
--   * `buying_house_id` must reference a supplier with
--     `entity_type='buying_house'`; `factory_id` must reference a
--     supplier with `entity_type='factory'`.
--   * Decide is restricted to the side that DID NOT initiate.
--   * Revoke is restricted to either claimed side once accepted.
--   * The schema does not store contact PII; the list/profile surfaces
--     project only `(id, slug, company_name, entity_type, city, district)`.
--
-- RLS: SELECT-only policies mirror RPC visibility (each side can read
-- rows touching a supplier they claim). All writes go through SECURITY
-- DEFINER RPCs.
--
-- buyer_supplier_profile is extended to surface:
--   * partner_factories[]      — when entity_type='buying_house'
--   * partner_buying_houses[]  — when entity_type='factory'
--   Both arrays expose only accepted relationships and the same no-PII
--   shape used by the list RPC.
--
-- Reversible:
--   drop function public.supplier_relationship_search(text, text);
--   drop function public.supplier_relationship_list(uuid, text);
--   drop function public.supplier_relationship_revoke(uuid);
--   drop function public.supplier_relationship_decide(uuid, boolean, text);
--   drop function public.supplier_relationship_request(uuid, uuid, text);
--   drop table public.supplier_relationships;
--   drop type public.supplier_relationship_status;
--   (and restore buyer_supplier_profile from 0034.)

-- ----------------------------------------------------------------------
-- enum
-- ----------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'supplier_relationship_status') then
    create type public.supplier_relationship_status as enum
      ('pending', 'accepted', 'rejected', 'revoked');
  end if;
end$$;

-- ----------------------------------------------------------------------
-- table
-- ----------------------------------------------------------------------

create table if not exists public.supplier_relationships (
  id                uuid                                  primary key default gen_random_uuid(),
  buying_house_id   uuid                                  not null references public.suppliers(id) on delete cascade,
  factory_id        uuid                                  not null references public.suppliers(id) on delete cascade,
  status            public.supplier_relationship_status   not null default 'pending',
  initiated_by      uuid                                  not null references auth.users(id)       on delete cascade,
  initiated_side    text                                  not null check (initiated_side in ('buying_house','factory')),
  note              text                                  null check (note is null or char_length(note) <= 1000),
  decided_at        timestamptz                           null,
  decided_by        uuid                                  null references auth.users(id) on delete set null,
  created_at        timestamptz                           not null default now(),
  updated_at        timestamptz                           not null default now(),
  unique (buying_house_id, factory_id),
  check (buying_house_id <> factory_id)
);

create index if not exists idx_supplier_relationships_bh
  on public.supplier_relationships (buying_house_id, status);
create index if not exists idx_supplier_relationships_factory
  on public.supplier_relationships (factory_id, status);

-- ----------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------

alter table public.supplier_relationships enable row level security;

drop policy if exists pol_supplier_relationships_select_bh      on public.supplier_relationships;
drop policy if exists pol_supplier_relationships_select_factory on public.supplier_relationships;

create policy pol_supplier_relationships_select_bh
  on public.supplier_relationships
  for select
  to authenticated
  using (
    exists (
      select 1 from public.suppliers s
       where s.id = supplier_relationships.buying_house_id
         and s.claimed_by = auth.uid()
    )
  );

create policy pol_supplier_relationships_select_factory
  on public.supplier_relationships
  for select
  to authenticated
  using (
    exists (
      select 1 from public.suppliers s
       where s.id = supplier_relationships.factory_id
         and s.claimed_by = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — every write goes through the
-- SECURITY DEFINER RPCs below.
revoke all     on public.supplier_relationships from anon, authenticated;
grant  select  on public.supplier_relationships to authenticated;

-- ----------------------------------------------------------------------
-- supplier_relationship_request(buying_house_id, factory_id, note?) → uuid
-- ----------------------------------------------------------------------

create or replace function public.supplier_relationship_request(
  p_buying_house_id uuid,
  p_factory_id      uuid,
  p_note            text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_bh            record;
  v_factory       record;
  v_initiated     text;
  v_note          text;
  v_existing_id   uuid;
  v_existing_st   public.supplier_relationship_status;
  v_new_id        uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_buying_house_id is null or p_factory_id is null then
    raise exception 'buying_house_id and factory_id are required' using errcode = '22023';
  end if;
  if p_buying_house_id = p_factory_id then
    raise exception 'buying_house_id and factory_id must differ' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note exceeds 1000 characters' using errcode = '22023';
  end if;

  select id, entity_type::text as entity_type, claimed_by,
         is_published, is_sanctioned
    into v_bh
    from public.suppliers
   where id = p_buying_house_id;
  if not found then
    raise exception 'buying house not found' using errcode = '22023';
  end if;
  if v_bh.entity_type <> 'buying_house' then
    raise exception 'buying_house_id must reference a buying_house supplier' using errcode = '22023';
  end if;
  if v_bh.is_published = false or v_bh.is_sanctioned = true then
    raise exception 'buying house is not eligible' using errcode = '22023';
  end if;

  select id, entity_type::text as entity_type, claimed_by,
         is_published, is_sanctioned
    into v_factory
    from public.suppliers
   where id = p_factory_id;
  if not found then
    raise exception 'factory not found' using errcode = '22023';
  end if;
  if v_factory.entity_type <> 'factory' then
    raise exception 'factory_id must reference a factory supplier' using errcode = '22023';
  end if;
  if v_factory.is_published = false or v_factory.is_sanctioned = true then
    raise exception 'factory is not eligible' using errcode = '22023';
  end if;

  -- Caller must own one side; that side becomes initiated_side.
  if v_bh.claimed_by = v_uid then
    v_initiated := 'buying_house';
  elsif v_factory.claimed_by = v_uid then
    v_initiated := 'factory';
  else
    raise exception 'caller does not own either side' using errcode = '42501';
  end if;

  -- The counterparty MUST also be claimed (consent requires a decider).
  if v_initiated = 'buying_house' and v_factory.claimed_by is null then
    raise exception 'factory has not been claimed yet' using errcode = '22023';
  end if;
  if v_initiated = 'factory' and v_bh.claimed_by is null then
    raise exception 'buying house has not been claimed yet' using errcode = '22023';
  end if;

  -- Idempotency: if a row already exists, only allow re-request when it
  -- is in a terminal-but-resumable state (rejected / revoked). Pending
  -- and accepted are no-ops returning the existing id.
  select id, status into v_existing_id, v_existing_st
    from public.supplier_relationships
   where buying_house_id = p_buying_house_id
     and factory_id      = p_factory_id;

  if found then
    if v_existing_st in ('pending', 'accepted') then
      return v_existing_id;
    end if;
    -- rejected | revoked → reopen as a new pending request from caller.
    update public.supplier_relationships
       set status         = 'pending',
           initiated_by   = v_uid,
           initiated_side = v_initiated,
           note           = v_note,
           decided_at     = null,
           decided_by     = null,
           updated_at     = now()
     where id = v_existing_id;
    return v_existing_id;
  end if;

  insert into public.supplier_relationships
    (buying_house_id, factory_id, status, initiated_by, initiated_side, note)
  values
    (p_buying_house_id, p_factory_id, 'pending', v_uid, v_initiated, v_note)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all     on function public.supplier_relationship_request(uuid, uuid, text) from public;
grant  execute on function public.supplier_relationship_request(uuid, uuid, text) to authenticated;

comment on function public.supplier_relationship_request(uuid, uuid, text) is
  'Spec S5 — claimed buying_house or claimed factory requests a '
  'partnership. The counterparty must accept via '
  'supplier_relationship_decide. Idempotent on (buying_house_id, factory_id).';

-- ----------------------------------------------------------------------
-- supplier_relationship_decide(id, accept boolean, note?) → void
-- ----------------------------------------------------------------------

create or replace function public.supplier_relationship_decide(
  p_id     uuid,
  p_accept boolean,
  p_note   text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_row       record;
  v_decider   text;
  v_note      text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'id is required' using errcode = '22023';
  end if;
  if p_accept is null then
    raise exception 'accept is required' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note exceeds 1000 characters' using errcode = '22023';
  end if;

  select sr.id, sr.status, sr.initiated_side,
         bh.claimed_by as bh_owner, f.claimed_by as factory_owner
    into v_row
    from public.supplier_relationships sr
    join public.suppliers bh on bh.id = sr.buying_house_id
    join public.suppliers f  on f.id  = sr.factory_id
   where sr.id = p_id;
  if not found then
    raise exception 'relationship not found' using errcode = '22023';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'relationship is not pending' using errcode = '22023';
  end if;

  -- Decider must own the counterparty side.
  if v_row.initiated_side = 'buying_house' then
    if v_row.factory_owner is null or v_row.factory_owner <> v_uid then
      raise exception 'only the factory side may decide this request' using errcode = '42501';
    end if;
    v_decider := 'factory';
  else
    if v_row.bh_owner is null or v_row.bh_owner <> v_uid then
      raise exception 'only the buying house side may decide this request' using errcode = '42501';
    end if;
    v_decider := 'buying_house';
  end if;

  update public.supplier_relationships
     set status     = case when p_accept then 'accepted'::public.supplier_relationship_status
                           else 'rejected'::public.supplier_relationship_status end,
         decided_at = now(),
         decided_by = v_uid,
         note       = coalesce(v_note, note),
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all     on function public.supplier_relationship_decide(uuid, boolean, text) from public;
grant  execute on function public.supplier_relationship_decide(uuid, boolean, text) to authenticated;

comment on function public.supplier_relationship_decide(uuid, boolean, text) is
  'Spec S5 — counterparty accepts or rejects a pending partnership '
  'request. Only the side that did not initiate may decide.';

-- ----------------------------------------------------------------------
-- supplier_relationship_revoke(id) → void
-- ----------------------------------------------------------------------

create or replace function public.supplier_relationship_revoke(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_row    record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'id is required' using errcode = '22023';
  end if;

  select sr.id, sr.status,
         bh.claimed_by as bh_owner, f.claimed_by as factory_owner
    into v_row
    from public.supplier_relationships sr
    join public.suppliers bh on bh.id = sr.buying_house_id
    join public.suppliers f  on f.id  = sr.factory_id
   where sr.id = p_id;
  if not found then
    raise exception 'relationship not found' using errcode = '22023';
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'only accepted relationships can be revoked' using errcode = '22023';
  end if;
  if (v_row.bh_owner is null or v_row.bh_owner <> v_uid)
     and (v_row.factory_owner is null or v_row.factory_owner <> v_uid) then
    raise exception 'caller does not own either side' using errcode = '42501';
  end if;

  update public.supplier_relationships
     set status     = 'revoked',
         decided_at = now(),
         decided_by = v_uid,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all     on function public.supplier_relationship_revoke(uuid) from public;
grant  execute on function public.supplier_relationship_revoke(uuid) to authenticated;

comment on function public.supplier_relationship_revoke(uuid) is
  'Spec S5 — either claimed side may revoke an accepted partnership.';

-- ----------------------------------------------------------------------
-- supplier_relationship_list(p_supplier_id?, p_status?) → jsonb
--
-- Viewer-symmetric. Returns rows the caller can see (via one of the
-- two claimed sides) along with a `viewer_role` discriminator
-- ('buying_house' | 'factory') describing which side the caller owns
-- on this row, plus the counterparty supplier summary (no PII), the
-- raw `initiated_side`, status, and decision metadata. Filters by
-- p_supplier_id when provided (caller must own that supplier);
-- filters by p_status when provided.
-- ----------------------------------------------------------------------

create or replace function public.supplier_relationship_list(
  p_supplier_id uuid default null,
  p_status      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_status  public.supplier_relationship_status;
  v_out     jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  if p_status is not null and length(btrim(p_status)) > 0 then
    begin
      v_status := p_status::public.supplier_relationship_status;
    exception when others then
      raise exception 'invalid status filter' using errcode = '22023';
    end;
  end if;

  if p_supplier_id is not null then
    if not exists (
      select 1 from public.suppliers
       where id = p_supplier_id and claimed_by = v_uid
    ) then
      raise exception 'not your supplier' using errcode = '42501';
    end if;
  end if;

  with mine as (
    select id from public.suppliers where claimed_by = v_uid
  ),
  rows as (
    select sr.*,
           case when bh.claimed_by = v_uid then 'buying_house'
                else 'factory' end as viewer_role,
           bh.id   as bh_id,   bh.slug as bh_slug,   bh.company_name as bh_name,
           bh.city as bh_city, bh.district as bh_district,
           f.id    as f_id,    f.slug  as f_slug,    f.company_name  as f_name,
           f.city  as f_city,  f.district  as f_district
      from public.supplier_relationships sr
      join public.suppliers bh on bh.id = sr.buying_house_id
      join public.suppliers f  on f.id  = sr.factory_id
     where (
             bh.claimed_by = v_uid
          or f.claimed_by  = v_uid
           )
       and (p_supplier_id is null
            or sr.buying_house_id = p_supplier_id
            or sr.factory_id      = p_supplier_id)
       and (v_status is null or sr.status = v_status)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',              r.id,
        'status',          r.status::text,
        'viewer_role',     r.viewer_role,
        'initiated_side',  r.initiated_side,
        'initiated_by_me', (r.initiated_by = v_uid),
        'can_decide',
          (r.status = 'pending'
           and r.viewer_role <> r.initiated_side),
        'can_revoke',
          (r.status = 'accepted'),
        'note',            r.note,
        'decided_at',      r.decided_at,
        'created_at',      r.created_at,
        'updated_at',      r.updated_at,
        'buying_house', jsonb_build_object(
          'id',           r.bh_id,
          'slug',         r.bh_slug,
          'company_name', r.bh_name,
          'city',         r.bh_city,
          'district',     r.bh_district
        ),
        'factory', jsonb_build_object(
          'id',           r.f_id,
          'slug',         r.f_slug,
          'company_name', r.f_name,
          'city',         r.f_city,
          'district',     r.f_district
        )
      )
      order by r.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_out
  from rows r;

  return v_out;
end;
$$;

revoke all     on function public.supplier_relationship_list(uuid, text) from public;
grant  execute on function public.supplier_relationship_list(uuid, text) to authenticated;

comment on function public.supplier_relationship_list(uuid, text) is
  'Spec S5 — viewer-symmetric relationship list. Returns rows touching '
  'any supplier the caller claims, with viewer_role + counterparty '
  'summary (no PII).';

-- ----------------------------------------------------------------------
-- supplier_relationship_search(q, target_entity_type) → jsonb
--
-- Used by the partner request form. Returns published, non-sanctioned,
-- claimed suppliers of the requested entity_type whose company_name or
-- slug matches `q` (case-insensitive). Top 20. No PII columns.
-- ----------------------------------------------------------------------

create or replace function public.supplier_relationship_search(
  p_q                   text,
  p_target_entity_type  text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_q     text;
  v_et    text;
  v_out   jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  if v_q is null then
    return '[]'::jsonb;
  end if;
  v_et := nullif(btrim(coalesce(p_target_entity_type, '')), '');
  if v_et is null or v_et not in ('buying_house', 'factory') then
    raise exception 'target_entity_type must be buying_house or factory'
      using errcode = '22023';
  end if;
  if char_length(v_q) > 120 then
    v_q := substr(v_q, 1, 120);
  end if;

  with hits as (
    select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
           s.city, s.district
      from public.suppliers s
     where s.entity_type::text = v_et
       and s.is_published      = true
       and s.is_sanctioned     = false
       and s.claimed_by is not null
       and s.claimed_by <> v_uid
       and (s.company_name ilike '%' || v_q || '%'
            or s.slug      ilike '%' || v_q || '%')
     order by s.company_name
     limit 20
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',           h.id,
        'slug',         h.slug,
        'company_name', h.company_name,
        'entity_type',  h.entity_type,
        'city',         h.city,
        'district',     h.district
      )
      order by h.company_name
    ),
    '[]'::jsonb
  )
  into v_out
  from hits h;

  return v_out;
end;
$$;

revoke all     on function public.supplier_relationship_search(text, text) from public;
grant  execute on function public.supplier_relationship_search(text, text) to authenticated;

comment on function public.supplier_relationship_search(text, text) is
  'Spec S5 — typeahead search for the partner request form. Returns '
  'claimed, published, non-sanctioned suppliers of the target entity '
  'type matching the query (top 20, no PII).';

-- ----------------------------------------------------------------------
-- buyer_supplier_profile — surface partner factories / buying houses.
-- Preserves every existing key verbatim; adds two new arrays.
-- Only accepted relationships are exposed. No contact PII.
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
  'Buyer-facing factory profile (Spec B2; extended by S2 + S5). Adds '
  'partner_factories[] on buying_house pages and partner_buying_houses[] '
  'on factory pages. Both arrays only contain accepted relationships and '
  'never contain contact PII.';
