-- 0039_admin_cert_verification.sql
--
-- Spec A3 — Certification verification queue.
-- Third Phase-4 admin spec. Admin reviews supplier-uploaded
-- certifications enqueued in public.verification_queue with
-- queue_type='cert_doc_review' and either approves (flips
-- certifications.verified=true) or rejects (soft-deletes the cert with
-- a reason). Every decision writes one admin_audit_log row and closes
-- the queue row inside the same transaction.
--
-- This migration introduces:
--   1. Four additive nullable columns on public.certifications
--      (verified bool NOT NULL default false, rejected_at timestamptz,
--      rejected_reason text ≤2000, uploaded_by → auth.users on delete
--      set null).
--   2. Two SECURITY DEFINER RPCs:
--        admin_cert_queue_list(status, kind, limit, offset)
--        admin_cert_decide(queue_id, decision, reason)
--      Each role-checks inside the body and raises
--      insufficient_privilege (sqlstate 42501) for non-admin / anon.
--
-- Down (manual):
--   drop function public.admin_cert_decide(uuid, text, text);
--   drop function public.admin_cert_queue_list(text, text, int, int);
--   alter table public.certifications drop column uploaded_by,
--     drop column rejected_reason, drop column rejected_at,
--     drop column verified;

-- ---------- 1. certifications columns -------------------------------------

alter table public.certifications
  add column if not exists verified         boolean not null default false,
  add column if not exists rejected_at      timestamptz,
  add column if not exists rejected_reason  text,
  add column if not exists uploaded_by      uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'certifications_rejected_reason_len') then
    alter table public.certifications
      add constraint certifications_rejected_reason_len
      check (rejected_reason is null or length(rejected_reason) <= 2000);
  end if;
end $$;

-- ---------- 2. RPCs --------------------------------------------------------

-- admin_cert_queue_list — paginated cert-doc-review queue.
-- Returns jsonb { total, rows: [...] }. Admin-only; in-body role check.
create or replace function public.admin_cert_queue_list(
  p_status text default 'open',
  p_kind   text default null,
  p_limit  int  default 50,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_status text := lower(coalesce(p_status, 'open'));
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
  if v_status not in ('open','reviewed','all') then
    raise exception 'status must be open|reviewed|all' using errcode = '22023';
  end if;

  with filtered as (
    select
      q.id                                                       as queue_id,
      q.created_at                                               as queue_created_at,
      q.reviewed_at                                              as reviewed_at,
      q.admin_action                                             as admin_action,
      (q.source_data->>'certification_id')::uuid                 as cert_id
      from public.verification_queue q
     where q.queue_type = 'cert_doc_review'
       and (v_status = 'all'
            or (v_status = 'open'     and q.reviewed_at is null)
            or (v_status = 'reviewed' and q.reviewed_at is not null))
       and (q.source_data ? 'certification_id')
  ),
  joined as (
    select f.*,
           c.kind::text     as cert_kind,
           c.certificate_no as cert_no,
           c.issuer         as cert_issuer,
           c.issued_on      as cert_issued_on,
           c.expires_on     as cert_expires_on,
           c.scope          as cert_scope,
           c.document_url   as cert_document_url,
           c.verified       as cert_verified,
           c.rejected_at    as cert_rejected_at,
           c.rejected_reason as cert_rejected_reason,
           c.uploaded_by    as cert_uploaded_by,
           s.id             as supplier_id,
           s.slug           as supplier_slug,
           s.company_name   as supplier_company_name,
           s.entity_type::text as supplier_entity_type,
           u.email          as uploaded_by_email
      from filtered f
      join public.certifications c on c.id = f.cert_id
      join public.suppliers      s on s.id = c.supplier_id
      left join auth.users       u on u.id = c.uploaded_by
     where (p_kind is null or c.kind::text = p_kind)
  ),
  page as (
    select * from joined
     order by queue_created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from joined),
    'rows',  coalesce((
      select jsonb_agg(jsonb_build_object(
        'queue_id',          p.queue_id,
        'queue_created_at',  p.queue_created_at,
        'reviewed_at',       p.reviewed_at,
        'admin_action',      p.admin_action,
        'cert', jsonb_build_object(
          'id',              p.cert_id,
          'kind',            p.cert_kind,
          'certificate_no',  p.cert_no,
          'issuer',          p.cert_issuer,
          'issued_on',       p.cert_issued_on,
          'expires_on',      p.cert_expires_on,
          'scope',           p.cert_scope,
          'document_url',    p.cert_document_url,
          'verified',        p.cert_verified,
          'rejected_at',     p.cert_rejected_at,
          'rejected_reason', p.cert_rejected_reason
        ),
        'supplier', jsonb_build_object(
          'id',           p.supplier_id,
          'slug',         p.supplier_slug,
          'company_name', p.supplier_company_name,
          'entity_type',  p.supplier_entity_type
        ),
        'uploaded_by_email', p.uploaded_by_email
      ) order by p.queue_created_at desc)
      from page p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.admin_cert_queue_list(text, text, int, int) is
  'Spec A3 — admin-only certification verification queue listing. Joins '
  'verification_queue (cert_doc_review) → certifications → suppliers. '
  'No PII keys leak (no email_primary/phones/contact_*); uploaded_by_email '
  'is admin-only context per spec.';

revoke all     on function public.admin_cert_queue_list(text, text, int, int) from public;
grant  execute on function public.admin_cert_queue_list(text, text, int, int) to authenticated;

-- admin_cert_decide — approve or reject a queued cert. Single transaction:
-- mutates the cert, closes the queue row, writes one admin_audit_log row.
create or replace function public.admin_cert_decide(
  p_queue_id uuid,
  p_decision text,
  p_reason   text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_decision  text := lower(coalesce(p_decision, ''));
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_cert_id   uuid;
  v_supp_id   uuid;
  v_reviewed  timestamptz;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_queue_id is null then
    raise exception 'queue_id required' using errcode = '22023';
  end if;
  if v_decision not in ('approve','reject') then
    raise exception 'decision must be approve|reject' using errcode = '22023';
  end if;
  if v_decision = 'reject' and v_reason is null then
    raise exception 'reason required when rejecting' using errcode = '22023';
  end if;

  select (q.source_data->>'certification_id')::uuid, q.reviewed_at
    into v_cert_id, v_reviewed
    from public.verification_queue q
   where q.id = p_queue_id
     and q.queue_type = 'cert_doc_review'
   for update;

  if v_cert_id is null then
    raise exception 'queue row not found' using errcode = 'P0002';
  end if;
  if v_reviewed is not null then
    raise exception 'queue row already decided' using errcode = 'P0002';
  end if;

  select supplier_id into v_supp_id from public.certifications where id = v_cert_id;
  if v_supp_id is null then
    raise exception 'certification not found' using errcode = 'P0002';
  end if;

  if v_decision = 'approve' then
    update public.certifications
       set verified        = true,
           rejected_at     = null,
           rejected_reason = null
     where id = v_cert_id;
  else
    update public.certifications
       set verified        = false,
           rejected_at     = now(),
           rejected_reason = v_reason
     where id = v_cert_id;
  end if;

  update public.verification_queue
     set reviewed_at  = now(),
         reviewed_by  = v_uid,
         admin_action = v_decision::queue_action
   where id = p_queue_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'admin_cert_decide',
    'certifications',
    v_cert_id,
    jsonb_build_object('decision', v_decision, 'reason', v_reason),
    jsonb_build_object('queue_id', p_queue_id, 'supplier_id', v_supp_id)
  );

  return jsonb_build_object(
    'ok',               true,
    'queue_id',         p_queue_id,
    'certification_id', v_cert_id,
    'decision',         v_decision
  );
end;
$$;

comment on function public.admin_cert_decide(uuid, text, text) is
  'Spec A3 — admin-only cert decision. approve flips '
  'certifications.verified=true; reject sets rejected_at/rejected_reason '
  '(reason required). Closes the queue row and writes one '
  'admin_audit_log entry inside the same transaction.';

revoke all     on function public.admin_cert_decide(uuid, text, text) from public;
grant  execute on function public.admin_cert_decide(uuid, text, text) to authenticated;
