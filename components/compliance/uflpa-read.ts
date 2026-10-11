// The UFLPA result a phone screen prints in one line (Paper page 36, `filters` and `alerts`): what
// the check of the buyer's saved suppliers found, that it is not a clearance, and the day the list
// was last read in full (`sanctions_lists_read()`, 0120). Nothing here is hard-coded: a check that
// was not read draws nothing, and a list with no read date says so.

import { formatDay } from "@/lib/dashboard/facts";
import { loadCompliance } from "./load";

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

type Check = { total: number; hits: number; flags: number } | null;

/** The line and whether it is a warning: a supplier on the list or flagged draws in caution ink. */
export type UflpaNotice = { line: string; hit: boolean };

/** Alerts' card: the saved suppliers' result; null when the check was not read or had nothing to check. */
export function uflpaNotice(check: Check, readAt: string | null, today: Date): UflpaNotice | null {
  const line = uflpaResultLine(check, readAt, today);
  return line ? { line, hit: (check?.hits ?? 0) + (check?.flags ?? 0) > 0 } : null;
}

/**
 * The filters sheet's line under the sanctions switch. The only UFLPA result a buyer's session can
 * read is the check of their own saved suppliers, so the line says whose it is; with nothing saved
 * it says only that the list was read, and with no read date it says nothing.
 */
export function uflpaSheetNotice(check: Check, readAt: string | null, today: Date): UflpaNotice | null {
  const saved = uflpaNotice(check, readAt, today);
  if (saved) return { ...saved, line: `UFLPA list, your saved suppliers: ${saved.line}` };
  const day = readAt ? shortDay(readAt, today) : null;
  return day ? { line: `UFLPA list read ${day}`, hit: false } : null;
}

/** Both reads for the filters sheet, in one wave; neither throws. */
export async function loadUflpaSheetNotice(supabase: Client, today: Date): Promise<UflpaNotice | null> {
  const [d, readAt] = await Promise.all([loadCompliance(supabase, { uflpa: true }), readUflpaListDate(supabase)]);
  return uflpaSheetNotice(d.uflpa, readAt, today);
}
