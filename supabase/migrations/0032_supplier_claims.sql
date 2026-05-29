-- 0032 — Supplier Claim Flow (Spec S1, Phase 3).
--
-- First supplier-portal spec per `context/phases.md` line 76:
--   "/supplier/claim → search company → email verification → admin approval"
--
-- A signed-in supplier-role user searches the directory, picks a company,
-- supplies a proof email, and clicks a verification link delivered by
-- Resend. If the proof-email domain matches the supplier's published
-- website host OR its `email_primary` domain, the verified click also
-- auto-approves the claim and writes `suppliers.claimed_by` in the same
-- statement. Otherwise the verified claim queues for admin review at
-- `/admin/claims`; an admin approval is what writes `claimed_by`.
--
-- Hard rules honoured:
--   * "No Tier 6 record enters the DB alone" applies to the source-trust
--     hierarchy and does not gate self-claim — but the only DB mutation a
--     successful claim performs is `suppliers.claimed_by`, which carries no
--     attestation about the supplier's facts. Provenance pillars are
--     untouched.
--   * Server enforces auth + ownership. Every write is `security definer
--     set search_path = public` with `auth.uid()` checks; reads go through
--     RLS SELECT policies.
--   * No PII surfaced outside the admin queue. `claim_list_mine` returns
--     the claimant's own rows (they already know their own email); the
--     admin queue surfaces claimant email (auth.users.email) + proof email
--     only to admin-role callers.
--   * Verification token stored hashed only (`encode(digest(t,'sha256'),
--     'hex')`). The raw token is returned exactly once from
--     `claim_initiate` to the API route, which hands it to Resend.
--
-- Reversible:
--   drop function public.claim_admin_decide(uuid, boolean, text);
--   drop function public.claim_admin_list(text);
--   drop function public.claim_cancel(uuid);
--   drop function public.claim_list_mine();
--   drop function public.claim_verify_email(text);
--   drop function public.claim_initiate(uuid, text, text);
--   drop function public.claim_search(text);
--   drop table public.claim_requests;
--   drop type  public.claim_method;
--   drop type  public.claim_status;

-- ----------------------------------------------------------------------
-- enums
-- ----------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_status') then
    create type public.claim_status as enum (
      'pending_email',   -- token issued, awaiting click
      'email_verified',  -- token consumed; awaiting admin (manual_review only)
      'approved',        -- claimed_by written
      'rejected',        -- admin denied
      'expired',         -- token TTL elapsed without verification
      'cancelled'        -- claimant withdrew
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_method') then
    create type public.claim_method as enum (
      'domain_email',   -- proof email domain matches supplier website/email
      'manual_review'   -- requires admin approval after email verification
    );
  end if;
end $$;

-- ----------------------------------------------------------------------
-- claim_requests table
-- ----------------------------------------------------------------------

create table if not exists public.claim_requests (
  id                      uuid primary key default gen_random_uuid(),
  supplier_id             uuid not null references public.suppliers (id) on delete cascade,
  claimant_user_id        uuid not null references auth.users (id) on delete cascade,
  proof_email             text not null,
  proof_email_domain      text not null,
  method                  public.claim_method  not null,
  status                  public.claim_status  not null default 'pending_email',
  verification_token_hash text,                       -- sha256(hex) of raw token
  token_expires_at        timestamptz,
  email_verified_at       timestamptz,
  decided_at              timestamptz,
  decided_by              uuid references auth.users (id) on delete set null,
  decision_note           text,
  note                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_claim_requests_claimant
  on public.claim_requests (claimant_user_id, created_at desc);

create index if not exists idx_claim_requests_supplier
  on public.claim_requests (supplier_id, created_at desc);

create index if not exists idx_claim_requests_status
  on public.claim_requests (status);

create index if not exists idx_claim_requests_token_hash
  on public.claim_requests (verification_token_hash)
  where verification_token_hash is not null;

-- One open claim per (claimant, supplier). Partial unique index syntax —
-- in-table `unique ... where ...` is not valid Postgres.
create unique index if not exists ux_claim_requests_one_open_per_user_supplier
  on public.claim_requests (supplier_id, claimant_user_id)
  where status in ('pending_email', 'email_verified');

alter table public.claim_requests enable row level security;

-- Claimant reads their own rows.
drop policy if exists pol_claim_requests_self_read on public.claim_requests;
create policy pol_claim_requests_self_read
  on public.claim_requests
  for select
  to authenticated
  using (auth.uid() = claimant_user_id);

-- Admin reads everything.
drop policy if exists pol_claim_requests_admin_read on public.claim_requests;
create policy pol_claim_requests_admin_read
  on public.claim_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies. All writes via SECURITY DEFINER RPCs.

-- ----------------------------------------------------------------------
-- helper: normalised domain extraction
-- ----------------------------------------------------------------------

create or replace function public._claim_email_domain(p_email text)
returns text
language sql
immutable
as $$
  select lower(split_part(btrim(p_email), '@', 2))
$$;

create or replace function public._claim_host_from_url(p_url text)
returns text
language sql
immutable
as $$
  select case
    when p_url is null or btrim(p_url) = '' then null
    else regexp_replace(
           regexp_replace(lower(btrim(p_url)), '^https?://', ''),
           '^www\.', ''
         )
  end
$$;

create or replace function public._claim_host_root(p_host text)
returns text
language sql
immutable
as $$
  -- Drop path/query/port; return bare host.
  select case
    when p_host is null then null
    else regexp_replace(split_part(split_part(p_host, '/', 1), ':', 1), '^www\.', '')
  end
$$;

-- ----------------------------------------------------------------------
-- claim_search — buyer-safe whitelist FTS over unclaimed suppliers
-- ----------------------------------------------------------------------

create or replace function public.claim_search(p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q    text := nullif(btrim(coalesce(p_q, '')), '');
  v_rows jsonb;
begin
  if v_q is null or length(v_q) < 2 then
    return jsonb_build_object('total', 0, 'results', '[]'::jsonb);
  end if;

  with hits as (
    select s.id,
           s.slug,
           s.company_name,
           s.entity_type::text       as entity_type,
           s.city,
           s.district,
           public._claim_host_root(public._claim_host_from_url(s.website)) as website_host
      from public.suppliers s
     where s.is_published = true
       and s.is_sanctioned = false
       and s.claimed_by is null
       and s.company_name_norm ilike '%' || lower(v_q) || '%'
     order by similarity(s.company_name_norm, lower(v_q)) desc,
              s.completeness_pct desc nulls last,
              s.company_name asc
     limit 20
  )
  select jsonb_build_object(
    'total',   coalesce((select count(*) from hits), 0),
    'results', coalesce(jsonb_agg(to_jsonb(h.*) order by h.company_name), '[]'::jsonb)
  )
    into v_rows
    from hits h;

  return v_rows;
end;
$$;

comment on function public.claim_search(text) is
  'Spec S1 — supplier-claim search. Returns id/slug/company/entity/city/'
  'district/website_host only; no contact PII, no SBI. Hard-capped at 20.';

revoke all     on function public.claim_search(text) from public;
grant  execute on function public.claim_search(text) to authenticated;

-- ----------------------------------------------------------------------
-- claim_initiate — create a pending claim, return raw token (once)
-- ----------------------------------------------------------------------

create or replace function public.claim_initiate(
  p_supplier_id   uuid,
  p_proof_email   text,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_email         text;
  v_email_domain  text;
  v_supplier      record;
  v_supplier_host text;
  v_email_host    text;
  v_email_email   text;
  v_email_email_d text;
  v_method        public.claim_method;
  v_token_raw     text;
  v_token_hash    text;
  v_claim_id      uuid;
  v_now           timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role not in ('supplier', 'admin') then
    raise exception 'caller is not a supplier' using errcode = '42501';
  end if;

  if p_supplier_id is null then
    raise exception 'supplier_id is required' using errcode = '22023';
  end if;

  v_email := lower(btrim(coalesce(p_proof_email, '')));
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'proof_email must be a valid email' using errcode = '22023';
  end if;
  v_email_domain := public._claim_email_domain(v_email);

  if p_note is not null and length(p_note) > 2000 then
    raise exception 'note must be 2000 characters or fewer' using errcode = '22023';
  end if;

  select id, company_name, website, email_primary, is_published, is_sanctioned, claimed_by
    into v_supplier
    from public.suppliers
   where id = p_supplier_id;
  if not found then
    raise exception 'supplier not found' using errcode = 'P0002';
  end if;
  if v_supplier.is_sanctioned then
    raise exception 'supplier is sanctioned and cannot be claimed' using errcode = '42501';
  end if;
  if not v_supplier.is_published then
    raise exception 'supplier is not published' using errcode = '42501';
  end if;
  if v_supplier.claimed_by is not null then
    raise exception 'supplier is already claimed' using errcode = '42501';
  end if;

  -- Rate limit: one initiate per (claimant, supplier) per hour.
  if exists (
    select 1 from public.claim_requests
     where claimant_user_id = v_uid
       and supplier_id      = p_supplier_id
       and created_at       > v_now - interval '1 hour'
  ) then
    raise exception 'a claim was initiated for this supplier within the last hour; please wait'
      using errcode = '53400';
  end if;

  -- Determine method: domain_email if proof matches supplier website host
  -- OR matches supplier email_primary domain.
  v_supplier_host := public._claim_host_root(public._claim_host_from_url(v_supplier.website));
  v_email_email   := lower(btrim(coalesce(v_supplier.email_primary, '')));
  v_email_email_d := case when v_email_email = '' then null
                          else public._claim_email_domain(v_email_email)
                     end;

  if (v_supplier_host is not null and v_email_domain = v_supplier_host)
     or (v_email_email_d is not null and v_email_domain = v_email_email_d) then
    v_method := 'domain_email';
  else
    v_method := 'manual_review';
  end if;

  -- Generate 32-byte url-safe token (hex). Store only sha256(token).
  v_token_raw  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token_raw, 'sha256'), 'hex');

  insert into public.claim_requests (
    supplier_id,
    claimant_user_id,
    proof_email,
    proof_email_domain,
    method,
    status,
    verification_token_hash,
    token_expires_at,
    note
  ) values (
    p_supplier_id,
    v_uid,
    v_email,
    v_email_domain,
    v_method,
    'pending_email',
    v_token_hash,
    v_now + interval '24 hours',
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_claim_id;

  return jsonb_build_object(
    'claim_id',           v_claim_id,
    'method',             v_method::text,
    'verification_token', v_token_raw,
    'expires_at',         v_now + interval '24 hours',
    'proof_email',        v_email,
    'supplier', jsonb_build_object(
      'id',           v_supplier.id,
      'company_name', v_supplier.company_name
    )
  );
end;
$$;

comment on function public.claim_initiate(uuid, text, text) is
  'Spec S1 — create a pending claim. Returns the raw verification token '
  'exactly once for delivery via Resend. Hashed (sha256) at rest; the '
  'verification endpoint hashes the inbound token and matches on the hash.';

revoke all     on function public.claim_initiate(uuid, text, text) from public;
grant  execute on function public.claim_initiate(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------
-- claim_verify_email — consume token, auto-approve if domain_email
-- ----------------------------------------------------------------------

create or replace function public.claim_verify_email(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_raw  text := btrim(coalesce(p_token, ''));
  v_token_hash text;
  v_claim      record;
  v_now        timestamptz := now();
  v_outcome    text;
begin
  if v_token_raw = '' then
    raise exception 'token is required' using errcode = '22023';
  end if;

  v_token_hash := encode(extensions.digest(v_token_raw, 'sha256'), 'hex');

  select id, supplier_id, claimant_user_id, proof_email, method, status,
         token_expires_at
    into v_claim
    from public.claim_requests
   where verification_token_hash = v_token_hash;

  if not found then
    raise exception 'invalid or expired token' using errcode = 'P0002';
  end if;

  if v_claim.status not in ('pending_email') then
    raise exception 'claim is no longer pending verification' using errcode = '42501';
  end if;

  if v_claim.token_expires_at is null or v_claim.token_expires_at < v_now then
    update public.claim_requests
       set status = 'expired',
           verification_token_hash = null,
           updated_at = v_now
     where id = v_claim.id;
    raise exception 'invalid or expired token' using errcode = 'P0002';
  end if;

  if v_claim.method = 'domain_email' then
    -- Auto-approve. Refuse if the supplier got claimed by someone else in
    -- the meantime.
    if exists (
      select 1 from public.suppliers s
       where s.id = v_claim.supplier_id and s.claimed_by is not null
    ) then
      update public.claim_requests
         set status        = 'rejected',
             decided_at    = v_now,
             decision_note = 'supplier was claimed by another user before verification',
             email_verified_at = v_now,
             verification_token_hash = null,
             updated_at = v_now
       where id = v_claim.id;
      raise exception 'supplier is already claimed' using errcode = '42501';
    end if;

    update public.suppliers
       set claimed_by = v_claim.claimant_user_id,
           updated_at = v_now
     where id = v_claim.supplier_id and claimed_by is null;

    update public.claim_requests
       set status        = 'approved',
           email_verified_at = v_now,
           decided_at    = v_now,
           decision_note = 'auto-approved on domain-email proof',
           verification_token_hash = null,
           updated_at = v_now
     where id = v_claim.id;

    v_outcome := 'approved';
  else
    -- manual_review: mark verified, wait for admin.
    update public.claim_requests
       set status            = 'email_verified',
           email_verified_at = v_now,
           verification_token_hash = null,
           updated_at        = v_now
     where id = v_claim.id;
    v_outcome := 'pending_admin';
  end if;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'outcome',  v_outcome,
    'method',   v_claim.method::text
  );
end;
$$;

comment on function public.claim_verify_email(text) is
  'Spec S1 — consume verification token. Auto-approves and writes '
  'suppliers.claimed_by when method=domain_email; otherwise marks the '
  'claim email_verified and queues it for admin.';

revoke all     on function public.claim_verify_email(text) from public;
-- Granted to anon as well because the verification link is clicked from
-- email; the click happens in the user's browser which is signed in (the
-- supplier flow requires it) but we don't want a stale-session click to
-- 401. The token itself is the credential.
grant  execute on function public.claim_verify_email(text) to anon, authenticated;

-- ----------------------------------------------------------------------
-- claim_list_mine — claimant's own claims with supplier mini
-- ----------------------------------------------------------------------

create or replace function public.claim_list_mine()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('total', 0, 'results', '[]'::jsonb);
  end if;

  with rows as (
    select cr.id,
           cr.status::text                     as status,
           cr.method::text                     as method,
           cr.proof_email,
           cr.created_at,
           cr.email_verified_at,
           cr.token_expires_at,
           cr.decided_at,
           cr.decision_note,
           cr.note,
           jsonb_build_object(
             'id',           s.id,
             'slug',         s.slug,
             'company_name', s.company_name,
             'entity_type',  s.entity_type::text,
             'city',         s.city,
             'district',     s.district
           ) as supplier
      from public.claim_requests cr
      join public.suppliers s on s.id = cr.supplier_id
     where cr.claimant_user_id = v_uid
     order by cr.created_at desc
  )
  select jsonb_build_object(
    'total',   coalesce((select count(*) from rows), 0),
    'results', coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
  )
    into v_out
    from rows r;

  return v_out;
end;
$$;

comment on function public.claim_list_mine() is
  'Spec S1 — claimant''s own claim requests with supplier mini payload.';

revoke all     on function public.claim_list_mine() from public;
grant  execute on function public.claim_list_mine() to authenticated;

-- ----------------------------------------------------------------------
-- claim_cancel — claimant withdraws their pending claim
-- ----------------------------------------------------------------------

create or replace function public.claim_cancel(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_st  public.claim_status;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'claim id is required' using errcode = '22023';
  end if;

  select status into v_st
    from public.claim_requests
   where id = p_id and claimant_user_id = v_uid;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_st not in ('pending_email', 'email_verified') then
    raise exception 'claim is not cancellable' using errcode = '42501';
  end if;

  update public.claim_requests
     set status     = 'cancelled',
         verification_token_hash = null,
         updated_at = now()
   where id = p_id and claimant_user_id = v_uid;
end;
$$;

revoke all     on function public.claim_cancel(uuid) from public;
grant  execute on function public.claim_cancel(uuid) to authenticated;

-- ----------------------------------------------------------------------
-- claim_admin_list — admin-only queue (manual_review awaiting admin)
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
  if v_st not in ('pending_email','email_verified','approved','rejected','expired','cancelled','all') then
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
           u.email           as claimant_email,
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
     where v_st = 'all' or cr.status::text = v_st
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

revoke all     on function public.claim_admin_list(text) from public;
grant  execute on function public.claim_admin_list(text) to authenticated;

-- ----------------------------------------------------------------------
-- claim_admin_decide — admin approves / rejects a verified manual claim
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

  select id, supplier_id, claimant_user_id, status, method
    into v_claim
    from public.claim_requests
   where id = p_claim_id;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_claim.status <> 'email_verified' then
    raise exception 'claim is not awaiting admin decision' using errcode = '42501';
  end if;

  if p_approve then
    -- Refuse if supplier got claimed in the meantime.
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
     set status        = v_new_state,
         decided_at    = v_now,
         decided_by    = v_uid,
         decision_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at    = v_now
   where id = p_claim_id;

  return jsonb_build_object(
    'claim_id', p_claim_id,
    'status',   v_new_state::text
  );
end;
$$;

revoke all     on function public.claim_admin_decide(uuid, boolean, text) from public;
grant  execute on function public.claim_admin_decide(uuid, boolean, text) to authenticated;
