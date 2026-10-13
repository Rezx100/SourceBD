-- Merge the certain duplicate suppliers: the SQL twin of ops/merge_duplicate_suppliers.py.
--
-- The Python merge needs the database port, which the founder's machine cannot
-- reach; this block does the same work through the Supabase SQL endpoint. Pairs
-- come from public._snapshot_dup_merge_20261013_pairs (keep, lose), filled from
-- the "merge" list of ops/report_duplicate_suppliers.py.
--
-- What it does per pair, in one transaction (any error undoes everything):
--   1. One register entry scraped onto both rows: the newer scrape stays.
--   2. Everything that points at the losing row moves to the kept row. Where the
--      kept row already holds the same thing (a certificate, a claim from the
--      same document, a score), the losing copy is dropped.
--   3. The kept row takes what it lacks from the losing row (arrays joined,
--      blanks filled, the larger workforce), keeps its own name and address.
--   4. Nothing may still point at the losing row; its public address is recorded
--      in public.supplier_slug_redirects (migration 0149), so /suppliers/<old slug>
--      redirects to the kept profile instead of answering 404; then it is deleted.
--      Addresses that already redirected to the losing row moved to the kept row
--      in step 2 with everything else. Without 0149 applied, this block raises.
-- Every moved row id and every dropped or deleted row is written to
-- public._snapshot_dup_merge_20261013_rows, and both supplier rows as they were
-- to public._snapshot_dup_merge_20261013_suppliers, so a merge can be undone.
--
-- It REFUSES (raises, nothing written) when a row is a building, claimed or
-- sanctioned, when both rows hold a safety record, or when the losing row has
-- rows in a table this block does not reconcile (saved lists, threads, orders).
--
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises, so nothing commits.
-- To apply, delete the line marked REHEARSAL and put in its place a check that
-- the four counts equal the rehearsal's, as the apply of 13 Oct 2026 did:
--   if n_deleted <> 70 or n_moved <> 1813 or n_dropped <> 85 or n_buildings <> 6 then raise exception ...

do $merge$
declare
  p record; r record; t record;
  w public.suppliers%rowtype; l public.suppliers%rowtype;
  n bigint; reg text; drop_id uuid; keep_id uuid;
  n_moved bigint := 0; n_dropped bigint := 0; n_deleted int := 0; n_buildings bigint := 0;
  refs text[][];
begin
  -- ---- guards ---------------------------------------------------------------
  if exists (select 1 from public._snapshot_dup_merge_20261013_pairs a
              join public._snapshot_dup_merge_20261013_pairs b on b.keep = a.lose) then
    raise exception 'guard: a kept row is also a losing row';
  end if;
  select count(*) into n from public.suppliers s
   where s.id in (select keep from public._snapshot_dup_merge_20261013_pairs
                  union select lose from public._snapshot_dup_merge_20261013_pairs);
  if n <> (select count(distinct keep) + count(*) from public._snapshot_dup_merge_20261013_pairs) then
    raise exception 'guard: % supplier rows found, not every pair is still there', n;
  end if;
  if exists (select 1 from public.suppliers s
              where s.id in (select keep from public._snapshot_dup_merge_20261013_pairs
                             union select lose from public._snapshot_dup_merge_20261013_pairs)
                and (s.facility_of is not null or s.claimed_by is not null or s.is_sanctioned)) then
    raise exception 'guard: a row is a building, claimed or sanctioned';
  end if;
  if exists (select 1 from public._snapshot_dup_merge_20261013_pairs a
              join public.suppliers s on s.id = a.keep where not s.is_published) then
    raise exception 'guard: a kept row is not published';
  end if;
  if exists (select 1 from public._snapshot_dup_merge_20261013_pairs a
              join public.rsc_remediation x on x.supplier_id = a.lose
              join public.rsc_remediation y on y.supplier_id = a.keep) then
    raise exception 'guard: both rows of a pair hold a safety record (two buildings: link, do not merge)';
  end if;
  if exists (select 1 from public._snapshot_dup_merge_20261013_pairs a
              join public.compliance_documents x on x.supplier_id = a.lose
              join public.compliance_documents y on y.supplier_id = a.keep
                                                and y.doc_type = x.doc_type and y.sha256 = x.sha256) then
    raise exception 'guard: both rows of a pair hold the same document';
  end if;
  -- Tables whose rows a buyer or a supplier made. None of these pairs has any;
  -- a pair that does needs a person, not this block.
  for t in select * from (values ('saved_suppliers','supplier_id'), ('message_threads','supplier_id'),
                                 ('orders','supplier_id'), ('rfq_quotes','supplier_id'),
                                 ('claim_requests','supplier_id'), ('sanctions_screening','supplier_id'),
                                 ('supplier_field_locks','supplier_id'), ('volza_reveal_uses','supplier_id'),
                                 ('volza_shipment_reveals','supplier_id'), ('partner_factories','buying_house_id'),
                                 ('partner_factories','factory_id'), ('supplier_relationships','buying_house_id'),
                                 ('supplier_relationships','factory_id')) v(tbl, col)
  loop
    execute format('select count(*) from public.%I where %I in (select lose from public._snapshot_dup_merge_20261013_pairs)',
                   t.tbl, t.col) into n;
    if n > 0 then
      raise exception 'guard: % rows in %.% point at a losing row', n, t.tbl, t.col;
    end if;
  end loop;
  if exists (select 1 from public.rfqs q, public._snapshot_dup_merge_20261013_pairs a where a.lose = any (q.target_supplier_ids))
     or exists (select 1 from public.rfq_drafts q, public._snapshot_dup_merge_20261013_pairs a where a.lose = any (q.target_supplier_ids)) then
    raise exception 'guard: an RFQ names a losing row';
  end if;

  -- ---- snapshot -------------------------------------------------------------
  create table public._snapshot_dup_merge_20261013_suppliers as
    select case when s.id in (select lose from public._snapshot_dup_merge_20261013_pairs) then 'lose' else 'keep' end as role,
           (select a.keep from public._snapshot_dup_merge_20261013_pairs a where a.lose = s.id) as merged_into,
           s.*
      from public.suppliers s
     where s.id in (select keep from public._snapshot_dup_merge_20261013_pairs
                    union select lose from public._snapshot_dup_merge_20261013_pairs);
  create table public._snapshot_dup_merge_20261013_rows
    (tbl text not null, col text, action text not null, row_id uuid, lose uuid not null, keep uuid not null, old_row jsonb);
  alter table public._snapshot_dup_merge_20261013_suppliers enable row level security;
  alter table public._snapshot_dup_merge_20261013_rows enable row level security;
  revoke all on public._snapshot_dup_merge_20261013_suppliers, public._snapshot_dup_merge_20261013_rows from anon, authenticated;

  -- Every column that points at a supplier, read from the schema (as the Python
  -- merge does): foreign keys to suppliers.id, plus uuid columns named for a
  -- supplier that carry no foreign key. The activity record is append-only and
  -- keeps the id it was written with; snapshot tables are history.
  select array_agg(array[x.tbl, x.col] order by x.tbl, x.col) into refs
    from (
      select cl.relname::text as tbl, at.attname::text as col
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid
        join pg_attribute at on at.attrelid = c.conrelid and at.attnum = c.conkey[1]
       where c.contype = 'f' and c.confrelid = 'public.suppliers'::regclass
         and c.connamespace = 'public'::regnamespace and cardinality(c.conkey) = 1
      union
      select c.table_name::text, c.column_name::text
        from information_schema.columns c
        join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
                                         and tb.table_type = 'BASE TABLE'
       where c.table_schema = 'public' and c.data_type = 'uuid'
         and (c.column_name = 'supplier_id' or c.column_name like '%\_supplier\_id' escape '\')
    ) x
   where x.tbl not like '\_%' escape '\' and x.tbl <> 'activity_ledger';

  for p in select * from public._snapshot_dup_merge_20261013_pairs order by keep, lose
  loop
    -- ---- 1. one register entry on both rows: the newer scrape stays ----------
    for r in select lr.id as lid, wr.id as wid, lr.fetched_at > wr.fetched_at as loser_newer
               from public.source_records lr
               join public.source_records wr on wr.supplier_id = p.keep
                                            and wr.source_id = lr.source_id and wr.source_ref = lr.source_ref
              where lr.supplier_id = p.lose
    loop
      if r.loser_newer then drop_id := r.wid; keep_id := r.lid; else drop_id := r.lid; keep_id := r.wid; end if;
      update public.certifications      set source_record_id = keep_id where source_record_id = drop_id;
      update public.rsc_remediation     set source_record_id = keep_id where source_record_id = drop_id;
      update public.sanctions_screening set source_record_id = keep_id where source_record_id = drop_id;
      update public.partner_factories   set source_record_id = keep_id where source_record_id = drop_id;
      insert into public._snapshot_dup_merge_20261013_rows
        select 'source_records', 'supplier_id', 'dropped', x.id, p.lose, p.keep, to_jsonb(x)
          from public.source_records x where x.id = drop_id;
      delete from public.source_records where id = drop_id;
      n_dropped := n_dropped + 1;
    end loop;

    -- ---- 2a. the kept row already holds the same thing: drop the losing copy -
    with gone as (
      delete from public.certifications x
       where x.supplier_id = p.lose
         and exists (select 1 from public.certifications y
                      where y.supplier_id = p.keep and y.kind = x.kind
                        and y.certificate_no is not distinct from x.certificate_no)
      returning x.*)
    insert into public._snapshot_dup_merge_20261013_rows
      select 'certifications', 'supplier_id', 'dropped', g.id, p.lose, p.keep, to_jsonb(g) from gone g;
    get diagnostics n = row_count; n_dropped := n_dropped + n;

    with gone as (
      delete from public.sbi_scores x
       where x.supplier_id = p.lose and exists (select 1 from public.sbi_scores y where y.supplier_id = p.keep)
      returning x.*)
    insert into public._snapshot_dup_merge_20261013_rows
      select 'sbi_scores', 'supplier_id', 'dropped', null, p.lose, p.keep, to_jsonb(g) from gone g;
    get diagnostics n = row_count; n_dropped := n_dropped + n;

    -- Customs preview: one per company; the one that found more shipments stays.
    with gone as (
      delete from public.volza_export_checks x
       using public.volza_export_checks y
       where x.supplier_id in (p.lose, p.keep) and y.supplier_id in (p.lose, p.keep) and y.supplier_id <> x.supplier_id
         and (coalesce(x.shipments, 0) < coalesce(y.shipments, 0)
              or (coalesce(x.shipments, 0) = coalesce(y.shipments, 0) and x.supplier_id = p.lose))
      returning x.*)
    insert into public._snapshot_dup_merge_20261013_rows
      select 'volza_export_checks', 'supplier_id', 'dropped', null, p.lose, p.keep, to_jsonb(g) from gone g;
    get diagnostics n = row_count; n_dropped := n_dropped + n;

    -- A claim read from the same document about the same field.
    with gone as (
      delete from public.evidence_claims x
       where x.subject_table = 'suppliers' and x.subject_id = p.lose
         and exists (select 1 from public.evidence_claims y
                      where y.subject_table = 'suppliers' and y.subject_id = p.keep
                        and y.field_key = x.field_key and y.evidence_id = x.evidence_id
                        and y.subject_key is not distinct from x.subject_key)
      returning x.*)
    insert into public._snapshot_dup_merge_20261013_rows
      select 'evidence_claims', 'subject_id', 'dropped', g.id, p.lose, p.keep, to_jsonb(g) from gone g;
    get diagnostics n = row_count; n_dropped := n_dropped + n;

    -- An earlier ruling "these are two companies" about the losing row holds
    -- for the kept row; the pair is stored smaller id first.
    for r in select e.id, case when e.supplier_a = p.lose then e.supplier_b else e.supplier_a end as other
               from public.resolution_edges e where p.lose in (e.supplier_a, e.supplier_b)
    loop
      if r.other = p.keep then
        raise exception 'pair % / %: a person ruled these two companies', p.keep, p.lose;
      end if;
      insert into public._snapshot_dup_merge_20261013_rows
        select 'resolution_edges', 'supplier_a', 'changed', e.id, p.lose, p.keep, to_jsonb(e)
          from public.resolution_edges e where e.id = r.id;
      if exists (select 1 from public.resolution_edges e
                  where e.superseded_at is null and e.id <> r.id
                    and e.supplier_a = least(p.keep, r.other) and e.supplier_b = greatest(p.keep, r.other)) then
        delete from public.resolution_edges where id = r.id;
      else
        update public.resolution_edges
           set supplier_a = least(p.keep, r.other), supplier_b = greatest(p.keep, r.other)
         where id = r.id;
      end if;
    end loop;

    -- ---- 2b. everything else moves ------------------------------------------
    insert into public._snapshot_dup_merge_20261013_rows
      select 'evidence_claims', 'subject_id', 'moved', x.id, p.lose, p.keep, null
        from public.evidence_claims x where x.subject_table = 'suppliers' and x.subject_id = p.lose;
    update public.evidence_claims set subject_id = p.keep where subject_table = 'suppliers' and subject_id = p.lose;
    get diagnostics n = row_count; n_moved := n_moved + n;

    for i in 1 .. array_length(refs, 1)
    loop
      continue when refs[i][1] = 'resolution_edges';
      -- The row's id; for a table keyed by the supplier itself (no id), the whole row.
      execute format('insert into public._snapshot_dup_merge_20261013_rows
                        select %L, %L, ''moved'', nullif(to_jsonb(x) ->> ''id'', '''')::uuid, $1, $2,
                               case when to_jsonb(x) ? ''id'' then null else to_jsonb(x) end
                          from public.%I x where x.%I = $1',
                     refs[i][1], refs[i][2], refs[i][1], refs[i][2]) using p.lose, p.keep;
      execute format('update public.%I set %I = $2 where %I = $1', refs[i][1], refs[i][2], refs[i][2])
        using p.lose, p.keep;
      get diagnostics n = row_count; n_moved := n_moved + n;
      if refs[i][1] = 'suppliers' and refs[i][2] = 'facility_of' then n_buildings := n_buildings + n; end if;
    end loop;

    -- ---- 3. the kept row takes what it lacks --------------------------------
    select * into w from public.suppliers where id = p.keep;
    select * into l from public.suppliers where id = p.lose;
    select sr.fields ->> 'bkmea_reg_number' into reg
      from public.source_records sr
      join public.sources s on s.id = sr.source_id and s.code = 'BKMEA'
     where sr.supplier_id = p.keep and sr.status = 'active' and sr.fields ->> 'bkmea_reg_number' ~ '^\d+\s*-'
     order by (sr.source_ref like '%:detail') desc, sr.fetched_at desc
     limit 1;
    update public.suppliers s set
      bgmea_reg_numbers  = (select coalesce(array_agg(v order by o), '{}') from (select v, min(o) o from unnest(w.bgmea_reg_numbers || l.bgmea_reg_numbers) with ordinality u(v, o) group by v) q),
      phones             = (select coalesce(array_agg(v order by o), '{}') from (select v, min(o) o from unnest(w.phones || l.phones) with ordinality u(v, o) group by v) q),
      source_tags        = (select coalesce(array_agg(v order by o), '{}') from (select v, min(o) o from unnest(w.source_tags || l.source_tags) with ordinality u(v, o) group by v) q),
      principal_products = (select coalesce(array_agg(v order by o), '{}') from (select v, min(o) o from unnest(w.principal_products || l.principal_products) with ordinality u(v, o) group by v) q),
      factory_types      = (select coalesce(array_agg(v order by o), '{}') from (select v, min(o) o from unnest(w.factory_types || l.factory_types) with ordinality u(v, o) group by v) q),
      bgmea_verified   = w.bgmea_verified or l.bgmea_verified,
      bkmea_verified   = w.bkmea_verified or l.bkmea_verified,
      bgapmea_verified = w.bgapmea_verified or l.bgapmea_verified,
      btma_verified    = w.btma_verified or l.btma_verified,
      bkmea_reg_number = coalesce(reg, nullif(w.bkmea_reg_number, ''), l.bkmea_reg_number),
      rjsc_reg_number  = coalesce(nullif(w.rjsc_reg_number, ''), l.rjsc_reg_number),
      epb_erc_number   = coalesce(nullif(w.epb_erc_number, ''), l.epb_erc_number),
      bepza_zone       = coalesce(nullif(w.bepza_zone, ''), l.bepza_zone),
      contact_name     = coalesce(nullif(w.contact_name, ''), l.contact_name),
      contact_role     = coalesce(nullif(w.contact_role, ''), l.contact_role),
      email_primary    = coalesce(w.email_primary, l.email_primary),
      website          = coalesce(nullif(w.website, ''), l.website),
      address_raw      = coalesce(nullif(w.address_raw, ''), l.address_raw),
      city             = coalesce(nullif(nullif(w.city, ''), 'unknown'), l.city),
      district         = coalesce(nullif(nullif(w.district, ''), 'unknown'), l.district),
      lat              = case when w.lat is null or w.lng is null then l.lat else w.lat end,
      lng              = case when w.lat is null or w.lng is null then l.lng else w.lng end,
      established_date = coalesce(nullif(w.established_date, ''), l.established_date),
      parent_group_name = coalesce(nullif(w.parent_group_name, ''), l.parent_group_name),
      -- Workforce: the three figures of whichever row reports the larger total, never a mix.
      employees_total  = case when coalesce(l.employees_total, 0) > coalesce(w.employees_total, 0) then l.employees_total else w.employees_total end,
      employees_male   = case when coalesce(l.employees_total, 0) > coalesce(w.employees_total, 0) then l.employees_male else coalesce(w.employees_male, case when w.employees_total is null then l.employees_male end) end,
      employees_female = case when coalesce(l.employees_total, 0) > coalesce(w.employees_total, 0) then l.employees_female else coalesce(w.employees_female, case when w.employees_total is null then l.employees_female end) end,
      production_capacity_pcs_day      = nullif(greatest(coalesce(w.production_capacity_pcs_day, 0), coalesce(l.production_capacity_pcs_day, 0)), 0),
      production_capacity_dozen_yearly = nullif(greatest(coalesce(w.production_capacity_dozen_yearly, 0), coalesce(l.production_capacity_dozen_yearly, 0)), 0),
      machines_sewing                  = nullif(greatest(coalesce(w.machines_sewing, 0), coalesce(l.machines_sewing, 0)), 0),
      -- "buying_house" is the loader's default for any BGMEA row; the guard in the
      -- report already refused a real buying house beside a factory.
      entity_type = case when w.entity_type::text in ('unknown', 'buying_house') and l.entity_type::text = 'factory'
                         then l.entity_type else w.entity_type end
     where s.id = p.keep;
    update public.suppliers set completeness_pct = public.compute_completeness(p.keep) where id = p.keep;
    perform public.recompute_t13_source_count(p.keep);

    -- ---- 4. nothing may still point at the losing row; then it goes ----------
    for i in 1 .. array_length(refs, 1)
    loop
      execute format('select count(*) from public.%I where %I = $1', refs[i][1], refs[i][2]) into n using p.lose;
      if n > 0 then
        raise exception 'pair % / %: % rows in %.% still point at the losing row', p.keep, p.lose, n, refs[i][1], refs[i][2];
      end if;
    end loop;
    select count(*) into n from public.evidence_claims where subject_table = 'suppliers' and subject_id = p.lose;
    if n > 0 then
      raise exception 'pair % / %: % claims still cite the losing row', p.keep, p.lose, n;
    end if;
    -- The losing row's address keeps working: it redirects to the kept profile.
    insert into public.supplier_slug_redirects (old_slug, supplier_id) values (l.slug, p.keep)
      on conflict (old_slug) do update set supplier_id = excluded.supplier_id;
    delete from public.suppliers where id = p.lose;
    n_deleted := n_deleted + 1;
  end loop;

  -- ---- after: the table must be whole ---------------------------------------
  if exists (select 1 from public.suppliers s join public._snapshot_dup_merge_20261013_pairs a on a.lose = s.id) then
    raise exception 'after: a losing row is still there';
  end if;
  select count(*) into n from public.suppliers s
   where s.id in (select keep from public._snapshot_dup_merge_20261013_pairs) and s.is_published and s.facility_of is null;
  if n <> (select count(distinct keep) from public._snapshot_dup_merge_20261013_pairs) then
    raise exception 'after: only % kept rows are still published', n;
  end if;
  if exists (select 1 from public._snapshot_dup_merge_20261013_suppliers x
              where x.role = 'lose'
                and public.facility_parent_slug(x.slug) is distinct from
                    (select k.slug from public.suppliers k where k.id = x.merged_into)) then
    raise exception 'after: an old address does not redirect to its kept profile';
  end if;

  raise exception 'DRY RUN OK | pairs % | losing rows deleted % | rows moved % | duplicate copies dropped % | buildings re-linked % | kept rows published %',
    (select count(*) from public._snapshot_dup_merge_20261013_pairs), n_deleted, n_moved, n_dropped, n_buildings, n;  -- REHEARSAL
end
$merge$;
