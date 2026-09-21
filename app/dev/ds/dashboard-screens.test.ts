// The page-composition layer, at the boundary (closed-loop §14).
//
// This is the REZ-72 shape verbatim: `components/dashboard/render.test.ts`
// proves the components hide every V2 surface when the prop is false, and
// proves the panel header says "count could not be read" when the total is
// null — but nothing proved the caller passes false, or passes null. The
// cycle-5 test-adequacy critic flipped every `askEnabled`/`aiEnabled` in this
// file to true and replaced the panel caption with "0 suppliers", and all 770
// tests stayed green, because `dashboard-screens.tsx` was imported by no test
// at all.
//
// These assertions are on the rendered HTML of the whole gallery, built from
// the same fixtures the screenshots use.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildCard, buildProductSheet, buildRfqRow, buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import { topTier } from "@/lib/dashboard/source-tiers";
import { contrastRatio, light, resolve } from "@/lib/design/tokens";
import {
  aboniInput,
  arFashionInput,
  buildingRegistrationsInput,
  inheritedPillsInput,
  longestHsListInput,
  longestProductListInput,
  RFQ_ROWS,
  RFQ_TARGETS,
  smKnitwearInput,
  TODAY,
  zaheenSampleInput,
} from "@/lib/dashboard/fixtures";
import { GALLERY_QUERY, SORT_MOST_SOURCES, topbarCaption, type GalleryData, type GalleryRecord } from "@/lib/dashboard/gallery-data";
import type { RfqListModel } from "@/lib/dashboard/models";
import { composerModel, DashboardScreens, SCREEN_WIDTH } from "./dashboard-screens";

const EMPTY_RFQS: RfqListModel = {
  sent: 0,
  quotes: 0,
  chips: [{ label: "All", count: 0, on: true }],
  rows: [],
  footer: "No RFQs for this account yet",
  toast: null,
};

function galleryData(over: Partial<GalleryData> = {}): GalleryData {
  const rec = (input: ReturnType<typeof aboniInput>, slug: string): GalleryRecord => ({ slug, input });
  const records = {
    aboni: rec(aboniInput(), "aboni-knitwear"),
    sm: rec(smKnitwearInput(), "sm-knitwear"),
    zaheen: rec(zaheenSampleInput(), "zaheen-knitwear"),
    ar: rec(arFashionInput(), "ar-fashion"),
  };
  const inputs = [records.aboni, records.sm, records.zaheen, records.ar];
  return {
    today: TODAY,
    plan: null,
    discoverError: false,
    rfqError: false,
    records,
    cards: inputs.map((r) => buildCard(r.input)),
    rows: inputs.map((r) => buildTableRow(r.input)),
    sheet: buildSheet(records.aboni.input),
    productSheet: buildProductSheet(records.aboni.input, "6105"),
    total: 42,
    published: 10266,
    recordsReadOn: "30 Jul – 18 Sep 2026",
    recordsRead: 4,
    // The default fixture has no rows beyond the four named records — the
    // same case the harness renders from (fixtureRpc never returns a slug
    // outside the named four) — so the table's own span equals the named
    // one here. A test that wants to prove the two screens can diverge
    // overrides both pairs together, the way `loadGalleryData` would.
    tableRecordsReadOn: "30 Jul – 18 Sep 2026",
    tableRecordsRead: 4,
    rfqs: EMPTY_RFQS,
    ...over,
  };
}

/**
 * The rendered screens without the gallery's own captions. A `figcaption`
 * describes the screen in prose — "AI is off in this build, so the V2 surfaces
 * (Improve wording, Follow-up rules) are absent" — and an assertion that
 * matched it would pass whatever the screen itself rendered.
 */
const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const render = (d: GalleryData) =>
  renderToStaticMarkup(createElement(DashboardScreens, { data: d })).replace(/<figcaption[\s\S]*?<\/figcaption>/g, "");

/** With the captions, for the assertions that are about the captions. */
const renderAll = (d: GalleryData) => renderToStaticMarkup(createElement(DashboardScreens, { data: d }));

describe("DashboardScreens — the caller, not the components (handoff §7)", () => {
  it("every AI surface is off on every screen, because the page passes false", () => {
    const html = render(galleryData());
    assert.doesNotMatch(html, />V2</, "the V2 stamp marks an AI surface; none may render in this build");
    assert.doesNotMatch(html, /Improve wording/);
    assert.doesNotMatch(html, /Follow-up rules/);
    assert.doesNotMatch(html, /text-smart/);
    assert.doesNotMatch(html, /Why matched/);
    assert.doesNotMatch(html, /aria-pressed="[^"]*"[^>]*>\s*Ask/);
  });

  it("no screen renders a score, a grade, a star or a verified badge", () => {
    assert.doesNotMatch(render(galleryData()), /\d+\s*%\s*match|match(?:ed)?\s*\d+\s*%|\bscore\b|\brating\b|★|\bVerified\b/i);
  });

  it("the sanctioned sample reaches the cards, the table and the composer", () => {
    const html = render(galleryData());
    assert.match(html, /data-sanctioned="true"/);
    assert.match(html, /Sanctioned · sample/);
  });

  it("the panel caption is the RPC's count, and a failed read is unknown rather than zero", () => {
    const ok = render(galleryData());
    assert.match(ok, /42 suppliers/);
    assert.doesNotMatch(ok, /0 suppliers/);
    assert.doesNotMatch(ok, /null suppliers/);

    const failed = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.match(failed, /count could not be read/);
    assert.doesNotMatch(failed, /0 suppliers/);
    assert.doesNotMatch(failed, /null/);
  });

  // Cycle 5, finding 15: "1–4 of 42 · 25 per page · Page 1 of 2" over a
  // four-row panel, with Next enabled and no page 2.
  it("the footer describes the page it rendered — no page size, no pager it cannot honour", () => {
    const html = render(galleryData());
    assert.match(html, /the named test records of the rebuild spec · 42 in the result set/);
    assert.doesNotMatch(html, /1–4 of 42/, "the header dropped this range in cycle 5; the footer printed it under the same rows until cycle 8");
    assert.doesNotMatch(html, /per page/);
    assert.doesNotMatch(html, /Page 1 of/);
    assert.doesNotMatch(html, /aria-label="Next page"/);
  });

  // Handoff §3.10: no billing exists, so the plan line names the beta and
  // never a plan name or a renewal date.
  it("the sidebar plan line is the beta literal, never a plan or a renewal date", () => {
    const html = render(galleryData());
    assert.match(html, /Free · public beta/);
    assert.doesNotMatch(html, /Team plan/);
    assert.doesNotMatch(html, /renews/i);
    assert.doesNotMatch(html, /RFQs this month/);
    assert.match(render(galleryData({ plan: "Studio" })), /Studio/, "a plan from settings is used when there is one");
  });

  it("the topbar caption carries only what could be read", () => {
    // The date is `max(last_seen_at)` over the records this page draws, not
    // over the corpus the count is of: 1,677 of the 10,266 were last read on
    // The caption has been wrong twice, in two different ways. First the
    // statistic: a maximum over four records printed as "records read 18 Sep
    // 2026" while one of them had last been read 30 Jul. Then the subject:
    // the repair made it a range and dropped the scope, so "supplier records
    // read 18 May – 18 Sep 2026" sat beside "10,266 published suppliers" and
    // read as a corpus claim — 1,214 published records have no read at all
    // inside that window and the corpus's oldest is 13 May (SQL, 20 Sep 2026).
    // It must carry both: a range, and the population it is a range over.
    assert.equal(
      topbarCaption({ published: 10266, recordsReadOn: "30 Jul – 18 Sep 2026", recordsRead: 4 }),
      "10,266 published suppliers · 4 records on this page, read 30 Jul – 18 Sep 2026",
    );
    assert.equal(topbarCaption({ published: null, recordsReadOn: "18 Sep 2026", recordsRead: 1 }), "1 record on this page, read 18 Sep 2026");
    // The record clause pluralises; the corpus clause did not, and the
    // assertion froze the ungrammatical form as the expected value.
    assert.equal(topbarCaption({ published: 1, recordsReadOn: null, recordsRead: null }), "1 published supplier");
    assert.equal(topbarCaption({ published: 2, recordsReadOn: null, recordsRead: null }), "2 published suppliers");
    assert.equal(topbarCaption({ published: null, recordsReadOn: null, recordsRead: null }), "Live records");
    const shell = render(galleryData());
    assert.match(shell, /10,266 published suppliers · 4 records on this page, read 30 Jul – 18 Sep 2026/);
    // Neither failure mode may come back: no bare date, and no clause that
    // follows the corpus count with a date but no population of its own.
    assert.doesNotMatch(shell, /records read \d+ \w+ \d{4}(?!\s*–)/, "the newest read must not stand for every record");
    for (const m of shell.matchAll(/published suppliers · ([^<]*)/g)) {
      const clause = m[1]!;
      if (!/\d{4}/.test(clause)) continue;
      assert.match(clause, /on this page/, `a date printed beside the corpus count with no population of its own: "${clause}"`);
    }
  });

  it("the 'records on this page' clause does not travel to the RFQ list screen, which draws none", () => {
    // `drawsRecords` (dashboard-screens.tsx) exists only to keep this clause
    // off the one screen that draws zero supplier records. A mutation sweep
    // found it could be hardcoded to `true` — putting "N records on this
    // page, read …" on the RFQ list too — with every test above still green,
    // because they all check the clause's own wording, never which screens
    // carry it.
    const html = renderAll(galleryData());
    const frames = [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)];
    const rfqList = frames.find((m) => m[1] === "rfq-list")?.[0];
    assert.ok(rfqList, "the rfq-list screen must be in the gallery");
    assert.match(rfqList!, /published suppliers?/, "the RFQ screen still names the corpus");
    assert.doesNotMatch(rfqList!, /records? on this page/, "the RFQ list draws no supplier records, so it must not claim to");
  });

  // Cycle 17, correctness critic's finding. `discover_suppliers`'s top rows
  // for this query return slugs outside the four named records on a real
  // read (SQL, 20 Sep 2026) — only the table screen draws them
  // (`rowRecords` in gallery-data.ts), yet one shared `shellModels(d,
  // "suppliers")` object used to hand every screen the same topbar. A caption
  // built over the wider, table-only population would then sit on the
  // results-list, both sheets and the composer, each of which draws only the
  // four named records — the "caption states the wrong population" defect
  // class this project has always treated as blocking, just cross-screen
  // rather than within one.
  it("the table's wider record count does not travel to the screens that draw only the four named records", () => {
    const html = renderAll(galleryData({ tableRecordsRead: 7, tableRecordsReadOn: "18 May – 18 Sep 2026" }));
    const frames = [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)];
    const only = (id: string) => frames.find((m) => m[1] === id)?.[0];
    assert.match(only("results-table")!, /7 records on this page, read 18 May – 18 Sep 2026/, "the table screen must carry its own, wider span");
    for (const id of ["results-list", "supplier-sheet", "product-sheet", "rfq-composer"]) {
      const frame = only(id);
      assert.ok(frame, `${id} must render`);
      assert.match(frame!, /4 records on this page, read 30 Jul – 18 Sep 2026/, `${id} draws only the four named records and must state their span, not the table's`);
      assert.doesNotMatch(frame!, /7 records on this page/, `${id} must not carry the table-only count`);
    }
  });

  // Cycle 18's own critics: the topbar fix above only moved the *topbar's*
  // caption to the table's own span. The panel header, the panel footer and
  // the figure's own caption all separately called the table's rows "the
  // named test records of the rebuild spec" / "the same named records as the
  // card view" — true only when `extra` is empty (the screenshot harness's
  // fixture stub), false the moment a live read's discovery rows join the
  // table (confirmed live in production by two independent critics against
  // this same candidate). `tableSelection` in dashboard-screens.tsx now
  // states the wider population whenever `rows` outgrows `cards`; the card
  // view's own header/footer/caption must still say the narrower, unchanged
  // thing.
  // Cycle 19's guard-adequacy critic: the original version of this test only
  // ever exercised exactly one extra row, so the pluralisation branch and the
  // zero-extra branch were never run, and the figure's own caption used to be
  // a second, independent copy of the extra-row arithmetic (hard-coding
  // "four" instead of deriving it — correctness, cycle 19) that this loop
  // would have caught. The figure note now calls `tableSelection(d)`
  // directly, so one implementation backs the panel header, the panel
  // footer and the figure caption alike; this loop pins all three together
  // at zero extras (the screenshot harness's own shape), one (the old
  // singular case), two (the plural branch) and four (production's real
  // shape — `discover_suppliers`'s own comment, SQL dated 20 Sep 2026).
  const EXTRA_FIXTURES = [inheritedPillsInput(), buildingRegistrationsInput(), longestHsListInput(), longestProductListInput()];
  for (const extraCount of [0, 1, 2, 4]) {
    it(`the table's panel header, footer and figure caption state the wider population with ${extraCount} discovery row${extraCount === 1 ? "" : "s"} joining it — not the card view's`, () => {
      const base = galleryData();
      const extraRows = EXTRA_FIXTURES.slice(0, extraCount).map((input) => buildTableRow(input));
      const withExtra = { ...base, rows: [...base.rows, ...extraRows] };
      const html = renderAll(withExtra);
      const frames = [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)];
      const only = (id: string) => frames.find((m) => m[1] === id)?.[0];

      const selection =
        extraCount === 0
          ? "the named test records of the rebuild spec"
          : `the named test records of the rebuild spec, plus discovery's next ${extraCount} live match${extraCount === 1 ? "" : "es"}`;
      const SELECTION_HTML = escapeHtml(selection);
      const NARROW_SELECTION = escapeHtml("the named test records of the rebuild spec");

      const table = only("results-table")!;
      // The panel header's own caption: "42 suppliers · <selection>", exactly.
      assert.ok(table.includes(`42 suppliers · ${SELECTION_HTML}</span>`), "the table's panel header must state the wider population, exactly, with nothing appended");
      // The panel footer's own caption: "<selection> · 42 in the result set".
      assert.ok(table.includes(`${SELECTION_HTML} · 42 in the result set</span>`), "the table's panel footer must state the wider population, exactly");
      if (extraCount > 0) {
        // Neither may still carry the unqualified narrow string as its whole selection.
        assert.ok(!table.includes(`42 suppliers · ${NARROW_SELECTION}</span>`), "the table's panel header must not state the narrow, unqualified selection");
        assert.ok(!table.includes(`${NARROW_SELECTION} · 42 in the result set</span>`), "the table's panel footer must not state the narrow, unqualified selection");
      }
      // The figure's own caption (outside the render() helper's stripped
      // figcaption) — now the same `tableSelection(d)` string, not a second
      // copy of its arithmetic.
      const rowCount = 4 + extraCount;
      assert.ok(
        table.includes(`Same header and footer, 36px rows, ${rowCount} rows: ${SELECTION_HTML}.`),
        `the figure's own caption must state the wider population too (extraCount=${extraCount})`,
      );

      const cards = only("results-list")!;
      assert.ok(cards.includes(`42 suppliers · ${NARROW_SELECTION}</span>`), "the card view's own panel header is unchanged");
      assert.ok(!cards.includes("discovery"), "the card view never draws extra rows and must not describe any");
    });
  }

  // Correctness, cycle 19: the caption used to hard-code "the four named
  // records" regardless of how many of the four actually loaded. A partial
  // load (one or more of the four failed) must still state a population,
  // never a literal count that disagrees with the rows on screen.
  it("the results-table figure caption never claims a fixed count of named records over a partial load", () => {
    const base = galleryData();
    const partial = {
      ...base,
      records: { ...base.records, zaheen: null },
      cards: base.cards.slice(0, 3),
      rows: base.rows.slice(0, 3),
    };
    const html = renderAll(partial);
    const frames = [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)];
    const table = frames.find((m) => m[1] === "results-table")![0];
    assert.doesNotMatch(table, /\bfour\b/i, "the caption must not name a fixed count once a named record failed to load");
    assert.ok(table.includes("Same header and footer, 36px rows, 3 rows:"), "the row count in the caption must match the rows actually rendered");
  });

  // Correctness, cycle 19: the product-sheet caption used to claim the EPB
  // exporter page unconditionally, contradicting the sheet's own eyebrow
  // ("not on this record's EPB page") the moment `exported` is false — a
  // failed `supplier_epb_hscodes` read, or a heading the record genuinely
  // does not export.
  it("the product-sheet caption matches the sheet's own claim about whether the line is on the record's EPB page", () => {
    const only = (html: string, id: string) => [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)].find((m) => m[1] === id)![0];

    const exportedSheet = buildProductSheet(aboniInput(), "6105");
    assert.equal(exportedSheet.exported, true, "6105 is one of Aboni's fixture HS lines");
    const exportedFrame = only(renderAll(galleryData({ productSheet: exportedSheet })), "product-sheet");
    assert.ok(
      exportedFrame.includes(escapeHtml(`HS ${exportedSheet.hs} on ${exportedSheet.supplierName}'s EPB exporter page`)),
      "an exported line must claim the EPB page, unconditionally",
    );

    const notExportedSheet = buildProductSheet(aboniInput(), "6112");
    assert.equal(notExportedSheet.exported, false, "6112 is not one of Aboni's fixture HS lines");
    const notExportedFrame = only(renderAll(galleryData({ productSheet: notExportedSheet })), "product-sheet");
    assert.ok(
      !notExportedFrame.includes(escapeHtml(`HS ${notExportedSheet.hs} on ${notExportedSheet.supplierName}'s EPB exporter page`)),
      "the caption must not claim the EPB page for a line the sheet itself says is not on it",
    );
    assert.ok(
      notExportedFrame.includes(escapeHtml(`HS ${notExportedSheet.hs}, not on ${notExportedSheet.supplierName}'s EPB exporter page`)),
      "the caption must state the sheet's own negative claim instead",
    );
  });

  // Cycle 5, finding 4: a failed `rfq_list` read rendered as the fact "you have
  // no RFQs", in the empty state written to sell the feature.
  it("an unread RFQ list says so; an empty one sells the feature", () => {
    const empty = render(galleryData());
    assert.match(empty, /Your first RFQ lands here/);
    const failed = render(galleryData({ rfqError: true, rfqs: { ...EMPTY_RFQS, error: true, footer: "The RFQ list could not be read" } }));
    assert.match(failed, /could not be read/);
    assert.doesNotMatch(failed, /Your first RFQ lands here/);
  });

  it("a record that could not be read is left out, never invented", () => {
    const html = render(
      galleryData({
        records: { aboni: null, sm: null, zaheen: null, ar: null },
        cards: [],
        rows: [],
        sheet: null,
        productSheet: null,
      }),
    );
    assert.doesNotMatch(html, /Aboni/);
    assert.doesNotMatch(html, /data-screen="supplier-sheet"/);
    assert.doesNotMatch(html, /data-screen="product-sheet"/);
    assert.doesNotMatch(html, /data-screen="rfq-composer"/);
    assert.match(html, /data-screen="results-list"/, "the shell still renders");
  });

  it("all six screens render when every record could be read", () => {
    const html = renderAll(galleryData());
    for (const id of ["results-list", "results-table", "supplier-sheet", "product-sheet", "rfq-composer", "rfq-list"]) {
      assert.match(html, new RegExp(`data-screen="${id}"`), `${id} is one of the six screens`);
    }
  });

  // The composer's draft cites the record's real facts; §2 forbids inventing
  // one, and finding 21 left a stray middle dot in the supplier-facing preview.
  it("the composer's preview cites the record's own certificate, with no stray dot", () => {
    const html = render(galleryData());
    assert.match(html, /your GOTS certificate GOTS-31587 is valid to 12 May 2027/);
    assert.doesNotMatch(html, /is · /);
    assert.doesNotMatch(html, /replies land in Messages/);
  });
});

// ---------------------------------------------------------------------------
// Cycle 8. The RFQ screen was the one screen of the six rendered from an
// invented payload: the harness answered `rfq_list` with `[]` and the screen
// then stated "0 sent · 0 quotes", six sidebar "RFQs 0" pills and "No RFQs for
// this account yet" about an account that does not exist, while production
// holds seven RFQs. §7 item 1 asks for six screens "rendered from real data".
// ---------------------------------------------------------------------------

describe("the state a screen is in is drawn, not only announced", () => {
  // Deleting the selected/pressed fill entirely used to leave the suite at
  // 500/500: the only assertion that touched it counted `aria-current`
  // attributes. The fills themselves are 1.07–1.17:1 against the neighbour
  // they must be distinguished from, where WCAG 1.4.11 asks 3:1, and no
  // retint can fix that — `brand.ink` on the tint and the tint on the canvas
  // pull in opposite directions. So the state must carry a second indicator
  // that is not a fill, and this asserts the indicator is rendered.
  /**
   * The indicator must name the `brand` token, in whatever form it is drawn —
   * an inset shadow, a border, a ring. The first version of this accepted any
   * `ring-*` utility, which let a 1.33:1 hairline pass, and a sibling test
   * pinned the two `shadow-[inset_…]` strings so that redrawing the same rail
   * as a border failed the suite.
   */
  /**
   * The token an element's state indicator is drawn in, or null when it has
   * none. The first version of this was a prefix match on `--ds-brand` and
   * `border-brand`, so `--ds-brand-tint` and `border-brand-tint` both passed —
   * and the companion test then measured `brand`, never the token the rail
   * actually named. Retinting every state to `brand.tint` (1.07:1 on canvas)
   * left the suite at 503/503.
   */
  const indicatorTokens = (tag: string): string[] => {
    const found: string[] = [];
    for (const m of tag.matchAll(/shadow-\[[^"\]]*--ds-([a-z0-9-]+)\)/g)) found.push(m[1]!);
    const classes = /class="([^"]*)"/.exec(tag)?.[1] ?? tag;
    for (const c of classes.split(/\s+/)) {
      const m = /^(?:border|ring|outline)(?:-[trblxyse])?-(.+)$/.exec(c);
      // `border-b-2` is a width and `border-l-[3px]` an arbitrary one; both
      // have to fall through to the colour utility beside them.
      if (!m || /^[\d[]/.test(m[1]!) || m[1] === "transparent" || m[1] === "inset") continue;
      const token = m[1]!.replace(/-/g, ".");
      try {
        if (resolve(light, token)) found.push(m[1]!);
      } catch {
        continue;
      }
    }
    return found;
  };
  const GROUNDS = ["canvas", "surface", "surface.sunken", "brand.tint"];
  /** A token that clears 3:1 against every ground the kit draws a state on. */
  const strongEnough = (token: string) =>
    GROUNDS.every((bg) => contrastRatio(resolve(light, token.replace(/-/g, ".")), resolve(light, bg)) >= 3);
  /** Every attribute that says "this one is the one you are on". */
  const STATE = /<(?:a|button)\b[^>]*(?:aria-current="(?!false")[^"]*"|aria-pressed="true"|aria-selected="true")[^>]*>/g;

  it("every current, pressed or selected control carries an indicator that is not a fill", () => {
    const html = renderAll(galleryData());
    const states = [...html.matchAll(STATE)];
    // Not a list of attribute values: `aria-current="step"` on the composer's
    // rail was outside the first version's population, and its state was a
    // white card at 1.08:1 against the canvas beside it.
    assert.ok(states.length >= 8, "the page still draws the states this guard is about");
    assert.ok(
      states.some((m) => /aria-current="step"/.test(m[0]!)),
      "the composer's step rail is one of them",
    );
    for (const m of states) {
      const tokens = indicatorTokens(m[0]!);
      // One indicator strong enough is enough — an element may carry a
      // hairline and a rail. What is forbidden is a state drawn only in
      // colours nobody can see against the neighbour it is compared with.
      const strong = tokens.filter(strongEnough);
      assert.ok(
        strong.length > 0,
        `a state with no indicator that clears 3:1 (found: ${tokens.length ? tokens.join(", ") : "a fill and nothing else"}): ${m[0]}`,
      );
    }
  });

  it("the extractor reads the token out of every shape the kit draws an indicator in", () => {
    // Without this the guard above can be satisfied by an extractor that
    // returns null for a real indicator, or the wrong token for a tinted one.
    assert.deepEqual(indicatorTokens('class="shadow-[inset_3px_0_0_rgb(var(--ds-brand))]"'), ["brand"]);
    assert.deepEqual(indicatorTokens('class="shadow-[inset_0_-2px_0_rgb(var(--ds-brand-tint))]"'), ["brand-tint"]);
    assert.deepEqual(indicatorTokens('class="border-l-[3px] border-brand pl-[7px]"'), ["brand"]);
    assert.deepEqual(indicatorTokens('class="border-l-4 border-brand-tint"'), ["brand-tint"]);
    assert.deepEqual(indicatorTokens('class="ring-1 ring-inset ring-line"'), ["line"]);
    assert.deepEqual(indicatorTokens('class="bg-brand-tint text-brand-ink"'), [], "a fill is not an indicator");
    assert.deepEqual(indicatorTokens('class="border-b-2 border-transparent"'), []);
    // The strength test is what the tinted forms fail — this is the hole the
    // previous version left: the regex accepted `--ds-brand-tint` as a
    // prefix match on `--ds-brand`, and the ratio was measured on `brand`.
    assert.ok(strongEnough("brand"));
    for (const weak of ["brand-tint", "line", "line-subtle"]) {
      assert.ok(!strongEnough(weak), `${weak} is why this guard exists`);
    }
  });
});

describe("a modal's background is inert, not merely covered", () => {
  // Detected by `role="dialog"`, not `aria-modal="true"`: the gallery's three
  // dialogs pass `assertModal={false}` (cycle 18's accessibility critic — see
  // the `Sheet`/`Dialog` doc comments), so `aria-modal` is deliberately absent
  // here. The background being kept out of the tab order does not depend on
  // whether the dialog covering it also claims `aria-modal` — a dialog that
  // makes no modality claim still must not leave its background operable
  // behind a scrim the pointer cannot pass either.
  it("nothing outside a dialog is focusable", () => {
    const html = renderAll(galleryData());
    const frames = html.split("<figure").slice(1);
    let modals = 0;
    for (const f of frames) {
      if (!/role="dialog"/.test(f)) continue;
      modals += 1;
      // The shell the sheet covers sits inside `<div inert>`; the scrim takes
      // the pointer but took nothing from the keyboard, and 57 elements
      // outside the dialog were still tab stops on each sheet screen.
      const before = f.slice(0, f.search(/<(?:aside|div)\b[^>]*role="dialog"/));
      // The attribute, not one serialization of it: `<div class="contents"
      // inert>` is the same repair and the first version of this rejected it.
      const wrapper = before.search(/<div\b[^>]*\binert\b/);
      assert.ok(wrapper > -1, "the covered shell is not inert");
      const covered = before.slice(wrapper);
      // And the shell really is inside it — an `inert` wrapper that does not
      // contain the shell buys nothing.
      assert.match(covered, /<main id="[^"]+-behind"/, "the covered shell sits outside the inert wrapper");
      assert.match(covered, /<nav aria-label="Primary"/, "the sidebar sits outside the inert wrapper");
    }
    assert.equal(modals, 3, "the three sheet screens still draw a dialog");
  });

  // Cycle 18's accessibility critic: three `aria-modal="true"` dialogs were
  // simultaneously live and non-inert relative to each other on this one
  // page — each asserting the other two (and the three plain screens) did
  // not exist, which no assistive-technology behaviour is defined for and
  // which was false in both directions at once for at least two of the
  // three. `assertModal={false}` on all three gallery instances removes the
  // false claim; `role="dialog"` and each one's own `aria-label` are kept.
  it("no dialog on the combined gallery page claims aria-modal, since none of the three is the page's one true modal", () => {
    const html = renderAll(galleryData());
    assert.doesNotMatch(html, /aria-modal="true"/, "an aria-modal claim on this page cannot be true of more than one of three simultaneously live dialogs");
    // The claim is dropped, not the dialog: still three labelled dialogs.
    const dialogs = [...html.matchAll(/role="dialog" aria-label="([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(dialogs.sort(), ["New RFQ", "Product line", "Supplier record"], "all three dialogs still render, still labelled");
  });
});

describe("what the whole page may and may not say about itself", () => {
  // Cycle 10. Each of these was a single string somewhere in the kit, and in
  // each case the guard that should have caught it was asserting the defect.
  // They are asserted over every screen at once, because the defect moves.

  it("no negative claims a register nobody has read", () => {
    const html = renderAll(galleryData());
    // Production reads four certificate registers and fourteen registers in
    // all; `sources` holds 25 rows and `SCHEME_LABEL` names fourteen cert
    // kinds. An absolute over "any register" or "any list" asserts absence
    // across the ones that have never been read.
    for (const rx of [/on any register/i, /on any list/i, /on any of the registers/i, /anywhere on file/i, /no certificate anywhere/i]) {
      assert.doesNotMatch(html, rx, `an absolute negative over registers that have not been read: ${rx}`);
    }
  });

  it("every denominator on the page is a number of registers that hold records", () => {
    const html = renderAll(galleryData());
    // 25 is every row in `sources`, 11 of which have never produced a record
    // for anybody; 6 is every configured brand list, 2 of which hold none.
    assert.doesNotMatch(html, /\bof 25 sources\b/);
    assert.doesNotMatch(html, /\bon 6 brand lists\b/);
    assert.match(html, /of 14 sources read/);
    assert.match(html, /not on 4 brand lists read/);
    assert.match(html, /on 4 registers/);
  });

  it("no control is in the tab order that cannot be operated", () => {
    const html = renderAll(galleryData());
    // A `role="checkbox"` with `tabindex="0"` and no handler announces an
    // operable checkbox and then swallows Space, which scrolls the page. 34
    // of them shipped across the six screens, five of which were the RFQ
    // composer's required questions.
    const inert: RegExpMatchArray[] = [];
    for (const m of html.matchAll(/<[a-z]+\b[^>]*role="(checkbox|radio|switch|menuitem|tab|option)"[^>]*>/g)) {
      if (!/aria-disabled="true"/.test(m[0]!)) continue;
      inert.push(m);
      assert.doesNotMatch(m[0]!, /tabindex/, `an inert control left in the tab order: ${m[0]}`);
    }
    // Counted over the loop's own population, not an unrelated count. The
    // guard used to backstop with `cards.length >= 4` — a fact about the
    // record list, not about inert controls — so it stayed green even when
    // the regex above matched nothing at all. 34 shipped with this defect,
    // five of which were the composer's required questions; the rest, 29,
    // are this guard's actual population today.
    assert.ok(inert.length >= 20, "the page still draws the inert controls this guard is about");
  });

  it("a name that reads as an action is on something that can be actioned", () => {
    const html = renderAll(galleryData());
    // First shape of this defect: ten "Remove <filter>" names on a bare
    // `<svg>` — neither a control nor a reliably named graphic. Second shape,
    // introduced by the first repair: the same names on `role="img"`, so a
    // screen reader announced an action with nothing behind it.
    //
    // The backstop counts the affordances, not the markup that hosts them.
    // It used to require ten named `<svg>`s, which meant the correct repair —
    // moving the name onto a real control — took the count to zero and failed
    // the suite. A `length >= N` counted over the exact shape a repair would
    // change is a pinned defect.
    const ACTION = /^(Remove|Close|Open|Select|Save|Send|Add|Export|Back|Share)\b/;
    let named = 0;
    for (const m of html.matchAll(/<([a-z]+)\b([^>]*\baria-label="([^"]*)"[^>]*)>/g)) {
      const [, tag, attrs, label] = m as unknown as [string, string, string, string];
      if (!ACTION.test(label)) continue;
      named += 1;
      const role = /\brole="([^"]*)"/.exec(attrs)?.[1];
      assert.ok(
        tag === "button" || tag === "a" || (role !== undefined && role !== "img"),
        `an action name on something that cannot be actioned: <${tag} ${role ? `role="${role}" ` : ""}aria-label="${label}">`,
      );
    }
    assert.ok(named >= 10, "the page still draws the named affordances this guard is about");
    // And nothing is left named without a role at all.
    for (const m of html.matchAll(/<svg\b[^>]*aria-label="[^"]*"[^>]*>/g)) {
      assert.match(m[0]!, /role="img"/, `a named <svg> with no role: ${m[0]}`);
    }
  });

  it("the page actually draws icons, not just markup that names them", () => {
    // Every check above scans for `<svg ... aria-label>` and similar shapes,
    // and every one of them passes vacuously if the icon stub renders nothing
    // at all — which is the exact regression a mutation sweep found: no test
    // in this suite required a single real `<svg>` to appear anywhere on the
    // page. `components/dashboard/render.test.ts` now covers `Icon` directly;
    // this is the same guard at the boundary a buyer's browser actually hits.
    const html = renderAll(galleryData());
    const svgs = html.match(/<svg\b/g) ?? [];
    assert.ok(svgs.length > 100, `expected well over a hundred real icons across six screens, found ${svgs.length}`);
  });

  it("nothing announced as unavailable is left in the tab order", () => {
    const html = renderAll(galleryData());
    // `aria-disabled="true"` on a focusable link is a false state: the link
    // still takes focus and still jumps the document to the top.
    for (const m of html.matchAll(/<a\b[^>]*aria-disabled="true"[^>]*>/g)) {
      assert.match(m[0]!, /tabindex="-1"/, `a link announced unavailable but still focusable: ${m[0]}`);
    }
    // Same: the canary is the data that produces placeholders, not the <a>
    // that happens to host one today. Turning a placeholder link into a span
    // is a repair, and must not fail this test.
    const d = galleryData();
    assert.ok((d.sheet?.tabs ?? []).some((t) => t.href === null), "the sheet still has sections that arrive later");
    assert.ok(d.cards.some((c) => (c.moreChips ?? 0) > 0), "a card still has more chips than it shows");
  });

  it("every screen can be entered past the sidebar", () => {
    const html = renderAll(galleryData());
    const frames = html.split("<figure").slice(1);
    assert.equal(frames.length, 6, "six screens");
    // The historical bug (six screens all calling their landmark `ds-main`)
    // would pass a per-frame uniqueness check, because each frame only ever
    // renders one `main` of its own — the collision was across frames, on
    // the one page the gallery puts all six screens on at once. Checked here
    // globally, once, before the per-frame loop below checks the narrower
    // within-a-frame case a mutation sweep found that loop alone cannot see.
    const allMains = [...html.matchAll(/<main id="([^"]+)"/g)].map((m) => m[1]!);
    assert.equal(allMains.length, new Set(allMains).size, `two screens share a landmark id on the gallery page: ${allMains.join(", ")}`);
    // Cycle 17, accessibility critic's finding. `id` uniqueness above does not
    // cover `aria-label` uniqueness: three screens (results-list,
    // results-table, rfq-list) each render their own, genuinely live
    // `<nav aria-label="Primary">`, and a screen reader's landmark list
    // showed three indistinguishable "Primary" navs. Collected from
    // `reachable` content only, per frame, below: an inert background's own
    // nav is not live and must not count toward this collision.
    //
    // The topbar and RFQ-list boxes this comment used to also collect as
    // "search regions" carried `role="search"` with nothing operable inside
    // them — an ARIA violation in its own right (a search landmark with no
    // control), not just an unnamed-landmark risk. Cycle 19's accessibility
    // critic's BLOCKING F2: fixed by dropping the role rather than naming
    // it, since a landmark around static text is still wrong once named.
    // The guard for that class of regression lives in the loop below
    // (`role="search"` must always wrap something operable).
    const navNames: string[] = [];
    // Cycle 18's own accessibility critic: the `screenLabel` fix above only
    // reached `nav` and `search` and stopped there. Every live `<main>` was
    // still unnamed (three indistinguishable "main" landmarks in a screen
    // reader's landmark list) and every skip link still read the identical
    // "Skip to content", so the links rotor offered three same-named entries
    // going to three different places with no way to tell which. Both are
    // collected the same way as `navNames`/`searchNames` above: from
    // `reachable` content only, so an inert background's own main/skip-link
    // is not live and must not count.
    const mainNames: string[] = [];
    const skipLinkNames: string[] = [];
    for (const f of frames) {
      // Every shell in the frame — the screen's own, and the one a sheet
      // covers — carries exactly one `main`, with its own id, reached by a
      // skip link that comes before that shell's navigation. Six screens all
      // called their landmark `ds-main`, so `getElementById` resolved every
      // skip link to the first screen.
      // `inert` strips a subtree from the accessibility tree, so a landmark
      // and a skip link inside one are markup nobody can reach. On the three
      // sheet screens the shell is inert by design and the dialog is the
      // content, so what those screens owe is a labelled dialog instead.
      const reachable = f.replace(/<div\b[^>]*\binert\b[\s\S]*?<\/div>\s*(?=<div aria-hidden)/, "");
      navNames.push(...[...reachable.matchAll(/<nav aria-label="([^"]+)"/g)].map((m) => m[1]!));
      // Accessibility, cycle 19, BLOCKING F2: a `role="search"` landmark with
      // no operable descendant fails ARIA's own definition of the role. The
      // topbar and RFQ-list look-alike search boxes no longer carry the role
      // at all (they have no input to search with yet), so this asserts the
      // invariant going forward rather than naming boxes that should not be
      // landmarks in the first place.
      for (const m of reachable.matchAll(/<[a-z]+\b[^>]*\brole="search"[^>]*>[\s\S]*?<\/(?:div|section|form)>/g)) {
        assert.match(m[0]!, /<(?:input|button|select|textarea|a\s[^>]*href=)/, `role="search" with no operable control: ${m[0]!.slice(0, 120)}`);
      }
      mainNames.push(...[...reachable.matchAll(/<main id="[^"]+" aria-label="([^"]+)"/g)].map((m) => m[1]!));
      skipLinkNames.push(...[...reachable.matchAll(/<a href="#[^"]+" class="sr-only[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]!));
      // Heading order matters only within one reachable document at a time:
      // a modal frame's inert background carries its own h1, and checking the
      // whole frame would either conflate the two heading trees or (as the
      // branch below used to) skip the check entirely for every sheet screen.
      // A mutation sweep found exactly that gap — `SheetSection`'s h2 could be
      // bumped to h3 with every test staying green, because the one place
      // that checked heading order never ran on a modal's own content.
      const checkHeadingOrder = (html: string) => {
        assert.match(html, /<h1\b/, "a screen with no heading cannot be navigated by heading");
        const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
        for (let i = 1; i < levels.length; i += 1) {
          assert.ok(levels[i]! <= levels[i - 1]! + 1, `heading order jumps h${levels[i - 1]} → h${levels[i]}`);
        }
      };
      // Detected by `role="dialog"`, not `aria-modal="true"`: the gallery's
      // three dialogs pass `assertModal={false}` (cycle 18's accessibility
      // critic — none of three simultaneously-live dialogs can truthfully
      // claim the other two do not exist), so `aria-modal` is deliberately
      // absent on this page. Keying this branch off `aria-modal` instead
      // would silently stop running it at all: these three frames would then
      // fall into the plain-screen branch below and pass by matching the
      // inert background's own (unreachable) `main` and conflating its
      // heading tree with the dialog's.
      if (/role="dialog"/.test(f)) {
        assert.match(f, /role="dialog"[^>]*aria-label="[^"]+"|aria-label="[^"]+"[^>]*role="dialog"/, "a dialog screen owes a labelled dialog");
        assert.doesNotMatch(reachable, /<main\b/, "a landmark left outside the dialog on a dialog screen");
        checkHeadingOrder(reachable);
        continue;
      }
      const mains = [...f.matchAll(/<main id="([^"]+)"/g)].map((m) => m[1]!);
      assert.ok(mains.length >= 1, "a screen with no content landmark cannot be entered");
      assert.equal(new Set(mains).size, mains.length, `two landmarks share an id: ${mains.join(", ")}`);
      for (const id of mains) {
        const link = f.indexOf(`href="#${id}"`);
        assert.ok(link > -1, `no skip link targets #${id}`);
        assert.ok(link < f.indexOf(`<main id="${id}"`), "the skip link comes after the landmark it targets");
        const nav = f.indexOf("<nav", link);
        assert.ok(nav === -1 || link < nav, "the skip link comes before the navigation");
      }
      checkHeadingOrder(f);
    }
    // Every live nav must have a name, and no two live navs may share one —
    // an unnamed or duplicated landmark is indistinguishable from its
    // siblings in a screen reader's own landmark list.
    assert.ok(navNames.length >= 3, "the page still draws the live navigation landmarks this guard is about");
    assert.equal(navNames.length, new Set(navNames).size, `two live navigation landmarks share a name: ${navNames.join(", ")}`);
    // Same rule for the two landmark/link kinds `screenLabel` covers the
    // furthest from the sidebar: every live `main` must be named, and no two
    // may share a name; every live skip link's own text must be unique too,
    // since "Skip to content" three times over in the links rotor gives no
    // way to tell which one is about to be activated.
    assert.ok(mainNames.length >= 3, "the page still draws the live main landmarks this guard is about");
    assert.equal(mainNames.length, new Set(mainNames).size, `two live main landmarks share a name: ${mainNames.join(", ")}`);
    assert.ok(skipLinkNames.length >= 3, "the page still draws the live skip links this guard is about");
    assert.equal(skipLinkNames.length, new Set(skipLinkNames).size, `two live skip links share their text: ${skipLinkNames.join(", ")}`);
  });
});

describe("the RFQ screen renders the rows rfq_list returns", () => {
  const withRfqs = (): GalleryData => {
    const rows = RFQ_ROWS.map((r) => {
      const t = RFQ_TARGETS[r.id]!;
      return buildRfqRow(r, { name: t.name, tier: topTier(t.codes) }, TODAY);
    });
    return galleryData({
      rfqs: {
        sent: rows.length,
        quotes: 0,
        chips: [
          { label: "All", count: rows.length, on: true },
          { label: "Awaiting reply", count: rows.length },
          { label: "Quoted", count: 0 },
          { label: "Closed", count: 0 },
        ],
        rows,
        footer: `1–${rows.length} of ${rows.length}`,
        toast: null,
      },
    });
  };

  it("the table, not the empty state, and every row is one production holds", () => {
    const html = render(withRfqs());
    // Five, not seven: production's seven RFQs belong to three buyers and
    // `rfq_list` is scoped to `auth.uid()`, so no caller can be shown more.
    assert.equal(RFQ_ROWS.length, 5);
    for (const r of RFQ_ROWS) assert.ok(html.includes(escapeHtml(r.product_title)), `${r.id} is not on the screen`);
    assert.match(html, /5 sent · 0 quotes/);
    assert.doesNotMatch(html, /0 sent · 0 quotes/);
    assert.doesNotMatch(html, /Your first RFQ lands here/, "the empty state stood over five real rows");
    // The supplier each row targets is named, from the `suppliers` rows the
    // `target_supplier_ids` point at, at the rank its own receipts earn.
    assert.match(html, /Thermax Woven Dyeing Ltd\./);
    assert.match(html, /bg-tier-3[^"]*"[^>]*>TW</, "one OEKO-TEX certificate ranks 3, not 2");
    assert.doesNotMatch(html, /\bNaN\b/);
  });

  it("the gallery's own caption says whose RFQs these are and what an empty list would mean", () => {
    const caption = renderAll(withRfqs());
    assert.match(caption, /rfq_list is scoped to auth\.uid\(\)/);
    assert.match(caption, /5 real rows/);
    assert.match(caption, /three buyers/, "the caption must say why five is the most any caller can see");
  });

  // Correctness + truthfulness, cycle 19: the caption used to say "these
  // five" (false whenever the render is not five rows) and "never '0 sent'"
  // (false today, for the only account that can open this page — a
  // successful read of zero rows still shows "0 sent · 0 quotes", the exact
  // render the two tests above and below this one already assert).
  it("the gallery's own caption never points at a fixed row count it may not have rendered, and does not deny the zero-row render the screen actually makes", () => {
    const only = (html: string, id: string) => [...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)].find((m) => m[1] === id)![0];

    const zeroFrame = only(renderAll(galleryData()), "rfq-list");
    assert.match(zeroFrame, /0 real row/, "the caption's own count must match the rows actually rendered");
    assert.doesNotMatch(zeroFrame, /these five/i, "the caption must not point at a fixed count that may not be the one rendered");
    assert.doesNotMatch(zeroFrame, /never/i, "a viewer who owns none still sees \"0 sent\" — the caption must not deny that render");
    assert.match(zeroFrame, /still sees/i, "the caption must say the zero-row render still carries the count");
    assert.match(zeroFrame, /0 sent . 0 quotes/, "the caption must name the exact render a zero-row read produces");

    const fiveFrame = only(renderAll(withRfqs()), "rfq-list");
    assert.match(fiveFrame, /5 real row/);
    assert.doesNotMatch(fiveFrame, /these five/i, "the general \"longest list\" fact must not be phrased as pointing at this render");
  });

  it("with no rows the page still sells the feature, and claims no count it did not read", () => {
    const html = render(galleryData());
    assert.match(html, /Your first RFQ lands here/);
    assert.match(html, /0 sent · 0 quotes/, "an account that really has none reads zero; an unread one reads 'count not read'");
  });
});

describe("the sidebar and the shell state only what was read", () => {
  it("the RFQ pill carries the real count on every screen, and none when the read failed", () => {
    const withSeven = render(galleryData({ rfqs: { ...EMPTY_RFQS, sent: 7, chips: [{ label: "All", count: 7, on: true }], rows: [] } }));
    // Six frames, each with the shell, each reading the account's own count.
    assert.equal((withSeven.match(/RFQs<[^>]*>7</g) ?? []).length, 6);
    assert.doesNotMatch(withSeven, /RFQs<[^>]*>0</);
    const failed = render(galleryData({ rfqError: true, rfqs: { ...EMPTY_RFQS, error: true, sent: null, quotes: null, chips: [{ label: "All", count: null, on: true }], footer: "The RFQ list could not be read" } }));
    assert.doesNotMatch(failed, />RFQs<[^>]*>0</, "a failed read is not zero RFQs");
    assert.match(failed, /count not read/);
  });

  it("every link in the shell goes somewhere that exists", () => {
    const html = renderAll(galleryData());
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
    for (const m of html.matchAll(/href="#([^"]*)"/g)) {
      const target = m[1]!;
      // A bare `href="#"` is not "inert and always resolves" — it is a
      // focusable link that scrolls the document to the top. This loop used
      // to skip it, which is how eleven of the page's nineteen placeholders
      // shipped with nothing telling the user they go nowhere.
      if (target === "") continue;
      assert.ok(ids.has(target), `href="#${target}" points at an anchor this page does not have`);
    }
    for (const m of html.matchAll(/<a\b[^>]*href="#"[^>]*>/g)) {
      assert.match(m[0]!, /aria-disabled="true"/, `a placeholder link that does not say so: ${m[0]}`);
      assert.match(m[0]!, /title="[^"]+"/, `a placeholder link with no explanation: ${m[0]}`);
    }
  });

  it("the primary nav says which item is current, and names itself", () => {
    const html = render(galleryData());
    assert.match(html, /<nav aria-label="Primary"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 6, "one current item per screen");
  });
});

// ---------------------------------------------------------------------------
// Cycle 9: the composition layer. This file pins what the page hands the
// components, and an independent sweep found five of six mutations here
// surviving — a filter chip for a filter the RPC never received, a sort label
// naming a sort that does not exist, and the saved-search count read off the
// page instead of the query.
// ---------------------------------------------------------------------------

describe("the screens claim only what the query asked for and the RPC answered", () => {
  it("one chip per filter the query carries, and no others", () => {
    const html = render(galleryData());
    // `discoverArgs` sends the text and `cert_kinds: ['gots']` and nothing
    // else; a chip for a filter the RPC never received says the result set
    // was narrowed when it was not.
    assert.match(html, />Text · knitted shirts</);
    assert.match(html, />Certificate · GOTS</);
    // Only the search composer's chips; the RFQ list's "All" chip shares the
    // class. Anchored on the results-list screen's own container (not
    // `role="search"`: the topbar's look-alike search box carries no such
    // role — accessibility, cycle 19, BLOCKING F2 — since it has nothing
    // operable inside it).
    const composer = html.slice(html.indexOf('data-screen="results-list"'), html.indexOf("</section>"));
    const chips = [...composer.matchAll(/bg-brand-tint-strong[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual([...new Set(chips)].sort(), ["Certificate · GOTS", "Text · knitted shirts"]);
    assert.equal(GALLERY_QUERY.certKinds.length, 1);
    assert.equal(GALLERY_QUERY.certKinds[0], "gots");
  });

  it("the sort label names the sort the RPC was given", () => {
    const html = render(galleryData());
    assert.match(html, />\s*Most sources\s*</);
    assert.equal(SORT_MOST_SOURCES, "receipts", "the label and the argument are two names for one thing");
    assert.doesNotMatch(html, /Best match|Relevance|Newest first/, "a sort the RPC does not offer");
  });

  it("the saved-search count is the query's, not this page's", () => {
    const html = render(galleryData());
    // 42 is `total_count`; 4 is how many of the named records are on screen.
    assert.match(html, /Knitted shirts · GOTS<[^>]*>42</);
    const unread = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.doesNotMatch(unread, /Knitted shirts · GOTS<[^>]*>\d/, "an unread total is not a count");
  });

  it("the shell states no figure the loader did not read", () => {
    const html = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.doesNotMatch(html, /Suppliers<[^>]*>0</);
    assert.doesNotMatch(html, /published suppliers/, "the topbar count is unread, so it is absent");
    assert.doesNotMatch(html, /count could not be read[^<]*0/);
  });

  it("the screens are rendered at the width the screenshots are captioned with", () => {
    const html = renderAll(galleryData());
    const frames = [...html.matchAll(/style="width:(\d+)px[^"]*"\s+data-screen="([^"]+)"/g)];
    assert.equal(frames.length, 6, "one framed screen per §3 screen");
    // 1440 as a literal: comparing against `SCREEN_WIDTH` imported from the
    // file under test cannot fail, and the six approved renders are 1440-wide.
    assert.equal(SCREEN_WIDTH, 1440);
    for (const f of frames) assert.equal(f[1], "1440", `the ${f[2]} frame is ${f[1]}px, not the width the screenshots are captioned with`);
    assert.deepEqual(frames.map((f) => f[2]), ["results-list", "results-table", "supplier-sheet", "product-sheet", "rfq-composer", "rfq-list"]);
  });
});

describe("the composer's rail and its footer count the same missing fields", () => {
  // The rail said "Reply-by date and destination missing" and "2/6" while the
  // footer on the same screen said "4 fields missing — target price,
  // reply-by date, incoterm, destination", and the preview flagged three. All
  // three were hand-written; at most one could be right.
  it("every field the rail calls missing is in the model's own list, and the fraction agrees", () => {
    const d = galleryData();
    const c = composerModel(d);
    const details = c.steps.find((st) => st.label === "Details")!;
    const [filled, total] = details.count!.split("/").map(Number) as [number, number];
    const named = (details.missing ?? "")
      .replace(/ missing$/, "")
      .split(/,\s*|\s+and\s+/)
      .filter(Boolean)
      .map((w: string) => w.toLowerCase());
    assert.ok(named.length > 0, "the sample draft still has missing detail fields");
    assert.equal(total - filled, named.length, "the fraction must count the fields the rail names");
    for (const n of named) {
      assert.ok(c.missing.includes(n), `the rail names "${n}" as missing, and the footer's list does not`);
    }
    // And the footer states the same total.
    const html = renderAll(d);
    assert.match(html, new RegExp(`${c.missing.length} fields missing`), "the footer counts the model's list");
    for (const m of c.missing) assert.ok(html.includes(m), `the footer does not name "${m}"`);
  });

  // design/dashboard-ux-flow.md §6: "Details 2/6 (RFQ name, reply-by date,
  // incoterm, destination, currency, attachments)" — six fields. The fix
  // above unified the rail/footer/preview onto one list, but only carried
  // four of the spec's six forward: internal self-consistency held while
  // currency and attachments silently dropped out of both the numerator and
  // the denominator. A correctness critic caught the gap because it checks
  // this file against the spec text, not just against itself.
  it("the Details step names all six fields the spec defines for it, not a subset that happens to agree with itself", () => {
    const c = composerModel(galleryData());
    const details = c.steps.find((st) => st.label === "Details")!;
    const total = Number(details.count!.split("/")[1]);
    assert.equal(total, 6, "the Details step must count out of the spec's six fields, not a smaller set");
    const named = (details.detail ?? "").split(",").map((s) => s.trim().toLowerCase());
    for (const field of ["reply-by date", "incoterm", "destination", "currency", "attachments"]) {
      assert.ok(named.includes(field), `the Details step does not track "${field}", which design/dashboard-ux-flow.md §6 requires`);
    }
  });
});
