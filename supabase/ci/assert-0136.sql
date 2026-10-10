-- 0136 asserted by running it: an RFQ and a quote written while the record's triggers were off (as the
-- pre-6 Oct rows were) each get one as-found entry naming the buyer, the supplier and the row as it
-- stands; a second run writes nothing; a row the triggers already recorded is never written twice; no
-- client role can call the backfill.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a136', 'buyer-0136@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b136', 'supplier-0136@example.invalid', '{"role":"supplier"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-4000-8000-0000000a1136', 'ci-0136-knit', 'CI 0136 Knit Ltd', 'ci 0136 knit ltd', 'Dhaka', 'Dhaka', false, false,
          '00000000-0000-4000-8000-00000000b136');

-- The old rows: written with every trigger off, so the record has never seen them.
set local session_replication_role = replica;
insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
  values ('00000000-0000-4000-8000-0000000d1136', '00000000-0000-4000-8000-00000000a136', 'CI old draft', 500, 'pcs',
          array['00000000-0000-4000-8000-0000000a1136'::uuid]);
insert into public.rfq_quotes (id, rfq_id, supplier_id, submitted_by, unit_price, notes)
  values ('00000000-0000-4000-8000-0000000c1136', '00000000-0000-4000-8000-0000000d1136',
          '00000000-0000-4000-8000-0000000a1136', '00000000-0000-4000-8000-00000000b136', 3.1, 'CI old quote');
set local session_replication_role = origin;

-- The old RFQ is edited after the record went live: the trigger writes rfq.updated, not rfq.sent.
update public.rfqs set product_title = 'CI old tee' where id = '00000000-0000-4000-8000-0000000d1136';

-- A new RFQ the trigger records itself.
insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
  values ('00000000-0000-4000-8000-0000000e1136', '00000000-0000-4000-8000-00000000a136', 'CI new tee', 500, 'pcs',
          array['00000000-0000-4000-8000-0000000a1136'::uuid]);

do $$
declare
  buyer    constant uuid := '00000000-0000-4000-8000-00000000a136';
  supplier constant uuid := '00000000-0000-4000-8000-00000000b136';
  company  constant uuid := '00000000-0000-4000-8000-0000000a1136';
  old_rfq  constant uuid := '00000000-0000-4000-8000-0000000d1136';
  new_rfq  constant uuid := '00000000-0000-4000-8000-0000000e1136';
  quote    constant uuid := '00000000-0000-4000-8000-0000000c1136';
  e        record;
  n        int;
begin
  if has_function_privilege('authenticated', 'public._ledger_as_found_rfqs()', 'execute')
     or has_function_privilege('anon', 'public._ledger_as_found_rfqs()', 'execute')
     or has_function_privilege('service_role', 'public._ledger_as_found_rfqs()', 'execute') then
    raise exception 'a client role can call the as-found backfill';
  end if;

  perform public._ledger_as_found_rfqs();

  select * into e from public.activity_ledger where kind = 'rfq.sent' and rfq_id = old_rfq;
  if e.id is null or e.actor_id <> buyer or e.actor_email <> 'buyer-0136@example.invalid'
     or e.content ->> 'as_found' <> 'true' or e.content -> 'after' ->> 'product_title' <> 'CI old tee'
     or e.content -> 'after' ->> 'created_at' is null then
    raise exception 'the old RFQ''s as-found entry is wrong: %', to_jsonb(e);
  end if;

  select * into e from public.activity_ledger where kind = 'quote.submitted' and target_id = quote;
  if e.id is null or e.actor_id <> supplier or e.other_party_id <> buyer or e.supplier_id <> company
     or e.rfq_id <> old_rfq or e.content ->> 'as_found' <> 'true' or e.content -> 'after' ->> 'notes' <> 'CI old quote'
     or e.content -> 'after' ? 'buyer_id' then
    raise exception 'the old quote''s as-found entry is wrong: %', to_jsonb(e);
  end if;

  select count(*) into n from public.activity_ledger where rfq_id = new_rfq;
  if n <> 1 then raise exception 'the trigger-recorded RFQ has % entries, want 1', n; end if;

  if public._ledger_as_found_rfqs() <> 0 then
    raise exception 'a second run wrote entries';
  end if;
  select count(*) into n from public.activity_ledger where rfq_id in (old_rfq, new_rfq);
  if n <> 4 then raise exception 'want 4 entries (updated, as-found sent, as-found quote, new sent) after two runs, got %', n; end if;
end
$$;

rollback;
