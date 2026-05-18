-- Spec 15 — RSC industry benchmarks (monthly reports + updates page)
-- Time-series of industry-wide aggregate metrics, plus generated content drafts.

create table if not exists public.rsc_industry_metrics (
  id              bigserial primary key,
  report_month    date        not null,            -- 1st of month
  scope           text        not null,            -- e.g. 'inspection_remediation', 'boiler_safety',
                                                   --      'osh_training', 'osh_complaints', 'sups',
                                                   --      'fads', 'escalation'
  metric_key      text        not null,            -- slug, e.g. 'total_covered_factory'
  value_num       numeric,                         -- numeric value (count or pct)
  unit            text        not null default 'count',  -- 'count' | 'pct' | 'percent_points'
  raw_label       text,                            -- verbatim row label as printed
  source          text        not null default 'rsc_monthly_report',
                                                   -- 'rsc_monthly_report' | 'rsc_updates_page'
                                                   -- | 'rsc_quarterly_report' | 'rsc_annual_report'
  source_url      text,                            -- canonical PDF / page URL
  mirror_url      text,                            -- Bunny CDN copy (filled by Spec 13 plumbing)
  fetched_at      timestamptz not null default now(),
  raw             jsonb       not null default '{}'::jsonb,
  unique (report_month, scope, metric_key, source)
);

create index if not exists idx_rsc_metrics_month  on public.rsc_industry_metrics (report_month desc);
create index if not exists idx_rsc_metrics_metric on public.rsc_industry_metrics (metric_key, report_month desc);
create index if not exists idx_rsc_metrics_scope  on public.rsc_industry_metrics (scope);

-- Catalog of monthly report PDFs (provenance + mirror state).
create table if not exists public.rsc_monthly_reports (
  id              bigserial primary key,
  report_month    date        not null unique,
  title           text        not null,
  source_url      text        not null unique,
  mirror_url      text,                              -- Bunny CDN copy
  file_sha256     text,
  byte_size       bigint,
  parsed_at       timestamptz,
  parse_status    text        not null default 'pending', -- 'pending' | 'parsed' | 'failed'
  parse_error     text,
  fetched_at      timestamptz not null default now()
);

create index if not exists idx_rsc_monthly_reports_status on public.rsc_monthly_reports (parse_status);

-- Generated content drafts (newsletter + blog) ready for human review/publish.
create table if not exists public.content_drafts (
  id              bigserial primary key,
  kind            text        not null,             -- 'newsletter_monthly' | 'blog_monthly_state_of_rmg'
  period          date        not null,             -- the month the digest covers (1st of month)
  title           text        not null,
  subtitle        text,
  body_markdown   text        not null,
  body_html       text,                             -- rendered later by web layer
  metrics_used    jsonb       not null default '[]'::jsonb,
  status          text        not null default 'draft',  -- 'draft' | 'approved' | 'published'
  approved_by     uuid,
  approved_at     timestamptz,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (kind, period)
);

create index if not exists idx_content_drafts_status on public.content_drafts (status, period desc);
