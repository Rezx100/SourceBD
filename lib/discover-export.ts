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
  const { rows, error } = await fetchDiscoverV32(input.supabase, { ...state, page: 1, per: 100 }, { limit: MAX_ROWS, offset: 0 });
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

  const csv = discoverRowsToCsv(rows as DiscoverV32Row[], input.today);
  if (csvContainsContactHeader(csv) || /@/.test(csv)) {
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
