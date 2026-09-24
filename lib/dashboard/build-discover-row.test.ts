import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { ResultsTable } from "@/components/dashboard/results-table";
import { SelectionProvider } from "@/components/dashboard/selection";
import {
  CSV_COLUMNS,
  buildDiscoverCard,
  buildDiscoverTableRow,
  discoverCsvValue,
  discoverRowsToCsv,
} from "./build-discover-row";
import type { DiscoverV32Row } from "@/lib/discover-v32-rpc";
import { applyDiscoverWorkersSelection, parseDisplayBatch } from "@/lib/enrich-discover-workers";
import { readFileSync } from "node:fs";
import path from "node:path";

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

  it("the worker figures say what they are, in the CSV as on the page", () => {
    // `workers` is the supplier row's own figure — what the sort and filter
    // use — and `profile_workers` is the profile's figure when it differs,
    // with the words the batch's own composition supports.
    const own = discoverCsvValue(
      { ...ROW, employees_total: 900, workers_own: 900, workers_source: "registry", workers_basis: "own" },
      TODAY,
    );
    const group = discoverCsvValue(
      { ...ROW, employees_total: 3166, workers_own: 900, workers_source: "registry", workers_basis: "group" },
      TODAY,
    );
    const notMe = discoverCsvValue(
      { ...ROW, employees_total: 907, workers_own: null, workers_source: "RSC", workers_basis: "excludes-record" },
      TODAY,
    );
    const rscSite = discoverCsvValue(
      { ...ROW, employees_total: 500, workers_own: 550, workers_source: "RSC", workers_basis: "own" },
      TODAY,
    );
    const ours = (c: Record<string, string>) => [c.workers, c.workers_source, c.profile_workers, c.profile_workers_source];
    assert.deepEqual(ours(own), ["900", "on the supplier record", "", ""]);
    assert.deepEqual(ours(group), ["900", "on the supplier record", "3166", "across this record and its buildings"]);
    assert.deepEqual(ours(notMe), ["", "", "907", "across its buildings, not this record"]);
    // One site, two sources: named by its source, never as buildings.
    assert.deepEqual(ours(rscSite), ["550", "on the supplier record", "500", "RSC inspection"]);
    // The headline is the register's figure, and says so, whatever the batch
    // did: an RSC headcount that happens to equal it, or no batch entry.
    const rscEqual = discoverCsvValue(
      { ...ROW, employees_total: 550, workers_own: 550, workers_source: "RSC", workers_basis: "own" },
      TODAY,
    );
    assert.deepEqual(ours(rscEqual), ["550", "on the supplier record", "", ""]);
    for (const r of [
      { ...ROW, employees_total: 550, workers_own: 550, workers_source: "RSC" as const, workers_basis: "own" as const },
      { ...ROW, employees_total: 800 },
    ]) {
      const card = buildDiscoverCard(r, { today: TODAY, hsLines: [], hsError: false }).meta.map((m) => m.text);
      assert.ok(card.includes(`${r.employees_total === 550 ? "550" : "800"} workers · on the supplier record`), `card and CSV disagree: ${card.join(" | ")}`);
    }
    // A batch that did not say which sites it summed: no claim about them.
    const unknown = discoverCsvValue(
      { ...ROW, employees_total: 3166, workers_own: 900, workers_source: "registry", workers_basis: "unknown" },
      TODAY,
    );
    assert.deepEqual(ours(unknown), ["900", "on the supplier record", "3166", "as on its profile"]);
    for (const c of ["workers_source", "profile_workers", "profile_workers_source"] as const) {
      assert.ok(CSV_COLUMNS.includes(c), `the CSV does not emit ${c}`);
    }
    // No display figure at all: the number is the supplier row's own, in the
    // same words the filter and the other rows use for it.
    assert.equal(discoverCsvValue({ ...ROW, employees_total: 900 }, TODAY).workers_source, "on the supplier record");
    assert.equal(discoverCsvValue({ ...ROW, employees_total: null }, TODAY).workers_source, "");
  });

  it("every workers phrase on the card is one of the sanctioned ones, never free text", () => {
    // An allowlist cannot be talked around: a new phrasing has to be added
    // here deliberately. Both lines are checked, not only the first.
    const ALLOWED = new Set([
      "on the supplier record",
      "RSC inspection",
      "across this record and its buildings",
      "across its buildings, not this record",
      "as on its profile",
    ]);
    const cases: DiscoverV32Row[] = [
      { ...ROW, employees_total: 900, workers_own: 900, workers_source: "registry", workers_basis: "own" },
      { ...ROW, employees_total: 900, workers_own: 900, workers_source: "RSC", workers_basis: "own" },
      { ...ROW, employees_total: 500, workers_own: 550, workers_source: "RSC", workers_basis: "own" },
      { ...ROW, employees_total: 3166, workers_own: 900, workers_source: "registry", workers_basis: "group" },
      { ...ROW, employees_total: 907, workers_own: 400, workers_source: "RSC", workers_basis: "excludes-record" },
      { ...ROW, employees_total: 3166, workers_own: 900, workers_source: "registry", workers_basis: "unknown" },
      { ...ROW, employees_total: 900 },
    ];
    for (const r of cases) {
      const card = buildDiscoverCard(r, { today: TODAY, hsLines: [], hsError: false });
      const lines = card.meta.map((m) => m.text).filter((t) => /workers/i.test(t));
      for (const line of lines) {
        const suffix = line.includes(" · ") ? line.split(" · ").slice(1).join(" · ") : null;
        assert.ok(suffix === null || ALLOWED.has(suffix), `an unsanctioned workers phrase: ${JSON.stringify(line)}`);
      }
      // The table says what the card says.
      const table = buildDiscoverTableRow(r, { today: TODAY, hsLines: [], hsError: false });
      const first = lines[0] ?? "";
      assert.equal(table.workersCoverage ?? null, first.includes(" · ") ? first.split(" · ")[1] : null);
      assert.equal(table.workersSecond ?? null, lines[1] ?? null);
    }
  });

  it("from the batch to the page: the headline is the sorted figure, the second line says what the batch summed", () => {
    // End to end through the real enrich step — no hand-made workers_own. The
    // raw rows arrive in discover_suppliers' `workers` order: the supplier's
    // own employees_total, descending, nulls last.
    const raw: DiscoverV32Row[] = [
      { ...ROW, id: "a", slug: "a", company_name: "A", employees_total: 5000 },
      { ...ROW, id: "s", slug: "s", company_name: "S", employees_total: 550 },
      { ...ROW, id: "p", slug: "p", company_name: "P", employees_total: 400 },
      { ...ROW, id: "b", slug: "b", company_name: "B", employees_total: 300 },
      { ...ROW, id: "c", slug: "c", company_name: "C", employees_total: null },
    ];
    const batch = parseDisplayBatch({
      a: { value: 5000, source: "registry", fetched_at: null, sites: 1, includes_root: true },
      // One site: its RSC headcount differs from its register figure.
      s: { value: 500, source: "RSC", fetched_at: null, sites: 1, includes_root: true },
      // The RSC sum leaves out a parent that has no RSC row of its own.
      p: { value: 907, source: "RSC", fetched_at: null, sites: 1, includes_root: false },
      // This record and two buildings.
      b: { value: 9000, source: "registry", fetched_at: null, sites: 3, includes_root: true },
      c: { value: 907, source: "RSC", fetched_at: null, sites: 1, includes_root: false },
    });
    const rows = applyDiscoverWorkersSelection(raw, batch);
    const opts = { today: TODAY, hsLines: [], hsError: false };
    const tableRows = rows.map((r) => buildDiscoverTableRow(r, opts));
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: tableRows }));
    const cells = [...html.matchAll(/<td[^>]*text-right tabular-nums[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    assert.deepEqual(cells, [
      "5,000 on the supplier record",
      "550 on the supplier record 500 workers · RSC inspection",
      "400 on the supplier record 907 workers · across its buildings, not this record",
      "300 on the supplier record 9,000 workers · across this record and its buildings",
      "— 907 workers · across its buildings, not this record",
    ]);
    // The headlines read in the order the sort put the rows in.
    assert.deepEqual(tableRows.map((t) => t.workers), raw.map((r) => r.employees_total));
    // A one-site figure is never described as buildings, anywhere.
    const s = rows[1]!;
    const said = [
      ...buildDiscoverCard(s, opts).meta.map((m) => m.text),
      tableRows[1]!.workersCoverage ?? "",
      tableRows[1]!.workersSecond ?? "",
      ...Object.values(discoverCsvValue(s, TODAY)),
    ].join(" | ");
    assert.doesNotMatch(said, /buildings/, `a standalone factory described as a group: ${said}`);
    // The card says the same two things, in the same order.
    const meta = buildDiscoverCard(rows[3]!, opts).meta.map((m) => m.text);
    const i = meta.indexOf("300 workers · on the supplier record");
    assert.ok(i >= 0, `the card does not headline the sorted figure: ${meta.join(" | ")}`);
    assert.equal(meta[i + 1], "9,000 workers · across this record and its buildings");
    const cardHtml = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildDiscoverCard(rows[4]!, opts) }));
    assert.match(cardHtml, /No worker figure on the supplier record/);
    assert.doesNotMatch(cardHtml, /Workers not on file/, "not on file, directly above a worker figure");
    // With no figure anywhere, the plain words stay.
    const none = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildDiscoverCard({ ...ROW, employees_total: null }, opts) }));
    assert.match(none, /Workers not on file/);
    assert.match(cardHtml, /907 workers · across its buildings, not this record/);
    // And the export: `workers` is the sorted figure.
    assert.deepEqual(rows.map((r) => discoverCsvValue(r, TODAY).workers), ["5000", "550", "400", "300", ""]);
  });

  it("the Workers sort orders on the supplier's own figure — the one the page headlines", () => {
    // The headline is `workers_own`, the pre-overwrite employees_total. That
    // is only the sorted figure while 0104 sorts on suppliers.employees_total.
    // Code only: a reverted line kept in a comment must not satisfy it. CI
    // runs both branches' sort for real (assert-0104.sql).
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--[^\n]*/g, "");
    const keys = [...sql.matchAll(/case when v_sort = 'workers' then (\w+)\.(\w+) end desc nulls last/g)];
    assert.equal(keys.length, 2, "expected the workers sort in both discover_suppliers branches");
    for (const k of keys) assert.equal(k[2], "employees_total", `the workers sort moved to ${k[1]}.${k[2]}`);
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

  it("no surface claims buildings for a row the batch gave no account of", () => {
    // Only `production_workers_display_batch`'s own `sites`/`includes_root`
    // may support wording about buildings or sites. A row with no basis has
    // none, so if the card, the table or the CSV claims it, this goes red.
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

describe("the Discover results page's selection checkboxes are real (spec §3.1)", () => {
  // The deliverable is an operable checkbox on every result — built from the
  // real builders, rendered inside the provider the page uses. A card or row
  // that lost its supplier id, or stopped opting in, fell back to the inert
  // aria-disabled placeholder with every other test green.
  it("every card and table row checkbox is tabbable and not aria-disabled, and names its supplier", () => {
    const card = buildDiscoverCard(ROW, { today: TODAY, hsLines: [], hsError: false });
    const row = buildDiscoverTableRow(ROW, { today: TODAY, hsLines: [], hsError: false });
    assert.equal(card.supplierId, ROW.id);
    assert.equal(row.supplierId, ROW.id);
    for (const html of [
      renderToStaticMarkup(createElement(SelectionProvider, { pageIds: [ROW.id] }, createElement(SupplierResultCard, { card }))),
      renderToStaticMarkup(createElement(SelectionProvider, { pageIds: [ROW.id] }, createElement(ResultsTable, { rows: [row] }))),
    ]) {
      const boxes = [...html.matchAll(/<span[^>]*role="checkbox"[^>]*>/g)].map((m) => m[0]);
      const rowBoxes = boxes.filter((b) => /aria-label="Select A\.R\. Fashion/.test(b));
      assert.equal(rowBoxes.length, 1, `expected one checkbox for the row, got: ${boxes.join(" | ")}`);
      assert.match(rowBoxes[0] ?? "", /tabindex="0"/);
      assert.doesNotMatch(rowBoxes[0] ?? "", /aria-disabled/);
    }
  });

  it("outside a provider (the /dev/ds gallery) the same card keeps the inert placeholder", () => {
    const card = buildDiscoverCard(ROW, { today: TODAY, hsLines: [], hsError: false });
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    const box = html.match(/<span[^>]*role="checkbox"[^>]*>/)![0];
    assert.match(box, /aria-disabled="true"/);
    assert.doesNotMatch(box, /tabindex/);
  });
});
