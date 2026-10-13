-- Five pairs of companies held one BKMEA membership entry between them (13 Oct 2026).
-- Checked against the live register (member.bkmea.com list and detail pages) the same day:
--
--   2178 is DAMS KNIT LTD.            a stray copy of its list row sat on AMS KNIT FASHION (member 2480)
--   2129 is EUPHORIA APPARELS LTD.    a stray copy sat on EUPHORIA TEXTILE (member 2133)
--   338  is FATULLAH FASHION LTD.     a stray copy sat on FATULLAH APPARELS LIMITED (member 403)
--   511  is SHATABDI APPARELS LTD (page 2293). The list also has a row "KNIT" with no number, on
--        page 511; the loader keyed that row "511" too, so the two rows wrote over each other, and
--        Shatabdi's page landed on KNIT FASHION (member 675).
--   984  is H.R.S COMPOSITE TEX WEAR LTD. (page 977). Page 984 is an old listing of POLESTAR
--        APPARELS, numbered "402 - /2008"; the loader could not read that number, keyed the row
--        "984", and H.R.S took Polestar's number and page.
--
-- The loader's part is fixed in etl/scrapers/bkmea_web.py (same PR). This block repairs the rows.
-- Every row it changes or deletes is copied first to public._snapshot_bkmea_shared_20261013.
-- AS WRITTEN THIS IS A REHEARSAL: the last statement raises. To apply, delete the line marked REHEARSAL.

do $fix$
declare
  bk uuid := (select id from public.sources where code = 'BKMEA');
  knit uuid := (select id from public.suppliers where slug = 'knit-fashion');
  shat uuid := (select id from public.suppliers where slug = 'shatabdi-apparels');
  hrs  uuid := (select id from public.suppliers where slug = 'hrs-composite-tex-wear');
  n int;
begin
  create table public._snapshot_bkmea_shared_20261013 (tbl text not null, action text not null, row_id uuid not null, old_row jsonb not null);
  alter table public._snapshot_bkmea_shared_20261013 enable row level security;
  revoke all on public._snapshot_bkmea_shared_20261013 from anon, authenticated;

  -- guards: the rows are still what was read
  select count(*) into n from public.source_records r join public.suppliers s on s.id = r.supplier_id
   where r.source_id = bk and (r.id, s.slug, r.source_ref) in (
     ('6bf06279-e685-4615-8983-86d23869e58c', 'ams-knit-fashion', '2178'),
     ('302f81f9-f65b-417a-adc8-fa3eff94001c', 'euphoria-textile', '2129'),
     ('fecef45c-2aea-4a47-9b1e-75ed7e4f96a4', 'fatullah-apparels', '338'),
     ('d9b886bb-e7b1-4e06-a9af-14b5082be096', 'shatabdi-apparels', '511'),
     ('ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3', 'knit-fashion', '511'),
     ('7bafca88-0dc6-4a29-92a0-54784d1fea82', 'knit-fashion', '2293:detail'),
     ('4bac5d53-a362-4b62-8b2c-ea49988ecd4c', 'hrs-composite-tex-wear', '984'),
     ('fe0d1e72-f130-4a33-828a-25f8631adad7', 'hrs-composite-tex-wear', '984:detail'));
  if n <> 8 then raise exception 'guard: % of 8 entries are where they were', n; end if;
  -- the right owner of each stray row holds its own copy
  select count(*) into n from public.source_records r join public.suppliers s on s.id = r.supplier_id
   where r.source_id = bk and (s.slug, r.source_ref) in (('dams-knit', '2178'), ('euphoria-apparels', '2129'), ('fatullah-fashion', '338'));
  if n <> 3 then raise exception 'guard: % of 3 rightful owners hold their entry', n; end if;
  select count(*) into n from public.certifications
   where source_record_id in ('6bf06279-e685-4615-8983-86d23869e58c', '302f81f9-f65b-417a-adc8-fa3eff94001c',
                              'fecef45c-2aea-4a47-9b1e-75ed7e4f96a4', 'fe0d1e72-f130-4a33-828a-25f8631adad7');
  if n > 0 then raise exception 'guard: a certificate cites an entry to be removed'; end if;

  -- snapshot
  insert into public._snapshot_bkmea_shared_20261013
    select 'source_records', 'before', r.id, to_jsonb(r) from public.source_records r
     where r.id in ('6bf06279-e685-4615-8983-86d23869e58c', '302f81f9-f65b-417a-adc8-fa3eff94001c', 'fecef45c-2aea-4a47-9b1e-75ed7e4f96a4',
                    'd9b886bb-e7b1-4e06-a9af-14b5082be096', 'ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3', '7bafca88-0dc6-4a29-92a0-54784d1fea82',
                    '4bac5d53-a362-4b62-8b2c-ea49988ecd4c', 'fe0d1e72-f130-4a33-828a-25f8631adad7');
  insert into public._snapshot_bkmea_shared_20261013
    select 'suppliers', 'before', s.id, to_jsonb(s) - 'discover_search_tsv' from public.suppliers s where s.id in (knit, shat, hrs);
  insert into public._snapshot_bkmea_shared_20261013
    select 'evidence_claims', 'before', c.id, to_jsonb(c) from public.evidence_claims c
     where c.supplier_id in (knit, shat, hrs)
       and (c.field_key like 'bkmea%' or exists (select 1 from public.evidence_documents d where d.id = c.evidence_id and d.url like '%bkmea.com%'));

  -- 1. three stray copies of another member's list row
  delete from public.source_records
   where id in ('6bf06279-e685-4615-8983-86d23869e58c', '302f81f9-f65b-417a-adc8-fa3eff94001c', 'fecef45c-2aea-4a47-9b1e-75ed7e4f96a4');

  -- 2. member 511: Shatabdi's row gets its own number and page back; its page moves to it
  update public.source_records
     set fields = fields || jsonb_build_object('bkmea_membership_no', '511 - B/2000', 'bkmea_reg_number', '511 - B/2000',
                                               'bkmea_detail_id', '2293', 'bkmea_detail_url', 'https://member.bkmea.com/member/details/2293',
                                               'bkmea_membership_year', '2000')
   where id = 'd9b886bb-e7b1-4e06-a9af-14b5082be096';
  update public.source_records set supplier_id = shat where id = '7bafca88-0dc6-4a29-92a0-54784d1fea82';
  update public.evidence_claims c
     set supplier_id = shat, subject_id = case when c.subject_table = 'suppliers' then shat else c.subject_id end
    from public.evidence_documents d
   where d.id = c.evidence_id and d.url like '%/member/details/2293' and c.supplier_id = knit;
  update public.evidence_claims set status = 'superseded'
   where supplier_id = shat and field_key in ('bkmea_membership_no', 'bkmea_reg_number') and field_value <> '511 - B/2000' and status <> 'superseded';
  update public.evidence_claims c set status = 'active'
    from public.evidence_documents d
   where d.id = c.evidence_id and d.url like '%/member/details/2293' and c.supplier_id = shat
     and c.field_key in ('bkmea_membership_no', 'bkmea_reg_number') and c.field_value = '511 - B/2000';
  update public.suppliers set bkmea_reg_number = '511 - B/2000' where id = shat;

  --    the row "KNIT" (no membership number, page 511) is keyed on its page, as the loader now does
  update public.source_records
     set source_ref = 'page-511',
         fields = fields || jsonb_build_object('bkmea_membership_no', '- C/2009', 'bkmea_reg_number', '- C/2009',
                                               'bkmea_detail_id', '511', 'bkmea_detail_url', 'https://member.bkmea.com/member/details/511',
                                               'bkmea_membership_year', null)
   where id = 'ee96d30b-5dd4-4c6a-97bc-1ce7f292a0e3';
  --    KNIT FASHION shows its own membership, 675
  update public.evidence_claims set status = 'superseded'
   where supplier_id = knit and field_key in ('bkmea_membership_no', 'bkmea_reg_number') and field_value <> '675 - B/2009' and status <> 'superseded';
  update public.evidence_claims c set status = 'active'
    from public.evidence_documents d
   where d.id = c.evidence_id and d.url like '%/member/details/669' and c.supplier_id = knit
     and c.field_key in ('bkmea_membership_no', 'bkmea_reg_number') and c.field_value = '675 - B/2009';
  update public.suppliers set bkmea_reg_number = '675 - B/2009' where id = knit;

  -- 3. member 984: H.R.S gets its own number and page back; Polestar's old page leaves it
  update public.source_records
     set fields = fields || jsonb_build_object('bkmea_membership_no', '984 - B/2009', 'bkmea_reg_number', '984 - B/2009',
                                               'bkmea_detail_id', '977', 'bkmea_detail_url', 'https://member.bkmea.com/member/details/977',
                                               'bkmea_membership_year', '2009')
   where id = '4bac5d53-a362-4b62-8b2c-ea49988ecd4c';
  delete from public.source_records where id = 'fe0d1e72-f130-4a33-828a-25f8631adad7';
  update public.evidence_claims c set status = 'superseded'
    from public.evidence_documents d
   where d.id = c.evidence_id and d.url like '%/member/details/984' and c.supplier_id = hrs and c.status = 'active';
  update public.evidence_claims set status = 'superseded'
   where supplier_id = hrs and field_key in ('bkmea_membership_no', 'bkmea_reg_number') and field_value <> '984 - B/2009' and status <> 'superseded';
  update public.evidence_claims set status = 'active'
   where id in (select distinct on (field_key) id from public.evidence_claims
                 where supplier_id = hrs and field_key in ('bkmea_membership_no', 'bkmea_reg_number') and field_value = '984 - B/2009'
                 order by field_key, last_confirmed_at desc nulls last, created_at desc);
  -- 150 machines was Polestar's page; H.R.S's own entry says 110
  update public.suppliers
     set bkmea_reg_number = '984 - B/2009',
         machines_sewing = (select nullif(r.fields ->> 'bkmea_machines_sewing', '')::int from public.source_records r where r.id = '4bac5d53-a362-4b62-8b2c-ea49988ecd4c')
   where id = hrs;

  perform public.recompute_t13_source_count(s.id) from public.suppliers s
   where s.slug in ('ams-knit-fashion', 'euphoria-textile', 'fatullah-apparels', 'knit-fashion', 'shatabdi-apparels', 'hrs-composite-tex-wear');

  -- after: no BKMEA membership number sits on two companies among these, and each shows its own
  select count(*) into n from (
    select substring(r.fields ->> 'bkmea_membership_no' from '^\s*(\d+)') m
      from public.source_records r join public.suppliers s on s.id = r.supplier_id
     where r.source_id = bk and s.slug in ('ams-knit-fashion', 'dams-knit', 'euphoria-textile', 'euphoria-apparels', 'fatullah-apparels',
                                           'fatullah-fashion', 'knit-fashion', 'shatabdi-apparels', 'hrs-composite-tex-wear', 'polestar-apparels')
       and r.fields ->> 'bkmea_membership_no' ~ '^\s*\d+'
     group by 1 having count(distinct r.supplier_id) > 1) q;
  if n <> 0 then raise exception 'after: % membership numbers still sit on two companies', n; end if;
  if exists (select 1 from public.suppliers where slug in ('ams-knit-fashion', 'euphoria-textile', 'fatullah-apparels', 'knit-fashion', 'shatabdi-apparels', 'hrs-composite-tex-wear') and not is_published) then
    raise exception 'after: a company went off the site';
  end if;

  raise exception 'DRY RUN OK | %', (  -- REHEARSAL
    select string_agg(format('%s: shows %s, machines %s, entries [%s], live claim [%s]', s.slug, s.bkmea_reg_number, s.machines_sewing,
             (select string_agg(r.source_ref || '=' || coalesce(r.fields ->> 'bkmea_membership_no', '?'), ', ' order by r.source_ref) from public.source_records r where r.supplier_id = s.id and r.source_id = bk),
             (select string_agg(distinct c.field_value, ', ') from public.evidence_claims c where c.supplier_id = s.id and c.field_key = 'bkmea_membership_no' and c.status = 'active')), ' ;; ' order by s.slug)
      from public.suppliers s
     where s.slug in ('ams-knit-fashion', 'dams-knit', 'euphoria-textile', 'euphoria-apparels', 'fatullah-apparels', 'fatullah-fashion',
                      'knit-fashion', 'shatabdi-apparels', 'hrs-composite-tex-wear', 'polestar-apparels'));
end
$fix$;
