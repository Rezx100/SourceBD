import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { ResultsTable } from "@/components/dashboard/results-table";
import { buildDiscoverCard, buildDiscoverTableRow, discoverRowsToCsv } from "./build-discover-row";
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
    assert.match(html, /Send RFQ/);

    // `assert.match(html, /disabled/)` used to stand here and guarded nothing:
    // Button's primary variant always emits the Tailwind classes
    // `disabled:cursor-not-allowed disabled:border-line …`, so the bare word
    // "disabled" is present on every primary button whether or not the
    // attribute is set. Setting `disabled={false}` left all three assertions
    // green. Assert the element instead: the Send RFQ control must carry the
    // real `disabled` attribute and must not be a link.
    const sendRfq = html.match(/<(button|a)\b[^>]*>(?:(?!<\/(?:button|a)>)[\s\S])*?Send RFQ/);
    assert.ok(sendRfq, "Send RFQ control not found in the card HTML");
    const tag = sendRfq[0];
    assert.ok(
      /\sdisabled(?:=|[\s>])/.test(tag),
      `sanctioned Send RFQ must carry the disabled attribute; got: ${tag}`,
    );
    assert.doesNotMatch(tag, /\shref=/, "a disabled Send RFQ must not also be a live link");
  });

  it("an unsanctioned row leaves Send RFQ live — the guard above can fail", () => {
    // Pins the other side of the same behaviour, so the disabled assertion
    // cannot be satisfied by simply disabling the button for everyone.
    const card = buildDiscoverCard(
      { ...ROW, is_sanctioned: false },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    const sendRfq = html.match(/<(button|a)\b[^>]*>(?:(?!<\/(?:button|a)>)[\s\S])*?Send RFQ/);
    assert.ok(sendRfq, "Send RFQ control not found");
    assert.doesNotMatch(
      sendRfq[0],
      /\sdisabled(?:=|[\s>])/,
      "an unsanctioned supplier's Send RFQ must stay live",
    );
  });

  it("says 'no lines recorded' for an EPB member, 'not on the list' only for a non-member", () => {
    // "Not on the EPB exporter list" was printed whenever the HS lines came
    // back empty — which happens when the EPB record carries no codes, the
    // codes fail the digit shape, or the host/exporter pair is on the
    // foreign-record denylist. None of those mean absence from the register,
    // and the same card could show an EPB source mark beside the denial.
    const member = buildDiscoverCard(
      { ...ROW, registries: ["BGMEA", "EPB"] },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const memberHtml = renderToStaticMarkup(createElement(SupplierResultCard, { card: member }));
    assert.doesNotMatch(
      memberHtml,
      /Not on the EPB exporter list/,
      "a supplier on the EPB register must never be told it is absent from it",
    );
    assert.match(memberHtml, /no lines recorded/);

    const nonMember = buildDiscoverCard(
      { ...ROW, registries: ["BGMEA"] },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const nonMemberHtml = renderToStaticMarkup(
      createElement(SupplierResultCard, { card: nonMember }),
    );
    assert.match(nonMemberHtml, /Not on the EPB exporter list/);
  });

  it("a CSV cell that starts like a formula is neutralised", () => {
    // Supplier-supplied text reaches this export. A name beginning "=" or "+"
    // is executed by Excel and Sheets when the buyer opens the file.
    const csv = discoverRowsToCsv(
      [{ ...ROW, company_name: "=HYPERLINK(\"http://evil\",\"click\")" }],
      TODAY,
    );
    const dataLine = csv.split(/\r?\n/)[1] ?? "";
    assert.doesNotMatch(
      dataLine,
      /(^|,)"?=/,
      `a cell still begins with "=" and would execute: ${dataLine}`,
    );
    assert.match(dataLine, /'=HYPERLINK/, "expected the value to survive, quoted");
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
