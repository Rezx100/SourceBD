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
// the same fixtures the screenshots use. Since the enterprise pass (27 Sep
// 2026) the gallery draws seven screens: the ledger grid, the thumbnail cards,
// the record, the line, the RFQ composer and the filter pane — each in a pane
// BESIDE the results, as /app/discover draws them — and the RFQ list.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { RFQ_ERROR_COPY } from "@/components/dashboard/rfq-pages";
import { buildCard, buildProductSheet, buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import { contrastRatio, light, resolve } from "@/lib/design/tokens";
import {
  aboniInput,
  arFashionInput,
  buildingRegistrationsInput,
  inheritedPillsInput,
  longestHsListInput,
  longestProductListInput,
  smKnitwearInput,
  TODAY,
  zaheenSampleInput,
} from "@/lib/dashboard/fixtures";
import { GALLERY_QUERY, SORT_MOST_SOURCES, topbarCaption, type GalleryData, type GalleryRecord } from "@/lib/dashboard/gallery-data";
import type { RfqListModel } from "@/lib/dashboard/models";
import { composerPrefill, composerTargets, DashboardScreens, galleryState, sampleRfqRows, SCREEN_WIDTH, SCREENS } from "./dashboard-screens";

const EMPTY_RFQS: RfqListModel = {
  sent: 0,
  quotes: 0,
  chips: [{ label: "All", count: 0, on: true }],
  rows: [],
  footer: "No RFQs for this account yet",
  toast: null,
};

/** The seven frames, as literals: comparing against `SCREENS` from the file under test could not fail. */
const FRAMES = ["results-table", "results-list", "supplier-sheet", "product-sheet", "rfq-composer", "filter-pane", "rfq-list"];

/**
 * A `role="search"` landmark with no operable descendant fails ARIA's own
 * definition of the role (accessibility, cycle 19, BLOCKING F2). The match is
 * scoped to the element carrying the role via a backreference to its own
 * captured tag name, not a hardcoded tag list — cycle 20's guard-adequacy
 * critic demonstrated that the old `<\/(?:div|section|form)>` alternation let
 * a `<span role="search">` with nothing operable inside it slip through.
 */
function searchLandmarksWithoutAnOperableControl(html: string): string[] {
  const offenders: string[] = [];
  for (const m of html.matchAll(/<([a-z]+)\b[^>]*\brole="search"[^>]*>[\s\S]*?<\/\1>/g)) {
    if (!/<(?:input|button|select|textarea|a\s[^>]*href=)/.test(m[0]!)) offenders.push(m[0]!);
  }
  return offenders;
}

const rec = (input: ReturnType<typeof aboniInput>, slug: string): GalleryRecord => ({ slug, input });

function galleryData(over: Partial<GalleryData> = {}): GalleryData {
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
 * describes the screen in prose, and an assertion that matched it would pass
 * whatever the screen itself rendered.
 */
const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const render = (d: GalleryData) =>
  renderToStaticMarkup(createElement(DashboardScreens, { data: d })).replace(/<figcaption[\s\S]*?<\/figcaption>/g, "");

/** With the captions, for the assertions that are about the captions. */
const renderAll = (d: GalleryData) => renderToStaticMarkup(createElement(DashboardScreens, { data: d }));

/** Each frame's own markup, caption included, by its `data-screen` id. */
function framesOf(html: string): Map<string, string> {
  return new Map([...html.matchAll(/<figure[\s\S]*?data-screen="([^"]+)"[\s\S]*?(?=<figure|$)/g)].map((m) => [m[1]!, m[0]!]));
}
const frame = (d: GalleryData, id: string): string => {
  const f = framesOf(renderAll(d)).get(id);
  assert.ok(f, `the ${id} screen is not in the gallery`);
  return f!;
};
/** A frame without its caption. */
const screen = (d: GalleryData, id: string) => frame(d, id).replace(/<figcaption[\s\S]*?<\/figcaption>/g, "");

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

  it("no screen carries a supplier's contact value or the column that holds one", () => {
    const html = render(galleryData());
    const leaked = zaheenSampleInput().leaked;
    for (const v of [leaked.email_primary, leaked.contact_name, leaked.contact_role, leaked.website, ...leaked.phones]) {
      assert.ok(!html.includes(escapeHtml(v)), `a contact value reached the gallery: ${v}`);
    }
    assert.doesNotMatch(html, /email_primary|contact_name|contact_role/);
  });

  it("the sanctioned sample reaches the cards and the ledger", () => {
    for (const id of ["results-table", "results-list"]) {
      const html = screen(galleryData(), id);
      assert.match(html, /data-sanctioned="true"/, id);
      assert.match(html, /Sanctioned · sample/, id);
    }
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
    // It must carry both a range and the population it is a range over: a
    // maximum over four records once read as the corpus's read date, and a
    // range with no population read as a claim about 10,266 records.
    assert.equal(
      topbarCaption({ published: 10266, recordsReadOn: "30 Jul – 18 Sep 2026", recordsRead: 4 }),
      "10,266 published suppliers · 4 records on this page, read 30 Jul – 18 Sep 2026",
    );
    assert.equal(topbarCaption({ published: null, recordsReadOn: "18 Sep 2026", recordsRead: 1 }), "1 record on this page, read 18 Sep 2026");
    assert.equal(topbarCaption({ published: 1, recordsReadOn: null, recordsRead: null }), "1 published supplier");
    assert.equal(topbarCaption({ published: 2, recordsReadOn: null, recordsRead: null }), "2 published suppliers");
    assert.equal(topbarCaption({ published: null, recordsReadOn: null, recordsRead: null }), "Live records");
    const shell = render(galleryData());
    assert.match(shell, /10,266 published suppliers · 4 records on this page, read 30 Jul – 18 Sep 2026/);
    assert.doesNotMatch(shell, /records read \d+ \w+ \d{4}(?!\s*–)/, "the newest read must not stand for every record");
    for (const m of shell.matchAll(/published suppliers · ([^<]*)/g)) {
      const clause = m[1]!;
      if (!/\d{4}/.test(clause)) continue;
      assert.match(clause, /on this page/, `a date printed beside the corpus count with no population of its own: "${clause}"`);
    }
  });

  it("the 'records on this page' clause does not travel to the RFQ list screen, which draws none", () => {
    // `drawsRecords` exists only to keep this clause off the one screen that
    // draws no supplier record; hardcoding it to `true` must fail here.
    const rfqList = frame(galleryData(), "rfq-list");
    assert.match(rfqList, /published suppliers?/, "the RFQ screen still names the corpus");
    assert.doesNotMatch(rfqList, /records? on this page/, "the RFQ list draws no supplier records, so it must not claim to");
  });

  // Cycle 17: only the ledger draws the discovery rows beyond the four named
  // records, so only the ledger's topbar may count them.
  it("the ledger's wider record count does not travel to the screens that draw only the four named records", () => {
    const frames = framesOf(renderAll(galleryData({ tableRecordsRead: 7, tableRecordsReadOn: "18 May – 18 Sep 2026" })));
    assert.match(frames.get("results-table")!, /7 records on this page, read 18 May – 18 Sep 2026/, "the ledger must carry its own, wider span");
    for (const id of ["results-list", "supplier-sheet", "product-sheet", "rfq-composer", "filter-pane"]) {
      const f = frames.get(id);
      assert.ok(f, `${id} must render`);
      assert.match(f!, /4 records on this page, read 30 Jul – 18 Sep 2026/, `${id} draws only the four named records and must state their span, not the ledger's`);
      assert.doesNotMatch(f!, /7 records on this page/, `${id} must not carry the ledger-only count`);
    }
  });

  // Cycles 18–19: the ledger's panel header, footer and figure caption state
  // the wider population whenever discovery rows join it; the card view and
  // the results beside a pane (the named records only) still state the
  // narrower one. Pinned at zero extras (the harness's shape), one (the
  // singular), two (the plural) and four (production's real shape).
  const EXTRA_FIXTURES = [inheritedPillsInput(), buildingRegistrationsInput(), longestHsListInput(), longestProductListInput()];
  for (const extraCount of [0, 1, 2, 4]) {
    it(`the ledger's panel header, footer and figure caption state the wider population with ${extraCount} discovery row${extraCount === 1 ? "" : "s"} joining it — not the card view's`, () => {
      const base = galleryData();
      const extraRows = EXTRA_FIXTURES.slice(0, extraCount).map((input) => buildTableRow(input));
      const frames = framesOf(renderAll({ ...base, rows: [...base.rows, ...extraRows] }));

      const selection =
        extraCount === 0
          ? "the named test records of the rebuild spec"
          : `the named test records of the rebuild spec, plus discovery's next ${extraCount} live match${extraCount === 1 ? "" : "es"}`;
      const SELECTION_HTML = escapeHtml(selection);
      const NARROW_SELECTION = escapeHtml("the named test records of the rebuild spec");

      const table = frames.get("results-table")!;
      assert.ok(table.includes(`42 suppliers · ${SELECTION_HTML}</span>`), "the ledger's panel header must state the wider population, exactly");
      assert.ok(table.includes(`${SELECTION_HTML} · 42 in the result set</span>`), "the ledger's panel footer must state the wider population, exactly");
      if (extraCount > 0) {
        assert.ok(!table.includes(`42 suppliers · ${NARROW_SELECTION}</span>`), "the ledger's panel header must not state the narrow selection");
        assert.ok(!table.includes(`${NARROW_SELECTION} · 42 in the result set</span>`), "the ledger's panel footer must not state the narrow selection");
      }
      const rowCount = 4 + extraCount;
      assert.ok(
        table.includes(`36px rows under a sticky, sortable header, ${rowCount} rows: ${SELECTION_HTML}.`),
        `the figure's own caption must state the wider population too (extraCount=${extraCount})`,
      );
      assert.equal((table.match(/data-row="result"/g) ?? []).length, rowCount, "the ledger draws every row it counts");

      for (const id of ["results-list", "supplier-sheet", "product-sheet", "rfq-composer", "filter-pane"]) {
        const f = frames.get(id)!;
        assert.ok(f.includes(`42 suppliers · ${NARROW_SELECTION}</span>`), `${id}: the panel header beside it is the named records'`);
        assert.ok(!f.includes("discovery"), `${id} never draws the extra rows and must not describe any`);
        if (id !== "results-list") assert.equal((f.match(/data-row="result"/g) ?? []).length, 4, `${id}: the results beside the pane are the four named records`);
      }
    });
  }

  // Correctness, cycle 19: a partial load (one of the four failed) must still
  // state a population, never a literal count that disagrees with the rows.
  it("the ledger's figure caption never claims a fixed count of named records over a partial load", () => {
    const base = galleryData();
    const partial = { ...base, records: { ...base.records, zaheen: null }, cards: base.cards.slice(0, 3), rows: base.rows.slice(0, 3) };
    const table = framesOf(renderAll(partial)).get("results-table")!;
    assert.doesNotMatch(table, /\bfour\b/i, "the caption must not name a fixed count once a named record failed to load");
    assert.ok(table.includes("36px rows under a sticky, sortable header, 3 rows:"), "the row count in the caption must match the rows actually rendered");
  });

  // Correctness, cycle 19: the product-sheet caption must not claim the EPB
  // page for a line the sheet itself says is not on it.
  it("the product-sheet caption matches the sheet's own claim about whether the line is on the record's EPB page", () => {
    const exportedSheet = buildProductSheet(aboniInput(), "6105");
    assert.equal(exportedSheet.exported, true, "6105 is one of Aboni's fixture HS lines");
    const exportedFrame = frame(galleryData({ productSheet: exportedSheet }), "product-sheet");
    assert.ok(exportedFrame.includes(escapeHtml(`HS ${exportedSheet.hs} on ${exportedSheet.supplierName}'s EPB exporter page`)));

    const notExportedSheet = buildProductSheet(aboniInput(), "6112");
    assert.equal(notExportedSheet.exported, false, "6112 is not one of Aboni's fixture HS lines");
    const notExportedFrame = frame(galleryData({ productSheet: notExportedSheet }), "product-sheet");
    assert.ok(!notExportedFrame.includes(escapeHtml(`HS ${notExportedSheet.hs} on ${notExportedSheet.supplierName}'s EPB exporter page`)));
    assert.ok(notExportedFrame.includes(escapeHtml(`HS ${notExportedSheet.hs}, not on ${notExportedSheet.supplierName}'s EPB exporter page`)));
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
    for (const id of ["supplier-sheet", "product-sheet", "rfq-composer"]) {
      assert.doesNotMatch(html, new RegExp(`data-screen="${id}"`), `${id} drew a record that was not read`);
    }
    assert.match(html, /data-screen="results-table"/, "the shell still renders");
    assert.match(html, /data-screen="filter-pane"/, "the filter pane needs no record");
  });

  it("all seven screens render when every record could be read, in the order the harness shoots them", () => {
    const html = renderAll(galleryData());
    assert.deepEqual([...framesOf(html).keys()], FRAMES);
    assert.deepEqual([...SCREENS], FRAMES, "SCREENS is what scripts/gallery/shots.mjs is checked against");
  });
});

describe("the ledger grid is the first screen", () => {
  it("two rows ticked and exactly one marked as the open record", () => {
    const html = screen(galleryData(), "results-table");
    const rows = [...html.matchAll(/<tr\b[^>]*data-row="result"[^>]*>/g)].map((m) => m[0]!);
    assert.equal(rows.length, 4);
    const current = rows.filter((r) => /aria-current="true"/.test(r));
    assert.equal(current.length, 1, "exactly one row is the record open beside the results");
    assert.match(current[0]!, /aria-label="Aboni Knitwear Ltd"/);
    // Ticked: the box says so, and the row carries the brand rule (a state
    // drawn only as a fill is invisible against its neighbours).
    assert.equal((html.match(/role="checkbox" aria-checked="true"/g) ?? []).length, 2, "two rows are ticked");
    const ruled = rows.filter((r) => r.includes("shadow-[inset_2px_0_0_rgb(var(--ds-accent))]"));
    assert.equal(ruled.length, 2, "the two ticked rows carry the selection rule");
  });

  it("the headers sort by URL and say which order is on; no header is held to one line", () => {
    const html = screen(galleryData(), "results-table");
    const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    const sorted = [...head.matchAll(/<th\b[^>]*aria-sort="([^"]+)"[^>]*>/g)].map((m) => m[1]!);
    assert.deepEqual(sorted.sort(), ["descending", "none", "none", "none", "none"], "five sortable columns, the default one on");
    assert.match(head, /href="\/app\/discover\?q=knitted\+shirts&amp;cert=gots&amp;sort=name"/, "a header sorts the same search");
    for (const th of head.match(/<th\b[^>]*>/g) ?? []) assert.doesNotMatch(th, /whitespace-nowrap/, `a header cell cannot wrap: ${th}`);
  });

  it("beside a pane the results narrow to the three essential columns, and the record's row is marked", () => {
    for (const id of ["supplier-sheet", "product-sheet"]) {
      const html = screen(galleryData(), id);
      const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
      assert.doesNotMatch(head, />Certificates<|>Export lines<|>Type</, `${id}: the full ledger beside a pane`);
      assert.match(head, /Supplier/);
      assert.match(head, /Workers/);
      assert.equal((html.match(/<tr\b[^>]*aria-current="true"/g) ?? []).length, 1, `${id}: the open record's row`);
    }
    for (const id of ["rfq-composer", "filter-pane"]) {
      assert.doesNotMatch(screen(galleryData(), id), /<tr\b[^>]*aria-current="true"/, `${id}: no record is open, so no row is current`);
    }
  });
});

describe("the RFQ composer is the pane beside the results", () => {
  it("names its one target and carries the draft, with Send held while the message has [brackets]", () => {
    const d = galleryData();
    const html = screen(d, "rfq-composer");
    assert.equal(composerTargets(d).length, 1);
    assert.match(html, /data-pane-wide="true"/, "the composer takes the wide pane");
    assert.match(html, /<section data-record-pane="" aria-label="New RFQ"/);
    assert.match(html, /to Aboni Knitwear Ltd · HS 6105/);
    assert.match(html, /value="Men&#x27;s knitted piqué polo, 220 gsm"/);
    assert.match(html, />What this RFQ carries</);
    // No workspace in the gallery, so the message holds [brackets] and Send waits (RQ-07).
    assert.match(html, /Still needed: your name in the message, company name in the message, website in the message/);
    const send = /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(html)?.[0] ?? "";
    assert.ok(send, "the composer draws no Send RFQ");
    assert.match(send, /\sdisabled=""/, "a message with [brackets] cannot be sent");
    // No workspace in the gallery: the template names what it lacks, never invents it.
    assert.match(html, /\[your name\]/);
    assert.match(html, /\[company name\]/);
    assert.deepEqual(composerPrefill(d).hs, "6105", "the draft's line is one the record carries");
  });

  it("a sanctioned sample as the target carries the banner and withholds Send", () => {
    const base = galleryData();
    const d = galleryData({ records: { ...base.records, aboni: rec(zaheenSampleInput(), "zaheen-knitwear") } });
    assert.equal(composerTargets(d)[0]!.sanctioned, true, "guard: the sample is sanctioned");
    const html = screen(d, "rfq-composer");
    assert.match(html, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(html, /Sanctioned · sample record — matched on a sanctions screen/);
    assert.match(html, /RFQs cannot be sent to a sanctioned supplier/);
    assert.match(html, /<button\b[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/);
    // The clean target draws none of it.
    assert.doesNotMatch(screen(base, "rfq-composer"), /data-sanction-visible/);
  });
});

describe("the filter pane is the search's own filters", () => {
  it("the pane sets what the search carries, and keeps the text in the form", () => {
    const html = screen(galleryData(), "filter-pane");
    assert.match(html, /<section data-record-pane="" aria-label="Filters"/);
    assert.match(html, />2 set</, "the text and the certificate: two filters");
    assert.match(html, /<option value="gots" selected="">/, "the certificate kind the search carries is picked");
    assert.match(html, /<input type="hidden" name="q" value="knitted shirts"\/>/);
    assert.match(html, /<form\b(?=[^>]*\sid="filters")(?=[^>]*\saction="\/app\/discover")(?=[^>]*\smethod="get")[^>]*>/);
    assert.equal(galleryState().q, GALLERY_QUERY.q);
    // Close goes somewhere on this page.
    assert.match(html, /aria-label="Close"[^>]*href="#filter-pane"|href="#filter-pane"[^>]*aria-label="Close"/);
  });
});

describe("the RFQ list is the body /app/rfqs renders", () => {
  it("the rows, their tabs and the counts they add up to", () => {
    const d = galleryData();
    const rows = sampleRfqRows(d)!;
    const html = screen(d, "rfq-list");
    for (const r of rows) assert.ok(html.includes(escapeHtml(r.product_title)), `${r.product_title} is not on the screen`);
    assert.match(html, /3 sent · 3 quotes/);
    assert.match(html, /<nav aria-label="RFQ status"/);
    assert.doesNotMatch(html, /Your first RFQ lands here/, "the empty state stood over three rows");
    assert.doesNotMatch(html, /\bNaN\b|undefined/);
    // Every row opens its RFQ (beside the list, or on its own page).
    for (const r of rows) assert.match(html, new RegExp(`href="/app/rfqs(?:/|[?]open=)${r.id}"`));
  });

  it("an unread list says so, with no count and no empty state standing in", () => {
    const html = screen(galleryData({ rfqError: true, rfqs: { ...EMPTY_RFQS, error: true, sent: null, quotes: null, footer: "The RFQ list could not be read" } }), "rfq-list");
    assert.ok(html.includes(escapeHtml(RFQ_ERROR_COPY)));
    assert.match(html, /Counts could not be read/);
    assert.doesNotMatch(html, /Your first RFQ lands here/);
    assert.doesNotMatch(html, /\b0 sent\b/);
  });

  it("the caption says the rows are a sample and the sidebar's count is the real one", () => {
    const caption = frame(galleryData(), "rfq-list").match(/<figcaption[\s\S]*?<\/figcaption>/)?.[0] ?? "";
    assert.match(caption, /3 sample RFQs/);
    assert.match(caption, /the real one/);
  });
});

// ---------------------------------------------------------------------------
// The states a screen is in are drawn, not only announced.
// ---------------------------------------------------------------------------

describe("the state a screen is in is drawn, not only announced", () => {
  // The fills are 1.07–1.17:1 against the neighbour they must be told from,
  // where WCAG 1.4.11 asks 3:1, so a state must carry a second indicator that
  // is not a fill. The token an element's indicator is drawn in, whatever
  // shape it takes: an inset shadow, a border, a ring.
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
  const GROUNDS = ["canvas", "surface", "surface.sunken", "accent.tint", "accent.tint-strong"];
  /** A token that clears 3:1 against every ground the kit draws a state on. */
  const strongEnough = (token: string) =>
    GROUNDS.every((bg) => contrastRatio(resolve(light, token.replace(/-/g, ".")), resolve(light, bg)) >= 3);
  /** Every attribute that says "this one is the one you are on". */
  const STATE = /<(?:a|button)\b[^>]*(?:aria-current="(?!false")[^"]*"|aria-pressed="true"|aria-selected="true")[^>]*>/g;
  /** A state's tag and the element it wraps first (a tab's Link and its chip): the indicator may sit on either. */
  const withChild = (html: string, m: RegExpMatchArray) => m[0]! + (/^\s*<[a-z]+\b[^>]*>/.exec(html.slice(m.index! + m[0]!.length))?.[0] ?? "");
  const weak = (html: string) =>
    [...html.matchAll(STATE)].map((m) => withChild(html, m)).filter((tag) => !indicatorTokens(tag).some(strongEnough));

  it("every current, pressed or selected control carries an indicator that is not a fill", () => {
    const frames = framesOf(renderAll(galleryData()));
    let states = 0;
    for (const [id, f] of frames) {
      states += (f.match(STATE) ?? []).length;
      assert.deepEqual(weak(f), [], `${id}: a state drawn only in colours nobody can tell from its neighbour`);
    }
    assert.ok(states >= 14, `the page still draws the states this guard is about (${states})`);
  });

  it(
    "the RFQ list's current status tab is drawn by more than its fill",
    () => {
      const f = framesOf(renderAll(galleryData())).get("rfq-list")!;
      const tabs = /<nav aria-label="RFQ status"[\s\S]*?<\/nav>/.exec(f)?.[0] ?? "";
      assert.ok(tabs, "guard: the tabs render over the sample rows");
      // The Link and the chip inside it, together.
      const current = /<a\b[^>]*aria-current="page"[^>]*>\s*<[a-z]+\b[^>]*>/.exec(tabs)?.[0] ?? "";
      assert.ok(indicatorTokens(current).some(strongEnough), `the current tab is a fill: ${current}`);
    },
  );

  it(
    "the ledger's open row is drawn by more than its fill",
    () => {
      const html = screen(galleryData(), "results-table");
      const row = /<tr\b[^>]*aria-current="true"[^>]*>/.exec(html)?.[0] ?? "";
      assert.ok(row, "guard: one row is current");
      assert.ok(indicatorTokens(row).some(strongEnough), `the open row is a fill: ${row}`);
    },
  );

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
    assert.ok(strongEnough("brand"));
    for (const w of ["brand-tint", "line", "line-subtle"]) {
      assert.ok(!strongEnough(w), `${w} is why this guard exists`);
    }
  });
});

describe("every pane sits beside live results: nothing on the page is modal", () => {
  // Since 27 Sep 2026 the record, the line, the composer and the filter set
  // all open in a pane beside the results, and the composer is no longer a
  // dialog. A `role="dialog"`, an `aria-modal` or an `inert` anywhere on this
  // page would tell a screen reader that results it can see are gone.
  it('no role="dialog", no aria-modal and nothing inert, anywhere on the page', () => {
    const html = renderAll(galleryData());
    assert.equal((html.match(/role="dialog"/g) ?? []).length, 0, "a dialog on the gallery page");
    assert.doesNotMatch(html, /aria-modal/);
    assert.doesNotMatch(html, /<[a-z]+\b[^>]*\sinert(?:=""|\s|>)/, "something on the gallery page is inert");
  });

  it("each pane screen draws its pane on the results' right, in one live shell", () => {
    const frames = framesOf(renderAll(galleryData()));
    const labels: Record<string, string> = {
      "supplier-sheet": "Supplier record",
      "product-sheet": "Product line",
      "rfq-composer": "New RFQ",
      "filter-pane": "Filters",
    };
    for (const [id, label] of Object.entries(labels)) {
      const f = frames.get(id)!;
      assert.ok(f, `${id} rendered`);
      assert.match(f, new RegExp(`data-record-pane="" aria-label="${label}"`), `${id}: the pane is not labelled ${label}`);
      // The results column stands beside it from lg and steps aside below.
      const column = f.search(/<div class="(?=[^"]*\bhidden\b)(?=[^"]*\blg:flex\b)[^"]*">/);
      assert.ok(column > -1, `${id}: no results column beside the pane`);
      assert.ok(f.indexOf("data-record-pane") > column, `${id}: the pane is not on the results' right`);
      assert.equal((f.match(/<main\b/g) ?? []).length, 1, `${id}: a second main landmark`);
      assert.equal((f.match(/<nav aria-label="Primary\b/g) ?? []).length, 1, `${id}: a second sidebar`);
    }
    for (const id of ["results-table", "results-list", "rfq-list"]) {
      assert.doesNotMatch(frames.get(id)!, /data-record-pane/, `${id} opens nothing`);
    }
  });
});

describe("what the whole page may and may not say about itself", () => {
  // Cycle 10. Each of these was a single string somewhere in the kit, and in
  // each case the guard that should have caught it was asserting the defect.
  it("no negative claims a register nobody has read", () => {
    const html = renderAll(galleryData());
    for (const rx of [/on any register/i, /on any list/i, /on any of the registers/i, /anywhere on file/i, /no certificate anywhere/i]) {
      assert.doesNotMatch(html, rx, `an absolute negative over registers that have not been read: ${rx}`);
    }
  });

  it("every denominator on the page is a number of registers that hold records", () => {
    const html = renderAll(galleryData());
    assert.doesNotMatch(html, /\bof 25 sources\b/);
    assert.doesNotMatch(html, /\bon 6 brand lists\b/);
    assert.match(html, /of 14 sources read/);
    assert.match(html, /not on 4 brand lists read/);
    assert.match(html, /on 4 registers/);
  });

  it("no control is in the tab order that cannot be operated", () => {
    const html = renderAll(galleryData());
    // A `role="checkbox"` with `tabindex="0"` and no handler announces an
    // operable checkbox and then swallows Space, which scrolls the page.
    const inert: string[] = [];
    for (const m of html.matchAll(/<[a-z]+\b[^>]*role="(checkbox|radio|switch|menuitem|tab|option)"[^>]*>/g)) {
      if (!/aria-disabled="true"/.test(m[0]!)) continue;
      inert.push(m[0]!);
      assert.doesNotMatch(m[0]!, /tabindex/, `an inert control left in the tab order: ${m[0]}`);
    }
    // Counted over the loop's own population: the gallery's result rows have
    // no selection provider, so their boxes are the inert shape.
    assert.ok(inert.length >= 20, `the page still draws the inert controls this guard is about (${inert.length})`);
  });

  it("a name that reads as an action is on something that can be actioned", () => {
    const html = renderAll(galleryData());
    const ACTION = /^(Remove|Close|Open|Select|Save|Send|Add|Export|Back|Share)\b/;
    let named = 0;
    for (const m of html.matchAll(/<([a-z]+)\b([^>]*\baria-label="([^"]*)"[^>]*)>/g)) {
      const [, tag, attrs, label] = m as unknown as [string, string, string, string];
      if (!ACTION.test(label)) continue;
      named += 1;
      const role = /\brole="([^"]*)"/.exec(attrs)?.[1];
      // A field named for what you do in it ("Add a question") is operable too.
      assert.ok(
        ["button", "a", "input", "textarea", "select"].includes(tag) || (role !== undefined && role !== "img"),
        `an action name on something that cannot be actioned: <${tag} ${role ? `role="${role}" ` : ""}aria-label="${label}">`,
      );
    }
    assert.ok(named >= 10, "the page still draws the named affordances this guard is about");
    for (const m of html.matchAll(/<svg\b[^>]*aria-label="[^"]*"[^>]*>/g)) {
      assert.match(m[0]!, /role="img"/, `a named <svg> with no role: ${m[0]}`);
    }
  });

  it("the page actually draws icons, not just markup that names them", () => {
    const svgs = renderAll(galleryData()).match(/<svg\b/g) ?? [];
    assert.ok(svgs.length > 100, `expected well over a hundred real icons across seven screens, found ${svgs.length}`);
  });

  it("nothing announced as unavailable is left in the tab order", () => {
    const html = renderAll(galleryData());
    for (const m of html.matchAll(/<a\b[^>]*aria-disabled="true"[^>]*>/g)) {
      assert.match(m[0]!, /tabindex="-1"/, `a link announced unavailable but still focusable: ${m[0]}`);
    }
    const d = galleryData();
    assert.deepEqual(
      (d.sheet?.tabs ?? []).filter((t) => t.href === null).map((t) => t.label),
      [],
      "a sheet tab points nowhere again; this test needs it back in its placeholder list",
    );
    assert.ok(d.cards.some((c) => c.chips.length > 4), "a card still has more chips than it draws, so its \"+N\" is in the sweep");
  });

  it("no two elements on the page share an id", () => {
    // Seven screens on one document: a pane's form, a datalist or a skip
    // target that repeats would send a label, a list or a link to the wrong one.
    const ids = [...renderAll(galleryData()).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
    const twice = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual([...new Set(twice)], []);
  });

  it("every screen can be entered past the sidebar, and every screen has a heading to navigate by", () => {
    const html = renderAll(galleryData());
    const frames = framesOf(html);
    assert.equal(frames.size, 7, "seven screens");
    // Checked globally: the historical bug was six screens all calling their
    // landmark `ds-main`, which a per-frame check cannot see.
    const allMains = [...html.matchAll(/<main id="([^"]+)"/g)].map((m) => m[1]!);
    assert.equal(allMains.length, new Set(allMains).size, `two screens share a landmark id: ${allMains.join(", ")}`);
    const navNames: string[] = [];
    const mainNames: string[] = [];
    const skipLinkNames: string[] = [];
    for (const [id, f] of frames) {
      navNames.push(...[...f.matchAll(/<nav aria-label="([^"]+)"/g)].map((m) => m[1]!));
      for (const offender of searchLandmarksWithoutAnOperableControl(f)) {
        assert.fail(`${id}: role="search" with no operable control: ${offender.slice(0, 120)}`);
      }
      mainNames.push(...[...f.matchAll(/<main id="[^"]+" aria-label="([^"]+)"/g)].map((m) => m[1]!));
      skipLinkNames.push(...[...f.matchAll(/<a href="#[^"]+" class="sr-only[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]!));
      const mains = [...f.matchAll(/<main id="([^"]+)"/g)].map((m) => m[1]!);
      assert.equal(mains.length, 1, `${id}: one content landmark`);
      const link = f.indexOf(`href="#${mains[0]}"`);
      assert.ok(link > -1, `${id}: no skip link targets #${mains[0]}`);
      assert.ok(link < f.indexOf(`<main id="${mains[0]}"`), `${id}: the skip link comes after the landmark it targets`);
      const nav = f.indexOf("<nav", link);
      assert.ok(nav === -1 || link < nav, `${id}: the skip link comes before the navigation`);
      // Heading order: no level skipped on the way down.
      assert.match(f, /<h1\b/, `${id}: a screen with no heading cannot be navigated by heading`);
      const levels = [...f.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
      for (let i = 1; i < levels.length; i += 1) {
        assert.ok(levels[i]! <= levels[i - 1]! + 1, `${id}: heading order jumps h${levels[i - 1]} → h${levels[i]}`);
      }
      // One h1 per screen: beside a record, the search steps down to h2.
      assert.equal((f.match(/<h1\b/g) ?? []).length, 1, `${id}: more than one h1`);
    }
    // Every live nav, main and skip link is named, and no two share a name.
    assert.ok(navNames.length >= 7, "the page still draws the live navigation landmarks this guard is about");
    assert.equal(navNames.filter((n) => n !== "RFQ status" && n !== "Record sections").length, new Set(navNames.filter((n) => n !== "RFQ status" && n !== "Record sections")).size, `two live navigation landmarks share a name: ${navNames.join(", ")}`);
    assert.equal(mainNames.length, 7, "every screen's main is named");
    assert.equal(mainNames.length, new Set(mainNames).size, `two live main landmarks share a name: ${mainNames.join(", ")}`);
    assert.equal(skipLinkNames.length, new Set(skipLinkNames).size, `two live skip links share their text: ${skipLinkNames.join(", ")}`);
  });

  it(
    "a record open beside the results leaves the page one h1",
    () => {
      const frames = framesOf(renderAll(galleryData()));
      for (const id of ["supplier-sheet", "product-sheet"]) {
        assert.equal((frames.get(id)!.match(/<h1\b/g) ?? []).length, 1, `${id}: two h1s`);
      }
    },
  );

  it('a role="search" landmark with no operable control is caught whatever tag carries the role', () => {
    assert.deepEqual(
      searchLandmarksWithoutAnOperableControl('<span role="search"><em>Search suppliers</em></span><button>Help</button>'),
      ['<span role="search"><em>Search suppliers</em></span>'],
    );
    assert.deepEqual(searchLandmarksWithoutAnOperableControl('<span role="search"><input placeholder="Search" /></span>'), []);
    assert.deepEqual(searchLandmarksWithoutAnOperableControl('<div role="search"><a href="/search">Go</a></div>'), []);
    assert.deepEqual(searchLandmarksWithoutAnOperableControl('<div role="search">static text only</div>'), ['<div role="search">static text only</div>']);
  });
});

describe("the sidebar and the shell state only what was read", () => {
  it("the RFQ pill carries the real count on every screen, and none when the read failed", () => {
    const withSeven = render(galleryData({ rfqs: { ...EMPTY_RFQS, sent: 7, chips: [{ label: "All", count: 7, on: true }], rows: [] } }));
    assert.equal((withSeven.match(/RFQs<\/span><[^>]*>7</g) ?? []).length, 7, "seven screens, each reading the account's own count");
    assert.doesNotMatch(withSeven, /RFQs<\/span><[^>]*>0</);
    const failed = render(galleryData({ rfqError: true, rfqs: { ...EMPTY_RFQS, error: true, sent: null, quotes: null, chips: [{ label: "All", count: null, on: true }], footer: "The RFQ list could not be read" } }));
    assert.doesNotMatch(failed, />RFQs<\/span><[^>]*>0</, "a failed read is not zero RFQs");
    assert.match(failed, /Counts could not be read/);
  });

  it("every link to this page goes somewhere that exists", () => {
    const html = renderAll(galleryData());
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
    for (const m of html.matchAll(/href="#([^"]*)"/g)) {
      const target = m[1]!;
      if (target === "") continue;
      assert.ok(ids.has(target), `href="#${target}" points at an anchor this page does not have`);
    }
    // A bare `href="#"` is a focusable link that scrolls to the top: it must say it goes nowhere.
    for (const m of html.matchAll(/<a\b[^>]*href="#"[^>]*>/g)) {
      assert.match(m[0]!, /aria-disabled="true"/, `a placeholder link that does not say so: ${m[0]}`);
      assert.match(m[0]!, /title="[^"]+"/, `a placeholder link with no explanation: ${m[0]}`);
    }
  });

  it("the primary nav says which item is current, and names itself", () => {
    const html = render(galleryData());
    const navs = [...html.matchAll(/<nav aria-label="Primary\b[\s\S]*?<\/nav>/g)].map((m) => m[0]!);
    assert.equal(navs.length, 7);
    for (const nav of navs) assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1, "one current item per screen");
  });
});

// ---------------------------------------------------------------------------
// Cycle 9: the composition layer. What the page hands the components.
// ---------------------------------------------------------------------------

describe("the screens claim only what the query asked for and the RPC answered", () => {
  it("one chip per filter the query carries, and no others", () => {
    const html = render(galleryData());
    assert.match(html, />Text · knitted shirts</);
    assert.match(html, />Certificate · GOTS</);
    // Only the search composer's chips, on the ledger's own screen.
    const start = html.indexOf('data-screen="results-table"');
    const composer = html.slice(start, html.indexOf("</section>", start));
    const chips = [...composer.matchAll(/bg-accent-tint-strong[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual([...new Set(chips)].sort(), ["Certificate · GOTS", "Text · knitted shirts"]);
    assert.equal(GALLERY_QUERY.certKinds.length, 1);
    assert.equal(GALLERY_QUERY.certKinds[0], "gots");
    // The filter pane's state is the same search: no filter it never ran.
    const s = galleryState();
    assert.deepEqual(s.cert, [{ kind: "gots", state: "any" }]);
    assert.deepEqual([s.hs, s.reg, s.brand, s.district, s.city, s.type], [[], [], [], [], [], []]);
  });

  it("the sort label names the sort the RPC was given", () => {
    const html = render(galleryData());
    assert.match(html, />\s*Most sources\s*</);
    assert.equal(SORT_MOST_SOURCES, "receipts", "the label and the argument are two names for one thing");
    assert.doesNotMatch(html, /Best match|Relevance|Newest first/, "a sort the RPC does not offer");
  });

  it("the saved-search count is the query's, not this page's", () => {
    const html = render(galleryData());
    assert.match(html, /Knitted shirts · GOTS<[^>]*>42</);
    const unread = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.doesNotMatch(unread, /Knitted shirts · GOTS<[^>]*>\d/, "an unread total is not a count");
  });

  it("the shell states no figure the loader did not read", () => {
    const html = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.doesNotMatch(html, /Suppliers<\/span><[^>]*>0</);
    assert.doesNotMatch(html, /published suppliers/, "the topbar count is unread, so it is absent");
    assert.doesNotMatch(html, /count could not be read[^<]*0/);
  });

  it("the screens are rendered at the width the screenshots are captioned with", () => {
    const html = renderAll(galleryData());
    const frames = [...html.matchAll(/style="width:(\d+)px[^"]*"\s+data-screen="([^"]+)"/g)];
    assert.equal(frames.length, 7, "one framed screen per screen");
    // 1440 as a literal: comparing against `SCREEN_WIDTH` imported from the
    // file under test cannot fail, and the approved renders are 1440-wide.
    assert.equal(SCREEN_WIDTH, 1440);
    for (const f of frames) assert.equal(f[1], "1440", `the ${f[2]} frame is ${f[1]}px, not the width the screenshots are captioned with`);
    assert.deepEqual(frames.map((f) => f[2]), FRAMES);
  });

  it("the screenshot harness shoots every screen the gallery draws", () => {
    const shots = readFileSync(path.join(process.cwd(), "scripts", "gallery", "shots.mjs"), "utf8");
    const list = /const SCREENS = \[([^\]]*)\]/.exec(shots)?.[1] ?? "";
    assert.deepEqual([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]), FRAMES);
  });
});
