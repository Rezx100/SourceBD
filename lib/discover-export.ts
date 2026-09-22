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

/**
 * The truncation has to be visible without reading a response header, and it
 * must not be a row. The filename is the first thing the buyer sees, it
 * survives being forwarded, and no importer mistakes it for data.
 */
export function csvFilename(today: Date, rows?: number, matched?: number | null): string {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const atCeiling = rows != null && rows >= MAX_ROWS;
  const truncated = atCeiling || (rows != null && matched != null && matched > rows);
  const span = !truncated ? "" : matched != null ? `-first-${rows}-of-${matched}` : `-first-${rows}`;
  return `sourcebd-suppliers-${y}-${m}-${d}${span}.csv`;
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
  /** Each page's own `total_count`, already parsed from number-or-string. */
  const totals: number[] = [];
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
    if (page.total != null) totals.push(page.total);
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

  // What the search actually matched. This used to read `total_count` off the
  // rows itself and accept only `typeof === "number"`, while the column is a
  // bigint that PostgREST may send as a string — `DiscoverV32Row.total_count`
  // is `number | string` for that reason and `parseTotalCount` handles both.
  // A string total made `matched` null, which made `truncated` false, which
  // dropped the "-first-1000-of-3481" out of the filename and both headers:
  // exactly the silence the paragraph below says this closes. `fetchDiscoverV32`
  // already parses it correctly per page and that value was being thrown away.
  const matched = totals.reduce<number | null>((acc, n) => (acc == null || n > acc ? n : acc), null);
  // Hitting the ceiling IS truncation, whether or not the RPC told us the
  // total. If `total_count` is absent or unparseable on every page, `matched`
  // is null and `matched > rows.length` is false — so a buyer received exactly
  // MAX_ROWS rows of a larger search with nothing saying so. That is the
  // original silence, arriving through the one input the count-based test
  // cannot see. The filename then says "first-1000" without an "of", because
  // the total is genuinely unknown and inventing one would be worse.
  const truncated = rows.length >= MAX_ROWS || (matched != null && matched > rows.length);

  // The defect this closes is the SILENCE, not the row count. A buyer who
  // exports a 3,481-supplier search and receives 1,000 rows with nothing to
  // say so sources against them as the whole set. The cap is deliberate;
  // hiding it is not. It is said in the filename — which the buyer reads
  // before opening anything — and in the response headers, for anything
  // reading this programmatically. Never as a row: appended as a CSV data
  // row it became a twelfth "supplier", so a spreadsheet pivot or a CRM
  // import read a phantom record whose company name was a sentence.
  const csv = discoverRowsToCsv(rows, input.today);
  // Header-shape guard only. The previous body-wide "@" scan refused the whole
  // export for any legitimate value containing one — a supplier could deny
  // every buyer this export by putting an address in its own company name —
  // and it protected nothing the column allowlist does not already: the columns
  // are a fixed list with no contact field in it.
  //
  // Be honest about what this is: an exact match against a closed list of
  // header names, checked against a header this same function just generated
  // from `CSV_COLUMNS`. It cannot fire today, and it would not catch a future
  // column called `owner_email` or `contact_person` either. The reachable
  // half of the guard is the invariant over `CSV_COLUMNS` itself, asserted in
  // `discover-export.test.ts`; this stays as a last-ditch check on the bytes
  // actually leaving, and claims nothing more.
  if (csvContainsContactHeader(csv)) {
    return {
      status: 500,
      body: JSON.stringify({ error: "export refused" }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    };
  }

  const filename = csvFilename(input.today, rows.length, matched);
  return {
    status: 200,
    body: csv,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-SourceBD-Rows": String(rows.length),
      ...(matched != null ? { "X-SourceBD-Matched": String(matched) } : {}),
      ...(truncated ? { "X-SourceBD-Truncated": "1" } : {}),
    },
  };
}
