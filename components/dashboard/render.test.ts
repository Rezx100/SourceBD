// Boundary tests for the dashboard kit (closed-loop §14): what a buyer's
// browser receives — the rendered HTML — for the named test records of the
// rebuild spec §3, built through the same builders the gallery uses.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildCard, buildProductSheet, buildRfqRow, buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import {
  aboniInput,
  arFashionInput,
  buildingOnlyCertificateInput,
  buildingRegistrationsInput,
  HOSSAIN_BUILDING,
  MG_BUILDING,
  inheritedPillsInput,
  longestHsListInput,
  longestProductListInput,
  sanctionedInput,
  smKnitwearInput,
  TODAY,
  ZAHEEN_NAME,
  zaheenSampleInput,
} from "@/lib/dashboard/fixtures";
import type { RfqListModel } from "@/lib/dashboard/models";
import { Meter } from "./controls";
import { PanelFooter, PanelHeader } from "./results-panel";
import { ProductSheet } from "./product-sheet";
import { ResultsTable } from "./results-table";
import { RfqComposer, type RfqComposerModel } from "./rfq-composer";
import { RFQ_EMPTY_COPY, RFQ_ERROR_COPY, RfqList } from "./rfq-list";
import { SearchComposer } from "./search-composer";
import { SupplierResultCard } from "./supplier-result-card";
import { SupplierSheet } from "./supplier-sheet";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
const rx = (s: string) => new RegExp(escape(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/** Any class that would cut a name off. Names wrap, never truncate (spec §2, §9); a tile's one-line caption may ellipsise. */
const TRUNCATION = /\b(?:truncate|line-clamp-\d)\b/;
/** The name element itself must carry the wrap rule. */
const NAME_WRAPS = /class="[^"]*\[overflow-wrap:anywhere\][^"]*">Aboni Knitwear Ltd</;

/** Colour hand-typed into markup instead of a token class. */
const HAND_TYPED_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/;

/** Anything a buyer could read as a SourceBD opinion rather than a receipt (spec §2). */
const SCORE = /\d+\s*%\s*match|match(?:ed)?\s*\d+\s*%|\bscore\b|\brating\b|★|\bVerified\b/i;

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
    assert.doesNotMatch(html, SCORE);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
    assert.doesNotMatch(html, /disabled=""/, "Send RFQ is enabled on a clean record");
  });

  // Cycle 5, finding 8: the figure is 2,662 (mother) + 504 (New Shed).
  it("a group worker figure says how many sites it covers, on the card and in the table", () => {
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    assert.match(card, /3,166 workers across 2 of 2 sites/);
    const sm = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(smKnitwearInput())] }));
    assert.match(sm, /907/);
    assert.match(sm, /1 of 2 sites/, "the 907 belongs to the Extension building, not to the company");
  });

  // Cycle 5, finding 18: the results panel renders no #certificates or #sources.
  it("no tile links to a fragment of a page that does not have it", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    for (const dead of ['href="#sources"', 'href="#certificates"', 'href="#products"', 'href="#locations"', 'href="#facilities"', 'href="#rfqs"', 'href="#hidden"']) {
      assert.ok(!html.includes(dead), `the card links to ${dead}, an anchor this page does not render`);
    }
    assert.match(html, /href="\/app\/suppliers\/aboni-knitwear#certificates"/);
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
    assert.match(html, rx(ZAHEEN_NAME));
    assert.doesNotMatch(html, TRUNCATION);
  });

  // Cycle 5, test-adequacy critic: removing the sanction treatment from the
  // card and the table row left all 770 tests green, because only the
  // ProductSheet had a fixture whose `is_sanctioned` was genuinely true.
  it("a production sanction — not the gallery's sample flag — reaches the card and the table row", () => {
    const input = sanctionedInput();
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
    assert.match(card, /data-sanctioned="true"/);
    assert.match(card, /before:bg-sanction/);
    assert.match(card, /Sanctioned\. Matched on a sanctions screen; RFQs cannot be sent\./);
    assert.doesNotMatch(card, /sample record/, "a production sanction is not labelled a sample");
    assert.match(card, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);

    const row = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(input)] }));
    assert.match(row, /data-sanctioned="true"/);
    assert.match(row, /shadow-\[inset_4px_0_0_rgb\(var\(--ds-sanction\)\)\]/);
    assert.match(row, /text-sanction-ink[^>]*>(?:<[^>]*>)*\s*Sanctioned</);
    assert.equal((row.match(/<button[^>]*disabled=""/g) ?? []).length, 1);

    const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    assert.match(sheet, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(sheet, /Sanctioned — matched on a sanctions screen\. RFQs cannot be sent to this supplier\./);
    assert.match(sheet, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);
  });

  // Cycle 5, test-adequacy critic: "SourceBD score 92 % match ★★★★" could be
  // inserted into the table, the sheet and the product sheet with the suite
  // still green — the no-score assertion guarded the card alone.
  it("no surface renders a score, a grade, a star or a verified badge", () => {
    const rich = aboniInput();
    const surfaces: [string, string][] = [
      ["card", renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(rich) }))],
      ["table", renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(rich), buildTableRow(smKnitwearInput()), buildTableRow(arFashionInput())] }))],
      ["sheet", renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(rich) }))],
      ["product sheet", renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(rich, "6105") }))],
    ];
    for (const [name, html] of surfaces) assert.doesNotMatch(html, SCORE, `${name} renders something a buyer could read as a SourceBD opinion`);
  });

  it("the almost-empty record is quiet: dashes with reasons, the dashed no-lines slot, nothing red or amber", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(arFashionInput()) }));
    assert.match(html, /1 source</);
    assert.match(html, /District, year and workers not on file/);
    assert.match(html, /none on 4 registers/);
    assert.match(html, /not on the EPB list/);
    assert.match(html, /not on 4 brand lists read/);
    assert.match(html, /No export lines on file/);
    assert.match(html, /no EPB record/, "EPB holds no record for this supplier: no read date is invented");
    assert.doesNotMatch(html, /checked \d/);
    assert.match(html, /Nothing else on file · 1 of 25 sources/);
    assert.doesNotMatch(html, /bg-caution|bg-sanction|text-sanction/);
    assert.doesNotMatch(html, /\/products\/hs\//, "no substitute photo");
  });

  // Cycle 5, finding 2.
  it("a parent factory's register numbers never reach a satellite's card", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(inheritedPillsInput()) }));
    for (const leak of ["6077", "BD05954", "GOTS-28029", "37940-100", "bgmea.com.bd/member/54", "exporter/313"]) {
      assert.ok(!html.includes(leak), `the parent factory's ${leak} reached the satellite's card`);
    }
    assert.match(html, /1 source</);
    assert.match(html, /not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB/);
  });

  // Cycle 5, finding 3.
  it("a building's registration is named, not denied", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(buildingRegistrationsInput()) }));
    assert.match(html, rx(`registered under ${HOSSAIN_BUILDING}`));
    assert.doesNotMatch(html, /not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB<\/span>/, "the bare negative stands over a payload that carries a BKMEA row");
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

  // Cycle 5, finding 3: the row printed "not on EPB list" for a record holding
  // an EPB registration, contradicting the card for the same record.
  it("on the EPB register with no lines, the row says so — it never calls the record absent", () => {
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow({ ...aboniInput(), hscodes: [] })] }));
    assert.match(html, /— no lines on the EPB page/);
    assert.doesNotMatch(html, /not on EPB list/);
  });

  // Cycle 5, finding 20.
  it("every column has a name, and the Export-lines thumbs are announced", () => {
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(aboniInput())] }));
    assert.doesNotMatch(html, /<th[^>]*><\/th>/, "a column with no visible heading still needs a name");
    assert.match(html, /<span class="sr-only">Select<\/span>/);
    assert.match(html, /<span class="sr-only">Actions<\/span>/);
    assert.match(html, /role="img" aria-label="HS 6115 · Socks, hosiery"/);
    assert.match(html, /role="checkbox" tabindex="0"/, "a checkbox role with no tabindex cannot be reached by keyboard");
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
    const locked = /data-locked="true"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? "";
    assert.doesNotMatch(locked, /EPB|BGMEA|BKMEA|BGAPMEA|website|named representatives|phone/, "the locked card claims no kinds and no registers until contact_counts exists");
    assert.match(html, /source pending/, "unattributed profile facts say so instead of carrying a guessed mark");
    assert.doesNotMatch(html, /items · BGMEA/);
    assert.match(html, /GOTS-31587/);
    assert.match(html, /Expires 29 Sep 2026 · 11 days/);
    assert.match(html, /No expiry on file/);
    assert.match(html, /Expired 4 Apr 2026/);
    assert.match(html, /role="meter"[^>]*aria-valuenow="100"/);
    assert.match(html, /Source marks link to their register page where one is on file/);
    assert.doesNotMatch(html, /Every fact links to its source page/);
    assert.doesNotMatch(html, /blur/, "locked is striped, never blurred");
    assert.doesNotMatch(html, /disabled=""/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
  });

  // Cycle 5, finding 14 / handoff §4.6: an unclaimed supplier is not reached
  // until REZ-D ships behind RFQ_EMAIL_UNCLAIMED, and the RPC does not say
  // whether this record has been claimed.
  it("nothing on the sheet promises the supplier will reply", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.doesNotMatch(html, /reply lands in Messages/);
    assert.doesNotMatch(html, /reaches the supplier through SourceBD either way/);
    assert.match(html, /Send an RFQ from the record instead\./);
  });

  // Cycle 5, finding 22: §8 settled on "Save".
  it("the action bar reads Save, not Save to list", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.doesNotMatch(html, /Save to list/);
    assert.match(html, /<\/svg>\s*Save<\/button>|>\s*Save<\/button>/);
  });

  // Cycle 5, finding 18.
  it("a tab whose section the sheet does not render is inert, never a link to a missing anchor", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    for (const dead of ['href="#sources"', 'href="#locations"', 'href="#facilities"', 'href="#rfqs"', 'href="#hidden"']) {
      assert.ok(!html.includes(dead), `the sheet links to ${dead}, an anchor it does not render`);
    }
    for (const id of ["overview", "products", "certificates", "safety"]) {
      assert.ok(html.includes(`href="#${id}"`) && html.includes(`id="${id}"`), `#${id} is linked and rendered`);
    }
    assert.match(html, /aria-disabled="true"[^>]*>Sources/);
  });

  // Cycle 5, finding 17: `[].every()` is true, so a record with no marks at all
  // rendered the strongest claim on the sheet.
  it("'every source mark links to its register page' is never claimed over zero marks", () => {
    const bare = aboniInput();
    // The RSC display batch attributes the worker figure, so its mark has to go
    // too — otherwise the sheet has one mark and this is not the zero case.
    bare.workers = null;
    bare.profile.supplier.source_tags = [];
    bare.profile.pills = [];
    bare.profile.certifications = [];
    bare.profile.brand_attributions = [];
    bare.profile.provenance = [];
    bare.profile.rsc_remediation = null;
    // The address rows carry marks of their own; with them the row is not the
    // zero-mark case this guard is about.
    bare.profile.addresses = [];
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(bare) }));
    assert.doesNotMatch(html, /Every source mark links to its register page/);
    assert.match(html, /Source marks link to their register page where one is on file/);
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

  // Cycle 5, finding 11.
  it("the products stat names every chapter the lines span", () => {
    const sm = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(smKnitwearInput()) }));
    assert.match(sm, /EPB, chapters 61 and 62/);
    const aboni = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(aboni, /EPB, chapter 61/);
  });

  // Cycle 5, finding 3: the building's GOTS certificate is not this record's,
  // and saying nothing about it leaves the section looking short of one.
  it("a building's certificate is named on the sheet, not counted as the record's", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(buildingRegistrationsInput()) }));
    assert.match(html, rx(`${HOSSAIN_BUILDING} holds a certificate of its own`));
    assert.doesNotMatch(html, /GOTS-15431/, "the building's certificate is not rendered as this record's");
    assert.match(html, rx(`registered under ${HOSSAIN_BUILDING}`));
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

  // Cycle 4 fix, unguarded until cycle 6: the RSC block renders no meter when
  // the percentage is unknown, and never "NaN %".
  it("an unknown remediation percentage renders no meter and no NaN", () => {
    const input = aboniInput();
    const rows = input.profile.rsc_remediation as Record<string, unknown>[];
    delete rows[0]!.progress_pct;
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    assert.doesNotMatch(html, /NaN/);
    assert.doesNotMatch(html, /role="meter"/);
    assert.match(html, /Remediation not on file/);
  });

  // Cycle 4 fix, unguarded until cycle 6: the date beside "RSC factory 9342" is
  // the RSC row's own fetch, not the profile's latest read of any register.
  it("the safety caption carries the RSC row's own read date", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(html, /RSC factory 9342 · read 30 Jul 2026/);
    assert.doesNotMatch(html, /RSC factory 9342 · read 18 Sep 2026/);
  });

  // Cycle 1 fix (the Safety section was unreachable behind overflow-hidden),
  // unguarded until cycle 6.
  it("the sheet body scrolls, so the last section can be reached", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(html, /class="min-h-0 flex-1 overflow-y-auto"/);
    const body = /class="min-h-0 flex-1 overflow-y-auto"([\s\S]*)$/.exec(html)?.[1] ?? "";
    assert.match(body, /id="safety"/, "Safety sits inside the scrolling body");
  });

  // Cycle 5, test-adequacy critic: flattening TIER_FILL to one colour left the
  // suite green — the rank ramp never reached an assertion on the DOM.
  it("the source-rank ramp reaches the DOM: a tier-1 mark and a tier-4 mark do not share a class", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(html, /aria-label="Source: Export Promotion Bureau[^"]*"[^>]*class="[^"]*bg-tier-1 text-tier-1-on/);
    assert.match(html, /aria-label="Source: Bangladesh Garment Manufacturers[^"]*"[^>]*class="[^"]*bg-tier-2 text-tier-2-on/);
    assert.match(html, /aria-label="Source: Global Organic Textile Standard[^"]*"[^>]*class="[^"]*bg-tier-3 text-tier-3-on/);
    assert.match(html, /aria-label="Source: ASOS[^"]*"[^>]*class="[^"]*bg-tier-4 text-tier-4-on/);
    for (const n of [1, 2, 3, 4]) assert.ok(html.includes(`bg-tier-${n} text-tier-${n}-on`), `tier ${n} has its own fill`);
  });

  // Cycle 5, test-adequacy critic: `hscodesError` was asserted on the model only.
  it("a failed lines read says so in the HTML, on the card and on the sheet", () => {
    const failed = { ...aboniInput(), hscodes: [], hscodesError: true };
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(failed) }));
    assert.match(card, /EPB lines could not be read/);
    assert.match(card, /Export lines could not be read/);
    assert.match(card, /try again later/);
    assert.doesNotMatch(card, /No export lines on file/);
    const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(failed) }));
    assert.match(sheet, /EPB export lines could not be read/);
    assert.match(sheet, /could not be read/);
    assert.doesNotMatch(sheet, /Not on the EPB exporter list/);
  });

  // Cycle 5, test-adequacy critic: the "no photo yet" fallback appeared in no
  // test file, so substituting a photo for a photo-less heading stayed green.
  it("a heading with no photo shows its code and says so — nothing is substituted", () => {
    const input = aboniInput();
    input.hscodes = [{ code: "9999", description: "A heading the catalogue has no photo for", source_url: null }];
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
    assert.match(html, /no photo yet/);
    assert.match(html, /HS 9999/);
    assert.doesNotMatch(html, /\/products\/hs\/hs-\d{4}\.webp/, "no other heading's photo stands in for it");
  });
});

// Cycle 5, finding 15: the footer read "1–4 of 42 · 25 per page · Page 1 of 2"
// over a four-row panel, with Next enabled and no page 2.
describe("PanelFooter (rendered)", () => {
  it("a panel that does not page renders no pager and no page size", () => {
    const html = renderToStaticMarkup(createElement(PanelFooter, { shown: 4, total: 42, note: "the named test records" }));
    assert.match(html, /1–4 of 42 · the named test records/);
    assert.doesNotMatch(html, /per page/);
    assert.doesNotMatch(html, /Page 1 of/);
    assert.doesNotMatch(html, /aria-label="Next page"/);
  });

  it("a short last page renders no Next", () => {
    const html = renderToStaticMarkup(createElement(PanelFooter, { shown: 4, total: 42, perPage: 25 }));
    assert.doesNotMatch(html, /Page 1 of 2/, "four rows out of a 25-row page is the whole page");
    assert.doesNotMatch(html, /aria-label="Next page"/);
  });

  it("a full page renders the pager it can honour", () => {
    const html = renderToStaticMarkup(createElement(PanelFooter, { shown: 25, total: 42, perPage: 25 }));
    assert.match(html, /1–25 of 42/);
    assert.match(html, /25 per page/);
    assert.match(html, /Page 1 of 2/);
    assert.match(html, /aria-label="Next page"/);
    assert.doesNotMatch(html, /aria-label="Next page"[^>]*disabled=""/);
  });
});

describe("AI surfaces are absent when AI is off (handoff §7)", () => {
  const model: RfqComposerModel = {
    title: "New RFQ",
    context: "sample",
    targets: [{ name: "Aboni Knitwear Ltd", sanctioned: false }],
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

  // Cycle 5, finding 1: the composer had no sanction handling at all — no
  // banner, no model field, and Send went green as soon as four fields were
  // filled. §3.6: Send stays disabled until every supplier is not sanctioned.
  it("RfqComposer: a sanctioned target carries the banner, names the supplier and kills Send", () => {
    const sanctioned: RfqComposerModel = { ...model, targets: [{ name: "Zaheen Knitwears Limited", sanctioned: true }] };
    const html = renderToStaticMarkup(createElement(RfqComposer, { model: sanctioned }));
    assert.match(html, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(html, /Sanctioned — matched on a sanctions screen\. RFQs cannot be sent to this supplier\./);
    assert.match(html, /Zaheen Knitwears Limited/);
    assert.match(html, /RFQs cannot be sent to a sanctioned supplier/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);
  });

  it("RfqComposer: Send is live only when nothing is missing and no target is sanctioned", () => {
    const clean = renderToStaticMarkup(createElement(RfqComposer, { model }));
    assert.doesNotMatch(clean, /role="alert"/);
    assert.doesNotMatch(clean, /disabled=""/);
    const missing = renderToStaticMarkup(createElement(RfqComposer, { model: { ...model, missing: ["target price"] } }));
    assert.match(missing, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);
  });

  it("RfqComposer: the sample label survives, and the preview promises no reply", () => {
    const sample: RfqComposerModel = { ...model, targets: [{ name: "Zaheen Knitwears Limited", sanctioned: true, sanctionSample: true }] };
    const html = renderToStaticMarkup(createElement(RfqComposer, { model: sample }));
    assert.match(html, /Sanctioned · sample record — matched on a sanctions screen/);
    const clean = renderToStaticMarkup(createElement(RfqComposer, { model }));
    assert.doesNotMatch(clean, /replies land in Messages/);
    assert.match(clean, /Your email and phone are not shared\. The supplier&#x27;s contact details stay on their record\./);
  });
});

describe("ProductSheet (rendered)", () => {
  it("HS 6105: eyebrow, official heading, the illustrative caption, other lines in mono, the live exporter count", () => {
    const html = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6105") }));
    assert.match(html, /HS 6105 · EPB export line/);
    assert.match(html, /Men&#x27;s or boys&#x27; shirts, knitted or crocheted/);
    assert.match(html, /Illustrative photo, keyed to the HS code 6105/);
    assert.match(html, /\/products\/hs\/hs-6105\.webp/);
    assert.match(html, /EPB lists lines, not dates/);
    assert.match(html, /supplier-attested fields, shown when attested/);
    assert.match(html, /Other exporters of 6105/);
    assert.match(html, /1,634/);
    assert.doesNotMatch(html, /Sanctioned/, "a clean record carries no sanction banner");
    assert.doesNotMatch(html, /disabled=""/, "Send RFQ is enabled on a clean record");
  });

  // Cycle 5, finding 9: the eyebrow called every heading an EPB export line,
  // and the sheet then contradicted itself three rows down.
  it("a heading the record does not export is not called an EPB export line", () => {
    const html = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6205") }));
    assert.match(html, /HS 6205 · not on this record&#x27;s EPB page/);
    assert.doesNotMatch(html, /EPB export line/);
    assert.match(html, /this line is not on the record&#x27;s EPB page/);
    assert.doesNotMatch(html, /Other exporters of 6205<\/button>[\s\S]{0,40}font-mono/);
  });

  // Cycle 5, finding 9: the chapter name is the HS nomenclature, and it was
  // stamped with an EPB mark — on a record with no EPB registration at all.
  it("the chapter row carries no register mark", () => {
    const html = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(arFashionInput(), "6105") }));
    const chapter = /Chapter<\/span>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    assert.doesNotMatch(chapter, /aria-label="Source: /, "the nomenclature is not something a register published");
    assert.match(chapter, /HS nomenclature/);
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
    assert.match(html, rx(RFQ_EMPTY_COPY));
    assert.match(html, /0 sent · 0 quotes/);
    assert.doesNotMatch(html, /sorry|no results/i);
  });

  // Cycle 5, finding 4: a failed `rfq_list` read rendered as the fact "you have
  // no RFQs", in the empty state written to sell the feature.
  it("a failed read says so — it never renders the empty state as a fact about the account", () => {
    const model: RfqListModel = {
      sent: 0,
      quotes: 0,
      chips: [{ label: "All", count: 0, on: true }],
      rows: [],
      footer: "The RFQ list could not be read",
      toast: null,
      error: true,
    };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.match(html, rx(RFQ_ERROR_COPY));
    assert.match(html, /role="status"/);
    assert.ok(!html.includes(escape(RFQ_EMPTY_COPY)), "the empty state claims the account has no RFQs");
    assert.doesNotMatch(html, /Find suppliers/);
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
    assert.doesNotMatch(html, /data-sanctioned/);
    assert.doesNotMatch(html, TRUNCATION);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
  });

  // Cycle 5, finding 1: the RFQ list is one of the six screens, and it had no
  // sanction handling at all. A sanction may not be hidden by layout (spec §2).
  it("a row whose supplier is sanctioned carries the warning", () => {
    const base = { id: "r1", product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, quote_count: 0, created_at: "2026-09-09T10:00:00Z" } as const;
    const rows = [buildRfqRow({ ...base, status: "open" }, { name: "Zaheen Knitwears Limited", tier: 1, sanctioned: true, sanctionSample: true }, TODAY)];
    const model: RfqListModel = { sent: 1, quotes: 0, chips: [{ label: "All", count: 1, on: true }], rows, footer: "1–1 of 1", toast: null };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.match(html, /data-sanctioned="true"/);
    assert.match(html, /shadow-\[inset_4px_0_0_rgb\(var\(--ds-sanction\)\)\]/);
    assert.match(html, /Sanctioned · sample — RFQs cannot be sent/);
    assert.match(html, /text-sanction-ink/);
  });

  // Cycle 5, finding 20.
  it("the RFQ table's unnamed columns have names", () => {
    const model: RfqListModel = {
      sent: 1,
      quotes: 0,
      chips: [],
      rows: [buildRfqRow({ id: "r1", product_title: "T", quantity: 1, quantity_unit: "pcs", ship_by: null, status: "open", target_supplier_count: 1, quote_count: 0, created_at: "2026-09-09T10:00:00Z" }, null, TODAY)],
      footer: "1–1 of 1",
      toast: null,
    };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.doesNotMatch(html, /<th[^>]*><\/th>/);
    assert.match(html, /<span class="sr-only">Select<\/span>/);
    assert.match(html, /<span class="sr-only">Actions<\/span>/);
  });
});

// Spec §6 asks for the 54-code and 39-product lists on the screens that carry
// them; neither reached a test before cycle 6.
describe("the largest lists the database holds (spec §3, §6)", () => {
  it("54 export codes: six tiles, the rest counted, nothing truncated", () => {
    const input = longestHsListInput();
    const card = buildCard(input);
    assert.equal(card.totalLines, 54);
    assert.equal(card.photos.length, 6);
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    assert.match(html, /54 HS lines/);
    assert.match(html, /\+48\s*</, "six tiles shown, forty-eight counted");
    assert.doesNotMatch(html, TRUNCATION);

    const sheet = buildSheet(input);
    assert.equal(sheet.products.lines, 54);
    // 5208 (cotton fabric) and 5905 (wall coverings) sit outside chapters 61–63.
    assert.deepEqual(sheet.products.chapters, ["52", "55", "59", "60", "61", "62", "63", "65"]);
    const sheetHtml = renderToStaticMarkup(createElement(SupplierSheet, { model: sheet }));
    assert.match(sheetHtml, /Products<span[^>]*>54</);
    assert.match(sheetHtml, /EPB, chapters 52, 55, 59, 60, 61, 62, 63 and 65/);
    assert.doesNotMatch(sheetHtml, TRUNCATION);
  });

  it("39 principal products: the count is exact and the sheet names how many it did not list", () => {
    const input = longestProductListInput();
    const sheet = buildSheet(input);
    assert.equal(sheet.products.productListCount, 39);
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: sheet }));
    assert.match(html, /Product list<\/span><span[^>]*>39<\/span><span[^>]*>items on file · source pending/);
    const ps = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(input, "6105") }));
    assert.match(ps, /\+35 items/, "four are listed, thirty-five counted — never a silent truncation");
    assert.doesNotMatch(ps, TRUNCATION);
  });
});

// Spec §3: "1–25 of 10,266"; the count is the RPC's and its plural follows it.
describe("PanelHeader (rendered)", () => {
  const model = { title: "Knitted shirts · GOTS valid", total: 42, shown: 4, sortLabel: "Most sources", view: "cards" as const };
  it("counts are the RPC's, with the plural the count deserves", () => {
    assert.match(renderToStaticMarkup(createElement(PanelHeader, { model })), /42 suppliers · 1–4/);
    assert.match(renderToStaticMarkup(createElement(PanelHeader, { model: { ...model, total: 1, shown: 1 } })), /1 supplier · 1–1/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(PanelHeader, { model: { ...model, total: 1, shown: 1 } })), /1 suppliers/);
    assert.match(renderToStaticMarkup(createElement(PanelHeader, { model: { ...model, total: 10266 } })), /10,266 suppliers/);
  });

  it("a failed count reads as unknown, never as zero", () => {
    const html = renderToStaticMarkup(createElement(PanelHeader, { model: { ...model, total: null } }));
    assert.match(html, /count could not be read/);
    assert.doesNotMatch(html, /0 suppliers|null/);
  });

  it("an empty page says so rather than claiming a range", () => {
    assert.match(renderToStaticMarkup(createElement(PanelHeader, { model: { ...model, shown: 0 } })), /none on this page/);
  });
});

// Cycle 5, finding 16: an RSC row that omits `progress_pct` rather than nulling
// it reached the bar as `aria-valuenow="NaN"`. The builder no longer passes one,
// and the component refuses it too — a screen reader announcing "NaN percent"
// is worse than no meter.
describe("Meter (rendered)", () => {
  it("a percentage that is not a number renders 0, never NaN", () => {
    for (const pct of [Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      const html = renderToStaticMarkup(createElement(Meter, { pct }));
      assert.doesNotMatch(html, /NaN|Infinity/);
      assert.match(html, /aria-valuenow="0"/);
      assert.match(html, /width:0%/);
    }
  });

  it("a real percentage is clamped to the bar's range", () => {
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: 53 })), /aria-valuenow="53"/);
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: 140 })), /aria-valuenow="100"/);
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: -5 })), /aria-valuenow="0"/);
  });
});

// Cycle 5, finding 3, at the boundary: nothing of this record's own softens the
// claim, so the bare "none on 4 registers" would stand over a real certificate.
describe("a record whose only certificate belongs to a building", () => {
  it("names the building on the card, the row and the sheet", () => {
    const only = buildingOnlyCertificateInput();
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(only) }));
    assert.match(card, rx(`none on this record · ${MG_BUILDING} holds one`));
    assert.doesNotMatch(card, /none on 4 registers/);
    assert.match(card, /Unknown type/);

    const row = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(only)] }));
    assert.match(row, rx(`${MG_BUILDING} holds one`));
    assert.doesNotMatch(row, /— none on 4 registers/);

    const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(only) }));
    assert.match(sheet, rx(`${MG_BUILDING} holds a certificate of its own`));
    assert.doesNotMatch(sheet, /31314-100/, "the building's certificate is not rendered as this record's");
  });
});
