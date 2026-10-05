/**
 * The Monday job behind "Email me new matches" (gap 14, migration 0113). For each saved search with the
 * switch on and not checked for six days it runs the search the way the results page does (the smart
 * query, sanctioned suppliers always hidden: an email must not offer one), asks the database which of
 * today's matches it has not seen, emails the buyer once when there are any, and records what it saw.
 *
 * Pure of I/O beyond the two things it is handed: a service-role client (the three calls are granted to
 * `service_role` only) and a sender. `lib/email/jobs/saved-search-alerts.ts` wires the real ones; the
 * route at `app/api/v1/webhooks/saved-search-alerts` is what cron calls.
 *
 * Failure rule: a search whose run, check, send or record failed is NOT recorded, so it is still due and
 * the next run tries it again; recording after a failed send would lose its new matches for good. The
 * first check of a search is a baseline: it records what matches now and emails nothing.
 */

import { displayName } from "@/lib/dashboard/facts";
import { fetchDiscoverV32 } from "@/lib/discover-v32-rpc";
import type { SavedSearchAlertData } from "@/lib/email/templates/saved-search-alert";
import { asState, savedSearchRedirectHref } from "@/lib/saved-searches";

export type AlertClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type AlertDeps = {
  supabase: AlertClient;
  /** True when the email really went out; false when nothing was sent (no API key), so it is retried. */
  send: (to: string, data: SavedSearchAlertData, refId: string) => Promise<boolean>;
  appUrl: string;
};

export type AlertRun = {
  /** Searches the database said were due this run. */
  due: number;
  baselined: number;
  emailed: number;
  /** Checked, nothing new. */
  unchanged: number;
  /** Left unrecorded, so due again next run. */
  failed: number;
  /** Set when the due list itself could not be read (a database without 0113 lands here). */
  error: string | null;
};

type Due = { search_id: string; owner_id: string; email: string; name: string; query_state: unknown };

/** Searches handled in one run. The rest are still due and wait for the next. */
export const BATCH = 200;
const PAGE = 100;
/**
 * Matches read per search: ten pages, the same ceiling as the CSV export.
 * ponytail: a search matching more than this is checked on its first 1,000 by name only; page on if one matters.
 */
export const MAX_MATCHES = 1000;
export const NAMES_IN_EMAIL = 5;

const isUuid = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function asDue(raw: unknown): Due[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Due => Boolean(r) && typeof r === "object" && isUuid((r as Due).search_id) && typeof (r as Due).email === "string" && (r as Due).email.includes("@"));
}

type Match = { id: string; name: string };

/** Today's matches for a saved search, in name order, or null when any page could not be read. */
async function matchesOf(supabase: AlertClient, queryState: unknown): Promise<Match[] | null> {
  const state = { ...asState(queryState), sanctioned: false, sort: "name" as const, page: 1, per: PAGE as 100 };
  const found: Match[] = [];
  for (let offset = 0; offset < MAX_MATCHES; offset += PAGE) {
    const r = await fetchDiscoverV32(supabase, state, { limit: PAGE, offset });
    if (r.error) return null;
    for (const row of r.rows) found.push({ id: row.id, name: row.company_name });
    if (r.rows.length < PAGE) break;
  }
  const seen = new Set<string>();
  return found.filter((m) => !seen.has(m.id) && Boolean(seen.add(m.id)));
}

export async function runSavedSearchAlerts(deps: AlertDeps): Promise<AlertRun> {
  const out: AlertRun = { due: 0, baselined: 0, emailed: 0, unchanged: 0, failed: 0, error: null };
  const { data, error } = await deps.supabase.rpc("saved_search_alerts_due", { p_limit: BATCH });
  if (error) return { ...out, error: error.message ?? "saved_search_alerts_due failed" };
  const due = asDue(data);
  out.due = due.length;

  for (const row of due) {
    try {
      const matches = await matchesOf(deps.supabase, row.query_state);
      if (!matches) {
        console.warn(`[saved-search-alerts] ${row.search_id}: the search could not be run`);
        out.failed += 1;
        continue;
      }
      const ids = matches.map((m) => m.id);
      const fresh = await deps.supabase.rpc("saved_search_alert_new", { p_search_id: row.search_id, p_ids: ids });
      if (fresh.error) {
        console.warn(`[saved-search-alerts] ${row.search_id}: saved_search_alert_new failed: ${fresh.error.message ?? "unknown"}`);
        out.failed += 1;
        continue;
      }
      const record = async (sent: boolean) => {
        const r = await deps.supabase.rpc("saved_search_alert_record", { p_search_id: row.search_id, p_ids: ids, p_sent: sent });
        return !r.error;
      };

      // null is the first check of this search: remember what matches now, say nothing.
      const newIds: string[] | null = Array.isArray(fresh.data) ? (fresh.data as string[]) : null;
      if (newIds === null) {
        if (await record(false)) out.baselined += 1;
        else out.failed += 1;
        continue;
      }
      if (newIds.length === 0) {
        if (await record(false)) out.unchanged += 1;
        else out.failed += 1;
        continue;
      }

      const isNew = new Set(newIds);
      const names = matches.filter((m) => isNew.has(m.id)).slice(0, NAMES_IN_EMAIL).map((m) => displayName(m.name));
      const sent = await deps.send(
        row.email,
        {
          searchName: row.name,
          newCount: newIds.length,
          names,
          runUrl: `${deps.appUrl}${savedSearchRedirectHref(row.query_state)}`,
          manageUrl: `${deps.appUrl}/app/searches`,
        },
        row.search_id,
      );
      if (!sent) {
        console.warn(`[saved-search-alerts] ${row.search_id}: the email was not sent, so the search stays due`);
        out.failed += 1;
        continue;
      }
      // Sent but not recorded: next run tells them again. Counted as failed so it shows in the run.
      if (await record(true)) out.emailed += 1;
      else out.failed += 1;
    } catch (err) {
      console.warn(`[saved-search-alerts] ${row.search_id}: ${err instanceof Error ? err.message : String(err)}`);
      out.failed += 1;
    }
  }
  return out;
}
