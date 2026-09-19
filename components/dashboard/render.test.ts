// Boundary tests for the dashboard kit (closed-loop §14): what a buyer's
// browser receives — the rendered HTML — for the named test records of the
// rebuild spec §3, built through the same builders the gallery uses.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildCard, buildProductSheet, buildRfqRow, buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import { aboniInput, arFashionInput, smKnitwearInput, TODAY, ZAHEEN_NAME, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import type { RfqListModel } from "@/lib/dashboard/models";
import { ProductSheet } from "./product-sheet";
import { ResultsTable } from "./results-table";
import { RfqComposer, type RfqComposerModel } from "./rfq-composer";
import { RFQ_EMPTY_COPY, RfqList } from "./rfq-list";
import { SearchComposer } from "./search-composer";
import { SupplierResultCard } from "./supplier-result-card";
import { SupplierSheet } from "./supplier-sheet";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

/** Any class that would cut a name off. Names wrap, never truncate (spec §2, §9); a tile's one-line caption may ellipsise. */
const TRUNCATION = /\b(?:truncate|line-clamp-\d)\b/;
/** The name element itself must carry the wrap rule. */
const NAME_WRAPS = /class="[^"]*\[overflow-wrap:anywhere\][^"]*">Aboni Knitwear Ltd</;

/** Colour hand-typed into markup instead of a token class. */
const HAND_TYPED_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/;

describe("SupplierResultCard (rendered)", () => {
  it("the 11-source record: name, eleven marks with names, four tiles, six photo tiles, no score anywhere", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    assert.match(html, NAME_WRAPS);
    assert.equal((html.match(/aria-label="Source: /g) ?? []).length, 11 + 1, "11 in the mark row, 1 beside the one attributed meta fact (workers, from RSC)");
    assert.match(html, /<a href="https:\/\/www\.bgmea\.com\.bd\/member\/71"[^>]*aria-label="Source: Bangladesh Garment Manufacturers &amp; Exporters Association \(opens the register page\)"/);
    assert.match(html, /11 sources/);
    assert.match(html, /Bangladesh Garment Manufacturers &amp; Exporters Association/);
    assert.match(html, /4 on file/);
    assert.match(html, /12 HS lines/);
    assert.equal((html.match(/\/products\/hs\/hs-\d{4}\.webp/g) ?? []).length, 6);
    assert.match(html, /HS 6115/);
    assert.match(html, /Illustrative photos, one per HS heading/);
    assert.doesNotMatch(html, /\d+\s*%\s*match|match(?:ed)?\s*\d+\s*%|score|rating|★/i);
    assert.doesNotMatch(html, /Verified/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
    assert.doesNotMatch(html, /disabled=""/, "Send RFQ is enabled on a clean record");
  });

  it("on the EPB register with no lines read, the card says so rather than calling the record absent", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard({ ...aboniInput(), hscodes: [] }) }));
    assert.match(html, /EPB exporter · no lines on file/);
    assert.doesNotMatch(html, /Not on the EPB exporter list/);
  });

  it("the sanctioned sample: the bar, the notice, the badge first, Send RFQ disabled, the full 100-character name", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(zaheenSampleInput()) }));
    assert.match(html, /data-sanctioned="true"/);
    assert.match(html, /before:bg-sanction/);
    assert.match(html, /Sanctioned · sample record\. Matched on a sanctions screen; RFQs cannot be sent\./);
    assert.match(html, /bg-sanction text-sanction-on">(?:<[^>]*>)*Sanctioned · sample/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);
    assert.match(html, new RegExp(escape(ZAHEEN_NAME).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, TRUNCATION);
  });

  it("the almost-empty record is quiet: dashes with reasons, the dashed no-lines slot, nothing red or amber", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(arFashionInput()) }));
    assert.match(html, /1 source</);
    assert.match(html, /District, year and workers not on file/);
    assert.match(html, /none on 4 registers/);
    assert.match(html, /not on the EPB list/);
    assert.match(html, /not on 6 brand lists/);
    assert.match(html, /No export lines on file/);
    assert.match(html, /no EPB record/, "EPB holds no record for this supplier: no read date is invented");
    assert.doesNotMatch(html, /checked \d/);
    assert.match(html, /Nothing else on file · 1 of 25 sources/);
    assert.doesNotMatch(html, /bg-caution|bg-sanction|text-sanction/);
    assert.doesNotMatch(html, /\/products\/hs\//, "no substitute photo");
  });

  it("never prints a contact value the payload carries but the kit has no slot for", () => {
    const input = zaheenSampleInput();
    for (const el of [
      createElement(SupplierResultCard, { card: buildCard(input) }),
      createElement(ResultsTable, { rows: [buildTableRow(input)] }),
      createElement(SupplierSheet, { model: buildSheet(input) }),
    ]) {
      const html = renderToStaticMarkup(el);
      assert.doesNotMatch(html, new RegExp(input.leaked.email_primary));
      assert.doesNotMatch(html, /1700 000000/);
    }
  });
});

describe("ResultsTable (rendered)", () => {
  it("36px rows, the sanctioned row inset + line + disabled Send RFQ, the empty row says why", () => {
    const rows = [buildTableRow(aboniInput()), buildTableRow(zaheenSampleInput()), buildTableRow(arFashionInput())];
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows }));
    assert.match(html, /h-row-dense/);
    assert.match(html, /GOTS valid/);
    assert.match(html, /WRAP Gold 11 d/);
    assert.equal((html.match(/\/products\/hs\/hs-\d{4}-128\.webp/g) ?? []).length, 3);
    assert.match(html, /\+9</, "twelve lines, three thumbs, nine more");
    assert.match(html, /3,166/);
    assert.match(html, /data-sanctioned="true"/);
    assert.match(html, /Sanctioned · sample/);
    assert.equal((html.match(/<button[^>]*disabled=""/g) ?? []).length, 1, "only the sanctioned row's Send RFQ is disabled");
    assert.match(html, /— none on 4 registers/);
    assert.match(html, /— not on EPB list/);
    assert.match(html, /Buying house/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
  });
});

describe("SupplierSheet (rendered)", () => {
  it("bar, tabs with counts, facts with marks, the locked contact card, certificates, the RSC meter, the action bar", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(html, /Supplier record/);
    assert.match(html, /Read 18 Sep 2026 · 11 sources/);
    assert.match(html, /Products<span[^>]*>12</);
    assert.match(html, /Certificates<span[^>]*>4</);
    assert.match(html, /Registered name/);
    assert.match(html, /ABONI KNITWEAR LTD\./);
    assert.match(html, /1,000,000 pcs\/day/);
    assert.match(html, /data-locked="true"/);
    assert.match(html, /locked-pattern/);
    assert.match(html, /Contact details<\/span>/, "no plan name unless settings give one");
    assert.doesNotMatch(html, /Team plan/);
    assert.match(html, /Contact details are shown on paid plans\./);
    assert.doesNotMatch(html, /reaches the supplier through SourceBD either way/, "unclaimed suppliers are not emailed until REZ-D");
    const locked = /data-locked="true"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? "";
    assert.doesNotMatch(locked, /EPB|BGMEA|BKMEA|BGAPMEA|website|named representatives|phone/, "the locked card claims no kinds and no registers until contact_counts exists");
    assert.match(html, /source pending/, "unattributed profile facts say so instead of carrying a guessed mark");
    assert.doesNotMatch(html, /items · BGMEA/);
    assert.match(html, /GOTS-31587/);
    assert.match(html, /Expires 29 Sep 2026 · 11 days/);
    assert.match(html, /No expiry on file/);
    assert.match(html, /Expired 4 Apr 2026/);
    assert.match(html, /role="meter"[^>]*aria-valuenow="100"/);
    assert.match(html, /Boiler · not on file/);
    assert.match(html, /Source marks link to their register page where one is on file/);
    assert.doesNotMatch(html, /Every fact links to its source page/);
    assert.doesNotMatch(html, /blur/, "locked is striped, never blurred");
    assert.doesNotMatch(html, /disabled=""/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
  });

  it("a sanctioned record carries the banner under the bar and a disabled Send RFQ", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput()) }));
    assert.match(html, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(html, /Sanctioned · sample record — matched on a sanctions screen/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);
  });

  it("the almost-empty record says Not on file with what was checked, no certificate on any register", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(arFashionInput()) }));
    assert.ok((html.match(/Not on file/g) ?? []).length >= 6);
    assert.match(html, /registers checked/);
    assert.match(html, /No certificate on any register/);
    assert.match(html, /No active RSC record on file/);
  });

  it("a mother whose only active RSC row is a building's shows the building, never its figures as the mother's", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(smKnitwearInput()) }));
    assert.match(html, /RSC covers S M Knitwears Limited\. \(Extension\) — the buildings, not this record/);
    assert.doesNotMatch(html, /Remediation 53 %/);
    assert.doesNotMatch(html, /role="meter"/);
  });

  // Registered on EPB but carrying no lines is not the same fact as being absent from the
  // register, and the screens must not print the second when the first is true.
  it("on the EPB register with no lines read: the sheet says so, never 'Not on the EPB exporter list'", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet({ ...aboniInput(), hscodes: [] }) }));
    assert.match(html, /On the EPB exporter register · no lines on file/);
    assert.match(html, /none on the EPB page/);
    assert.doesNotMatch(html, /Not on the EPB exporter list/);
    assert.doesNotMatch(html, /not on the EPB list/);
  });

  // The other direction, so the pair pins both branches: a record no register lists.
  it("absent from EPB: the sheet says the record is not on the list", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput()) }));
    assert.match(html, /Not on the EPB exporter list/);
    assert.doesNotMatch(html, /no lines on file/);
  });
});

describe("AI surfaces are absent when AI is off (handoff §7)", () => {
  const model: RfqComposerModel = {
    title: "New RFQ",
    context: "sample",
    draftSaved: null,
    steps: [
      { label: "Suppliers", detail: "one" },
      { label: "Follow-up rules", detail: "Draft a follow-up", v2: true },
    ],
    template: "first",
    subject: ["RFQ"],
    body: [["Dear"]],
    products: [],
    questions: [],
    moreQuestions: null,
    preview: { from: "x", subject: "y", paragraphs: [], footer: "z" },
    missing: [],
  };
  it("RfqComposer: no Improve wording, no V2 tag, no Follow-up rules step", () => {
    const off = renderToStaticMarkup(createElement(RfqComposer, { model, aiEnabled: false }));
    assert.doesNotMatch(off, /Improve wording|Follow-up rules|>V2</);
    assert.doesNotMatch(off, /text-smart/);
    const on = renderToStaticMarkup(createElement(RfqComposer, { model, aiEnabled: true }));
    assert.match(on, /Improve wording/);
    assert.match(on, /Follow-up rules/);
  });
  it("SearchComposer: the Ask stop is not rendered, not disabled", () => {
    const off = renderToStaticMarkup(createElement(SearchComposer, { chips: [], askEnabled: false }));
    assert.doesNotMatch(off, /Ask|>V2<|text-smart|aria-pressed/);
    const on = renderToStaticMarkup(createElement(SearchComposer, { chips: [], askEnabled: true }));
    assert.match(on, /Ask/);
  });
});

describe("ProductSheet (rendered)", () => {
  it("HS 6105: eyebrow, official heading, the illustrative caption, other lines in mono, the live exporter count", () => {
    const html = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6105") }));
    assert.match(html, /HS 6105 · EPB export line/);
    assert.match(html, /Men&#x27;s or boys&#x27; shirts, knitted or crocheted/);
    assert.match(html, /Illustrative photo for HS 6105/);
    assert.match(html, /\/products\/hs\/hs-6105\.webp/);
    assert.match(html, /EPB lists lines, not dates/);
    assert.match(html, /supplier-attested fields, shown when attested/);
    assert.match(html, /Other exporters of 6105/);
    assert.match(html, /1,634/);
    assert.doesNotMatch(html, /Sanctioned/, "a clean record carries no sanction banner");
    assert.doesNotMatch(html, /disabled=""/, "Send RFQ is enabled on a clean record");
  });

  // A sanction may never be hidden by layout (spec §2): the banner rides under the bar on the
  // product sheet too, and the line's own Send RFQ is dead.
  it("a sanctioned record: the banner under the bar and Send RFQ for this line disabled", () => {
    const input = aboniInput();
    const html = renderToStaticMarkup(
      createElement(ProductSheet, {
        model: buildProductSheet({ ...input, profile: { ...input.profile, supplier: { ...input.profile.supplier, is_sanctioned: true } } }, "6105"),
      }),
    );
    assert.match(html, /role="alert"[^>]*>(?:(?!<\/div>).)*Sanctioned — matched on a sanctions screen\. RFQs cannot be sent to this supplier\./s);
    assert.doesNotMatch(html, /sample record/, "a production sanction is not labelled a sample");
    assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ for this line/s);
  });

  // The gallery's labelled sample says so, so no one reads it as a real sanction.
  it("the sanctioned sample keeps its label", () => {
    const html = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet({ ...aboniInput(), sanctionSample: true }, "6105") }));
    assert.match(html, /Sanctioned · sample record — matched on a sanctions screen/);
  });
});

describe("RfqList (rendered)", () => {
  it("with no rows the page sells the feature instead of apologising", () => {
    const model: RfqListModel = {
      sent: 0,
      quotes: 0,
      chips: [{ label: "All", count: 0, on: true }],
      rows: [],
      footer: "No RFQs for this account yet",
      toast: null,
    };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.match(html, new RegExp(escape(RFQ_EMPTY_COPY)));
    assert.match(html, /0 sent · 0 quotes/);
    assert.doesNotMatch(html, /sorry|no results/i);
  });

  it("with rows: status words, dates, and an unresolved single supplier reads '1 supplier', never '1 suppliers'", () => {
    const base = { id: "r1", product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, quote_count: 0, created_at: "2026-09-09T10:00:00Z" } as const;
    const rows = [
      buildRfqRow({ ...base, status: "open" }, null, TODAY),
      buildRfqRow({ ...base, id: "r2", status: "open", ship_by: "2026-09-01", quote_count: 1 }, { name: "Quattro Fashion Limited", tier: 2 }, TODAY),
      buildRfqRow({ ...base, id: "r3", status: "open", target_supplier_count: 3 }, null, TODAY),
    ];
    const model: RfqListModel = { sent: 3, quotes: 0, chips: [{ label: "All", count: 3, on: true }], rows, footer: "1–3 of 3", toast: null };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.match(html, /1 supplier</);
    assert.doesNotMatch(html, /1 suppliers/);
    assert.match(html, /3 suppliers/);
    assert.match(html, /Quattro Fashion Limited/);
    assert.match(html, /Sent · awaiting reply/);
    assert.match(html, /Quoted · 1/);
    assert.doesNotMatch(html, /Reply overdue/, "overdue needs reply-by dates and threads (REZ-D)");
    assert.match(html, /9 Sep 2026/);
    assert.match(html, /24 Sep 2026/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
  });
});
