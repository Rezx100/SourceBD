-- How often each source and field really changes. Read-only; run on production
-- (project stnrfxrxfonwexzcvvpv). Results written up in
-- context/feature-specs/spec-etl-freshness.md (§1), measured 6 Oct 2026.
-- Re-run these rather than writing new ones (AGENTS rule 14).

-- Q1. Per source: records and last read.
select s.code, s.tier, count(r.id) recs, max(r.fetched_at)::date last_read
from sources s left join source_records r on r.source_id = s.id
group by 1, 2 order by 2, 1;

-- Q2. Per scraper run history: change-skip ratio = how much of a source moved since the last run.
select scraper_code, started_at::date, status, records_seen, records_upserted, records_skipped
from etl_runs where status = 'success' order by scraper_code, started_at;

-- Q3. Field-level change: subjects seen in >1 document, and how many carried a different value.
with g as (
  select d.scraper_code sc, c.field_key fk, c.supplier_id, c.subject_key,
         count(distinct c.value_sha256) nv, min(c.first_seen_at) f, max(c.first_seen_at) l,
         count(distinct d.id) docs
  from evidence_claims c join evidence_documents d on d.id = c.evidence_id group by 1, 2, 3, 4)
select sc, fk, count(*) filter (where docs > 1) observed_twice, count(*) filter (where nv > 1) changed,
       round(100.0 * count(*) filter (where nv > 1) / nullif(count(*) filter (where docs > 1), 0), 1) pct,
       round(avg(extract(epoch from l - f) / 86400) filter (where docs > 1)) window_days
from g group by 1, 2 order by 1, 2;

-- Q4. Certificates: expired, expiring, and expired AFTER our last read (renewal unknown).
select c.kind, count(*) n, count(*) filter (where c.expires_on is null) no_expiry,
       count(*) filter (where c.expires_on < current_date) expired,
       count(*) filter (where c.expires_on between current_date and current_date + 30) exp30,
       count(*) filter (where c.expires_on < current_date and c.expires_on > r.fetched_at::date) expired_since_read,
       max(r.fetched_at)::date last_read
from certifications c left join source_records r on r.id = c.source_record_id group by 1;

-- Q5. Sanctions lists: size, Bangladesh entries, last fetch, newest listing.
select list, count(*) n, count(*) filter (where country ilike '%bangladesh%') bd,
       max(fetched_at)::date last_fetch, max(listed_date) newest_listed
from sanctions_list_entries group by 1;

-- Q6. Firecrawl monitor deliveries per page: how often a page really changes.
select m.scraper_code, e.payload -> 'data' -> 0 ->> 'status' st, count(*) n
from firecrawl_webhook_events e left join evidence_monitors m on m.monitor_id = e.monitor_id
group by 1, 2 order by 1, 2;

-- Q7. Verifier outcomes per source.
select d.scraper_code, v.outcome, count(*) n, count(distinct v.evidence_id) docs, sum(v.credits_used) credits
from evidence_verifications v join evidence_documents d on d.id = v.evidence_id group by 1, 2 order by 1, 2;

-- Q8. sbi_recompute: days on which it changed anything.
select started_at::date, records_upserted from etl_runs
where scraper_code = 'sbi_recompute' and records_upserted > 0 order by 1;
