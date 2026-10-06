-- 0135 asserted by running it: entries spread over three past hours become three chained seals, one per
-- hour, and the current hour is left alone; sealing again writes nothing new; verify says ok and counts the
-- entries waiting; the stamp is stored once and the mailing noted once; a seal cannot be rewritten or
-- deleted; a tampered seal (the guard disabled by the owner to do it) is named by verify; a buyer cannot
-- verify, a stranger cannot seal or stamp; the health read answers an admin and refuses a buyer.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a135', 'admin-0135@example.invalid', '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b135', 'buyer-0135@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

-- Entries at known times: the writer stamps `at` itself, so these go in directly as the owner (the record's
-- own writer is tested in assert-0131). Two hours ago, one hour ago, and now.
insert into public.activity_ledger (at, actor_id, kind, target_table, target_id, content, content_hash) values
  (date_trunc('hour', now()) - interval '2 hours' + interval '10 minutes', '00000000-0000-4000-8000-00000000b135', 'test.one',   'x', null, '{}', repeat('1', 64)),
  (date_trunc('hour', now()) - interval '2 hours' + interval '20 minutes', '00000000-0000-4000-8000-00000000b135', 'test.two',   'x', null, '{}', repeat('2', 64)),
  (date_trunc('hour', now()) - interval '1 hour'  + interval '5 minutes',  '00000000-0000-4000-8000-00000000b135', 'test.three', 'x', null, '{}', repeat('3', 64)),
  (now(),                                                                   '00000000-0000-4000-8000-00000000b135', 'test.now',   'x', null, '{}', repeat('4', 64));

do $$
declare
  admin constant uuid := '00000000-0000-4000-8000-00000000a135';
  buyer constant uuid := '00000000-0000-4000-8000-00000000b135';
  out   jsonb;
  s     record;
  n     int;
  hit   text;
  prev  text;
  h     record;
begin
  -- Grants.
  if has_function_privilege('authenticated', 'public.ledger_seal(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.ledger_seal_stamp(bigint, text, bytea, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.ledger_verify()', 'execute')
     or has_table_privilege('authenticated', 'public.activity_seals', 'select') then
    raise exception 'the grants of the seals are wrong';
  end if;
  if position('''email:ledger_stamp''' in pg_get_functiondef('public.rl_check(text, text, integer)'::regprocedure)) = 0 then
    raise exception 'rl_check does not know email:ledger_stamp';
  end if;

  -- A signed-in buyer cannot seal or stamp or verify; the health read refuses them.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  hit := null;
  begin
    perform public.ledger_seal();
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer sealed the record'; end if;
  hit := null;
  begin
    perform public.ledger_verify();
  exception when insufficient_privilege then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer verified the record'; end if;
  hit := null;
  begin
    perform public.admin_ledger_health();
  exception when insufficient_privilege then hit := 'refused';
  end;
  if hit is null then raise exception 'a buyer read the health'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Sealing, "now" being half past this hour so the five-minute grace cannot fall inside it: the two finished
  -- hours are sealed and the current one is not.
  out := public.ledger_seal(date_trunc('hour', now()) + interval '30 minutes');
  if (out->>'sealed')::int <> 2 then raise exception 'sealed % hours, expected 2', out->>'sealed'; end if;
  select count(*) into n from public.activity_seals;
  if n <> 2 then raise exception '% seals, expected 2', n; end if;
  if exists (select 1 from public.activity_seals where period_end > date_trunc('hour', now())) then
    raise exception 'the current hour was sealed';
  end if;
  select * into s from public.activity_seals where period_start = date_trunc('hour', now()) - interval '2 hours';
  if s.id is null or s.entry_count <> 2 or s.prev_seal_hash is not null then
    raise exception 'the first window is wrong: %', to_jsonb(s);
  end if;
  select * into s from public.activity_seals where period_start = date_trunc('hour', now()) - interval '1 hour';
  if s.entry_count <> 1 or s.prev_seal_hash is null then raise exception 'the one-hour-ago window is wrong: %', to_jsonb(s); end if;

  -- The chain: each seal names the one before it, and the hashes are what the functions say.
  prev := null;
  for s in select * from public.activity_seals order by id loop
    if s.prev_seal_hash is distinct from prev then raise exception 'seal % does not chain', s.id; end if;
    select * into h from public._ledger_entries_hash(s.period_start, s.period_end);
    if h.entries_hash <> s.entries_hash then raise exception 'seal % entries hash is not the entries''', s.id; end if;
    if s.seal_hash <> public._ledger_seal_hash(s.prev_seal_hash, s.entries_hash, s.period_start, s.period_end, s.entry_count) then
      raise exception 'seal % hash is not its fields''', s.id;
    end if;
    prev := s.seal_hash;
  end loop;

  -- Sealing again writes nothing.
  select count(*) into n from public.activity_seals;
  out := public.ledger_seal(date_trunc('hour', now()) + interval '30 minutes');
  if (out->>'sealed')::int <> 0 or (select count(*) from public.activity_seals) <> n then
    raise exception 'a second seal run wrote % more', out->>'sealed';
  end if;

  -- Verify: ok, with the current hour's entry waiting.
  out := public.ledger_verify();
  if not (out->>'ok')::boolean or (out->>'seals_checked')::int <> n or (out->>'unsealed_entries')::int < 1 then
    raise exception 'verify answered %', out;
  end if;
  if (select note from public.activity_ledger_jobs where name = 'verify') is null then raise exception 'the verdict was not kept'; end if;

  -- The stamp: stored once, mailed once.
  select max(id) into n from public.activity_seals;
  if not public.ledger_seal_stamp(n, 'https://tsa.example/tsr', '\x3082'::bytea, now()) then raise exception 'the stamp was not stored'; end if;
  if public.ledger_seal_stamp(n, 'https://other.example/tsr', '\x3083'::bytea, now()) then raise exception 'a second stamp replaced the first'; end if;
  if (select tsa_url from public.activity_seals where id = n) <> 'https://tsa.example/tsr' then raise exception 'the stamp changed'; end if;
  if not public.ledger_seal_mailed(n, 'keeper@example.invalid') then raise exception 'the mailing was not noted'; end if;
  if public.ledger_seal_mailed(n, 'other@example.invalid') then raise exception 'the mailing was noted twice'; end if;

  -- A seal cannot be rewritten or deleted.
  hit := null;
  begin
    update public.activity_seals set entry_count = 99 where id = n;
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a seal was rewritten'; end if;
  hit := null;
  begin
    delete from public.activity_seals where id = n;
  exception when sqlstate '42501' then hit := 'refused';
  end;
  if hit is null then raise exception 'a seal was deleted'; end if;

  -- The health read, as the admin.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  out := public.admin_ledger_health();
  if (out->>'entries')::int < 4 or (out->'last_seal'->>'id')::bigint <> n or out->'last_stamp'->>'tsa_url' <> 'https://tsa.example/tsr'
     or out->'last_stamp'->>'mailbox' <> 'keeper@example.invalid' or not (out->'last_verify'->>'ok')::boolean then
    raise exception 'the health read is wrong: %', out;
  end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Tampering: with the guard off (only the owner can), one seal's entries_hash is changed; verify names it.
  alter table public.activity_seals disable trigger trg_activity_seals_guard;
  update public.activity_seals set entries_hash = repeat('f', 64) where id = (select min(id) from public.activity_seals);
  alter table public.activity_seals enable trigger trg_activity_seals_guard;
  out := public.ledger_verify();
  if (out->>'ok')::boolean or (out->>'first_broken_seal')::bigint <> (select min(id) from public.activity_seals) then
    raise exception 'verify did not see the tampered seal: %', out;
  end if;
end
$$;

rollback;
