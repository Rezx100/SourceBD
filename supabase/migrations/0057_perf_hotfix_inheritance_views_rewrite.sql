-- 0057 — perf hotfix #3: rewrite v_supplier_registry_ids and
-- v_supplier_addresses inheritance branches so the planner can use the
-- partial index idx_suppliers_ext_base_lower from mig 0056.
--
-- Problem (measured after mig 0056 applied, web stopped):
--   • v_supplier_registry_ids for interstoff-apparels: 69s → 5s (good)
--   • v_supplier_addresses    for interstoff-apparels: still > 32s
--   • Direct branches alone:   < 0.5s each
--
-- Why the inheritance branch is still slow even with the new index: the
-- current view body uses
--     from public.suppliers child
--     join lateral (select public.rsc_extension_base_name(child.company_name)
--                   as base) bn on true
--     join public.suppliers parent on lower(parent.company_name) = lower(bn.base)
--    where bn.base is not null
-- The `where bn.base is not null` is evaluated AFTER the lateral subquery
-- materialises, which means Postgres first calls rsc_extension_base_name()
-- for every row in `suppliers` (~10k), THEN filters. The planner cannot
-- use the partial index on rsc_extension_base_name() because the predicate
-- is on the lateral output, not on the base table.
--
-- Fix: replace the lateral with a WHERE clause directly on the base table,
--   from public.suppliers child
--    where public.rsc_extension_base_name(child.company_name) is not null
--   join public.suppliers parent ...
-- This makes the WHERE eligible for the partial index
-- idx_suppliers_ext_base_lower (mig 0056) which only contains the few
-- hundred rows whose name matches an extension pattern. Outer-scan size
-- drops from ~10k → ~200, eliminating the lateral CPU cost.
--
-- The "base" expression then appears twice (in the WHERE and in the join
-- condition); both calls hit the SAME entry in the immutable function
-- cache so the cost is unchanged. Net effect: full v_supplier_addresses
-- read for a single supplier should drop from > 30s to < 1s.
--
-- View shape, column list, comments, and downstream consumers
-- (v_supplier_address_summary, buyer_supplier_profile RPC) are
-- byte-identical. Fully reversible by re-running migs 0014 and 0021.

set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- v_supplier_addresses — rewrite the inherited branch
-- ---------------------------------------------------------------------------
drop view if exists public.v_supplier_address_summary;
drop view if exists public.v_supplier_addresses;

create or replace view public.v_supplier_addresses as
select * from public.v_supplier_addresses_direct
union all
select child.id                                    as supplier_id,
       parent_addr.source_code                     as source_code,
       parent_addr.source_tier                     as source_tier,
       (parent_addr.source_ref || '#inherited:' || parent.slug) as source_ref,
       (parent_addr.address_kind || '_inherited')  as address_kind,
       parent_addr.address                         as address,
       parent_addr.phone                           as phone,
       parent_addr.email                           as email,
       parent_addr.fetched_at                      as fetched_at
  from public.suppliers child
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name)
       = lower(public.rsc_extension_base_name(child.company_name))
  join public.v_supplier_addresses_direct parent_addr
    on parent_addr.supplier_id = parent.id
 where public.rsc_extension_base_name(child.company_name) is not null
;

comment on view public.v_supplier_addresses is
  'All verified addresses per supplier (direct source rows + RSC sibling inheritance). Inherited rows have address_kind suffixed with "_inherited" and source_ref suffixed with "#inherited:<parent_slug>"; source_code is the parent record''s original source. UI should label inherited rows as "Address (per parent factory <parent_slug>)".';

create or replace view public.v_supplier_address_summary as
select supplier_id,
       jsonb_agg(
         jsonb_build_object(
           'source',  source_code,
           'tier',    source_tier::text,
           'kind',    address_kind,
           'ref',     source_ref,
           'address', address,
           'phone',   phone,
           'email',   email,
           'fetched_at', fetched_at
         )
         order by source_code, address_kind
       ) as addresses
  from public.v_supplier_addresses
 group by supplier_id;

comment on view public.v_supplier_address_summary is
  'Aggregated per-supplier addresses keyed by id; each element identifies the issuing authority, address kind, and (for inherited rows) the parent factory via the "_inherited" suffix and "#inherited:<parent_slug>" source_ref.';

-- ---------------------------------------------------------------------------
-- v_supplier_registry_ids — same rewrite
-- ---------------------------------------------------------------------------
drop view if exists public.v_supplier_registry_ids;

create or replace view public.v_supplier_registry_ids as
select supplier_id,
       source_code,
       label,
       value,
       verified,
       source_url,
       null::uuid as inherited_from,
       null::text as inherited_from_name
  from public.v_supplier_registry_ids_direct
union all
select child.id                                as supplier_id,
       parent_pill.source_code                 as source_code,
       parent_pill.label || ' (parent factory)' as label,
       parent_pill.value                       as value,
       parent_pill.verified                    as verified,
       parent_pill.source_url                  as source_url,
       parent.id                               as inherited_from,
       parent.company_name                     as inherited_from_name
  from public.suppliers child
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name)
       = lower(public.rsc_extension_base_name(child.company_name))
  join public.v_supplier_registry_ids_direct parent_pill
    on parent_pill.supplier_id = parent.id
 where public.rsc_extension_base_name(child.company_name) is not null
   and parent_pill.source_code <> 'RSC'
   and not exists (
         select 1
           from public.v_supplier_registry_ids_direct d
          where d.supplier_id = child.id
            and d.source_code = parent_pill.source_code
            and d.value       = parent_pill.value
       )
;

comment on view public.v_supplier_registry_ids is
  'Long-form supplier registry/membership/certificate IDs for profile pill row (direct ∪ RSC sibling-factory inheritance). Inherited rows have label suffixed with " (parent factory)" and carry inherited_from / inherited_from_name. One row per (supplier, populated ID); never returns NULL values.';
