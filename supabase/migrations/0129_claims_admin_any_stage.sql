-- 0129 — Supplier claims: who is claiming, a decision at any stage with a reason, and resend the link (6 Oct 2026).
--
-- Plan: .impeccable/handoff-admin-moderation.md, build item 0e (Claims).
--
-- WHY
-- ---
-- Three claims sat at the email step with no way to see why or to move them. The admin queue (0032)
-- listed only `email_verified` claims by default, named the claimant by email with no link to their
-- account, could decide only a verified claim, could not resend the link, and the verification email
-- went out through a sender that journaled nothing, so a failed send was invisible. A claim whose
-- link was never clicked stays `pending_email` for ever: claim_verify_email flips it to `expired`
-- only when someone clicks after the 24 hours.
--
-- WHAT
-- ----
--   1. claim_admin_list gains `claimant_user_id` (the link to the user file), `token_expires_at`,
--      `link_expired`, and `email`: the last row of the email journal for this claim (email_log,
--      ref_id = the claim id; the route now sends through the journaled sender). New filters
--      `open` (pending_email + email_verified) and `pending_email`.
--   2. claim_admin_decide accepts a claim at any open stage (pending_email, email_verified,
--      expired). A reason is required to reject, and to approve a claim whose email was never
--      verified. Every decision writes an admin_audit_log row.
--   3. claim_admin_resend(claim) issues a fresh token (24 hours), revives an expired claim to
--      pending_email, writes an audit row, and returns the raw token exactly once for the route to
--      email.
--   4. rl_check accepts the `email:claim_verify` bucket (0119's patch pattern), so the claim email
--      is rate-limited per recipient like every other template.
--
-- Hard invariants honoured: admin-only, checked in each body; writes through SECURITY DEFINER with a
-- pinned search_path; anon revoked by name; the raw token leaves the database once, to the route.
--
-- Dry run: ops/plans/0129-dry-run.md (ops/dry_run_0129_claims.py).
--
-- REVERSE
-- -------
--   drop function public.claim_admin_resend(uuid);
--   restore claim_admin_list(text) and claim_admin_decide(uuid, boolean, text) from 0032_supplier_claims.sql;
--   re-run the rl_check patch with 'email:claim_verify' removed.

set search_path = public;

-- ----------------------------------------------------------------------
-- 4. rl_check knows the claim email's bucket
-- ----------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure);
  v_new text := v_def;
begin
  if position('''email:claim_verify''' in v_new) = 0 then
    if position('''email:password_reset''' in v_new) = 0 then
      raise exception 'rl_check has no email:password_reset anchor; patch by hand';
    end if;
    v_new := replace(v_new, '''email:password_reset''', '''email:password_reset'', ''email:claim_verify''');
  end if;
  if position('''email:claim_verify''' in v_new) = 0 then
    raise exception 'rl_check patch did not add email:claim_verify';
  end if;
  if v_new <> v_def then
    execute v_new;
  end if;
end
$$;

-- ----------------------------------------------------------------------
-- 1. claim_admin_list
-- ----------------------------------------------------------------------

create or replace function public.claim_admin_list(p_status text default 'email_verified')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_st   text := coalesce(nullif(btrim(p_status), ''), 'email_verified');
  v_out  jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise exception 'caller is not an admin' using errcode = '42501';
  end if;
  if v_st not in ('open','pending_email','email_verified','approved','rejected','expired','cancelled','all') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;

  with rows as (
    select cr.id,
           cr.status::text  as status,
           cr.method::text  as method,
           cr.proof_email,
           cr.note,
           cr.created_at,
           cr.email_verified_at,
           cr.decided_at,
           cr.decision_note,
           cr.token_expires_at,
           (cr.status = 'pending_email'
            and cr.token_expires_at is not null
            and cr.token_expires_at < now())   as link_expired,
           cr.claimant_user_id,
           u.email           as claimant_email,
           (select jsonb_build_object(
                     'status',   e.status,
                     'error',    e.error,
                     'sent_at',  e.sent_at,
                     'template', e.template)
              from public.email_log e
             where e.ref_id = cr.id::text
             order by e.sent_at desc
             limit 1)        as email,
           jsonb_build_object(
             'id',           s.id,
             'slug',         s.slug,
             'company_name', s.company_name,
             'entity_type',  s.entity_type::text,
             'city',         s.city,
             'district',     s.district,
             'website',      s.website
           ) as supplier
      from public.claim_requests cr
      join public.suppliers s on s.id = cr.supplier_id
      join auth.users u       on u.id = cr.claimant_user_id
     where v_st = 'all'
        or (v_st = 'open' and cr.status in ('pending_email', 'email_verified'))
        or cr.status::text = v_st
     order by cr.created_at desc
     limit 200
  )
  select jsonb_build_object(
    'status',  v_st,
    'total',   coalesce((select count(*) from rows), 0),
    'results', coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
  )
    into v_out
    from rows r;

  return v_out;
end;
$$;

comment on function public.claim_admin_list(text) is
  '0129: admin-only claim queue. open = pending_email + email_verified. Each row carries the claimant''s '
  'user id, whether the link expired, and the last email journal row for the claim.';

revoke all     on function public.claim_admin_list(text) from public, anon, authenticated;
grant  execute on function public.claim_admin_list(text) to authenticated;

-- ----------------------------------------------------------------------
-- 2. claim_admin_decide: any open stage, a reason where the proof is missing
-- ----------------------------------------------------------------------

create or replace function public.claim_admin_decide(
  p_claim_id uuid,
  p_approve  boolean,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_claim     record;
  v_now       timestamptz := now();
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_new_state public.claim_status;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise exception 'caller is not an admin' using errcode = '42501';
  end if;
  if p_claim_id is null then
    raise exception 'claim id is required' using errcode = '22023';
  end if;
  if p_approve is null then
    raise exception 'approve must be true or false' using errcode = '22023';
  end if;

  select id, supplier_id, claimant_user_id, status, method
    into v_claim
    from public.claim_requests
   where id = p_claim_id
   for update;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_claim.status not in ('pending_email', 'email_verified', 'expired') then
    raise exception 'claim is not open for a decision' using errcode = '42501';
  end if;
  if not p_approve and v_note is null then
    raise exception 'a reason is required to reject' using errcode = '22023';
  end if;
  if p_approve and v_claim.status <> 'email_verified' and v_note is null then
    raise exception 'a reason is required to approve a claim whose email was never verified'
      using errcode = '22023';
  end if;

  if p_approve then
    if exists (
      select 1 from public.suppliers s
       where s.id = v_claim.supplier_id and s.claimed_by is not null
    ) then
      raise exception 'supplier is already claimed' using errcode = '42501';
    end if;
    update public.suppliers
       set claimed_by = v_claim.claimant_user_id,
           updated_at = v_now
     where id = v_claim.supplier_id and claimed_by is null;
    v_new_state := 'approved';
  else
    v_new_state := 'rejected';
  end if;

  update public.claim_requests
     set status                  = v_new_state,
         decided_at              = v_now,
         decided_by              = v_uid,
         decision_note           = v_note,
         verification_token_hash = null,
         updated_at              = v_now
   where id = p_claim_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'claim_admin_decide',
    'claim_requests',
    p_claim_id,
    jsonb_build_object('from', v_claim.status::text, 'to', v_new_state::text, 'note', v_note),
    jsonb_build_object('supplier_id', v_claim.supplier_id, 'claimant_user_id', v_claim.claimant_user_id,
                       'method', v_claim.method::text)
  );

  return jsonb_build_object(
    'claim_id', p_claim_id,
    'status',   v_new_state::text
  );
end;
$$;

comment on function public.claim_admin_decide(uuid, boolean, text) is
  '0129: admin approves or rejects a claim at any open stage. A reason is required to reject, and to '
  'approve a claim whose email was never verified. One admin_audit_log row per decision.';

revoke all     on function public.claim_admin_decide(uuid, boolean, text) from public, anon, authenticated;
grant  execute on function public.claim_admin_decide(uuid, boolean, text) to authenticated;

-- ----------------------------------------------------------------------
-- 3. claim_admin_resend: a fresh link, once
-- ----------------------------------------------------------------------

create or replace function public.claim_admin_resend(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_role       text;
  v_claim      record;
  v_now        timestamptz := now();
  v_token_raw  text;
  v_token_hash text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise exception 'caller is not an admin' using errcode = '42501';
  end if;
  if p_claim_id is null then
    raise exception 'claim id is required' using errcode = '22023';
  end if;

  select cr.id, cr.supplier_id, cr.claimant_user_id, cr.proof_email, cr.method, cr.status,
         s.company_name, s.claimed_by
    into v_claim
    from public.claim_requests cr
    join public.suppliers s on s.id = cr.supplier_id
   where cr.id = p_claim_id
   for update of cr;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_claim.status not in ('pending_email', 'expired') then
    raise exception 'claim is not waiting for its email' using errcode = '42501';
  end if;
  if v_claim.claimed_by is not null then
    raise exception 'supplier is already claimed' using errcode = '42501';
  end if;

  v_token_raw  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_raw, 'sha256'), 'hex');

  update public.claim_requests
     set status                  = 'pending_email',
         verification_token_hash = v_token_hash,
         token_expires_at        = v_now + interval '24 hours',
         updated_at              = v_now
   where id = p_claim_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'claim_admin_resend',
    'claim_requests',
    p_claim_id,
    jsonb_build_object('from', v_claim.status::text, 'to', 'pending_email', 'expires_at', v_now + interval '24 hours'),
    jsonb_build_object('supplier_id', v_claim.supplier_id, 'claimant_user_id', v_claim.claimant_user_id)
  );

  return jsonb_build_object(
    'claim_id',           p_claim_id,
    'method',             v_claim.method::text,
    'verification_token', v_token_raw,
    'expires_at',         v_now + interval '24 hours',
    'proof_email',        v_claim.proof_email,
    'supplier', jsonb_build_object(
      'id',           v_claim.supplier_id,
      'company_name', v_claim.company_name
    )
  );
end;
$$;

comment on function public.claim_admin_resend(uuid) is
  '0129: admin issues a fresh 24-hour verification token for a pending or expired claim. The raw token is '
  'returned once, for the route to email; only its sha256 is stored.';

revoke all     on function public.claim_admin_resend(uuid) from public, anon, authenticated;
grant  execute on function public.claim_admin_resend(uuid) to authenticated;
