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
import { aboniInput, arFashionInput, RFQ_ROWS, RFQ_TARGETS, smKnitwearInput, TODAY, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import { GALLERY_QUERY, SORT_MOST_SOURCES, topbarCaption, type GalleryData, type GalleryRecord } from "@/lib/dashboard/gallery-data";
import type { RfqListModel } from "@/lib/dashboard/models";
import { DashboardScreens, SCREEN_WIDTH } from "./dashboard-screens";

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
    // The date is `max(last_seen_at)` over the records this page draws, not
    // over the corpus the count is of: 1,677 of the 10,266 were last read on
    // 18 Sep 2026 and the median is 24 Jul (SQL, 20 Sep 2026). Two figures
    // joined by a middle dot read as one claim, so the words say which
    // population the date belongs to.
    assert.equal(topbarCaption({ published: 10266, recordsReadOn: "18 Sep 2026" }), "10,266 published suppliers · records on this page read 18 Sep 2026");
    assert.equal(topbarCaption({ published: null, recordsReadOn: "18 Sep 2026" }), "records on this page read 18 Sep 2026");
    assert.equal(topbarCaption({ published: 1, recordsReadOn: null }), "1 published suppliers");
    assert.equal(topbarCaption({ published: null, recordsReadOn: null }), "Live records");
    const shell = render(galleryData());
    assert.match(shell, /10,266 published suppliers · records on this page read 18 Sep 2026/);
    assert.doesNotMatch(shell, /suppliers · records read /, "a record-level date must not be printed as a corpus fact");
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
    for (const m of html.matchAll(/<[a-z]+\b[^>]*role="(checkbox|radio|switch|menuitem|tab|option)"[^>]*>/g)) {
      if (!/aria-disabled="true"/.test(m[0]!)) continue;
      assert.doesNotMatch(m[0]!, /tabindex/, `an inert control left in the tab order: ${m[0]}`);
    }
    assert.match(html, /role="checkbox"[^>]*aria-disabled="true"/, "the page still draws the checkboxes this guard is about");
  });

  it("every named graphic says it is a graphic", () => {
    const html = renderAll(galleryData());
    // An `aria-label` on an element with no role is neither a control nor a
    // reliably named image. Ten "Remove <filter>" icons were emitted that
    // way and read as actions that nothing could reach.
    for (const m of html.matchAll(/<svg\b[^>]*aria-label="[^"]*"[^>]*>/g)) {
      assert.match(m[0]!, /role="img"/, `a named <svg> with no role: ${m[0]}`);
    }
    assert.ok([...html.matchAll(/<svg\b[^>]*aria-label="[^"]*"/g)].length >= 10, "the page still draws the named icons this guard is about");
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
    // Only the search composer's chips; the RFQ list's "All" chip shares the class.
    const composer = html.slice(html.indexOf('role="search"'), html.indexOf("</section>"));
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
    assert.match(html, /Knitted shirts · GOTS valid<[^>]*>42</);
    const unread = render(galleryData({ discoverError: true, total: null, published: null }));
    assert.doesNotMatch(unread, /Knitted shirts · GOTS valid<[^>]*>\d/, "an unread total is not a count");
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
