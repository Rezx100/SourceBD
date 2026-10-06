-- 0134 asserted by running it: a supplier accepting the terms writes account.terms_accepted as themselves;
-- an admin suspending them writes account.suspended as the admin with the person as the other party; a
-- "last active" touch writes nothing; saving and unsaving a supplier, a claim started and approved, a team
-- member joining, reading a conversation and a partner request each write their kind; a supplier row
-- changed with nobody signed in writes nothing, changed by a person writes supplier.profile_edited;
-- ledger_note writes a read as the caller, refuses a kind it does not take, an oversized content, anon;
-- a note naming a slug gets the supplier's id.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a134', 'admin-0134@example.invalid',    '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b134', 'buyer-0134@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c134', 'supplier-0134@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d134', 'member-0134@example.invalid',   '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by) values
  ('00000000-0000-4000-8000-0000000a1134', 'ci-0134-knit', 'CI 0134 Knit Ltd', 'ci 0134 knit ltd', 'Dhaka', 'Dhaka', false, false, '00000000-0000-4000-8000-00000000c134'),
  ('00000000-0000-4000-8000-0000000a2134', 'ci-0134-house', 'CI 0134 House', 'ci 0134 house', 'Dhaka', 'Dhaka', false, false, null);

do $$
declare
  admin    constant uuid := '00000000-0000-4000-8000-00000000a134';
  buyer    constant uuid := '00000000-0000-4000-8000-00000000b134';
  supplier constant uuid := '00000000-0000-4000-8000-00000000c134';
  member   constant uuid := '00000000-0000-4000-8000-00000000d134';
  company  constant uuid := '00000000-0000-4000-8000-0000000a1134';
  house    constant uuid := '00000000-0000-4000-8000-0000000a2134';
  thread   constant uuid := '00000000-0000-4000-8000-0000000b1134';
  e        record;
  n        int;
  hit      text;
  claim    uuid;
begin
  if has_function_privilege('anon', 'public.ledger_note(text, text, uuid, jsonb, uuid, uuid, uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.terms_accept(text)', 'execute') then
    raise exception 'anon can call a 0134 function';
  end if;

  -- The supplier accepts the terms: recorded as themselves.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  perform public.terms_accept('2026-10-05');
  reset role;
  select * into e from public.activity_ledger where kind = 'account.terms_accepted' and target_id = supplier;
  if e.id is null or e.actor_id <> supplier or e.other_party_id is not null or e.content -> 'after' ->> 'terms_version' <> '2026-10-05' then
    raise exception 'account.terms_accepted is wrong: %', to_jsonb(e);
  end if;

  -- A "last active" touch writes nothing.
  select count(*) into n from public.activity_ledger;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform public.profile_touch();
  reset role;
  if (select count(*) from public.activity_ledger) <> n then raise exception 'profile_touch wrote an entry'; end if;

  -- The admin suspends the buyer: the admin is the actor, the buyer the other party.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.admin_user_update(buyer, '{"is_suspended": true, "suspended_reason": "CI"}'::jsonb);
  perform public.admin_user_update(buyer, '{"is_suspended": false}'::jsonb);
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);   -- the owner's own writes below have no caller
  select * into e from public.activity_ledger where kind = 'account.suspended' and target_id = buyer;
  if e.id is null or e.actor_id <> admin or e.other_party_id <> buyer or e.actor_role <> 'admin' then
    raise exception 'account.suspended is wrong: %', to_jsonb(e);
  end if;
  if not exists (select 1 from public.activity_ledger where kind = 'account.unsuspended' and target_id = buyer and actor_id = admin) then
    raise exception 'no account.unsuspended entry';
  end if;

  -- Saving and unsaving.
  insert into public.saved_suppliers (owner_id, supplier_id) values (buyer, company);
  delete from public.saved_suppliers where owner_id = buyer and supplier_id = company;
  if not exists (select 1 from public.activity_ledger where kind = 'supplier.saved' and actor_id = buyer and supplier_id = company)
     or not exists (select 1 from public.activity_ledger where kind = 'supplier.unsaved' and actor_id = buyer and supplier_id = company) then
    raise exception 'saving was not recorded';
  end if;

  -- A claim started by a person and approved by the admin, the hash never copied.
  insert into public.claim_requests (supplier_id, claimant_user_id, proof_email, proof_email_domain, method, status, verification_token_hash)
    values (house, supplier, 'x@house.example', 'house.example', 'manual_review', 'email_verified', repeat('0', 64))
    returning id into claim;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.claim_admin_decide(claim, true, null);
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  select * into e from public.activity_ledger where kind = 'claim.started' and target_id = claim;
  if e.id is null or e.actor_id <> supplier or e.supplier_id <> house or e.content::text like '%verification_token_hash%' then
    raise exception 'claim.started is wrong: %', to_jsonb(e);
  end if;
  select * into e from public.activity_ledger where kind = 'claim.approved' and target_id = claim;
  if e.id is null or e.actor_id <> admin or e.other_party_id <> supplier then
    raise exception 'claim.approved is wrong: %', to_jsonb(e);
  end if;

  -- A team member joins; a conversation is read; a partner request.
  insert into public.workspace_members (owner_id, member_id, role, invited_by) values (buyer, member, 'editor', buyer);
  if not exists (select 1 from public.activity_ledger where kind = 'team.member_joined' and target_id = member and actor_id = buyer and other_party_id = member) then
    raise exception 'team.member_joined was not recorded';
  end if;
  insert into public.message_threads (id, buyer_id, supplier_id, subject) values (thread, buyer, company, 'CI');
  insert into public.thread_participants (thread_id, user_id, role) values (thread, buyer, 'buyer'), (thread, supplier, 'supplier');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  perform public.thread_mark_read(thread);
  reset role;
  select * into e from public.activity_ledger where kind = 'conversation.read' and thread_id = thread;
  if e.id is null or e.actor_id <> supplier or e.supplier_id <> company or e.content ->> 'read_up_to' is null then
    raise exception 'conversation.read is wrong: %', to_jsonb(e);
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.supplier_relationships (buying_house_id, factory_id, initiated_by, initiated_side) values (house, company, supplier, 'factory');
  if not exists (select 1 from public.activity_ledger where kind = 'partner.requested' and actor_id = supplier and supplier_id = company) then
    raise exception 'partner.requested was not recorded';
  end if;

  -- A supplier row changed with nobody signed in (the ETL) writes nothing; changed by a person, it does.
  select count(*) into n from public.activity_ledger;
  update public.suppliers set city = 'Gazipur' where id = company;
  if (select count(*) from public.activity_ledger) <> n then raise exception 'an ETL-style supplier change was recorded'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform public.admin_user_update(member, '{"plan_tier": "growth"}'::jsonb);
  reset role;
  if not exists (select 1 from public.activity_ledger where kind = 'account.plan_changed' and target_id = member and actor_id = admin) then
    raise exception 'account.plan_changed was not recorded';
  end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  update public.suppliers set city = 'Dhaka' where id = company;
  perform set_config('request.jwt.claim.sub', '', true);
  select * into e from public.activity_ledger where kind = 'supplier.profile_edited' and supplier_id = company;
  if e.id is null or e.actor_id <> admin or e.content -> 'changed' <> '["city"]'::jsonb then
    raise exception 'supplier.profile_edited is wrong: %', to_jsonb(e);
  end if;

  -- Reads: a note as the buyer, with the slug resolved; the refusals.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  perform public.ledger_note('supplier.viewed', null, null, '{"slug": "ci-0134-knit", "via": "pane"}'::jsonb, null, null, null, null);
  perform public.ledger_note('search.run', null, null, '{"search": "q=knit"}'::jsonb, null, null, null, null);
  hit := null;
  begin
    perform public.ledger_note('message.sent', null, null, '{}'::jsonb, null, null, null, null);
  exception when sqlstate '22023' then hit := 'refused';
  end;
  if hit is null then raise exception 'ledger_note took a kind it must not'; end if;
  hit := null;
  begin
    perform public.ledger_note('search.run', null, null, jsonb_build_object('big', repeat('x', 9000)), null, null, null, null);
  exception when sqlstate '22023' then hit := 'refused';
  end;
  if hit is null then raise exception 'ledger_note took 9 KB'; end if;
  reset role;
  select * into e from public.activity_ledger where kind = 'supplier.viewed' and actor_id = buyer;
  if e.id is null or e.supplier_id <> company or e.content ->> 'via' <> 'pane' then
    raise exception 'supplier.viewed is wrong: %', to_jsonb(e);
  end if;
  if not exists (select 1 from public.activity_ledger where kind = 'search.run' and actor_id = buyer and content ->> 'search' = 'q=knit') then
    raise exception 'search.run was not recorded';
  end if;

  -- Nobody signed in: refused.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  hit := null;
  begin
    perform public.ledger_note('search.run', null, null, '{}'::jsonb, null, null, null, null);
  exception when sqlstate '28000' then hit := 'refused';
  end;
  if hit is null then raise exception 'a signed-out note went through'; end if;
  hit := null;
  begin
    perform public.terms_accept('2026-10-05');
  exception when sqlstate '28000' then hit := 'refused';
  end;
  if hit is null then raise exception 'a signed-out terms acceptance went through'; end if;
  reset role;
end
$$;

rollback;
