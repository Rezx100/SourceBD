-- 0145 asserted by running it: a signed-out caller, a Starter buyer and a suspended Growth buyer get nothing;
-- Growth, Enterprise and an admin get the details of a published record, cleaned (two addresses out of one
-- field, one number filed three ways shown once, the site without the e-mail filed beside it); a record
-- holding only junk answers empty lists and nulls, never the junk; an unpublished or unknown record answers
-- null; and what is returned always agrees with what supplier_contact_counts (0105) says is on file.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a145', 'admin-0145@example.invalid',   '{"role":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b145', 'growth-0145@example.invalid',  '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c145', 'ent-0145@example.invalid',     '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000d145', 'starter-0145@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000e145', 'susp-0145@example.invalid',    '{"role":"buyer"}'::jsonb)
on conflict do nothing;

update public.profiles set plan_tier = 'growth' where id in
  ('00000000-0000-4000-8000-00000000b145', '00000000-0000-4000-8000-00000000e145');
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
   'hidden@ci0145.example', array['01811111111'], 'hidden.ci0145.example', 'Hidden Person', null);

-- Published only once each holds a Tier 1 source (enforce_publish_tier). C stays unpublished.
insert into public.source_records (supplier_id, source_id, source_tier, source_ref)
select sp.id, s.id, s.tier, 'CI-0145-' || sp.slug from public.suppliers sp, public.sources s
 where sp.slug in ('ci-0145-a', 'ci-0145-b') and s.code = 'RSC';
update public.suppliers set is_published = true where slug in ('ci-0145-a', 'ci-0145-b');

do $$
declare
  admin   constant uuid := '00000000-0000-4000-8000-00000000a145';
  growth  constant uuid := '00000000-0000-4000-8000-00000000b145';
  ent     constant uuid := '00000000-0000-4000-8000-00000000c145';
  starter constant uuid := '00000000-0000-4000-8000-00000000d145';
  susp    constant uuid := '00000000-0000-4000-8000-00000000e145';
  j       jsonb;
  c       jsonb;
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

  -- What is shown agrees with what the locked card counted.
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

  -- Unpublished and unknown: null, even to Growth.
  if public.supplier_contact_details('ci-0145-c') is not null then raise exception 'an unpublished record answered'; end if;
  if public.supplier_contact_details('ci-0145-no-such-record') is not null then raise exception 'an unknown slug answered'; end if;

  -- Enterprise and an admin read it too.
  perform set_config('request.jwt.claim.sub', ent::text, true);
  if public.supplier_contact_details('ci-0145-a') -> 'emails' ->> 0 is distinct from 'Sales@ci0145.example' then raise exception 'Enterprise got no details'; end if;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.supplier_contact_details('ci-0145-a') ->> 'person' is distinct from 'Md. Karim Uddin' then raise exception 'an admin got no details'; end if;

  reset role;
end
$$;

rollback;
