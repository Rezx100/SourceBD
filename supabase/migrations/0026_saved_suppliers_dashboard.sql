-- 0026 — Saved suppliers + buyer dashboard (Spec B5, Phase 2).
--
-- Adds the first per-user mutable surface in Phase 2: every buyer can save
-- supplier rows to their personal list. The list page and the buyer
-- dashboard at `/app` both read from this table.
--
-- Scope per `context/frontend-design-spec.md` §7 and `context/phases.md`
-- line 63 ("Saved suppliers + dashboard (recent activity, alerts, saved
-- list)"):
--
--   * `public.saved_suppliers` — RLS-keyed by `auth.uid()`, one row per
--     (owner_id, supplier_id) pair.
--   * `public.buyer_saved_list(p_sort, p_limit, p_offset)` — buyer-safe
--     projection of the caller's saved set, same column shape as
--     `discover_suppliers` plus `saved_at`. SBI total drives the default
--     tiebreaker server-side and is NEVER returned.
--   * `public.buyer_dashboard()` — single jsonb document for `/app`:
--     `saved_count`, `recent_saved` (top 6), `alerts` (certs expiring in
--     the next 30 days on the caller's saved set) and `recent_activity`
--     (last 20 events composed from existing tables only: `saved_suppliers`
--     create events, `certifications` create + expiry events for saved
--     suppliers, and `rsc_remediation.fetched_at` jumps for saved
--     suppliers). No new ingestion. No history table.
--
-- Hard invariants (ai-workflow-rules.md, frontend-design-spec.md §0):
--   * Never serialise `sbi_scores.total` / pillar values / A-D grade.
--   * Never serialise contact PII (`email_primary`, `phones`,
--     `contact_name`, `contact_role`, `website`).
--   * `auth.uid()` is the only authority for ownership inside both RPCs.
--     Server route handlers must also enforce `getServerRole()` so anon
--     callers are 401'd before reaching the function.
--
-- Reversible:
--   drop function public.buyer_dashboard();
--   drop function public.buyer_saved_list(text, int, int);
--   drop table public.saved_suppliers;

-- ----------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------

create table if not exists public.saved_suppliers (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id)       on delete cascade,
  supplier_id uuid        not null references public.suppliers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (owner_id, supplier_id)
);

create index if not exists idx_saved_suppliers_owner_created
  on public.saved_suppliers (owner_id, created_at desc);

create index if not exists idx_saved_suppliers_supplier
  on public.saved_suppliers (supplier_id);

alter table public.saved_suppliers enable row level security;

drop policy if exists pol_saved_suppliers_select_self on public.saved_suppliers;
create policy pol_saved_suppliers_select_self
  on public.saved_suppliers
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists pol_saved_suppliers_insert_self on public.saved_suppliers;
create policy pol_saved_suppliers_insert_self
  on public.saved_suppliers
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists pol_saved_suppliers_delete_self on public.saved_suppliers;
create policy pol_saved_suppliers_delete_self
  on public.saved_suppliers
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Admin role bypasses RLS on its own anyway; no explicit admin policy here.

-- ----------------------------------------------------------------------
-- buyer_saved_list — paged listing of the caller's saved set.
-- ----------------------------------------------------------------------

create or replace function public.buyer_saved_list(
  p_sort   text default 'recent',
  p_limit  int  default 24,
  p_offset int  default 0
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
  saved_at            timestamptz,
  total_count         bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select ss.supplier_id, ss.created_at as saved_at
      from public.saved_suppliers ss
     where ss.owner_id = auth.uid()
  ),
  base as (
    select
      s.id,
      s.slug,
      s.company_name,
      s.entity_type::text                                            as entity_type,
      s.city,
      s.district,
      s.source_tags,
      coalesce((
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.status      = 'active'
           and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
      ), 0)                                                          as t13_source_count,
      s.completeness_pct,
      s.employees_total,
      s.established_date,
      s.principal_products,
      s.factory_types,
      rr.progress_pct                                                as rsc_progress_pct,
      s.parent_group_name,
      m.saved_at                                                     as saved_at,
      sb.total                                                       as _sbi_total
    from mine m
    join public.suppliers s
      on s.id = m.supplier_id
    left join public.rsc_remediation rr
      on rr.supplier_id = s.id
     and rr.active      = true
    left join public.sbi_scores sb
      on sb.supplier_id = s.id
    where s.is_published   = true
      and s.is_sanctioned  = false
  ),
  counted as (
    select *, count(*) over () as total_count
      from base
  )
  select
    id, slug, company_name, entity_type, city, district, source_tags,
    t13_source_count, completeness_pct, employees_total, established_date,
    principal_products, factory_types, rsc_progress_pct, parent_group_name,
    saved_at, total_count
  from counted
  order by
    case when p_sort = 'name'         then company_name     end asc,
    case when p_sort = 'receipts'     then t13_source_count end desc nulls last,
    case when p_sort = 'completeness' then completeness_pct end desc nulls last,
    -- default 'recent': most recently saved first.
    case when p_sort = 'recent'       then saved_at         end desc nulls last,
    -- internal tiebreaker: SBI desc, then receipts, then name. SBI never
    -- leaves the function body.
    _sbi_total       desc nulls last,
    t13_source_count desc nulls last,
    company_name     asc
  limit  greatest(1, least(coalesce(p_limit, 24), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.buyer_saved_list(text, int, int) is
  'Spec B5 saved-list RPC. Scopes by auth.uid(); reads sbi_scores under '
  'security definer for the default tiebreaker only — SBI is excluded from '
  'the RETURNS TABLE whitelist and never serialised.';

revoke all  on function public.buyer_saved_list(text, int, int) from public;
grant execute on function public.buyer_saved_list(text, int, int) to authenticated;

-- ----------------------------------------------------------------------
-- buyer_dashboard — single jsonb document for /app
-- ----------------------------------------------------------------------

create or replace function public.buyer_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_saved_count  int  := 0;
  v_recent_saved jsonb;
  v_alerts       jsonb;
  v_activity     jsonb;
begin
  if v_uid is null then
    return jsonb_build_object(
      'saved_count',     0,
      'recent_saved',    '[]'::jsonb,
      'alerts',          '[]'::jsonb,
      'recent_activity', '[]'::jsonb
    );
  end if;

  select count(*)::int into v_saved_count
    from public.saved_suppliers ss
   where ss.owner_id = v_uid;

  -- Top 6 most recently saved (buyer-safe shape).
  with mine as (
    select ss.supplier_id, ss.created_at as saved_at
      from public.saved_suppliers ss
     where ss.owner_id = v_uid
     order by ss.created_at desc
     limit 6
  ),
  cards as (
    select
      s.id, s.slug, s.company_name,
      s.entity_type::text as entity_type,
      s.city, s.district, s.source_tags, s.completeness_pct,
      coalesce((
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.status      = 'active'
           and sr.source_tier in ('tier1_gov','tier2_industry','tier3_cert')
      ), 0) as t13_source_count,
      m.saved_at
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    where s.is_published = true and s.is_sanctioned = false
    order by m.saved_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(cards) order by saved_at desc), '[]'::jsonb)
    into v_recent_saved
  from cards;

  -- Alerts: certifications expiring on saved suppliers within next 30 days
  -- (and not already expired). Buyer-safe shape only.
  with mine as (
    select ss.supplier_id from public.saved_suppliers ss where ss.owner_id = v_uid
  ),
  expiring as (
    select
      s.id   as supplier_id,
      s.slug as supplier_slug,
      s.company_name,
      c.kind::text       as cert_kind,
      c.expires_on
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    join public.certifications c on c.supplier_id = s.id
    where s.is_published = true
      and s.is_sanctioned = false
      and c.expires_on is not null
      and c.expires_on >= current_date
      and c.expires_on <  current_date + interval '30 days'
    order by c.expires_on asc
    limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind',          'cert_expiring',
           'supplier_id',   supplier_id,
           'supplier_slug', supplier_slug,
           'company_name',  company_name,
           'cert_kind',     cert_kind,
           'expires_on',    expires_on
         ) order by expires_on asc), '[]'::jsonb)
    into v_alerts
  from expiring;

  -- Recent activity: last 20 events from existing tables only. No history
  -- table is read — we approximate "what changed for your saved set" using
  -- timestamps already present on the source rows. Buyer-safe shape only.
  with mine as (
    select ss.supplier_id, ss.created_at as saved_at
      from public.saved_suppliers ss
     where ss.owner_id = v_uid
  ),
  events as (
    -- "You saved this supplier"
    select
      m.supplier_id, s.slug as supplier_slug, s.company_name,
      'saved'::text        as kind,
      m.saved_at           as event_at,
      null::text           as detail
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    where s.is_published = true and s.is_sanctioned = false

    union all
    -- Certification added in the last 60 days for a saved supplier.
    select
      m.supplier_id, s.slug, s.company_name,
      'cert_added'::text   as kind,
      c.created_at         as event_at,
      c.kind::text         as detail
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    join public.certifications c on c.supplier_id = s.id
    where s.is_published = true and s.is_sanctioned = false
      and c.created_at >= now() - interval '60 days'

    union all
    -- Certification recently expired (last 60 days) on a saved supplier.
    select
      m.supplier_id, s.slug, s.company_name,
      'cert_expired'::text as kind,
      (c.expires_on::timestamptz) as event_at,
      c.kind::text         as detail
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    join public.certifications c on c.supplier_id = s.id
    where s.is_published = true and s.is_sanctioned = false
      and c.expires_on is not null
      and c.expires_on >= current_date - interval '60 days'
      and c.expires_on <  current_date

    union all
    -- RSC remediation last fetched in the last 60 days for saved supplier.
    select
      m.supplier_id, s.slug, s.company_name,
      'rsc_updated'::text  as kind,
      rr.fetched_at        as event_at,
      rr.progress_pct::text as detail
    from mine m
    join public.suppliers s on s.id = m.supplier_id
    join public.rsc_remediation rr on rr.supplier_id = s.id and rr.active = true
    where s.is_published = true and s.is_sanctioned = false
      and rr.fetched_at >= now() - interval '60 days'
  ),
  ranked as (
    select *
      from events
     order by event_at desc nulls last
     limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind',          kind,
           'supplier_id',   supplier_id,
           'supplier_slug', supplier_slug,
           'company_name',  company_name,
           'event_at',      event_at,
           'detail',        detail
         ) order by event_at desc nulls last), '[]'::jsonb)
    into v_activity
  from ranked;

  return jsonb_build_object(
    'saved_count',     v_saved_count,
    'recent_saved',    v_recent_saved,
    'alerts',          v_alerts,
    'recent_activity', v_activity
  );
end;
$$;

comment on function public.buyer_dashboard() is
  'Spec B5 dashboard RPC. Scopes by auth.uid(); composes recent activity '
  'and alerts from existing tables (no history table). Excludes contact '
  'PII and SBI from the returned document.';

revoke all  on function public.buyer_dashboard() from public;
grant execute on function public.buyer_dashboard() to authenticated;
