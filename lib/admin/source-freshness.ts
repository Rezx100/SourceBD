// The words of the Sources page's freshness table (spec-etl-freshness S3, §4.9), from
// `admin_source_freshness()` (0123). Pure, so the wording is pinned by a test.

export type FreshnessRun = { started_at: string; status: string; seen: number | null; upserted: number | null; skipped: number | null };

export type FreshnessRow = {
  scraper_code: string;
  enabled: boolean;
  interval_minutes: number | null;
  max_age_hours: number | null;
  next_run_at: string | null;
  last_complete_at: string | null;
  age_hours: number | null;
  over_sla: boolean | null;
  failures_in_row: number;
  last_breaker_trip: string | null;
  credits_month: number;
  no_longer_listed: number;
  last_runs: FreshnessRun[];
};

export type FreshnessDoc = { rows: FreshnessRow[]; credits_month: number; credits_ceiling: number };

export type FreshnessTone = "ok" | "caution" | "danger" | "quiet";

export type FreshnessLine = {
  code: string;
  /** "3 h old · limit 48 h", "never read in full", "not scheduled". */
  age: string;
  tone: FreshnessTone;
  /** "every day", "every 7 days", "off". */
  cadence: string;
  /** "✓ ✓ ✗ ✓ held": the last five runs, newest first. */
  runs: string;
  failures: string | null;
  breaker: string | null;
  credits: string | null;
  removed: string | null;
};

const MARK: Record<string, string> = { success: "✓", failed: "✗", held: "held", running: "…" };

function hoursWords(h: number): string {
  return h <= 72 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
}

function cadenceWords(r: FreshnessRow): string {
  if (!r.enabled || !r.interval_minutes) return "off";
  const days = r.interval_minutes / 1440;
  return days === 1 ? "every day" : days >= 1 ? `every ${Math.round(days)} days` : `every ${r.interval_minutes} min`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** One line per source, the stalest problem first: over its limit, then failing, then the rest. */
export function freshnessLines(doc: FreshnessDoc): FreshnessLine[] {
  const lines = doc.rows.map((r): FreshnessLine => {
    const limit = r.max_age_hours ? ` · limit ${hoursWords(r.max_age_hours)}` : "";
    const age = r.age_hours === null ? `never read in full${limit}` : `${hoursWords(r.age_hours)} old${limit}`;
    const tone: FreshnessTone =
      r.over_sla === true ? (r.enabled ? "danger" : "caution") : r.over_sla === false ? "ok" : "quiet";
    return {
      code: r.scraper_code,
      age,
      tone,
      cadence: cadenceWords(r),
      runs: r.last_runs.length ? r.last_runs.map((x) => MARK[x.status] ?? x.status).join(" ") : "no runs",
      failures: r.failures_in_row > 0 ? `${r.failures_in_row} failed in a row` : null,
      breaker: r.last_breaker_trip ? `stopped by the safety limit ${day(r.last_breaker_trip)}` : null,
      credits: r.credits_month > 0 ? `${r.credits_month.toLocaleString("en-GB")} credits this month` : null,
      removed: r.no_longer_listed > 0 ? `${r.no_longer_listed.toLocaleString("en-GB")} no longer listed` : null,
    };
  });
  const rank = (l: FreshnessLine) => (l.tone === "danger" ? 0 : l.failures ? 1 : l.tone === "caution" ? 2 : 3);
  return lines.sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
}

/** "312 of 1,500 Firecrawl credits used this month". */
export function creditsWords(doc: FreshnessDoc): string {
  return `${doc.credits_month.toLocaleString("en-GB")} of ${doc.credits_ceiling.toLocaleString("en-GB")} Firecrawl credits used this month`;
}
