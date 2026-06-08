-- 0055 — perf hotfix: expression index on lower(suppliers.company_name) +
-- statistics refresh, so the RSC sibling-inheritance join in
-- public.v_supplier_registry_ids (mig 0021) and the four address inheritance
-- views (migs 0014–0018) can index-scan the parent lookup instead of nested-
-- looping function-call results against every suppliers row.
--
-- Problem observed 2026-06-08 on production (Supabase NANO, us-west-1):
--   • public.buyer_supplier_profile('<any-slug>') times out at 20s+ with
--     `canceling statement due to statement timeout` from
--     `PL/pgSQL function rsc_extension_base_name(text) line 11 at assignment`.
--   • Root cause is the join inside v_supplier_registry_ids:
--         join public.suppliers parent
--           on lower(parent.company_name) = lower(bn.base)
--     where `bn.base = public.rsc_extension_base_name(child.company_name)`.
--     With no expression index on `lower(parent.company_name)`, the planner
--     picks a nested loop, calling rsc_extension_base_name() and recomparing
--     against 10k+ rows per child — explosively slow on NANO CPU.
--   • The same `lower(parent.company_name) = lower(bn.base)` pattern is used
--     in v_supplier_addresses (mig 0014) and the per-source address branches
--     views (migs 0015–0018), all of which feed buyer_supplier_profile.
--
-- Fix is one btree expression index. The five views recreate-on-demand pick
-- it up via the planner without any view or function definition changes.
-- No data migration. Fully reversible by dropping the index.
--
-- Also runs ANALYZE on suppliers + source_records so the planner has fresh
-- row estimates after mig 0054's backfill + 2 days of ETL writes (last
-- autoanalyze on source_records was 2026-05-21, stale).

set local statement_timeout = '300s';

create index if not exists idx_suppliers_company_name_lower
  on public.suppliers (lower(company_name));

analyze public.suppliers;
analyze public.source_records;

comment on index public.idx_suppliers_company_name_lower is
  'Mig 0055 perf hotfix: enables index lookup for the RSC sibling-inheritance join in v_supplier_registry_ids and v_supplier_addresses (lower(parent.company_name) = lower(rsc_extension_base_name(child.company_name))). Without this, buyer_supplier_profile times out on Supabase NANO.';
