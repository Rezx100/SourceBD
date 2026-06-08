-- 0058 — revert mig 0057 (the inheritance-view rewrite regressed perf on
-- the partial-index path). Restore the original lateral-based view bodies
-- from migs 0014 and 0021. Mig 0055 and 0056 indexes are unchanged.
--
-- Measured: after applying 0057 the registry view for ananta-apparels went
-- from 2.84s → > 30s (timed out). The lateral version lets the planner use
-- the new partial index from 0056 better than the WHERE-then-join form.

set local statement_timeout = '60s';

drop view if exists public.v_supplier_address_summary;
drop view if exists public.v_supplier_addresses;

-- restore v_supplier_addresses from 0014 (unchanged body, just lateral)
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
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
  join public.v_supplier_addresses_direct parent_addr
    on parent_addr.supplier_id = parent.id
 where bn.base is not null
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

-- restore v_supplier_registry_ids from 0021 (unchanged body)
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
  join lateral (
        select public.rsc_extension_base_name(child.company_name) as base
       ) bn on true
  join public.suppliers parent
    on parent.id <> child.id
   and lower(parent.company_name) = lower(bn.base)
  join public.v_supplier_registry_ids_direct parent_pill
    on parent_pill.supplier_id = parent.id
 where bn.base is not null
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
