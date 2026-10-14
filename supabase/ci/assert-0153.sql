-- 0153 asserted by running it. strip_contact_text() removes each kind of contact detail and leaves a clean
-- text byte for byte; an address a register filed with a phone and a mailbox comes out of every public
-- function without them while the entry itself is untouched; a building's entry, and the address a unit
-- inherits from its parent, are stripped too; suppliers.address_raw is stripped on insert and on update;
-- no client role can read either view or call the function. This file runs after EVERY migration: a later
-- one that redefines v_supplier_addresses_direct from an older copy fails here.
\set ON_ERROR_STOP on

begin;

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ( 1, 'House 12, Road 5, Baridhara DOHS, Dhaka, 9125191 Tel: 01700000001', 'House 12, Road 5, Baridhara DOHS, Dhaka'),
      ( 2, 'Plot # 110072, Holding 1100725, Dhaka-1000',                         'Plot # 110072, Holding 1100725, Dhaka-1000'),
      ( 3, 'Kashimpur, Gazipur, Bangladesh, Your contact:  Karim Uddin',         'Kashimpur, Gazipur, Bangladesh'),
      ( 4, '34, Azimpur Road, Dhaka -1205 Pho:9125191, 912519222',               '34, Azimpur Road, Dhaka -1205'),
      ( 5, 'Tel/Fax: (02) 9898989, House 5, Mirpur',                             'House 5, Mirpur'),
      ( 6, 'Mirpur, Dhaka. E-mail: info@example.com, Web: www.example.com',      'Mirpur, Dhaka.'),
      ( 7, 'Banani, Dhaka, +880 1700 000001 / 01700-000002',                     'Banani, Dhaka'),
      ( 8, 'New Apparel.com Limited, Tongi',                                     'New Apparel.com Limited, Tongi'),
      ( 9, 'Telihati, Sreepur, Web Tower, Email Road',                           'Telihati, Sreepur, Web Tower, Email Road'),
      (10, 'Ph. 12, Sector 7, Uttara',                                           'Ph. 12, Sector 7, Uttara'),
      (11, 'info [at] example [dot] com',                                        null),
      (12, 'attention to detail, Gazipur',                                       'attention to detail, Gazipur'),
      (13, 'C/O Karim Uddin, Ashulia, Savar',                                    'Ashulia, Savar'),
      (14, 'Mob-01700000001, Tongi; Fax No. 880-2-9898989',                      'Tongi'),
      (15, 'Sharifpur, Gazipur - 1704, Bangladesh, example-trims.com/, Tongi',   'Sharifpur, Gazipur - 1704, Bangladesh, Tongi'),
      (16, 'Dhaka, Tel: +44 20 7946 0958',                                       'Dhaka'),
      (17, 'House 5, 0171 100 0001',                                             'House 5'),
      (18, 'Unit 2, Flat 1234567, 018-238019',                                   'Unit 2, Flat 1234567'),
      -- Untidy but clean: spacing and stray commas are the register's, and stay.
      (19, 'House  12 ,, Road 5 ,Dhaka - 1207.',                                 'House  12 ,, Road 5 ,Dhaka - 1207.'),
      (20, '',                                                                   ''),
      (21, null,                                                                 null)
    ) v(n, filed, want)
  loop
    if public.strip_contact_text(c.filed) is distinct from c.want then
      raise exception 'case %: got [%], want [%]', c.n, public.strip_contact_text(c.filed), c.want;
    end if;
  end loop;
end
$$;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, address_raw)
values
  ('ci-0153-mill',   'CI 0153 Mill Ltd',          'ci 0153 mill ltd',          'Dhaka', 'Dhaka', false, false, 'Plot 9, Tongi, Gazipur, Tel: 01700000003'),
  ('ci-0153-shed',   'CI 0153 Shed 2',            'ci 0153 shed 2',            'Dhaka', 'Dhaka', false, false, null),
  ('ci-0153-unit',   'CI 0153 Mill Ltd Unit-2',   'ci 0153 mill ltd unit-2',   'Dhaka', 'Dhaka', false, false, null);

update public.suppliers set facility_of = (select id from public.suppliers where slug = 'ci-0153-mill')
 where slug = 'ci-0153-shed';

insert into public.source_records (supplier_id, source_id, source_tier, source_ref, fields)
select sp.id, s.id, s.tier, v.ref, v.fields::jsonb
  from (values
    ('ci-0153-mill', 'RSC',   'CI-0153-R', '{"rsc_factory_address": "Plot 9, Tongi, Gazipur"}'),
    ('ci-0153-mill', 'BKMEA', 'CI-0153-K', '{"bkmea_factory_address": "Plot 9, Tongi, Gazipur, 9125191 Tel: 01700000001", "bkmea_mailing_address": "House 5, Banani, Dhaka. E-mail: info@example.com"}'),
    ('ci-0153-shed', 'BGMEA', 'CI-0153-G', '{"factory_address": "Shed 2, Tongi, Gazipur, Your contact:  Karim Uddin, Mob-01700000002"}'),
    ('ci-0153-unit', 'RSC',   'CI-0153-U', '{"rsc_factory_address": "Unit 2, Tongi, Gazipur"}')
  ) v(slug, code, ref, fields)
  join public.suppliers sp on sp.slug = v.slug
  join public.sources s on s.code = v.code;

update public.suppliers set is_published = true where slug in ('ci-0153-mill', 'ci-0153-unit');

do $$
declare
  mill   constant uuid := (select id from public.suppliers where slug = 'ci-0153-mill');
  unit   constant uuid := (select id from public.suppliers where slug = 'ci-0153-unit');
  -- A phone, a mailbox, or a labelled contact: what must never come out.
  leak   constant text := '0170000000|9125191|@|example\.com|Karim|Tel|Mob|E-mail|contact';
  role_name text;
  got    text;
  n      bigint;
begin
  -- Grants: a new view takes the default grants, and no client reads these.
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_table_privilege(role_name::name, 'public.v_supplier_addresses_direct', 'select')
       or has_table_privilege(role_name::name, 'public.v_supplier_addresses_filed', 'select')
       or has_table_privilege(role_name::name, 'public.v_supplier_addresses', 'select') then
      raise exception '% can read an address view', role_name;
    end if;
    if has_function_privilege(role_name::name, 'public.strip_contact_text(text)', 'execute') then
      raise exception '% can call strip_contact_text()', role_name;
    end if;
  end loop;

  -- The company's own address was stripped on insert, and is stripped on update.
  select address_raw into got from public.suppliers where id = mill;
  if got is distinct from 'Plot 9, Tongi, Gazipur' then raise exception 'address_raw on insert: [%]', got; end if;
  update public.suppliers set address_raw = 'Plot 10, Tongi. Web: www.example.com' where id = mill;
  select address_raw into got from public.suppliers where id = mill;
  if got is distinct from 'Plot 10, Tongi.' then raise exception 'address_raw on update: [%]', got; end if;
  -- An update that does not touch the address leaves it alone.
  update public.suppliers set city = 'Gazipur' where id = mill;
  if (select address_raw from public.suppliers where id = mill) is distinct from 'Plot 10, Tongi.' then
    raise exception 'an update of another column changed the address';
  end if;

  -- The evidence is untouched, and the view of it as filed still shows it.
  if (select fields ->> 'bkmea_factory_address' from public.source_records where source_ref = 'CI-0153-K')
       is distinct from 'Plot 9, Tongi, Gazipur, 9125191 Tel: 01700000001' then
    raise exception 'the register entry was edited';
  end if;
  select count(*) into n from public.v_supplier_addresses_filed where supplier_id = mill and address ~* leak;
  if n <> 2 then raise exception 'the filed view should still hold the 2 entries as filed, holds %', n; end if;

  -- Every reader's view: stripped, the clean one unchanged, nothing dropped.
  select count(*) into n from public.v_supplier_addresses_direct where source_ref like 'CI-0153-%' and address ~* leak;
  if n <> 0 then raise exception '% stripped-view rows still carry a contact detail', n; end if;
  select string_agg(address, ' | ' order by source_code, address_kind) into got
    from public.v_supplier_addresses_direct where supplier_id = mill;
  if got is distinct from 'Plot 9, Tongi, Gazipur | House 5, Banani, Dhaka. | Plot 9, Tongi, Gazipur' then
    raise exception 'the mill''s addresses read: [%]', got;
  end if;

  -- The public functions.
  got := public.buyer_supplier_profile('ci-0153-mill') -> 'addresses';
  if got is null or got = '[]' or got ~* leak then raise exception 'the profile''s addresses: %', got; end if;
  got := public.buyer_supplier_profile('ci-0153-mill') -> 'supplier' ->> 'address_raw';
  if got ~* leak then raise exception 'the profile''s own address: %', got; end if;
  got := coalesce(public.buyer_supplier_facility_panel('ci-0153-mill')::text, '');
  -- The whole panel, links and all: the values only (a source link may hold a word like "contact").
  if got ~ '0170000000|9125191|@example|Karim' then raise exception 'the buildings panel: %', got; end if;
  -- The building's own entry, read where the panel reads it.
  select string_agg(address, ' | ') into got from public.v_supplier_addresses_direct where source_ref = 'CI-0153-G';
  if got is distinct from 'Shed 2, Tongi, Gazipur' then raise exception 'the building''s address reads: [%]', got; end if;
  got := public.supplier_primary_address(mill);
  if got ~* leak then raise exception 'the primary address: %', got; end if;

  -- A unit's inherited address comes from the parent's stripped one.
  select count(*) into n from public.v_supplier_addresses where supplier_id = unit and address_kind like '%_inherited';
  if n = 0 then raise exception 'the unit inherited no address from its parent'; end if;
  select count(*) into n from public.v_supplier_addresses where supplier_id = unit and address ~* leak;
  if n <> 0 then raise exception '% of the unit''s inherited addresses carry a contact detail', n; end if;
end
$$;

rollback;
