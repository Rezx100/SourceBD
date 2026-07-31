-- 0087 — separate "superseded" from "stale" on evidence claims.
--
-- WHY
-- ---
-- `needs_review` on /admin/evidence counted every non-active claim, and
-- `supersede_claims` wrote `stale` for the ordinary case of "this page was
-- re-scraped, so the previous document is no longer the current citation".
-- That is bookkeeping, not a problem. On 31 Jul 2026 the worklist stood at
-- ~11.9k items of which zero had failed a verification — `evidence_verifications`
-- was empty — and every single one had a newer active claim for the same
-- subject and field. `bkmea_detail` alone held 1,770 documents across 590 URLs
-- (three runs), and each run retired the previous run's ~5,800 claims. The
-- counter grew by that much per run, without bound.
--
-- A worklist that reports thousands of non-problems gets ignored, and the real
-- failures get ignored with it. So superseding now has its own status, outside
-- every "needs review" filter.
--
-- WHAT MUST NOT BE HIDDEN
-- -----------------------
-- Retiring *all* superseded claims silently would have hidden a real defect
-- found in the same investigation: 82 suppliers carry BKMEA member records for
-- genuinely different companies (fuzzy-name and phone-overlap mis-merges in
-- `upsert.py`). Those records assert different membership numbers and addresses
-- for one supplier, and each run flips which one is "current". The evidence
-- layer was the only surface exposing them.
--
-- So supersession is classified rather than assumed:
--
--   same URL (url_hash), newer fetch      -> superseded  (hidden; the page moved on)
--   different URL, same value             -> superseded  (hidden; the sources agree)
--   different URL, different value        -> contradicted (visible; they disagree)
--
-- The url_hash comparison is the load-bearing part. `evidence_documents` is
-- unique on (url_hash, content_sha256), so re-scraping one page whose content
-- changed creates a second row with the *same* url_hash — which is exactly the
-- signal that distinguishes "this page was refetched" from "a different page
-- claims something else about the same supplier".

-- ---------------------------------------------------------------------------
-- 1. Allow the new status.
-- ---------------------------------------------------------------------------
alter table public.evidence_claims
  drop constraint if exists evidence_claims_status_check;

alter table public.evidence_claims
  add constraint evidence_claims_status_check
  check (status in ('active', 'stale', 'superseded', 'contradicted', 'orphaned'));

-- ---------------------------------------------------------------------------
-- 2. Reclassify the existing backlog under the same rule.
--
-- A stale claim with no current active claim for its subject and field is left
-- alone: nothing superseded it, so if it is stale it is stale for a reason the
-- verifier will have to settle. Reviewed rows are reclassified too — a claim's
-- status should describe what happened to it, not whether somebody has looked.
-- `reviewed_at` is deliberately preserved.
-- ---------------------------------------------------------------------------
with successor as (
  select c.id as claim_id,
         (od.url_hash = nd.url_hash) as same_page,
         (c.field_value is not distinct from n.field_value) as same_value
    from public.evidence_claims c
    join public.evidence_documents od on od.id = c.evidence_id
    join public.evidence_claims n
      on  n.subject_table = c.subject_table
      and n.subject_id  is not distinct from c.subject_id
      and n.subject_key is not distinct from c.subject_key
      and n.field_key = c.field_key
      and n.evidence_id <> c.evidence_id
      and n.status = 'active'
    join public.evidence_documents nd on nd.id = n.evidence_id
   where c.status = 'stale'
)
update public.evidence_claims c
   set status = case
                  when s.same_page or s.same_value then 'superseded'
                  else 'contradicted'
                end,
       updated_at = now()
  from successor s
 where c.id = s.claim_id;

-- ---------------------------------------------------------------------------
-- 3. Report the new status.
--
-- `needs_review` already enumerated its statuses explicitly, so 'superseded' is
-- excluded from it, from `admin_evidence_problem_claims` and from
-- `admin_evidence_scraper_health` without touching those filters. It is counted
-- here so the volume stays visible rather than merely absent.
-- ---------------------------------------------------------------------------
create or replace function public.admin_evidence_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_docs jsonb;
  v_claims jsonb;
  v_credits jsonb;
  v_monitors jsonb;
begin
  select jsonb_build_object(
           'total', count(*),
           'live', count(*) filter (where verify_status = 'live'),
           'changed', count(*) filter (where verify_status = 'changed'),
           'dead', count(*) filter (where verify_status = 'dead'),
           'unverified', count(*) filter (where verify_status = 'unverified'),
           'oldest_unverified_at', min(fetched_at) filter (where verify_status = 'unverified'),
           'verified_last_7d', count(*) filter (where last_verified_at >= now() - interval '7 days')
         )
    into v_docs
    from public.evidence_documents;

  select jsonb_build_object(
           'total', count(*),
           'active', count(*) filter (where status = 'active'),
           'stale', count(*) filter (where status = 'stale'),
           'superseded', count(*) filter (where status = 'superseded'),
           'contradicted', count(*) filter (where status = 'contradicted'),
           'orphaned', count(*) filter (where status = 'orphaned'),
           'needs_review', count(*) filter (
             where status in ('stale', 'contradicted', 'orphaned')
               and reviewed_at is null
           ),
           'confirmed_last_7d', count(*) filter (where last_confirmed_at >= now() - interval '7 days')
         )
    into v_claims
    from public.evidence_claims;

  select jsonb_build_object(
           'last_24h', coalesce(sum(credits_used) filter (where fetched_at >= now() - interval '24 hours'), 0),
           'last_30d', coalesce(sum(credits_used) filter (where fetched_at >= now() - interval '30 days'), 0),
           'month_to_date', coalesce(sum(credits_used) filter (where fetched_at >= date_trunc('month', now())), 0),
           'all_time', coalesce(sum(credits_used), 0)
         )
    into v_credits
    from public.evidence_documents
   where adapter = 'firecrawl';

  select jsonb_build_object(
           'total', count(*),
           'enabled', count(*) filter (where enabled),
           'erroring', count(*) filter (where consecutive_errors > 0),
           'last_check_at', max(last_check_at),
           'pending_webhook_events', (
             select count(*) from public.firecrawl_webhook_events where process_status = 'pending'
           )
         )
    into v_monitors
    from public.evidence_monitors;

  return jsonb_build_object(
    'documents', coalesce(v_docs, '{}'::jsonb),
    'claims', coalesce(v_claims, '{}'::jsonb),
    'credits', coalesce(v_credits, '{}'::jsonb),
    'monitors', coalesce(v_monitors, '{}'::jsonb),
    'generated_at', now()
  );
end;
$$;
