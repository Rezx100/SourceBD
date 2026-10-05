-- 0117 — The facts the public site prints, from one read (5 Oct 2026).
--
-- The v4 marketing site (home, Data & methodology, the footer) prints live figures: how many sources we list and
-- how many hold supplier records, the certificates on file and how many have expired, the RSC records, the latest
-- read, and a table of every source with its tier, records, suppliers and latest read. marketing_stats() (the
-- home page's read) carries none of these. This is a second read beside it, anon-callable and cached by the
-- site for ten minutes.
--
-- Aggregates only: counts and dates per source. No supplier, no certificate number, no name. A figure that is
-- not here is not printed: there is no "districts mapped" (the district column mixes spellings and sub-districts,
-- so a count would be a guess; the live site's "48 districts" was one).
--
--   {
--     suppliers_published, sources_listed, sources_with_records,
--     certificates_on_file (rejected ones left out), certificates_expired (expires_on before today),
--     rsc_records, latest_read,
--     sources: [{code, tier, records, suppliers, latest}]   -- every source, those with no records included
--   }
--
-- Hard invariants honoured:
--   * Public by design and PII-free: SECURITY DEFINER with a pinned search_path, returns counts and dates.
--   * Never a score: nothing here is derived from SBI.
--
-- Idempotent and additive: `create or replace`. No existing row changes.
--
-- Do not apply to production from this PR (AGENTS rule 15); the founder applies it after the dry run in
-- ops/plans/0117-dry-run.md.
--
-- Reversible:
--   drop function public.marketing_facts();

set search_path = public;

create or replace function public.marketing_facts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with per as (
    select s.code,
           s.tier::text as tier,
           count(r.id)::int as records,
           count(distinct r.supplier_id)::int as suppliers,
           max(r.fetched_at)::date as latest
      from public.sources s
      left join public.source_records r on r.source_id = s.id
     group by s.id, s.code, s.tier
  )
  select jsonb_build_object(
           'suppliers_published',   (select count(*) from public.suppliers where is_published),
           'sources_listed',        (select count(*) from per),
           'sources_with_records',  (select count(*) from per where records > 0),
           'certificates_on_file',  (select count(*) from public.certifications where rejected_at is null),
           'certificates_expired',  (select count(*) from public.certifications where rejected_at is null and expires_on < current_date),
           'rsc_records',           (select records from per where code = 'RSC'),
           'latest_read',           (select max(fetched_at) from public.source_records),
           'sources',               (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'tier', tier, 'records', records, 'suppliers', suppliers, 'latest', latest) order by tier, code), '[]'::jsonb) from per)
         );
$$;

revoke all     on function public.marketing_facts() from public;
grant  execute on function public.marketing_facts() to anon, authenticated, service_role;
