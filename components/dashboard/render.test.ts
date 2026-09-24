// Boundary tests for the dashboard kit (closed-loop §14): what a buyer's
// browser receives — the rendered HTML — for the named test records of the
// rebuild spec §3, built through the same builders the gallery uses.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildCard, buildProductSheet, buildRfqRow, buildSheet, buildTableRow, type RecordInput } from "@/lib/dashboard/build-models";
import {
  aboniInput,
  buildingBrandListsInput,
  arFashionInput,
  ASWAD_U2_EXT,
  buildingOnlyCertificateInput,
  buildingRegistrationsInput,
  buildingSafetyOnlyInput,
  duplicateBrandRowsInput,
  HOSSAIN_BUILDING,
  MG_BUILDING,
  inheritedPillsInput,
  longestHsListInput,
  longestNameInput,
  longestProductListInput,
  LONG_NAME_125,
  sanctionedInput,
  smKnitwearInput,
  TODAY,
  ZAHEEN_NAME,
  zaheenSampleInput,
} from "@/lib/dashboard/fixtures";
import type { RfqListModel } from "@/lib/dashboard/models";
import { Button, Checkbox, Meter, Seg } from "./controls";
import { Icon } from "./icons";
import { Panel, PanelFooter, PanelHeader } from "./results-panel";
import { ProductSheet } from "./product-sheet";
import { ResultsTable } from "./results-table";
import { RfqComposer, type RfqComposerModel } from "./rfq-composer";
import { AppShell } from "./app-shell";
import { Topbar } from "./app-shell";
import {
  SEARCH_FIELD_SELECTOR,
  focusSearchField,
  installSearchShortcut,
  isSearchShortcut,
  searchShortcutHandler,
  targetIsEditable,
  targetIsSearchField,
} from "./search-shortcut";
import { navMatch } from "./app-shell";
import { Chip } from "./chips";
import { PhotoStrip } from "./photo-tiles";
import { RFQ_EMPTY_COPY, RFQ_ERROR_COPY, RfqList } from "./rfq-list";
import { SearchComposer } from "./search-composer";
import { SelectionBar } from "./selection-bar";
import { saveSearchError } from "./save-search-form";
import { SELECT_ALL_ID, SelectionContext, SelectionProvider, type SelectionContextValue } from "./selection";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SupplierResultCard } from "./supplier-result-card";
import { SupplierSheet } from "./supplier-sheet";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
const rx = (s: string) => new RegExp(escape(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/** Any class that would cut a name off. Names wrap, never truncate (spec §2, §9); a tile's one-line caption may ellipsise. */
const TRUNCATION = /\b(?:truncate|line-clamp-\d)\b|\btext-ellipsis\b|\boverflow-hidden\b[^"]*\bwhitespace-nowrap\b|\bwhitespace-nowrap\b[^"]*\btext-ellipsis\b/;
/** The name element itself must carry the wrap rule. */
const NAME_WRAPS = /class="[^"]*\[overflow-wrap:anywhere\][^"]*">Aboni Knitwear Ltd</;

/** Colour hand-typed into markup instead of a token class. */
const HAND_TYPED_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/;

/** Anything a buyer could read as a SourceBD opinion rather than a receipt (spec §2). */
const SCORE = /\d+\s*%\s*match|match(?:ed)?\s*\d+\s*%|\bscore\b|\brating\b|★|\bVerified\b/i;

/**
 * The part of the Safety section that speaks for the record itself — everything
 * above the first building's own block. The two are separate claims and the
 * tests below must be able to say "not the mother's" without also forbidding
 * the building from showing the figures that are genuinely its own.
 */
function motherSafety(html: string): string {
  const start = html.indexOf('id="safety"');
  assert.ok(start >= 0, "the sheet has no Safety section");
  const section = html.slice(start, html.indexOf("</section>", start));
  const caption = section.indexOf("— the building&#x27;s own RSC record");
  return caption < 0 ? section : section.slice(0, section.lastIndexOf("<div", caption));
}

describe("SupplierResultCard (rendered)", () => {
  it("the 11-source record: name, eleven marks with names, four tiles, six photo tiles, no score anywhere", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    assert.match(html, NAME_WRAPS);
    assert.equal((html.match(/aria-label="Source: /g) ?? []).length, 11 + 1, "11 in the mark row, 1 beside the one attributed meta fact (workers, from RSC)");
    assert.match(html, /<a href="https:\/\/www\.bgmea\.com\.bd\/member\/71"[^>]*aria-label="Source: Bangladesh Garment Manufacturers &amp; Exporters Association, Industry bodies \(opens the register page\)"/);
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
    assert.match(card, /3,166 workers across 2 sites/);
    const sm = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(smKnitwearInput())] }));
    assert.match(sm, /907/);
    assert.match(sm, /1 of the 2 sites on file/, "the 907 belongs to the Extension building, not to the company");
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
    assert.ok(edgeInToken(html, "sanction"), "the card draws no sanction-token edge");
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
    assert.ok(edgeInToken(card, "sanction"), "the card draws no sanction-token edge");
    assert.match(card, /Sanctioned\. Matched on a sanctions screen; RFQs cannot be sent\./);
    assert.doesNotMatch(card, /sample record/, "a production sanction is not labelled a sample");
    assert.match(card, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Send RFQ/s);

    const row = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(input)] }));
    assert.match(row, /data-sanctioned="true"/);
    assert.ok(edgeInToken(row, "sanction"), "the table row draws no sanction-token edge");
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
    // Not "District, …": the record's own payload carries a BGMEA address
    // row that resolves to Motijheel, which is what the production supplier
    // profile prints for it.
    assert.match(html, /Year and workers not on file/);
    assert.doesNotMatch(html, /District, year and workers not on file/);
    assert.match(html, /Motijheel/);
    assert.match(html, /none on 4 registers/);
    assert.match(html, /not on the EPB list/);
    assert.match(html, /not on 4 brand lists read/);
    assert.match(html, /No export lines on file/);
    assert.match(html, /no EPB record/, "EPB holds no record for this supplier: no read date is invented");
    assert.doesNotMatch(html, /checked \d/);
    // 25 is every row in `sources`; 11 of them have never produced a record
    // for anybody, so the chip claimed a read of eleven registers that have
    // not been read (6,708 published records take this chip).
    assert.match(html, /Nothing else on file · 1 of 14 sources read/);
    assert.doesNotMatch(html, /of 25 sources/);
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
    // This used to assert `tabindex="0"` and call it keyboard support. The
    // control does nothing in REZ-A, so a tab stop on it announces an
    // operable checkbox that Space cannot toggle — Space scrolled the page.
    // Inert controls in this kit say so instead (WCAG 2.1.1, 4.1.2).
    assert.match(html, /role="checkbox"[^>]*aria-disabled="true"/);
    assert.doesNotMatch(html, /role="checkbox"[^>]*tabindex/, "an inert control must not be a dead tab stop");
  });
});

// Guard-adequacy, cycle 19: cycle 18's `assertModal` repair has two halves —
// the gallery passes `assertModal={false}` on its three simultaneously-live
// dialogs, and the prop defaults to `true`, "the real, single-dialog
// behaviour the shipped app always has" (the doc comments on `Sheet` and
// `Dialog` say so explicitly). Only the gallery's own negative case was
// guarded (`dashboard-screens.test.ts`'s "no dialog on the combined gallery
// page claims aria-modal"); nothing anywhere asserted the *positive*
// direction at the component boundary, so both `Sheet` and `Dialog` could
// default to `false` — the shipped app's every real dialog silently losing
// its modality — and the whole suite would stay green.
describe("Sheet and Dialog default to aria-modal, at the component boundary (guard-adequacy, cycle 19)", () => {
  it("SupplierSheet: no assertModal prop means aria-modal=\"true\"; assertModal={false} removes it and keeps role/label", () => {
    const withDefault = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(withDefault, /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/);
    const withFalse = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()), assertModal: false }));
    assert.doesNotMatch(withFalse, /aria-modal/);
    assert.match(withFalse, /role="dialog"/);
    assert.match(withFalse, /aria-label="Supplier record"/);
  });

  it("ProductSheet: no assertModal prop means aria-modal=\"true\"; assertModal={false} removes it and keeps role/label", () => {
    const withDefault = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6105") }));
    assert.match(withDefault, /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/);
    const withFalse = renderToStaticMarkup(createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6105"), assertModal: false }));
    assert.doesNotMatch(withFalse, /aria-modal/);
    assert.match(withFalse, /role="dialog"/);
    assert.match(withFalse, /aria-label="Product line"/);
  });

  it("RfqComposer: no assertModal prop means aria-modal=\"true\"; assertModal={false} removes it and keeps role/label", () => {
    const withDefault = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL }));
    assert.match(withDefault, /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/);
    const withFalse = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL, assertModal: false }));
    assert.doesNotMatch(withFalse, /aria-modal/);
    assert.match(withFalse, /role="dialog"/);
    assert.match(withFalse, new RegExp(`aria-label="${COMPOSER_MODEL.title}"`));
  });
});

describe("SupplierSheet (rendered)", () => {
  it("bar, tabs with counts, facts with marks, the locked contact card, certificates, the RSC meter, the action bar", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.match(html, /Supplier record/);
    // Not "Read 18 Sep 2026 · 11 sources": one of Aboni's eleven registers
    // was read that day and the oldest was read 123 days earlier, which the
    // contact card on the same screen lists in full. The header is the span.
    assert.match(html, /Read 18 May – 18 Sep 2026 · 11 sources/);
    assert.doesNotMatch(html, /Read \d+ \w+ \d{4} · \d+ sources/, "a single date must not stand for every register");
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

  // A mutation sweep found `SheetSection`'s title (sheet.tsx) could be bumped
  // from `as="h2"` to `as="h3"` with every test staying green: nothing in the
  // suite required the sheet's own section headings to sit one level under
  // its name, so a screen reader's heading navigation would skip a level on
  // every tab (Products, Certificates, Safety) without any test noticing.
  it("the sheet's name is the only h1, and its sections sit one level under it, not two", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    const h1s = html.match(/<h1\b/g) ?? [];
    assert.equal(h1s.length, 1, "the sheet's own name must be the sheet's only top-level heading");
    assert.doesNotMatch(html, /<h3\b/, "a section heading skipped from h1 straight to h3");
    for (const title of ["Products", "Certificates", "Safety"]) {
      assert.match(html, new RegExp(`<h2\\b[^>]*>${title}</h2>`), `"${title}" must be an h2, one level under the sheet's h1`);
    }
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
    // "registers checked" also matches "no registers checked"; the point of
    // the row is that it names what WAS checked.
    assert.match(html, /\b\d+ registers checked|>registers checked</);
    assert.doesNotMatch(html, /no registers checked/);
    // Production reads four certificate registers, not "any": `certifications`
    // holds four `cert_kind` values and `sources` four tier-3 rows, while
    // `SCHEME_LABEL` names ten more schemes nobody has read. 7,531 published
    // records take this chip.
    assert.match(html, /No certificate on 4 registers/);
    assert.doesNotMatch(html, /on any register/);
    assert.match(html, /No active RSC record on file/);
  });

  it("a mother whose only active RSC row is a building's shows the building, never its figures as the mother's", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(smKnitwearInput()) }));
    assert.match(html, /RSC covers S M Knitwears Limited\. \(Extension\) — the buildings, not this record/);
    const mother = motherSafety(html);
    assert.match(mother, /No active RSC record for this company itself/);
    assert.doesNotMatch(mother, /Remediation 53 %/, "the Extension's progress is not the mother's");
    assert.doesNotMatch(mother, /role="meter"/, "the mother has no percentage of its own to meter");
    // Cycle 6: withholding them from the mother had also withheld them from the
    // building, so the one record RSC does cover showed no progress anywhere.
    assert.match(html, rx("S M Knitwears Limited. (Extension) — the building's own RSC record"));
    assert.match(html, /Remediation 53 %/);
    assert.match(html, /role="meter"[^>]*aria-valuenow="53"/);
    assert.match(html, /Active · behind schedule/);
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
    const mother = motherSafety(html);
    assert.doesNotMatch(html, /NaN/);
    assert.doesNotMatch(mother, /role="meter"/);
    assert.match(mother, /Remediation not on file/);
    // The shed's row is untouched and keeps its own meter, so the guard above
    // is about the missing value and not about meters in general.
    assert.match(html, /role="meter"[^>]*aria-valuenow="100"/);
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
    // Found by a stable hook, not by its whole class attribute.
    assert.match(html, /data-sheet-scroll="true"[^>]*class="[^"]*\boverflow-y-(?:auto|scroll)\b/);
    const body = /data-sheet-scroll="true"[^>]*>([\s\S]*)$/.exec(html)?.[1] ?? "";
    assert.ok(body.length > 0, "the scroll region was not found, so what follows would pass vacuously");
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
    const html = renderToStaticMarkup(createElement(PanelFooter, { shown: 4, total: 42, note: "the named test records of the rebuild spec" }));
    assert.match(html, /the named test records of the rebuild spec · 42 in the result set/);
    assert.doesNotMatch(html, /1–4 of 42/, "the range is a claim about the result set these rows are not a page of");
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

  it("the HEADER's row range follows the page too", () => {
    // The footer was fixed and tested; the header was fixed and not, so
    // hardcoding its range back to 1 left the whole suite green while
    // "300 suppliers · 1–25" sat above rows 51–75.
    const html = renderToStaticMarkup(
      createElement(PanelHeader, {
        model: {
          title: "Knit",
          total: 300,
          shown: 25,
          firstRow: 51,
          sortLabel: "Name",
          view: "cards" as const,
        },
      }),
    );
    assert.match(html, /51–75/, "the header still claims the first page's range");
    assert.doesNotMatch(html, /· 1–25/);
  });

  it("the row range follows the page instead of always claiming the first", () => {
    // `1–${shown}` was printed unconditionally, so page 3 of a 300-row set read
    // "1–25 of 300" with rows 51–75 on screen. Wrong on every page but the first.
    const html = renderToStaticMarkup(
      createElement(PanelFooter, { shown: 25, total: 300, perPage: 25, page: 3 }),
    );
    assert.match(html, /51–75 of 300/, "the footer still claims the first page's range");
    assert.doesNotMatch(html, /1–25 of 300/);
  });

  it("a short last page keeps its pager so Previous is reachable", () => {
    // Gating the whole pager on `shown >= perPage` stranded a buyer on the last
    // page: ten rows of a 30-row set rendered no Previous and no page count.
    const html = renderToStaticMarkup(
      createElement(PanelFooter, { shown: 5, total: 30, perPage: 25, page: 2, prevHref: "/app/discover" }),
    );
    assert.match(html, /Page 2 of 2/, "the last page lost its pager entirely");
    assert.match(html, /aria-label="Previous page"/);
  });
});

describe("the results panel does not clip its own menus", () => {
  // Panel was `overflow-hidden`, which painted the header's sort menu outside
  // the panel on a short result set — invisible, still tabbable, still
  // activating on Enter. The clipping only existed to keep the first and last
  // children inside the rounded corners.
  it("Panel clips corners without clipping overflow", () => {
    const html = renderToStaticMarkup(
      createElement(Panel, null, createElement("div", null, "rows")),
    );
    assert.doesNotMatch(html, /overflow-hidden/, "a popover in this panel would be clipped away");
    assert.match(html, /rounded-t-md/);
    assert.match(html, /rounded-b-md/);
  });
});

/** A draft with one clean target, in the shape the composer really takes. */
const COMPOSER_MODEL: RfqComposerModel = {
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
    assert.match(html, /1,633/);
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
    assert.match(html, /Open · no quote yet/);
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
    assert.ok(edgeInToken(html, "sanction"), "the RFQ row draws no sanction-token edge");
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
    assert.match(html, /\+48 lines</, "six tiles shown, forty-eight counted");
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

  it("every row of controls can wrap, so the header does not push the page sideways", () => {
    // Measured at 320px, this header forced `document.body.scrollWidth` to
    // 458 against a 320 viewport: Export CSV sat 66px and the card/table
    // toggle 137px outside it, focusable but off screen (WCAG 1.4.10). The
    // OUTER wrapper already had `flex-wrap` and a comment claiming that fixed
    // it; the overflow was the inner group — one non-wrapping row of four
    // `whitespace-nowrap` h-controls, 425px inside a 286px header.
    //
    // `node --test` has no layout engine, so what is pinned here is the
    // property that makes wrapping possible at all: no flex row in this header
    // may hold `whitespace-nowrap` children without being able to wrap. The
    // real measurement is the browser pass; this is what stops it regressing
    // unnoticed between passes.
    const html = renderToStaticMarkup(
      createElement(PanelHeader, {
        model: {
          ...model,
          sortOptions: [{ label: "Most sources", value: "receipts", href: "?sort=receipts" }],
          exportHref: "/api/v1/discover/export",
          saveHref: "/app/searches/new",
        },
      }),
    );
    const rows = [...html.matchAll(/<div class="([^"]*\bflex\b[^"]*)"/g)].map((m) => m[1]!);
    assert.ok(rows.length >= 2, `expected the header to have nested flex rows, found ${rows.length}`);
    const nowrapControls = (html.match(/whitespace-nowrap/g) ?? []).length;
    if (nowrapControls > 0) {
      const wrapping = rows.filter((c) => c.split(/\s+/).includes("flex-wrap"));
      assert.ok(
        wrapping.length >= 2,
        `the header has ${rows.length} flex rows and only ${wrapping.length} that wrap; the controls row is what overflowed at 320px`,
      );
    }
    // The group holding the buttons is the one that was 425px wide.
    const controlRow = rows.find((c) => c.includes("justify-end"));
    assert.ok(controlRow, "the control group lost its own class list; this guard needs rewriting");
    assert.ok(controlRow!.split(/\s+/).includes("flex-wrap"), `the control group cannot wrap: ${controlRow}`);
    assert.ok(controlRow!.split(/\s+/).includes("min-w-0"), `the control group cannot shrink: ${controlRow}`);
  });
});

// Cycle 5, finding 16: an RSC row that omits `progress_pct` rather than nulling
// it reached the bar as `aria-valuenow="NaN"`. The builder no longer passes one,
// and the component refuses it too — a screen reader announcing "NaN percent"
// is worse than no meter.
describe("Meter (rendered)", () => {
  it("a percentage that is not a number renders 0, never NaN", () => {
    for (const pct of [Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      const html = renderToStaticMarkup(createElement(Meter, { pct, label: "Remediation" }));
      assert.doesNotMatch(html, /NaN|Infinity/);
      assert.match(html, /aria-valuenow="0"/);
      assert.match(html, /width:0%/);
    }
  });

  it("a real percentage is clamped to the bar's range", () => {
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: 53, label: "Remediation" })), /aria-valuenow="53"/);
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: 140, label: "Remediation" })), /aria-valuenow="100"/);
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: -5, label: "Remediation" })), /aria-valuenow="0"/);
    // `role="meter"` requires an accessible name and the component used to
    // take none, so two bars on the safety section announced as "100, meter".
    assert.match(renderToStaticMarkup(createElement(Meter, { pct: 53, label: "Remediation, Aboni" })), /aria-label="Remediation, Aboni"/);
  });
});

// No page in this gallery currently calls `<Icon>` with a `label`, so the
// page-wide "a named <svg> with no role" sweep (dashboard-screens.test.ts)
// never exercises this branch — a mutation sweep found both `icons.tsx`'s
// `role={label ? "img" : undefined}` line and the phosphor test stub itself
// could be reverted to their pre-fix state without any test going red. This
// tests the component's own contract directly, so the capability is guarded
// whether or not a caller happens to use it yet.
describe("Icon (rendered)", () => {
  it("is a real, visible svg — the stub used to render nothing at all", () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: "warn" }));
    assert.match(html, /<svg\b/, "an icon must render an actual svg, not nothing");
  });

  it("a labelled icon is announced as an image; an unlabelled one is hidden from screen readers", () => {
    const labelled = renderToStaticMarkup(createElement(Icon, { name: "warn", label: "Warning" }));
    assert.match(labelled, /role="img"/, "a labelled icon must carry role=\"img\", or a screen reader announces an unreachable action");
    assert.match(labelled, /aria-label="Warning"/);
    assert.doesNotMatch(labelled, /aria-hidden/);

    const decorative = renderToStaticMarkup(createElement(Icon, { name: "warn" }));
    assert.doesNotMatch(decorative, /role="img"|aria-label=/);
    assert.match(decorative, /aria-hidden="true"/);
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

// ---------------------------------------------------------------------------
// Cycle 6 guards. Each one is here because a critic found the behaviour it
// pins unguarded, and each was watched failing against the code before the
// repair (the mutation sweep in the evidence bundle re-checks that).
// ---------------------------------------------------------------------------

/** The characters a screen-reader-only or hidden element carries. */
const HIDDEN = /\b(?:sr-only|hidden|invisible|opacity-0)\b|aria-hidden="true"|display:\s*none/;
/**
 * The banner's own opening tag. `HIDDEN` over the whole element used to be
 * safe only because the icon stub rendered nothing; a decorative icon inside
 * a visible banner legitimately carries `aria-hidden="true"`, and the question
 * this guard asks is whether the *banner* is hidden.
 */
const openingTag = (el: string) => el.slice(0, el.indexOf(">") + 1);
/**
 * An edge treatment drawn in a token, whatever utility draws it — an inset
 * shadow, a border, a ring, an outline, or a `::before` bar. The sanction rail
 * was pinned as the literal `shadow-[inset_4px_0_0_rgb(var(--ds-sanction))]`
 * and the card's bar as `before:bg-sanction`, so redrawing either as a real
 * border — which forced-colors mode keeps and a pseudo-element background it
 * drops — failed the suite while still drawing a 4px sanction rail.
 */
const edgeInToken = (html: string, token: string) =>
  new RegExp(
    `shadow-\\[[^"\\]]*--ds-${token}\\)|` +
      `border(?:-[trblxy])?(?:-(?:\\d+|\\[[^\\]]*\\]))?\\s+border-${token}\\b|` +
      `\\bring-${token}\\b|\\boutline-${token}\\b|\\bbefore:bg-${token}\\b`,
  ).test(html);
/**
 * A chip carrying `tone` whose words are `text`. The words may sit after the
 * chip's own decorative icon, which is markup the suite could not see until
 * the icon stub stopped rendering `null`.
 */
const chipSaying = (tone: string, text: string) =>
  new RegExp(`${tone}[^"]*"[^>]*>(?:<svg\\b[^>]*>(?:(?!</svg>).)*</svg>)?${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

describe("the sanction warning is visible, not only announced", () => {
  /** The element carrying the sanction banner, and everything up to its close. */
  function banner(html: string): string {
    const i = html.indexOf('data-sanction-visible="true"');
    assert.ok(i >= 0, "nothing on the screen is marked as the visible sanction warning");
    return html.slice(html.lastIndexOf("<", i), html.indexOf("</div>", i) + 6);
  }

  it("the sheet's banner is a visible alert on the sanction colour, in the document order a buyer reads", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput()) }));
    const b = banner(html);
    assert.match(b, /role="alert"/);
    assert.match(b, /bg-sanction\b/, "the banner must carry the reserved sanction background, not a neutral one");
    assert.doesNotMatch(openingTag(b), HIDDEN, `the sanction banner is hidden from sight: ${b}`);
    assert.doesNotMatch(b.replace(/<svg\b[^>]*>.*?<\/svg>/g, ""), HIDDEN, "the banner's own words are hidden from sight");
    // Before the tabs, so it is read before anything it qualifies.
    assert.ok(
      html.indexOf('data-sanction-visible="true"') < html.indexOf('id="overview"'),
      "the banner comes after the facts it is meant to qualify",
    );
  });

  it("the card carries the same marked, visible warning", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(zaheenSampleInput()) }));
    const b = banner(html);
    assert.match(b, /text-sanction-ink\b/);
    assert.doesNotMatch(openingTag(b), HIDDEN);
    assert.doesNotMatch(b.replace(/<svg\b[^>]*>.*?<\/svg>/g, ""), HIDDEN);
  });

  it("a record production does not flag carries no sanction element at all", () => {
    for (const [name, input] of [["aboni", aboniInput()], ["sm", smKnitwearInput()]] as const) {
      const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
      const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
      assert.doesNotMatch(card, /data-sanction-visible/, `${name}'s card`);
      assert.doesNotMatch(sheet, /data-sanction-visible/, `${name}'s sheet`);
      assert.doesNotMatch(sheet, /bg-sanction\b/, `${name}'s sheet paints the reserved sanction colour`);
    }
  });
});

describe("status is never colour alone (spec §6)", () => {
  /** Every tone class the kit paints a state with, and the words that must sit beside it. */
  const TONED: [string, RegExp][] = [
    ["bg-caution-tint", /expired|behind schedule|expires in|not implemented|not finalised/i],
    ["bg-positive-tint", /valid to|active|on track|initial plan completed|remediated/i],
  ];

  it("every toned chip on the four records carries words that say the same thing", () => {
    for (const input of [aboniInput(), smKnitwearInput(), zaheenSampleInput(), arFashionInput()]) {
      const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
      for (const [cls, words] of TONED) {
        const re = new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*?)</span>`, "g");
        for (const m of html.matchAll(re)) {
          assert.match(m[1] ?? "", words, `a ${cls} chip on ${input.profile.supplier.slug} says only "${m[1]}"`);
        }
      }
    }
  });

  it("the tone classes are in the rendered markup, so the state is not carried by position alone", () => {
    const sm = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(smKnitwearInput()) }));
    assert.match(sm, chipSaying("bg-caution-tint", "WRAP Gold expired"));
    assert.match(sm, chipSaying("bg-positive-tint", "GOTS valid to"));
  });
});

describe("the 125-character name, on every card type an admin list can reach (spec §6)", () => {
  const long = longestNameInput();

  it("the card, the row and the sheet all print it whole and let it wrap", () => {
    const surfaces: [string, string][] = [
      ["card", renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(long) }))],
      ["row", renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(long)] }))],
      ["sheet", renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(long) }))],
    ];
    for (const [where, html] of surfaces) {
      const name = escape(LONG_NAME_125);
      assert.ok(html.includes(name), `${where} does not carry the whole 125-character name`);
      assert.doesNotMatch(html, /…|\.\.\./, `${where} ellipsises the name`);
      // The name also appears in the card's `aria-label` and the row's "Select
      // …" checkbox label; the one this guard is about is the text a buyer
      // sees, which is the occurrence that opens a text node.
      const at = html.indexOf(`>${name}`);
      assert.ok(at >= 0, `${where} carries the name only in an attribute, never as text`);
      const element = html.slice(html.lastIndexOf("<", at), at);
      assert.match(element, /\[overflow-wrap:anywhere\]/, `${where} does not let the name wrap: ${element}`);
      assert.doesNotMatch(element, TRUNCATION, `${where} would cut the name off: ${element}`);
    }
  });

  it("the empty record around that name says what was checked, and claims nothing", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(long) }));
    assert.match(html, /Not on file/);
    assert.doesNotMatch(html, SCORE);
  });
});

describe("the RFQ screens carry no score either (spec §2)", () => {
  it("the list, its rows and the composer are inside the sweep", () => {
    const base = { id: "r1", product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, quote_count: 0, created_at: "2026-09-09T10:00:00Z", status: "open" } as const;
    const rows = [
      buildRfqRow(base, { name: "Aboni Knitwear Ltd", tier: 2 }, TODAY),
      buildRfqRow({ ...base, id: "r2", quote_count: 2 }, { name: "S M Knitwears Limited", tier: 2 }, TODAY),
      buildRfqRow({ ...base, id: "r3", status: "accepted" }, { name: ZAHEEN_NAME, tier: 1, sanctioned: true, sanctionSample: true }, TODAY),
    ];
    const model: RfqListModel = { sent: 3, quotes: 2, chips: [{ label: "All", count: 3, on: true }], rows, footer: "1–3 of 3", toast: null };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    // The sweep is worthless over an empty list, so pin that there is something to sweep.
    assert.match(html, /Aboni Knitwear Ltd/);
    assert.match(html, /S M Knitwears Limited/);
    assert.doesNotMatch(html, SCORE);
    assert.doesNotMatch(html, HAND_TYPED_COLOUR);
    assert.doesNotMatch(html, TRUNCATION);
    // The composer is the other RFQ surface and was outside every sweep.
    const composer = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL }));
    assert.match(composer, /New RFQ/);
    assert.doesNotMatch(composer, SCORE);
  });
});

describe("an RSC row missing a report says so rather than dropping the slot silently", () => {
  it("Aswad's Extension building has no boiler report, and the block shows the four it has", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(buildingSafetyOnlyInput()) }));
    const ext = html.slice(html.indexOf(escape(ASWAD_U2_EXT), html.indexOf("the building&#x27;s own RSC record")));
    const block = ext.slice(0, 4000);
    for (const label of ["Fire", "Structural", "Electrical", "CAP"]) {
      const link = [...block.matchAll(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/g)].find((m) => m[0].replace(/<[^>]*>/g, "").trim().startsWith(label));
      assert.ok(link, `${ASWAD_U2_EXT} is missing its ${label} link`);
      assert.match(link![0], /href="https?:\/\//, `${label} links nowhere`);
    }
    assert.doesNotMatch(block.slice(0, block.indexOf("</div>", block.indexOf("CAP"))), /href="[^"]*"[^>]*>Boiler/);
    // 597 of the 1,620 active RSC rows carry no boiler report, so an empty slot
    // is the normal case and must not render as a dead link.
    assert.doesNotMatch(html, /href="(?:null|undefined|)"/);
  });

  it("the record's own row, which has all five, renders all five", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    const own = html.slice(html.indexOf('id="safety"'), html.indexOf("the building&#x27;s own RSC record"));
    for (const label of ["Fire", "Structural", "Electrical", "Boiler", "CAP"]) {
      const link = [...own.matchAll(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/g)].find((m) => m[0].replace(/<[^>]*>/g, "").trim().startsWith(label));
      assert.ok(link, `the record's own RSC row is missing its ${label} link`);
      assert.match(link![0], /href="https?:\/\//, `${label} links nowhere`);
    }
  });
});

describe("a brand list named twice by production is one mark and one name", () => {
  it("Aman Graphics is on M&S's list under two facility ids, and the screens say M&S once", () => {
    const input = duplicateBrandRowsInput();
    assert.equal((input.profile.brand_attributions ?? []).filter((b) => b.source_code === "BRAND_MS").length, 2);
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
    assert.equal((card.match(/aria-label="Source: M&amp;S[^"]*"/g) ?? []).length, 1, "the M&S mark is stamped twice");
    assert.equal((card.match(/>MS</g) ?? []).length, 1, "the two-letter stamp is drawn twice");
    assert.match(card, /Listed by M&amp;S, NEXT/);
    // The sheet's mark row names each register once, in tier order.
    const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    assert.match(sheet, /EPB · RSC · BGMEA · OEKO-TEX · M&amp;S · NEXT/);
    assert.equal((sheet.match(/aria-label="Source: M&amp;S[^"]*"/g) ?? []).length, 1);
  });
});

describe("the two-state controls say which state they are in", () => {
  it("the toggle marks exactly the pressed option, and the checkbox states are both rendered", () => {
    // `Seg` is the kit's two-state toggle; the RFQ composer's template picker
    // is the one place a screen uses it with a live value.
    const seg = renderToStaticMarkup(
      createElement(Seg, {
        options: [
          { value: "grid", label: "Grid", icon: "cards" },
          { value: "table", label: "Table", icon: "table" },
        ] as const,
        value: "table",
      }),
    );
    const pressed = seg.match(/aria-pressed="(true|false)"/g) ?? [];
    assert.equal(pressed.length, 2, "an option that reports no pressed state reads as a plain button");
    assert.equal(pressed.filter((p) => p.includes("true")).length, 1, "exactly one option is the pressed one");
    assert.match(seg, /aria-label="Table"[^>]*aria-pressed="true"/);
    assert.match(seg, /aria-label="Grid"[^>]*aria-pressed="false"/);
    const on = renderToStaticMarkup(createElement(Checkbox, { on: true, label: "GOTS" }));
    const off = renderToStaticMarkup(createElement(Checkbox, { on: false, label: "GOTS" }));
    assert.match(on, /role="checkbox"[^>]*aria-checked="true"/);
    assert.match(off, /role="checkbox"[^>]*aria-checked="false"/);
    assert.match(on, /aria-label="GOTS"/);
    // A dead tab stop is worse than no tab stop: it announces an operable
    // checkbox and Space scrolls the page instead of toggling. The kit's
    // shape for a control that is present but inert is `aria-disabled` plus
    // a title, which is what the sheet tabs and composer steps already do.
    assert.doesNotMatch(off, /tabindex/);
    assert.match(off, /aria-disabled="true"/);
    assert.match(off, /title="[^"]+"/, "an inert control says why it is inert");
  });

  it("a checkbox given onToggle is real: no aria-disabled, no inert title, in the tab order", () => {
    // REZ-B, handoff §7.5: the results-page checkbox goes from the inert
    // placeholder above to an operable one wherever selection is wired up.
    // The two must not collapse into one shape — a real checkbox that still
    // carried `aria-disabled` would tell assistive tech it cannot be used.
    const real = renderToStaticMarkup(createElement(Checkbox, { on: false, label: "Select Aboni", onToggle: () => {} }));
    assert.match(real, /role="checkbox"[^>]*aria-checked="false"/);
    assert.match(real, /tabindex="0"/);
    assert.doesNotMatch(real, /aria-disabled/);
    assert.doesNotMatch(real, /title="Selection arrives with the results work"/);
  });

  it("a real checkbox toggles on Space once, on key up — not on Enter, not on keydown auto-repeat", () => {
    // A native checkbox ignores Enter and toggles on Space's keyup; toggling
    // on keydown flipped the box on every auto-repeat of a held Space.
    let n = 0;
    const el = Checkbox({ label: "Select Aboni", onToggle: () => (n += 1) }) as { props: Record<"onKeyDown" | "onKeyUp" | "onClick", (e: unknown) => void> };
    let prevented = 0;
    const ev = (key: string) => ({ key, repeat: false, preventDefault: () => (prevented += 1) });
    el.props.onKeyDown(ev(" "));
    assert.equal(prevented, 1, "Space keydown must stop the page scrolling");
    el.props.onKeyDown({ ...ev(" "), repeat: true });
    assert.equal(n, 0, "keydown must only stop the page scrolling");
    el.props.onKeyUp(ev(" "));
    assert.equal(n, 1);
    el.props.onKeyDown(ev("Enter"));
    el.props.onKeyUp(ev("Enter"));
    assert.equal(n, 1, "Enter does not toggle a checkbox");
    el.props.onClick({});
    assert.equal(n, 2);
  });

  it("a partly selected select-all box reads mixed, not unchecked", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { on: "mixed", label: "Select all on this page", onToggle: () => {} }));
    assert.match(html, /aria-checked="mixed"/);
    // And it LOOKS mixed in Windows High Contrast: forced colors repaint every
    // background as Canvas, so a background-drawn dash vanished (white on
    // white) and the box looked unticked while the tree said "mixed".
    // Pinned exactly, not screened against a list of hiding classes: a list
    // is always one class short (sr-only, w-0, invisible, [visibility:…]).
    // Changing the dash means changing this line on purpose. That Tailwind
    // emits the forced-colors rule was checked in built CSS by the cycle-17
    // reviewer; it is not re-checked here.
    const dash = html.match(/<span aria-hidden="true" class="([^"]*)"><\/span>/)?.[1] ?? "";
    assert.equal(dash, "block h-0.5 w-2 rounded-full bg-current forced-colors:bg-[CanvasText]", "the mixed dash's classes changed");
  });

  /** A source file with its comments removed, so prose cannot satisfy a code check. */
  const sourceCode = (rel: string) =>
    readFileSync(path.join(process.cwd(), rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  /** The body of `export function <name>(` in a source file (comments
   * stripped), bounded by the function's OWN closing brace — so a dead
   * helper anywhere else in the file, before or after it, cannot satisfy a
   * check. (Slicing to the next `export` ran to end-of-file for the last
   * export, and a trailing unused helper passed.) */
  const functionBody = (rel: string, name: string) => {
    const code = sourceCode(rel);
    const at = code.indexOf(`export function ${name}(`);
    assert.ok(at >= 0, `${name} not found in ${rel}`);
    // Skip the parameter list (it has its own braces), then match the body.
    let i = code.indexOf("(", at);
    for (let depth = 0; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")" && --depth === 0) break;
    }
    const open = code.indexOf("{", code.indexOf(")", i));
    let depth = 0;
    for (let j = open; j < code.length; j++) {
      if (code[j] === "{") depth++;
      else if (code[j] === "}" && --depth === 0) return code.slice(at, j + 1);
    }
    assert.fail(`${name}: unbalanced braces`);
  };
  const count = (hay: string, needle: string) => hay.split(needle).length - 1;

  describe("the bulk bar", () => {
    const A = "11111111-1111-4111-8111-111111111111";
    const B = "22222222-2222-4222-8222-222222222222";
    const bar = (selected: string[]) => {
      const value: SelectionContextValue = {
        interactive: true,
        selected: new Set(selected),
        isSelected: (id) => selected.includes(id),
        toggle: () => {},
        toggleAllOnPage: () => {},
        allState: false,
        clear: () => {},
        edits: 0,
      };
      const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
      return renderToStaticMarkup(
        createElement(
          AppRouterContext.Provider,
          { value: router as never },
          createElement(
            SelectionContext.Provider,
            { value },
            createElement(SelectionBar, { exportHref: "/api/v1/discover/export?q=knit&page=3" }),
          ),
        ),
      );
    };

    it("with an empty selection renders no bar — only the empty announcer, already mounted", () => {
      // The announcer must exist BEFORE the first tick: a live region that
      // mounts already holding "1 selected" is usually not read at all.
      const html = bar([]);
      assert.doesNotMatch(html, /Bulk actions"/);
      assert.match(html, /^<span role="status" aria-live="polite" class="sr-only"><\/span>$/);
    });

    it("the announcer is the SAME node before and after the bar appears — first child of an unkeyed fragment", () => {
      // Wrapped in any element (or keyed), it would remount on the first tick
      // and the first count would go unannounced, which is the defect it fixes.
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      assert.match(code, /if \(!visible\) return announcer;/);
      assert.match(code, /return \(\s*<>\s*\{announcer\}\s*<div\s+ref=\{barRef\}/);
    });

    it("announces the count and where the actions are from that pre-existing region", () => {
      assert.match(bar([A]), /<span role="status" aria-live="polite" class="sr-only">1 selected\. Bulk actions are after the results\.<\/span>/);
    });

    it("counts the selection and exports exactly it, on the page's own query", () => {
      const html = bar([A, B]);
      assert.match(html, /2 selected/);
      assert.ok(html.includes(`href="/api/v1/discover/export?q=knit&amp;page=3&amp;ids=${A},${B}"`), html);
    });

    it("is a labelled group, not a toolbar it does not implement the arrow keys for", () => {
      const html = bar([A]);
      assert.match(html, /role="group"[^>]*aria-label="Bulk actions"/);
      assert.doesNotMatch(html, /role="toolbar"/);
    });

    it("says in visible text why Send RFQ and Compare are disabled, and ties it to both", () => {
      const html = bar([A]);
      const note = html.match(/<p id="([^"]+)"[^>]*>([^<]+)<\/p>/);
      assert.ok(note, "no visible note");
      assert.match(note[2] ?? "", /not built yet/);
      const described = [...html.matchAll(new RegExp(`<button[^>]*aria-describedby="${note[1]}"[^>]*>`, "g"))];
      assert.equal(described.length, 2, "Send RFQ and Compare both point at the note");
      for (const b of described) assert.match(b[0], /disabled=""/);
      // One explanation for everyone: with aria-describedby present a screen
      // reader never hears a `title`, so a title told mouse users something
      // else (a 50-supplier cap on a bulk send that is not built yet).
      for (const b of described) assert.doesNotMatch(b[0], /\btitle=/, `a second, different explanation: ${b[0]}`);
    });

    it("Clear sends focus to the select-all box, which carries the id it looks for", () => {
      // Clear unmounts the bar and the focused button with it; focus fell to
      // <body>. The render half: the box under a provider has the id.
      const header = renderToStaticMarkup(
        createElement(
          SelectionProvider,
          { pageIds: [A] },
          createElement(PanelHeader, { model: { title: "Knit", total: 1, shown: 1, firstRow: 1, sortLabel: "Name", view: "cards" as const } }),
        ),
      );
      assert.match(header, new RegExp(`id="${SELECT_ALL_ID}"[^>]*role="checkbox"[^>]*tabindex="0"`));
      // The behaviour (focus first, then clear) is clearKeepingFocus, tested in
      // lib/dashboard/selection.test.ts. Here: the Clear button's own tag, in
      // full, wires it — the old `onClick={sel.clear}` passed a body-only check.
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      const at = code.search(/>\s*Clear\s*<\/Button>/);
      const tag = code.slice(code.lastIndexOf("<Button", at), at);
      assert.match(tag, /onClick=\{\(\) => clearKeepingFocus\(document\.getElementById\(SELECT_ALL_ID\), sel\.clear\)\}/, tag);
    });

    it("wires reserveBarSpace to run while the bar shows, and hand the space back when it goes (WCAG 2.4.11)", () => {
      // reserveBarSpace itself is tested behaviourally in selection.test.ts;
      // this pins the effect that runs it: on `visible`, off otherwise.
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      assert.match(
        code,
        /useEffect\(\(\) => \{\s*const bar = barRef\.current;\s*if \(!visible \|\| !bar\) return;[\s\S]*?window\.addEventListener\("resize", fit\);\s*return \(\) => window\.removeEventListener\("resize", fit\);[\s\S]*?return reserveBarSpace\(document\.documentElement, bar, document\.activeElement as HTMLElement \| null, observe, sticky, onViewportResize\);\s*\}, \[visible\]\);/,
      );
    });

    it("a late save result is scoped to the earlier selection; the reset is keyed on the buyer's edits", () => {
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      assert.match(code, /const asked = generation\.current;[\s\S]*?setStatus\(generation\.current === asked \? message : `\$\{EARLIER\}\$\{message\}`\);/);
      // Keyed on the buyer's edits, never on the Set: a refresh that prunes
      // the Set after a partial save must not erase the message about it.
      assert.match(code, /useEffect\(\(\) => \{\s*generation\.current \+= 1;\s*if \(!saving\.current\) setStatus\(""\);\s*\}, \[sel\.edits\]\);/);
      assert.doesNotMatch(code, /\}, \[sel\.selected\]\);/);
      assert.match(
        sourceCode("components/dashboard/selection.tsx"),
        /selectionValue\(selected, pageIds, setSelected, edits, \(\) => setEdits\(\(n\) => n \+ 1\)\)/,
      );
    });

    it("both Export buttons download in place — a refusal is a sentence on the page, not a JSON document instead of it", () => {
      // The handler itself is invoked in interaction.test.ts; here only that
      // the link keeps its href for a middle-click or no script.
      const link = sourceCode("components/dashboard/export-link.tsx");
      assert.match(link, /<Button href=\{href\} onClick=\{run\}/);
      assert.match(sourceCode("components/dashboard/selection-bar.tsx"), /<ExportLink href=\{bulkExportHref\(exportHref, ids\)\} label="Export" requested=\{count\} resetOn=\{sel\.edits\} onStatus=\{setExportStatus\} \/>/);
      assert.match(sourceCode("components/dashboard/results-panel.tsx"), /<ExportLink href=\{model\.exportHref\}/);
      // And the link still carries its href, for a middle-click or no script.
      const html = renderToStaticMarkup(
        createElement(PanelHeader, { model: { title: "K", total: 1, shown: 1, firstRow: 1, sortLabel: "Name", view: "cards" as const, exportHref: "/api/v1/discover/export?q=k" } }),
      );
      assert.match(html, /<a href="\/api\/v1\/discover\/export\?q=k"/);
    });

    it("inside SelectionBar itself: one Save wired straight to bulkSave, one Clear, the whole selection sent, one status write", () => {
      const body = functionBody("components/dashboard/selection-bar.tsx", "SelectionBar");
      assert.equal(count(body, "onClick={bulkSave}"), 1, "Save must call bulkSave unconditionally");
      assert.equal(count(body, "onClick={() => clearKeepingFocus(document.getElementById(SELECT_ALL_ID), sel.clear)}"), 1);
      assert.equal(count(body, "onClick="), 2, "an extra or conditional handler slipped in");
      assert.equal(count(body, "setStatus(generation.current === asked ? message"), 1, "a second outcome write defeats the scoping");
      assert.match(body, /const observe = typeof ResizeObserver === "undefined" \? null : \(fit: \(\) => void\) => new ResizeObserver\(fit\);/);
      assert.match(body, /await runBulkSave\(ids, \{/);
      assert.doesNotMatch(body, /\bids\s*\.\s*(splice|pop|shift|length\s*=)|\bids\s*=(?!=)(?!\s*\[\.\.\.sel\.selected\];)/, "the selection sent must be the whole selection");
      assert.match(body, /<ExportLink href=\{bulkExportHref\(exportHref, ids\)\} label="Export" requested=\{count\} resetOn=\{sel\.edits\} onStatus=\{setExportStatus\} \/>/);
      // One export at a time: the run that set busy always frees it
      // (interaction.test.ts runs the real handler and effects).
      assert.match(functionBody("components/dashboard/export-link.tsx", "ExportLink"), /\} finally \{\s*running\.current = false;\s*setBusy\(false\);\s*\}/);
    });

    it("the header's Export CSV is the in-place export — its status region renders beside it", () => {
      const html = renderToStaticMarkup(
        createElement(PanelHeader, { model: { title: "K", total: 1, shown: 1, firstRow: 1, sortLabel: "Name", view: "cards" as const, exportHref: "/api/v1/discover/export?q=k" } }),
      );
      // A plain <Button href> renders the anchor alone; ExportLink follows it
      // with its own live region.
      assert.match(html, /<a href="\/api\/v1\/discover\/export\?q=k"[^>]*>(?:(?!<\/a>).)*Export CSV<\/a><span id="[^"]+" role="status" aria-live="polite"/);
    });

    it("the table's scroll pane is a containing block, so its sr-only status spans cannot widen the page (WCAG 1.4.10)", () => {
      const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [buildTableRow(smKnitwearInput())] }));
      const pane = html.match(/<div class="([^"]*)" tabindex="0" role="region" aria-label="Results table"/);
      assert.ok(pane, "scroll pane not found");
      const cls = pane[1]!.split(/\s+/);
      assert.ok(cls.includes("relative") && cls.includes("overflow-x-auto"), pane[1]);
    });

    it("the saved-search form names the real cause, and only a name error blames the name field", () => {
      assert.deepEqual(saveSearchError(400, "invalid name").onName, true);
      assert.equal(saveSearchError(400, "search too long to save").onName, false);
      assert.match(saveSearchError(400, "search too long to save").message, /too long/);
      assert.equal(saveSearchError(400, "invalid query_state").message, "Could not save this search.");
      assert.match(saveSearchError(409, "saved search limit reached").message, /limit of 200/);
      assert.match(saveSearchError(401, undefined).message, /Sign in/);
      assert.equal(saveSearchError(500, "save failed").onName, false);
    });

    it("the bar's Save runs runBulkSave with every selected id, and announces + refreshes only through onSaved", () => {
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      assert.match(code, /await runBulkSave\(ids, \{\s*fetch: \(url, init\) => fetch\(url, init\),\s*onSaved: \(saved\) => \{\s*announceBulkSaved\(window, saved\);\s*router\.refresh\(\);\s*\},\s*\}\);/);
      assert.match(code, /const ids = \[\.\.\.sel\.selected\];/);
      const at = code.indexOf("onClick={bulkSave}");
      assert.ok(at > 0, "Save is not wired to bulkSave");
    });

    it("a row's Save button listens for bulk saves of its own id", () => {
      const code = sourceCode("components/dashboard/save-record-button.tsx");
      assert.match(code, /useEffect\(\(\) => onBulkSaved\(window, supplierId, \(\) => setOn\(true\)\), \[supplierId\]\);/);
    });

    it("the select-all box under a provider reads the provider's tri-state", () => {
      const value: SelectionContextValue = {
        interactive: true,
        selected: new Set([A]),
        isSelected: () => true,
        toggle: () => {},
        toggleAllOnPage: () => {},
        allState: "mixed",
        clear: () => {},
        edits: 0,
      };
      const html = renderToStaticMarkup(
        createElement(SelectionContext.Provider, { value }, createElement(PanelHeader, { model: { title: "K", total: 2, shown: 2, firstRow: 1, sortLabel: "Name", view: "cards" as const } })),
      );
      assert.match(html, new RegExp(`id="${SELECT_ALL_ID}"[^>]*aria-checked="mixed"`));
      assert.match(
        sourceCode("components/dashboard/selection.tsx"),
        /useMemo\(\s*\(\) => selectionValue\(selected, pageIds, setSelected, edits, \(\) => setEdits\(\(n\) => n \+ 1\)\),\s*\[selected, pageIds, edits\],\s*\)/,
      );
    });

    it("every selection box keeps its look in High Contrast: the classes each caller renders, pinned", () => {
      // Forced colors keep a border and repaint a background as Canvas. A
      // class that hides the box or drops its border there (forced-colors:*,
      // hidden, invisible, border-0…) can come from Checkbox itself or from a
      // caller's className, so the rendered class of every box a buyer can
      // tick is pinned exactly, in each state. Changing one means changing
      // this list on purpose.
      const BOX = "inline-grid size-4 shrink-0 place-items-center rounded-xs border";
      const LIVE = "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--ds-brand))]";
      const OFF = `${BOX} border-line-strong bg-surface ${LIVE}`;
      const ON = `${BOX} ${LIVE} border-brand bg-brand text-brand-on`;
      const under = (allState: boolean | "mixed", selected: boolean, el: ReturnType<typeof createElement>) => {
        const value: SelectionContextValue = {
          interactive: true,
          selected: new Set(selected ? [A] : []),
          isSelected: () => selected,
          toggle: () => {},
          toggleAllOnPage: () => {},
          allState,
          clear: () => {},
          edits: 0,
        };
        return renderToStaticMarkup(createElement(SelectionContext.Provider, { value }, el));
      };
      const boxes = (html: string) => [...html.matchAll(/<span[^>]*role="checkbox"[^>]*>/g)].map((m) => m[0].match(/class="([^"]*)"/)?.[1] ?? "");
      const header = createElement(PanelHeader, { model: { title: "K", total: 2, shown: 2, firstRow: 1, sortLabel: "Name", view: "cards" as const } });
      const row = { ...buildTableRow(aboniInput()), supplierId: A };
      const card = { ...buildCard(aboniInput()), supplierId: A };
      const cases: [string, string, string][] = [
        ["select-all, none", under(false, false, header), OFF],
        ["select-all, some", under("mixed", false, header), ON],
        ["select-all, all", under(true, false, header), ON],
        ["table row, off", under(false, false, createElement(ResultsTable, { rows: [row] })), OFF],
        ["table row, on", under(false, true, createElement(ResultsTable, { rows: [row] })), ON],
        ["card, off", under(false, false, createElement(SupplierResultCard, { card })), `${OFF} mt-4`],
        ["card, on", under(false, true, createElement(SupplierResultCard, { card })), `${ON} mt-4`],
      ];
      for (const [name, html, want] of cases) {
        const got = boxes(html);
        assert.equal(got.length, 1, `${name}: expected one selection box`);
        assert.equal(got[0], want, `${name}: the box's classes changed`);
      }
      // And nothing inside a box, or on it, is conditioned on forced colors
      // except the mixed dash, which is pinned on its own above.
      for (const [name, html] of cases) {
        for (const c of html.matchAll(/class="([^"]*forced-colors:[^"]*)"/g)) {
          assert.equal(c[1], "block h-0.5 w-2 rounded-full bg-current forced-colors:bg-[CanvasText]", `${name}: a forced-colors class outside the dash`);
        }
      }
    });

    it("the bar is sticky only on a window tall enough to spare it, and hides the two dead actions on a phone (WCAG 1.4.10)", () => {
      const html = bar([A]);
      const cls = html.match(/<div role="group" aria-label="Bulk actions" class="([^"]+)"/)?.[1] ?? "";
      assert.ok(cls, "bar not found");
      const classes = cls.split(/\s+/);
      assert.ok(classes.includes("[@media(min-height:32rem)]:sticky"), cls);
      assert.ok(!classes.includes("sticky"), "an unconditional sticky covered 91% of a 320x256 view");
      const tag = (label: string) => html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}</button>`))?.[0] ?? "";
      for (const label of ["Send RFQ", "Compare"]) {
        const b = tag(label);
        assert.ok(b, label);
        assert.match(b, /class="[^"]*\bhidden\b[^"]*\bsm:inline-flex\b/, `${label} still shows on a phone`);
      }
      assert.match(html, /<p id="[^"]+" class="[^"]*\bhidden\b[^"]*\bsm:block\b/);
      // And the effect only reserves space while the bar is actually sticky.
      assert.match(sourceCode("components/dashboard/selection-bar.tsx"), /const sticky = \(\) => getComputedStyle\(bar\)\.position === "sticky";[\s\S]*?return reserveBarSpace\([^;]*, observe, sticky, onViewportResize\);/);
    });

    it("the provider prunes its selection to the page whenever a refresh changes the rows", () => {
      assert.match(
        sourceCode("components/dashboard/selection.tsx"),
        /const pageKey = pageIds\.join\(","\);\s*useEffect\(\(\) => \{\s*setSelected\(\(s\) => pruneToPage\(s, pageKey \? pageKey\.split\(","\) : \[\]\)\);\s*\}, \[pageKey\]\);/,
      );
    });

    it("the bar's Export is told about the buyer's edits and reports its status to the bar", () => {
      assert.match(sourceCode("components/dashboard/selection-bar.tsx"), /<ExportLink href=\{bulkExportHref\(exportHref, ids\)\} label="Export" requested=\{count\} resetOn=\{sel\.edits\} onStatus=\{setExportStatus\} \/>/);
      assert.match(sourceCode("components/dashboard/export-link.tsx"), /setBusy\(true\);\s*say\("Preparing the export…"\);/);
    });

    it("the link form of Button passes its click handler and ARIA through — Export depends on it", () => {
      let clicked = 0;
      const el = Button({ href: "/x", onClick: () => (clicked += 1), "aria-describedby": "d", "aria-busy": true, children: "Export" }) as {
        type: string;
        props: { href: string; onClick?: (e: unknown) => void; "aria-describedby"?: string; "aria-busy"?: boolean };
      };
      assert.equal(el.type, "a");
      assert.equal(el.props.href, "/x");
      el.props.onClick?.({});
      assert.equal(clicked, 1);
      assert.equal(el.props["aria-describedby"], "d");
      assert.equal(el.props["aria-busy"], true);
    });

    it("only a name error marks the saved-search name field invalid", () => {
      const code = sourceCode("components/dashboard/save-search-form.tsx");
      assert.match(code, /aria-invalid=\{nameError \|\| undefined\}/);
      assert.doesNotMatch(code, /aria-invalid=\{error/);
    });

    it("the page keys the selection on its whole URL state, so a new page of results starts empty", () => {
      // Next keeps client state across a search-param navigation; unkeyed, a
      // selection would outlive its page and the page-scoped Export would
      // silently drop the ids it could no longer see.
      const code = sourceCode("app/(app)/app/discover/page.tsx");
      assert.match(code, /<SelectionProvider key=\{serializeDiscoverState\(state\)\.toString\(\)\}/);
    });

    it("the bulk Save is never natively disabled, so it cannot drop focus to the page while saving", () => {
      const save = bar([A]).match(/<button[^>]*>(?:(?!<\/button>).)*Save<\/button>/);
      assert.ok(save);
      assert.doesNotMatch(save[0], /disabled=""/);
      // A static render has busy=false, so `disabled={busy}` would render
      // nothing here and pass; check the code for any native disabled on it.
      const code = sourceCode("components/dashboard/selection-bar.tsx");
      // The WHOLE opening tag, both sides of onClick: a guard that stopped at
      // onClick passed with `disabled={busy}` written on the line after it.
      const at = code.indexOf("onClick={bulkSave}");
      const saveJsx = code.slice(code.lastIndexOf("<Button", at), code.indexOf(">", at));
      assert.match(saveJsx, /aria-disabled=\{busy/, "slice did not capture the Save button's tag");
      assert.doesNotMatch(saveJsx, /\sdisabled[=\s]/, "the bulk Save must use aria-disabled, never native disabled");
    });
  });

  // Accessibility, cycle 19, BLOCKING F3. `Seg`'s and the Template switch's
  // wrapping `<span role="group">` carries `overflow-hidden` for its own
  // rounded corners; the global `:focus-visible` ring is painted 2px OUTSIDE
  // the border box (app/ds.css), so `overflow-hidden` clipped it entirely —
  // a keyboard user tabbing to either control saw no focus indicator at all
  // (WCAG 2.4.7). `focus-visible:outline-offset-[-2px]` insets the ring
  // inside the button's own box, which `overflow-hidden` never clips.
  // Accessibility, cycle 19, BLOCKING F4. lib/design/tokens.ts reserves
  // `border-line-strong` (3.93:1) for a control's own outline; `border-line`
  // (1.44:1) falls short of WCAG 1.4.11's 3:1 for a UI component boundary.
  it("every live control's own outline uses border-line-strong, not the plain border-line", () => {
    // RscBlock's report links: aboniInput's two RSC rows (the record itself
    // and its new shed) each carry all five report URLs.
    const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    const reportLinks = [...sheet.matchAll(/<a href="https:\/\/accord2\.fairfactories\.org[^>]*>/g)].map((m) => m[0]);
    assert.equal(reportLinks.length, 10, "five reports on each of two RSC rows");
    for (const l of reportLinks) assert.match(l, /border-line-strong/, `report link missing the control outline: ${l}`);

    // The "+N more" pill on a card with more HS lines than thumbs is no longer
    // a control: it was a `<button>` named "All N lines" with no handler, no
    // href and no form, rendered on every such card, and the screen it would
    // have opened is spec §3.4, which is not built. It states the count and
    // the strip beside it scrolls to every tile. Nothing to outline, so the
    // control-outline rule below no longer applies to it — but if it ever
    // becomes a control again, this has to come back with it.
    const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    assert.doesNotMatch(card, /<button[^>]*aria-label="All \d+ lines"/, "the +N pill is a control again and needs an outline test");
    const pill = /<[a-z]+[^>]*>\+\d+ lines</.exec(card);
    assert.ok(pill, "the +N lines pill did not render");
    // No outline assertion: it is not a control any more, so a control outline
    // would be the wrong thing to require of it.

    // The Template switch's own group wrapper — its buttons' own divider
    // already used border-line-strong; the group's outer border did not.
    const composer = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL }));
    const labelAt = composer.indexOf('aria-label="Template"');
    const group = composer.slice(labelAt, composer.indexOf(">", labelAt) + 1);
    assert.match(group, /border-line-strong/, `Template group missing the control outline: ${group}`);

    // The Filters/Ask switch's own group wrapper — same defect class, missed
    // this round because it is gated behind `askEnabled` and unreachable on
    // any of the six shipped screens (accessibility, cycle 20, BLOCKING,
    // found by a fresh critic rather than the mutation sweep).
    const search = renderToStaticMarkup(createElement(SearchComposer, { chips: [], askEnabled: true }));
    const searchLabelAt = search.indexOf('aria-label="Search mode"');
    assert.ok(searchLabelAt >= 0, "SearchComposer did not render the Search mode group");
    const searchGroup = search.slice(searchLabelAt, search.indexOf(">", searchLabelAt) + 1);
    assert.match(searchGroup, /border-line-strong/, `Search mode group missing the control outline: ${searchGroup}`);
  });

  it("every button inside a role=group segmented control insets its own focus ring, so overflow-hidden cannot clip it", () => {
    const seg = renderToStaticMarkup(
      createElement(Seg, {
        options: [
          { value: "grid", label: "Grid", icon: "cards" },
          { value: "table", label: "Table", icon: "table" },
        ] as const,
        value: "table",
      }),
    );
    assert.match(seg, /role="group"[^>]*overflow-hidden/, "the clipping condition this guards against is still present");
    const segButtons = [...seg.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(segButtons.length, 2);
    for (const b of segButtons) assert.match(b, /focus-visible:outline-offset-\[-2px\]/, `no inset focus ring: ${b}`);

    const template = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL }));
    const group = template.slice(template.indexOf('aria-label="Template"'), template.indexOf("</span>", template.indexOf('aria-label="Template"')));
    assert.match(group, /overflow-hidden/, "the clipping condition this guards against is still present");
    const templateButtons = [...group.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(templateButtons.length, 2, "First contact, Repeat supplier");
    for (const b of templateButtons) assert.match(b, /focus-visible:outline-offset-\[-2px\]/, `no inset focus ring: ${b}`);

    // The Filters/Ask switch — same clipping condition, same fix, missed
    // this round because it only renders when `askEnabled` (accessibility,
    // cycle 20, BLOCKING, found by a fresh critic rather than the mutation
    // sweep).
    const search = renderToStaticMarkup(createElement(SearchComposer, { chips: [], askEnabled: true }));
    const searchLabelAt = search.indexOf('aria-label="Search mode"');
    const searchGroup = search.slice(searchLabelAt, search.indexOf("</span>", searchLabelAt));
    assert.match(searchGroup, /overflow-hidden/, "the clipping condition this guards against is still present");
    const searchButtons = [...searchGroup.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(searchButtons.length, 2, "Filters, Ask");
    for (const b of searchButtons) assert.match(b, /focus-visible:outline-offset-\[-2px\]/, `no inset focus ring: ${b}`);
  });
});

// ---------------------------------------------------------------------------
// Cycle 8 guards, at the boundary (§14). Each pins a mutation that survived
// the cycle-7 adequacy sweep — the model-level assertion existed, the rendered
// value it becomes did not.
// ---------------------------------------------------------------------------

describe("an unread count renders as unknown, on every surface that shows one", () => {
  it("the sheet's tabs show nothing rather than 0 when the count is unknown", () => {
    const sheet = buildSheet({ ...aboniInput(), hscodes: [], hscodesError: true });
    assert.equal(sheet.tabs.find((t) => t.label === "Products")?.count, null, "a failed EPB read has no line count");
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: sheet }));
    const tabs = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    assert.match(tabs, />Products</);
    assert.doesNotMatch(tabs, />Products<[^>]*>0</, "a tab that reads 'Products 0' over an unread page states a fact");
    assert.match(html, /could not be read/);
  });

  it("the RFQ chips and the summary line show nothing rather than 0 when the list was not read", () => {
    const model: RfqListModel = {
      sent: null,
      quotes: null,
      chips: [{ label: "All", count: null, on: true }, { label: "Open", count: null }],
      rows: [],
      footer: "The RFQ list could not be read",
      toast: null,
      error: true,
    };
    const html = renderToStaticMarkup(createElement(RfqList, { model }));
    assert.match(html, /count not read/);
    assert.doesNotMatch(html, /\b0 sent\b/);
    assert.doesNotMatch(html, /\b0 quotes\b/);
    assert.doesNotMatch(html, />All<[^>]*>0</, "a chip counting an unread list states a fact");
  });

  it("the sidebar shows no number rather than 0 when a count is unknown", () => {
    const shell = (counts: { suppliers?: number | null; rfqs?: number | null; saved?: number | null }) =>
      renderToStaticMarkup(
        createElement(AppShell, {
          sidebar: { active: "rfqs", counts, recent: [], plan: { name: "Free · public beta" } },
          topbar: { caption: "", search: "Search suppliers, HS codes, certificates" },
          children: null,
        } as never),
      );
    const shown = shell({ suppliers: 10266, rfqs: 7, saved: null });
    assert.match(shown, /RFQs<[^>]*>7</);
    assert.match(shown, />Saved</);
    assert.doesNotMatch(shown, /Saved<[^>]*>0</, "the Saved count is not read, and 0 is a claim");
    const unread = shell({ suppliers: null, rfqs: null, saved: null });
    assert.doesNotMatch(unread, /Suppliers<[^>]*>0</);
    assert.doesNotMatch(unread, /RFQs<[^>]*>0</);
    // A real zero is still shown: an account with no RFQs reads "RFQs 0".
    assert.match(shell({ rfqs: 0 }), /RFQs<[^>]*>0</);
  });

  it("the panel footer says what the rows are rather than a page range it cannot support", () => {
    const unknown = renderToStaticMarkup(createElement(PanelFooter, { shown: 4, total: null }));
    assert.doesNotMatch(unknown, /of 0/, "an unread total is not zero");
    assert.match(unknown, /of —/);
    const empty = renderToStaticMarkup(createElement(PanelFooter, { shown: 0, total: 42 }));
    assert.match(empty, /none on this page of 42/);
    assert.doesNotMatch(empty, /1–0/);
  });
});

describe("the RFQ summary line is read off the model, both numbers, the right way round", () => {
  it("four sent and one quote read as four sent and one quote", () => {
    const base = { product_title: "T", quantity: 1, quantity_unit: "pcs", ship_by: null, target_supplier_count: 1, created_at: "2026-09-09T10:00:00Z" } as const;
    const rows = [
      buildRfqRow({ ...base, id: "a", status: "open", quote_count: 1 }, null, TODAY),
      buildRfqRow({ ...base, id: "b", status: "open", quote_count: 0 }, null, TODAY),
    ];
    const html = renderToStaticMarkup(
      createElement(RfqList, { model: { sent: 4, quotes: 1, chips: [], rows, footer: "1–2 of 2", toast: null } as RfqListModel }),
    );
    // The only assertion on this line used to be `0 sent · 0 quotes` on an
    // empty model, where the two numbers and their singulars all agree.
    assert.match(html, /4 sent · 1 quote</);
    assert.doesNotMatch(html, /1 sent · 4/);
    const plural = renderToStaticMarkup(
      createElement(RfqList, { model: { sent: 4, quotes: 2, chips: [], rows, footer: "1–2 of 2", toast: null } as RfqListModel }),
    );
    assert.match(plural, /4 sent · 2 quotes</);
  });
});

describe("the failed-read copy is pinned as words, not as itself", () => {
  it("it says the read failed and never that the account has no RFQs", () => {
    // `assert.match(html, rx(RFQ_ERROR_COPY))` imports the string from the
    // component under test, so rewriting the copy into "You have no RFQs"
    // kept the suite green — the cycle-5 self-comparison class.
    assert.match(RFQ_ERROR_COPY, /could not be read/i);
    assert.doesNotMatch(RFQ_ERROR_COPY, /\bno RFQs\b|\bnone\b|\byet\b|\bfirst RFQ\b/i, "the failed read must not state a fact about the account");
    // A substring any rewrite can keep is not a guard: the empty state may
    // promise nothing about delivery, because 3 of 10,922 records are claimed
    // and an unclaimed supplier is not reached at all until REZ-D's email.
    assert.equal(
      RFQ_EMPTY_COPY,
      "Your first RFQ lands here. Suppliers answer inside the platform, with the record attached.",
    );
    assert.doesNotMatch(RFQ_EMPTY_COPY, /\bemail\b|\bhours?\b|\bdays?\b|\bwithin\b|\breply by\b|\bguarantee/i, "the empty state may not promise delivery");
    assert.notEqual(RFQ_ERROR_COPY, RFQ_EMPTY_COPY);
    const html = renderToStaticMarkup(
      createElement(RfqList, {
        model: { sent: null, quotes: null, chips: [], rows: [], footer: "The RFQ list could not be read", toast: null, error: true } as RfqListModel,
      }),
    );
    assert.match(html, /could not be read/i);
    assert.doesNotMatch(html, /no RFQs/i);
  });
});

describe("the sheet makes no claim about pages changing since the read", () => {
  it("nothing on any of the four records says pages are unchanged", () => {
    for (const input of [aboniInput(), smKnitwearInput(), zaheenSampleInput(), arFashionInput()]) {
      const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
      assert.doesNotMatch(html, /pages unchanged since read|a source page changed since read/, `${input.profile.supplier.slug}`);
    }
    // The comparison needs `raw_hash` (REZ-C §4.3); the kit has no data for
    // it, so the model does not carry the field at all rather than carrying a
    // null that one edit turns into a claim.
    assert.ok(!("pagesUnchanged" in buildSheet(aboniInput())));
  });
});

describe("a mark says what its link opens", () => {
  it("a register page says register page; a brand's whole disclosure file says disclosure list", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    assert.match(html, /aria-label="Source: Export Promotion Bureau, Government \(opens the register page\)"/);
    // ASOS, NEXT and H&M each publish one file listing every supplier on the
    // list; 267 published records were told it was their register page.
    assert.match(html, /aria-label="Source: ASOS, Brand lists \(opens the disclosure list\)"/);
    assert.match(html, /aria-label="Source: H&amp;M, Brand lists \(opens the disclosure list\)"/);
    assert.doesNotMatch(html, /aria-label="Source: (?:ASOS|H&amp;M|NEXT|M&amp;S), Brand lists \(opens the register page\)"/);
  });
});

describe("the whole EPB line list of every fixture reaches the screens", () => {
  it("the three records cycle 7 showed as having no lines show their lines", () => {
    for (const [name, input, lines] of [
      ["SQ Celsius", buildingBrandListsInput(), 14],
      ["Aman Graphics", duplicateBrandRowsInput(), 34],
      ["Aswad", buildingSafetyOnlyInput(), 18],
    ] as const) {
      assert.equal(input.hscodes.length, lines, name);
      const card = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(input) }));
      assert.doesNotMatch(card, /no lines on file|none on the EPB page|not on the EPB list/, `${name}'s card denies its EPB lines`);
      assert.match(card, new RegExp(`${lines} HS lines`), name);
      const sheet = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
      assert.doesNotMatch(sheet, /Not on the EPB exporter list|no lines on file/, `${name}'s sheet denies its EPB lines`);
    }
  });

  it("every line the fixtures carry has EPB's own description and its exporter page", () => {
    for (const input of [aboniInput(), smKnitwearInput(), longestHsListInput(), buildingBrandListsInput(), duplicateBrandRowsInput(), buildingSafetyOnlyInput()]) {
      for (const line of input.hscodes) {
        assert.ok((line.description ?? "").length > 3, `${input.profile.supplier.slug} ${line.code} has no description`);
        assert.match(line.source_url ?? "", /^https:\/\/edb\.epb\.gov\.bd\/hscode-exporters\/\d+$/, `${input.profile.supplier.slug} ${line.code}`);
      }
    }
  });
});

describe("the certificate card's own mark links, and the sheet shows the register's lines", () => {
  it("a certificate whose document is a record page renders its square as a link", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    const certs = html.slice(html.indexOf('id="certificates"'));
    // The square was a `<span role="img">` — built with `sourceMark(kind)` and
    // no URL — on every certificate on every sheet.
    assert.match(certs, /<a href="https:\/\/wrapcompliance\.org\/certified-facility\/7865\/"[^>]*aria-label="Source: Worldwide Responsible Accredited Production, Certification bodies \(opens the register page\)"/);
    assert.match(certs, /<a href="https:\/\/www\.global-trace-base\.org\/SCO039488\/certificate-document"/);
    assert.equal((certs.match(/aria-label="Source: [^"]*"/g) ?? []).length, 4, "one square per certificate");
    assert.equal((certs.match(/<a href="[^"]*"[^>]*aria-label="Source: /g) ?? []).length, 4, "and every one of them links");
  });

  it("a certificate with no document keeps its square, unlinked, and its name still carries the tier", () => {
    const input = aboniInput();
    input.profile.certifications = input.profile.certifications.map((c) => ({ ...c, document_url: null }));
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    const certs = html.slice(html.indexOf('id="certificates"'));
    assert.doesNotMatch(certs, /<a href="[^"]*"[^>]*aria-label="Source: /);
    const unlinked = [...certs.matchAll(/<span role="img" aria-label="Source: ([^"]*)"/g)];
    assert.equal(unlinked.length, 4, "one unlinked square per certificate");
    // An unlinked mark has no "(opens ...)" tail to carry the tier in — the
    // name alone reads the same under a colour-blind eye as any other rank,
    // which is the exact WCAG 1.4.1/1.3.1 gap BLOCKING F1 part A closed for
    // the linked case; a mutation that dropped just the ", <tier name>" here
    // (`a11y-source-mark-drops-tier-name-unlinked`) passed every other test
    // in the suite; only this assertion catches it.
    for (const m of unlinked) assert.match(m[1]!, /, Certification bodies$/, m[0]);
  });

  it("the address the register filed keeps its line breaks", () => {
    // 4,596 of 10,266 published records file `address_raw` as a newline block;
    // in normal flow the breaks collapse and the street runs into the district.
    const input = buildingBrandListsInput();
    const fact = buildSheet(input).facts.find((f) => f.label === "Factory address")!;
    assert.match(fact.value ?? "", /\n/, "the fixture no longer carries the multi-line shape this guard is about");
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    const at = html.indexOf(escape(fact.value!.split("\n")[0]!));
    const element = html.slice(html.lastIndexOf("<span", at), at);
    assert.match(element, /whitespace-pre-line/, `the lines collapse into one: ${element}`);
  });

  it("a record whose only certificate is a building's says so in the section, not just the caption", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(buildingOnlyCertificateInput()) }));
    assert.match(html, /No certificate on this record ·/);
    assert.match(html, rx(`${MG_BUILDING} holds one`), "the section names where the certificate is");
    assert.doesNotMatch(html, /on any register/, "the bare negative stood over a payload holding one");
    assert.match(html, rx(`${MG_BUILDING} holds a certificate of its own`));
    // And a record with none anywhere names the registers that were read.
    const none = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(arFashionInput()) }));
    assert.match(none, /No certificate on 4 registers/);
    assert.doesNotMatch(none, /on any register/);
  });
});

describe("the composer says what the draft is, and promises nothing about delivery", () => {
  it("the preview heading names the message, not its arrival", () => {
    const html = renderToStaticMarkup(createElement(RfqComposer, { model: COMPOSER_MODEL }));
    assert.match(html, />The message this RFQ carries</);
    // "the message the supplier receives" is a delivery claim the kit may not
    // make: an unclaimed supplier is not reached until REZ-D's email work.
    assert.doesNotMatch(html, /the supplier receives|will receive|lands in their inbox|delivered/i);
  });
});

describe("a card tile with nothing to show says so, and never zero", () => {
  it("every empty tile is an em dash beside its reason", () => {
    for (const [name, input] of [
      ["a failed EPB read", { ...aboniInput(), hscodes: [], hscodesError: true } as RecordInput],
      ["the almost-empty record", arFashionInput()],
      ["the 125-character record", longestNameInput()],
    ] as [string, RecordInput][]) {
      const card = buildCard(input);
      const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
      for (const tile of card.tiles) {
        if (tile.value !== null) continue;
        // The sub-line says what was checked; the value must not read as a count.
        assert.ok(tile.sub, `${name}: an empty "${tile.label}" tile says nothing about why`);
        assert.doesNotMatch(html, new RegExp(`>${tile.label}<[^]{0,200}?>0<`), `${name}: "${tile.label} 0" over "${tile.sub}"`);
      }
      assert.match(html, /—/, `${name}: no tile shows the em dash`);
    }
  });
});

describe("the table row carries the same qualifier the card does", () => {
  it("a figure that excludes this record says so in both places", () => {
    const row = buildTableRow(smKnitwearInput());
    const card = buildCard(smKnitwearInput());
    const cardWords = card.meta.find((f) => /workers/.test(f.text))!.text;
    assert.match(cardWords, /none of them this record/);
    // The row printed the bare "1 of 2 sites", dropping the half that says
    // the 907 is entirely the Extension building's.
    assert.match(row.workersCoverage ?? "", /none of them this record/, `the row says only "${row.workersCoverage}"`);
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [row] }));
    assert.match(html, /none of them this record/);
  });
});

// ---------------------------------------------------------------------------
// Cycle 7 guards, at the boundary (§14). The shell's own markup: what the
// browser is handed, not what a model says.
// ---------------------------------------------------------------------------

const shellHtml = (over: Partial<Parameters<typeof AppShell>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(AppShell, {
      sidebar: { active: "search", counts: {}, recent: [], plan: { name: "Free" } },
      topbar: { caption: "10,266 published suppliers", initial: "R", searchAction: "/app/discover" },
      children: null,
      ...over,
    } as Parameters<typeof AppShell>[0]),
  );

/** The one `<nav aria-label="Primary…">` element's own open tag. */
function primaryNavTag(html: string): string {
  const m = html.match(/<nav\b[^>]*aria-label="Primary[^"]*"[^>]*>/);
  assert.ok(m, "no primary nav in the shell markup");
  return m[0];
}

describe("the phone nav strip does not clip its own focus ring", () => {
  it("the scroll container pads both axes and gives the padding back", () => {
    const tag = primaryNavTag(shellHtml());
    // `overflow-x-auto` computes `overflow-y: auto` as well, and an outline is
    // not scrollable overflow — so the global `outline-offset-2` ring is cut
    // top and bottom on a 32px strip unless the container carries the room.
    assert.match(tag, /\boverflow-x-auto\b/, "the strip is no longer a scroll container; this guard needs rewriting");
    const classes = new Set((tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/));
    for (const cls of ["-my-1", "py-1", "-mx-1", "px-1"]) {
      assert.ok(classes.has(cls), `the nav strip has no \`${cls}\`, so the focus ring is clipped: ${tag}`);
    }
    // And the rail above `md` must not inherit the phone strip's padding.
    for (const cls of ["md:my-0", "md:py-0"]) {
      assert.ok(classes.has(cls), `the rail keeps the strip's own padding above md: ${tag}`);
    }
  });
});

describe("the topbar search field can shrink to a phone", () => {
  it("the input and its wrapper both drop the intrinsic width floor", () => {
    const html = shellHtml();
    const form = html.match(/<form\b[^>]*role="search"[^>]*>/)?.[0] ?? "";
    assert.match(form, /\bmin-w-0\b/, `the search form has no min-w-0, so the document scrolls at 320px: ${form}`);
    const input = html.match(/<input\b[^>]*name="q"[^>]*>/)?.[0] ?? "";
    assert.ok(input, "no search input in the topbar");
    // A flex item defaults to `min-width: auto`; an input's intrinsic floor is
    // its `size` attribute, ~20 characters. Without `min-w-0` the input and
    // the ⌘K badge beside it sat on top of the buttons beside it at 320px.
    assert.match(input, /\bmin-w-0\b/, `the search input has no min-w-0: ${input}`);
    assert.match(input, /\bgrow\b/, "the search input no longer grows; this guard needs rewriting");
    // The signed-out variant renders a span in the same slot, same floor.
    const idle = shellHtml({ topbar: { caption: "", initial: null } });
    const span = idle.match(/<span class="[^"]*grow[^"]*">Search suppliers/)?.[0] ?? "";
    assert.match(span, /\bmin-w-0\b/, `the placeholder line has no min-w-0: ${span}`);
  });
});

describe("the shell offers no control without a destination", () => {
  // The Help button rendered with no href and no handler: a keyboard or
  // screen-reader user reached a control that did nothing (founder decision,
  // 24 Sep: none until /app/help exists). Static markup carries no click
  // handlers (two of the shell's children are client components), so a
  // control counts only as a link to a page that exists or as the submit of
  // the form it sits in; anything else focusable is a control going nowhere.
  const sidebar = {
    active: "search",
    counts: {},
    recent: [{ label: "Knit polo, GOTS", count: 12, href: "/app/discover?q=knit+polo" }],
    plan: { name: "Free" },
  };
  const shells = [
    { caption: "10,266 published suppliers", initial: "R", searchAction: "/app/discover" },
    { caption: "", initial: null },
  ].flatMap((model) => [
    renderToStaticMarkup(createElement(Topbar, { model } as Parameters<typeof Topbar>[0])),
    shellHtml({ topbar: model, sidebar } as Partial<Parameters<typeof AppShell>[0]>),
  ]);
  const insideForm = (html: string, at: number) => {
    const before = html.slice(0, at);
    return before.lastIndexOf("<form") > before.lastIndexOf("</form>");
  };

  // Every app route that has a page, as a pattern: `(group)` segments drop
  // out of the URL, `[param]` matches any one segment.
  const routes: RegExp[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const seg = /^\(.*\)$/.test(entry.name) ? null : /^\[.*\]$/.test(entry.name) ? "[^/]+" : entry.name;
        walk(path.join(dir, entry.name), seg ? [...segs, seg] : segs);
      } else if (/^page\.tsx?$/.test(entry.name)) {
        routes.push(new RegExp(`^/${segs.join("/")}$`));
      }
    }
  };
  walk(path.join(process.cwd(), "app"), []);
  const pageExists = (href: string) => routes.some((r) => r.test(href.split(/[?#]/)[0]!.replace(/\/$/, "") || "/"));

  it("every link reaches a page that exists, or an id on this page", () => {
    for (const html of shells) {
      for (const a of html.match(/<a\b[^>]*>/g) ?? []) {
        const href = a.match(/\bhref="([^"]*)"/)?.[1];
        assert.ok(href, `a link with no destination: ${a}`);
        if (href.startsWith("#")) assert.match(html, new RegExp(`\\bid="${href.slice(1)}"`), `a link to a missing id: ${a}`);
        else assert.ok(pageExists(href), `a link to a page that does not exist: ${a}`);
      }
      // A form is a destination too: its submit goes where `action` says.
      for (const f of html.match(/<form\b[^>]*>/g) ?? []) {
        const action = f.match(/\baction="([^"]*)"/)?.[1];
        assert.ok(action && pageExists(action), `a form posting to a page that does not exist: ${f}`);
      }
    }
  });

  it("every button and form field sits in a form it submits, and nothing else poses as a control", () => {
    for (const html of shells) {
      for (const m of html.matchAll(/<button\b[^>]*>/g)) {
        assert.match(m[0], /\btype="submit"/, `a button with no destination: ${m[0]}`);
        assert.ok(insideForm(html, m.index!), `a submit button outside any form: ${m[0]}`);
      }
      // A submit can post elsewhere (formaction); any control can join another
      // form by id (form=), select and textarea included.
      for (const m of html.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/g)) {
        const to = m[0].match(/\bformAction="([^"]*)"|\bformaction="([^"]*)"/i);
        if (to) assert.ok(pageExists(to[1] ?? to[2] ?? ""), `a submit posting to a page that does not exist: ${m[0]}`);
        assert.doesNotMatch(m[0], /\bform="/, `a control submitting a form it does not sit in: ${m[0]}`);
      }
      // <input type=button|reset|image> does nothing without script; any other
      // field (the search box, a submit) is only a control inside its form.
      for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
        assert.doesNotMatch(m[0], /\btype="(?:button|reset|image)"/i, `a field posing as a button: ${m[0]}`);
        assert.ok(insideForm(html, m.index!), `a form field outside any form: ${m[0]}`);
      }
      for (const t of html.match(/<(?!a\b|button\b|input\b|select\b|textarea\b|main\b)[a-z]+\b[^>]*(?:role="button"|tabindex="(?!-1")[^"]*")[^>]*>/g) ?? []) {
        assert.fail(`a focusable non-control with no destination: ${t}`);
      }
      assert.doesNotMatch(html, /<summary\b/, "a <summary> toggle in the shell");
    }
  });

  it("no Help control, by any name, value, text or link, until the help page exists", () => {
    const helpPage = pageExists("/app/help");
    for (const html of shells) {
      const named =
        /(?:aria-[a-z]+|title|value|placeholder|alt)="[^"]*\bhelp\b[^"]*"|>[^<]*\bhelp\b[^<]*<|>\s*\?\s*<|href="\/app\/help\b/i.test(html);
      if (!helpPage) assert.ok(!named, `a Help control renders with nowhere to go: ${html}`);
    }
  });
});

describe("each result's actions are tied to its supplier (WCAG 2.4.4)", () => {
  // Every row and card repeats "Open", "Send RFQ" and "Save". A link's
  // context is its cell's headers, so the supplier name must be the row
  // header; on a card it must be a heading the actions sit under.
  const text = (h: string) =>
    h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();

  it("the table's supplier name is the row header of every row, in the row with its actions", () => {
    const rows = [buildTableRow(aboniInput()), buildTableRow(arFashionInput())];
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows }));
    const trs = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]!).filter((tr) => /<td\b/.test(tr));
    assert.equal(trs.length, rows.length);
    trs.forEach((tr, i) => {
      const th = tr.match(/<th\b[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/);
      assert.ok(th, `row ${i} has no row header, so its actions have no supplier context`);
      assert.ok(text(th[1]!).includes(rows[i]!.name), `row ${i}'s header is not its supplier: ${text(th[1]!)}`);
      assert.match(tr, />Open</, `row ${i}'s Open is not in the row its header names`);
    });
  });

  it("a card's supplier name is a heading", () => {
    const card = buildCard(aboniInput());
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card }));
    const heading = html.match(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/);
    assert.ok(heading, "the card has no heading");
    assert.equal(text(heading[2]!), card.name);
  });
});

describe("aria-current marks the page the buyer is actually on, or nothing", () => {
  it("a null active key leaves no link claiming to be the current page", () => {
    // `/app/searches` and `/app/searches/new` passed "search", whose href is
    // `/app/discover`. A screen reader announced the buyer as being on a page
    // they were not on, and following the link was the only way to find out.
    const none = shellHtml({ sidebar: { active: null, counts: {}, recent: [], plan: { name: "Free" } } });
    assert.doesNotMatch(none, /aria-current/, "a link claims to be the current page on a route no nav item points at");
    // The ordinary case still marks exactly one, and marks the right one.
    const on = shellHtml({ sidebar: { active: "products", counts: {}, recent: [], plan: { name: "Free" } } });
    const marked = [...on.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    assert.equal(marked.length, 1, `expected one current link, got ${marked.length}`);
    assert.match(marked[0]!, /href="\/app\/products"/);
  });
});

describe("the ⌘K the topbar advertises is a shortcut that exists", () => {
  it("⌘K and Ctrl+K are the shortcut, and nothing else is", () => {
    assert.equal(isSearchShortcut({ key: "k", metaKey: true }), true);
    assert.equal(isSearchShortcut({ key: "K", ctrlKey: true }), true, "caps lock still means ⌘K");
    assert.equal(isSearchShortcut({ key: "k" }), false, "a bare k is someone typing");
    assert.equal(isSearchShortcut({ key: "j", metaKey: true }), false);
    assert.equal(isSearchShortcut({ key: "k", metaKey: true, shiftKey: true }), false);
    assert.equal(isSearchShortcut({ key: "k", metaKey: true, altKey: true }), false);
    // Both modifiers at once is a chord the OS claims; leave it alone.
    assert.equal(isSearchShortcut({ key: "k", metaKey: true, ctrlKey: true }), false);
  });

  it("it does not take the key off somebody who is typing", () => {
    // These routes carry nine filter inputs and a save-search name box, and on
    // macOS Ctrl+K in a text field is the native delete-to-end-of-line. A
    // window-level listener that swallowed it took a keystroke from a buyer
    // who was using it, with no way to turn the theft off.
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input", "textarea"]) {
      assert.equal(targetIsEditable({ tagName }), true, tagName);
      assert.equal(isSearchShortcut({ key: "k", metaKey: true, target: { tagName } }), false, `${tagName} lost its ⌘K`);
    }
    assert.equal(targetIsEditable({ isContentEditable: true }), true);
    assert.equal(isSearchShortcut({ key: "k", ctrlKey: true, target: { isContentEditable: true } }), false);
    // Anywhere else it is ours.
    assert.equal(isSearchShortcut({ key: "k", metaKey: true, target: { tagName: "BODY" } }), true);
    assert.equal(targetIsEditable(null), false);
    assert.equal(targetIsEditable("INPUT"), false, "a string is not an element");
  });

  it("pressing it focuses the field and selects what is in it", () => {
    // The previous version of this guard tested only the modifier predicate.
    // Deleting `<SearchShortcut />` from the topbar, or the addEventListener
    // inside it, restored the original defect with every test green — the
    // predicate's only caller could vanish and nothing noticed. The handler is
    // a value now, so the behaviour itself can be driven.
    const calls: string[] = [];
    const field = {
      focus: () => calls.push("focus"),
      select: () => calls.push("select"),
    };
    const doc = {
      querySelector: (sel: string) => {
        calls.push(`query:${sel}`);
        return sel === SEARCH_FIELD_SELECTOR ? field : null;
      },
    };
    const handler = searchShortcutHandler(doc);

    let prevented = 0;
    assert.equal(handler({ key: "k", metaKey: true, preventDefault: () => prevented++ }), true);
    assert.deepEqual(calls, [`query:${SEARCH_FIELD_SELECTOR}`, "focus", "select"]);
    assert.equal(prevented, 1, "the browser's own ⌘K ran as well");

    // A key that is not the shortcut never touches the document.
    calls.length = 0;
    assert.equal(handler({ key: "k", preventDefault: () => prevented++ }), false);
    assert.deepEqual(calls, []);
    assert.equal(prevented, 1);

    // A page with no search field: nothing to focus, so nothing is swallowed.
    const empty = searchShortcutHandler({ querySelector: () => null });
    assert.equal(empty({ key: "k", metaKey: true, preventDefault: () => prevented++ }), false);
    assert.equal(prevented, 1, "preventDefault fired with no field to focus");
    assert.equal(focusSearchField({ querySelector: () => null }), false);
    assert.equal(focusSearchField({ querySelector: () => ({}) }), false, "an element with no focus() is not a field");
  });

  it("mounting it subscribes to keydown, and unmounting unsubscribes", () => {
    // `useEffect` does not run here, so with the wiring inside it, replacing
    // `window.addEventListener` with `void onKeyDown` kept the whole suite
    // green — the mount was proved, the handler was proved, and the one line
    // joining them was not.
    const bound: [string, unknown][] = [];
    const win = {
      addEventListener: (type: string, fn: (e: never) => void) => bound.push([type, fn]),
      removeEventListener: (type: string, fn: (e: never) => void) => {
        const i = bound.findIndex(([t, f]) => t === type && f === fn);
        if (i >= 0) bound.splice(i, 1);
      },
    };
    const field = { focus: () => {}, select: () => {} };
    const cleanup = installSearchShortcut(win, { querySelector: () => field });
    assert.equal(bound.length, 1, "mounting the shortcut subscribed to nothing");
    assert.equal(bound[0]![0], "keydown");
    // And what it subscribed is the real handler, not any function.
    const listener = bound[0]![1] as (e: unknown) => unknown;
    assert.equal(listener({ key: "k", metaKey: true, preventDefault: () => {} }), true);
    assert.equal(listener({ key: "k" }), false);
    cleanup();
    assert.equal(bound.length, 0, "unmounting left the listener attached");
  });

  it("the topbar that shows the badge is the one that mounts the listener", () => {
    // Structural, because `SearchShortcut` renders null and cannot be seen in
    // the markup. Walking the element tree is what makes deleting the mount go
    // red.
    const tree = Topbar({ model: { caption: "", initial: "R", searchAction: "/app/discover" } });
    const mounted: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return void node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const el = node as { type?: unknown; props?: { children?: unknown } };
      if (typeof el.type === "function") mounted.push(el.type);
      if (el.props && "children" in el.props) walk(el.props.children);
    };
    walk(tree);
    assert.ok(
      mounted.some((t) => (t as { name?: string }).name === "SearchShortcut"),
      "the topbar renders the ⌘K badge without mounting anything that listens for it",
    );

    // And the selector the handler uses has to match what this topbar renders.
    const live = shellHtml();
    assert.match(live, /⌘K/, "the topbar with a real search form dropped its own shortcut hint");
    assert.match(live, /<form[^>]*role="search"/);
    assert.match(live, /<input[^>]*name="q"/);

    // Nothing mounts on a topbar with no form, so nothing may advertise one —
    // anywhere in the document. The previous version of this assertion looked
    // at a 400-character window around the topbar placeholder and could not
    // see the sidebar's own Search row, which printed ⌘K unconditionally.
    const idle = shellHtml({ topbar: { caption: "", initial: null } });
    assert.doesNotMatch(idle, /⌘K/, "a shell with no search form still advertises the shortcut somewhere");
    const idleTree = Topbar({ model: { caption: "", initial: null } });
    const idleMounted: unknown[] = [];
    const walk2 = (node: unknown): void => {
      if (Array.isArray(node)) return void node.forEach(walk2);
      if (!node || typeof node !== "object") return;
      const el = node as { type?: unknown; props?: { children?: unknown } };
      if (typeof el.type === "function") idleMounted.push(el.type);
      if (el.props && "children" in el.props) walk2(el.props.children);
    };
    walk2(idleTree);
    assert.ok(!idleMounted.some((t) => (t as { name?: string }).name === "SearchShortcut"));
  });
});

describe("the shell's landmarks and the routes they cover", () => {
  it("every landmark the shell renders carries a name when the screen has one", () => {
    // Six shells share one document in /dev/ds. `screenLabel` was documented as
    // reaching nav and search and had only ever reached nav and main, leaving
    // six identical unnamed search landmarks and six unnamed asides.
    const html = shellHtml({ screenLabel: "Discover" });
    assert.match(html, /<nav[^>]*aria-label="Primary, Discover"/);
    assert.match(html, /<main[^>]*aria-label="Discover"/);
    assert.match(html, /<form[^>]*role="search"[^>]*aria-label="Search, Discover"|<form[^>]*aria-label="Search, Discover"[^>]*role="search"/);
    assert.match(html, /<aside[^>]*aria-label="Sidebar, Discover"/);
    // With no screen label they are still named, just not disambiguated.
    const bare = shellHtml();
    assert.match(bare, /<aside[^>]*aria-label="Sidebar"/);
    assert.match(bare, /aria-label="Search"/);
  });

  it("the content landmark can take focus, so the skip link lands", () => {
    // Without tabIndex the skip link relies on the browser moving focus to a
    // non-focusable fragment target, which older Safari does not do. The shell
    // this kit replaces sets it.
    assert.match(shellHtml(), /<main[^>]*tabindex="-1"/i);
  });

  it("the saved-search list is reachable from the rail", () => {
    // It was linked from nowhere in the product: not this rail, not
    // components/shell/sidebar.tsx. A buyer who saved a search could not get
    // back to it without typing the URL.
    const html = shellHtml();
    assert.match(html, /href="\/app\/searches"/, "nothing in the shell links to the saved-search list");
    // And landing on it marks that row, not a link to somewhere else.
    const on = shellHtml({ sidebar: { active: "searches", counts: {}, recent: [], plan: { name: "Free" } } });
    const marked = [...on.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    assert.equal(marked.length, 1);
    assert.match(marked[0]!, /href="\/app\/searches"/);
  });
});

// ---------------------------------------------------------------------------
// Cycle 9 guards. Five reviewers ran against cycle 8's repairs; these pin what
// those repairs got wrong.
// ---------------------------------------------------------------------------

describe("the rail says current-page only for the page the buyer is on", () => {
  it("a route under a nav item is current-section, not current-page", () => {
    // `/app/searches/new` resolved to the `searches` key and the rail then put
    // `aria-current="page"` on the link to `/app/searches` — announcing the
    // buyer as being on a page they were not on, which is the exact defect the
    // nested matching was added next to a fix for. The route every buyer lands
    // on after pressing Save search.
    assert.deepEqual(navMatch("/app/searches"), { key: "searches", exact: true });
    assert.deepEqual(navMatch("/app/searches/new"), { key: "searches", exact: false });
    assert.deepEqual(navMatch("/app/rfqs/abc-123"), { key: "rfqs", exact: false });

    const under = shellHtml({
      sidebar: { active: "searches", activeExact: false, counts: {}, recent: [], plan: { name: "Free" } },
    });
    const marked = [...under.matchAll(/<a\b[^>]*aria-current="([^"]*)"[^>]*>/g)];
    assert.equal(marked.length, 1);
    assert.equal(marked[0]![1], "true", "a section ancestor is announced as the current page");

    const on = shellHtml({
      sidebar: { active: "searches", activeExact: true, counts: {}, recent: [], plan: { name: "Free" } },
    });
    assert.match(on, /aria-current="page"/);
  });

  it("the supplier record belongs to Suppliers", () => {
    // Spec §3.3 and §3.4 are the screens a buyer actually sits on, and no nav
    // item has that href — the Suppliers row points at the search — so the rail
    // highlighted nothing there.
    assert.deepEqual(navMatch("/app/suppliers/aboni-knitwear-ltd"), { key: "suppliers", exact: false });
    assert.deepEqual(navMatch("/app/suppliers/aboni-knitwear-ltd/lines/6109"), { key: "suppliers", exact: false });
    assert.deepEqual(navMatch("/app/nowhere/deep"), { key: null, exact: false });
  });
});

describe("a chip carries a building's name, so it wraps", () => {
  it("nothing in a chip forbids wrapping", () => {
    // One chip — "RSC covers S M Knitwears Limited. (Extension) · 53 % ·
    // behind schedule" — is 428px on one line, and inside a 218px column at
    // 320px it alone forced the whole document to 493px. Hiding that single
    // element dropped it to 320. The panel-header repair before it was real
    // and was not the cause.
    const html = renderToStaticMarkup(
      createElement(Chip, null, "RSC covers S M Knitwears Limited. (Extension) · 53 % · behind schedule"),
    );
    const cls = (html.match(/class="([^"]*)"/) ?? [])[1] ?? "";
    assert.doesNotMatch(cls, /\bwhitespace-nowrap\b/, `a chip cannot wrap: ${cls}`);
    assert.match(cls, /\[overflow-wrap:anywhere\]/, `a single long token still overflows the column: ${cls}`);
    // The one-line case must not get taller: `min-h` replaces the fixed `h`.
    assert.ok(
      !cls.split(/\s+/).some((c) => /^h-\[/.test(c)),
      `a chip still has a fixed height, so a wrapped line is clipped: ${cls}`,
    );
    assert.match(cls, /\bmin-h-\[/, cls);
  });
});

describe("every product tile is reachable", () => {
  const tiles = Array.from({ length: 6 }, (_, i) => ({
    hs: `610${i + 1}`,
    heading: `Heading ${i + 1}`,
    src: null,
    alt: `Heading ${i + 1}`,
  }));

  it("the strip scrolls and is named, instead of hiding five of six", () => {
    // Measured: clientWidth 218 against scrollWidth 832 at 320px — one tile of
    // six visible, the rest with no scroll, no focus and no way to reach them.
    // Content present at 1280 and gone at 320 is what 1.4.10 forbids.
    const html = renderToStaticMarkup(
      createElement(PhotoStrip, { tiles: tiles as never, totalLines: 12 } as never),
    );
    const strip = html.match(/<div[^>]*role="region"[^>]*>/)?.[0] ?? "";
    assert.ok(strip, `the tile strip is not a scroll region: ${html.slice(0, 300)}`);
    assert.match(strip, /\boverflow-x-auto\b/, `the strip still hides what it cannot fit: ${strip}`);
    assert.match(strip, /tabindex="0"/i, "the strip cannot be scrolled from the keyboard");
    assert.match(strip, /aria-label="[^"]+"/, "the scroll region has no name");
  });

  it("nothing on the card promises an action that does not exist", () => {
    // `+N` was a `<button type="button">` named "All 12 lines" with no handler,
    // no href and no form, on every card whose supplier has more lines than
    // tiles. The screen it would open is spec §3.4, which is not built.
    const html = renderToStaticMarkup(
      createElement(PhotoStrip, { tiles: tiles as never, totalLines: 12 } as never),
    );
    assert.doesNotMatch(html, /<button/, `a control with a name and no behaviour: ${html}`);
    assert.match(html, /\+6 lines</, "the count of unshown lines is no longer stated at all");
  });
});

describe("the shortcut reaches the topbar's own field, on every route", () => {
  it("the field is named rather than inferred", () => {
    // `form[role="search"] input[name="q"]` matched TWO elements on
    // /app/products, which renders its own search form over an `input name="q"`
    // — a route this same rail links to. Only DOM order decided which one ⌘K
    // focused, and the docstring's justification ("only the topbar renders such
    // a form") was simply false.
    assert.equal(SEARCH_FIELD_SELECTOR, 'input[data-search="topbar"]');
    const live = shellHtml();
    const matches = [...live.matchAll(/data-search="topbar"/g)];
    assert.equal(matches.length, 1, "the topbar's field is not uniquely marked");
    assert.match(live, /<input[^>]*data-search="topbar"[^>]*>/);
  });

  it("pressing it again inside the search field re-selects, rather than doing nothing", () => {
    // Treating the search input as "somebody is typing" made the badge beside
    // it advertise a key that did nothing in exactly the place it should do the
    // most.
    assert.equal(targetIsSearchField({ dataset: { search: "topbar" } }), true);
    assert.equal(targetIsSearchField({ getAttribute: (n: string) => (n === "data-search" ? "topbar" : null) }), true);
    assert.equal(targetIsSearchField({ tagName: "INPUT" }), false);
    assert.equal(
      isSearchShortcut({ key: "k", metaKey: true, target: { tagName: "INPUT", dataset: { search: "topbar" } } }),
      true,
      "⌘K is inert in the field it exists to reach",
    );
    // Any other field still keeps its own keystroke.
    assert.equal(isSearchShortcut({ key: "k", ctrlKey: true, target: { tagName: "INPUT" } }), false);
  });
});

describe("the sort menu opens inside the viewport", () => {
  it("it is anchored left below sm and right above it", () => {
    // Making the control row wrap moved the summary to the start of its row,
    // and `right-0` then put a 224px menu's left edge at -55px on a 320px
    // screen — the first six characters of every option off the viewport, with
    // no scroll to reach them, because an absolute overflow to the left creates
    // none. Measured after the fix: 34–258 inside 320.
    const html = renderToStaticMarkup(
      createElement(PanelHeader, {
        model: {
          title: "Knitted shirts",
          total: 42,
          shown: 4,
          sortLabel: "Most sources",
          view: "cards" as const,
          sortOptions: [{ label: "Most sources", value: "receipts", href: "?sort=receipts" }],
        },
      }),
    );
    const menu = html.match(/<div class="([^"]*absolute[^"]*)"/)?.[1] ?? "";
    assert.ok(menu, "the sort menu is no longer absolutely positioned; this guard needs rewriting");
    const cls = new Set(menu.split(/\s+/));
    assert.ok(cls.has("left-0"), `the menu is not anchored left on a phone: ${menu}`);
    assert.ok(cls.has("sm:right-0") && cls.has("sm:left-auto"), `the menu no longer right-aligns above sm: ${menu}`);
    assert.ok(
      [...cls].some((c) => c.startsWith("max-w-[")),
      `the menu has no width ceiling, so a 224px min-width can still exceed a 320px screen: ${menu}`,
    );
  });
});
