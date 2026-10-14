-- Split the BKMEA member "KNIT" off `knit-fashion` (founder, 13 Oct 2026: "split KNIT off from Knit Fashion").
--
-- BKMEA lists "KNIT" as its own member: no membership number ("- C/2009"), page 511, its own address
-- (S. M Maleh Road) and owner. Its two entries sat on `knit-fashion` (BKMEA member 675, R. K Das Road),
-- which therefore showed KNIT's 230 workers, capacity, machine count and one phone number.
--
-- This block makes "KNIT" a company of its own (`/suppliers/knit`), moves its two entries and the
-- claims read from its page, and leaves `knit-fashion` with only what its own entries back. The four
-- product words Knit Fashion carried from Shatabdi Apparels' page (moved earlier today) go as well.
-- Rows changed are copied first to public._snapshot_bkmea_shared_20261013 (action 'before-split').
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises. To apply, delete the line marked REHEARSAL.

do $split$
declare
  bk uuid := (select id from public.sources where code = 'BKMEA');
  kf uuid := (select id from public.suppliers where slug = 'knit-fashion');
  k  uuid;
  n  int;
begin
  if exists (select 1 from public.suppliers where slug = 'knit') then raise exception 'guard: a company "knit" already exists'; end if;
  select count(*) into n from public.source_records
   where supplier_id = kf and source_id = bk
     and (id::text, source_ref) in (('ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3', 'page-511'), ('4110cccb-c674-4148-8bf0-8de1dad25fb8', '511:detail'));
  if n <> 2 then raise exception 'guard: % of the 2 KNIT entries are on knit-fashion', n; end if;

  insert into public._snapshot_bkmea_shared_20261013
    select 'suppliers', 'before-split', s.id, to_jsonb(s) - 'discover_search_tsv' from public.suppliers s where s.id = kf;
  insert into public._snapshot_bkmea_shared_20261013
    select 'source_records', 'before-split', r.id, to_jsonb(r) from public.source_records r
     where r.id in ('ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3', '4110cccb-c674-4148-8bf0-8de1dad25fb8');
  insert into public._snapshot_bkmea_shared_20261013
    select 'evidence_claims', 'before-split', c.id, to_jsonb(c) from public.evidence_claims c
      join public.evidence_documents d on d.id = c.evidence_id
     where c.supplier_id = kf and d.url like '%/member/details/511';

  -- the new company, off the site until its entries are on it (the publish guard needs one)
  insert into public.suppliers
    (slug, company_name, company_name_norm, entity_type, country, city, district, address_raw,
     employees_total, employees_male, employees_female, production_capacity_pcs_day, machines_sewing,
     contact_name, contact_role, email_primary, phones, source_tags, factory_types, bkmea_verified, is_published)
  select 'knit', 'KNIT', 'knit', 'factory', 'Bangladesh', 'Narayanganj', 'Narayanganj', r.fields ->> 'bkmea_factory_address',
         (r.fields ->> 'bkmea_employees_total')::int, (r.fields ->> 'bkmea_employees_male')::int, (r.fields ->> 'bkmea_employees_female')::int,
         (r.fields ->> 'bkmea_production_capacity')::int, (r.fields ->> 'bkmea_machines_sewing')::int,
         r.fields ->> 'bkmea_owner_name', 'Owner', r.fields ->> 'bkmea_owner_email',
         array['+880' || ltrim(r.fields ->> 'bkmea_rep_mobile', '0')],
         array(select t from unnest(s.source_tags) t where t::text = 'BKMEA'),
         array(select t from unnest(s.factory_types) t where t::text = 'Knit'),
         true, false
    from public.source_records r, public.suppliers s
   where r.id = 'ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3' and s.id = kf
  returning id into k;

  update public.source_records set supplier_id = k
   where id in ('ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3', '4110cccb-c674-4148-8bf0-8de1dad25fb8');
  update public.evidence_claims c
     set supplier_id = k, subject_id = case when c.subject_table = 'suppliers' then k else c.subject_id end
    from public.evidence_documents d
   where d.id = c.evidence_id and d.url like '%/member/details/511' and c.supplier_id = kf;
  update public.suppliers set is_published = true where id = k;
  update public.suppliers set completeness_pct = public.compute_completeness(k) where id = k;

  -- Knit Fashion keeps what its own entries back: no worker or capacity figure, its own 140 machines,
  -- its own phones, and the products its BGMEA entry lists
  update public.suppliers
     set employees_total = null, employees_male = null, employees_female = null, production_capacity_pcs_day = null,
         machines_sewing = (select (r.fields ->> 'bkmea_machines_sewing')::int from public.source_records r
                             where r.supplier_id = kf and r.source_id = bk and r.source_ref = '675'),
         phones = array_remove(phones, '+8801711530166'),
         principal_products = array(select p from unnest(principal_products) p where p in ('Cardigans', 'Sweaters'))
   where id = kf;
  update public.suppliers set completeness_pct = public.compute_completeness(kf) where id = kf;
  perform public.recompute_t13_source_count(k);
  perform public.recompute_t13_source_count(kf);

  if not exists (select 1 from public.suppliers where id = k and is_published and t13_source_count >= 1) then
    raise exception 'after: the new company is not on the site';
  end if;
  if exists (select 1 from public.source_records where supplier_id = kf and fields ->> 'bkmea_detail_id' = '511') then
    raise exception 'after: knit-fashion still holds a KNIT entry';
  end if;

  raise exception 'DRY RUN OK | %', (  -- REHEARSAL
    select string_agg(format('%s (%s): pub %s, registers %s, shows no. %s, workers %s, capacity %s, machines %s, phones %s, products %s, complete %s, entries [%s], live claims %s',
             s.slug, s.company_name, s.is_published, s.t13_source_count, coalesce(s.bkmea_reg_number, '-'), coalesce(s.employees_total::text, '-'),
             coalesce(s.production_capacity_pcs_day::text, '-'), s.machines_sewing, cardinality(s.phones), array_to_string(s.principal_products, '/'), s.completeness_pct,
             (select string_agg(so.code || ' ' || r.source_ref, ', ' order by r.source_ref) from public.source_records r join public.sources so on so.id = r.source_id where r.supplier_id = s.id),
             (select count(*) from public.evidence_claims c where c.supplier_id = s.id and c.status = 'active')), ' ;; ' order by s.slug)
      from public.suppliers s where s.slug in ('knit', 'knit-fashion'));
end
$split$;
