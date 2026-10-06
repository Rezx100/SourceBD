-- 0131 asserted by running it: a message sent through thread_send_message writes one entry with the sender,
-- their email and role, the other party, the conversation, the supplier, the request's two addresses and
-- browser, the session, and the text's fingerprint but never the text; an RFQ, a quote, its acceptance, an
-- order and a milestone each write their kind with the row before and after; a touch of updated_at writes
-- nothing; a delete writes the row as it was; the record refuses UPDATE, DELETE and TRUNCATE even from the
-- owner; a signed-in user cannot read it or call the writer; the supplier user's company is named.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a131', 'buyer-0131@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b131', 'supplier-0131@example.invalid', '{"role":"supplier"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-4000-8000-0000000a1131', 'ci-0131-knit', 'CI 0131 Knit Ltd', 'ci 0131 knit ltd', 'Dhaka', 'Dhaka', false, false,
          '00000000-0000-4000-8000-00000000b131');

do $$
declare
  buyer    constant uuid := '00000000-0000-4000-8000-00000000a131';
  supplier constant uuid := '00000000-0000-4000-8000-00000000b131';
  company  constant uuid := '00000000-0000-4000-8000-0000000a1131';
  thread   constant uuid := '00000000-0000-4000-8000-0000000b1131';
  rfq      constant uuid := '00000000-0000-4000-8000-0000000d1131';
  ord      constant uuid := '00000000-0000-4000-8000-0000000e1131';
  sess     constant uuid := '00000000-0000-4000-8000-0000000f1131';
  e        record;
  n        int;
  hit      text;
  quote    uuid;
  msg      uuid;
begin
  -- Grants and shape.
  if has_table_privilege('authenticated', 'public.activity_ledger', 'select')
     or has_table_privilege('authenticated', 'public.activity_ledger', 'insert')
     or has_table_privilege('anon', 'public.activity_ledger', 'select')
     or has_table_privilege('service_role', 'public.activity_ledger', 'update')
     or has_table_privilege('service_role', 'public.activity_ledger', 'delete') then
    raise exception 'a client role can touch the record';
  end if;
  if has_function_privilege('authenticated', 'public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)', 'execute')
     or has_function_privilege('service_role', 'public._ledger_write(text, text, uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)', 'execute') then
    raise exception 'a client role can call the writer';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.activity_ledger'::regclass) then
    raise exception 'RLS is off on the record';
  end if;

  -- A conversation opened directly (no caller): the actor is the row's buyer.
  insert into public.message_threads (id, buyer_id, supplier_id, subject) values (thread, buyer, company, 'CI');
  insert into public.thread_participants (thread_id, user_id, role) values (thread, buyer, 'buyer'), (thread, supplier, 'supplier');
  select * into e from public.activity_ledger where kind = 'conversation.opened' and thread_id = thread;
  if e.id is null or e.actor_id <> buyer or e.supplier_id <> company or e.other_party_id <> supplier then
    raise exception 'conversation.opened is wrong: %', to_jsonb(e);
  end if;

  -- The buyer sends a message from a known address, browser and session.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', buyer, 'session_id', sess)::text, true);
  perform set_config('request.headers', '{"x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-sourcebd-ip": "198.51.100.7:51234", "x-sourcebd-ua": "CI Browser/1.0", "user-agent": "node"}', true);
  msg := public.thread_send_message(thread, 'hello ledger');
  reset role;
  select * into e from public.activity_ledger where kind = 'message.sent' and target_id = msg;
  if e.id is null then raise exception 'no message.sent entry'; end if;
  if e.actor_id <> buyer or e.actor_email <> 'buyer-0131@example.invalid' or e.actor_role <> 'buyer' then
    raise exception 'the sender is wrong: % % %', e.actor_id, e.actor_email, e.actor_role;
  end if;
  if e.other_party_id <> supplier or e.thread_id <> thread or e.supplier_id <> company then
    raise exception 'the parties are wrong: %', to_jsonb(e);
  end if;
  if e.ip_gateway <> '203.0.113.9'::inet or e.ip_forwarded <> '198.51.100.7'::inet or e.user_agent <> 'CI Browser/1.0' or e.session_id <> sess then
    raise exception 'where it came from is wrong: % % % %', e.ip_gateway, e.ip_forwarded, e.user_agent, e.session_id;
  end if;
  if e.content ->> 'body_sha256' <> encode(extensions.digest('hello ledger', 'sha256'), 'hex') then
    raise exception 'the fingerprint is not the text''s sha256';
  end if;
  if e.content::text like '%hello ledger%' or e.content::text like '%body_ciphertext%' then
    raise exception 'the record copied the message';
  end if;
  if (e.content -> 'after' ->> 'body_len')::int <> 12 then raise exception 'the copy lacks the metadata'; end if;
  if e.content_hash !~ '^[0-9a-f]{64}$' then raise exception 'no entry fingerprint'; end if;
  if e.target_table <> 'messages' then raise exception 'target_table is %', e.target_table; end if;

  -- An RFQ written directly, then cancelled; a touch of updated_at alone writes nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
    values (rfq, buyer, 'CI tee', 1000, 'pcs', array[company]);
  select * into e from public.activity_ledger where kind = 'rfq.sent' and rfq_id = rfq;
  if e.id is null or e.actor_id <> buyer or (e.content -> 'after' -> 'target_supplier_ids' ->> 0)::uuid <> company then
    raise exception 'rfq.sent is wrong: %', to_jsonb(e);
  end if;
  select count(*) into n from public.activity_ledger;
  update public.rfqs set updated_at = now() where id = rfq;
  if (select count(*) from public.activity_ledger) <> n then raise exception 'a touch wrote an entry'; end if;
  update public.rfqs set product_title = 'CI polo', updated_at = now() where id = rfq;
  select * into e from public.activity_ledger where kind = 'rfq.updated' and rfq_id = rfq;
  if e.id is null or e.content -> 'changed' <> '["product_title"]'::jsonb
     or e.content -> 'before' ->> 'product_title' <> 'CI tee' or e.content -> 'after' ->> 'product_title' <> 'CI polo' then
    raise exception 'the edit is not a kept version: %', e.content;
  end if;

  -- The supplier quotes; the buyer accepts; both are recorded as who did them, and the company is named.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  quote := public.rfq_quote_submit(rfq, '{"unit_price": 2.5, "notes": "CI quote"}'::jsonb);
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform public.rfq_quote_accept(quote);
  reset role;
  select * into e from public.activity_ledger where kind = 'quote.submitted' and target_id = quote;
  if e.id is null or e.actor_id <> supplier or e.actor_company <> 'CI 0131 Knit Ltd' or e.other_party_id <> buyer
     or e.content -> 'after' ->> 'notes' <> 'CI quote' then
    raise exception 'quote.submitted is wrong: %', to_jsonb(e);
  end if;
  select * into e from public.activity_ledger where kind = 'quote.accepted' and target_id = quote;
  if e.id is null or e.actor_id <> buyer then raise exception 'quote.accepted is not the buyer''s: %', to_jsonb(e); end if;
  if not exists (select 1 from public.activity_ledger where kind = 'rfq.accepted' and rfq_id = rfq and actor_id = buyer) then
    raise exception 'no rfq.accepted entry';
  end if;

  -- An order and a milestone.
  insert into public.orders (id, buyer_id, supplier_id, rfq_id, product_title, quantity, quantity_unit)
    values (ord, buyer, company, rfq, 'CI polo', 1000, 'pcs');
  insert into public.order_milestones (order_id, kind, occurred_on, created_by) values (ord, 'po_issued', current_date, buyer);
  if not exists (select 1 from public.activity_ledger where kind = 'order.created' and order_id = ord and supplier_id = company and other_party_id = supplier) then
    raise exception 'no order.created entry';
  end if;
  if not exists (select 1 from public.activity_ledger where kind = 'order.milestone_added' and order_id = ord and actor_id = buyer and rfq_id = rfq) then
    raise exception 'no order.milestone_added entry';
  end if;
  update public.orders set status = 'cancelled' where id = ord;
  if not exists (select 1 from public.activity_ledger where kind = 'order.cancelled' and order_id = ord) then
    raise exception 'no order.cancelled entry';
  end if;

  -- A delete is written down as the row was.
  delete from public.order_milestones where order_id = ord;
  select * into e from public.activity_ledger where kind = 'order.deleted' and order_id = ord;
  if e.id is null or e.content -> 'before' ->> 'kind' <> 'po_issued' then raise exception 'the delete was not recorded: %', to_jsonb(e); end if;

  -- The record refuses change, even from the owner.
  foreach hit in array array[
    'update public.activity_ledger set reason = ''x'' where id = (select min(id) from public.activity_ledger)',
    'delete from public.activity_ledger where id = (select min(id) from public.activity_ledger)',
    'truncate public.activity_ledger'
  ] loop
    begin
      execute hit;
      raise exception 'the record accepted: %', hit;
    exception when sqlstate '42501' then null;
    end;
  end loop;

  -- A signed-in person cannot read it.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  hit := null;
  begin
    perform count(*) from public.activity_ledger;
  exception when insufficient_privilege then hit := 'refused';
  end;
  if hit is null then raise exception 'a signed-in person read the record'; end if;
  reset role;
end
$$;

rollback;
