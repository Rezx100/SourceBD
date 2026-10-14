-- ABM Spinning Mills is a BTMA general member, not a suspended one (14 Oct 2026).
--
-- BTMA's list of 7 Oct 2026 ("A Yarn Manufacturing (General Spinning Mill List) 2025-26.pdf",
-- btmadhaka.com/wp-content/uploads/2026/10/, page 3) files it as general member no. 10, with the same
-- address, telephone, mailbox and capacity as our entry. The copy we read on 21 May 2026 had it alone
-- under "Mills Under Implementation" (a mill still being built), inside the heading "Mills Under
-- Suspension / Mills Under Implementation", and the importer read both words as suspended.
-- (etl/scrapers/btma_spinning.py now reads implementation alone as no status, but that does not reach
-- ABM: the May extract files it under the combined heading.)
--
-- DO NOT re-run btma_spinning on the May 2026 extract in etl/raw/btma_spinning/pages: the entry is
-- latest-wins on the same source_ref and would come back suspended. The next BTMA load is a new
-- extract of the 7 Oct 2026 list, which has no implementation heading.
--
-- The other 91 suspended entries are filed under "Mills Under Suspension" on the new list too; the
-- new list adds one mill we do not hold (Humaira & Mahiya Rotor Spinning Mills). Comparison in
-- ops/plans/data-integrity-audit.md, S1-3.
--
-- One entry changes: no status, section "General Member", list number 10, read 14 Oct 2026, and a
-- note naming the list. Its old fields are kept in _snapshot_btma_abm_20261014.
--
-- Undo: update source_records sr set fields = b.fields, fetched_at = b.fetched_at
--       from _snapshot_btma_abm_20261014 b where b.id = sr.id;

do $$
declare n int;
begin
  create table public._snapshot_btma_abm_20261014 as
  select sr.id, sr.supplier_id, sr.fields, sr.fetched_at, now() as taken_at
    from public.source_records sr
    join public.sources so on so.id = sr.source_id and so.code = 'BTMA'
    join public.suppliers s on s.id = sr.supplier_id and s.slug = 'abm-spinning-mills'
   where sr.status = 'active'
     and sr.fields ->> 'btma_status' = 'suspended'
     and sr.fields ->> 'btma_sl_no' = '1';
  alter table public._snapshot_btma_abm_20261014 enable row level security;
  revoke all on public._snapshot_btma_abm_20261014 from anon, authenticated;
  select count(*) into n from public._snapshot_btma_abm_20261014;
  if n <> 1 then raise exception 'count guard: expected 1 entry, found %', n; end if;

  update public.source_records sr
     set fields = (sr.fields - 'btma_status')
                  || jsonb_build_object(
                       'btma_section', 'General Member',
                       'btma_sl_no',   '10',
                       'btma_notes',   'BTMA list of 7 Oct 2026 (A Yarn Manufacturing, General Spinning Mill List 2025-26, page 3): general member no. 10. Read 14 Oct 2026. Was alone under Mills Under Implementation on the list read 21 May 2026.'),
         fetched_at = now()
    from public._snapshot_btma_abm_20261014 b
   where b.id = sr.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'count guard: touched %', n; end if;
end $$;

-- Applied on production 14 Oct 2026 on the founder's "apply 0155, the ABM fix and the score run".
--
-- Scores, the same day. The 75 companies whose only BTMA entries are suspended (ABM no longer among them)
-- were scored with etl.scoring.sbi.compute_sbi over a read of production through the database API, with
-- the inputs etl/scoring/runner.py now builds (no BTMA tag, no BTMA verified). The same read with the old
-- inputs reproduced all 75 stored totals first. Written in one block with count guards (the database port
-- is unreachable from the founder's machine, so the runner cannot run there): 70 down 3 points to 0, 3 down
-- 8, one down 4, one down 2. Old rows in _snapshot_sbi_btma_20261014.
--
-- Undo: update sbi_scores e set pillar1_legal = b.pillar1_legal, pillar2_safety = b.pillar2_safety,
--       pillar3_certs = b.pillar3_certs, pillar4_market = b.pillar4_market, total = b.total,
--       inputs_hash = b.inputs_hash, computed_at = b.computed_at
--       from _snapshot_sbi_btma_20261014 b where b.supplier_id = e.supplier_id;
