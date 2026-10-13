-- BKMEA memberships sitting under a company the register files them apart from (founder, 13 Oct 2026:
-- "fix the 35 BKMEA pages under the wrong company").
--
-- A fresh read found 30 profiles holding a BKMEA membership whose register name is not the profile's.
-- Eight are one company spelled two ways and are left. Fifteen memberships on twelve profiles are
-- another company's, taken in by the loader's fuzzy name match (K. R. KNIT WEAR took B. R. KNIT WEAR;
-- RIPON FASHIONS took ORION FASHIONS). Each row below is one of them:
--
--   src_slug   the profile the membership sits on
--   mem        the membership number, as the register gives it
--   tgt_slug   the existing profile of that exact name, which takes it; or
--   new_slug   the slug of a new company (the register's name, as the loader would slug it)
--
-- Per row: the membership's list and detail entries and the claims read from its page move; the
-- profile it leaves gives up what only that membership backed (figures, phones, mailbox, contact,
-- products) and shows its own membership number; the two are recorded as two companies.
-- Rows changed are copied first to public._snapshot_bkmea_pages_20261013.
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises. To apply, delete the line marked REHEARSAL.

do $fix$
declare
  bk uuid := (select id from public.sources where code = 'BKMEA');
  c record; x record;
  src uuid; tgt uuid; n int; reg text; v_total int; v_male int; v_female int; v_num bigint; v_text text;
  w public.suppliers%rowtype;
  report text := '';
  is_num constant text := '^\d+$';
begin
  create temp table _cases (src_slug text, mem text, tgt_slug text, new_slug text, name text, new_norm text, district text) on commit drop;
  insert into _cases values
('aswad-composite-mills', '1957', 'asia-composite-mills', null, 'ASIA COMPOSITE MILLS LTD.', null, 'Gazipur'),
('ca-apparels', '924', 'ca-knitwear', null, 'C. A KNITWEAR LTD.', null, 'Dhaka'),
('ca-apparels', '16', 'ca-knitwear', null, 'C.A KNITWEAR', null, 'Dhaka'),
('eurotex-fashion', '255', 'eurotex-knitwear', null, 'EUROTEX KNITWEAR LTD', null, 'Narayanganj'),
('knit-line', '1079', 'knit-line-fashion', null, 'KNIT LINE FASHION', null, 'Dhaka'),
('maa-knitting-and-dyeing-industries', '291', 'masaha-knitting-and-dyeing-industries', null, 'MASAHA KNITTING & DYEING INDUSTRIES LTD', null, 'Dhaka'),
('mm-knitwear', '990', 'mm-fashion', null, 'M. M. FASHION', null, 'Narayanganj'),
('rr-knitwear', '305', 'rs-knitwear', null, 'R. S. KNIT WEAR (PVT) LTD.', null, 'Narayanganj'),
('sensible-knitwear', '801', 'sensible-fashion', null, 'SENSIBLE FASHION (PVT) LTD.', null, 'Narayanganj'),
('ssb-knitwear', '1314', 'sb-knitwear', null, 'S. B. KNIT WEAR', null, 'Narayanganj'),
('fm-apparels', '152', null, 'fm-knitwear', 'F. M KNITWEAR LTD.', 'fm knitwear', 'Dhaka'),
('hb-fashions', '191', null, 'hb-apparels', 'H. B APPARELS (PVT) LTD', 'hb apparels', 'Narayanganj'),
('kr-knitwear', '825', null, 'br-knitwear', 'B. R. KNIT WEAR', 'br knitwear', 'Narayanganj'),
('ripon-fashions', '2090', null, 'orion-fashions', 'ORION FASHIONS LTD', 'orion fashions', 'Narayanganj'),
('sm-knitwear', '1092', null, 'seam-knitwear', 'SEAM KNIT WEAR', 'seam knitwear', 'Narayanganj');
  create temp table _m (like public.source_records) on commit drop;

  create table public._snapshot_bkmea_pages_20261013 (tbl text not null, action text not null, row_id uuid not null, old_row jsonb not null);
  alter table public._snapshot_bkmea_pages_20261013 enable row level security;
  revoke all on public._snapshot_bkmea_pages_20261013 from anon, authenticated;

  for c in select * from _cases
  loop
    select id into strict src from public.suppliers where slug = c.src_slug and facility_of is null and is_published;
    truncate _m;
    insert into _m select * from public.source_records r
     where r.supplier_id = src and r.source_id = bk and substring(r.fields ->> 'bkmea_membership_no' from '^\s*(\d+)') = c.mem;
    select count(*) into n from _m;
    if n < 2 or not exists (select 1 from _m where fields -> 'bkmea_raw_kv' ->> 'Factory Name' = c.name) then
      raise exception 'guard: % member % is not what was read (% entries)', c.src_slug, c.mem, n;
    end if;
    if not exists (select 1 from public.source_records r where r.supplier_id = src and r.source_id = bk and r.id not in (select id from _m)) then
      raise exception 'guard: % would be left with no BKMEA entry of its own', c.src_slug;
    end if;

    insert into public._snapshot_bkmea_pages_20261013
      select 'suppliers', 'before ' || c.src_slug || '/' || c.mem, s.id, to_jsonb(s) - 'discover_search_tsv' from public.suppliers s
       where s.id = src or s.slug = c.tgt_slug;
    insert into public._snapshot_bkmea_pages_20261013 select 'source_records', 'before', m.id, to_jsonb(m) from _m m;
    insert into public._snapshot_bkmea_pages_20261013
      select 'evidence_claims', 'before', e.id, to_jsonb(e) from public.evidence_claims e
       where e.supplier_id = src and (e.field_key in ('bkmea_membership_no', 'bkmea_reg_number')
          or exists (select 1 from public.evidence_documents d, _m m where d.id = e.evidence_id and d.url = m.fields ->> 'bkmea_detail_url'));

    -- where it goes
    if c.tgt_slug is not null then
      select id into strict tgt from public.suppliers where slug = c.tgt_slug and facility_of is null and is_published;
    else
      if exists (select 1 from public.suppliers where slug = c.new_slug) then raise exception 'guard: % already exists', c.new_slug; end if;
      insert into public.suppliers
        (slug, company_name, company_name_norm, entity_type, country, city, district, address_raw,
         employees_total, employees_male, employees_female, production_capacity_pcs_day, machines_sewing,
         contact_name, contact_role, email_primary, phones, source_tags, factory_types, bkmea_verified, bkmea_reg_number, is_published)
      select c.new_slug, c.name, c.new_norm, 'factory', 'Bangladesh', c.district, c.district,
             (select m.fields ->> 'bkmea_factory_address' from _m m where nullif(m.fields ->> 'bkmea_factory_address', '') is not null order by m.source_ref like '%:detail' desc limit 1),
             (select max((m.fields ->> 'bkmea_employees_total')::int) from _m m where m.fields ->> 'bkmea_employees_total' ~ is_num),
             (select max((m.fields ->> 'bkmea_employees_male')::int) from _m m where m.fields ->> 'bkmea_employees_male' ~ is_num),
             (select max((m.fields ->> 'bkmea_employees_female')::int) from _m m where m.fields ->> 'bkmea_employees_female' ~ is_num),
             (select max((m.fields ->> 'bkmea_production_capacity')::int) from _m m where m.fields ->> 'bkmea_production_capacity' ~ is_num and length(m.fields ->> 'bkmea_production_capacity') < 10),
             (select max((m.fields ->> 'bkmea_machines_sewing')::int) from _m m where m.fields ->> 'bkmea_machines_sewing' ~ is_num),
             (select nullif(m.fields ->> 'bkmea_owner_name', '') from _m m where m.source_ref !~ ':' limit 1),
             (select case when nullif(m.fields ->> 'bkmea_owner_name', '') is not null then 'Owner' end from _m m where m.source_ref !~ ':' limit 1),
             (select nullif(m.fields ->> 'bkmea_owner_email', '') from _m m where m.source_ref !~ ':' and m.fields ->> 'bkmea_owner_email' ~ '^[^@\s]+@[^@\s]+\.[a-z]+$' limit 1),
             array(select '+880' || ltrim(m.fields ->> 'bkmea_rep_mobile', '0') from _m m where m.fields ->> 'bkmea_rep_mobile' ~ '^01\d{9}$' limit 1),
             array(select t from unnest(s.source_tags) t where t::text = 'BKMEA'),
             array(select t from unnest(s.factory_types) t where t::text = 'Knit'),
             true,
             (select m.fields ->> 'bkmea_reg_number' from _m m where m.fields ->> 'bkmea_reg_number' ~ '^\d+\s*-' order by m.source_ref like '%:detail' desc, m.fetched_at desc limit 1),
             false
        from public.suppliers s where s.id = src
      returning id into tgt;
    end if;

    -- the entries move (a copy the target already holds is dropped), and the claims read from the page
    delete from public.source_records r using _m m
     where r.id = m.id and exists (select 1 from public.source_records t where t.supplier_id = tgt and t.source_id = r.source_id and t.source_ref = r.source_ref);
    update public.source_records r set supplier_id = tgt from _m m where r.id = m.id;
    delete from public.evidence_claims e using public.evidence_documents d, _m m
     where d.id = e.evidence_id and d.url = m.fields ->> 'bkmea_detail_url' and e.supplier_id = src
       and exists (select 1 from public.evidence_claims t where t.supplier_id = tgt and t.subject_table = e.subject_table and t.field_key = e.field_key
                    and t.evidence_id = e.evidence_id and t.subject_key is not distinct from e.subject_key);
    update public.evidence_claims e
       set supplier_id = tgt, subject_id = case when e.subject_table = 'suppliers' then tgt else e.subject_id end
      from public.evidence_documents d
     where d.id = e.evidence_id and e.supplier_id = src and d.url in (select m.fields ->> 'bkmea_detail_url' from _m m);

    -- the profile it leaves: give up what only this membership backed
    select * into w from public.suppliers where id = src;
    if exists (select 1 from _m m where m.fields ->> 'bkmea_factory_address' = w.address_raw)
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields ->> 'bkmea_factory_address' = w.address_raw) then
      raise exception 'guard: % shows the address of member %; that needs a hand', c.src_slug, c.mem;
    end if;
    if w.employees_total is not null
       and exists (select 1 from _m m where m.fields ->> 'bkmea_employees_total' = w.employees_total::text)
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields ->> 'bkmea_employees_total' = w.employees_total::text) then
      select (r.fields ->> 'bkmea_employees_total')::int,
             case when r.fields ->> 'bkmea_employees_male' ~ is_num then (r.fields ->> 'bkmea_employees_male')::int end,
             case when r.fields ->> 'bkmea_employees_female' ~ is_num then (r.fields ->> 'bkmea_employees_female')::int end
        into v_total, v_male, v_female
        from public.source_records r
       where r.supplier_id = src and r.source_id = bk and r.fields ->> 'bkmea_employees_total' ~ is_num and (r.fields ->> 'bkmea_employees_total')::int > 0
       order by (r.source_ref like '%:detail') desc, r.fetched_at desc limit 1;  -- the newest page, as the display rule reads
      if not found then v_total := null; v_male := null; v_female := null; end if;
      update public.suppliers set employees_total = v_total, employees_male = v_male, employees_female = v_female where id = src;
    end if;
    if w.production_capacity_pcs_day is not null
       and exists (select 1 from _m m where m.fields ->> 'bkmea_production_capacity' = w.production_capacity_pcs_day::text)
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields ->> 'bkmea_production_capacity' = w.production_capacity_pcs_day::text) then
      select (r.fields ->> 'bkmea_production_capacity')::bigint into v_num from public.source_records r
       where r.supplier_id = src and r.source_id = bk and r.fields ->> 'bkmea_production_capacity' ~ is_num and length(r.fields ->> 'bkmea_production_capacity') < 10
         and r.fields ->> 'bkmea_production_capacity' <> '0'
       order by (r.source_ref like '%:detail') desc, r.fetched_at desc limit 1;
      if not found then v_num := null; end if;
      update public.suppliers set production_capacity_pcs_day = nullif(v_num, 0)::int where id = src;
    end if;
    if w.machines_sewing is not null
       and exists (select 1 from _m m where m.fields ->> 'bkmea_machines_sewing' = w.machines_sewing::text)
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields ->> 'bkmea_machines_sewing' = w.machines_sewing::text) then
      select (r.fields ->> 'bkmea_machines_sewing')::bigint into v_num from public.source_records r
       where r.supplier_id = src and r.source_id = bk and r.fields ->> 'bkmea_machines_sewing' ~ is_num and r.fields ->> 'bkmea_machines_sewing' <> '0'
       order by (r.source_ref like '%:detail') desc, r.fetched_at desc limit 1;
      if not found then v_num := null; end if;
      update public.suppliers set machines_sewing = nullif(v_num, 0)::int where id = src;
    end if;
    -- a phone, mailbox or contact that only the membership's entries carry
    update public.suppliers s
       set phones = array(select p from unnest(s.phones) p
                           where not exists (select 1 from _m m where length(regexp_replace(p, '\D', '', 'g')) >= 9
                                               and m.fields::text like '%' || right(regexp_replace(p, '\D', '', 'g'), 9) || '%')
                              or exists (select 1 from public.source_records r where r.supplier_id = src
                                          and r.fields::text like '%' || right(regexp_replace(p, '\D', '', 'g'), 9) || '%'))
     where s.id = src;
    if w.email_primary is not null and exists (select 1 from _m m where m.fields::text ilike '%' || w.email_primary::text || '%')
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields::text ilike '%' || w.email_primary::text || '%') then
      select nullif(r.fields ->> 'bkmea_owner_email', '') into v_text from public.source_records r
       where r.supplier_id = src and r.source_id = bk and r.fields ->> 'bkmea_owner_email' ~ '^[^@\s]+@[^@\s]+\.[a-z]+$' order by r.fetched_at desc limit 1;
      if not found then v_text := null; end if;
      update public.suppliers set email_primary = v_text where id = src;
    end if;
    if w.contact_name is not null and exists (select 1 from _m m where m.fields ->> 'bkmea_owner_name' = w.contact_name)
       and not exists (select 1 from public.source_records r where r.supplier_id = src and r.fields::text like '%' || w.contact_name || '%') then
      select nullif(r.fields ->> 'bkmea_owner_name', '') into v_text from public.source_records r
       where r.supplier_id = src and r.source_id = bk and nullif(r.fields ->> 'bkmea_owner_name', '') is not null order by r.fetched_at desc limit 1;
      if not found then v_text := null; end if;
      update public.suppliers set contact_name = v_text, contact_role = case when v_text is null then null else contact_role end where id = src;
    end if;
    update public.suppliers s
       set principal_products = array(select p from unnest(s.principal_products) p
                                       where not exists (select 1 from _m m, regexp_split_to_table(coalesce(m.fields ->> 'bkmea_products', ''), '\s*,\s*') t
                                                          where t <> '' and rtrim(lower(t), 's') = rtrim(lower(p), 's'))
                                          or exists (select 1 from public.source_records r where r.supplier_id = src and r.fields::text ilike '%' || rtrim(p, 'sS') || '%'))
     where s.id = src;

    -- membership number: the newest valid page, else the newest valid list row (the display rule)
    for x in select y.id as sid from (values (src), (tgt)) y(id)
    loop
      reg := null;
      select r.fields ->> 'bkmea_reg_number' into reg from public.source_records r
       where r.supplier_id = x.sid and r.source_id = bk and r.status = 'active' and r.fields ->> 'bkmea_reg_number' ~ '^\d+\s*-'
       order by (r.source_ref like '%:detail') desc, r.fetched_at desc limit 1;
      update public.suppliers set bkmea_reg_number = reg, bkmea_verified = (reg is not null or bkmea_verified) where id = x.sid;
      update public.evidence_claims e set status = 'superseded'
       where e.supplier_id = x.sid and e.field_key in ('bkmea_membership_no', 'bkmea_reg_number') and e.status <> 'superseded' and e.field_value is distinct from reg;
      update public.evidence_claims e set status = 'active'
       where e.id in (select distinct on (field_key) id from public.evidence_claims
                       where supplier_id = x.sid and field_key in ('bkmea_membership_no', 'bkmea_reg_number') and field_value = reg
                       order by field_key, last_confirmed_at desc nulls last, created_at desc);
    end loop;
    update public.suppliers s
       set source_tags = s.source_tags || array(select t from unnest(o.source_tags) t where t::text = 'BKMEA' and not exists (select 1 from unnest(s.source_tags) u where u::text = 'BKMEA'))
      from public.suppliers o where s.id = tgt and o.id = src;
    if c.tgt_slug is null then
      update public.suppliers set is_published = true where id = tgt;
    end if;
    update public.suppliers set completeness_pct = public.compute_completeness(id) where id in (src, tgt);
    perform public.recompute_t13_source_count(src);
    perform public.recompute_t13_source_count(tgt);

    if not exists (select 1 from public.resolution_edges e where e.superseded_at is null and e.supplier_a = least(src, tgt) and e.supplier_b = greatest(src, tgt)) then
      insert into public.resolution_edges (supplier_a, supplier_b, verdict, decided_by, rationale, evidence_note)
      values (least(src, tgt), greatest(src, tgt), 'different', 'founder:bkmea-pages-2026-10-13',
              format('BKMEA member %s is %s, not %s; its entries sat on the wrong profile and were moved on 13 Oct 2026.', c.mem, c.name, w.company_name),
              'ops/plans/bkmea-wrong-company-fix.sql');
    end if;

    if (select count(*) from public.suppliers where id in (src, tgt) and is_published) <> 2 then
      raise exception 'after: % or its counterpart is off the site', c.src_slug;
    end if;
    report := report || format(E'\n%s: no. %s>%s workers %s>%s cap %s>%s mach %s>%s phones %s>%s mail %s contact %s products %s>%s || %s: no. %s workers %s entries [%s]',
      c.src_slug, coalesce(w.bkmea_reg_number, '-'), (select coalesce(bkmea_reg_number, '-') from public.suppliers where id = src),
      coalesce(w.employees_total::text, '-'), (select coalesce(employees_total::text, '-') from public.suppliers where id = src),
      coalesce(w.production_capacity_pcs_day::text, '-'), (select coalesce(production_capacity_pcs_day::text, '-') from public.suppliers where id = src),
      coalesce(w.machines_sewing::text, '-'), (select coalesce(machines_sewing::text, '-') from public.suppliers where id = src),
      cardinality(w.phones), (select cardinality(phones) from public.suppliers where id = src),
      (select case when email_primary is not distinct from w.email_primary then 'kept' when email_primary is null then 'removed' else 'own' end from public.suppliers where id = src),
      (select case when contact_name is not distinct from w.contact_name then 'kept' when contact_name is null then 'removed' else 'own' end from public.suppliers where id = src),
      cardinality(w.principal_products), (select cardinality(principal_products) from public.suppliers where id = src),
      (select slug from public.suppliers where id = tgt), (select coalesce(bkmea_reg_number, '-') from public.suppliers where id = tgt),
      (select coalesce(employees_total::text, '-') from public.suppliers where id = tgt),
      (select string_agg(so.code || ' ' || r.source_ref, ', ' order by so.code, r.source_ref) from public.source_records r join public.sources so on so.id = r.source_id where r.supplier_id = tgt));
  end loop;

  raise exception 'DRY RUN OK |%', report;  -- REHEARSAL
end
$fix$;
