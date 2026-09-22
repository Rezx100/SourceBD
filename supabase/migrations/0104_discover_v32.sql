-- 0104 — Discover v3.2 (REZ-B).
--
-- Extends discover_suppliers (§4.1), adds supplier_epb_hscodes_batch and
-- hs_catalogue (§4.2), and creates saved_searches so /app/searches can persist
-- a named query (§7 REZ-B; §4.4 listed this table under 0106, which ships
-- later). Additive. CREATE OR REPLACE cannot add arguments, so the 0076
-- discover_suppliers signature is dropped and recreated.
--
-- HS codes are not a table: 0103 created supplier_epb_hscodes(p_slug) reading
-- source_records.fields->'epb_hscodes' with the epb_record_is_foreign_to_host
-- denylist. Both new functions reuse that pattern. hs_catalogue is the same
-- aggregate as ops/hs_catalogue_exporter_reconciliation.py (heading4 =
-- left(btrim(code),4), count distinct supplier_id).
--
-- Do not --apply to production from this PR (AGENTS.md rule 15).

set search_path = public;

-- ---------------------------------------------------------------------------
-- saved_searches — owner-scoped named URL state (REZ-B /app/searches)
-- ---------------------------------------------------------------------------

create table if not exists public.saved_searches (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  query_state     jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  last_count      int         null,
  last_counted_at timestamptz null
);

create index if not exists idx_saved_searches_owner_created
  on public.saved_searches (owner_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists pol_saved_searches_select_self on public.saved_searches;
create policy pol_saved_searches_select_self
  on public.saved_searches
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists pol_saved_searches_insert_self on public.saved_searches;
create policy pol_saved_searches_insert_self
  on public.saved_searches
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists pol_saved_searches_update_self on public.saved_searches;
create policy pol_saved_searches_update_self
  on public.saved_searches
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists pol_saved_searches_delete_self on public.saved_searches;
create policy pol_saved_searches_delete_self
  on public.saved_searches
  for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on public.saved_searches to authenticated;

comment on table public.saved_searches is
  'Named Discover URL state per buyer. RLS owner-only. Created in 0104 so REZ-B /app/searches can persist; 0106 must use IF NOT EXISTS.';

-- ---------------------------------------------------------------------------
-- HS helpers — same EPB source_records pattern as 0103 / the reconciliation query
-- ---------------------------------------------------------------------------

create or replace function public.discover_v32_est_year(p_established text)
returns int
language sql
immutable
parallel safe
as $$
  select nullif(substring(btrim(coalesce(p_established, '')), '^[0-9]{4}'), '')::int;
$$;

revoke all on function public.discover_v32_est_year(text) from public;

create or replace function public.discover_v32_top_tier(p_tags text[])
returns smallint
language sql
immutable
parallel safe
as $$
  select coalesce(
    (
      select min(
        case
          when upper(t) in ('EPB', 'RSC', 'DIFE', 'RJSC', 'BEPZA', 'BIN') then 1
          when upper(t) in ('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA') then 2
          when upper(t) in ('GOTS', 'OEKO_TEX', 'OEKO-TEX', 'WRAP', 'SA8000', 'GRS', 'RCS', 'OCS') then 3
          when upper(t) like 'BRAND_%' then 4
          else 5
        end
      )::smallint
        from unnest(coalesce(p_tags, '{}'::text[])) as t
    ),
    5::smallint
  );
$$;

revoke all on function public.discover_v32_top_tier(text[]) from public;

create or replace function public.discover_v32_hs_codes(p_supplier_id uuid)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct heading4 order by heading4), '{}'::text[])
    from (
      select left(btrim(hs.elem->>'code'), 4) as heading4
        from public.suppliers s
        join public.source_records sr
          on sr.supplier_id = s.id
         and sr.status = 'active'
        join public.sources src
          on src.id = sr.source_id
         and src.code = 'EPB'
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
            then sr.fields->'epb_hscodes'
            else '[]'::jsonb
          end
        ) as hs(elem)
       where s.id = p_supplier_id
         and s.is_published = true
         and sr.source_ref ~ '^[0-9]+$'
         and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
         and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
    ) d;
$$;

revoke all on function public.discover_v32_hs_codes(uuid) from public;

create or replace function public.discover_v32_cert_summary(p_supplier_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', c.kind,
        'certificate_no', c.certificate_no,
        'issuer', c.issuer,
        'scope', c.scope,
        'expires_on', c.expires_on,
        'days_left', case
          when c.expires_on is null then null
          else (c.expires_on - current_date)
        end,
        'state', case
          when c.expires_on is null then 'no-expiry'
          when c.expires_on < current_date then 'expired'
          when c.expires_on < current_date + 90 then 'expiring'
          else 'valid'
        end
      )
      order by c.expires_on nulls last, c.kind
    ),
    '[]'::jsonb
  )
    from public.certifications c
   where c.supplier_id = p_supplier_id
     -- 0039 rejects a certificate by soft-deleting it (rejected_at set, with a
     -- reason). A rejected certificate is not evidence of anything, so it must
     -- never reach a buyer as a cert chip, a state, or a count.
     and c.rejected_at is null;
$$;

revoke all on function public.discover_v32_cert_summary(uuid) from public;

create or replace function public.discover_v32_brand_codes(p_supplier_id uuid)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct so.code order by so.code), '{}'::text[])
    from public.source_records sr
    join public.sources so on so.id = sr.source_id
   where sr.supplier_id = p_supplier_id
     and sr.status = 'active'
     and so.code like 'BRAND_%';
$$;

revoke all on function public.discover_v32_brand_codes(uuid) from public;

create or replace function public.discover_v32_registries(p_supplier_id uuid)
returns text[]
language sql
stable
set search_path = public
as $$
  -- `_direct`, not `v_supplier_registry_ids`: the latter unions a PARENT
  -- factory's memberships onto RSC sibling satellites (0021), suffixing the
  -- label " (parent factory)" and setting `inherited_from` precisely so that
  -- consumers do not print them as the record's own. `lib/header-registration.ts`
  -- honours that; a Registers tile reading "BGMEA" for a satellite that holds
  -- no BGMEA membership does not, and `?reg=BGMEA` would return it.
  --
  -- Restricted to the six registry codes as well. That view also unions
  -- `public.certifications` with no `rejected_at` filter, so GOTS/WRAP rows an
  -- admin rejected as forged came back through here as "registers" — re-opening,
  -- on the same card, the hole this migration closes for cert_summary, the cert
  -- filter and the cert-expiry sort.
  select coalesce(array_agg(distinct vp.source_code order by vp.source_code), '{}'::text[])
    from public.v_supplier_registry_ids_direct vp
   where vp.supplier_id = p_supplier_id
     and vp.source_code in ('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA', 'EPB', 'RSC');
$$;

revoke all on function public.discover_v32_registries(uuid) from public;

create or replace function public.discover_v32_next_cert_expiry(p_supplier_id uuid)
returns date
language sql
stable
set search_path = public
as $$
  select min(c.expires_on)
    from public.certifications c
   where c.supplier_id = p_supplier_id
     -- Soft-deleted by an admin rejection (0039): a rejected certificate must
     -- not drive the "certificate expiry soonest" sort either, or a supplier
     -- is ordered by the expiry date of evidence we have thrown out.
     and c.rejected_at is null
     and c.expires_on is not null
     and c.expires_on >= current_date;
$$;

revoke all on function public.discover_v32_next_cert_expiry(uuid) from public;

-- Shared filter predicate. p_skip names the one filter explain() drops.
create or replace function public.discover_v32_passes(
  s public.suppliers,
  p_rsc_pct numeric,
  p_skip text,
  p_entity_types text[],
  p_min_sources int,
  p_cert_kinds text[],
  p_rsc_min int,
  p_city text,
  p_district text,
  p_category text,
  p_registries text[],
  p_factory_types text[],
  p_brand_codes text[],
  p_completeness_min int,
  p_workers_min int,
  p_hs_codes text[],
  p_cert_state text,
  p_rsc_state text,
  p_est_from int,
  p_est_to int,
  p_workers_max int,
  p_districts text[],
  p_cities text[],
  p_exclude_sanctioned boolean
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    s.is_published = true
    and (
      p_skip = 'sanction'
      or coalesce(p_exclude_sanctioned, true) = false
      or s.is_sanctioned = false
    )
    and (
      p_skip = 'type'
      or p_entity_types is null
      or s.entity_type::text = any (p_entity_types)
    )
    and (
      p_skip = 'city'
      or (
        (p_city is null or s.city ilike '%' || p_city || '%')
        and (
          p_cities is null
          or exists (
            select 1 from unnest(p_cities) c
             where s.city ilike '%' || c || '%'
          )
        )
      )
    )
    and (
      p_skip = 'district'
      or (
        (p_district is null or s.district ilike '%' || p_district || '%')
        and (
          p_districts is null
          or exists (
            select 1 from unnest(p_districts) d
             where s.district ilike '%' || d || '%'
          )
        )
      )
    )
    and (
      p_skip = 'rsc'
      or (
        (p_rsc_min is null or p_rsc_pct >= p_rsc_min)
        and (
          p_rsc_state is null
          or (
            p_rsc_state = 'active'
            and exists (
              select 1
                from public.rsc_remediation r
               where r.supplier_id = s.id
                 and r.active = true
            )
          )
          or (
            p_rsc_state = 'lapsed'
            and exists (
              select 1
                from public.rsc_remediation r
               where r.supplier_id = s.id
            )
            and not exists (
              select 1
                from public.rsc_remediation r
               where r.supplier_id = s.id
                 and r.active = true
            )
          )
        )
      )
    )
    and (
      p_skip = 'category'
      or p_category is null
      or p_category = ''
      or exists (
        select 1 from unnest(s.principal_products) pp
         where pp ilike '%' || p_category || '%'
      )
    )
    and (
      p_skip = 'cert'
      or (
        p_cert_kinds is null
        and (p_cert_state is null or p_cert_state = 'any')
      )
      or exists (
        select 1
          from public.certifications c
         where c.supplier_id = s.id
           -- Soft-deleted by an admin rejection (0039): must not satisfy a
           -- certificate filter either, or `?cert=gots:valid` returns
           -- suppliers whose only GOTS certificate was rejected as forged.
           and c.rejected_at is null
           and (p_cert_kinds is null or c.kind::text = any (p_cert_kinds))
           and case
             coalesce(
               p_cert_state,
               case when p_cert_kinds is not null then 'unexpired' else 'any' end
             )
             when 'any' then true
             when 'unexpired' then (c.expires_on is null or c.expires_on >= current_date)
             when 'expired' then (c.expires_on is not null and c.expires_on < current_date)
             when 'expiring' then (
               c.expires_on is not null
               and c.expires_on >= current_date
               and c.expires_on < current_date + 90
             )
             when 'valid' then (c.expires_on is null or c.expires_on >= current_date + 90)
             else true
           end
      )
    )
    and (
      p_skip = 'registry'
      or p_registries is null
      or exists (
        -- Same basis as `discover_v32_registries`: the supplier's own
        -- registrations only, and only real registers. Filtering on the
        -- inherited view returned satellites that hold no such membership,
        -- and on cert rows that an admin had rejected.
        select 1
          from public.v_supplier_registry_ids_direct vp
         where vp.supplier_id = s.id
           and vp.source_code in ('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA', 'EPB', 'RSC')
           and vp.source_code = any (p_registries)
      )
    )
    and (
      p_skip = 'factory'
      or p_factory_types is null
      or s.factory_types && p_factory_types
    )
    and (
      p_skip = 'brand'
      or p_brand_codes is null
      or exists (
        select 1
          from public.source_records sr3
          join public.sources so3 on so3.id = sr3.source_id
         where sr3.supplier_id = s.id
           and sr3.status = 'active'
           and so3.code = any (p_brand_codes)
      )
    )
    and (
      p_skip = 'completeness'
      or p_completeness_min is null
      or s.completeness_pct >= p_completeness_min
    )
    and (
      p_skip = 'workers'
      or (
        -- The REGISTER's figure for this record, which is what the chip and
        -- the sort are named for. Calling the group roll-up
        -- (production_workers_display_batch) per row was tried and reverted:
        -- discover_suppliers is granted to `anon` and PostgREST serves it
        -- outside Next's middleware and rate limiter, so an unauthenticated
        -- caller could force one 5-CTE roll-up per published supplier per
        -- request. The display/filter mismatch it was meant to fix is closed by
        -- naming both figures honestly instead — see build-discover-row.ts.
        (p_workers_min is null or s.employees_total >= p_workers_min)
        and (p_workers_max is null or s.employees_total <= p_workers_max)
      )
    )
    and (
      p_skip = 'min_sources'
      or p_min_sources is null
      or s.t13_source_count >= p_min_sources
    )
    and (
      p_skip = 'est'
      or (
        (
          p_est_from is null
          or public.discover_v32_est_year(s.established_date) >= p_est_from
        )
        and (
          p_est_to is null
          or public.discover_v32_est_year(s.established_date) <= p_est_to
        )
      )
    )
    and (
      p_skip = 'hs'
      or p_hs_codes is null
      or exists (
        select 1
          from public.source_records sr_hs
          join public.sources src_hs
            on src_hs.id = sr_hs.source_id
           and src_hs.code = 'EPB'
          cross join lateral jsonb_array_elements(
            case
              when jsonb_typeof(sr_hs.fields->'epb_hscodes') = 'array'
              then sr_hs.fields->'epb_hscodes'
              else '[]'::jsonb
            end
          ) as hs(elem)
         where sr_hs.supplier_id = s.id
           and sr_hs.status = 'active'
           and sr_hs.source_ref ~ '^[0-9]+$'
           and not public.epb_record_is_foreign_to_host(s.slug, sr_hs.source_ref)
           and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
           and left(btrim(hs.elem->>'code'), 4) = any (p_hs_codes)
      )
    );
$$;

revoke all on function public.discover_v32_passes(
  public.suppliers, numeric, text, text[], int, text[], int, text, text, text,
  text[], text[], text[], int, int, text[], text, text, int, int, int,
  text[], text[], boolean
) from public;

-- ---------------------------------------------------------------------------
-- discover_suppliers — drop 0076 signature, recreate with §4.1 extras
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.proname = 'discover_suppliers'
       and p.pronamespace = 'public'::regnamespace
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end
$$;

create or replace function public.discover_suppliers(
  p_q                    text    default null,
  p_entity_types         text[]  default null,
  p_min_sources          int     default null,
  p_cert_kinds           text[]  default null,
  p_rsc_min              int     default null,
  p_city                 text    default null,
  p_district             text    default null,
  p_category             text    default null,
  p_sort                 text    default 'receipts',
  p_limit                int     default 24,
  p_offset               int     default 0,
  p_registries           text[]  default null,
  p_factory_types        text[]  default null,
  p_brand_codes          text[]  default null,
  p_completeness_min     int     default null,
  p_workers_min          int     default null,
  p_hs_codes             text[]  default null,
  p_cert_state           text    default null,
  p_rsc_state            text    default null,
  p_est_from             int     default null,
  p_est_to               int     default null,
  p_workers_max          int     default null,
  p_districts            text[]  default null,
  p_cities               text[]  default null,
  p_exclude_sanctioned   boolean default true
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
  primary_address     text,
  total_count         bigint,
  is_sanctioned       boolean,
  cert_summary        jsonb,
  hs_codes            text[],
  brand_codes         text[],
  registries          text[],
  top_tier            smallint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_lim int := greatest(1, least(coalesce(p_limit, 24), 100));
  v_off int := greatest(0, coalesce(p_offset, 0));
  v_q   text := nullif(btrim(coalesce(p_q, '')), '');
  -- 'cert_expiry' and 'hs_lines' order on a per-row subquery — a join across
  -- suppliers x source_records x sources with a jsonb lateral, or a scan of
  -- certifications — and the ORDER BY sits above `filtered`, so it is
  -- evaluated for EVERY row that passed the filter before LIMIT applies.
  -- p_limit does not bound it: one unfiltered call with p_limit = 1 costs a
  -- full-corpus pass.
  --
  -- This function is granted to `anon` and PostgREST serves it directly, so
  -- those calls never meet the app's middleware or its rate limiter. That is
  -- the same reasoning the workers roll-up was reverted for (see the comment
  -- on p_min_sources above); it applies here and was not carried across.
  -- An anonymous caller gets the default ordering instead. Nothing a signed-
  -- out visitor can do today is lost — these two sorts are new in 0104.
  -- `coalesce(auth.role(), 'anon')`, and an allowlist rather than a denylist.
  --
  -- `auth.role() = 'anon'` was wrong twice over. Supabase's auth.role() reads
  -- a request GUC and returns NULL when the request carries no JWT claims —
  -- and `NULL = 'anon'` is NULL, not true, so the CASE fell through to
  -- `else p_sort` and the expensive sort ran for exactly the caller the
  -- downgrade exists to stop. Naming the two sorts to downgrade was the
  -- second mistake: it is a denylist, so it says nothing about a sort added
  -- later, and inverting it leaves both expensive sorts reachable while
  -- quietly downgrading the cheap ones.
  --
  -- Stated the safe way round: honour these two only for a caller we can see
  -- is signed in. Anonymous, or no JWT at all, gets the default ordering.
  -- 'cert_expiry' and 'hs_lines' order on a per-row subquery — a join across
  -- suppliers x source_records x sources with a jsonb lateral, or a scan of
  -- certifications — and the ORDER BY sits above `filtered`, so it runs for
  -- EVERY row that passed the filter before LIMIT applies. p_limit does not
  -- bound it: one unfiltered call with p_limit = 1 costs a full-corpus pass,
  -- and PostgREST serves this function outside the app's rate limiter.
  v_caller_role text := coalesce(auth.role(), 'anon');
  v_sort text := case
    when coalesce(p_sort, '') in ('cert_expiry', 'hs_lines')
     and v_caller_role not in ('authenticated', 'service_role')
      then 'receipts'
    else p_sort
  end;
begin
  if v_q is null then
    return query
      with filtered as materialized (
        select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
               s.city, s.district, s.source_tags,
               s.t13_source_count::int as t13_source_count,
               s.completeness_pct, s.employees_total, s.established_date,
               s.principal_products, s.factory_types,
               rr.progress_pct as rsc_progress_pct, s.parent_group_name,
               s.address_raw as primary_address,
               sb.total as sbi_total,
               s.is_sanctioned
          from public.suppliers s
          left join public.rsc_remediation rr
            on rr.supplier_id = s.id and rr.active = true
          left join public.sbi_scores sb on sb.supplier_id = s.id
         where public.discover_v32_passes(
           s, rr.progress_pct, null,
           p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
           p_city, p_district, p_category, p_registries, p_factory_types,
           p_brand_codes, p_completeness_min, p_workers_min, p_hs_codes,
           p_cert_state, p_rsc_state, p_est_from, p_est_to, p_workers_max,
           p_districts, p_cities, p_exclude_sanctioned
         )
      ),
      counted as (
        select f.*, count(*) over () as total_count
          from filtered f
      ),
      page as (
        select c.*
          from counted c
         order by
           case when v_sort = 'completeness' then c.completeness_pct end desc nulls last,
           case when v_sort = 'name' then c.company_name end asc,
           case when v_sort = 'receipts' then c.t13_source_count end desc nulls last,
           case when v_sort = 'workers' then c.employees_total end desc nulls last,
           case when v_sort = 'established' then public.discover_v32_est_year(c.established_date) end asc nulls last,
           case when v_sort = 'cert_expiry' then public.discover_v32_next_cert_expiry(c.id) end asc nulls last,
           case when v_sort = 'hs_lines' then cardinality(public.discover_v32_hs_codes(c.id)) end desc nulls last,
           c.sbi_total desc nulls last,
           c.t13_source_count desc nulls last,
           c.company_name asc,
           -- A unique final key. Without one Postgres may return tied rows in a
           -- different order per call, and the CSV export issues ten separate
           -- calls at increasing offsets — so a supplier can appear twice in a
           -- sourcing file while another silently vanishes.
           c.id asc
         limit v_lim offset v_off
      )
      select p.id, p.slug, p.company_name, p.entity_type, p.city, p.district,
             p.source_tags, p.t13_source_count, p.completeness_pct,
             p.employees_total, p.established_date, p.principal_products,
             p.factory_types, p.rsc_progress_pct, p.parent_group_name,
             p.primary_address,
             p.total_count,
             p.is_sanctioned,
             public.discover_v32_cert_summary(p.id),
             public.discover_v32_hs_codes(p.id),
             public.discover_v32_brand_codes(p.id),
             public.discover_v32_registries(p.id),
             public.discover_v32_top_tier(p.source_tags)
        from page p;
    return;
  end if;

  return query
    with query_flags as materialized (
      select v_q as q,
             '%' || v_q || '%' as q_like,
             websearch_to_tsquery('simple', v_q) as tsq
    ),
    filtered as materialized (
      select s.id, s.slug, s.company_name, s.entity_type::text as entity_type,
             s.city, s.district, s.source_tags,
             s.t13_source_count::int as t13_source_count,
             s.completeness_pct, s.employees_total, s.established_date,
             s.principal_products, s.factory_types,
             rr.progress_pct as rsc_progress_pct, s.parent_group_name,
             s.address_raw as primary_address,
             sb.total as sbi_total,
             s.is_sanctioned,
             (
               (coalesce(ts_rank_cd(s.discover_search_tsv, qf.tsq), 0) * 1000)::int +
               case when s.company_name_norm ilike qf.q_like then 240 else 0 end
             ) as search_rank
        from public.suppliers s
        cross join query_flags qf
        left join public.rsc_remediation rr
          on rr.supplier_id = s.id and rr.active = true
        left join public.sbi_scores sb on sb.supplier_id = s.id
       where public.discover_v32_passes(
           s, rr.progress_pct, null,
           p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
           p_city, p_district, p_category, p_registries, p_factory_types,
           p_brand_codes, p_completeness_min, p_workers_min, p_hs_codes,
           p_cert_state, p_rsc_state, p_est_from, p_est_to, p_workers_max,
           p_districts, p_cities, p_exclude_sanctioned
         )
         and (
           (qf.tsq is not null and s.discover_search_tsv @@ qf.tsq)
           or s.company_name_norm ilike qf.q_like
           or coalesce(s.parent_group_name, '') ilike qf.q_like
           or coalesce(s.city, '') ilike qf.q_like
           or coalesce(s.district, '') ilike qf.q_like
         )
    ),
    stats as materialized (
      select count(*)::bigint as total_count
        from filtered
       where search_rank > 0
    ),
    page as (
      select f.*
        from filtered f
       where f.search_rank > 0
       order by
         case when v_sort = 'completeness' then f.completeness_pct end desc nulls last,
         case when v_sort = 'name' then f.company_name end asc,
         case when v_sort = 'receipts' then f.t13_source_count end desc nulls last,
         case when v_sort = 'workers' then f.employees_total end desc nulls last,
         case when v_sort = 'established' then public.discover_v32_est_year(f.established_date) end asc nulls last,
         case when v_sort = 'cert_expiry' then public.discover_v32_next_cert_expiry(f.id) end asc nulls last,
         case when v_sort = 'hs_lines' then cardinality(public.discover_v32_hs_codes(f.id)) end desc nulls last,
         case when coalesce(v_sort, 'default') = 'default' then f.search_rank end desc nulls last,
         f.sbi_total desc nulls last,
         f.t13_source_count desc nulls last,
         f.company_name asc,
         -- A unique final key. Without one Postgres may return tied rows in a
         -- different order per call, and the CSV export issues ten separate
         -- calls at increasing offsets — so a supplier can appear twice in a
         -- sourcing file while another silently vanishes.
         f.id asc
       limit v_lim offset v_off
    )
    select p.id, p.slug, p.company_name, p.entity_type, p.city, p.district,
           p.source_tags, p.t13_source_count, p.completeness_pct,
           p.employees_total, p.established_date, p.principal_products,
           p.factory_types, p.rsc_progress_pct, p.parent_group_name,
           p.primary_address,
           s.total_count,
           p.is_sanctioned,
           public.discover_v32_cert_summary(p.id),
           public.discover_v32_hs_codes(p.id),
           public.discover_v32_brand_codes(p.id),
           public.discover_v32_registries(p.id),
           public.discover_v32_top_tier(p.source_tags)
      from page p
      cross join stats s;
end;
$fn$;

revoke all on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) from public;

grant execute on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) to anon, authenticated;

comment on function public.discover_suppliers(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) is
  'Published-supplier search. Contact PII is not in the return type. Browse fast path when p_q is null (0071/0076).';

-- ---------------------------------------------------------------------------
-- discover_suppliers_explain — count with each active filter dropped
-- ---------------------------------------------------------------------------

create or replace function public.discover_suppliers_explain(
  p_q                    text    default null,
  p_entity_types         text[]  default null,
  p_min_sources          int     default null,
  p_cert_kinds           text[]  default null,
  p_rsc_min              int     default null,
  p_city                 text    default null,
  p_district             text    default null,
  p_category             text    default null,
  p_sort                 text    default 'receipts',
  p_limit                int     default 1,
  p_offset               int     default 0,
  p_registries           text[]  default null,
  p_factory_types        text[]  default null,
  p_brand_codes          text[]  default null,
  p_completeness_min     int     default null,
  p_workers_min          int     default null,
  p_hs_codes             text[]  default null,
  p_cert_state           text    default null,
  p_rsc_state            text    default null,
  p_est_from             int     default null,
  p_est_to               int     default null,
  p_workers_max          int     default null,
  p_districts            text[]  default null,
  p_cities               text[]  default null,
  p_exclude_sanctioned   boolean default true
)
returns table (
  dropped   text,
  remaining bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if v_q is not null then
    return query
      select 'q'::text, x.total_count
        from public.discover_suppliers(
          null, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_hs_codes is not null then
    return query
      select 'hs'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, null, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_cert_kinds is not null or (p_cert_state is not null and p_cert_state <> 'any') then
    return query
      select 'cert'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, null, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, null, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_rsc_min is not null or p_rsc_state is not null then
    return query
      select 'rsc'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, null,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, null, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_est_from is not null or p_est_to is not null then
    return query
      select 'est'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, null,
          null, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_workers_min is not null or p_workers_max is not null then
    return query
      select 'workers'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          null, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, null, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_district is not null or p_districts is not null then
    return query
      select 'district'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, null, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, null, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_city is not null or p_cities is not null then
    return query
      select 'city'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          null, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, null, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_entity_types is not null then
    return query
      select 'type'::text, x.total_count
        from public.discover_suppliers(
          p_q, null, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_min_sources is not null then
    return query
      select 'min_sources'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, null, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_brand_codes is not null then
    return query
      select 'brand'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          p_registries, p_factory_types, null, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
  if p_registries is not null then
    return query
      select 'registry'::text, x.total_count
        from public.discover_suppliers(
          p_q, p_entity_types, p_min_sources, p_cert_kinds, p_rsc_min,
          p_city, p_district, p_category, p_sort, 1, 0,
          null, p_factory_types, p_brand_codes, p_completeness_min,
          p_workers_min, p_hs_codes, p_cert_state, p_rsc_state, p_est_from,
          p_est_to, p_workers_max, p_districts, p_cities, p_exclude_sanctioned
        ) x
       limit 1;
  end if;
end;
$fn$;

revoke all on function public.discover_suppliers_explain(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) from public;

grant execute on function public.discover_suppliers_explain(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) to authenticated;

comment on function public.discover_suppliers_explain(
  text, text[], int, text[], int, text, text, text, text, int, int,
  text[], text[], text[], int, int,
  text[], text, text, int, int, int, text[], text[], boolean
) is
  'Zero-result helper: count remaining after dropping each active filter in turn. Call only when discover_suppliers total_count is 0.';

-- ---------------------------------------------------------------------------
-- supplier_epb_hscodes_batch — 0103 query, many slugs, cap 100
-- ---------------------------------------------------------------------------

create or replace function public.supplier_epb_hscodes_batch(p_slugs text[])
returns table (
  slug    text,
  hs      text,
  heading text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (s.slug, btrim(hs.elem->>'code'))
         s.slug,
         btrim(hs.elem->>'code') as hs,
         nullif(btrim(hs.elem->>'description'), '') as heading
    from public.suppliers s
    join public.source_records sr
      on sr.supplier_id = s.id
     and sr.status = 'active'
    join public.sources src
      on src.id = sr.source_id
     and src.code = 'EPB'
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
        then sr.fields->'epb_hscodes'
        else '[]'::jsonb
      end
    ) with ordinality as hs(elem, ord)
   where s.slug = any (p_slugs[1:100])
     and s.is_published = true
     and sr.source_ref ~ '^[0-9]+$'
     and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
     and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
   order by s.slug, btrim(hs.elem->>'code'), sr.fetched_at desc nulls last, sr.id, hs.ord;
$$;

revoke all on function public.supplier_epb_hscodes_batch(text[]) from public;
grant execute on function public.supplier_epb_hscodes_batch(text[]) to authenticated;

comment on function public.supplier_epb_hscodes_batch(text[]) is
  'Batch form of supplier_epb_hscodes. At most 100 slugs. Same EPB source_records + denylist as 0103. No PII.';

-- ---------------------------------------------------------------------------
-- hs_catalogue — reconciliation QUERY without the heading allow-list
-- ---------------------------------------------------------------------------

create or replace function public.hs_catalogue()
returns table (
  hs              text,
  heading         text,
  exporter_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  with epb_lines as (
    select s.id as supplier_id,
           left(btrim(hs.elem->>'code'), 4) as heading4,
           nullif(btrim(hs.elem->>'description'), '') as description
      from public.suppliers s
      join public.source_records sr
        on sr.supplier_id = s.id
       and sr.status = 'active'
      join public.sources src
        on src.id = sr.source_id
       and src.code = 'EPB'
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
          then sr.fields->'epb_hscodes'
          else '[]'::jsonb
        end
      ) as hs(elem)
     where s.is_published = true
       and sr.source_ref ~ '^[0-9]+$'
       and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
       and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
  )
  select heading4 as hs,
         min(description) as heading,
         count(distinct supplier_id)::int as exporter_count
    from epb_lines
   where heading4 ~ '^[0-9]{4}$'
   group by heading4
   order by heading4;
$$;

revoke all on function public.hs_catalogue() from public;
grant execute on function public.hs_catalogue() to authenticated;

comment on function public.hs_catalogue() is
  '4-digit EPB headings with distinct published exporter counts. Same aggregate as ops/hs_catalogue_exporter_reconciliation.py.';

notify pgrst, 'reload schema';
