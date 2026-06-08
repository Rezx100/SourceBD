-- 0056 — perf hotfix #2: indexes on rsc_extension_base_name(company_name)
-- so the RSC sibling-inheritance branches in v_supplier_registry_ids (mig 0021)
-- and v_supplier_addresses (mig 0014) stop nested-looping over all ~10k
-- suppliers per consumer query.
--
-- Problem (measured 2026-06-08 on production, web stopped, NANO CPU dedicated):
--   select count(*) from v_supplier_registry_ids p
--     join suppliers s on s.id = p.supplier_id
--    where s.slug = 'interstoff-apparels'
--   --> 69.62s for 7 rows.
--
--   The view's second UNION branch is
--     from suppliers child
--     join lateral (select rsc_extension_base_name(child.company_name) as base) bn
--     join suppliers parent on lower(parent.company_name) = lower(bn.base)
--     join v_supplier_registry_ids_direct parent_pill on parent_pill.supplier_id = parent.id
--    where bn.base is not null
--   The `where supplier_id = ?` predicate from outside the view cannot push
--   into this branch (it filters on the OUTPUT supplier_id, which is
--   `child.id`, after the function call). So Postgres has to materialise the
--   whole branch for every consumer query: scan all 10k child rows, call
--   rsc_extension_base_name() on each, join back to the 10k parent rows,
--   filter the resulting set. On NANO this dominates.
--
-- Fix: a partial expression index on suppliers that pre-computes the base
-- name for the small subset of suppliers whose name actually matches an
-- extension/expansion/unit-N/etc. pattern (rsc_extension_base_name() returns
-- non-null). The outer "child" scan becomes an index range scan on this tiny
-- partial index, and the planner can keep its existing nested loop because
-- the outer side is now ~hundreds of rows, not 10k.
--
-- Two indexes:
--   1. idx_suppliers_ext_base_lower  — used as the OUTER scan to find children
--      with an extension-pattern name, and provides the join key directly.
--   2. idx_suppliers_company_name_lower already exists (mig 0055) — used as
--      the INNER lookup to find the parent by lower(company_name).
--
-- Both indexes use rsc_extension_base_name(), which is declared IMMUTABLE
-- in mig 0014, so they are legal expression indexes.
--
-- View definitions unchanged. Fully reversible by dropping the index.

set local statement_timeout = '0';

create index if not exists idx_suppliers_ext_base_lower
  on public.suppliers (lower(public.rsc_extension_base_name(company_name)))
  where public.rsc_extension_base_name(company_name) is not null;

comment on index public.idx_suppliers_ext_base_lower is
  'Mig 0056 perf hotfix: partial expression index used by v_supplier_registry_ids and v_supplier_addresses inheritance branches. Indexes the small subset of suppliers whose name matches an RSC extension/expansion/unit pattern, so the inheritance lateral join no longer scans all suppliers per query.';
