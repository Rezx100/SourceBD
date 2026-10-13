-- Split the Chattogram "Knit Fashion (Pvt.) Ltd." off `knit-fashion`
-- (founder, 13 Oct 2026: "split the Chattogram one off Knit Fashion too").
--
-- `knit-fashion` held two companies of one name: BKMEA member 675 at R. K Das Road, Narayanganj, and
-- BGMEA general member 1438, a sweater factory at C.D.A R/A, Agrabad, Chattogram, founded 1993. The
-- loader joins on the normalised name, so the two became one profile.
--
-- This block gives the BGMEA member its own company (`/suppliers/knit-fashion-2`, the slug the split
-- tool `ops/unmerge_bkmea_suppliers.py` would give), moves its entry and the claims read from its
-- BGMEA page, and takes from `knit-fashion` what only that entry backed. It then records both splits
-- of today as rulings ("two companies"), so neither the loader nor the duplicate audit rejoins them.
-- Rows changed are copied first to public._snapshot_bkmea_shared_20261013 (action 'before-split-2').
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises. To apply, delete the line marked REHEARSAL.

do $split$
declare
  kf uuid := (select id from public.suppliers where slug = 'knit-fashion');
  kn uuid := (select id from public.suppliers where slug = 'knit');
  rec constant uuid := '44252cc1-149e-4d0e-a7db-70df3c02017a';  -- BGMEA general:1438
  c  uuid;
  n  int;
begin
  if exists (select 1 from public.suppliers where slug = 'knit-fashion-2') then raise exception 'guard: knit-fashion-2 already exists'; end if;
  if kn is null then raise exception 'guard: the company "knit" is missing'; end if;
  select count(*) into n from public.source_records r join public.sources so on so.id = r.source_id
   where r.id = rec and r.supplier_id = kf and so.code = 'BGMEA' and r.source_ref = 'general:1438'
     and r.fields ->> 'factory_address' ilike '%Chittagong%';
  if n <> 1 then raise exception 'guard: the BGMEA entry is not where it was'; end if;
  if (select count(*) from public.source_records where supplier_id = kf) <> 3 then
    raise exception 'guard: knit-fashion does not hold exactly its three entries';
  end if;

  insert into public._snapshot_bkmea_shared_20261013
    select 'suppliers', 'before-split-2', s.id, to_jsonb(s) - 'discover_search_tsv' from public.suppliers s where s.id = kf;
  insert into public._snapshot_bkmea_shared_20261013
    select 'source_records', 'before-split-2', r.id, to_jsonb(r) from public.source_records r where r.id = rec;
  insert into public._snapshot_bkmea_shared_20261013
    select 'evidence_claims', 'before-split-2', x.id, to_jsonb(x) from public.evidence_claims x
      join public.evidence_documents d on d.id = x.evidence_id
     where x.supplier_id = kf and d.url like '%bgmea.com.bd%';

  insert into public.suppliers
    (slug, company_name, company_name_norm, entity_type, country, city, district, address_raw,
     email_primary, phones, established_date, principal_products, factory_types, production_capacity_dozen_yearly,
     bgmea_reg_numbers, bgmea_verified, source_tags, is_published)
  select 'knit-fashion-2', r.fields ->> 'scraped_company_name', s.company_name_norm, 'factory', 'Bangladesh', 'Chattogram', 'Chattogram',
         r.fields ->> 'factory_address', r.fields ->> 'mailing_email',
         array(select p from unnest(s.phones) p where p = '+880' || (r.fields ->> 'factory_phone')),
         r.fields ->> 'established_date',
         array(select p from unnest(s.principal_products) p where p in ('Cardigans', 'Sweaters')),
         array(select t from unnest(s.factory_types) t where t::text = 'Sweater'),
         (r.fields ->> 'production_capacity_dozen_yearly')::bigint,
         s.bgmea_reg_numbers, true,
         array(select t from unnest(s.source_tags) t where t::text = 'BGMEA'), false
    from public.source_records r, public.suppliers s
   where r.id = rec and s.id = kf
  returning id into c;

  update public.source_records set supplier_id = c where id = rec;
  update public.evidence_claims x
     set supplier_id = c, subject_id = case when x.subject_table = 'suppliers' then c else x.subject_id end
    from public.evidence_documents d
   where d.id = x.evidence_id and d.url like '%bgmea.com.bd%' and x.supplier_id = kf;
  update public.suppliers set is_published = true where id = c;
  update public.suppliers set completeness_pct = public.compute_completeness(c) where id = c;

  -- Knit Fashion (BKMEA 675, Narayanganj) gives up what only the BGMEA entry backed
  update public.suppliers s
     set bgmea_reg_numbers = '{}', bgmea_verified = false,
         source_tags = array(select t from unnest(s.source_tags) t where t::text <> 'BGMEA'),
         factory_types = array(select t from unnest(s.factory_types) t where t::text <> 'Sweater'),
         principal_products = array(select p from unnest(s.principal_products) p where p not in ('Cardigans', 'Sweaters')),
         production_capacity_dozen_yearly = null, established_date = null,
         phones = array(select p from unnest(s.phones) p where p <> '+88031713699')
   where s.id = kf;
  update public.suppliers set completeness_pct = public.compute_completeness(kf) where id = kf;
  perform public.recompute_t13_source_count(c);
  perform public.recompute_t13_source_count(kf);

  -- both of today's splits, as rulings
  insert into public.resolution_edges (supplier_a, supplier_b, verdict, decided_by, rationale, evidence_note)
  values
    (least(kf, c), greatest(kf, c), 'different', 'founder:split-2026-10-13',
     'KNIT FASHION (BKMEA member 675, Narayanganj) and Knit Fashion (Pvt.) Ltd. (BGMEA general member 1438, Agrabad, Chattogram) are two companies of one name; the founder had them split on 13 Oct 2026.',
     'ops/plans/knit-fashion-chattogram-split.sql'),
    (least(kf, kn), greatest(kf, kn), 'different', 'founder:split-2026-10-13',
     'KNIT (BKMEA page 511, no membership number, S. M Maleh Road) is not KNIT FASHION (BKMEA member 675, R. K Das Road); the founder had it split off on 13 Oct 2026.',
     'ops/plans/knit-split.sql');

  if not exists (select 1 from public.suppliers where id = c and is_published and t13_source_count = 1) then
    raise exception 'after: the new company is not on the site';
  end if;
  if not exists (select 1 from public.suppliers where id = kf and is_published and t13_source_count = 1) then
    raise exception 'after: knit-fashion is off the site or still counts two registers';
  end if;

  raise exception 'DRY RUN OK | %', (  -- REHEARSAL
    select string_agg(format('%s (%s): pub %s, %s, registers %s, bgmea %s, bkmea %s, founded %s, doz/yr %s, machines %s, phones %s, products [%s], types [%s], tags [%s], complete %s, entries [%s], live claims %s',
             s.slug, s.company_name, s.is_published, s.district, s.t13_source_count, array_to_string(s.bgmea_reg_numbers, '/'), coalesce(s.bkmea_reg_number, '-'),
             coalesce(s.established_date, '-'), coalesce(s.production_capacity_dozen_yearly::text, '-'), coalesce(s.machines_sewing::text, '-'), cardinality(s.phones),
             array_to_string(s.principal_products, '/'), array_to_string(s.factory_types, '/'), array_to_string(s.source_tags, '/'), s.completeness_pct,
             (select string_agg(so.code || ' ' || r.source_ref, ', ' order by r.source_ref) from public.source_records r join public.sources so on so.id = r.source_id where r.supplier_id = s.id),
             (select count(*) from public.evidence_claims x where x.supplier_id = s.id and x.status = 'active')), ' ;; ' order by s.slug)
      from public.suppliers s where s.slug in ('knit-fashion', 'knit-fashion-2'));
end
$split$;
