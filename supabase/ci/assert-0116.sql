-- Behaviour of sharing by workspace after 0116, asserted by running it: a member acts for the owner of the
-- workspace they were invited into (an owner, or a person on no team, acts for themselves); the role matrix;
-- a team reads the owner's saved suppliers and a stranger reads nothing of them; an editor and up save and
-- unsave on the owner's list, a viewer cannot, and nobody can write rows for another workspace; the reads that
-- total the saved suppliers count the workspace's (the dashboard and the compliance inputs).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a116', 'owner-0116@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b116', 'editor-0116@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c116', 'viewer-0116@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d116', 'approver-0116@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e116', 'stranger-0116@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.workspace_members (owner_id, member_id, role) values
  ('00000000-0000-4000-8000-00000000a116', '00000000-0000-4000-8000-00000000b116', 'editor'),
  ('00000000-0000-4000-8000-00000000a116', '00000000-0000-4000-8000-00000000c116', 'viewer'),
  ('00000000-0000-4000-8000-00000000a116', '00000000-0000-4000-8000-00000000d116', 'approver');

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000c1161', 'ci-0116-a', 'CI Knit 0116', 'ci knit 0116', 'Dhaka', 'Dhaka', false, false),
  ('00000000-0000-4000-8000-0000000c1162', 'ci-0116-b', 'CI Woven 0116', 'ci woven 0116', 'Dhaka', 'Dhaka', false, false);
insert into public.source_records (id, supplier_id, source_id, source_tier, source_ref, fields, fetched_at)
select '00000000-0000-4000-8000-0000000d1161', '00000000-0000-4000-8000-0000000c1161', s.id, s.tier, 'F-1',
       '{"factory_address":"Plot 4, Gazipur"}'::jsonb, '2026-09-30'::timestamptz
  from public.sources s where s.code = 'RSC';
update public.suppliers set is_published = true where id = '00000000-0000-4000-8000-0000000c1161';

insert into public.saved_suppliers (owner_id, supplier_id) values
  ('00000000-0000-4000-8000-00000000a116', '00000000-0000-4000-8000-0000000c1161');

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', case when p_user is null then '' else jsonb_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
end
$$;

do $$
declare
  o  constant uuid := '00000000-0000-4000-8000-00000000a116';
  e  constant uuid := '00000000-0000-4000-8000-00000000b116';
  v  constant uuid := '00000000-0000-4000-8000-00000000c116';
  a  constant uuid := '00000000-0000-4000-8000-00000000d116';
  x  constant uuid := '00000000-0000-4000-8000-00000000e116';
  p  constant uuid := '00000000-0000-4000-8000-0000000c1161';
  q  constant uuid := '00000000-0000-4000-8000-0000000c1162';
  n  int;
  fn text;
  act text;
  who uuid;
  expect_ok boolean;
begin
  foreach fn in array array['public.workspace_owner()', 'public.workspace_role()', 'public.workspace_can(text)'] loop
    if has_function_privilege('anon', fn, 'execute') or not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'the grants of % are wrong', fn;
    end if;
  end loop;

  set local role authenticated;

  -- Whose data, and what role.
  foreach who in array array[e, v, a] loop
    perform pg_temp.act_as(who);
    if public.workspace_owner() <> o then raise exception 'a member does not act for the owner'; end if;
  end loop;
  perform pg_temp.act_as(o);
  if public.workspace_owner() <> o or public.workspace_role() <> 'owner' then raise exception 'the owner acts for someone else'; end if;
  perform pg_temp.act_as(x);
  if public.workspace_owner() <> x or public.workspace_role() <> 'owner' then raise exception 'a person on no team does not act for themselves'; end if;
  perform pg_temp.act_as(null);
  if public.workspace_role() is not null or public.workspace_can('read') then raise exception 'nobody signed in has a role'; end if;
  perform pg_temp.act_as(e);
  if public.workspace_role() <> 'editor' then raise exception 'the editor is %', public.workspace_role(); end if;

  -- The matrix: role, action, allowed.
  for who, act, expect_ok in
    select * from (values
      (v, 'read', true),  (v, 'save', false), (v, 'rfq_send', false), (v, 'quote_accept', false), (v, 'sign_off', false), (v, 'team', false),
      (e, 'read', true),  (e, 'save', true),  (e, 'rfq_send', true),  (e, 'order', true), (e, 'message', true), (e, 'quote_accept', true), (e, 'sign_off', false), (e, 'company', false), (e, 'team', false), (e, 'plan', false),
      (a, 'read', true),  (a, 'save', true),  (a, 'sign_off', true),  (a, 'team', false), (a, 'plan', false),
      (o, 'read', true),  (o, 'save', true),  (o, 'sign_off', true),  (o, 'company', true), (o, 'team', true), (o, 'plan', true),
      (o, 'something_else', false), (o, null, false)
    ) t(w, ac, ok)
  loop
    perform pg_temp.act_as(who);
    if coalesce(public.workspace_can(act), false) is distinct from expect_ok then
      raise exception 'workspace_can(%) for % was %, expected %', act, who, public.workspace_can(act), expect_ok;
    end if;
  end loop;

  -- Reading the owner's saved suppliers.
  foreach who in array array[o, e, v, a] loop
    perform pg_temp.act_as(who);
    select count(*) into n from public.saved_suppliers;
    if n <> 1 then raise exception 'a team member % saw % saved rows', who, n; end if;
  end loop;
  perform pg_temp.act_as(x);
  select count(*) into n from public.saved_suppliers;
  if n <> 0 then raise exception 'a stranger saw % saved rows', n; end if;

  -- The reads that total them.
  foreach who in array array[o, e, v] loop
    perform pg_temp.act_as(who);
    if (public.compliance_msa_inputs()->>'total_saved')::int <> 1 then
      raise exception 'compliance_msa_inputs for % counted %', who, public.compliance_msa_inputs()->>'total_saved';
    end if;
    if (public.buyer_dashboard()->>'saved_count')::int <> 1 then
      raise exception 'buyer_dashboard for % counted %', who, public.buyer_dashboard()->>'saved_count';
    end if;
  end loop;
  perform pg_temp.act_as(x);
  if (public.compliance_msa_inputs()->>'total_saved')::int <> 0 or (public.buyer_dashboard()->>'saved_count')::int <> 0 then
    raise exception 'a stranger was counted the workspace''s saved suppliers';
  end if;

  -- Writing: editors and up save on the OWNER's list; a viewer cannot; nobody writes another workspace's rows.
  perform pg_temp.act_as(v);
  begin
    insert into public.saved_suppliers (owner_id, supplier_id) values (o, q);
    raise exception 'a viewer saved a supplier';
  exception when insufficient_privilege then null;
  end;
  delete from public.saved_suppliers where owner_id = o and supplier_id = p;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a viewer unsaved a supplier'; end if;

  perform pg_temp.act_as(e);
  insert into public.saved_suppliers (owner_id, supplier_id) values (o, q);
  begin
    insert into public.saved_suppliers (owner_id, supplier_id) values (e, p);
    raise exception 'a member wrote a row of their own while on a team';
  exception when insufficient_privilege then null;
  end;
  delete from public.saved_suppliers where owner_id = o and supplier_id = q;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'an editor could not unsave'; end if;

  perform pg_temp.act_as(x);
  begin
    insert into public.saved_suppliers (owner_id, supplier_id) values (o, q);
    raise exception 'a stranger saved on someone else''s list';
  exception when insufficient_privilege then null;
  end;
  insert into public.saved_suppliers (owner_id, supplier_id) values (x, q);

  perform pg_temp.act_as(a);
  insert into public.saved_suppliers (owner_id, supplier_id) values (o, q);

  reset role;
  if (select count(*) from public.saved_suppliers where owner_id = o) <> 2 then
    raise exception 'the owner''s list is not what the writes left';
  end if;
end
$$;

rollback;
