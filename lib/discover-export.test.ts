import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { csvContainsContactHeader, csvFilename, runDiscoverExport } from "./discover-export";
import { CSV_CONTACT_HEADERS } from "@/lib/dashboard/build-discover-row";
import { PII_KEYS } from "@/lib/discover-v32-rpc";
import { discoverRowsToCsv } from "./dashboard/build-discover-row";
import type { DiscoverV32Row } from "./discover-v32-rpc";
import { discoverRowHasPii } from "./discover-v32-rpc";

const TODAY = new Date("2026-09-21T00:00:00Z");

/**
 * The RPC's own per-call row ceiling, read out of the migration rather than
 * restated here. The previous version of the paging test hard-coded 100 in its
 * own stub, so it asserted its own premise: drop the SQL clamp to 50 and the
 * loop would stop after one page while the test stayed green.
 */
const RPC_LIMIT_CEILING = (() => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"),
    "utf8",
  );
  const m = sql.match(/least\(\s*coalesce\(\s*p_limit\s*,\s*\d+\s*\)\s*,\s*(\d+)\s*\)/);
  assert.ok(m, "could not read the p_limit ceiling out of 0104");
  return Number(m[1]);
})();

const ROW: DiscoverV32Row = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "aboni-knitwear",
  company_name: "Aboni Knitwear Ltd",
  entity_type: "factory",
  city: "Gazipur",
  district: "Gazipur",
  source_tags: ["BGMEA", "EPB"],
  t13_source_count: 2,
  completeness_pct: 80,
  employees_total: 1200,
  established_date: "2001-01-01",
  principal_products: ["knit"],
  factory_types: [],
  rsc_progress_pct: null,
  parent_group_name: null,
  primary_address: null,
  total_count: 1,
  is_sanctioned: false,
  cert_summary: [],
  hs_codes: ["6105"],
  brand_codes: [],
  registries: ["BGMEA"],
  top_tier: 2,
};

describe("discover CSV export boundary", () => {
  it("401 when the caller is not a buyer or admin", async () => {
    const res = await runDiscoverExport({
      role: null,
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /unauthorised/);
    assert.doesNotMatch(res.body, /Aboni/);
  });

  it("200 CSV has no contact headers and no @", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["Content-Type"], "text/csv; charset=utf-8");
    assert.match(res.headers["Content-Disposition"] ?? "", /sourcebd-suppliers-2026-09-21\.csv/);
    assert.equal(csvContainsContactHeader(res.body), false);
    assert.doesNotMatch(res.body, /@/);
    assert.match(res.body, /Aboni Knitwear Ltd/);
    assert.match(res.body, /aboni-knitwear/);
  });

  it("pages past the RPC's 100-row ceiling instead of truncating in silence", async () => {
    // The RPC clamps p_limit to 100, so the single call this export used to
    // make could never return the 1,000 rows MAX_ROWS promises. A buyer
    // exporting a 350-supplier search received exactly 100 rows, with no
    // warning, and sourced against them as the whole set. Goes red if the
    // paging loop is removed.
    const TOTAL = 250;
    const all = Array.from({ length: TOTAL }, (_, i) => ({
      ...ROW,
      id: `1111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      slug: `supplier-${i}`,
      company_name: `Supplier ${i} Ltd`,
      total_count: TOTAL,
    }));
    const seenOffsets: number[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const offset = Number(args?.p_offset ?? 0);
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          seenOffsets.push(offset);
          return { data: all.slice(offset, offset + limit), error: null };
        },
      },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const dataLines = res.body.trim().split(/\r?\n/).slice(1);
    assert.equal(
      dataLines.length,
      TOTAL,
      `exported ${dataLines.length} of ${TOTAL} rows — the rest were dropped silently`,
    );
    assert.match(res.body, /Supplier 249 Ltd/, "the last row of the set must be present");
    assert.ok(seenOffsets.length > 1, `expected several pages, saw offsets ${JSON.stringify(seenOffsets)}`);
  });

  it("stops at the documented ceiling rather than pulling the whole database", async () => {
    // The other side of the same loop: paging must terminate.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => ({
              ...ROW,
              slug: `s-${args?.p_offset}-${i}`,
              company_name: `S ${args?.p_offset}-${i}`,
            })),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const dataLines = res.body.trim().split(/\r?\n/).slice(1);
    assert.equal(dataLines.length, 1000, `expected the 1000-row cap, got ${dataLines.length}`);
  });

  it("refuses a payload that carries an email column", async () => {
    const leaked = { ...ROW, email_primary: "buyer@example.com" };
    assert.equal(discoverRowHasPii(leaked), true);
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [leaked], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body, /@/);
  });

  it("says so in the filename when the result set is larger than the export", async () => {
    // The defect was never the cap — it was giving a buyer 1,000 rows of a
    // 3,481-row search with nothing saying so. Goes red if the notice is
    // dropped, or if `truncated` stops being derived from the real count.
    //
    // The notice is in the filename and the headers, NOT in the body: as a
    // CSV data row it was a phantom 1,001st supplier to anything importing
    // the file, so the body must still be exactly the rows.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => ({
              ...ROW,
              slug: `s-${args?.p_offset}-${i}`,
              company_name: `S ${args?.p_offset}-${i}`,
              total_count: 3481,
            })),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.match(
      res.headers["Content-Disposition"] ?? "",
      /filename="sourcebd-suppliers-\d{4}-\d{2}-\d{2}-first-1000-of-3481\.csv"/,
      `no truncation notice in the filename: ${res.headers["Content-Disposition"]}`,
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], "1");
    assert.equal(res.headers["X-SourceBD-Matched"], "3481");
    // One header line plus exactly the rows — no note row among them.
    const lines = res.body.trim().split(/\r?\n/);
    assert.equal(lines.length, 1001, "the body carries something that is not a supplier");
    assert.doesNotMatch(res.body, /matching suppliers/i, "the notice leaked back into the CSV body");
  });

  it("stays silent when the export is the whole result set", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [{ ...ROW, total_count: 1 }], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body, /matching suppliers/i, "a complete export must not claim truncation");
    assert.doesNotMatch(
      res.headers["Content-Disposition"] ?? "",
      /first-\d+-of-\d+/,
      "a complete export must not claim truncation in its filename either",
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], undefined);
  });

  it("refuses a CSV whose header carries a contact column", async () => {
    // A reviewer proved this guard was never exercised: the 500 in the test
    // above comes from the row-shape check upstream, so the header guard could
    // be replaced with `if (false)` and every export test stayed green. This
    // drives it directly.
    const csv = "slug,company_name,email\na,b,c\r\n";
    assert.equal(csvContainsContactHeader(csv), true);
    assert.equal(csvContainsContactHeader("slug,company_name,city\na,b,c\r\n"), false);
  });

  it("covers every contact column the brief names, not just the two it was typed with", () => {
    // `CSV_CONTACT_HEADERS` was hand-listed as email/phone/contact/
    // email_primary/phones, so a header literally named `contact_name` or
    // `contact_role` — two of the four PII columns `discoverRowHasPii` knows
    // about — walked past a check whose comment claimed it was the backstop
    // for all four. It is derived from `PII_KEYS` now, so the two lists
    // cannot drift apart again.
    for (const key of PII_KEYS) {
      assert.equal(
        csvContainsContactHeader("slug,company_name," + key + "\na,b,c\r\n"),
        true,
        "the CSV backstop does not recognise " + key + ", which discoverRowHasPii treats as PII",
      );
      assert.ok(
        (CSV_CONTACT_HEADERS as readonly string[]).includes(key),
        key + " is missing from CSV_CONTACT_HEADERS",
      );
    }
    // Still not a substring match: a column that merely contains one of the
    // words is not a contact column.
    assert.equal(csvContainsContactHeader("slug,contact_count,phones_checked\na,b,c\r\n"), false);
  });

  it("does not refuse a legitimate value that merely looks like an address", async () => {
    // The old body-wide "@" scan meant one supplier could deny every buyer
    // this export by putting an address-shaped string in its own company name.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async () => ({
          data: [{ ...ROW, company_name: "sales@knit Ltd", primary_address: "unit 4, sales@knit.com road" }],
          error: null,
        }),
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200, "supplier-controlled text must not be able to break the export");
  });

  it("carries the buyer's filters into the query", async () => {
    // Every other stub here ignores everything but offset and limit, so
    // replacing the parsed state with an empty one — turning the export into
    // the unfiltered top 1,000 suppliers rather than the search on screen —
    // left all of them green.
    const seen: Record<string, unknown>[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          seen.push(args ?? {});
          return { data: [ROW], error: null };
        },
      },
      search: "?q=knit&hs=6105,6110&cert=gots:valid&reg=BGMEA&sort=name",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const args = seen[0] ?? {};
    assert.equal(args.p_q, "knit", "the keywords never reached the query");
    assert.deepEqual(args.p_hs_codes, ["6105", "6110"], "the HS filter never reached the query");
    assert.deepEqual(args.p_cert_kinds, ["gots"], "the certificate filter never reached the query");
    assert.equal(args.p_cert_state, "valid");
    assert.deepEqual(args.p_registries, ["BGMEA"], "the register filter never reached the query");
    assert.equal(args.p_sort, "name", "the sort never reached the query");
  });

  it("503 when the search cannot be read", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: null, error: { message: "function not found" } }) },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 503);
    assert.doesNotMatch(res.body, /Aboni/);
  });

  it("the csv builder's header never includes contact fields", () => {
    const csv = discoverRowsToCsv([ROW], TODAY);
    assert.equal(csvContainsContactHeader(csv), false);
    assert.equal(csvFilename(TODAY), "sourcebd-suppliers-2026-09-21.csv");
  });
});
