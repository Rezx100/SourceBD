-- 0054 — precomputed t13_source_count on public.suppliers (I-029).
--
-- The 0053 discover_suppliers RPC recomputed `count(distinct sr.source_id)` over
-- the whole source_records table on every request via a `WITH t13 AS MATERIALIZED`
-- CTE. That aggregate dominates the RPC cost (~400–800 ms on warm cache, much
-- more cold). Push it to a precomputed `t13_source_count smallint` column on
-- `public.suppliers`, maintained by a trigger on `public.source_records`, and
-- rewrite the RPC to read the column directly.
--
-- Reads (Discover) become a single index/heap scan on suppliers; writes (ETL,
-- admin) pay one trigger fire. ETL writes already run in bulk under the service
-- role so the extra DML cost is amortised.
--
-- Same RPC signature, RETURNS TABLE, security posture, and grants as 0053.

set local statement_timeout = '120s';

-- ------------------------------------------------------------------
-- column + index
-- ------------------------------------------------------------------
alter table public.suppliers
  add column if not exists t13_source_count smallint not null default 0;

create index if not exists idx_suppliers_t13_count_pub
  on public.suppliers (t13_source_count desc)
  where is_published = true;

-- ------------------------------------------------------------------
-- backfill — one-shot, idempotent
-- ------------------------------------------------------------------
with cnt as (
  select sr.supplier_id, count(distinct sr.source_id)::smallint as n
    from public.source_records sr
   where sr.status = 'active'
     and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
   group by sr.supplier_id
)
update public.suppliers s
   set t13_source_count = coalesce(cnt.n, 0)
  from cnt
 where cnt.supplier_id = s.id
   and s.t13_source_count is distinct from coalesce(cnt.n, 0);

update public.suppliers s
   set t13_source_count = 0
 where s.t13_source_count <> 0
   and not exists (
     select 1 from public.source_records sr
      where sr.supplier_id = s.id
        and sr.status = 'active'
        and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
   );

-- ------------------------------------------------------------------
-- trigger function — recompute for one supplier_id
-- ------------------------------------------------------------------
create or replace function public.recompute_t13_source_count(p_supplier_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.suppliers s
     set t13_source_count = coalesce((
       select count(distinct sr.source_id)::smallint
         from public.source_records sr
        where sr.supplier_id = p_supplier_id
          and sr.status = 'active'
          and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
     ), 0)
   where s.id = p_supplier_id;
$$;

revoke all on function public.recompute_t13_source_count(uuid) from public;

create or replace function public.trg_source_records_t13_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_t13_source_count(old.supplier_id);
    return old;
  elsif tg_op = 'INSERT' then
    perform public.recompute_t13_source_count(new.supplier_id);
    return new;
  else
    if (new.supplier_id is distinct from old.supplier_id)
       or (new.source_id   is distinct from old.source_id)
       or (new.status      is distinct from old.status)
       or (new.source_tier is distinct from old.source_tier) then
      perform public.recompute_t13_source_count(new.supplier_id);
      if new.supplier_id is distinct from old.supplier_id then
        perform public.recompute_t13_source_count(old.supplier_id);
      end if;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_source_records_t13_count on public.source_records;
create trigger trg_source_records_t13_count
  after insert or update or delete on public.source_records
  for each row
  execute function public.trg_source_records_t13_count();

-- ------------------------------------------------------------------
-- discover_suppliers — drop t13 CTE, read s.t13_source_count directly
-- Signature, return shape, grants are byte-identical to 0053.
-- ------------------------------------------------------------------
create or replace function public.discover_suppliers(
  p_q                 text    default null,
  p_entity_types      text[]  default null,
  p_min_sources       int     default null,
  p_cert_kinds        text[]  default null,
  p_rsc_min           int     default null,
  p_city              text    default null,
  p_district          text    default null,
  p_category          text    default null,
  p_sort              text    default 'receipts',
  p_limit             int     default 24,
  p_offset            int     default 0,
  p_registries        text[]  default null,
  p_factory_types     text[]  default null,
  p_brand_codes       text[]  default null,
  p_completeness_min  int     default null,
  p_workers_min       int     default null
)
returns table (
  id                  uuid,
  slug                text,
  company_name        text,
  entity_type         text,
  city                text,
  district            text,
  source_tags         text[],
  t13_source_count    int,
  completeness_pct    smallint,
  employees_total     int,
  established_date    text,
  principal_products  text[],
  factory_types       text[],
  rsc_progress_pct    numeric,
  parent_group_name   text,
  total_count         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 24), 100));
  v_off int := greatest(0, coalesce(p_offset, 0));
begin
  return query execute $q$
    with filtered as materialized (
      select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
             s.city, s.district, s.source_tags,
             s.t13_source_count::int as t13_source_count,
             s.completeness_pct, s.employees_total, s.established_date,
             s.principal_products, s.factory_types,
             rr.progress_pct as rsc_progress_pct, s.parent_group_name,
             sb.total as _sbi_total
        from public.suppliers s
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where s.is_published = true
         and s.is_sanctioned = false
         and ($1 is null or $1 = ''
              or s.company_name_norm ilike '%' || lower(trim($1)) || '%')
         and ($2 is null or s.entity_type::text = any($2))
         and ($6 is null or s.city     ilike $6)
         and ($7 is null or s.district ilike $7)
         and ($5 is null or rr.progress_pct >= $5)
         and ($8 is null or $8 = ''
              or exists (
                select 1 from unnest(s.principal_products) pp
                where pp ilike '%' || $8 || '%'))
         and ($4 is null
              or exists (
                select 1 from public.certifications c
                where c.supplier_id = s.id
                  and c.kind::text = any($4)
                  and (c.expires_on is null or c.expires_on >= current_date)
              ))
         and ($12 is null
              or exists (
                select 1
                  from public.source_records sr2
                  join public.sources so2 on so2.id = sr2.source_id
                 where sr2.supplier_id = s.id
                   and sr2.status = 'active'
                   and so2.code = any($12)
              ))
         and ($13 is null or s.factory_types && $13)
         and ($14 is null
              or exists (
                select 1
                  from public.source_records sr3
                  join public.sources so3 on so3.id = sr3.source_id
                 where sr3.supplier_id = s.id
                   and sr3.status = 'active'
                   and so3.code = any($14)
              ))
         and ($15 is null or s.completeness_pct >= $15)
         and ($16 is null or s.employees_total >= $16)
         and ($3  is null or s.t13_source_count >= $3)
    ),
    counted as (select *, count(*) over () as total_count from filtered)
    select id, slug, company_name, entity_type, city, district, source_tags,
           t13_source_count, completeness_pct, employees_total, established_date,
           principal_products, factory_types, rsc_progress_pct, parent_group_name,
           total_count
      from counted
     order by
       case when $9='completeness' then completeness_pct end desc nulls last,
       case when $9='name'         then company_name     end asc,
       case when $9='receipts'     then t13_source_count end desc nulls last,
       _sbi_total desc nulls last,
       t13_source_count desc nulls last,
       company_name asc
     limit $10 offset $11
  $q$
  using p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
        p_city, p_district, p_category, p_sort, v_lim, v_off,
        p_registries, p_factory_types, p_brand_codes,
        p_completeness_min, p_workers_min;
end;
$fn$;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) is
  'Spec B1 Discover RPC, 0054 perf: reads s.t13_source_count column maintained by trg_source_records_t13_count.';

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int
) to anon, authenticated;
