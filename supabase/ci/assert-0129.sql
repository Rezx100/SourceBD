-- 0129 asserted by running it: the admin list shows the claimant's id, an expired link and the email journal;
-- `open` lists both waiting states; a reject without a reason is refused; a verified claim approves without
-- one and writes claimed_by and an audit row; an unverified claim needs a reason to approve; a resend gives
-- a fresh token, revives an expired claim, and the old token no longer verifies; a decided claim cannot be
-- resent; a buyer and anon are refused; rl_check knows the claim email's bucket.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a129', 'admin-0129@example.invalid',    '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b129', 'claimant-0129@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c129', 'buyer-0129@example.invalid',    '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000a1129', 'ci-0129-a', 'CI 0129 A Ltd', 'ci 0129 a ltd', 'Dhaka', 'Dhaka', false, false),
  ('00000000-0000-4000-8000-0000000a2129', 'ci-0129-b', 'CI 0129 B Ltd', 'ci 0129 b ltd', 'Dhaka', 'Dhaka', false, false),
  ('00000000-0000-4000-8000-0000000a3129', 'ci-0129-c', 'CI 0129 C Ltd', 'ci 0129 c ltd', 'Dhaka', 'Dhaka', false, false);

-- A: stuck at the email step, link expired yesterday, with the old token hash still on it.
-- B: verified, waiting for the admin. C: pending, link still good.
insert into public.claim_requests (id, supplier_id, claimant_user_id, proof_email, proof_email_domain, method, status, verification_token_hash, token_expires_at) values
  ('00000000-0000-4000-8000-0000000c1129', '00000000-0000-4000-8000-0000000a1129', '00000000-0000-4000-8000-00000000b129', 'x@a.example', 'a.example', 'manual_review', 'pending_email',
   encode(extensions.digest('old-token-0129', 'sha256'), 'hex'), now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000c2129', '00000000-0000-4000-8000-0000000a2129', '00000000-0000-4000-8000-00000000b129', 'x@b.example', 'b.example', 'manual_review', 'email_verified', null, null),
  ('00000000-0000-4000-8000-0000000c3129', '00000000-0000-4000-8000-0000000a3129', '00000000-0000-4000-8000-00000000b129', 'x@c.example', 'c.example', 'manual_review', 'pending_email',
   encode(extensions.digest('good-token-0129', 'sha256'), 'hex'), now() + interval '20 hours');

-- The journal: A's email failed, C's went out.
insert into public.email_log (to_addr, template, ref_id, status, error, sent_at) values
  ('x@a.example', 'claim_verify', '00000000-0000-4000-8000-0000000c1129', 'failed', 'no_api_key', now() - interval '2 days'),
  ('x@c.example', 'claim_verify', '00000000-0000-4000-8000-0000000c3129', 'sent', null, now() - interval '4 hours');

do $$
declare
  doc   jsonb;
  row_a jsonb;
  out   jsonb;
  hit   text;
  n     int;
  tok   text;
begin
  if has_function_privilege('anon', 'public.claim_admin_list(text)', 'execute')
     or has_function_privilege('anon', 'public.claim_admin_decide(uuid, boolean, text)', 'execute')
     or has_function_privilege('anon', 'public.claim_admin_resend(uuid)', 'execute') then
    raise exception 'anon can execute a claim admin call';
  end if;
  if position('''email:claim_verify''' in pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure)) = 0 then
    raise exception 'rl_check does not know email:claim_verify';
  end if;

  -- A buyer is refused.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c129', true);
  hit := null;
  begin
    perform public.claim_admin_list('open');
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer read the claim queue'; end if;
  hit := null;
  begin
    perform public.claim_admin_resend('00000000-0000-4000-8000-0000000c1129');
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer resent a claim link'; end if;

  -- The admin: open lists A, B and C; A says its link expired and its email failed; C says sent.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a129', true);
  doc := public.claim_admin_list('open');
  if (doc->>'total')::int <> 3 then raise exception 'open listed % claims, expected 3', doc->>'total'; end if;
  select r into row_a from jsonb_array_elements(doc->'results') r where r->>'id' = '00000000-0000-4000-8000-0000000c1129';
  if row_a->>'claimant_user_id' <> '00000000-0000-4000-8000-00000000b129' then raise exception 'no claimant id on the row'; end if;
  if (row_a->>'link_expired')::boolean is not true then raise exception 'an expired link was not marked'; end if;
  if row_a->'email'->>'status' <> 'failed' or row_a->'email'->>'error' <> 'no_api_key' then
    raise exception 'the email journal did not reach the row: %', row_a->'email';
  end if;
  select r into row_a from jsonb_array_elements(doc->'results') r where r->>'id' = '00000000-0000-4000-8000-0000000c3129';
  if row_a->'email'->>'status' <> 'sent' or (row_a->>'link_expired')::boolean then
    raise exception 'C''s row is wrong: %', row_a;
  end if;
  select r into row_a from jsonb_array_elements(doc->'results') r where r->>'id' = '00000000-0000-4000-8000-0000000c2129';
  if row_a->'email' is not null and row_a->'email' <> 'null'::jsonb then raise exception 'B has an email it never had'; end if;
  if (public.claim_admin_list('pending_email')->>'total')::int <> 2 then raise exception 'pending_email did not list 2'; end if;
  if (public.claim_admin_list()->>'total')::int <> 1 then raise exception 'the default (email_verified) did not list 1'; end if;

  -- Reject without a reason: refused. Approve the unverified A without a reason: refused.
  hit := null;
  begin
    perform public.claim_admin_decide('00000000-0000-4000-8000-0000000c2129', false, '  ');
  exception when sqlstate '22023' then hit := sqlerrm;
  end;
  if hit is null then raise exception 'a reject without a reason went through'; end if;
  hit := null;
  begin
    perform public.claim_admin_decide('00000000-0000-4000-8000-0000000c1129', true, null);
  exception when sqlstate '22023' then hit := sqlerrm;
  end;
  if hit is null then raise exception 'an unverified claim was approved without a reason'; end if;

  -- Resend A: a fresh token, pending again, 24 hours; the old token is dead; the audit row is there.
  out := public.claim_admin_resend('00000000-0000-4000-8000-0000000c1129');
  tok := out->>'verification_token';
  if tok is null or length(tok) <> 64 then raise exception 'no fresh token: %', out; end if;
  if out->>'proof_email' <> 'x@a.example' or out->'supplier'->>'company_name' <> 'CI 0129 A Ltd' then
    raise exception 'the resend answer lacks the email or the company: %', out;
  end if;
  reset role;
  if not exists (select 1 from public.claim_requests
                  where id = '00000000-0000-4000-8000-0000000c1129' and status = 'pending_email'
                    and token_expires_at > now() + interval '23 hours'
                    and verification_token_hash = encode(extensions.digest(tok, 'sha256'), 'hex')) then
    raise exception 'the resend did not store the new token';
  end if;
  if exists (select 1 from public.claim_requests
              where verification_token_hash = encode(extensions.digest('old-token-0129', 'sha256'), 'hex')) then
    raise exception 'the old token still verifies';
  end if;
  if (select count(*) from public.admin_audit_log where action = 'claim_admin_resend' and target_id = '00000000-0000-4000-8000-0000000c1129') <> 1 then
    raise exception 'no audit row for the resend';
  end if;

  -- The verified B approves with no reason; claimed_by is written; the audit row carries from/to.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a129', true);
  out := public.claim_admin_decide('00000000-0000-4000-8000-0000000c2129', true, null);
  if out->>'status' <> 'approved' then raise exception 'B did not approve: %', out; end if;
  reset role;
  if (select claimed_by from public.suppliers where id = '00000000-0000-4000-8000-0000000a2129') <> '00000000-0000-4000-8000-00000000b129' then
    raise exception 'approving did not write claimed_by';
  end if;
  select count(*) into n from public.admin_audit_log
   where action = 'claim_admin_decide' and target_id = '00000000-0000-4000-8000-0000000c2129'
     and patch->>'from' = 'email_verified' and patch->>'to' = 'approved';
  if n <> 1 then raise exception 'no audit row for the approval'; end if;

  -- The unverified A rejects with a reason; a decided claim cannot be resent.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a129', true);
  out := public.claim_admin_decide('00000000-0000-4000-8000-0000000c1129', false, 'Not the company''s domain and no reply.');
  if out->>'status' <> 'rejected' then raise exception 'A did not reject: %', out; end if;
  hit := null;
  begin
    perform public.claim_admin_resend('00000000-0000-4000-8000-0000000c1129');
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a decided claim was resent'; end if;
  reset role;
  if (select decision_note from public.claim_requests where id = '00000000-0000-4000-8000-0000000c1129') not like 'Not the company%' then
    raise exception 'the reason was not kept';
  end if;
end
$$;

rollback;
