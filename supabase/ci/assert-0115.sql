-- Behaviour of the account's sessions after 0115, asserted by running it: a buyer lists only their own live
-- sessions (an expired one and another person's are not shown), the one making the call says so, nothing
-- identifies an address; ending a session deletes only the caller's own row; the current session, another
-- person's and a made-up id are refused with false and change nothing; anon can run neither call; a call with
-- nobody signed in lists nothing and refuses to end anything.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a115', 'a-0115@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b115', 'b-0115@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into auth.sessions (id, user_id, created_at, updated_at, not_after, refreshed_at, user_agent, ip) values
  ('00000000-0000-4000-8000-0000000a1151', '00000000-0000-4000-8000-00000000a115', now() - interval '3 days', now() - interval '1 minute', null, null, 'Chrome on Windows', '203.0.113.5'),
  ('00000000-0000-4000-8000-0000000a1152', '00000000-0000-4000-8000-00000000a115', now() - interval '40 days', now() - interval '30 days', null, null, 'Safari on iPhone', '203.0.113.6'),
  ('00000000-0000-4000-8000-0000000a1153', '00000000-0000-4000-8000-00000000a115', now() - interval '60 days', now() - interval '50 days', now() - interval '1 day', null, 'Edge on Windows', '203.0.113.7'),
  ('00000000-0000-4000-8000-0000000b1151', '00000000-0000-4000-8000-00000000b115', now() - interval '1 day', now(), null, null, 'Firefox on Linux', '203.0.113.8');

do $$
declare
  a    constant uuid := '00000000-0000-4000-8000-00000000a115';
  s1   constant uuid := '00000000-0000-4000-8000-0000000a1151';
  s2   constant uuid := '00000000-0000-4000-8000-0000000a1152';
  s3   constant uuid := '00000000-0000-4000-8000-0000000a1153';
  sb   constant uuid := '00000000-0000-4000-8000-0000000b1151';
  ids  uuid[];
  cur  uuid[];
begin
  if has_function_privilege('anon', 'public.account_sessions()', 'execute')
     or has_function_privilege('anon', 'public.account_session_end(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.account_sessions()', 'execute')
     or not has_function_privilege('authenticated', 'public.account_session_end(uuid)', 'execute') then
    raise exception 'the grants of the session calls are wrong';
  end if;

  -- Nobody signed in: nothing listed, nothing ended.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  if exists (select 1 from public.account_sessions()) then
    raise exception 'a call with nobody signed in listed sessions';
  end if;
  begin
    perform public.account_session_end(s2);
    raise exception 'a call with nobody signed in ended a session';
  exception when insufficient_privilege then null;
  end;

  -- The buyer, on their first session.
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'session_id', s1)::text, true);

  select array_agg(id order by last_active_at desc) into ids from public.account_sessions();
  if ids is distinct from array[s1, s2] then
    raise exception 'the buyer saw sessions %', ids;
  end if;
  select array_agg(id) into cur from public.account_sessions() where is_current;
  if cur is distinct from array[s1] then
    raise exception 'the current session was %', cur;
  end if;
  if (select user_agent from public.account_sessions() where id = s2) <> 'Safari on iPhone' then
    raise exception 'the user agent was not returned';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'account_sessions' and column_name = 'ip')
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'account_sessions'
            and pg_get_function_result(p.oid) ilike '%ip%inet%') > 0 then
    raise exception 'account_sessions returns an address';
  end if;

  -- Ending: the current session, someone else's, a made-up id and null are refused and change nothing.
  if public.account_session_end(s1) or public.account_session_end(sb)
     or public.account_session_end('00000000-0000-4000-8000-0000000fffff') or public.account_session_end(null) then
    raise exception 'a session that must not end was ended';
  end if;
  reset role;
  if (select count(*) from auth.sessions) <> 4 then
    raise exception 'a refused end deleted a row';
  end if;

  -- Ending another of their own sessions deletes exactly that row.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'session_id', s1)::text, true);
  if not public.account_session_end(s2) then
    raise exception 'ending their own other session answered false';
  end if;
  reset role;
  if exists (select 1 from auth.sessions where id = s2)
     or not exists (select 1 from auth.sessions where id = s1)
     or not exists (select 1 from auth.sessions where id = s3)
     or not exists (select 1 from auth.sessions where id = sb) then
    raise exception 'ending a session deleted the wrong rows';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'session_id', s1)::text, true);
  if public.account_session_end(s2) then
    raise exception 'ending a session twice answered true';
  end if;
  reset role;
end
$$;

rollback;
