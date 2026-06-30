export type RunStatus = "running" | "success" | "failed" | "partial";
export type JobStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type JobEventType =
  | "queued"
  | "claimed"
  | "started"
  | "progress"
  | "success"
  | "failed"
  | "cancelled";

export type EtlJobEvent = {
  id: string;
  event_type: JobEventType;
  message: string;
  records_seen: number;
  records_upserted: number;
  records_skipped: number;
  records_matched: number;
  created_at: string;
  meta: Record<string, unknown> | null;
};

export type EtlRun = {
  id: string;
  scraper_code: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  records_seen: number;
  records_upserted: number;
  records_skipped: number;
  error: string | null;
  meta: Record<string, unknown> | null;
};

export type QueueJob = {
  id: string;
  scraper_code: string;
  status: JobStatus;
  priority: number;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  etl_run_id: string | null;
  attempts: number;
  error: string | null;
  metadata: Record<string, unknown> | null;
  progress_seen: number;
  progress_upserted: number;
  progress_skipped: number;
  progress_matched: number;
  progress_message: string | null;
  heartbeat_at: string | null;
  events: EtlJobEvent[];
};

export type ScraperState = {
  scraper_code: string;
  last_success_at: string | null;
  latest_run: EtlRun | null;
  active_job: QueueJob | null;
  schedule: {
    enabled: boolean;
    interval_minutes: number;
    next_run_at: string | null;
    last_enqueued_at: string | null;
    updated_at: string | null;
  } | null;
  queue: {
    pending: number;
    running: number;
    failed: number;
  };
};

export type DashboardDoc = {
  summary: {
    last_success_at: string | null;
    running_jobs: number;
    pending_jobs: number;
    failed_jobs: number;
    enabled_schedules: number;
    next_scheduled_at: string | null;
  };
  scrapers: ScraperState[];
  recent_runs: EtlRun[];
  recent_jobs: QueueJob[];
  generated_at: string;
};
