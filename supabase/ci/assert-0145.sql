-- 0145 asserted by running it: a signed-out caller, a Starter buyer and a suspended Growth buyer get nothing;
-- Growth, Enterprise and an admin get the details of a published record, cleaned (two addresses out of one
-- field, one number filed three ways shown once, the site without the e-mail filed beside it); a record
-- holding only junk answers empty lists and nulls, never the junk; an unpublished, unknown or SANCTIONED
-- record answers null; what is returned always agrees with what supplier_contact_counts (0105) says is on
-- file; each reveal is written to the activity record once per account and supplier, a re-open writes
-- nothing more, and a refusal writes nothing; an account at 199 different suppliers in the last 24 hours
-- opens its 200th, is refused the 201st with {"limit": 200} and no value, and still re-opens one it had;
-- entries older than 24 hours do not count; a note the account writes itself through ledger_note neither
-- makes a supplier a free re-open at the limit nor uses up the allowance; an admin is never limited.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a145', 'admin-0145@example.invalid',   '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b145', 'growth-0145@example.invalid',  '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c145', 'ent-0145@example.invalid',     '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d145', 'starter-0145@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e145', 'susp-0145@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000f145', 'busy-0145@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-000000001145', 'noter-0145@example.invalid',   '{"role":"buyer"}'::jsonb)
on conflict do nothing;

update public.profiles set plan_tier = 'growth' where id in
  ('00000000-0000-4000-8000-00000000b145', '00000000-0000-4000-8000-00000000e145', '00000000-0000-4000-8000-00000000f145',
   '00000000-0000-4000-8000-000000001145');
update public.profiles set plan_tier = 'enterprise' where id = '00000000-0000-4000-8000-00000000c145';
update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-00000000e145';

insert into public.suppliers
  (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned,
   email_primary, phones, website, contact_name, contact_role) values
  ('00000000-0000-4000-8000-0000000a1145', 'ci-0145-a', 'CI 0145 A Ltd', 'ci 0145 a ltd', 'Dhaka', 'Dhaka', false, false,
   'Sales @ ci0145.example ; md@ci0145.example.',
   array['+880 1754392350', '01754392350', '1754392350', '02-9876543', '12345'],
   'http://www.ci0145.example, info@ci0145.example', ' Md. Karim Uddin ', 'Managing Director'),
  ('00000000-0000-4000-8000-0000000a2145', 'ci-0145-b', 'CI 0145 B Ltd', 'ci 0145 b ltd', 'Dhaka', 'Dhaka', false, false,
   'no address', array['12345'], 'https://', 'Mr.', 'Director'),
  ('00000000-0000-4000-8000-0000000a3145', 'ci-0145-c', 'CI 0145 C Ltd', 'ci 0145 c ltd', 'Dhaka', 'Dhaka', false, false,
   'hidden@ci0145.example', array['01811111111'], 'hidden.ci0145.example', 'Hidden Person', null),
  ('00000000-0000-4000-8000-0000000a4145', 'ci-0145-d', 'CI 0145 D Ltd', 'ci 0145 d ltd', 'Dhaka', 'Dhaka', false, true,
   'listed@ci0145.example', array['01822222222'], 'listed.ci0145.example', 'Listed Person', null),
  ('00000000-0000-4000-8000-0000000a5145', 'ci-0145-e', 'CI 0145 E Ltd', 'ci 0145 e ltd', 'Dhaka', 'Dhaka', false, false,
   'e@ci0145.example', array[]::text[], null, null, null);

-- Published only once each holds a Tier 1 source (enforce_publish_tier). C stays unpublished; D is
-- published and on a sanctions list.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0145-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug in ('ci-0145-a', 'ci-0145-b', 'ci-0145-d', 'ci-0145-e') and s.code = 'RSC';
update public.suppliers set is_published = true where slug in ('ci-0145-a', 'ci-0145-b', 'ci-0145-d', 'ci-0145-e');

do $$
declare
  admin   constant uuid := '00000000-0000-4000-8000-00000000a145';
  growth  constant uuid := '00000000-0000-4000-8000-00000000b145';
  ent     constant uuid := '00000000-0000-4000-8000-00000000c145';
  starter constant uuid := '00000000-0000-4000-8000-00000000d145';
  susp    constant uuid := '00000000-0000-4000-8000-00000000e145';
  busy    constant uuid := '00000000-0000-4000-8000-00000000f145';
  noter   constant uuid := '00000000-0000-4000-8000-000000001145';
  a       constant uuid := '00000000-0000-4000-8000-0000000a1145';
  b       constant uuid := '00000000-0000-4000-8000-0000000a2145';
  e5      constant uuid := '00000000-0000-4000-8000-0000000a5145';
  j       jsonb;
  c       jsonb;
  e       record;
  n       int;
  v_slug  text;
begin
  -- Who may call it.
  if has_function_privilege('anon', 'public.supplier_contact_details(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.supplier_contact_details(text)', 'execute') then
    raise exception '0145 grants are wrong: anon must not call it, authenticated must';
  end if;

  set local role authenticated;

  -- Nobody signed in, a Starter buyer, a suspended Growth buyer: nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  if public.supplier_contact_details('ci-0145-a') is not null then raise exception 'a caller with no account got contact details'; end if;
  perform set_config('request.jwt.claim.sub', starter::text, true);
  if public.supplier_contact_details('ci-0145-a') is not null then raise exception 'a Starter buyer got contact details'; end if;
  perform set_config('request.jwt.claim.sub', susp::text, true);
  if public.supplier_contact_details('ci-0145-a') is not null then raise exception 'a suspended buyer got contact details'; end if;

  -- Growth: the details, cleaned.
  perform set_config('request.jwt.claim.sub', growth::text, true);
  j := public.supplier_contact_details('ci-0145-a');
  if j is distinct from jsonb_build_object(
       'emails',  jsonb_build_array('Sales@ci0145.example', 'md@ci0145.example'),
       'phones',  jsonb_build_array('+880 1754392350', '02-9876543'),
       'website', 'http://www.ci0145.example',
       'person',  'Md. Karim Uddin',
       'role',    'Managing Director') then
    raise exception 'growth read: %', j;
  end if;

  -- Junk is not a detail: no address, a five-digit phone, a bare scheme, a bare title (and so no role).
  j := public.supplier_contact_details('ci-0145-b');
  if j is distinct from '{"emails": [], "phones": [], "website": null, "person": null, "role": null}'::jsonb then
    raise exception 'junk read: %', j;
  end if;

  -- What is shown agrees with what the locked card counted. (Both are re-opens: nothing more is written.)
  foreach v_slug in array array['ci-0145-a', 'ci-0145-b'] loop
    j := public.supplier_contact_details(v_slug);
    c := public.supplier_contact_counts(v_slug);
    if jsonb_array_length(j -> 'emails') <> (c ->> 'emails')::int
       or jsonb_array_length(j -> 'phones') <> (c ->> 'phones')::int
       or (jsonb_typeof(j -> 'website') = 'string') <> (c ->> 'website')::boolean
       or (case when jsonb_typeof(j -> 'person') = 'string' then 1 else 0 end) <> (c ->> 'representatives')::int then
      raise exception 'details and counts disagree for %: % against %', v_slug, j, c;
    end if;
  end loop;

  -- Unpublished, unknown and sanctioned: null, even to Growth.
  if public.supplier_contact_details('ci-0145-c') is not null then raise exception 'an unpublished record answered'; end if;
  if public.supplier_contact_details('ci-0145-no-such-record') is not null then raise exception 'an unknown slug answered'; end if;
  if public.supplier_contact_details('ci-0145-d') is not null then raise exception 'a sanctioned record answered'; end if;

  -- Enterprise and an admin read it too.
  perform set_config('request.jwt.claim.sub', ent::text, true);
  if public.supplier_contact_details('ci-0145-a') -> 'emails' ->> 0 is distinct from 'Sales@ci0145.example' then raise exception 'Enterprise got no details'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.supplier_contact_details('ci-0145-a') ->> 'person' is distinct from 'Md. Karim Uddin' then raise exception 'an admin got no details'; end if;
  reset role;

  -- The activity record: one entry per account and supplier, whatever the number of opens; none for a refusal.
  select count(*) into n from public.activity_ledger where kind = 'contact.revealed';
  if n <> 4 then raise exception 'want 4 reveals written (growth A and B, Enterprise A, admin A), got %', n; end if;
  select * into e from public.activity_ledger where kind = 'contact.revealed' and actor_id = growth and supplier_id = a;
  if e.id is null or e.target_table <> 'suppliers' or e.target_id <> a or e.actor_email <> 'growth-0145@example.invalid'
     or e.reason is distinct from 'supplier_contact_details'
     or e.content is distinct from '{"slug": "ci-0145-a", "emails": 2, "phones": 2, "website": true, "person": true}'::jsonb then
    raise exception 'growth''s reveal of A is written wrong: %', to_jsonb(e);
  end if;
  if (select content from public.activity_ledger where kind = 'contact.revealed' and actor_id = growth and supplier_id = b)
     is distinct from '{"slug": "ci-0145-b", "emails": 0, "phones": 0, "website": false, "person": false}'::jsonb then
    raise exception 'growth''s reveal of B is written wrong';
  end if;
  if exists (select 1 from public.activity_ledger where kind = 'contact.revealed' and actor_id in (starter, susp)) then
    raise exception 'a refused account has a reveal written';
  end if;

  -- The daily limit. 199 different suppliers opened an hour ago, and five more over 24 hours ago that no
  -- longer count (the writer stamps `at` itself, so these go in directly as the owner, as assert-0135 does,
  -- carrying the mark the function puts on its own entries).
  insert into public.activity_ledger (at, actor_id, kind, target_table, target_id, supplier_id, content, content_hash, reason)
  select now() - interval '1 hour', busy, 'contact.revealed', 'suppliers', x.id, x.id, '{}'::jsonb, repeat('0', 64), 'supplier_contact_details'
    from (select gen_random_uuid() as id from generate_series(1, 199)) x;
  insert into public.activity_ledger (at, actor_id, kind, target_table, target_id, supplier_id, content, content_hash, reason)
  select now() - interval '25 hours', busy, 'contact.revealed', 'suppliers', x.id, x.id, '{}'::jsonb, repeat('0', 64), 'supplier_contact_details'
    from (select gen_random_uuid() as id from generate_series(1, 5)) x;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', busy::text, true);
  -- Under the limit: the 200th opens.
  j := public.supplier_contact_details('ci-0145-a');
  if j -> 'emails' ->> 0 is distinct from 'Sales@ci0145.example' or j ? 'limit' then raise exception 'the 200th supplier did not open: %', j; end if;
  -- At the limit: the 201st is refused, with the number and no value.
  j := public.supplier_contact_details('ci-0145-e');
  if j is distinct from '{"limit": 200}'::jsonb then raise exception 'the 201st supplier answered: %', j; end if;
  -- A note the account writes itself (ledger_note takes this kind from any signed-in caller, by slug or by
  -- id) does not make that supplier a free "re-open": the 201st is still refused.
  perform public.ledger_note('contact.revealed', null, null, '{"slug": "ci-0145-e"}'::jsonb);
  perform public.ledger_note('contact.revealed', 'suppliers', e5, '{}'::jsonb, e5);
  j := public.supplier_contact_details('ci-0145-e');
  if j is distinct from '{"limit": 200}'::jsonb then raise exception 'a self-written note opened the 201st supplier: %', j; end if;
  -- One the function itself opened in the window is free.
  j := public.supplier_contact_details('ci-0145-a');
  if j ->> 'person' is distinct from 'Md. Karim Uddin' then raise exception 'a re-open was refused at the limit: %', j; end if;
  reset role;

  if (select count(*) from public.activity_ledger
       where kind = 'contact.revealed' and actor_id = busy and supplier_id = e5 and reason is null) <> 2 then
    raise exception 'guard: the two self-written notes for the 201st supplier are not in the record';
  end if;
  select count(*) into n from public.activity_ledger
   where kind = 'contact.revealed' and actor_id = busy and reason = 'supplier_contact_details'
     and at > now() - interval '24 hours';
  if n <> 200 then raise exception 'want 200 reveals of the function''s own in the window after one open, two refusals and one re-open, got %', n; end if;

  -- 200 self-written notes for 200 different suppliers do not use up the allowance: a real open still
  -- works, and is written as the function's own even though a note for that supplier was already there.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', noter::text, true);
  for n in 1..200 loop
    perform public.ledger_note('contact.revealed', null, null, '{}'::jsonb, gen_random_uuid());
  end loop;
  perform public.ledger_note('contact.revealed', null, null, '{"slug": "ci-0145-a"}'::jsonb);
  j := public.supplier_contact_details('ci-0145-a');
  if j -> 'emails' ->> 0 is distinct from 'Sales@ci0145.example' or j ? 'limit' then
    raise exception '200 self-written notes used up the allowance: %', j;
  end if;
  reset role;
  if (select count(*) from public.activity_ledger where kind = 'contact.revealed' and actor_id = noter and reason is null) <> 201
     or (select count(*) from public.activity_ledger
          where kind = 'contact.revealed' and actor_id = noter and supplier_id = a and reason = 'supplier_contact_details') <> 1 then
    raise exception 'the open after the self-written notes was not written as the function''s own';
  end if;

  -- An admin is never limited.
  insert into public.activity_ledger (at, actor_id, kind, target_table, target_id, supplier_id, content, content_hash, reason)
  select now() - interval '1 hour', admin, 'contact.revealed', 'suppliers', x.id, x.id, '{}'::jsonb, repeat('0', 64), 'supplier_contact_details'
    from (select gen_random_uuid() as id from generate_series(1, 200)) x;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  j := public.supplier_contact_details('ci-0145-e');
  if j -> 'emails' ->> 0 is distinct from 'e@ci0145.example' then raise exception 'an admin was limited: %', j; end if;
  reset role;
end
$$;

rollback;
