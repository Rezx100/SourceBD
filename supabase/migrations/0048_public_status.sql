-- Phase 7 P2 — Public status page freshness RPC.
-- Returns aggregate freshness signals only — no row-shaped supplier data.

create or replace function public.public_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_published_suppliers bigint;
  v_last_source_refresh timestamptz;
  v_last_compliance_mirror timestamptz;
  v_last_sanctions_screen timestamptz;
  v_last_etl_success timestamptz;
  v_etl_recent jsonb;
begin
  select count(*) into v_published_suppliers
    from public.suppliers
   where is_published = true;

  select max(fetched_at) into v_last_source_refresh
    from public.source_records;

  select max(fetched_at) into v_last_compliance_mirror
    from public.compliance_documents;

  select max(screened_at) into v_last_sanctions_screen
    from public.sanctions_screening;

  select max(finished_at) into v_last_etl_success
    from public.etl_runs
   where status = 'success'
     and finished_at is not null;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'scraper_code', sub.scraper_code,
               'finished_at', sub.finished_at,
               'status', sub.status
             )
             order by sub.finished_at desc nulls last
           ),
           '[]'::jsonb
         )
    into v_etl_recent
    from (
      select distinct on (er.scraper_code)
             er.scraper_code,
             er.finished_at,
             er.status
        from public.etl_runs er
       where er.finished_at is not null
       order by er.scraper_code, er.finished_at desc
    ) sub;

  return jsonb_build_object(
    'published_suppliers', v_published_suppliers,
    'last_source_refresh', v_last_source_refresh,
    'last_compliance_mirror', v_last_compliance_mirror,
    'last_sanctions_screen', v_last_sanctions_screen,
    'last_etl_success', v_last_etl_success,
    'etl_recent', v_etl_recent,
    'generated_at', now()
  );
end;
$$;

comment on function public.public_status() is
  'Phase 7 P2: public /status freshness signals. SECURITY DEFINER; anon-safe aggregates only.';

revoke all on function public.public_status() from public;
grant execute on function public.public_status() to anon, authenticated;
