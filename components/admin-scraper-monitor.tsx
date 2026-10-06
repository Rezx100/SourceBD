"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AdminColumn,
  AdminHead,
  AdminRow,
  AdminRows,
  AdminSection,
  StatusChip,
  formatAdminDateTime,
} from "@/components/admin/data-ui";
import {
  AdminScraperActions,
  AdminScraperJobAction,
} from "@/components/admin-scraper-actions";
import { ButtonLink, TypeChip } from "@/components/kit";
import {
  SCRAPER_CATALOG,
  SCRAPER_GROUP_LABELS,
  SCRAPER_TRANSPORT_LABELS,
  formatInterval,
  scraperTransport,
  type ScraperCatalogItem,
  type ScraperGroup,
  type ScraperTransport,
} from "@/lib/admin/etl-scrapers";
import {
  formatCredits,
  verifiedShare,
  type EvidenceByScraper,
  type EvidenceByScraperRow,
  type EvidenceSummary,
} from "@/lib/admin/evidence";
import {
  isStaleRunningJob,
  type DashboardDoc,
  type EtlJobEvent,
  type EtlRun,
  type JobStatus,
  type QueueJob,
  type RunStatus,
  type ScraperState,
} from "@/lib/admin/etl-monitoring";
import { cn } from "@/lib/utils";

const GROUP_ORDER: ScraperGroup[] = [
  "registries",
  "rsc",
  "certifications",
  "sanctions",
  "brands",
  "maintenance",
];

export function AdminScraperMonitor({
  initialDoc,
  evidence = null,
  evidenceByScraper = null,
}: {
  initialDoc: DashboardDoc;
  evidence?: EvidenceSummary | null;
  evidenceByScraper?: EvidenceByScraper | null;
}) {
  const [doc, setDoc] = useState(initialDoc);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const hasLiveWork = doc.summary.running_jobs > 0 || doc.summary.pending_jobs > 0;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/v1/admin/etl/status", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          throw new Error(payload?.detail ?? payload?.error ?? `Status failed (${res.status})`);
        }
        const next = (await res.json()) as DashboardDoc;
        if (!cancelled) {
          setDoc(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    const interval = window.setInterval(refresh, hasLiveWork ? 3000 : 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasLiveWork]);

  const stateByCode = useMemo(
    () => new Map(doc.scrapers.map((item) => [item.scraper_code, item])),
    [doc.scrapers],
  );

  const activeJobs = doc.recent_jobs.filter((job) => job.status === "running" || job.status === "pending");

  return (
    <AdminColumn>
      <AdminHead
        title="Sources & ingestion"
        lede="Run scraper jobs, set refresh timers, and watch live progress without reading terminal logs."
        actions={
          <div className="text-right font-mono text-xs text-ink-3">
            <p>auto-refresh {hasLiveWork ? "3s" : "15s"}</p>
            <p>generated {formatAdminDateTime(doc.generated_at)} UTC</p>
            {error ? <p className="text-danger">status: {error}</p> : null}
          </div>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Last successful update"
          value={formatRelative(doc.summary.last_success_at, now)}
          hint={formatAdminDateTime(doc.summary.last_success_at)}
        />
        <SummaryCard
          label="Running now"
          value={doc.summary.running_jobs.toLocaleString()}
          hint={`${doc.summary.pending_jobs.toLocaleString()} waiting in queue`}
        />
        <SummaryCard
          label="Failed needs attention"
          value={doc.summary.failed_jobs.toLocaleString()}
          tone={doc.summary.failed_jobs > 0 ? "danger" : "neutral"}
          hint={doc.summary.failed_jobs > 0 ? "Retry after checking the error" : "No failed queue jobs"}
        />
        <SummaryCard
          label="Next scheduled run"
          value={formatRelative(doc.summary.next_scheduled_at, now)}
          hint={`${doc.summary.enabled_schedules.toLocaleString()} timers enabled`}
        />
      </section>

      {evidence ? <EvidenceHealth summary={evidence} /> : null}

      <AdminSection
        title="Live monitor"
        description="Current and queued scraper runs. This updates automatically while the VPS worker is running."
      >
        {activeJobs.length === 0 ? (
          <div className="rounded-md border border-line bg-subtle p-4">
            <p className="text-base font-semibold text-ink">No scraper is running right now.</p>
            <p className="mt-1 text-base text-ink-2">
              Click Run now on a source card. Within about one minute, this panel will show the VPS
              worker pickup, elapsed time, counters, and latest events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeJobs.map((job) => (
              <LiveJobCard key={job.id} job={job} now={now} />
            ))}
          </div>
        )}
      </AdminSection>

      {GROUP_ORDER.map((group) => {
        const items = SCRAPER_CATALOG.filter((scraper) => scraper.group === group);
        return (
          <AdminSection key={group} title={SCRAPER_GROUP_LABELS[group]} description={groupDescription(group)}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((scraper) => (
                <ScraperCard
                  key={scraper.code}
                  scraper={scraper}
                  state={stateByCode.get(scraper.code) ?? null}
                  evidence={evidenceByScraper?.[scraper.code] ?? null}
                  now={now}
                />
              ))}
            </div>
          </AdminSection>
        );
      })}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentJobs jobs={doc.recent_jobs} now={now} />
        <RecentRuns runs={doc.recent_runs} now={now} />
      </div>
    </AdminColumn>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line p-4">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={cn("text-xl font-semibold tracking-tight", tone === "danger" ? "text-danger" : "text-ink")}>{value}</p>
      <p className="text-sm text-ink-3">{hint}</p>
    </div>
  );
}

/**
 * Evidence health across every source.
 *
 * Placed above the live monitor because it answers the question a run report
 * cannot: a scraper can succeed every night while the pages it cited quietly
 * stop saying what we stored. "Updated 4,288 records" and "4,288 citations still
 * check out" are different claims, and only the second is what a buyer relies on.
 */
function EvidenceHealth({ summary }: { summary: EvidenceSummary }) {
  const { documents, claims, credits, monitors } = summary;
  const needsReview = claims.needs_review;
  const share = verifiedShare(summary);

  return (
    <AdminSection
      title="Evidence health"
      description="Every stored fact carries a link, a locator and a verbatim excerpt. These counts are how many of those citations still hold up against the live page."
      actions={
        needsReview > 0 ? (
          <ButtonLink href="/admin/evidence">Review {needsReview.toLocaleString()} claims</ButtonLink>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Citations confirmed"
            value={claims.active.toLocaleString()}
            hint={`of ${claims.total.toLocaleString()} total · ${claims.confirmed_last_7d.toLocaleString()} rechecked in 7d`}
          />
          <SummaryCard
            label="Needs review"
            value={needsReview.toLocaleString()}
            tone={needsReview > 0 ? "danger" : "neutral"}
            hint={
              needsReview > 0
                ? `${claims.stale.toLocaleString()} value changed · ${claims.orphaned.toLocaleString()} link gone`
                : "No drifted or dead citations"
            }
          />
          <SummaryCard
            label="Pages checked in 7d"
            value={`${share}%`}
            tone={share < 40 ? "danger" : "neutral"}
            hint={
              documents.unverified > 0
                ? `${documents.unverified.toLocaleString()} never verified`
                : `${documents.total.toLocaleString()} documents tracked`
            }
          />
          <SummaryCard
            label="Firecrawl credits (month)"
            value={formatCredits(credits.month_to_date)}
            hint={`${formatCredits(credits.last_24h)} in the last 24h · ${formatCredits(credits.last_30d)} rolling 30d`}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-subtle p-3 text-base sm:grid-cols-4">
          <Metric label="Live pages" value={documents.live.toLocaleString()} />
          <Metric label="Changed" value={documents.changed.toLocaleString()} />
          <Metric label="Dead" value={documents.dead.toLocaleString()} />
          <Metric
            label="Monitors"
            value={
              monitors.total === 0
                ? "None registered"
                : `${monitors.enabled}/${monitors.total} on`
            }
          />
        </dl>

        {monitors.total === 0 ? (
          <p className="text-base text-caution">
            No index-page monitors are registered, so a source restructuring will not be
            noticed until the next verification sweep. Run <span className="font-mono">refresh_monitors</span>.
          </p>
        ) : null}
        {monitors.pending_webhook_events > 0 ? (
          <p className="text-base text-ink-3">
            {monitors.pending_webhook_events.toLocaleString()} monitor notifications waiting to be
            processed by the VPS worker.
          </p>
        ) : null}
        {documents.oldest_unverified_at ? (
          <p className="text-base text-ink-3">
            Oldest never-verified page was captured{" "}
            {formatAdminDateTime(documents.oldest_unverified_at)} UTC.
          </p>
        ) : null}
      </div>
    </AdminSection>
  );
}

function TransportTag({ transport }: { transport: ScraperTransport }) {
  // Not decoration: the transport is what an operator needs to know before
  // acting on a failure. Firecrawl failing may be a vendor outage or an
  // exhausted credit balance; direct failing is the publisher blocking us; file
  // failing means nobody has staged a fresh extract.
  return <TypeChip>{SCRAPER_TRANSPORT_LABELS[transport]}</TypeChip>;
}

function ScraperCard({
  scraper,
  state,
  evidence,
  now,
}: {
  scraper: ScraperCatalogItem;
  state: ScraperState | null;
  evidence: EvidenceByScraperRow | null;
  now: number;
}) {
  const latest = state?.latest_run ?? null;
  const activeJob = state?.active_job ?? null;
  const schedule = state?.schedule ?? null;
  const stale = isStale(state?.last_success_at ?? null, scraper.suggestedIntervalMinutes, now);
  const statusTone = latestStatusTone(latest, activeJob, stale);
  const transport = scraperTransport(scraper.code);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-md font-semibold text-ink">{scraper.label}</h3>
          <p className="font-mono text-sm text-ink-3">{scraper.code}</p>
        </div>
        <StatusChip tone={statusTone.alert ? "danger" : "plain"}>{statusTone.label}</StatusChip>
      </div>

      <div className="flex flex-wrap gap-2">
        {transport ? <TransportTag transport={transport} /> : null}
        {scraper.sourceTier === "—" ? null : <TypeChip>{scraper.sourceTier}</TypeChip>}
        {scraper.risk === "low" ? (
          <TypeChip>{scraper.risk} risk</TypeChip>
        ) : (
          <StatusChip tone={scraper.risk === "high" ? "danger" : "caution"}>{scraper.risk} risk</StatusChip>
        )}
        <TypeChip>{schedule?.enabled ? `timer ${formatInterval(schedule.interval_minutes)}` : "timer off"}</TypeChip>
      </div>

      <div className="flex flex-col gap-2 text-base text-ink-2">
        <p>{scraper.updates}</p>
        <p className="text-sm text-ink-3">{scraper.operatorNote}</p>
      </div>

      {evidence && evidence.documents > 0 ? <EvidenceStrip row={evidence} /> : null}

      <div className="rounded-md border border-line bg-subtle p-3">
        <p className="text-base font-semibold text-ink">
          {activeJob ? activeJobReport(activeJob, now) : plainRunReport(latest)}
        </p>
        {activeJob ? <ProgressBars job={activeJob} /> : null}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-base">
          <Metric label="Last success" value={formatRelative(state?.last_success_at ?? null, now)} />
          <Metric label="Next timer" value={formatRelative(schedule?.next_run_at ?? null, now)} />
          <Metric label="Pending" value={String(state?.queue.pending ?? 0)} />
          <Metric label="Running" value={String(state?.queue.running ?? 0)} />
        </dl>
        {latest?.error ? <p className="mt-2 line-clamp-2 text-sm text-danger">{latest.error}</p> : null}
      </div>

      <div className="mt-auto">
        <AdminScraperActions
          scraperCode={scraper.code}
          suggestedIntervalMinutes={scraper.suggestedIntervalMinutes}
          enabled={schedule?.enabled ?? false}
          intervalMinutes={schedule?.interval_minutes ?? null}
        />
      </div>
    </div>
  );
}

/** Per-source citation health and credit spend, on the source's own card. */
function EvidenceStrip({ row }: { row: EvidenceByScraperRow }) {
  const problems = row.claims_needing_review;
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-3">Citations</p>
        {problems > 0 ? (
          <StatusChip tone="danger">{problems.toLocaleString()} need review</StatusChip>
        ) : (
          <TypeChip>all confirmed</TypeChip>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-base sm:grid-cols-4">
        <Metric label="Claims" value={row.claims.toLocaleString()} />
        <Metric label="Pages" value={row.documents.toLocaleString()} />
        <Metric label="Unchecked" value={row.unverified_documents.toLocaleString()} />
        <Metric
          label="Credits (mo)"
          // A direct or file source spends nothing, and a zero there means
          // "not applicable" rather than "cheap this month".
          value={row.adapter === "firecrawl" ? formatCredits(row.credits_month) : "—"}
        />
      </dl>
    </div>
  );
}

function LiveJobCard({ job, now }: { job: QueueJob; now: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold text-ink">{humanizeCode(job.scraper_code)}</h3>
          <p className="font-mono text-sm text-ink-3">
            {job.scraper_code} · attempt {job.attempts}
          </p>
        </div>
        <JobStatusTag status={job.status} />
      </div>
      <div className="rounded-md border border-line bg-subtle p-3">
        <p className="text-base font-semibold text-ink">{activeJobReport(job, now)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-base sm:grid-cols-4">
          <Metric label="Queued" value={formatRelative(job.requested_at, now)} />
          <Metric label="Elapsed" value={formatElapsed(job.started_at ?? job.requested_at, now)} />
          <Metric label="Heartbeat" value={formatRelative(job.heartbeat_at, now)} />
          <Metric label="Run id" value={job.etl_run_id ? job.etl_run_id.slice(0, 8) : "Not started"} />
        </dl>
        <ProgressBars job={job} />
      </div>
      <EventTimeline events={job.events} now={now} />
    </div>
  );
}

function ProgressBars({ job }: { job: QueueJob }) {
  const max = Math.max(job.progress_seen, job.progress_upserted, job.progress_skipped, job.progress_matched, 1);
  return (
    <div className="mt-3 flex flex-col gap-2">
      {job.status === "running" && job.progress_seen === 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-sunken">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
        </div>
      ) : null}
      <Bar label="Seen" value={job.progress_seen} max={max} tone="bg-brand" />
      <Bar label="Updated" value={job.progress_upserted} max={max} tone="bg-ink-2" />
      <Bar label="Skipped" value={job.progress_skipped} max={max} tone="bg-caution-icon" />
      {job.progress_matched > 0 ? (
        <Bar label="Matches" value={job.progress_matched} max={max} tone="bg-danger" />
      ) : null}
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = `${Math.max(3, Math.round((value / max) * 100))}%`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-3">
        <span>{label}</span>
        <span className="font-mono">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${tone}`} style={{ width }} />
      </div>
    </div>
  );
}

function EventTimeline({ events, now }: { events: EtlJobEvent[]; now: number }) {
  if (events.length === 0) {
    return <p className="text-base text-ink-3">No events yet. Waiting for the VPS worker.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink-3">Run timeline</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {events.slice(0, 6).map((event) => (
          <li key={event.id} className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
            <div className="min-w-0">
              <p className="text-base font-medium text-ink">{event.message}</p>
              <p className="font-mono text-xs text-ink-3">
                {event.event_type} · {formatRelative(event.created_at, now)}
                {event.records_seen > 0 ? ` · seen ${event.records_seen.toLocaleString()}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecentJobs({ jobs, now }: { jobs: QueueJob[]; now: number }) {
  return (
    <AdminSection
      title="Recent queue jobs"
      description="Button clicks and timer-created jobs. Failed jobs can be retried here."
      flush
    >
      {jobs.length === 0 ? (
        <p className="p-4 text-base text-ink-3">No scraper jobs have been queued yet.</p>
      ) : (
        <AdminRows>
          {jobs.slice(0, 12).map((job) => (
            <AdminRow key={job.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold text-ink">{job.scraper_code}</span>
                  <JobStatusTag status={job.status} />
                  <span className="font-mono text-xs text-ink-3">
                    {job.status === "running"
                      ? `elapsed ${formatElapsed(job.started_at ?? job.requested_at, now)}`
                      : `attempt ${job.attempts}`}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-3">
                  {job.progress_message ?? `requested ${formatAdminDateTime(job.requested_at)}`}
                  {job.error ? <> - {job.error}</> : null}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {job.status === "pending" ? (
                  <AdminScraperJobAction jobId={job.id} action="cancel" />
                ) : null}
                {job.status === "failed" || job.status === "cancelled" ? (
                  <AdminScraperJobAction jobId={job.id} action="retry" />
                ) : null}
                {isStaleRunningJob(job, now) ? (
                  <>
                    <AdminScraperJobAction jobId={job.id} action="retry" label="Retry (stale)" />
                    <AdminScraperJobAction jobId={job.id} action="cancel" label="Cancel (stale)" />
                  </>
                ) : null}
              </div>
            </AdminRow>
          ))}
        </AdminRows>
      )}
    </AdminSection>
  );
}

function RecentRuns({ runs, now }: { runs: EtlRun[]; now: number }) {
  return (
    <AdminSection title="Recent scraper reports" description="Completed run results from public.etl_runs." flush>
      {runs.length === 0 ? (
        <p className="p-4 text-base text-ink-3">No ETL run reports yet.</p>
      ) : (
        <AdminRows>
          {runs.slice(0, 12).map((run) => (
            <AdminRow key={run.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold text-ink">{run.scraper_code}</span>
                  <RunStatusTag status={run.status} />
                  {matchedSuppliers(run.meta) > 0 ? (
                    <StatusChip tone="caution">{matchedSuppliers(run.meta)} sanctions matches</StatusChip>
                  ) : null}
                </div>
                <p className="mt-1 text-base text-ink-2">{plainRunReport(run)}</p>
                {run.error ? <p className="mt-1 text-sm text-danger">{run.error}</p> : null}
              </div>
              <p className="shrink-0 font-mono text-xs text-ink-3">
                {run.finished_at ? formatElapsed(run.started_at, new Date(run.finished_at).getTime()) : formatRelative(run.started_at, now)}
              </p>
            </AdminRow>
          ))}
        </AdminRows>
      )}
    </AdminSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}

function RunStatusTag({ status }: { status: RunStatus }) {
  if (status === "success") return <TypeChip>success</TypeChip>;
  if (status === "running") return <TypeChip>running</TypeChip>;
  if (status === "partial") return <StatusChip tone="caution">partial</StatusChip>;
  return <StatusChip tone="danger">failed</StatusChip>;
}

function JobStatusTag({ status }: { status: JobStatus }) {
  if (status === "success") return <TypeChip>success</TypeChip>;
  if (status === "running" || status === "pending") return <TypeChip>{status}</TypeChip>;
  if (status === "cancelled") return <TypeChip>cancelled</TypeChip>;
  return <StatusChip tone="danger">failed</StatusChip>;
}

function latestStatusTone(
  latest: EtlRun | null,
  activeJob: QueueJob | null,
  stale: boolean,
): { label: string; alert: boolean } {
  if (activeJob?.status === "running") return { label: "live", alert: false };
  if (activeJob?.status === "pending") return { label: "queued", alert: false };
  if (!latest) return { label: "not run", alert: false };
  if (latest.status === "failed") return { label: "needs action", alert: true };
  if (latest.status === "running") return { label: "running", alert: false };
  if (stale) return { label: "stale", alert: true };
  return { label: "healthy", alert: false };
}

function activeJobReport(job: QueueJob, now: number): string {
  if (job.status === "pending") {
    return "Queued. The VPS worker should start it within about one minute.";
  }
  const heartbeatAge = job.heartbeat_at ? Date.now() - new Date(job.heartbeat_at).getTime() : null;
  if (heartbeatAge != null && heartbeatAge > 5 * 60 * 1000) {
    return "Running, but heartbeat is older than 5 minutes. Check VPS worker if this stays unchanged.";
  }
  if (job.progress_message) return job.progress_message;
  return `Running for ${formatElapsed(job.started_at ?? job.requested_at, now)}. No action needed.`;
}

function plainRunReport(run: EtlRun | null): string {
  if (!run) return "No run recorded yet. Use Run now or enable a timer.";
  if (run.status === "running") return `Running since ${formatAdminDateTime(run.started_at)}.`;
  if (run.status === "failed") return "Failed. Open the error, then retry after the source is reachable.";
  const matched = matchedSuppliers(run.meta);
  const matchedText = matched > 0 ? ` ${matched} sanctions matches need review.` : "";
  if (run.records_upserted === 0) {
    return `No new rows found after checking ${run.records_seen.toLocaleString()} records.${matchedText}`;
  }
  return `Updated ${run.records_upserted.toLocaleString()} records from ${run.records_seen.toLocaleString()} seen; skipped ${run.records_skipped.toLocaleString()}.${matchedText}`;
}

function matchedSuppliers(meta: Record<string, unknown> | null): number {
  const value = meta?.matched_suppliers;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatRelative(value: string | null, now: number): string {
  if (!value) return "Not set";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Unknown";
  const diffMs = now - time;
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);
  if (minutes < 1) return future ? "in seconds" : "just now";
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days} d` : `${days} d ago`;
}

function formatElapsed(start: string | null, now: number): string {
  if (!start) return "Not started";
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return "Unknown";
  const totalSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function isStale(lastSuccessAt: string | null, suggestedIntervalMinutes: number, now: number): boolean {
  if (!lastSuccessAt) return true;
  const time = new Date(lastSuccessAt).getTime();
  if (!Number.isFinite(time)) return true;
  const staleAfterMs = suggestedIntervalMinutes * 2 * 60 * 1000;
  return now - time > staleAfterMs;
}

function groupDescription(group: ScraperGroup): string {
  switch (group) {
    case "registries":
      return "Official registry and association sources that keep supplier identities current.";
    case "rsc":
      return "Tier 1 safety and compliance sources, including document mirrors.";
    case "certifications":
      return "Certification bodies that enrich supplier compliance evidence.";
    case "sanctions":
      return "High-risk forced-labor and sanctions checks. Review failures quickly.";
    case "brands":
      return "Brand disclosure lists used as supporting evidence only.";
    case "maintenance":
      return "Jobs that keep the citations honest. They ingest nothing, so their run reports count checks rather than records.";
  }
}

function humanizeCode(code: string): string {
  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBgmea\b/g, "BGMEA")
    .replace(/\bBkmea\b/g, "BKMEA")
    .replace(/\bBgapmea\b/g, "BGAPMEA")
    .replace(/\bRsc\b/g, "RSC")
    .replace(/\bOeko Tex\b/g, "OEKO-TEX")
    .replace(/\bGots\b/g, "GOTS")
    .replace(/\bSa8000\b/g, "SA8000")
    .replace(/\bUflpa\b/g, "UFLPA")
    .replace(/\bOfac\b/g, "OFAC");
}
