-- 0130 asserted by running it: a suspended buyer is refused by thread_send_message and order_milestone_add
-- with "This account is suspended." (42501) and nothing is written; a suspended supplier is refused by
-- rfq_quote_submit; the refusal binds even the owner of the database inserting straight into messages; an
-- active buyer still sends; suspending through admin_user_update ends every session of that person and
-- nobody else's; un-suspending lets them act again; anon and authenticated cannot call the helpers.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a130', 'admin-0130@example.invalid',    '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b130', 'buyer-0130@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c130', 'supplier-0130@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d130', 'other-0130@example.invalid',    '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-4000-8000-0000000a1130', 'ci-0130-knit', 'CI 0130 Knit Ltd', 'ci 0130 knit ltd', 'Dhaka', 'Dhaka', false, false,
          '00000000-0000-4000-8000-00000000c130');

-- A conversation, an RFQ and an order, made directly so none of the "published" guards are in the way.
insert into public.message_threads (id, buyer_id, supplier_id, subject)
  values ('00000000-0000-4000-8000-0000000b1130', '00000000-0000-4000-8000-00000000b130', '00000000-0000-4000-8000-0000000a1130', 'CI');
insert into public.thread_participants (thread_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000b1130', '00000000-0000-4000-8000-00000000b130', 'buyer'),
  ('00000000-0000-4000-8000-0000000b1130', '00000000-0000-4000-8000-00000000c130', 'supplier');
insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
  values ('00000000-0000-4000-8000-0000000d1130', '00000000-0000-4000-8000-00000000b130', 'CI tee', 1000, 'pcs',
          array['00000000-0000-4000-8000-0000000a1130']::uuid[]);
insert into public.orders (id, buyer_id, supplier_id, product_title, quantity, quantity_unit, status)
  values ('00000000-0000-4000-8000-0000000e1130', '00000000-0000-4000-8000-00000000b130', '00000000-0000-4000-8000-0000000a1130', 'CI tee', 1000, 'pcs', 'in_production');

-- Sessions: two for the buyer, one for someone else.
insert into auth.sessions (id, user_id, user_agent) values
  ('00000000-0000-4000-8000-0000000f1130', '00000000-0000-4000-8000-00000000b130', 'Chrome'),
  ('00000000-0000-4000-8000-0000000f2130', '00000000-0000-4000-8000-00000000b130', 'Safari'),
  ('00000000-0000-4000-8000-0000000f3130', '00000000-0000-4000-8000-00000000d130', 'Firefox');

do $$
declare
  buyer    constant uuid := '00000000-0000-4000-8000-00000000b130';
  supplier constant uuid := '00000000-0000-4000-8000-00000000c130';
  admin    constant uuid := '00000000-0000-4000-8000-00000000a130';
  thread   constant uuid := '00000000-0000-4000-8000-0000000b1130';
  rfq      constant uuid := '00000000-0000-4000-8000-0000000d1130';
  ord      constant uuid := '00000000-0000-4000-8000-0000000e1130';
  hit      text;
  n        int;
  t        text;
begin
  for t in select unnest(array['messages', 'message_threads', 'rfqs', 'rfq_quotes', 'orders', 'order_milestones', 'claim_requests', 'supplier_relationships']) loop
    if not exists (select 1 from pg_trigger where tgname = 'trg_' || t || '_refuse_suspended' and tgrelid = ('public.' || t)::regclass) then
      raise exception 'no suspension trigger on %', t;
    end if;
  end loop;
  if has_function_privilege('anon', 'public._account_can_act(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._account_can_act(uuid)', 'execute') then
    raise exception 'the suspension check is callable by a client role';
  end if;

  -- An active buyer sends.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform public.thread_send_message(thread, 'hello before');
  reset role;
  if (select count(*) from public.messages where thread_id = thread) <> 1 then
    raise exception 'an active buyer could not send';
  end if;

  -- The admin suspends them: both of their sessions end, the other person's stays.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.admin_user_update(buyer, '{"is_suspended": true, "suspended_reason": "CI"}'::jsonb);
  reset role;
  if exists (select 1 from auth.sessions where user_id = buyer) then
    raise exception 'suspending left a session alive';
  end if;
  if not exists (select 1 from auth.sessions where id = '00000000-0000-4000-8000-0000000f3130') then
    raise exception 'suspending one person ended another''s session';
  end if;

  -- The suspended buyer is refused: a message, a milestone. Nothing is written.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  hit := null;
  begin
    perform public.thread_send_message(thread, 'hello after');
  exception when sqlstate '42501' then hit := sqlerrm;
  end;
  if hit is distinct from 'This account is suspended.' then
    raise exception 'a suspended buyer sent a message (%)', hit;
  end if;
  hit := null;
  begin
    perform public.order_milestone_add(ord, '{"kind":"qc_passed"}'::jsonb);
  exception when sqlstate '42501' then hit := sqlerrm;
  end;
  if hit is distinct from 'This account is suspended.' then
    raise exception 'a suspended buyer added a milestone (%)', hit;
  end if;
  reset role;
  if (select count(*) from public.messages where thread_id = thread) <> 1
     or (select count(*) from public.order_milestones where order_id = ord) <> 0 then
    raise exception 'a refused action still wrote a row';
  end if;

  -- The owner of the database is refused too, inserting straight into the table.
  hit := null;
  begin
    insert into public.messages (thread_id, sender_id, body_ciphertext, body_len)
    values (thread, buyer, pgp_sym_encrypt('x', 'k'), 1);
  exception when sqlstate '42501' then hit := sqlerrm;
  end;
  if hit is null then raise exception 'a direct insert for a suspended person went through'; end if;

  -- A suspended supplier cannot quote.
  update public.profiles set is_suspended = true, suspended_reason = 'CI' where id = supplier;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  hit := null;
  begin
    perform public.rfq_quote_submit(rfq, '{"unit_price": 2.5}'::jsonb);
  exception when sqlstate '42501' then hit := sqlerrm;
  end;
  if hit is distinct from 'This account is suspended.' then
    raise exception 'a suspended supplier quoted (%)', hit;
  end if;
  reset role;
  if exists (select 1 from public.rfq_quotes where rfq_id = rfq) then raise exception 'a refused quote was written'; end if;

  -- Un-suspended, the buyer acts again.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.admin_user_update(buyer, '{"is_suspended": false}'::jsonb);
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform public.thread_send_message(thread, 'hello again');
  reset role;
  select count(*) into n from public.messages where thread_id = thread;
  if n <> 2 then raise exception 'an un-suspended buyer could not send (% messages)', n; end if;
end
$$;

rollback;
