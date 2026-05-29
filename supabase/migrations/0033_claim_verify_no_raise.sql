-- 0033 — Spec S1 follow-up: claim_verify_email should not roll back its
-- "mark expired" update when the token has passed its TTL.
--
-- The 0032 implementation raised an exception after writing
-- status='expired', which rolls back the entire function call (plpgsql
-- exceptions abort the implicit subtransaction). Result: expired tokens
-- never get marked, and the row stays in 'pending_email' forever.
--
-- Fix: return a jsonb error envelope instead of raising for the
-- expected client-facing failure modes (invalid token, expired token,
-- claim no longer pending, supplier already claimed). The API route at
-- `/api/v1/claims` maps non-ok outcomes to 4xx responses.

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
    return jsonb_build_object('ok', false, 'outcome', 'invalid');
  end if;

  v_token_hash := encode(extensions.digest(v_token_raw, 'sha256'), 'hex');

  select id, supplier_id, claimant_user_id, proof_email, method, status,
         token_expires_at
    into v_claim
    from public.claim_requests
   where verification_token_hash = v_token_hash;

  if not found then
    return jsonb_build_object('ok', false, 'outcome', 'invalid');
  end if;

  if v_claim.status <> 'pending_email' then
    return jsonb_build_object(
      'ok', false,
      'outcome', 'not_pending',
      'status', v_claim.status::text,
      'claim_id', v_claim.id
    );
  end if;

  if v_claim.token_expires_at is null or v_claim.token_expires_at < v_now then
    update public.claim_requests
       set status = 'expired',
           verification_token_hash = null,
           updated_at = v_now
     where id = v_claim.id;
    return jsonb_build_object(
      'ok', false,
      'outcome', 'expired',
      'claim_id', v_claim.id
    );
  end if;

  if v_claim.method = 'domain_email' then
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
      return jsonb_build_object(
        'ok', false,
        'outcome', 'supplier_taken',
        'claim_id', v_claim.id
      );
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
    update public.claim_requests
       set status            = 'email_verified',
           email_verified_at = v_now,
           verification_token_hash = null,
           updated_at        = v_now
     where id = v_claim.id;
    v_outcome := 'pending_admin';
  end if;

  return jsonb_build_object(
    'ok',       true,
    'claim_id', v_claim.id,
    'outcome',  v_outcome,
    'method',   v_claim.method::text
  );
end;
$$;

revoke all     on function public.claim_verify_email(text) from public;
grant  execute on function public.claim_verify_email(text) to anon, authenticated;
