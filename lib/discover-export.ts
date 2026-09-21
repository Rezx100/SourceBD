/**
 * GET /api/v1/discover/export — CSV of the current Discover result set.
 * Auth at the handler; this builder is the observable boundary (status, body,
 * Content-Disposition). Contact columns never appear; a fixture email must
 * not land in the body.
 */

import { discoverRowsToCsv, CSV_CONTACT_HEADERS } from "@/lib/dashboard/build-discover-row";
import { fetchDiscoverV32, type DiscoverV32Row } from "@/lib/discover-v32-rpc";
import { parseDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";
import { discoverRowHasPii } from "@/lib/discover-v32-rpc";

export type ExportRpcClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type ExportResult = {
  status: number;
  body: string;
  headers: Record<string, string>;
};

const MAX_ROWS = 1000;
/** The RPC's own hard ceiling per call (0104: `least(coalesce(p_limit,24),100)`). */
const PAGE_SIZE = 100;
/** local@domain.tld — an address, not merely the "@" character. */
const EMAIL_SHAPE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function csvFilename(today: Date): string {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  return `sourcebd-suppliers-${y}-${m}-${d}.csv`;
}

export function csvContainsContactHeader(csv: string): boolean {
  const header = csv.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  return CSV_CONTACT_HEADERS.some((h) => header.split(",").includes(h));
}

export async function runDiscoverExport(input: {
  role: string | null;
  supabase: ExportRpcClient;
  search: string;
  today: Date;
}): Promise<ExportResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return {
      status: 401,
      body: JSON.stringify({ error: "unauthorised" }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
  }

  const state: DiscoverState = parseDiscoverState(new URLSearchParams(input.search.replace(/^\?/, "")));

  // The RPC clamps p_limit to 100 (0104: `least(coalesce(p_limit,24),100)`),
  // so a single call can never return the MAX_ROWS this export promises. Page
  // until the result set runs out or the cap is reached — a buyer who exports
  // a 3,000-row search must not silently receive the first 100 and source
  // against them as if they were the whole set.
  const rows: DiscoverV32Row[] = [];
  let error: string | null = null;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const want = Math.min(PAGE_SIZE, MAX_ROWS - offset);
    const page = await fetchDiscoverV32(
      input.supabase,
      { ...state, page: 1, per: 100 },
      { limit: want, offset },
    );
    if (page.error) {
      error = page.error;
      break;
    }
    rows.push(...(page.rows as DiscoverV32Row[]));
    if (page.rows.length < want) break;
  }
  if (error) {
    const pii = error.includes("contact fields");
    return {
      status: pii ? 500 : 503,
      body: JSON.stringify({ error: pii ? "export refused" : "export unavailable" }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
  }
  if (rows.some((r) => discoverRowHasPii(r))) {
    return {
      status: 500,
      body: JSON.stringify({ error: "export refused" }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
  }

  const csv = discoverRowsToCsv(rows, input.today);
  // A bare "@" refused the whole export for any legitimate company name
  // containing one (e.g. "M@S Trading"). The guard is meant to catch a leaked
  // address, so match an address shape, not the character.
  if (csvContainsContactHeader(csv) || EMAIL_SHAPE.test(csv)) {
    return {
      status: 500,
      body: JSON.stringify({ error: "export refused" }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
  }

  const filename = csvFilename(input.today);
  return {
    status: 200,
    body: csv,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  };
}
