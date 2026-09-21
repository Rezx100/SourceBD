import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvContainsContactHeader, csvFilename, runDiscoverExport } from "./discover-export";
import { discoverRowsToCsv } from "./dashboard/build-discover-row";
import type { DiscoverV32Row } from "./discover-v32-rpc";
import { discoverRowHasPii } from "./discover-v32-rpc";

const TODAY = new Date("2026-09-21T00:00:00Z");

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
          const limit = Math.min(100, Number(args?.p_limit ?? 100));
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
          const limit = Math.min(100, Number(args?.p_limit ?? 100));
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
