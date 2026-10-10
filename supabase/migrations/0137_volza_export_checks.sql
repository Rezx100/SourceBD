-- 0137 — Customs export records from Volza, kept one year, shown only to paying buyers (11 Oct 2026).
--
-- Volza (Shivani, email of 8 Oct 2026) lets SourceBD store its API results for up to one year and
-- show them to paying users on supplier profiles; never on public pages, never in an export or API
-- we offer. Volza data is Tier 6 cross-check data: it attaches to suppliers we already publish and
-- never creates or changes a supplier fact. Report: ops/plans/volza-export-dry-run.md.
--
-- One row per supplier: the last Volza check, a match or a "nothing found", so a later fetch within
-- the year can skip it instead of paying again. expires_at is at most one year after fetched_at;
-- the read function deletes expired rows and never returns one.
--
-- Who sees it (founder, 11 Oct 2026): plan Growth or Enterprise, or an admin; not a suspended
-- account. Billing is not live yet, so today only admins and buyers an admin moves to Growth or
-- Enterprise see the panel. Only matches classed 'exact' are shown; 'likely' and 'ambiguous' wait
-- for a person (the name may sweep in another exporter's shipments).
--
-- Rollback:
--   drop function public.supplier_volza_exports(text);
--   drop table public.volza_export_checks;

create table public.volza_export_checks (
  supplier_id         uuid primary key references public.suppliers (id) on delete cascade,
  name_searched       text not null,
  window_start        date not null,
  window_end          date not null,
  shipments           integer not null check (shipments >= 0),
  exporters_matched   integer not null default 0 check (exporters_matched >= 0),
  match_class         text not null check (match_class in ('exact', 'likely', 'ambiguous', 'none')),
  volza_supplier_name text,
  fob_usd             numeric(16, 2),
  buyers              integer,
  top_shipments       jsonb not null default '[]'::jsonb check (jsonb_typeof(top_shipments) = 'array'),
  fetched_at          timestamptz not null,
  expires_at          timestamptz not null,
  check (window_start <= window_end),
  check (expires_at > fetched_at and expires_at <= fetched_at + interval '1 year'),
  check ((match_class = 'none') = (shipments = 0))
);

create index volza_export_checks_expires_at_idx on public.volza_export_checks (expires_at);

comment on table public.volza_export_checks is
  'Last Volza Bangladesh-export check per supplier (HS 61/62). Tier 6 cross-check; kept at most one '
  'year (Volza licence, 8 Oct 2026). Read only through supplier_volza_exports(). Migration 0137.';

alter table public.volza_export_checks enable row level security;
revoke all on table public.volza_export_checks from public, anon, authenticated;
grant select, insert, update, delete on table public.volza_export_checks to service_role;

create or replace function public.supplier_volza_exports(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select (p.role = 'admin' or p.plan_tier in ('growth', 'enterprise'))
         and not coalesce(p.is_suspended, false)
    into v_allowed
    from public.profiles p
   where p.id = auth.uid();
  if not coalesce(v_allowed, false) then
    return null;
  end if;

  -- The licence ends a row's life at one year; the first entitled read after that deletes it
  -- (the loaders purge too). A free reader's view stays a read.
  delete from public.volza_export_checks where expires_at <= now();

  return (
    select jsonb_build_object(
             'shipments',      v.shipments,
             'fob_usd',        v.fob_usd,
             'buyers',         v.buyers,
             'window_start',   v.window_start,
             'window_end',     v.window_end,
             'volza_name',     v.volza_supplier_name,
             'top_shipments',  v.top_shipments,
             'fetched_at',     v.fetched_at)
      from public.volza_export_checks v
      join public.suppliers s on s.id = v.supplier_id
     where s.slug = p_slug
       and s.is_published = true
       and v.match_class = 'exact'
       and v.expires_at > now());
end;
$$;

comment on function public.supplier_volza_exports(text) is
  'Volza export summary for a published supplier, for admins and Growth/Enterprise buyers who are '
  'not suspended; null for everyone else, for no exact match, or once expired. Deletes expired rows. 0137.';

revoke all on function public.supplier_volza_exports(text) from public;
revoke all on function public.supplier_volza_exports(text) from anon;
grant execute on function public.supplier_volza_exports(text) to authenticated, service_role;
