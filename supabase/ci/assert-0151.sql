-- 0151 asserted by running it: no client role can call _messages_key() or _messages_rotate_key(), and a
-- signed-in person who tries is refused; a message sent before a rotation reads back with the same text
-- after it; the stored key changed; a message the old key could not open is left as it was and counted;
-- the rotation writes ONE messages.key_rotated entry with the counts and the reason, and no per-message
-- entry; the per-row trigger is back on afterwards; a rotation with no reason, or while the key is set
-- on the database as app.messages_key, is refused and changes nothing.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a151', 'buyer-0151@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b151', 'supplier-0151@example.invalid', '{"role":"supplier"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-4000-8000-0000000a1151', 'ci-0151-knit', 'CI 0151 Knit Ltd', 'ci 0151 knit ltd', 'Dhaka', 'Dhaka', false, false,
          '00000000-0000-4000-8000-00000000b151');

do $$
declare
  buyer    constant uuid := '00000000-0000-4000-8000-00000000a151';
  supplier constant uuid := '00000000-0000-4000-8000-00000000b151';
  company  constant uuid := '00000000-0000-4000-8000-0000000a1151';
  thread   constant uuid := '00000000-0000-4000-8000-0000000b1151';
  role_name text;
  key_was  text;
  msg      uuid;
  lost     uuid;
  lost_was bytea;
  got      jsonb;
  n        bigint;
  e        record;
  hit      text;
begin
  -- Grants: the fault was a grant by name that "revoke from public" never touched.
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(role_name::name, 'public._messages_key()', 'execute') then
      raise exception '% can call _messages_key()', role_name;
    end if;
    if has_function_privilege(role_name::name, 'public._messages_rotate_key(text)', 'execute') then
      raise exception '% can call _messages_rotate_key()', role_name;
    end if;
  end loop;

  insert into public.message_threads (id, buyer_id, supplier_id, subject) values (thread, buyer, company, 'CI');
  insert into public.thread_participants (thread_id, user_id, role) values (thread, buyer, 'buyer'), (thread, supplier, 'supplier');

  -- A signed-in person: the key is refused, sending still works (the sender function runs as the owner).
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', buyer)::text, true);
  hit := null;
  begin
    perform public._messages_key();
  exception when insufficient_privilege then hit := 'refused';
  end;
  if hit is null then raise exception 'a signed-in person read the key'; end if;
  msg := public.thread_send_message(thread, 'hello before the new key');
  reset role;

  -- A message written under some other key: already unreadable, and it must not stop the rest.
  insert into public.messages (thread_id, sender_id, body_ciphertext, body_len)
    values (thread, supplier, pgp_sym_encrypt('lost', 'a key nobody holds any more'), 4)
    returning id, body_ciphertext into lost, lost_was;

  key_was := public._messages_key();
  select count(*) into n from public.activity_ledger;

  -- Refused, and nothing changed: no reason given.
  hit := null;
  begin
    perform public._messages_rotate_key('  ');
  exception when sqlstate '22023' then hit := 'refused';
  end;
  if hit is null then raise exception 'a rotation with no reason ran'; end if;

  -- Refused, and nothing changed: the key is set on the database, where the table cannot reach it.
  perform set_config('app.messages_key', 'a database-level key of enough length', true);
  hit := null;
  begin
    perform public._messages_rotate_key('ci');
  exception when others then hit := sqlerrm;
  end;
  perform set_config('app.messages_key', '', true);
  if hit is null or hit not like '%app.messages_key%' then raise exception 'a rotation ran over a database-level key: %', hit; end if;
  if public._messages_key() <> key_was then raise exception 'a refused rotation changed the key'; end if;
  if (select count(*) from public.activity_ledger) <> n then raise exception 'a refused rotation wrote to the record'; end if;

  -- The rotation.
  got := public._messages_rotate_key('ci rotation');
  if (got ->> 'reencrypted')::int < 1 or (got ->> 'unreadable_left')::int < 1 then
    raise exception 'the counts are wrong: %', got;
  end if;
  if public._messages_key() = key_was then raise exception 'the key did not change'; end if;
  if length(public._messages_key()) <> 64 then raise exception 'the new key is not 32 random bytes in hex'; end if;
  if (select body_ciphertext from public.messages where id = lost) is distinct from lost_was then
    raise exception 'the unreadable message was rewritten';
  end if;
  begin
    perform pgp_sym_decrypt((select body_ciphertext from public.messages where id = msg), key_was);
    raise exception 'the old key still opens the message';
  exception
    when raise_exception then raise;
    when others then null;
  end;

  -- One entry for the event, none per message, and the reason on it.
  select count(*) into n from public.activity_ledger where kind = 'message.updated';
  if n <> 0 then raise exception 'the rotation wrote % per-message entries', n; end if;
  select count(*) into n from public.activity_ledger where kind = 'messages.key_rotated' and reason = 'ci rotation';
  if n <> 1 then raise exception 'expected one messages.key_rotated entry, found %', n; end if;
  select * into e from public.activity_ledger where kind = 'messages.key_rotated' and reason = 'ci rotation';
  if e.content <> got or e.target_table <> 'messages' then raise exception 'the entry is wrong: %', to_jsonb(e); end if;
  if e.content::text like '%' || key_was || '%' or e.content::text like '%' || public._messages_key() || '%' then
    raise exception 'a key was written into the record';
  end if;

  -- The per-row trigger is back on.
  if (select tgenabled from pg_trigger where tgrelid = 'public.messages'::regclass and tgname = 'trg_messages_ledger') <> 'O' then
    raise exception 'the rotation left the record''s trigger on messages switched off';
  end if;

  -- The buyer reads the message back, same text; and can still send. (The unreadable row goes first:
  -- one such row fails the whole conversation's read, which is older than this migration.)
  delete from public.messages where id = lost;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', buyer)::text, true);
  select m ->> 'body' into hit from jsonb_array_elements(public.thread_messages(thread, 50, null)) m where (m ->> 'id')::uuid = msg;
  if hit is distinct from 'hello before the new key' then raise exception 'after the rotation the message read: %', hit; end if;
  msg := public.thread_send_message(thread, 'hello after');
  reset role;
  if (select count(*) from public.activity_ledger where kind = 'message.sent' and target_id = msg) <> 1 then
    raise exception 'a message sent after the rotation was not recorded';
  end if;
end
$$;

rollback;
