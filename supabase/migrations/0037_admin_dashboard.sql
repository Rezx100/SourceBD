-- 0037 — Admin dashboard RPC (Spec A1, Phase 4).
--
-- First admin surface beyond the S1 claim-queue stub. Single
-- SECURITY DEFINER function that aggregates platform stats for the
-- `/admin` overview page. Aggregate counts only — no per-supplier rows,
-- no SBI numerics, no contact PII, no message bodies. The same forbidden
-- key set enforced by every prior buyer/supplier RPC applies here
-- (smoke step (e) re-asserts).
--
-- Role check lives in the function body, not RLS, so it raises a
-- crisp `insufficient_privilege` (sqlstate 42501) for non-admin and anon
-- callers rather than silently returning an empty payload. Pattern
-- mirrors `claim_admin_list` / other Phase-3 admin RPCs.
--
-- Reversible:
--   drop function public.admin_dashboard();

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_users         jsonb;
  v_suppliers    jsonb;
  v_rfqs          jsonb;
  v_messages      jsonb;
  v_saved         jsonb;
  v_queues        jsonb;
  v_data_moat     jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;

  select p.role::text into v_role
    from public.profiles p
   where p.id = v_uid;

  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;

  -- ------------------------------------------------------------------
  -- USERS — auth.users for signups window (canonical created_at);
  -- profiles for role breakdown.
  -- ------------------------------------------------------------------
  with by_role as (
    select role::text as role, count(*)::bigint as n
      from public.profiles
     group by role
  )
  select jsonb_build_object(
    'total',       (select count(*) from auth.users),
    'by_role',     coalesce((select jsonb_object_agg(role, n) from by_role), '{}'::jsonb),
    'signups_7d',  (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days')
  ) into v_users;

  -- ------------------------------------------------------------------
  -- SUPPLIERS — totals, publication state, claim state, entity-type
  -- breakdown, tier-source coverage.
  -- ------------------------------------------------------------------
  with by_entity as (
    select entity_type::text as et, count(*)::bigint as n
      from public.suppliers
     group by entity_type
  ),
  per_supplier_tiers as (
    select
      s.id,
      count(distinct sr.source_id)
        filter (where sr.source_tier = 'tier1_gov'      and sr.status = 'active') as t1c,
      count(distinct sr.source_id)
        filter (where sr.source_tier = 'tier2_industry' and sr.status = 'active') as t2c,
      count(distinct sr.source_id)
        filter (where sr.source_tier = 'tier3_cert'     and sr.status = 'active') as t3c,
      count(distinct sr.source_id)
        filter (where sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
                  and sr.status = 'active') as t13c
    from public.suppliers s
    left join public.source_records sr on sr.supplier_id = s.id
    group by s.id
  )
  select jsonb_build_object(
    'total',           (select count(*) from public.suppliers),
    'published',       (select count(*) from public.suppliers where is_published   = true),
    'claimed',         (select count(*) from public.suppliers where claimed_by    is not null),
    'sanctioned',      (select count(*) from public.suppliers where is_sanctioned = true),
    'by_entity_type',  coalesce((select jsonb_object_agg(et, n) from by_entity), '{}'::jsonb),
    'tier_coverage', jsonb_build_object(
      'has_tier1',     (select count(*) from per_supplier_tiers where t1c  >= 1),
      'has_tier2',     (select count(*) from per_supplier_tiers where t2c  >= 1),
      'has_tier3',     (select count(*) from per_supplier_tiers where t3c  >= 1),
      'tier13_ge_1',   (select count(*) from per_supplier_tiers where t13c >= 1),
      'tier13_ge_2',   (select count(*) from per_supplier_tiers where t13c >= 2),
      'tier13_ge_3',   (select count(*) from per_supplier_tiers where t13c >= 3)
    )
  ) into v_suppliers;

  -- ------------------------------------------------------------------
  -- RFQS — open count plus accepted/closed activity in the last 30d.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
    'open',         (select count(*) from public.rfqs where status = 'open'),
    'accepted_30d', (select count(*) from public.rfqs
                      where status = 'accepted'
                        and updated_at >= now() - interval '30 days'),
    'closed_30d',   (select count(*) from public.rfqs
                      where status = 'closed'
                        and updated_at >= now() - interval '30 days')
  ) into v_rfqs;

  -- ------------------------------------------------------------------
  -- MESSAGES — thread count + 7d message volume. NEVER reads
  -- `body_ciphertext` (which is REVOKE'd from authenticated anyway).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
    'threads',     (select count(*) from public.message_threads),
    'messages_7d', (select count(*) from public.messages
                     where created_at >= now() - interval '7 days')
  ) into v_messages;

  -- ------------------------------------------------------------------
  -- SAVED suppliers — total across all owners.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
    'total', (select count(*) from public.saved_suppliers)
  ) into v_saved;

  -- ------------------------------------------------------------------
  -- QUEUES — claim review, sanctions hits, verification queue depths
  -- by queue_type.
  -- ------------------------------------------------------------------
  with vq_open as (
    select queue_type::text as qt, count(*)::bigint as n
      from public.verification_queue
     where reviewed_at is null
     group by queue_type
  )
  select jsonb_build_object(
    'claims_pending',
      (select count(*) from public.claim_requests
        where status in ('pending_email','email_verified')),
    'sanctions_active',
      (select count(*) from public.sanctions_screening where active = true),
    'verification_queue_total',
      (select count(*) from public.verification_queue where reviewed_at is null),
    'verification_queue_by_type',
      coalesce((select jsonb_object_agg(qt, n) from vq_open), '{}'::jsonb)
  ) into v_queues;

  -- ------------------------------------------------------------------
  -- DATA MOAT — source_records by source code, certifications by kind,
  -- compliance_documents count + bytes mirrored.
  -- ------------------------------------------------------------------
  with by_source as (
    select s.code as code, count(*)::bigint as n
      from public.source_records sr
      join public.sources s on s.id = sr.source_id
     where sr.status = 'active'
     group by s.code
  ),
  by_cert as (
    select c.kind::text as kind, count(*)::bigint as n
      from public.certifications c
     group by c.kind
  )
  select jsonb_build_object(
    'source_records_by_source',
      coalesce((select jsonb_agg(
                  jsonb_build_object('code', code, 'count', n)
                  order by n desc
                ) from by_source), '[]'::jsonb),
    'certifications_by_kind',
      coalesce((select jsonb_agg(
                  jsonb_build_object('kind', kind, 'count', n)
                  order by n desc
                ) from by_cert), '[]'::jsonb),
    'compliance_documents', jsonb_build_object(
      'count',       (select count(*) from public.compliance_documents),
      'total_bytes', coalesce(
                       (select sum(file_size)::bigint
                          from public.compliance_documents),
                       0::bigint)
    )
  ) into v_data_moat;

  return jsonb_build_object(
    'users',           v_users,
    'suppliers',       v_suppliers,
    'rfqs',            v_rfqs,
    'messages',        v_messages,
    'saved_suppliers', v_saved,
    'queues',          v_queues,
    'data_moat',       v_data_moat,
    'generated_at',    now()
  );
end;
$$;

comment on function public.admin_dashboard() is
  'Spec A1 admin overview RPC. Role-checks via public.profiles.role inside '
  'the function body (raises insufficient_privilege for non-admin and anon). '
  'Aggregate counts only — never serialises SBI numerics, contact PII or '
  'message bodies.';

revoke all  on function public.admin_dashboard() from public;
grant execute on function public.admin_dashboard() to authenticated;
