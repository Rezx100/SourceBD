-- Spec M1 — Marketing landing page
-- ---------------------------------------------------------------------------
-- Adds a single SECURITY DEFINER RPC `public.marketing_stats()` that returns
-- a small jsonb document used to render the live counter strip on `/`.
--
-- This is the FIRST RPC in the codebase deliberately exposed to the `anon`
-- role without an `auth.uid()` gate. The function is intentionally narrow:
--   * returns only six aggregate counts + one timestamp
--   * never returns row-shaped data
--   * uses a hand-rolled allow-list of source codes so the marketing surface
--     cannot leak the existence of brand/regulator sources we haven't yet
--     decided to publish (Tier 4/5 are name-checked but not enumerated to
--     the client)
--   * tier weights are NEVER published — only the qualifying-source count
--
-- Doctrine refs:
--   * SBI doctrine `α now, β later, γ never` (20 May 2026)
--     → no numeric SBI on public surfaces
--   * logos.lock.md §5 rule #3 (no external marks on marketing surfaces)
--   * AGENTS.md rule #6 (no Tier-6 source enters DB alone) — n/a here
--
-- Schema corrections vs draft spec body (from prod probe 2026-05-21):
--   * `source_records` joins `sources` via `source_id` (uuid), not
--     `source_code` (the column does not exist)
--   * `source_records` freshness column is `fetched_at`, not `scraped_at`
--   * `sources` has NO `is_active` column — predicate dropped
--   * `certifications` has NO `verified_at` / `decided_at` — the cert
--     verification timestamp signal is unavailable, so `last_refreshed_at`
--     uses only `source_records.fetched_at` and
--     `compliance_documents.fetched_at`. Certifications still contribute to
--     `certifications_verified` (boolean flag count) but not to freshness.
-- ---------------------------------------------------------------------------

create or replace function public.marketing_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Allow-list locked in spec M1 (Tier 1 + Tier 2). Tier 3/4/5 are counted
  -- through their own narrow predicates below and never enumerated to the
  -- client. SA8000, BRAND_INDITEX, BRAND_PRIMARK, ILAB exist in `sources`
  -- but are intentionally excluded from the marketing tally.
  t1_t2_codes  text[] := array[
    'BEPZA','DIFE','EPB','RJSC','RSC',
    'BGMEA','BKMEA','BTMA','BGAPMEA'
  ];
  t5_codes     text[] := array[
    'OFAC','UFLPA','US_WRO','UK_OFSI','EU_SANC'
  ];

  v_suppliers_indexed                bigint;
  v_suppliers_with_tier1or2_source   bigint;
  v_sanctions_lists_screened         bigint;
  v_compliance_documents_mirrored    bigint;
  v_certifications_verified          bigint;
  v_last_refreshed_at                timestamptz;
begin
  select count(*) into v_suppliers_indexed
    from public.suppliers
   where is_published = true;

  select count(distinct s.id)
    into v_suppliers_with_tier1or2_source
    from public.suppliers s
    join public.source_records sr on sr.supplier_id = s.id
    join public.sources        src on src.id        = sr.source_id
   where src.tier in ('tier1_gov', 'tier2_industry')
     and src.code = any(t1_t2_codes)
     and s.is_published = true;

  select count(*) into v_sanctions_lists_screened
    from public.sources
   where tier = 'tier5_regulatory'
     and code = any(t5_codes);

  select count(*) into v_compliance_documents_mirrored
    from public.compliance_documents;

  select count(*) into v_certifications_verified
    from public.certifications
   where verified = true;

  select greatest(
           (select max(fetched_at) from public.source_records),
           (select max(fetched_at) from public.compliance_documents)
         )
    into v_last_refreshed_at;

  -- Collapse the `-infinity` sentinel that greatest() can yield when both
  -- subqueries are null. (Defensive: in current prod both are non-null.)
  if v_last_refreshed_at = '-infinity'::timestamptz then
    v_last_refreshed_at := null;
  end if;

  return jsonb_build_object(
    'suppliers_indexed',                v_suppliers_indexed,
    'suppliers_with_tier1or2_source',   v_suppliers_with_tier1or2_source,
    'sanctions_lists_screened',         v_sanctions_lists_screened,
    'compliance_documents_mirrored',    v_compliance_documents_mirrored,
    'certifications_verified',          v_certifications_verified,
    'last_refreshed_at',                v_last_refreshed_at
  );
end;
$$;

comment on function public.marketing_stats() is
  'Spec M1: read-only aggregate counts for the public marketing landing '
  'page. SECURITY DEFINER; callable by anon. Returns only six counts + one '
  'timestamp. Never returns row-shaped or supplier-identifying data. '
  'Source allow-list is hand-locked in the function body — keep in sync '
  'with context/feature-specs/spec-M1-marketing-landing.md.';

revoke all on function public.marketing_stats() from public;
grant  execute on function public.marketing_stats() to anon, authenticated;
