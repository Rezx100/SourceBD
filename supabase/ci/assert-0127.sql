-- 0127 asserted by running it: a buyer with a conversation, an RFQ, a quote, an order and a claim cannot be
-- deleted, nor can the supplier on the other side, nor a conversation that holds messages; a sign-up with no
-- dealings still can; no dealing table keeps a cascade back to a person or a company; and the review queue's
-- supplier merge leaves the loser's conversations, RFQs, orders and claims where they were.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a127', 'buyer-0127@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b127', 'supplier-0127@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c127', 'nobody-0127@example.invalid',   '{"role":"buyer"}'::jsonb)
on conflict do nothing;

-- Not published: the publish trigger wants a Tier 1-3 source record, and nothing here reads the flag.
insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by) values
  ('00000000-0000-4000-8000-0000000a1127', 'ci-0127-loser',  'CI 0127 Knit Ltd',      'ci 0127 knit ltd',      'Dhaka', 'Dhaka', false, false, '00000000-0000-4000-8000-00000000b127'),
  ('00000000-0000-4000-8000-0000000a2127', 'ci-0127-winner', 'CI 0127 Knit Limited',  'ci 0127 knit limited',  'Dhaka', 'Dhaka', false, false, null);

-- One of everything, on the loser.
insert into public.message_threads (id, buyer_id, supplier_id, subject)
  values ('00000000-0000-4000-8000-0000000b1127', '00000000-0000-4000-8000-00000000a127', '00000000-0000-4000-8000-0000000a1127', 'CI');
insert into public.thread_participants (thread_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000b1127', '00000000-0000-4000-8000-00000000a127', 'buyer'),
  ('00000000-0000-4000-8000-0000000b1127', '00000000-0000-4000-8000-00000000b127', 'supplier');
insert into public.messages (id, thread_id, sender_id, body_ciphertext, body_len)
  values ('00000000-0000-4000-8000-0000000c1127', '00000000-0000-4000-8000-0000000b1127', '00000000-0000-4000-8000-00000000a127', pgp_sym_encrypt('hello', 'ci-key-0127'), 5);
insert into public.message_attachments (message_id, thread_id, object_path, file_name)
  values ('00000000-0000-4000-8000-0000000c1127', '00000000-0000-4000-8000-0000000b1127', '00000000-0000-4000-8000-0000000b1127/x/y/spec.pdf', 'spec.pdf');
insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
  values ('00000000-0000-4000-8000-0000000d1127', '00000000-0000-4000-8000-00000000a127', 'CI tee', 1000, 'pcs', array['00000000-0000-4000-8000-0000000a1127']::uuid[]);
insert into public.rfq_quotes (rfq_id, supplier_id, submitted_by, unit_price)
  values ('00000000-0000-4000-8000-0000000d1127', '00000000-0000-4000-8000-0000000a1127', '00000000-0000-4000-8000-00000000b127', 2.5);
insert into public.orders (id, buyer_id, supplier_id, product_title, quantity, quantity_unit)
  values ('00000000-0000-4000-8000-0000000e1127', '00000000-0000-4000-8000-00000000a127', '00000000-0000-4000-8000-0000000a1127', 'CI tee', 1000, 'pcs');
insert into public.order_milestones (order_id, kind, occurred_on, created_by)
  values ('00000000-0000-4000-8000-0000000e1127', 'po_issued', current_date, '00000000-0000-4000-8000-00000000a127');
insert into public.claim_requests (supplier_id, claimant_user_id, proof_email, proof_email_domain, method, status)
  values ('00000000-0000-4000-8000-0000000a1127', '00000000-0000-4000-8000-00000000b127', 'x@ci-0127.example', 'ci-0127.example', 'manual_review', 'email_verified');
insert into public.evidence_pack_downloads (owner_id, sections, format, supplier_count, row_count)
  values ('00000000-0000-4000-8000-00000000a127', array['sources'], 'csv', 1, 1);

do $$
declare
  n int;
  refused boolean;
  bad text;
begin
  -- 1. No dealing table keeps a cascade (or a set-null) back to a person or a company.
  select string_agg(c.conrelid::regclass::text || '.' || a.attname || '=' || c.confdeltype, ', ')
    into bad
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.contype = 'f'
     and c.confdeltype <> 'r'
     and (c.conrelid::regclass::text, a.attname) in (
       ('message_threads', 'buyer_id'), ('message_threads', 'supplier_id'),
       ('thread_participants', 'thread_id'), ('thread_participants', 'user_id'),
       ('messages', 'thread_id'), ('messages', 'sender_id'),
       ('message_attachments', 'message_id'), ('message_attachments', 'thread_id'),
       ('rfqs', 'buyer_id'), ('rfq_quotes', 'rfq_id'), ('rfq_quotes', 'supplier_id'), ('rfq_quotes', 'submitted_by'),
       ('orders', 'buyer_id'), ('orders', 'supplier_id'), ('order_milestones', 'order_id'),
       ('claim_requests', 'supplier_id'), ('claim_requests', 'claimant_user_id'),
       ('evidence_pack_downloads', 'owner_id'), ('admin_audit_log', 'actor_id'));
  if bad is not null then
    raise exception 'a dealing table still cascades or nulls: %', bad;
  end if;

  -- 2. The buyer with dealings cannot be deleted, even by the owner of the database.
  refused := false;
  begin
    delete from auth.users where id = '00000000-0000-4000-8000-00000000a127';
  exception when foreign_key_violation then
    refused := true;
  end;
  if not refused then raise exception 'a buyer with dealings was deleted'; end if;

  -- 3. Nor the supplier user, nor the supplier company.
  refused := false;
  begin
    delete from auth.users where id = '00000000-0000-4000-8000-00000000b127';
  exception when foreign_key_violation then
    refused := true;
  end;
  if not refused then raise exception 'a supplier user with dealings was deleted'; end if;
  refused := false;
  begin
    delete from public.suppliers where id = '00000000-0000-4000-8000-0000000a1127';
  exception when foreign_key_violation then
    refused := true;
  end;
  if not refused then raise exception 'a supplier with dealings was deleted'; end if;

  -- 4. A conversation that holds messages cannot be deleted either, nor an RFQ with a quote, nor an order
  --    with a milestone, nor a message with a file.
  foreach bad in array array[
    'delete from public.message_threads where id = ''00000000-0000-4000-8000-0000000b1127''',
    'delete from public.rfqs where id = ''00000000-0000-4000-8000-0000000d1127''',
    'delete from public.orders where id = ''00000000-0000-4000-8000-0000000e1127''',
    'delete from public.messages where id = ''00000000-0000-4000-8000-0000000c1127'''
  ] loop
    refused := false;
    begin
      execute bad;
    exception when foreign_key_violation then
      refused := true;
    end;
    if not refused then raise exception 'this was not refused: %', bad; end if;
  end loop;

  -- 5. Everything is still there.
  select count(*) into n from public.messages where thread_id = '00000000-0000-4000-8000-0000000b1127';
  if n <> 1 then raise exception 'the message is gone'; end if;

  -- 6. A sign-up with no dealings can still be deleted (the profile goes with it).
  delete from auth.users where id = '00000000-0000-4000-8000-00000000c127';
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000c127') then
    raise exception 'the profile of a deleted sign-up stayed behind';
  end if;

  -- 7. The review queue's merge: the loser is hidden, not deleted, and its dealings stay on it.
  perform public._queue_absorb_supplier('00000000-0000-4000-8000-0000000a2127', '00000000-0000-4000-8000-0000000a1127');
  if not exists (select 1 from public.suppliers where id = '00000000-0000-4000-8000-0000000a1127') then
    raise exception 'the merge deleted the loser';
  end if;
  if (select supplier_id from public.message_threads where id = '00000000-0000-4000-8000-0000000b1127') <> '00000000-0000-4000-8000-0000000a1127'
     or (select supplier_id from public.orders where id = '00000000-0000-4000-8000-0000000e1127') <> '00000000-0000-4000-8000-0000000a1127'
     or not exists (select 1 from public.rfqs where id = '00000000-0000-4000-8000-0000000d1127' and '00000000-0000-4000-8000-0000000a1127' = any (target_supplier_ids))
     or not exists (select 1 from public.claim_requests where supplier_id = '00000000-0000-4000-8000-0000000a1127') then
    raise exception 'the merge moved or lost a dealing';
  end if;
end
$$;

rollback;
