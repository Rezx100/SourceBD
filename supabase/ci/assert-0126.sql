-- 0126 asserted by reading as a signed-in buyer: every table whose policy asks "has the caller claimed this
-- supplier" can be read without "permission denied for table suppliers", a buyer sees their own RFQ, a claimed
-- supplier sees the RFQ sent to it, a stranger sees neither, and claimed_by itself stays unreadable (REZ-22).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000126b1', 'ci-0126-buyer@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000126c1', 'ci-0126-supplier@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000126d1', 'ci-0126-stranger@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;
insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-0000-0000-0000000126a1', 'ci-0126-knit', 'CI 0126 Knit Ltd', 'ci 0126 knit ltd', 'Dhaka', 'Dhaka',
          false, false, '00000000-0000-0000-0000-0000000126c1');
insert into public.rfqs (id, buyer_id, product_title, quantity, quantity_unit, target_supplier_ids)
  values ('00000000-0000-0000-0000-0000000126f1', '00000000-0000-0000-0000-0000000126b1', 'CI tee', 1000, 'pcs',
          array['00000000-0000-0000-0000-0000000126a1']::uuid[]);

set local role authenticated;

do $$
declare
  n bigint;
  t text;
begin
  -- The buyer: every policed table reads, and their own RFQ is there.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000126b1', true);
  foreach t in array array['rfqs', 'rfq_quotes', 'orders', 'order_milestones', 'supplier_relationships'] loop
    execute format('select count(*) from public.%I', t) into n;
  end loop;
  select count(*) into n from public.rfqs where buyer_id = '00000000-0000-0000-0000-0000000126b1';
  if n <> 1 then raise exception 'the buyer reads % of their own RFQs, expected 1', n; end if;

  -- The supplier's claimant sees the RFQ sent to it.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000126c1', true);
  select count(*) into n from public.rfqs where id = '00000000-0000-0000-0000-0000000126f1';
  if n <> 1 then raise exception 'the claimed supplier reads % of the RFQs sent to it, expected 1', n; end if;

  -- A stranger sees nothing.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000126d1', true);
  select count(*) into n from public.rfqs where id = '00000000-0000-0000-0000-0000000126f1';
  if n <> 0 then raise exception 'a stranger reads another buyer''s RFQ'; end if;
end
$$;

reset role;

do $$
begin
  if has_column_privilege('authenticated', 'public.suppliers', 'claimed_by', 'select') then
    raise exception 'authenticated can read suppliers.claimed_by again (REZ-22)';
  end if;
  if has_function_privilege('anon', 'public.claimed_supplier_ids()', 'execute') then
    raise exception 'anon can execute claimed_supplier_ids';
  end if;
end
$$;

rollback;
