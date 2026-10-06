// What on /admin/sources needs the founder, in the words and commands they act on.
// Pure, so the page test can pin each item and its release command. The commands are
// the ones in context/feature-specs/handoff-etl-freshness-golive.md ("What held means").

import type { DashboardDoc, EtlRun } from "./etl-monitoring";
import type { FreshnessDoc } from "./source-freshness";
import type { ScraperGroup } from "./etl-scrapers";

export type NeedKind = "held" | "delistings" | "partial" | "failed" | "over_limit" | "near_match";

export type Need = {
  kind: NeedKind;
  /** The source it belongs to; null for the near-match queue. */
  code: string | null;
  /** One plain sentence: what happened. */
  text: string;
  /** The server command that releases it, run from /opt/sourcebd. */
  command: string | null;
  /** In-app action: Run now on the source, or a link. */
  action: "run" | "queue" | null;
};

export const releaseCommand = (code: string, flag: "--accept-changes" | "--accept-delistings") =>
  `docker compose run --rm etl run ${code} ${flag}`;

type Reconcile = { action?: unknown; missing?: unknown };

/** meta.reconcile.<scheme or list>: one entry per certificate scheme or sanctions list. */
function reconciles(run: EtlRun): [string, Reconcile][] {
  const r = run.meta?.reconcile;
  return r && typeof r === "object" ? Object.entries(r as Record<string, Reconcile>) : [];
}

export function breakerOf(run: EtlRun | null): { tripped: string; changed?: number; created?: number } | null {
  const b = run?.meta?.circuit_breaker as { tripped?: unknown; changed?: unknown; created?: unknown } | undefined;
  if (!b || typeof b.tripped !== "string" || !b.tripped) return null;
  return {
    tripped: b.tripped,
    changed: typeof b.changed === "number" ? b.changed : undefined,
    created: typeof b.created === "number" ? b.created : undefined,
  };
}

const n = (v: number) => v.toLocaleString("en-GB");

/**
 * Held, then removals waiting, then incomplete reads, then failures, then sources past
 * their limit while switched on, then near-match records. Only each source's latest run
 * counts: a held run that a later read already released needs nothing.
 */
export function needsYou(doc: DashboardDoc, freshness: FreshnessDoc | null, nearMatches: number | null): Need[] {
  const out: Need[] = [];
  const latest = doc.scrapers.flatMap((s) => (s.latest_run && !s.active_job ? [s.latest_run] : []));

  for (const run of latest) {
    const code = run.scraper_code;
    const breaker = breakerOf(run);
    if (run.status === "held" || breaker) {
      const landed =
        breaker?.changed !== undefined && breaker.created !== undefined
          ? ` ${n(breaker.changed)} changed and ${n(breaker.created)} new landed; the rest waits.`
          : "";
      out.push({
        kind: "held",
        code,
        text: `${code} stopped at the safety limit (${breaker?.tripped ?? "change limit"}).${landed}`,
        command: releaseCommand(code, "--accept-changes"),
        action: null,
      });
    }
    for (const [scheme, r] of reconciles(run)) {
      const missing = typeof r.missing === "number" ? `${n(r.missing)} ` : "";
      if (r.action === "held") {
        out.push({
          kind: "delistings",
          code,
          text: `${code}: ${missing}${scheme.toUpperCase()} records not seen this read are waiting before they are marked no longer listed.`,
          command: releaseCommand(code, "--accept-delistings"),
          action: null,
        });
      } else if (r.action === "partial") {
        out.push({
          kind: "partial",
          code,
          text: `${code}: the ${scheme.toUpperCase()} read was incomplete, so nothing was marked. Read the run's error before running it again.`,
          command: null,
          action: null,
        });
      }
    }
    if (run.status === "failed") {
      out.push({
        kind: "failed",
        code,
        text: `${code} failed${run.error ? `: ${run.error}` : "."}`,
        command: null,
        action: "run",
      });
    }
  }

  for (const r of freshness?.rows ?? []) {
    if (r.over_sla === true && r.enabled && !out.some((x) => x.code === r.scraper_code)) {
      out.push({
        kind: "over_limit",
        code: r.scraper_code,
        text: `${r.scraper_code} is past its age limit${r.age_hours === null ? " and has never been read in full" : ` (${Math.round(r.age_hours)} h old, limit ${r.max_age_hours ?? "?"} h)`}.`,
        command: null,
        action: "run",
      });
    }
  }

  if (nearMatches && nearMatches > 0) {
    out.push({
      kind: "near_match",
      code: null,
      text: `${n(nearMatches)} near-match ${nearMatches === 1 ? "record is" : "records are"} waiting for a decision.`,
      command: null,
      action: "queue",
    });
  }

  const rank: NeedKind[] = ["held", "delistings", "partial", "failed", "over_limit", "near_match"];
  return out.sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind));
}

/** The five groups the founder scans by. */
export type SourceGroup = "sanctions" | "certificates" | "registers" | "brands" | "other";

export const SOURCE_GROUPS: { id: SourceGroup; label: string }[] = [
  { id: "sanctions", label: "Sanctions" },
  { id: "certificates", label: "Certificates" },
  { id: "registers", label: "Registers" },
  { id: "brands", label: "Brands" },
  { id: "other", label: "Other jobs" },
];

export function sourceGroup(group: ScraperGroup): SourceGroup {
  if (group === "sanctions") return "sanctions";
  if (group === "certifications") return "certificates";
  if (group === "registries" || group === "rsc") return "registers";
  if (group === "brands") return "brands";
  return "other";
}

/** Runs that failed in the last 24 hours, from each source's last five runs (or the recent list). */
export function failedLastDay(doc: DashboardDoc, freshness: FreshnessDoc | null, now: number): number {
  const since = now - 24 * 3600_000;
  const runs = freshness
    ? freshness.rows.flatMap((r) => r.last_runs)
    : doc.recent_runs.map((r) => ({ started_at: r.started_at, status: r.status }));
  return runs.filter((r) => r.status === "failed" && new Date(r.started_at).getTime() >= since).length;
}
