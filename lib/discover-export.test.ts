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
