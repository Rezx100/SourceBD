-- 0147 — The export rank on the record, and the customs cell on a results row (13 Oct 2026).
--
-- Spec: context/feature-specs/spec-desktop-record-page-37.md (Paper page 37, the export grid's first
-- tile and the results' "Exported in 2 years · ships to" column). Two readers, both additive: no table,
-- no column and no existing function changes.
--
-- 1. supplier_export_rank(p_slug): the share of suppliers with a customs record whose two-year export
--    value is smaller than this one's, as a whole percent ("Bigger than 89% of exporters on record").
--    The same gate as supplier_volza_exports (0137): an admin or a Growth or Enterprise buyer who is not
--    suspended; null for anyone else, for a supplier with no exact, unexpired record or no value, and
--    while fewer than 20 suppliers have a value to compare (a rank among a handful says nothing).
--
-- 2. discover_export_cells(p_ids): for the suppliers on a results page, which of them have an exact,
--    unexpired customs record. An entitled reader also gets the export value and the four markets it
--    ships to, biggest share of value first. Anyone else signed in gets has_records and nothing more:
--    the row then says a record exists on the paid plans, with no figure and no market (founder,
--    13 Oct 2026). At most 200 ids a call (the search pages at 100 at most).
--
-- Both are granted to authenticated only and are never read through the shared anon cache.
--
-- Rollback:
--   drop function public.discover_export_cells(uuid[]);
--   drop function public.supplier_export_rank(text);

create or replace function public.supplier_export_rank(p_slug text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_fob   numeric;
  v_below bigint;
  v_all   bigint;
begin
  if not public.volza_reader_entitled() then
    return null;
  end if;

  select v.fob_usd
    into v_fob
    from public.volza_export_checks v
    join public.suppliers s on s.id = v.supplier_id
   where s.slug = p_slug
     and s.is_published = true
     and v.match_class = 'exact'
     and v.expires_at > now();
  if v_fob is null then
    return null;
  end if;

  select count(*) filter (where v.fob_usd < v_fob), count(*)
    into v_below, v_all
    from public.volza_export_checks v
    join public.suppliers s on s.id = v.supplier_id
   where s.is_published = true
     and v.match_class = 'exact'
     and v.expires_at > now()
     and v.fob_usd is not null;
  if v_all < 20 then
    return null;
  end if;

  return floor(100.0 * v_below / v_all)::integer;
end;
$fn$;

comment on function public.supplier_export_rank(text) is
  'The whole percent of suppliers with a customs record whose two-year export value is below this one''s, '
  'for entitled readers only (volza_reader_entitled); null otherwise, and below 20 suppliers to compare. 0147.';

revoke all on function public.supplier_export_rank(text) from public, anon;
grant execute on function public.supplier_export_rank(text) to authenticated, service_role;

create or replace function public.discover_export_cells(p_ids uuid[])
returns table (
  supplier_id uuid,
  has_records boolean,
  fob_usd     numeric,
  markets     text[]
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_entitled boolean := public.volza_reader_entitled();
begin
  if auth.uid() is null or p_ids is null then
    return;
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'discover_export_cells: at most 200 suppliers a call' using errcode = '22023';
  end if;

  return query
    select v.supplier_id,
           true,
           case when v_entitled then v.fob_usd end,
           case when v_entitled then (
             -- The markets it shipped to, by their short codes, biggest share of value first.
             select array_agg(m.code order by m.fob desc nulls last, m.shipments desc, m.code)
               from (
                 select case e.key
                          when 'EU' then 'EU'
                          when 'United States' then 'US'
                          when 'United Kingdom' then 'UK'
                          when 'Canada' then 'CA'
                        end as code,
                        nullif(e.value ->> 'fob_usd', '')::numeric as fob,
                        coalesce(nullif(e.value ->> 'shipments', '')::integer, 0) as shipments
                   from jsonb_each(case when jsonb_typeof(v.markets) = 'object' then v.markets else '{}'::jsonb end) e
                  where e.key in ('EU', 'United States', 'United Kingdom', 'Canada')
               ) m
              where m.shipments > 0
           ) end
      from public.volza_export_checks v
      join public.suppliers s on s.id = v.supplier_id
     where v.supplier_id = any (p_ids)
       and s.is_published = true
       and v.match_class = 'exact'
       and v.expires_at > now();
end;
$fn$;

comment on function public.discover_export_cells(uuid[]) is
  'For the suppliers on a results page: which have an exact, unexpired customs record; the export value and '
  'the markets shipped to (biggest share first) for entitled readers only, has_records alone for anyone else. 0147.';

revoke all on function public.discover_export_cells(uuid[]) from public, anon;
grant execute on function public.discover_export_cells(uuid[]) to authenticated, service_role;
