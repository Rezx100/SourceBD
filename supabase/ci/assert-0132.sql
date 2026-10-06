-- 0132 asserted by running it: three Auth log rows (a sign-in, a token refresh, a password change) become
-- two record entries with the right kinds, the actor, Auth's address as the gateway address, the time Auth
-- wrote them in the content and the whole payload kept; the refresh is skipped; the cursor moves so a second
-- run copies nothing; a later row is copied by the next run; a buyer cannot run it; anon and authenticated
-- cannot call it or read the cursor.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a132', 'buyer-0132@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
  ('00000000-0000-4000-8000-0000000a1132', '{"action":"login","actor_id":"00000000-0000-4000-8000-00000000a132","actor_username":"buyer-0132@example.invalid","log_type":"account","traits":{"provider":"email"}}', now() - interval '3 hours', '203.0.113.9'),
  ('00000000-0000-4000-8000-0000000a2132', '{"action":"token_refreshed","actor_id":"00000000-0000-4000-8000-00000000a132","log_type":"token"}', now() - interval '2 hours', '203.0.113.9'),
  ('00000000-0000-4000-8000-0000000a3132', '{"action":"user_updated_password","actor_id":"00000000-0000-4000-8000-00000000a132","actor_username":"buyer-0132@example.invalid","log_type":"user"}', now() - interval '1 hour', '');

do $$
declare
  out  jsonb;
  e    record;
  n    int;
  hit  text;
begin
  if has_function_privilege('anon', 'public.ledger_copy_auth_log(int)', 'execute')
     or has_function_privilege('authenticated', 'public.ledger_copy_auth_log(int)', 'execute')
     or not has_function_privilege('service_role', 'public.ledger_copy_auth_log(int)', 'execute') then
    raise exception 'the grants of ledger_copy_auth_log are wrong';
  end if;
  if has_table_privilege('authenticated', 'public.activity_ledger_jobs', 'select') then
    raise exception 'a signed-in person can read the job cursor';
  end if;

  -- A buyer cannot run it (the role claim says who is calling).
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a132', true);
  hit := null;
  begin
    perform public.ledger_copy_auth_log(10);
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer ran the copy'; end if;

  -- The service role copies: two entries, the refresh skipped.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  out := public.ledger_copy_auth_log(10);
  if (out->>'copied')::int <> 2 or (out->>'skipped')::int <> 1 then
    raise exception 'the first copy answered %', out;
  end if;

  select * into e from public.activity_ledger where kind = 'account.sign_in' and target_id = '00000000-0000-4000-8000-0000000a1132';
  if e.id is null then raise exception 'no account.sign_in entry'; end if;
  if e.actor_id <> '00000000-0000-4000-8000-00000000a132' or e.actor_email <> 'buyer-0132@example.invalid' or e.actor_role <> 'buyer' then
    raise exception 'the sign-in actor is wrong: % % %', e.actor_id, e.actor_email, e.actor_role;
  end if;
  if e.ip_gateway <> '203.0.113.9'::inet then raise exception 'Auth''s address was not kept as the gateway address: %', e.ip_gateway; end if;
  if e.target_table <> 'auth.audit_log_entries' then raise exception 'target_table is %', e.target_table; end if;
  if (e.content ->> 'occurred_at')::timestamptz > now() - interval '2 hours' then raise exception 'occurred_at is not Auth''s time'; end if;
  if e.content ->> 'action' <> 'login' or e.content -> 'traits' ->> 'provider' <> 'email' then raise exception 'the payload was not kept'; end if;
  if e.at < now() - interval '1 minute' then raise exception 'at is not the copy time'; end if;

  select * into e from public.activity_ledger where kind = 'account.password_changed';
  if e.id is null then raise exception 'no account.password_changed entry'; end if;
  if e.ip_gateway is not null then raise exception 'an empty Auth address became %', e.ip_gateway; end if;
  if exists (select 1 from public.activity_ledger where content ->> 'action' = 'token_refreshed') then
    raise exception 'a token refresh was copied';
  end if;

  -- The cursor moved: a second run copies nothing.
  out := public.ledger_copy_auth_log(10);
  if (out->>'copied')::int <> 0 then raise exception 'the second run copied % again', out->>'copied'; end if;
  select copied into n from public.activity_ledger_jobs where name = 'auth_log';
  if n <> 2 then raise exception 'the job row counts %, expected 2', n; end if;

  -- A later row is copied by the next run, and the unknown action gets a safe kind.
  insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
    ('00000000-0000-4000-8000-0000000a4132', '{"action":"some new thing!","actor_id":"00000000-0000-4000-8000-00000000a132"}', now(), '198.51.100.7');
  out := public.ledger_copy_auth_log(10);
  if (out->>'copied')::int <> 1 then raise exception 'the third run copied %', out->>'copied'; end if;
  if not exists (select 1 from public.activity_ledger where kind = 'account.auth_some_new_thing_' and target_id = '00000000-0000-4000-8000-0000000a4132') then
    raise exception 'the unknown action did not get its kind';
  end if;

  -- The request setting was put back.
  if coalesce(current_setting('request.headers', true), '') <> '' then
    raise exception 'request.headers was left set to %', current_setting('request.headers', true);
  end if;
end
$$;

rollback;
