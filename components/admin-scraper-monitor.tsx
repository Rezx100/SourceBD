"use client";

// /admin/sources as one screen: what needs the founder, six figures, what is running,
// then every source in one grouped table. A row opens the source's detail in a drawer.

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  AdminColumn,
  AdminHead,
  AdminRow,
  AdminRows,
  StatusChip,
  formatAdminDateTime,
} from "@/components/admin/data-ui";
import {
  AdminScraperActions,
  AdminScraperJobAction,
  RunNowButton,
  TimerControl,
} from "@/components/admin-scraper-actions";
import { ButtonLink, Drawer, TypeChip } from "@/components/kit";
import {
  SCRAPER_CATALOG,
  SCRAPER_TRANSPORT_LABELS,
  scraperTransport,
  type ScraperCatalogItem,
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
import { freshnessLines, type FreshnessDoc, type FreshnessLine, type FreshnessRow } from "@/lib/admin/source-freshness";
import {
  SOURCE_GROUPS,
  breakerOf,
  failedLastDay,
  needsYou,
  sourceGroup,
  type Need,
} from "@/lib/admin/source-needs";
import { cn } from "@/lib/utils";

const CREDIT_CEILING = 1500;

export function AdminScraperMonitor({
  initialDoc,
  evidence = null,
  evidenceByScraper = null,
  freshness = null,
  nearMatches = null,
}: {
  initialDoc: DashboardDoc;
  evidence?: EvidenceSummary | null;
  evidenceByScraper?: EvidenceByScraper | null;
  /** admin_source_freshness() (0123); null when it could not be read. */
  freshness?: FreshnessDoc | null;
  /** Open near-match records in /admin/queue; null when the count could not be read. */
  nearMatches?: number | null;
}) {
  const [doc, setDoc] = useState(initialDoc);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [openCode, setOpenCode] = useState<string | null>(null);

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

  const stateByCode = useMemo(() => new Map(doc.scrapers.map((s) => [s.scraper_code, s])), [doc.scrapers]);
  const freshByCode = useMemo(() => new Map((freshness?.rows ?? []).map((r) => [r.scraper_code, r])), [freshness]);
  const linesByCode = useMemo(
    () => new Map(freshness ? freshnessLines(freshness).map((l) => [l.code, l]) : []),
    [freshness],
  );
  const needs = needsYou(doc, freshness, nearMatches);
  const activeJobs = doc.recent_jobs.filter((job) => job.status === "running" || job.status === "pending");
  const open = openCode ? SCRAPER_CATALOG.find((s) => s.code === openCode) ?? null : null;

  return (
    <AdminColumn>
      <AdminHead
        title="Sources & ingestion"
        lede="What needs you, what is running, and every source with its timer and Run now."
        actions={
          <div className="text-right font-mono text-xs text-ink-3">
            <p>auto-refresh {hasLiveWork ? "3s" : "15s"}</p>
            <p>generated {formatAdminDateTime(doc.generated_at)} UTC</p>
            {error ? <p className="text-danger">status: {error}</p> : null}
          </div>
        }
      />

      <NeedsYou needs={needs} onOpen={setOpenCode} />

      <StatTiles doc={doc} freshness={freshness} evidence={evidence} now={now} />

      <LiveRuns jobs={activeJobs} next={doc.summary.next_scheduled_at} now={now} onOpen={setOpenCode} />

      <SourcesTable
        stateByCode={stateByCode}
        freshByCode={freshByCode}
        linesByCode={linesByCode}
        now={now}
        onOpen={setOpenCode}
      />

      <RunHistory jobs={doc.recent_jobs} runs={doc.recent_runs} now={now} />

      <Drawer open={open != null} onOpenChange={(o) => { if (!o) setOpenCode(null); }} title={open?.label ?? ""}>
        {open ? (
          <SourceDetail
            scraper={open}
            state={stateByCode.get(open.code) ?? null}
            fresh={freshByCode.get(open.code) ?? null}
            line={linesByCode.get(open.code) ?? null}
            evidence={evidenceByScraper?.[open.code] ?? null}
            jobs={doc.recent_jobs.filter((j) => j.scraper_code === open.code)}
            now={now}
          />
        ) : null}
      </Drawer>
    </AdminColumn>
  );
}

/* ------------------------------------------------------------- needs you */

function NeedsYou({ needs, onOpen }: { needs: Need[]; onOpen: (code: string) => void }) {
  if (needs.length === 0) {
    return (
      <section aria-label="Needs you" className="flex items-center gap-2 rounded-lg border border-line px-4 py-3">
        <Dot tone="ok" />
        <p className="text-base text-ink-2">Nothing needs you. No run is held or failed, and every switched-on source is inside its limit.</p>
      </section>
    );
  }
  return (
    <section aria-label="Needs you" className="overflow-clip rounded-lg border border-danger/40">
      <h2 className="flex items-center gap-2 border-b border-line bg-danger-tint px-4 py-2 text-base font-semibold text-ink">
        Needs you <span className="font-normal text-ink-3">· {needs.length}</span>
      </h2>
      <ul className="sm:max-h-72 sm:overflow-auto">
        {needs.map((need, i) => (
          <li
            key={`${need.kind}-${need.code}-${i}`}
            className="flex flex-col gap-2 border-b border-line px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 items-start gap-2">
              <Dot tone={need.kind === "over_limit" || need.kind === "near_match" ? "caution" : "danger"} className="mt-1.5" />
              <p className="min-w-0 text-base text-ink">
                <span className="mr-1.5 text-sm font-medium text-ink-3">{NEED_LABEL[need.kind]}</span>
                {need.code ? (
                  <button type="button" onClick={() => onOpen(need.code!)} className="text-left underline-offset-2 hover:underline">
                    {need.text}
                  </button>
                ) : (
                  need.text
                )}
              </p>
            </div>
            <div className="flex shrink-0 justify-end">
              {need.command ? <CopyCommand command={need.command} /> : null}
              {need.action === "run" && need.code ? <RunNowButton scraperCode={need.code} kind="secondary" /> : null}
              {need.action === "queue" ? (
                <ButtonLink href="/admin/queue?type=fuzzy_match_review">Open the queue</ButtonLink>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NEED_LABEL: Record<Need["kind"], string> = {
  held: "Held",
  delistings: "Removals held",
  partial: "Incomplete",
  failed: "Failed",
  over_limit: "Too old",
  near_match: "Near matches",
};

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  return (
    <span className="flex min-w-0 max-w-full items-stretch overflow-hidden rounded-sm border border-line">
      <code className="min-w-0 bg-subtle sm:overflow-x-auto sm:whitespace-nowrap px-2 py-1.5 font-mono text-xs text-ink">{command}</code>
      <button
        type="button"
        className="shrink-0 border-l border-line px-2.5 text-sm font-medium text-ink hover:bg-sunken"
        onClick={() => {
          // A refused write says so: the founder must not paste a stale command on the server.
          const done = (ok: "yes" | "no") => {
            setCopied(ok);
            window.setTimeout(() => setCopied(null), 2000);
          };
          if (!navigator.clipboard) return done("no");
          navigator.clipboard.writeText(command).then(() => done("yes"), () => done("no"));
        }}
      >
        {copied === "yes" ? "Copied" : copied === "no" ? "Select and copy" : "Copy"}
      </button>
    </span>
  );
}

/* ----------------------------------------------------------------- tiles */

function StatTiles({
  doc,
  freshness,
  evidence,
  now,
}: {
  doc: DashboardDoc;
  freshness: FreshnessDoc | null;
  evidence: EvidenceSummary | null;
  now: number;
}) {
  const s = doc.summary;
  const over = freshness?.rows.filter((r) => r.over_sla === true) ?? [];
  const overOn = over.filter((r) => r.enabled).length;
  const failed = failedLastDay(doc, freshness, now);
  const credits = freshness?.credits_month ?? evidence?.credits.month_to_date ?? null;
  const ceiling = freshness?.credits_ceiling ?? CREDIT_CEILING;
  const review = evidence?.claims.needs_review ?? 0;
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-px overflow-clip rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-7">
      <Tile label="Running · queued" value={`${s.running_jobs} · ${s.pending_jobs}`} hint={s.running_jobs + s.pending_jobs ? "see live runs" : "nothing in flight"} />
      <Tile label="Failed, last 24 h" value={String(failed)} tone={failed ? "danger" : undefined} hint={`${s.failed_jobs} failed in the queue`} />
      <Tile
        label="Over age limit"
        value={freshness ? String(over.length) : "?"}
        tone={overOn ? "danger" : over.length ? "caution" : undefined}
        hint={freshness ? (over.length ? `${overOn} switched on` : "all inside their limit") : "freshness unreadable"}
      />
      <Tile label="Timers on" value={`${s.enabled_schedules} of ${SCRAPER_CATALOG.length}`} hint={`next ${formatRelative(s.next_scheduled_at, now)}`} />
      <Tile
        label="Firecrawl credits"
        value={credits == null ? "?" : `${formatCredits(credits)} / ${ceiling.toLocaleString("en-GB")}`}
        tone={credits != null && credits >= ceiling * 0.8 ? "caution" : undefined}
        hint="this month"
      />
      <Tile label="Last good read" value={formatRelative(s.last_success_at, now)} hint={formatAdminDateTime(s.last_success_at)} />
      {evidence ? (
        <Tile
          label="Citations to review"
          value={review.toLocaleString("en-GB")}
          tone={review ? "caution" : undefined}
          hint={`${verifiedShare(evidence)}% checked in 7d`}
          href={review ? "/admin/evidence" : undefined}
        />
      ) : (
        <Tile label="Citations" value="?" hint="evidence unreadable" />
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "danger" | "caution";
  href?: string;
}) {
  const body = (
    <>
      <span className="text-sm text-ink-3">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums tracking-tight", tone === "danger" ? "text-danger" : tone === "caution" ? "text-caution" : "text-ink")}>
        {value}
      </span>
      <span className="truncate text-xs text-ink-3">{hint}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-0.5 bg-surface px-3 py-2.5";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-subtle")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------------------------------------- live runs */

function LiveRuns({
  jobs,
  next,
  now,
  onOpen,
}: {
  jobs: QueueJob[];
  next: string | null;
  now: number;
  onOpen: (code: string) => void;
}) {
  if (jobs.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-base text-ink-3">
        <Dot tone="quiet" />
        Nothing running. Next timer {formatRelative(next, now)}.
      </p>
    );
  }
  return (
    <section aria-label="Live runs" className="overflow-clip rounded-lg border border-line">
      <h2 className="border-b border-line bg-subtle px-4 py-2 text-sm font-semibold text-ink">Live runs</h2>
      <ul>
        {jobs.map((job) => {
          const latest = job.events[0];
          return (
            <li key={job.id} className="grid grid-cols-1 gap-1 border-b border-line px-4 py-2 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-4">
              <button type="button" onClick={() => onOpen(job.scraper_code)} className="flex items-center gap-2 text-left">
                <Dot tone={job.status === "running" ? "live" : "quiet"} />
                <span className="font-mono text-sm font-semibold text-ink">{job.scraper_code}</span>
                <span className="text-xs text-ink-3">{job.status === "running" ? formatElapsed(job.started_at ?? job.requested_at, now) : "queued"}</span>
              </button>
              <span className="font-mono text-xs text-ink-3">
                {job.progress_seen.toLocaleString()} seen · {job.progress_upserted.toLocaleString()} changed · {job.progress_skipped.toLocaleString()} skipped
              </span>
              <p className="truncate text-sm text-ink-2">{latest ? `${latest.message} · ${formatRelative(latest.created_at, now)}` : activeJobReport(job, now)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- sources table */

type Health = { label: string; tone: DotTone };

function health(state: ScraperState | null, fresh: FreshnessRow | null, scraper: ScraperCatalogItem, now: number): Health {
  const job = state?.active_job;
  const latest = state?.latest_run ?? null;
  if (job?.status === "running") return { label: "running", tone: "live" };
  if (job?.status === "pending") return { label: "queued", tone: "quiet" };
  if (latest?.status === "held") return { label: "held", tone: "danger" };
  if (latest?.status === "failed") return { label: "failed", tone: "danger" };
  if (fresh?.over_sla === true) return fresh.enabled ? { label: "too old", tone: "danger" } : { label: "too old, off", tone: "caution" };
  if (!latest) return { label: "not run", tone: "quiet" };
  if (!fresh && isStale(state?.last_success_at ?? null, scraper.suggestedIntervalMinutes, now)) return { label: "stale", tone: "caution" };
  if (latest.status === "partial") return { label: "partial", tone: "caution" };
  return { label: "healthy", tone: "ok" };
}

function SourcesTable({
  stateByCode,
  freshByCode,
  linesByCode,
  now,
  onOpen,
}: {
  stateByCode: Map<string, ScraperState>;
  freshByCode: Map<string, FreshnessRow>;
  linesByCode: Map<string, FreshnessLine>;
  now: number;
  onOpen: (code: string) => void;
}) {
  return (
    <section aria-label="Sources" className="overflow-clip rounded-lg border border-line">
      <table className="w-full border-separate border-spacing-0 text-left text-base">
        <thead className="hidden md:table-header-group">
          <tr className="text-xs text-ink-3">
            {["Source", "Health", "Age", "Timer", "Last run", ""].map((h, i) => (
              <th key={i} scope="col" className={cn("border-b border-line bg-subtle px-3 py-2 font-medium", i === 5 && "text-right")}>
                {h || <span className="sr-only">Action</span>}
              </th>
            ))}
          </tr>
        </thead>
        {SOURCE_GROUPS.map((group) => {
          const items = SCRAPER_CATALOG.filter((s) => sourceGroup(s.group) === group.id);
          if (items.length === 0) return null;
          return (
            <tbody key={group.id}>
              <tr>
                <th scope="colgroup" colSpan={6} className="border-b border-line bg-sunken px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-2">
                  {group.label} <span className="font-normal normal-case tracking-normal text-ink-3">· {items.length}</span>
                </th>
              </tr>
              {items.map((scraper) => (
                <SourceRow
                  key={scraper.code}
                  scraper={scraper}
                  state={stateByCode.get(scraper.code) ?? null}
                  fresh={freshByCode.get(scraper.code) ?? null}
                  line={linesByCode.get(scraper.code) ?? null}
                  now={now}
                  onOpen={onOpen}
                />
              ))}
            </tbody>
          );
        })}
      </table>
    </section>
  );
}

function SourceRow({
  scraper,
  state,
  fresh,
  line,
  now,
  onOpen,
}: {
  scraper: ScraperCatalogItem;
  state: ScraperState | null;
  fresh: FreshnessRow | null;
  line: FreshnessLine | null;
  now: number;
  onOpen: (code: string) => void;
}) {
  const h = health(state, fresh, scraper, now);
  const latest = state?.latest_run ?? null;
  const schedule = state?.schedule ?? null;
  const age = line?.age ?? (state?.last_success_at ? `last good ${formatRelative(state.last_success_at, now)}` : "never read");
  const cell = "border-b border-line px-3 py-1.5 align-middle";
  return (
    <tr className="group cursor-pointer hover:bg-brand-wash" onClick={() => onOpen(scraper.code)}>
      <td className={cn(cell, "w-full md:w-auto")}>
        <button type="button" onClick={() => onOpen(scraper.code)} className="flex min-w-0 flex-col text-left">
          <span className="flex items-center gap-2">
            <Dot tone={h.tone} className="md:hidden" />
            <span className="font-medium text-ink group-hover:underline">{scraper.label}</span>
          </span>
          <span className="font-mono text-xs text-ink-3">{scraper.code}</span>
          <span className="text-xs text-ink-3 md:hidden">
            {h.label} · {age} · {line?.cadence ?? (schedule?.enabled ? "timer on" : "off")}
          </span>
        </button>
      </td>
      <td className={cn(cell, "hidden whitespace-nowrap md:table-cell")}>
        <span className={cn("inline-flex items-center gap-1.5 text-sm", h.tone === "danger" ? "text-danger" : h.tone === "caution" ? "text-caution" : "text-ink-2")}>
          <Dot tone={h.tone} />
          {h.label}
        </span>
      </td>
      <td className={cn(cell, "hidden text-sm md:table-cell", line?.tone === "danger" ? "text-danger" : line?.tone === "caution" ? "text-caution" : "text-ink-2")}>{age}</td>
      <td className={cn(cell, "hidden md:table-cell")} onClick={(e) => e.stopPropagation()}>
        <TimerControl
          key={`${schedule?.enabled}-${schedule?.interval_minutes}`}
          scraperCode={scraper.code}
          suggestedIntervalMinutes={scraper.suggestedIntervalMinutes}
          enabled={schedule?.enabled ?? false}
          intervalMinutes={schedule?.interval_minutes ?? null}
        />
      </td>
      <td className={cn(cell, "hidden text-sm text-ink-2 lg:table-cell")}>
        {latest ? (
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5">
              <RunStatusTag status={latest.status} small />
              <span className="text-xs text-ink-3">{formatRelative(latest.finished_at ?? latest.started_at, now)}</span>
            </span>
            <span className="font-mono text-xs text-ink-3">
              {latest.records_seen.toLocaleString()} seen · {latest.records_upserted.toLocaleString()} changed · {latest.records_skipped.toLocaleString()} skipped
            </span>
          </span>
        ) : (
          <span className="text-ink-3">no run yet</span>
        )}
      </td>
      <td className={cn(cell, "text-right")} onClick={(e) => e.stopPropagation()}>
        <RunNowButton scraperCode={scraper.code} kind="secondary" />
      </td>
    </tr>
  );
}

/* ----------------------------------------------------------- the drawer */

function SourceDetail({
  scraper,
  state,
  fresh,
  line,
  evidence,
  jobs,
  now,
}: {
  scraper: ScraperCatalogItem;
  state: ScraperState | null;
  fresh: FreshnessRow | null;
  line: FreshnessLine | null;
  evidence: EvidenceByScraperRow | null;
  jobs: QueueJob[];
  now: number;
}) {
  const latest = state?.latest_run ?? null;
  const schedule = state?.schedule ?? null;
  const transport = scraperTransport(scraper.code);
  const breaker = breakerOf(latest);
  const reconcile = latest?.meta?.reconcile as Record<string, Record<string, unknown>> | undefined;
  return (
    <div className="flex flex-col gap-5 px-5 pb-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm text-ink-3">{scraper.code}</p>
        <div className="flex flex-wrap gap-2">
          {transport ? <TypeChip>{SCRAPER_TRANSPORT_LABELS[transport]}</TypeChip> : null}
          {scraper.sourceTier === "—" ? null : <TypeChip>{scraper.sourceTier}</TypeChip>}
          {scraper.risk === "low" ? <TypeChip>low risk</TypeChip> : <StatusChip tone={scraper.risk === "high" ? "danger" : "caution"}>{scraper.risk} risk</StatusChip>}
        </div>
        <p className="text-base text-ink-2">{scraper.updates}</p>
        <p className="text-sm text-ink-3">{scraper.operatorNote}</p>
      </div>

      <AdminScraperActions
        key={`${schedule?.enabled}-${schedule?.interval_minutes}`}
        scraperCode={scraper.code}
        suggestedIntervalMinutes={scraper.suggestedIntervalMinutes}
        enabled={schedule?.enabled ?? false}
        intervalMinutes={schedule?.interval_minutes ?? null}
      />

      <Block title="Freshness">
        <dl className="grid grid-cols-2 gap-3 text-base">
          <Metric label="Age" value={line?.age ?? formatRelative(state?.last_success_at ?? null, now)} />
          <Metric label="Timer" value={line?.cadence ?? (schedule?.enabled ? "on" : "off")} />
          <Metric label="Next timer" value={formatRelative(schedule?.next_run_at ?? null, now)} />
          <Metric label="Credits this month" value={transport === "firecrawl" ? (fresh?.credits_month ?? 0).toLocaleString("en-GB") : "—"} />
        </dl>
        {[line?.failures, line?.breaker, line?.removed].filter(Boolean).map((w) => (
          <p key={w} className="mt-2 text-sm text-caution">{w}</p>
        ))}
      </Block>

      {state?.active_job ? (
        <Block title="Running now">
          <p className="text-base font-medium text-ink">{activeJobReport(state.active_job, now)}</p>
          <EventTimeline events={state.active_job.events} now={now} />
        </Block>
      ) : null}

      <Block title="Last five runs">
        {fresh?.last_runs.length ? (
          <ol className="flex flex-col">
            {fresh.last_runs.map((r) => (
              <li key={r.started_at} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                <span className="flex items-center gap-2">
                  <RunStatusTag status={r.status as RunStatus} small />
                  <span className="text-ink-3">{formatAdminDateTime(r.started_at)}</span>
                </span>
                <span className="font-mono text-xs text-ink-3">
                  {(r.seen ?? 0).toLocaleString()} · {(r.upserted ?? 0).toLocaleString()} · {(r.skipped ?? 0).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        ) : latest ? (
          <p className="text-base text-ink-2">{plainRunReport(latest)}</p>
        ) : (
          <p className="text-base text-ink-3">No run recorded yet.</p>
        )}
        {fresh?.last_runs.length ? <p className="mt-1 text-xs text-ink-3">seen · changed · skipped</p> : null}
        {latest?.error ? <p className="mt-2 break-words text-sm text-danger">{latest.error}</p> : null}
      </Block>

      {breaker ? (
        <Block title="Safety stop">
          <p className="text-base text-ink">Stopped: {breaker.tripped}.</p>
          {breaker.changed !== undefined ? (
            <p className="text-sm text-ink-3">{breaker.changed.toLocaleString()} changed and {(breaker.created ?? 0).toLocaleString()} new landed before the stop.</p>
          ) : null}
        </Block>
      ) : null}

      {reconcile && Object.keys(reconcile).length ? (
        <Block title="Removals check">
          {Object.entries(reconcile).map(([scheme, r]) => (
            <div key={scheme} className="mb-2 last:mb-0">
              <p className="text-base text-ink">
                <span className="font-medium">{scheme.toUpperCase()}</span> · {String(r.action ?? "?")}
                {typeof r.missing === "number" ? ` · ${r.missing.toLocaleString()} not seen` : ""}
              </p>
              {Array.isArray(r.missing_certificates) && r.missing_certificates.length ? (
                <p className="break-words font-mono text-xs text-ink-3">{(r.missing_certificates as string[]).slice(0, 8).join(", ")}</p>
              ) : null}
            </div>
          ))}
        </Block>
      ) : null}

      {evidence && evidence.documents > 0 ? (
        <Block title="Citations">
          <dl className="grid grid-cols-2 gap-3 text-base">
            <Metric label="Claims" value={evidence.claims.toLocaleString()} />
            <Metric label="Need review" value={evidence.claims_needing_review.toLocaleString()} />
            <Metric label="Pages" value={evidence.documents.toLocaleString()} />
            <Metric label="Never checked" value={evidence.unverified_documents.toLocaleString()} />
          </dl>
        </Block>
      ) : null}

      {jobs.length ? (
        <Block title="Queue jobs">
          <JobList jobs={jobs.slice(0, 6)} now={now} />
        </Block>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="mb-2 text-sm font-semibold text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------- run history */

function RunHistory({ jobs, runs, now }: { jobs: QueueJob[]; runs: EtlRun[]; now: number }) {
  const [code, setCode] = useState("");
  const codes = [...new Set([...jobs, ...runs].map((x) => x.scraper_code))].sort();
  const pick = <T extends { scraper_code: string }>(xs: T[]) => (code ? xs.filter((x) => x.scraper_code === code) : xs);
  return (
    <details className="group rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-base font-semibold text-ink">
        <span>Run history <span className="font-normal text-ink-3">· {jobs.length} jobs, {runs.length} reports</span></span>
        <span className="text-sm font-normal text-ink-3 group-open:hidden">Show</span>
        <span className="hidden text-sm font-normal text-ink-3 group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-line">
        <div className="flex items-center gap-2 px-4 py-2">
          <label htmlFor="history-source" className="text-sm text-ink-3">Source</label>
          <select id="history-source" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-sm">
            <option value="">All sources</option>
            {codes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 border-t border-line xl:grid-cols-2 xl:divide-x xl:divide-line">
          <div>
            <h3 className="border-b border-line bg-subtle px-4 py-1.5 text-sm font-semibold text-ink-2">Queue jobs</h3>
            {pick(jobs).length === 0 ? <p className="p-4 text-base text-ink-3">No scraper jobs have been queued yet.</p> : <JobList jobs={pick(jobs).slice(0, 20)} now={now} />}
          </div>
          <div>
            <h3 className="border-b border-line bg-subtle px-4 py-1.5 text-sm font-semibold text-ink-2">Run reports</h3>
            {pick(runs).length === 0 ? (
              <p className="p-4 text-base text-ink-3">No ETL run reports yet.</p>
            ) : (
              <AdminRows>
                {pick(runs).slice(0, 20).map((run) => (
                  <AdminRow key={run.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{run.scraper_code}</span>
                        <RunStatusTag status={run.status} />
                        {matchedSuppliers(run.meta) > 0 ? <StatusChip tone="caution">{matchedSuppliers(run.meta)} sanctions matches</StatusChip> : null}
                      </div>
                      <p className="mt-1 text-sm text-ink-2">{plainRunReport(run)}</p>
                      {run.error ? <p className="mt-1 text-sm text-danger">{run.error}</p> : null}
                    </div>
                    <p className="shrink-0 font-mono text-xs text-ink-3">
                      {run.finished_at ? formatElapsed(run.started_at, new Date(run.finished_at).getTime()) : formatRelative(run.started_at, now)}
                    </p>
                  </AdminRow>
                ))}
              </AdminRows>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function JobList({ jobs, now }: { jobs: QueueJob[]; now: number }) {
  return (
    <AdminRows>
      {jobs.map((job) => (
        <AdminRow key={job.id}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-ink">{job.scraper_code}</span>
              <JobStatusTag status={job.status} />
              <span className="font-mono text-xs text-ink-3">
                {job.status === "running" ? `elapsed ${formatElapsed(job.started_at ?? job.requested_at, now)}` : `attempt ${job.attempts}`}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-3">
              {job.progress_message ?? `requested ${formatAdminDateTime(job.requested_at)}`}
              {job.error ? <> - {job.error}</> : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {job.status === "pending" ? <AdminScraperJobAction jobId={job.id} action="cancel" /> : null}
            {job.status === "failed" || job.status === "cancelled" ? <AdminScraperJobAction jobId={job.id} action="retry" /> : null}
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
  );
}

/* ---------------------------------------------------------------- pieces */

type DotTone = "ok" | "live" | "caution" | "danger" | "quiet";

function Dot({ tone, className }: { tone: DotTone; className?: string }) {
  const color = { ok: "bg-brand", live: "bg-brand animate-pulse motion-reduce:animate-none", caution: "bg-caution-icon", danger: "bg-danger-solid", quiet: "bg-line-strong" }[tone];
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color, className)} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}

function EventTimeline({ events, now }: { events: EtlJobEvent[]; now: number }) {
  if (events.length === 0) return <p className="mt-2 text-sm text-ink-3">No events yet. Waiting for the VPS worker.</p>;
  return (
    <ol className="mt-2 flex flex-col gap-1.5">
      {events.slice(0, 6).map((event) => (
        <li key={event.id} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
          <p className="min-w-0 text-sm text-ink">
            {event.message} <span className="font-mono text-xs text-ink-3">· {formatRelative(event.created_at, now)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

function RunStatusTag({ status, small = false }: { status: RunStatus | string; small?: boolean }) {
  if (small) {
    const tone = status === "failed" || status === "held" ? "text-danger" : status === "partial" ? "text-caution" : "text-ink-2";
    return <span className={cn("text-sm font-medium", tone)}>{status}</span>;
  }
  if (status === "success" || status === "running") return <TypeChip>{status}</TypeChip>;
  if (status === "partial") return <StatusChip tone="caution">partial</StatusChip>;
  if (status === "held") return <StatusChip tone="danger">held</StatusChip>;
  return <StatusChip tone="danger">failed</StatusChip>;
}

function JobStatusTag({ status }: { status: JobStatus }) {
  if (status === "failed") return <StatusChip tone="danger">failed</StatusChip>;
  return <TypeChip>{status}</TypeChip>;
}

function activeJobReport(job: QueueJob, now: number): string {
  if (job.status === "pending") return "Queued. The VPS worker should start it within about one minute.";
  const heartbeatAge = job.heartbeat_at ? now - new Date(job.heartbeat_at).getTime() : null;
  if (heartbeatAge != null && heartbeatAge > 5 * 60 * 1000) {
    return "Running, but heartbeat is older than 5 minutes. Check VPS worker if this stays unchanged.";
  }
  if (job.progress_message) return job.progress_message;
  return `Running for ${formatElapsed(job.started_at ?? job.requested_at, now)}. No action needed.`;
}

function plainRunReport(run: EtlRun): string {
  if (run.status === "running") return `Running since ${formatAdminDateTime(run.started_at)}.`;
  if (run.status === "failed") return "Failed. Open the error, then retry after the source is reachable.";
  if (run.status === "held") return "Held at the safety limit; the rest waits for a release.";
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
  if (!value) return "not set";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "unknown";
  const diffMs = now - time;
  const future = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60000);
  if (minutes < 1) return future ? "in seconds" : "just now";
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days} d` : `${days} d ago`;
}

function formatElapsed(start: string | null, now: number): string {
  if (!start) return "not started";
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return "unknown";
  const totalSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function isStale(lastSuccessAt: string | null, suggestedIntervalMinutes: number, now: number): boolean {
  if (!lastSuccessAt) return true;
  const time = new Date(lastSuccessAt).getTime();
  return !Number.isFinite(time) || now - time > suggestedIntervalMinutes * 2 * 60 * 1000;
}
