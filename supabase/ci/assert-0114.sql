-- Behaviour of evidence packs after 0114, asserted by running it: a pack
-- holds every certificate of a saved, published supplier with its state and
-- source (a rejected one left out, an unpublished supplier left out), the
-- UFLPA state, and every active source with its address; each call writes one
-- download row the buyer can read and nobody else can; bad input and anon are
-- refused.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a114', 'a-0114@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b114', 'b-0114@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000c1141', 'ci-0114-a', 'CI Knit 0114', 'ci knit 0114', 'Dhaka', 'Dhaka', false, false),
  ('00000000-0000-4000-8000-0000000c1142', 'ci-0114-b', 'CI Hidden 0114', 'ci hidden 0114', 'Dhaka', 'Dhaka', false, false);

insert into public.source_records (id, supplier_id, source_id, source_tier, source_ref, fields, fetched_at)
select '00000000-0000-4000-8000-0000000d1141', '00000000-0000-4000-8000-0000000c1141', s.id, s.tier, 'F-1',
       '{"factory_address":"Plot 4, Gazipur"}'::jsonb, '2026-09-30'::timestamptz
  from public.sources s where s.code = 'RSC';

-- Published only once it holds a Tier 1 source (enforce_publish_tier).
update public.suppliers set is_published = true where id = '00000000-0000-4000-8000-0000000c1141';

insert into public.certifications (supplier_id, kind, certificate_no, expires_on, source_record_id) values
  ('00000000-0000-4000-8000-0000000c1141', 'wrap', '7865', current_date - 6, '00000000-0000-4000-8000-0000000d1141'),
  ('00000000-0000-4000-8000-0000000c1141', 'gots', 'G-1', current_date + 400, null),
  ('00000000-0000-4000-8000-0000000c1142', 'gots', 'G-2', current_date + 400, null);
insert into public.certifications (supplier_id, kind, certificate_no, expires_on, rejected_at) values
  ('00000000-0000-4000-8000-0000000c1141', 'oeko_tex', 'O-1', current_date + 10, now());

insert into public.sanctions_screening (supplier_id, list, matched_name, screened_at)
values ('00000000-0000-4000-8000-0000000c1141', 'uflpa', 'CI Knit Group', '2026-10-01');

insert into public.saved_suppliers (owner_id, supplier_id) values
  ('00000000-0000-4000-8000-00000000a114', '00000000-0000-4000-8000-0000000c1141'),
  ('00000000-0000-4000-8000-00000000a114', '00000000-0000-4000-8000-0000000c1142');

do $$
declare
  pack jsonb;
  certs jsonb;
  uflpa jsonb;
  srcs jsonb;
begin
  if has_function_privilege('anon', 'public.evidence_pack(text[], text)', 'execute') then
    raise exception 'anon can execute evidence_pack';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a114', true);

  pack := public.evidence_pack(array['uflpa', 'cert_expiry', 'sources', 'uflpa'], 'csv');
  if (pack->>'supplier_count')::int <> 1 then
    raise exception 'an unpublished supplier was counted: %', pack->'supplier_count';
  end if;
  select jsonb_agg(e) filter (where e->>'section' = 'cert_expiry'),
         jsonb_agg(e) filter (where e->>'section' = 'uflpa'),
         jsonb_agg(e) filter (where e->>'section' = 'sources')
    into certs, uflpa, srcs
    from jsonb_array_elements(pack->'rows') e;

  if jsonb_array_length(certs) <> 2
     or not exists (select 1 from jsonb_array_elements(certs) e
                     where e->>'item' = 'WRAP 7865' and e->>'state' = 'expired'
                       and e->>'source' = 'RMG Sustainability Council' and e->>'checked_on' = '2026-09-30')
     or not exists (select 1 from jsonb_array_elements(certs) e
                     where e->>'item' = 'GOTS G-1' and e->>'state' = 'valid' and e->>'checked_on' is not null) then
    raise exception 'certificate rows %', certs;
  end if;
  if jsonb_array_length(uflpa) <> 1 or uflpa->0->>'state' <> 'on_the_list' or uflpa->0->>'checked_on' <> '2026-10-01' then
    raise exception 'uflpa rows %', uflpa;
  end if;
  if jsonb_array_length(srcs) <> 1 or srcs->0->>'address' <> 'Plot 4, Gazipur' or srcs->0->>'state' <> 'tier1_gov' then
    raise exception 'source rows %', srcs;
  end if;
  if (select count(*) from public.evidence_pack_downloads) <> 1
     or (select sections from public.evidence_pack_downloads) <> array['cert_expiry', 'sources', 'uflpa'] then
    raise exception 'the download was not recorded once with its sections';
  end if;

  begin
    perform public.evidence_pack(array['contacts'], 'csv');
    raise exception 'an unknown section was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.evidence_pack(array['uflpa'], 'xlsx');
    raise exception 'an unknown format was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.evidence_pack_downloads (owner_id, sections, format, supplier_count, row_count)
    values ('00000000-0000-4000-8000-00000000a114', array['uflpa'], 'csv', 0, 0);
    raise exception 'authenticated wrote a download row';
  exception when insufficient_privilege then null;
  end;

  -- Another buyer sees no download and gets an empty pack.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b114', true);
  if (select count(*) from public.evidence_pack_downloads) <> 0 then
    raise exception 'another buyer read the download log';
  end if;
  if (public.evidence_pack(array['cert_expiry'], 'pdf')->>'row_count')::int <> 0 then
    raise exception 'another buyer got rows';
  end if;
  reset role;
end
$$;

rollback;
