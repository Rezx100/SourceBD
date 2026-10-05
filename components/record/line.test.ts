// One export line of a record on the v4 kit (B11b): the page for ONE HS heading, drawn beside the
// results and on its own page. The route tests (`app/(app)/app/record-routes.test.ts`) cover the
// boundary (404 for a heading that is not one, the redirects, the Back that keeps the search); these
// cover the view's own rules from the real fixtures: the heading and what the line says it is, the
// photo or its absence, the other lines, the certified scope, the exporter count the linked search
// returns, a missing fact as a sentence and never a blank, and the refusal in words on a sanctioned
// record. No contact value and no score exists in the model.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildProductSheet } from "@/lib/dashboard/build-models";
import { aboniInput, arFashionInput, sanctionedInput, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import type { FactRow, ProductSheetModel } from "@/lib/dashboard/models";
import { LineView } from "@/components/record/line-view";
import { PHOTO_CAPTION, lineEyebrow, lineFacts } from "@/components/record/words";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const LINKS = { backHref: "/app/discover?q=knit&record=aboni-knitwear", closeHref: "/app/discover?q=knit", rfqHref: "/app/rfqs/new?supplier=id-1&hs=6105" };
const sheet = (input = aboniInput(), hs = "6105", options: Parameters<typeof buildProductSheet>[2] = LINKS) => buildProductSheet(input, hs, options);
const view = (m: ProductSheetModel, mode: "pane" | "page" = "pane") => renderToStaticMarkup(h(LineView, { model: m, mode }));
/** The words of one fact row: from its label to the next row's. */
const row = (out: string, label: string, next: string) => text(new RegExp(`${label.replace(/[·]/g, ".")}([\\s\\S]*?)${next.replace(/[·]/g, ".")}`).exec(out)?.[1] ?? "");

describe("the line's heading and what it says it is", () => {
  it("the heading is the page's title (h2 beside the results, h1 on its own page) over the supplier and the code", () => {
    const m = sheet();
    const pane = view(m);
    assert.match(pane, /<h2 [^>]*>Men&#x27;s or boys&#x27; shirts, knitted or crocheted<\/h2>/);
    assert.doesNotMatch(pane, /<h1/);
    const page = view(m, "page");
    assert.match(page, /<h1 [^>]*>Men&#x27;s or boys&#x27; shirts, knitted or crocheted<\/h1>/);
    assert.match(text(pane), new RegExp(`${m.supplierName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} / HS 6105`));
    assert.match(pane, /aria-label="Product line"/);
  });

  it("calls it an EPB export line only when the record's own EPB page carries it", () => {
    assert.equal(lineEyebrow(sheet()), "HS 6105 · EPB export line");
    const off = sheet(aboniInput(), "6205");
    assert.equal(lineEyebrow(off), "HS 6205 · not on this record's EPB page");
    const unread = aboniInput();
    unread.hscodes = [];
    unread.hscodesError = true;
    const m = sheet(unread);
    assert.equal(lineEyebrow(m), "HS 6105 · EPB lines could not be read");
    const out = text(view(m));
    assert.match(out, /EPB lines could not be read/);
    assert.doesNotMatch(out, /not on this record's EPB page|EPB export line|EPB checked/);
    // The Exporter page row says it could not be read, not that the line is absent.
    assert.match(row(plain(view(m)), "Exporter page", "Exporting since"), /Could not be read/);
  });
});

describe("the photo", () => {
  it("is the catalogue's, decorative, and captioned as illustrative and not the supplier's own", () => {
    const out = view(sheet());
    assert.match(out, /<img src="\/products\/hs\/hs-6105\.webp" alt=""/);
    const caption = text(out);
    assert.ok(caption.includes(`${PHOTO_CAPTION} 6105.`), caption);
    assert.match(caption, /Not the supplier's own product; a photo from the supplier replaces it once they upload one\./);
  });

  it("a heading with no photo keeps its place and shows its code, and no image", () => {
    const m = sheet();
    const bare = view({ ...m, photo: { ...m.photo, src: null } });
    assert.doesNotMatch(bare, /<img/);
    assert.match(text(bare), /6105 no photo yet/);
    assert.match(text(bare), /Illustrative photo, keyed to the HS code 6105/);
  });

  it("names the day a photo was generated when the model carries one", () => {
    assert.match(text(view({ ...sheet(), generatedOn: "2 Oct 2026" })), /keyed to the HS code 6105, generated 2 Oct 2026\./);
  });
});

describe("the facts", () => {
  it("are the model's rows, in its order, one label each", () => {
    const m = sheet();
    const out = view(m);
    const labels = [...out.matchAll(/<dt [^>]*>([^<]*)<\/dt>/g)].map((x) => plain(x[1]!));
    assert.deepEqual(labels, m.facts.map((f) => f.label));
    assert.deepEqual(labels.slice(0, 3), ["Chapter", "Exporter page", "Exporting since"]);
  });

  it("the other lines are the record's other headings, in mono, from EPB", () => {
    const out = view(sheet());
    assert.match(out, /<span class="[^"]*font-mono[^"]*">6102 · 6103 · 6104 · 6106 · 6107 · 6108 · 6109 · 6110 · 6111 · 6114 · 6115<\/span>/);
    assert.match(row(out, "Other lines", "Certified scope"), /From EPB/);
  });

  it("the certified scope keeps its operations and products, its certificate's state in words, and its register", () => {
    const out = view(sheet());
    const scope = row(out, "Certified scope", "Product list");
    assert.match(scope, /GOTS-31587 · dyeing; embroidery, embellishment; finishing \+6 · products: men's apparel/);
    assert.match(scope, /Valid to 12 May 2027/);
    assert.match(scope, /From GOTS/);
    assert.match(out, /class="[^"]*border-cert-valid-edge/, "the valid state is the kit's certificate chip");
  });

  it("a certificate with no expiry on file is the dashed chip, and a lapsed one is the expired chip", () => {
    const undated = aboniInput();
    undated.profile.certifications = [{ ...undated.profile.certifications[0]!, expires_on: null }];
    assert.match(view(sheet(undated)), /class="[^"]*border-dashed border-cert-no-expiry-edge[^"]*">[\s\S]*?No expiry on file/);
    const facts = lineFacts([
      { label: "Certified scope", value: "X", badge: { tone: "caution", label: "Expired 4 Apr 2026" } },
      { label: "Certified scope", value: "X", badge: { tone: "caution", label: "Expires 1 Nov 2026 · 11 days" } },
    ]);
    assert.deepEqual(facts.map((f) => f.badge?.state), ["expired", "expiring"]);
  });

  it("a fact with nothing on file is a sentence, with the reason after it, and never a blank or a zero", () => {
    const out = view(sheet());
    assert.match(row(out, "Exporting since", "Other lines"), /Not on file · EPB lists lines, not dates/);
    assert.match(row(out, "Price · MOQ · lead time", "</dl>"), /Not attested · supplier-attested fields, shown when attested/);
    const none = view(sheet(arFashionInput()));
    assert.match(row(none, "Certified scope", "Product list"), /Not on file/);
  });

  it("a product list the register filed without a source says so, and the exporter page is a link to EPB", () => {
    const out = view(sheet());
    assert.match(row(out, "Product list", "Buyer lists"), /Source not linked yet/);
    assert.match(out, /<a href="https?:\/\/[^"]*"[^>]*>edb\.epb\.gov\.bd · exporter [^<]*/);
  });
});

describe("the actions", () => {
  it("Exporters of the heading is the search with its count, the figure the search returns", () => {
    const out = view(sheet());
    assert.match(out, /<a [^>]*href="\/app\/discover\?hs=6105"[^>]*>Exporters of 6105<span [^>]*>· 1,634<\/span><\/a>/);
  });

  it("a heading the record does not export claims no exporter count", () => {
    const out = view(sheet(aboniInput(), "6205"));
    assert.match(out, /Exporters of 6205<\/a>/, "the link is still the search for the heading");
    assert.doesNotMatch(text(out), /Exporters of 6205 ·/);
  });

  it("Send RFQ for this line is a real link on the line's own composer", () => {
    const out = view(sheet());
    assert.match(out, /<a [^>]*href="\/app\/rfqs\/new\?supplier=id-1&amp;hs=6105"[^>]*>Send RFQ for this line<\/a>/);
  });

  it("Back goes to the record on this search, and Close to the search; the page draws no Close and keeps no pane marker", () => {
    const pane = view(sheet());
    assert.match(pane, /<a [^>]*aria-label="Back to the record"[^>]*href="\/app\/discover\?q=knit&amp;record=aboni-knitwear"|<a [^>]*href="\/app\/discover\?q=knit&amp;record=aboni-knitwear"[^>]*aria-label="Back to the record"/);
    assert.match(pane, /<a [^>]*aria-label="Close"[^>]*href="\/app\/discover\?q=knit"|<a [^>]*href="\/app\/discover\?q=knit"[^>]*aria-label="Close"/);
    assert.match(pane, /<section [^>]*data-record-pane=""/, "beside the results the pane is the region focus moves into");
    const page = view(sheet(aboniInput(), "6105", { backHref: "/app/suppliers/aboni-knitwear?tab=products" }), "page");
    assert.match(page, /href="\/app\/suppliers\/aboni-knitwear\?tab=products"/);
    assert.doesNotMatch(page, /aria-label="Close"/);
    assert.doesNotMatch(page, /data-record-pane/);
    assert.match(page, /<section [^>]*data-detail=""/, "the phone's app bars step aside, as on the record page");
    assert.doesNotMatch(page, /Send RFQ for this line/, "no composer link without one in the model");
  });
});

describe("a sanctioned record's line", () => {
  const sanctioned = () => {
    const s = sanctionedInput();
    return buildProductSheet(s, "6105", LINKS);
  };

  it("keeps the solid band and the refusal in words, and no Send RFQ link", () => {
    const m = sanctioned();
    assert.equal(m.sanctioned, true, "guard: the fixture is sanctioned");
    const out = view(m);
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(plain(out), /Sanctioned: matched on a sanctions screen\./);
    assert.match(plain(out), /You can't send this supplier an RFQ\./);
    assert.ok(!out.includes('href="/app/rfqs/new'), "a sanctioned record's line has a live Send RFQ");
    assert.doesNotMatch(out, /Send RFQ for this line/, "the button is replaced by the refusal, not greyed");
    assert.match(out, /Exporters of 6105/, "the record stays readable for due diligence");
  });

  it("says when it is a sample record", () => {
    const out = plain(view(buildProductSheet(zaheenSampleInput(), "6105", LINKS)));
    assert.match(out, /Sanctioned · sample record: matched on a sanctions screen\./);
  });
});

describe("what the view never holds", () => {
  const OLD_KIT = /data-sheet-scroll|animate-sheet-in|bg-surface-sunken|text-ink-(?:muted|subtle)|border-line-subtle|min-h-fact-row/;

  it("no contact value, no score, and none of the old kit's classes, in either mode", () => {
    for (const mode of ["pane", "page"] as const) {
      const out = view(sheet(), mode);
      for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) assert.ok(!out.includes(key), `${mode}: ${key}`);
      assert.doesNotMatch(text(out), /\b(score|grade|rating|stars?)\b/i, mode);
      assert.doesNotMatch(out, OLD_KIT, `${mode}: carries a class of the old kit`);
    }
  });

  it("a contact value filed as a principal product does not reach the line", () => {
    const input = aboniInput();
    input.profile.supplier.principal_products = ["shdeck.com", "Polo Shirt", "01711-528388"];
    const out = view(sheet(input));
    for (const value of ["shdeck.com", "01711-528388", "528388"]) assert.ok(!out.includes(value), value);
  });
});

describe("lineFacts", () => {
  const f = (over: Partial<FactRow>): FactRow => ({ label: "L", value: null, ...over });

  it("reads a value, a link, a mono code and a list the way the record's key facts do", () => {
    const [a, b, c] = lineFacts([
      f({ value: "edb.epb.gov.bd", href: "https://edb.epb.gov.bd/x" }),
      f({ value: "6102 · 6103", code: true }),
      f({ items: [{ label: "BGMEA General", code: "6843", mark: null }] }),
    ]);
    assert.deepEqual(a!.values, [{ text: "edb.epb.gov.bd", mono: false, href: "https://edb.epb.gov.bd/x" }]);
    assert.deepEqual(b!.values, [{ text: "6102 · 6103", mono: true, href: null }]);
    assert.deepEqual(c!.values, [{ text: "BGMEA General reg. no. 6843", mono: true, href: null }]);
  });

  it("a missing value says what is missing, why, and what was checked, in that order", () => {
    assert.equal(lineFacts([f({})])[0]!.empty, "Not on file");
    assert.equal(lineFacts([f({ empty: "Not attested", note: "supplier-attested", checked: "registers checked" })])[0]!.empty, "Not attested · supplier-attested · registers checked");
    assert.equal(lineFacts([f({ value: "x" })])[0]!.empty, null);
  });

  it("is pending only where the payload names no register", () => {
    const mark = { code: "EPB", tier: 1, mark: "EP", label: "EPB", name: "Export Promotion Bureau" } as const;
    assert.equal(lineFacts([f({ value: "x", pendingSource: true })])[0]!.pending, true);
    assert.equal(lineFacts([f({ value: "x", pendingSource: true, marks: [mark] })])[0]!.pending, false);
  });
});
