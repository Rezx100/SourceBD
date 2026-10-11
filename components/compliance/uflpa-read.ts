// The UFLPA result a phone screen prints in one line (Paper page 36, `filters` and `alerts`): what
// the check of the buyer's saved suppliers found, that it is not a clearance, and the day the list
// was last read in full (`sanctions_lists_read()`, 0120). Nothing here is hard-coded: a check that
// was not read draws nothing, and a list with no read date says so.

import { formatDay } from "@/lib/dashboard/facts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

/** The last full read of the UFLPA Entity List; null when 0120 is missing, the read fails or the list was never read. */
export async function readUflpaListDate(supabase: Client): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("sanctions_lists_read", {});
    if (error || !Array.isArray(data)) return null;
    const at = (data as { list?: unknown; last_read?: unknown }[]).find((r) => r.list === "uflpa")?.last_read;
    return typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : null;
  } catch {
    return null;
  }
}

/** "8 Oct", with the year only when it is not this year. */
export function shortDay(iso: string, today: Date): string | null {
  const day = formatDay(iso);
  if (!day) return null;
  const year = ` ${today.getUTCFullYear()}`;
  return day.endsWith(year) ? day.slice(0, -year.length) : day;
}

/**
 * "No link found · not a clearance · read 8 Oct" when no saved supplier is on the list or flagged,
 * "2 on the list · read 8 Oct" or "1 possible Xinjiang link · read 8 Oct" when some are. Null when
 * the check could not be read or had no published supplier to check.
 */
export function uflpaResultLine(check: { total: number; hits: number; flags: number } | null, readAt: string | null, today: Date): string | null {
  if (check === null || check.total === 0) return null;
  const day = readAt ? shortDay(readAt, today) : null;
  const read = day ? `read ${day}` : "read date not stored";
  if (check.hits > 0) return `${check.hits} on the list · ${read}`;
  if (check.flags > 0) return `${check.flags} possible Xinjiang ${check.flags === 1 ? "link" : "links"} · ${read}`;
  return `No link found · not a clearance · ${read}`;
}
