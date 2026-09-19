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
import { aboniInput, arFashionInput, RFQ_ROWS, RFQ_TARGETS, smKnitwearInput, TODAY, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import { topbarCaption, type GalleryData, type GalleryRecord } from "@/lib/dashboard/gallery-data";
import type { RfqListModel } from "@/lib/dashboard/models";
import { DashboardScreens } from "./dashboard-screens";

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
    recordsReadOn: "18 Sep 2026",
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
    assert.equal(topbarCaption({ published: 10266, recordsReadOn: "18 Sep 2026" }), "10,266 published suppliers · records read 18 Sep 2026");
    assert.equal(topbarCaption({ published: null, recordsReadOn: "18 Sep 2026" }), "records read 18 Sep 2026");
    assert.equal(topbarCaption({ published: 1, recordsReadOn: null }), "1 published suppliers");
    assert.equal(topbarCaption({ published: null, recordsReadOn: null }), "Live records");
    assert.match(render(galleryData()), /10,266 published suppliers · records read 18 Sep 2026/);
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

describe("the RFQ screen renders the rows rfq_list returns", () => {
  const withRfqs = (): GalleryData => {
    const rows = RFQ_ROWS.map((r) => buildRfqRow(r, RFQ_TARGETS[r.id] ?? null, TODAY));
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
    assert.equal(RFQ_ROWS.length, 7);
    for (const r of RFQ_ROWS) assert.ok(html.includes(escapeHtml(r.product_title)), `${r.id} is not on the screen`);
    assert.match(html, /7 sent · 0 quotes/);
    assert.doesNotMatch(html, /0 sent · 0 quotes/);
    assert.doesNotMatch(html, /Your first RFQ lands here/, "the empty state stood over seven real rows");
    // The supplier each row targets is named, from the `suppliers` rows the
    // `target_supplier_ids` point at.
    assert.match(html, /QUATTRO FASHION LIMITED/);
    assert.match(html, /Thermax Woven Dyeing Ltd\./);
    assert.doesNotMatch(html, /\bNaN\b/);
  });

  it("the gallery's own caption says whose RFQs these are and what an empty list would mean", () => {
    const caption = renderAll(withRfqs());
    assert.match(caption, /rfq_list is scoped to auth\.uid\(\)/);
    assert.match(caption, /7 real rows/);
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
      // `href="#"` is the approved fragment's inert form and always resolves.
      if (target === "") continue;
      assert.ok(ids.has(target), `href="#${target}" points at an anchor this page does not have`);
    }
  });

  it("the primary nav says which item is current, and names itself", () => {
    const html = render(galleryData());
    assert.match(html, /<nav aria-label="Primary"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 6, "one current item per screen");
  });
});
