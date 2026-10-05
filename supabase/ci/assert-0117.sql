-- The public site's facts after 0117, asserted by running it: the keys are there, the counts agree with the
-- tables they are read from (an expired certificate counts, a rejected one does not), every source is listed
-- with its own records, the function is callable signed out, and nothing in the answer names a supplier.
\set ON_ERROR_STOP on

begin;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned) values
  ('00000000-0000-4000-8000-0000000c1171', 'ci-0117-a', 'CI Knit 0117', 'ci knit 0117', 'Dhaka', 'Dhaka', false, false);
insert into public.source_records (id, supplier_id, source_id, source_tier, source_ref, fields, fetched_at)
select '00000000-0000-4000-8000-0000000d1171', '00000000-0000-4000-8000-0000000c1171', s.id, s.tier, 'F-1',
       '{"factory_address":"Plot 4, Gazipur"}'::jsonb, '2026-09-30'::timestamptz
  from public.sources s where s.code = 'RSC';
update public.suppliers set is_published = true where id = '00000000-0000-4000-8000-0000000c1171';
insert into public.certifications (supplier_id, kind, certificate_no, expires_on) values
  ('00000000-0000-4000-8000-0000000c1171', 'wrap', 'W-1', current_date - 6),
  ('00000000-0000-4000-8000-0000000c1171', 'gots', 'G-1', current_date + 400);
insert into public.certifications (supplier_id, kind, certificate_no, expires_on, rejected_at) values
  ('00000000-0000-4000-8000-0000000c1171', 'oeko_tex', 'O-1', current_date - 3, now());

do $$
declare
  f jsonb;
  rsc jsonb;
begin
  if not has_function_privilege('anon', 'public.marketing_facts()', 'execute') then
    raise exception 'anon cannot run marketing_facts';
  end if;

  set local role anon;
  f := public.marketing_facts();
  reset role;

  if (select count(*) from jsonb_object_keys(f)) <> 8 then
    raise exception 'unexpected keys: %', (select array_agg(k) from jsonb_object_keys(f) k);
  end if;
  if (f->>'suppliers_published')::int <> (select count(*) from public.suppliers where is_published) then
    raise exception 'suppliers_published disagrees with the table';
  end if;
  if (f->>'sources_listed')::int <> (select count(*) from public.sources)
     or jsonb_array_length(f->'sources') <> (select count(*) from public.sources) then
    raise exception 'sources_listed disagrees with the table';
  end if;
  if (f->>'sources_with_records')::int < 1 then
    raise exception 'a source holds a record but none is counted';
  end if;
  if (f->>'certificates_on_file')::int <> (select count(*) from public.certifications where rejected_at is null) then
    raise exception 'a rejected certificate was counted';
  end if;
  if (f->>'certificates_expired')::int <> (select count(*) from public.certifications where rejected_at is null and expires_on < current_date)
     or (f->>'certificates_expired')::int < 1 then
    raise exception 'expired certificates were %', f->>'certificates_expired';
  end if;
  select e into rsc from jsonb_array_elements(f->'sources') e where e->>'code' = 'RSC';
  if (rsc->>'records')::int < 1 or (rsc->>'suppliers')::int < 1 or (f->>'rsc_records')::int <> (rsc->>'records')::int then
    raise exception 'the RSC source was %', rsc;
  end if;
  if f->>'latest_read' is null then
    raise exception 'no latest read';
  end if;
  -- Aggregates only.
  if f::text ~* '(ci-0117|CI Knit|W-1|G-1|Plot 4|@)' then
    raise exception 'the answer names a supplier, a certificate or an address';
  end if;
end
$$;

rollback;
