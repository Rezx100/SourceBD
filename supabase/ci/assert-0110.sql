-- Behaviour of order_cancel after 0110, asserted by running it: a draft or
-- in-production order cancels; a shipped, in-transit, delivered or cancelled
-- one is refused and keeps its status; another buyer's order and a signed-out
-- caller are refused; anon cannot execute it.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a110', 'ci-0110@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b110', 'ci-0110-other@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned)
values ('ci-0110', 'CI 0110 Ltd', 'ci 0110 ltd', 'Dhaka', 'Dhaka', false, false)
on conflict (slug) do nothing;

insert into public.orders (id, buyer_id, supplier_id, product_title, quantity, quantity_unit, status)
select ('00000000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid,
       '00000000-0000-4000-8000-00000000a110',
       (select id from public.suppliers where slug = 'ci-0110'),
       'CI polo', 100, 'pcs', s::public.order_status
  from unnest(array['draft', 'in_production', 'shipped', 'in_transit', 'delivered', 'cancelled'])
       with ordinality as t(s, i);

do $$
declare
  r     record;
  hit   text;
  after public.order_status;
  todo  jsonb;
begin
  -- Read as the owner of the database: the orders read policy also looks at
  -- suppliers, which `authenticated` cannot read in CI. Only the calls to
  -- order_cancel run as the signed-in buyer.
  select jsonb_agg(jsonb_build_object('id', id, 'status', status) order by id) into todo
    from public.orders where buyer_id = '00000000-0000-4000-8000-00000000a110';

  if has_function_privilege('anon', 'public.order_cancel(uuid)', 'execute') then
    raise exception 'anon can execute order_cancel';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a110', true);

  for r in select (e->>'id')::uuid as id, e->>'status' as status from jsonb_array_elements(todo) e loop
    hit := null;
    begin
      perform public.order_cancel(r.id);
    exception when raise_exception then
      hit := sqlerrm;
    end;
    reset role;
    select status into after from public.orders where id = r.id;
    set local role authenticated;
    if r.status in ('draft', 'in_production') then
      if hit is not null or after <> 'cancelled' then
        raise exception 'a % order did not cancel: % / %', r.status, hit, after;
      end if;
    elsif r.status = 'cancelled' then
      if hit is distinct from 'This order is already cancelled.' then
        raise exception 'a cancelled order was not refused as such: %', hit;
      end if;
    else
      if hit is distinct from 'This order has shipped, so it can no longer be cancelled.'
         or after::text <> r.status then
        raise exception 'a % order was cancelled or refused wrongly: % / %', r.status, hit, after;
      end if;
    end if;
  end loop;

  -- Someone else's order: refused as not theirs, before its status is read.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b110', true);
  hit := null;
  begin
    perform public.order_cancel('00000000-0000-4000-8000-000000000103');
  exception when sqlstate '42501' then
    hit := 'refused';
  end;
  if hit is null then
    raise exception 'another buyer reached order_cancel on an order they do not own';
  end if;

  -- Signed out: refused.
  perform set_config('request.jwt.claim.sub', '', true);
  hit := null;
  begin
    perform public.order_cancel('00000000-0000-4000-8000-000000000101');
  exception when sqlstate '28000' then
    hit := 'refused';
  end;
  if hit is null then
    raise exception 'order_cancel ran with no signed-in user';
  end if;
  reset role;
end
$$;

rollback;
