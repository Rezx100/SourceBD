import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { ResultsTable } from "@/components/dashboard/results-table";
import {
  CSV_COLUMNS,
  buildDiscoverCard,
  buildDiscoverTableRow,
  discoverCsvValue,
  discoverRowsToCsv,
} from "./build-discover-row";
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

  it("the photo tile agrees with the chip about the EPB register", () => {
    // The chip was fixed to say "no lines recorded" for a supplier on the EPB
    // register, while the photo tile two rows below went on printing
    // "no EPB record" for the same supplier — the card contradicted itself.
    const member = buildDiscoverCard(
      { ...ROW, registries: ["BGMEA", "EPB"] },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: member }));
    assert.doesNotMatch(html, /no EPB record/, "the tile still denies a register the chip confirms");
    assert.match(html, /no lines recorded/);

    const nonMember = buildDiscoverCard(
      { ...ROW, registries: ["BGMEA"] },
      { today: TODAY, hsLines: [], hsError: false },
    );
    const nonMemberHtml = renderToStaticMarkup(createElement(SupplierResultCard, { card: nonMember }));
    assert.match(nonMemberHtml, /no EPB record/, "a genuine non-member must still be described as one");
  });

  it("a saved record does not mark the select checkbox", () => {
    const card = buildDiscoverCard(ROW, { today: TODAY, hsLines: [], hsError: false, saved: true });
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    assert.equal(card.selected, false);
    assert.equal(card.saved, true);
    assert.match(html, /aria-label="Saved"/);
    assert.doesNotMatch(html, /shadow-\[inset_3px_0_0_rgb\(var\(--ds-brand\)\)\]/);
  });

  it("the worker figure names the register it came from, and claims nothing else", () => {
    // The wording this replaces said "across this record and its buildings"
    // on every row, because `workers_is_group` was set for every supplier the
    // display RPC answered for, children or none — and under RSC preference
    // the sum can exclude the record it names. The batch returns
    // `{value, source, fetched_at}` and nothing about composition, so the
    // source is the only thing about this number the page actually knows.
    // Spec §3.1: "we show the exact worker count with its source".
    const rsc = discoverCsvValue({ ...ROW, employees_total: 4100, workers_source: "RSC" }, TODAY);
    const reg = discoverCsvValue({ ...ROW, employees_total: 900, workers_source: "registry" }, TODAY);
    const plain = discoverCsvValue({ ...ROW, employees_total: 900 }, TODAY);
    assert.equal(rsc.workers, "4100");
    assert.equal(rsc.workers_source, "RSC inspection");
    assert.equal(reg.workers_source, "on the register");
    // No display figure at all: the number is the supplier row's own, and the
    // cell must not borrow a register that was never consulted.
    assert.equal(plain.workers_source, "supplier record");
    assert.notEqual(rsc.workers_source, reg.workers_source);
    assert.ok(CSV_COLUMNS.includes("workers_source"), "the column exists but the CSV never emits it");

    // And it reaches the file, in the same row as the number it describes.
    const csv = discoverRowsToCsv([{ ...ROW, employees_total: 4100, workers_source: "RSC" }], TODAY);
    const [header, row] = csv.trim().split(/\r?\n/);
    const at = (header ?? "").split(",").indexOf("workers_source");
    assert.ok(at > 0, "workers_source is not in the CSV header");
    assert.equal((row ?? "").split(",")[at], "RSC inspection");

    // A row with no worker figure must not claim a source for one.
    assert.equal(discoverCsvValue({ ...ROW, employees_total: null }, TODAY).workers_source, "");
  });

  it("the CSV names the HS column for what it holds — headings, not lines", () => {
    // `row.hs_codes` is discover_v32_hs_codes: left(code, 4) DISTINCT, i.e.
    // 4-digit headings. The card and the table count full 6-digit lines from
    // supplier_epb_hscodes_batch, so a supplier reading "12 HS lines" on
    // screen exported three values in a column called `hs_codes`. Two
    // quantities, one name, one click apart.
    const row = { ...ROW, hs_codes: ["6109", "6110"] };
    const cell = discoverCsvValue(row, TODAY);
    assert.equal(cell.hs_headings, "6109; 6110");
    assert.ok(CSV_COLUMNS.includes("hs_headings"), "the CSV does not emit the headings column");
    assert.ok(
      !CSV_COLUMNS.includes("hs_codes" as never),
      "`hs_codes` is back, and it counts headings while the screen counts lines",
    );

    // The screen genuinely does count something else, which is the whole
    // point: same row, six-digit lines from the batch, a different number.
    const card = buildDiscoverCard(row, {
      today: TODAY,
      hsError: false,
      hsLines: [
        { slug: row.slug, hs: "610910", heading: "6109" },
        { slug: row.slug, hs: "610990", heading: "6109" },
        { slug: row.slug, hs: "611020", heading: "6110" },
      ],
    });
    assert.equal(card.totalLines, 3, "the card should be counting full lines here");
    assert.equal(cell.hs_headings.split("; ").length, 2);
    assert.notEqual(card.totalLines, cell.hs_headings.split("; ").length);
  });

  it("no surface claims the figure spans buildings, because nothing here knows that", () => {
    // The durable guard for the defect itself. `production_workers_display_batch`
    // returns no site composition, so any wording about buildings or sites is
    // unfalsifiable from this page's data. If someone reintroduces it on the
    // card, the table or the CSV, this goes red.
    const rows = [
      { ...ROW, employees_total: 4100, workers_source: "RSC" as const },
      { ...ROW, employees_total: 900, workers_source: "registry" as const },
      { ...ROW, employees_total: 900 },
    ];
    const claim = /buildings|across .* sites?|group (sum|roll-?up)/i;
    for (const r of rows) {
      const card = buildDiscoverCard(r, { today: TODAY, hsLines: [], hsError: false });
      const table = buildDiscoverTableRow(r, { today: TODAY, hsLines: [], hsError: false });
      const meta = card.meta.map((m) => m.text).join(" | ");
      assert.doesNotMatch(meta, claim, `card meta claims composition: ${meta}`);
      assert.doesNotMatch(String(table.workersCoverage ?? ""), claim, "table sub-line claims composition");
      assert.doesNotMatch(
        Object.values(discoverCsvValue(r, TODAY)).join(" | "),
        claim,
        "a CSV cell claims composition",
      );
      const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
      assert.doesNotMatch(html, claim, "the rendered card claims composition");
    }
  });
});
