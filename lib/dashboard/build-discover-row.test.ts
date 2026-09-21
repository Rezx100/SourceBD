import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { ResultsTable } from "@/components/dashboard/results-table";
import { buildDiscoverCard, buildDiscoverTableRow } from "./build-discover-row";
import type { DiscoverV32Row } from "@/lib/discover-v32-rpc";

const TODAY = new Date("2026-09-21T00:00:00Z");

const ROW: DiscoverV32Row = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "ar-fashion",
  company_name: "A.R. FASHION",
  entity_type: "factory",
  city: null,
  district: null,
  source_tags: ["BGMEA"],
  t13_source_count: 1,
  completeness_pct: 10,
  employees_total: null,
  established_date: null,
  principal_products: [],
  factory_types: [],
  rsc_progress_pct: null,
  parent_group_name: null,
  primary_address: null,
  total_count: 1,
  is_sanctioned: false,
  cert_summary: [],
  hs_codes: [],
  brand_codes: [],
  registries: ["BGMEA"],
  top_tier: 2,
};

describe("discover result HTML has no contact PII", () => {
  it("the quiet record's card and table omit email and phone", () => {
    const card = buildDiscoverCard(ROW, { today: TODAY, hsLines: [], hsError: false });
    const row = buildDiscoverTableRow(ROW, { today: TODAY, hsLines: [], hsError: false });
    const html =
      renderToStaticMarkup(createElement(SupplierResultCard, { card })) +
      renderToStaticMarkup(createElement(ResultsTable, { rows: [row] }));
    assert.doesNotMatch(html, /@/);
    assert.doesNotMatch(html, /email_primary|contact_name|contact_role/);
    assert.match(html, /A\.R\. Fashion/);
    assert.match(html, /href="\/app\/suppliers\/ar-fashion"/);
  });

  it("a sanctioned row disables Send RFQ in the card HTML", () => {
    const card = buildDiscoverCard(
      { ...ROW, is_sanctioned: true, company_name: "Sanctioned Co" },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    assert.match(html, /data-sanctioned="true"/);
    assert.match(html, /disabled/);
    assert.match(html, /Send RFQ/);
  });

  it("a saved record does not mark the select checkbox", () => {
    const card = buildDiscoverCard(ROW, { today: TODAY, hsLines: [], hsError: false, saved: true });
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    assert.equal(card.selected, false);
    assert.equal(card.saved, true);
    assert.match(html, /aria-label="Saved"/);
    assert.doesNotMatch(html, /shadow-\[inset_3px_0_0_rgb\(var\(--ds-brand\)\)\]/);
  });
});
