-- 0038_admin_supplier_admin.sql
--
-- Spec A2 — Admin supplier CRUD + bulk CSV import + score-recalc trigger.
-- Second Phase-4 admin spec; ships the admin-only editor surface on top
-- of the Phase-0 supplier moat without touching any ETL-managed field.
--
-- This migration introduces:
--   1. Four additive nullable columns on public.suppliers
--      (name_display, description, sanctioned_reason, notes_admin).
--      These are the admin-editable fields; everything else
--      (company_name / slug / contact PII / register IDs) stays
--      ETL-owned and is rejected by the editor RPC.
--   2. public.admin_audit_log — append-only audit trail for every admin
--      mutation. RLS on; no policies for authenticated; only the
--      SECURITY DEFINER RPCs in this file write to it.
--   3. public.score_recalc_jobs — queue table for SBI-score recalcs
--      requested from the editor. RLS on; reads/writes go through the
--      enqueue RPC only.
--   4. Four SECURITY DEFINER RPCs:
--        admin_supplier_list(search, entity_type, published, claimed,
--                            sanctioned, tier_min, limit, offset)
--        admin_supplier_get(id)
--        admin_supplier_update(id, patch)
--        admin_score_recalc_enqueue(supplier_id)
--      Each one role-checks inside the body and raises
--      insufficient_privilege (sqlstate 42501) for non-admin / anon.
--
-- Down (manual):
--   drop function public.admin_score_recalc_enqueue(uuid);
--   drop function public.admin_supplier_update(uuid, jsonb);
--   drop function public.admin_supplier_get(uuid);
--   drop function public.admin_supplier_list(text, text, boolean, boolean, boolean, int, int, int);
--   drop table public.score_recalc_jobs;
--   drop table public.admin_audit_log;
--   alter table public.suppliers drop column notes_admin,
--     drop column sanctioned_reason, drop column description,
--     drop column name_display;

-- ---------- 1. supplier editor columns -------------------------------------

alter table public.suppliers
  add column if not exists name_display      text,
  add column if not exists description       text,
  add column if not exists sanctioned_reason text,
  add column if not exists notes_admin       text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_name_display_len') then
    alter table public.suppliers
      add constraint suppliers_name_display_len
      check (name_display is null or length(name_display) <= 240);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_description_len') then
    alter table public.suppliers
      add constraint suppliers_description_len
      check (description is null or length(description) <= 8000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_sanctioned_reason_len') then
    alter table public.suppliers
      add constraint suppliers_sanctioned_reason_len
      check (sanctioned_reason is null or length(sanctioned_reason) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_notes_admin_len') then
    alter table public.suppliers
      add constraint suppliers_notes_admin_len
      check (notes_admin is null or length(notes_admin) <= 8000);
  end if;
end $$;

-- ---------- 2. admin_audit_log --------------------------------------------

create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references auth.users(id) on delete set null,
  action        text not null,
  target_table  text not null,
  target_id     uuid,
  patch         jsonb,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_actor
  on public.admin_audit_log (actor_id, created_at desc);
create index if not exists idx_admin_audit_log_target
  on public.admin_audit_log (target_table, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
-- No policies: every read/write goes through SECURITY DEFINER RPCs.

-- ---------- 3. score_recalc_jobs ------------------------------------------

create table if not exists public.score_recalc_jobs (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.suppliers(id) on delete cascade,
  requested_by  uuid not null references auth.users(id),
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz,
  status        text not null default 'pending'
                check (status in ('pending','running','done','failed')),
  error         text
);

create index if not exists idx_score_recalc_jobs_supplier
  on public.score_recalc_jobs (supplier_id, requested_at desc);
create index if not exists idx_score_recalc_jobs_pending
  on public.score_recalc_jobs (supplier_id) where processed_at is null;

alter table public.score_recalc_jobs enable row level security;
revoke all on public.score_recalc_jobs from anon, authenticated;

-- ---------- 4. RPCs --------------------------------------------------------

-- admin_supplier_list — paginated list with filters.
-- Returns jsonb { rows: [...], total }. Per-row keys are whitelisted;
-- per spec, sbi_total is the only SBI surface allowed and only here
-- (admin role; gated by the role check at the top of the body).
create or replace function public.admin_supplier_list(
  p_search      text    default null,
  p_entity_type text    default null,
  p_published   boolean default null,
  p_claimed     boolean default null,
  p_sanctioned  boolean default null,
  p_tier_min    int     default null,
  p_limit       int     default 50,
  p_offset      int     default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_q      text := nullif(btrim(coalesce(p_search, '')), '');
  v_qlike  text;
  v_limit  int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset int  := greatest(0, coalesce(p_offset, 0));
  v_out    jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  v_qlike := case when v_q is null then null else '%' || lower(v_q) || '%' end;

  -- Stage 1: cheap filters on suppliers only. tier_min is applied via a
  -- correlated subquery so the expensive source_records scan only fires
  -- when the caller asks for it (otherwise we never touch source_records
  -- during the count/page).
  with filtered as (
    select s.id,
           s.slug,
           s.company_name,
           s.name_display,
           s.entity_type::text as entity_type,
           s.is_published      as published,
           s.claimed_by,
           s.is_sanctioned     as sanctioned_flag,
           s.city,
           s.district,
           s.updated_at
      from public.suppliers s
     where (v_qlike       is null or s.company_name_norm ilike v_qlike or s.slug ilike v_qlike)
       and (p_entity_type is null or s.entity_type::text = p_entity_type)
       and (p_published   is null or s.is_published      = p_published)
       and (p_claimed     is null or (case when p_claimed then s.claimed_by is not null else s.claimed_by is null end))
       and (p_sanctioned  is null or s.is_sanctioned     = p_sanctioned)
       and (
         p_tier_min is null
         or (
           select count(distinct sr.source_id)
             from public.source_records sr
            where sr.supplier_id = s.id
              and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
              and sr.status = 'active'
         ) >= p_tier_min
       )
  ),
  page as (
    select f.*,
           (
             select count(distinct sr.source_id)::int
               from public.source_records sr
              where sr.supplier_id = f.id
                and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
                and sr.status = 'active'
           ) as tier_coverage,
           (select sb.total from public.sbi_scores sb where sb.supplier_id = f.id) as sbi_total,
           exists (
             select 1 from public.score_recalc_jobs j
              where j.supplier_id = f.id and j.processed_at is null
           ) as has_pending_rescore
      from filtered f
     order by f.updated_at desc nulls last, f.company_name
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                  p.id,
        'slug',                p.slug,
        'company_name',        p.company_name,
        'name_display',        p.name_display,
        'entity_type',         p.entity_type,
        'published',           p.published,
        'claimed_by',          p.claimed_by,
        'sanctioned_flag',     p.sanctioned_flag,
        'city',                p.city,
        'district',            p.district,
        'tier_coverage',       p.tier_coverage,
        'sbi_total',           p.sbi_total,
        'updated_at',          p.updated_at,
        'has_pending_rescore', p.has_pending_rescore
      ) order by p.updated_at desc nulls last, p.company_name)
      from page p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_supplier_list(text, text, boolean, boolean, boolean, int, int, int) is
  'Spec A2 — admin-only supplier list. Filters: search (slug/name_norm), '
  'entity_type, published, claimed, sanctioned, tier_min (≥N distinct '
  'Tier1-3 active source_records). Per-row sbi_total surfaced for admin '
  'triage; never exposed elsewhere.';

revoke all     on function public.admin_supplier_list(text, text, boolean, boolean, boolean, int, int, int) from public;
grant  execute on function public.admin_supplier_list(text, text, boolean, boolean, boolean, int, int, int) to authenticated;

-- admin_supplier_get — single-supplier editor payload.
-- Hand-built supplier object (NO PII / NO contact fields / NO body_ciphertext).
create or replace function public.admin_supplier_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_out  jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_id is null then
    raise exception 'id required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'supplier', jsonb_build_object(
      'id',                s.id,
      'slug',              s.slug,
      'company_name',      s.company_name,
      'name_display',      s.name_display,
      'description',       s.description,
      'entity_type',       s.entity_type::text,
      'published',         s.is_published,
      'claimed_by',        s.claimed_by,
      'sanctioned_flag',   s.is_sanctioned,
      'sanctioned_reason', s.sanctioned_reason,
      'notes_admin',       s.notes_admin,
      'city',              s.city,
      'district',          s.district,
      'country',           s.country,
      'address_raw',       s.address_raw,
      'website',           s.website,
      'parent_group_name', s.parent_group_name,
      'source_tags',       s.source_tags,
      'completeness_pct',  s.completeness_pct,
      'sbi_total',         sb.total,
      'created_at',        s.created_at,
      'updated_at',        s.updated_at
    ),
    'source_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',          sr.id,
        'source_code', src.code,
        'source_tier', sr.source_tier::text,
        'source_ref',  sr.source_ref,
        'fetched_at',  sr.fetched_at,
        'status',      sr.status::text
      ) order by sr.fetched_at desc nulls last)
      from public.source_records sr
      join public.sources src on src.id = sr.source_id
      where sr.supplier_id = s.id
    ), '[]'::jsonb),
    'certifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',             c.id,
        'kind',           c.kind::text,
        'certificate_no', c.certificate_no,
        'issuer',         c.issuer,
        'issued_on',      c.issued_on,
        'expires_on',     c.expires_on,
        'scope',          c.scope,
        'document_url',   c.document_url
      ) order by c.expires_on desc nulls last)
      from public.certifications c
      where c.supplier_id = s.id
    ), '[]'::jsonb),
    'verification_queue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           v.id,
        'queue_type',   v.queue_type::text,
        'confidence',   v.confidence,
        'admin_action', v.admin_action,
        'reviewed_at',  v.reviewed_at,
        'created_at',   v.created_at
      ) order by v.created_at desc)
      from public.verification_queue v
      where v.supplier_a_id = s.id
    ), '[]'::jsonb),
    'recent_audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',         a.id,
        'action',     a.action,
        'patch',      a.patch,
        'metadata',   a.metadata,
        'created_at', a.created_at,
        'actor_id',   a.actor_id
      ) order by a.created_at desc)
      from (
        select * from public.admin_audit_log
         where target_table = 'suppliers' and target_id = s.id
         order by created_at desc limit 25
      ) a
    ), '[]'::jsonb),
    'pending_rescore_count', (
      select count(*)::int from public.score_recalc_jobs j
       where j.supplier_id = s.id and j.processed_at is null
    )
  ) into v_out
  from public.suppliers s
  left join public.sbi_scores sb on sb.supplier_id = s.id
  where s.id = p_id;

  return v_out;  -- null when supplier not found
end;
$$;

comment on function public.admin_supplier_get(uuid) is
  'Spec A2 — admin-only single-supplier editor payload. Hand-built '
  'supplier object excludes contact PII (email_primary/phones/contact_*); '
  'those remain ETL-owned. Carries sbi_total (admin role only).';

revoke all     on function public.admin_supplier_get(uuid) from public;
grant  execute on function public.admin_supplier_get(uuid) to authenticated;

-- admin_supplier_update — mutate whitelisted columns only; one audit row.
create or replace function public.admin_supplier_update(
  p_id    uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_allowed text[] := array[
    'name_display','description','entity_type',
    'published','sanctioned_flag','sanctioned_reason','notes_admin'
  ];
  v_key     text;
  v_entity  text;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_id is null then
    raise exception 'id required' using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_patch)) = 0 then
    raise exception 'patch is empty' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'field % is not editable', v_key using errcode = '22023';
    end if;
  end loop;

  if p_patch ? 'entity_type' then
    v_entity := p_patch->>'entity_type';
    if v_entity is null
       or v_entity not in ('factory','buying_house','unknown') then
      raise exception 'entity_type must be factory|buying_house|unknown'
        using errcode = '22023';
    end if;
  end if;

  if not exists (select 1 from public.suppliers where id = p_id) then
    raise exception 'supplier not found' using errcode = 'P0002';
  end if;

  update public.suppliers s set
    name_display = case when p_patch ? 'name_display'
                        then nullif(btrim(coalesce(p_patch->>'name_display','')), '')
                        else s.name_display end,
    description  = case when p_patch ? 'description'
                        then nullif(btrim(coalesce(p_patch->>'description','')), '')
                        else s.description end,
    entity_type  = case when p_patch ? 'entity_type'
                        then (p_patch->>'entity_type')::entity_type
                        else s.entity_type end,
    is_published = case when p_patch ? 'published'
                        then (p_patch->>'published')::boolean
                        else s.is_published end,
    is_sanctioned = case when p_patch ? 'sanctioned_flag'
                         then (p_patch->>'sanctioned_flag')::boolean
                         else s.is_sanctioned end,
    sanctioned_reason = case when p_patch ? 'sanctioned_reason'
                              then nullif(btrim(coalesce(p_patch->>'sanctioned_reason','')), '')
                              else s.sanctioned_reason end,
    notes_admin = case when p_patch ? 'notes_admin'
                       then nullif(btrim(coalesce(p_patch->>'notes_admin','')), '')
                       else s.notes_admin end,
    updated_at = now()
   where id = p_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch)
  values (v_uid, 'admin_supplier_update', 'suppliers', p_id, p_patch);

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

comment on function public.admin_supplier_update(uuid, jsonb) is
  'Spec A2 — admin-only supplier mutation. Patch keys whitelisted to '
  '(name_display, description, entity_type, published, sanctioned_flag, '
  'sanctioned_reason, notes_admin); any other key raises 22023. '
  'Writes one admin_audit_log row per call.';

revoke all     on function public.admin_supplier_update(uuid, jsonb) from public;
grant  execute on function public.admin_supplier_update(uuid, jsonb) to authenticated;

-- admin_score_recalc_enqueue — request an SBI recompute for one supplier.
create or replace function public.admin_score_recalc_enqueue(p_supplier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_job_id uuid;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_supplier_id is null then
    raise exception 'supplier_id required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'supplier not found' using errcode = 'P0002';
  end if;

  insert into public.score_recalc_jobs (supplier_id, requested_by)
       values (p_supplier_id, v_uid)
    returning id into v_job_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    v_uid,
    'admin_score_recalc_enqueue',
    'suppliers',
    p_supplier_id,
    jsonb_build_object('job_id', v_job_id)
  );

  return jsonb_build_object('job_id', v_job_id, 'status', 'pending');
end;
$$;

comment on function public.admin_score_recalc_enqueue(uuid) is
  'Spec A2 — admin-only enqueue of an SBI recompute. Writes one row to '
  'score_recalc_jobs (status=pending) plus one admin_audit_log entry.';

revoke all     on function public.admin_score_recalc_enqueue(uuid) from public;
grant  execute on function public.admin_score_recalc_enqueue(uuid) to authenticated;
