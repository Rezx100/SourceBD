-- 0084_evidence_provenance.sql
--
-- Per-field provenance for the SourceBD data moat.
--
-- Until now, provenance lived as loose keys inside `source_records.fields`
-- (a jsonb blob with no URL column), so we could say "this supplier came from
-- BGMEA" but not "this employee count is on THIS page, in THIS row, and that
-- page still says so today".
--
-- Three tables close that gap:
--   * evidence_documents     — one row per acquired page/file, with the citable
--                              URL, a content hash, archived mirrors and the
--                              Firecrawl credit cost.
--   * evidence_claims        — one row per (record, field) citation, carrying a
--                              `locator` and a verbatim `excerpt` so that
--                              "the link still contains this fact" is
--                              machine-checkable rather than assumed.
--   * evidence_verifications — append-only log of every liveness/drift check.
--
-- Plus the plumbing the verification loop needs: `evidence_monitors` (Firecrawl
-- /v2/monitor registrations) and `firecrawl_webhook_events` (an idempotent
-- inbox, because Firecrawl retries deliveries and requires a 2xx within 10s).
--
-- RLS posture matches etl_job_queue: revoked from anon + authenticated, all
-- admin reads go through SECURITY DEFINER RPCs, and the ETL service role
-- writes over a direct Postgres connection.

-- ---------------------------------------------------------------------------
-- 1. Allow-list gains the two operational jobs this system introduces.
--    Widening only; existing rows are unaffected by the CHECK re-definition.
-- ---------------------------------------------------------------------------
create or replace function public.admin_etl_allowed_scraper_codes()
returns text[]
language sql
immutable
as $$
  select array[
    'bgmea_pdf',
    'bgmea_web',
    'bkmea_web',
    'bkmea_detail',
    'bgapmea_web',
    'epb_web',
    'btma_spinning',
    'rsc',
    'rsc_reports',
    'rsc_updates',
    'rsc_documents',
    'wrap',
    'oeko_tex',
    'gots',
    'sa8000',
    'uflpa',
    'cbp_wro',
    'ofac_sdn',
    'uk_ofsi',
    'eu_sanctions',
    'ilab_tvpra',
    'brand_hm',
    -- brand_inditex retired 29 Jul 2026: Inditex publishes no factory-level
    -- supplier list, so there is nothing for the queue to run.
    'brand_primark',
    'brand_asos',
    'brand_ms',
    'brand_next',
    'verify_evidence',
    'refresh_monitors'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- 2. evidence_documents
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id),
  scraper_code text not null,
  etl_run_id uuid references public.etl_runs(id),

  -- The URL we asked for, and the URL a human should actually be sent to.
  url text not null,
  final_url text,
  -- Hashed so the uniqueness index is safe for arbitrarily long URLs (Power BI
  -- query URLs and the EU FSD token URL both exceed the btree key limit).
  -- Maintained by trg_evidence_documents_url_hash rather than a generated
  -- column: there is no immutable text->bytea cast to generate it from.
  url_hash text not null default '',

  adapter text not null
    check (adapter in ('firecrawl', 'direct', 'local')),
  http_status integer,
  fetch_status text not null
    check (fetch_status in ('ok', 'not_found', 'blocked', 'timeout', 'error')),
  firecrawl_error_code text,
  error_message text,

  content_sha256 text not null,
  content_bytes bigint,
  content_type text,
  title text,

  -- Archived fallbacks, so a fact stays citable after the source page dies.
  raw_html_mirror_url text,
  markdown_mirror_url text,
  screenshot_mirror_url text,
  file_mirror_url text,

  credits_used integer not null default 0 check (credits_used >= 0),

  fetched_at timestamptz not null default now(),
  last_verified_at timestamptz,
  verify_status text not null default 'unverified'
    check (verify_status in ('unverified', 'live', 'changed', 'dead')),
  verify_detail jsonb not null default '{}'::jsonb,
  -- Consecutive transient failures. Never promotes to 'dead' on its own; it
  -- only backs the retry schedule off.
  transient_failures integer not null default 0 check (transient_failures >= 0),

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint evidence_documents_url_content_uniq unique (url_hash, content_sha256)
);

create index if not exists idx_evidence_documents_url_hash
  on public.evidence_documents (url_hash, fetched_at desc);

create index if not exists idx_evidence_documents_scraper
  on public.evidence_documents (scraper_code, fetched_at desc);

create index if not exists idx_evidence_documents_source
  on public.evidence_documents (source_id, fetched_at desc);

create index if not exists idx_evidence_documents_verify_due
  on public.evidence_documents (last_verified_at asc nulls first)
  where fetch_status = 'ok';

create index if not exists idx_evidence_documents_problem
  on public.evidence_documents (verify_status, last_verified_at desc)
  where verify_status in ('changed', 'dead');

create index if not exists idx_evidence_documents_credits
  on public.evidence_documents (fetched_at desc)
  where credits_used > 0;

-- ---------------------------------------------------------------------------
-- 3. evidence_claims — the per-field citation
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_documents(id) on delete cascade,

  -- Denormalised for the common "show me provenance for this supplier" read.
  supplier_id uuid references public.suppliers(id) on delete cascade,
  subject_table text not null
    check (subject_table in (
      'suppliers',
      'source_records',
      'certifications',
      'rsc_remediation',
      'rsc_industry_metrics',
      'sanctions_list_entries',
      'compliance_documents'
    )),
  subject_id uuid,
  -- Not every citable subject is uuid-addressable: rsc_industry_metrics is keyed
  -- on (report_month, scope, metric_key) over a bigserial id. Those subjects set
  -- subject_key instead, so provenance is not silently limited to uuid tables.
  subject_key text,
  constraint evidence_claims_subject_addressable
    check (subject_id is not null or subject_key is not null),

  field_key text not null,
  field_value text,
  value_sha256 text,

  -- WHERE on the page the value was found: a CSS selector, a table row index,
  -- `pdf:page=7`, or a JSON pointer for API transports.
  locator text,
  -- Verbatim snippet containing the value. This is what the verifier re-checks;
  -- a page that returns 200 but no longer contains the excerpt is a drifted
  -- citation, which a plain liveness check would miss entirely.
  excerpt text,

  source_tier source_tier,
  status text not null default 'active'
    check (status in ('active', 'stale', 'contradicted', 'orphaned')),

  first_seen_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text,

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `nulls not distinct` is what makes this work as an upsert target: one of
-- subject_id/subject_key is always NULL, and under the default `nulls distinct`
-- every re-scrape would insert a duplicate claim instead of updating one.
create unique index if not exists evidence_claims_subject_field_uniq
  on public.evidence_claims (subject_table, subject_id, subject_key, field_key, evidence_id)
  nulls not distinct;

create index if not exists idx_evidence_claims_supplier
  on public.evidence_claims (supplier_id, field_key);

create index if not exists idx_evidence_claims_subject
  on public.evidence_claims (subject_table, subject_id);

create index if not exists idx_evidence_claims_subject_key
  on public.evidence_claims (subject_table, subject_key)
  where subject_key is not null;

create index if not exists idx_evidence_claims_evidence
  on public.evidence_claims (evidence_id);

create index if not exists idx_evidence_claims_problem
  on public.evidence_claims (status, updated_at desc)
  where status in ('stale', 'contradicted', 'orphaned');

create index if not exists idx_evidence_claims_unreviewed
  on public.evidence_claims (updated_at desc)
  where status in ('stale', 'contradicted', 'orphaned') and reviewed_at is null;

-- ---------------------------------------------------------------------------
-- 4. evidence_verifications — append-only check log
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_verifications (
  id bigserial primary key,
  evidence_id uuid not null references public.evidence_documents(id) on delete cascade,
  checked_at timestamptz not null default now(),
  adapter text not null
    check (adapter in ('firecrawl', 'direct', 'local')),
  http_status integer,
  fetch_status text not null
    check (fetch_status in ('ok', 'not_found', 'blocked', 'timeout', 'error')),
  content_sha256 text,
  content_changed boolean not null default false,
  claims_checked integer not null default 0,
  claims_confirmed integer not null default 0,
  claims_missing integer not null default 0,
  outcome text not null
    check (outcome in ('live', 'changed', 'dead', 'inconclusive')),
  credits_used integer not null default 0,
  notes jsonb not null default '{}'::jsonb
);

create index if not exists idx_evidence_verifications_evidence
  on public.evidence_verifications (evidence_id, checked_at desc);

create index if not exists idx_evidence_verifications_checked
  on public.evidence_verifications (checked_at desc);

-- ---------------------------------------------------------------------------
-- 5. evidence_monitors — Firecrawl /v2/monitor registrations
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_monitors (
  id uuid primary key default gen_random_uuid(),
  monitor_id text unique,
  name text not null,
  scraper_code text not null,
  target_url text not null,
  target_kind text not null default 'scrape'
    check (target_kind in ('scrape', 'crawl')),
  schedule_text text,
  enabled boolean not null default true,
  last_check_at timestamptz,
  last_status text,
  last_change_at timestamptz,
  consecutive_errors integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_monitors_target_uniq unique (scraper_code, target_url)
);

create index if not exists idx_evidence_monitors_scraper
  on public.evidence_monitors (scraper_code);

-- ---------------------------------------------------------------------------
-- 6. firecrawl_webhook_events — idempotent inbox
--
-- The route must answer 2xx inside 10 seconds or Firecrawl retries, so it only
-- writes here and returns; processing happens in the ETL worker. `dedupe_key`
-- makes a retried delivery a no-op instead of a double-apply.
-- ---------------------------------------------------------------------------
create table if not exists public.firecrawl_webhook_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  event_type text not null,
  monitor_id text,
  page_url text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  process_status text not null default 'pending'
    check (process_status in ('pending', 'processed', 'failed', 'ignored')),
  processed_at timestamptz,
  process_error text,
  attempts integer not null default 0 check (attempts >= 0)
);

create index if not exists idx_firecrawl_webhook_pending
  on public.firecrawl_webhook_events (received_at asc)
  where process_status = 'pending';

create index if not exists idx_firecrawl_webhook_monitor
  on public.firecrawl_webhook_events (monitor_id, received_at desc);

-- ---------------------------------------------------------------------------
-- 7. Lock everything down.
-- ---------------------------------------------------------------------------
alter table public.evidence_documents enable row level security;
alter table public.evidence_claims enable row level security;
alter table public.evidence_verifications enable row level security;
alter table public.evidence_monitors enable row level security;
alter table public.firecrawl_webhook_events enable row level security;

revoke all on public.evidence_documents from anon, authenticated;
revoke all on public.evidence_claims from anon, authenticated;
revoke all on public.evidence_verifications from anon, authenticated;
revoke all on public.evidence_monitors from anon, authenticated;
revoke all on public.firecrawl_webhook_events from anon, authenticated;
revoke all on sequence public.evidence_verifications_id_seq from anon, authenticated;

-- Keep url_hash authoritative regardless of which client inserts the row.
-- (search_path pinned in 0085, after the advisor flagged it post-apply.)
create or replace function public.evidence_documents_set_url_hash()
returns trigger
language plpgsql
as $$
begin
  new.url_hash := encode(sha256(convert_to(new.url, 'UTF8')), 'hex');
  return new;
end;
$$;

drop trigger if exists trg_evidence_documents_url_hash on public.evidence_documents;
create trigger trg_evidence_documents_url_hash
  before insert or update of url on public.evidence_documents
  for each row execute function public.evidence_documents_set_url_hash();

drop trigger if exists trg_evidence_documents_touch on public.evidence_documents;
create trigger trg_evidence_documents_touch
  before update on public.evidence_documents
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_evidence_claims_touch on public.evidence_claims;
create trigger trg_evidence_claims_touch
  before update on public.evidence_claims
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_evidence_monitors_touch on public.evidence_monitors;
create trigger trg_evidence_monitors_touch
  before update on public.evidence_monitors
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Admin read surface
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

-- Per-scraper acquisition rollup, merged into the /admin/sources cards.
create or replace function public.admin_evidence_by_scraper()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_out jsonb;
begin
  with allowed(code) as (
    select unnest(public.admin_etl_allowed_scraper_codes())
  ),
  doc_stats as (
    select d.scraper_code,
           count(*) as documents,
           max(d.fetched_at) as last_document_at,
           mode() within group (order by d.adapter) as adapter,
           count(*) filter (where d.verify_status = 'dead') as dead_documents,
           count(*) filter (where d.verify_status = 'changed') as changed_documents,
           count(*) filter (where d.verify_status = 'unverified') as unverified_documents,
           coalesce(sum(d.credits_used) filter (where d.fetched_at >= date_trunc('month', now())), 0) as credits_month,
           coalesce(sum(d.credits_used) filter (where d.fetched_at >= now() - interval '24 hours'), 0) as credits_24h
      from public.evidence_documents d
     group by d.scraper_code
  ),
  claim_stats as (
    select d.scraper_code,
           count(c.id) as claims,
           count(c.id) filter (where c.status = 'active') as active_claims,
           count(c.id) filter (
             where c.status in ('stale', 'contradicted', 'orphaned') and c.reviewed_at is null
           ) as claims_needing_review
      from public.evidence_claims c
      join public.evidence_documents d on d.id = c.evidence_id
     group by d.scraper_code
  )
  select coalesce(
           jsonb_object_agg(
             a.code,
             jsonb_build_object(
               'adapter', ds.adapter,
               'documents', coalesce(ds.documents, 0),
               'last_document_at', ds.last_document_at,
               'dead_documents', coalesce(ds.dead_documents, 0),
               'changed_documents', coalesce(ds.changed_documents, 0),
               'unverified_documents', coalesce(ds.unverified_documents, 0),
               'credits_month', coalesce(ds.credits_month, 0),
               'credits_24h', coalesce(ds.credits_24h, 0),
               'claims', coalesce(cs.claims, 0),
               'active_claims', coalesce(cs.active_claims, 0),
               'claims_needing_review', coalesce(cs.claims_needing_review, 0)
             )
           ),
           '{}'::jsonb
         )
    into v_out
    from allowed a
    left join doc_stats ds on ds.scraper_code = a.code
    left join claim_stats cs on cs.scraper_code = a.code;

  return v_out;
end;
$$;

-- Problem-claim worklist for /admin/evidence.
create or replace function public.admin_evidence_problem_claims(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_total bigint;
begin
  select count(*)
    into v_total
    from public.evidence_claims c
   where c.status in ('stale', 'contradicted', 'orphaned')
     and (p_status is null or c.status = p_status);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'claim_id', t.id,
               'status', t.status,
               'field_key', t.field_key,
               'field_value', t.field_value,
               'locator', t.locator,
               'excerpt', t.excerpt,
               'subject_table', t.subject_table,
               'subject_id', t.subject_id,
               'source_tier', t.source_tier,
               'first_seen_at', t.first_seen_at,
               'last_confirmed_at', t.last_confirmed_at,
               'reviewed_at', t.reviewed_at,
               'review_note', t.review_note,
               'supplier', case when t.supplier_id is null then null else jsonb_build_object(
                 'id', t.supplier_id,
                 'slug', t.supplier_slug,
                 'company_name', t.company_name
               ) end,
               'evidence', jsonb_build_object(
                 'id', t.evidence_id,
                 'scraper_code', t.scraper_code,
                 'url', t.url,
                 'final_url', t.final_url,
                 'http_status', t.http_status,
                 'fetch_status', t.fetch_status,
                 'verify_status', t.verify_status,
                 'last_verified_at', t.last_verified_at,
                 'fetched_at', t.doc_fetched_at,
                 'raw_html_mirror_url', t.raw_html_mirror_url,
                 'screenshot_mirror_url', t.screenshot_mirror_url,
                 'file_mirror_url', t.file_mirror_url,
                 'verify_detail', t.verify_detail
               )
             )
             order by t.ord
           ),
           '[]'::jsonb
         )
    into v_rows
    from (
      select c.id,
             c.status,
             c.field_key,
             c.field_value,
             c.locator,
             c.excerpt,
             c.subject_table,
             c.subject_id,
             c.source_tier,
             c.first_seen_at,
             c.last_confirmed_at,
             c.reviewed_at,
             c.review_note,
             c.supplier_id,
             s.slug as supplier_slug,
             s.company_name,
             d.id as evidence_id,
             d.scraper_code,
             d.url,
             d.final_url,
             d.http_status,
             d.fetch_status,
             d.verify_status,
             d.last_verified_at,
             d.fetched_at as doc_fetched_at,
             d.raw_html_mirror_url,
             d.screenshot_mirror_url,
             d.file_mirror_url,
             d.verify_detail,
             row_number() over (
               order by (c.reviewed_at is not null), c.updated_at desc
             ) as ord
        from public.evidence_claims c
        join public.evidence_documents d on d.id = c.evidence_id
        left join public.suppliers s on s.id = c.supplier_id
       where c.status in ('stale', 'contradicted', 'orphaned')
         and (p_status is null or c.status = p_status)
       order by (c.reviewed_at is not null), c.updated_at desc
       limit v_limit
      offset v_offset
    ) t;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'generated_at', now()
  );
end;
$$;

-- Full provenance for one supplier — powers admin drill-down and, later, the
-- buyer-facing "where did this come from" surface.
create or replace function public.admin_evidence_for_supplier(p_supplier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_rows jsonb;
begin
  if p_supplier_id is null then
    raise exception 'supplier_id required' using errcode = '22023';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'claim_id', c.id,
               'field_key', c.field_key,
               'field_value', c.field_value,
               'status', c.status,
               'locator', c.locator,
               'excerpt', c.excerpt,
               'source_tier', c.source_tier,
               'last_confirmed_at', c.last_confirmed_at,
               'citation_url', coalesce(d.final_url, d.url),
               'citation_status', d.verify_status,
               'citation_checked_at', d.last_verified_at,
               'archived_url', coalesce(d.raw_html_mirror_url, d.file_mirror_url),
               'screenshot_url', d.screenshot_mirror_url,
               'scraper_code', d.scraper_code
             )
             order by c.field_key
           ),
           '[]'::jsonb
         )
    into v_rows
    from public.evidence_claims c
    join public.evidence_documents d on d.id = c.evidence_id
   where c.supplier_id = p_supplier_id;

  return jsonb_build_object('supplier_id', p_supplier_id, 'claims', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Admin write surface — repair actions on a problem claim.
-- ---------------------------------------------------------------------------
create or replace function public.admin_evidence_claim_decide(
  p_claim_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.admin_etl_assert_admin();
  v_claim public.evidence_claims%rowtype;
  v_status text;
begin
  if p_claim_id is null then
    raise exception 'claim_id required' using errcode = '22023';
  end if;

  select * into v_claim
    from public.evidence_claims
   where id = p_claim_id
   for update;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if p_action = 'acknowledge' then
    -- Operator has seen it and accepts the current state.
    update public.evidence_claims
       set reviewed_at = now(),
           reviewed_by = v_uid,
           review_note = p_note
     where id = p_claim_id;
    v_status := v_claim.status;

  elsif p_action = 'retire' then
    -- The fact is no longer supported by any live source.
    update public.evidence_claims
       set status = 'orphaned',
           reviewed_at = now(),
           reviewed_by = v_uid,
           review_note = p_note
     where id = p_claim_id;
    v_status := 'orphaned';

  elsif p_action = 'recheck' then
    -- Put the document back in the verifier's queue and clear the transient
    -- backoff so the next run picks it up immediately.
    update public.evidence_documents
       set verify_status = 'unverified',
           last_verified_at = null,
           transient_failures = 0
     where id = v_claim.evidence_id;
    update public.evidence_claims
       set reviewed_at = now(),
           reviewed_by = v_uid,
           review_note = p_note
     where id = p_claim_id;
    v_status := v_claim.status;

  else
    raise exception 'action must be acknowledge, retire or recheck' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  values (
    v_uid,
    'admin_evidence_claim_' || p_action,
    'evidence_claims',
    p_claim_id,
    jsonb_build_object(
      'field_key', v_claim.field_key,
      'previous_status', v_claim.status,
      'new_status', v_status,
      'note', p_note
    )
  );

  return jsonb_build_object('claim_id', p_claim_id, 'status', v_status, 'action', p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9b. Webhook ingest — the only write the Next.js route is allowed to make.
--
-- Firecrawl retries any delivery it does not get a 2xx for within 10 seconds, so
-- the route cannot verify anything inline; it records and returns. `on conflict
-- do nothing` on `dedupe_key` is what makes those retries harmless rather than a
-- double-apply, and the boolean return lets the route say `duplicate: true`
-- instead of pretending it just accepted new work.
--
-- SECURITY DEFINER with a narrow signature rather than a service-role table
-- insert: the route gets exactly one verb on exactly one table, and cannot set
-- `process_status` or backdate `received_at` even if the caller is compromised.
-- ---------------------------------------------------------------------------
create or replace function public.firecrawl_webhook_record(
  p_dedupe_key text,
  p_event_type text,
  p_monitor_id text,
  p_page_url text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(p_dedupe_key, '') = '' or coalesce(p_event_type, '') = '' then
    raise exception 'dedupe_key and event_type are required' using errcode = '22023';
  end if;

  insert into public.firecrawl_webhook_events
    (dedupe_key, event_type, monitor_id, page_url, payload)
  values
    (p_dedupe_key, p_event_type, nullif(p_monitor_id, ''), nullif(p_page_url, ''),
     coalesce(p_payload, '{}'::jsonb))
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.admin_evidence_summary() from public;
revoke all on function public.admin_evidence_by_scraper() from public;
revoke all on function public.admin_evidence_problem_claims(text, integer, integer) from public;
revoke all on function public.admin_evidence_for_supplier(uuid) from public;
revoke all on function public.admin_evidence_claim_decide(uuid, text, text) from public;
-- Not granted to anon or authenticated: the webhook route holds the service role
-- key, and a browser session must never be able to inject verification work.
revoke all on function public.firecrawl_webhook_record(text, text, text, text, jsonb)
  from public, anon, authenticated;
-- Revoking from public also removes the implicit grant service_role relied on,
-- so it needs naming explicitly (same shape as stripe_webhook_record in 0045).
grant execute on function public.firecrawl_webhook_record(text, text, text, text, jsonb)
  to service_role;

grant execute on function public.admin_evidence_summary() to authenticated;
grant execute on function public.admin_evidence_by_scraper() to authenticated;
grant execute on function public.admin_evidence_problem_claims(text, integer, integer) to authenticated;
grant execute on function public.admin_evidence_for_supplier(uuid) to authenticated;
grant execute on function public.admin_evidence_claim_decide(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Comments
-- ---------------------------------------------------------------------------
comment on table public.evidence_documents is
  'One row per acquired page/file. Holds the citable URL, content hash, archived mirrors and Firecrawl credit cost. RLS locked; admin reads via admin_evidence_* RPCs.';
comment on table public.evidence_claims is
  'Per-field citation: which document, which field, the value as cited, plus locator + verbatim excerpt so "the link still contains this fact" is machine-checkable.';
comment on table public.evidence_verifications is
  'Append-only log of liveness/drift checks. outcome=inconclusive means a transient failure that must NOT retire a citation.';
comment on table public.evidence_monitors is
  'Firecrawl /v2/monitor registrations for high-value index pages.';
comment on table public.firecrawl_webhook_events is
  'Idempotent inbox for Firecrawl webhooks. The API route only inserts (2xx within 10s); the ETL worker processes.';
comment on column public.evidence_documents.transient_failures is
  'Consecutive timeout/blocked/error checks. Backs off the retry schedule; never promotes a document to dead on its own.';
