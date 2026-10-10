// What on /admin/sources needs the founder, in plain words, each with the one button
// that settles it. Pure, so the page test can pin each item. A release is a queued run
// carrying accept_changes / accept_delistings, which etl/jobs/scraper_queue.py honours
// from an admin; the founder never needs a server command (10 Oct 2026).

import type { DashboardDoc, EtlRun } from "./etl-monitoring";
import type { FreshnessDoc } from "./source-freshness";
import { SCRAPER_BY_CODE, type ScraperGroup } from "./etl-scrapers";

export type NeedKind = "held" | "delistings" | "partial" | "failed" | "over_limit" | "near_match";

export type Need = {
  kind: NeedKind;
  /** The source it belongs to; null for the near-match queue. */
  code: string | null;
  /** One plain sentence: what happened. */
  text: string;
  /** What to look at before pressing the button; null when there is nothing to check. */
  check: string | null;
  /** The button: let a paused read finish, mark removals, read again, or open the queue. */
  action: "release_changes" | "release_delistings" | "run" | "queue" | null;
};

/** The source's name as the founder knows it ("WRAP", "BGMEA web"). */
export const sourceLabel = (code: string) => SCRAPER_BY_CODE.get(code)?.label ?? code;

type Reconcile = { action?: unknown; missing?: unknown };

/** meta.reconcile.<scheme or list>: one entry per certificate scheme or sanctions list. */
function reconciles(run: EtlRun): [string, Reconcile][] {
  const r = run.meta?.reconcile;
  return r && typeof r === "object" ? Object.entries(r as Record<string, Reconcile>) : [];
}

export function breakerOf(
  run: EtlRun | null,
): { tripped: string; changed?: number; created?: number; stored?: number } | null {
  const b = run?.meta?.circuit_breaker as
    | { tripped?: unknown; changed?: unknown; created?: unknown; stored?: unknown }
    | undefined;
  if (!b || typeof b.tripped !== "string" || !b.tripped) return null;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return { tripped: b.tripped, changed: num(b.changed), created: num(b.created), stored: num(b.stored) };
}

const n = (v: number) => v.toLocaleString("en-GB");

/**
 * Held, then removals waiting, then incomplete reads, then failures, then sources past
 * their limit while switched on, then near-match records. Only each source's latest run
 * counts: a held run that a later read already released needs nothing.
 */
export function needsYou(doc: DashboardDoc, freshness: FreshnessDoc | null, nearMatches: number | null): Need[] {
  const out: Need[] = [];
  // The source's own code, not the run's: the dashboard's latest_run can arrive without
  // scraper_code, which printed "undefined stopped at the safety limit" (10 Oct 2026).
  const latest = doc.scrapers.flatMap((s) =>
    s.latest_run && !s.active_job ? [{ code: s.scraper_code, run: s.latest_run }] : [],
  );

  for (const { code, run } of latest) {
    const name = sourceLabel(code);
    const breaker = breakerOf(run);
    if (run.status === "held" || breaker) {
      const changed = breaker?.changed;
      const landed =
        changed !== undefined
          ? ` It updated ${n(changed)} ${changed === 1 ? "company" : "companies"}${breaker?.created ? ` and added ${n(breaker.created)} new` : ""}, the most it does on its own${breaker?.stored ? ` (5% of ${n(breaker.stored)})` : ""}.`
          : "";
      out.push({
        kind: "held",
        code,
        text: `${name} paused partway through because more changed than usual.${landed} The rest is waiting for you.`,
        check: `Open ${name} to see what its last read changed. If it looks right, let the rest through.`,
        action: "release_changes",
      });
    }
    for (const [, r] of reconciles(run)) {
      const count = typeof r.missing === "number" ? n(r.missing) : "Some";
      if (r.action === "held") {
        out.push({
          kind: "delistings",
          code,
          text: `${count} ${name} entries are no longer on ${name}'s own list. They still show as listed until you agree.`,
          check: `Check a few on the source's website. If they are really gone, mark them no longer listed.`,
          action: "release_delistings",
        });
      } else if (r.action === "partial") {
        out.push({
          kind: "partial",
          code,
          text: `${name}'s last read stopped early, so nothing was removed. If it stops again, the source's website has probably changed.`,
          check: null,
          action: "run",
        });
      }
    }
    if (run.status === "failed") {
      out.push({
        kind: "failed",
        code,
        text: `${name} could not finish its last read${run.error ? ` (${run.error})` : ""}.`,
        check: null,
        action: "run",
      });
    }
  }

  for (const r of freshness?.rows ?? []) {
    if (r.over_sla === true && r.enabled && !out.some((x) => x.code === r.scraper_code)) {
      const name = sourceLabel(r.scraper_code);
      const limit =
        r.max_age_hours === null
          ? ""
          : `; it should be read every ${r.max_age_hours >= 48 ? `${Math.round(r.max_age_hours / 24)} days` : `${r.max_age_hours} hours`}`;
      out.push({
        kind: "over_limit",
        code: r.scraper_code,
        text:
          r.age_hours === null
            ? `${name} has never been read in full.`
            : `${name} was last read in full ${Math.max(1, Math.round(r.age_hours / 24))} days ago${limit}.`,
        check: null,
        action: "run",
      });
    }
  }

  if (nearMatches && nearMatches > 0) {
    out.push({
      kind: "near_match",
      code: null,
      text: `${n(nearMatches)} ${nearMatches === 1 ? "company looks" : "companies look"} like one we already have. Each waits for you to say same or different.`,
      check: null,
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
