// What a search field does with the suggestions: where a row leads, the arrow keys, the rows and
// the two lines each one draws. The matching itself is `search-suggest.test.ts`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldValue, highlightParts, PANE_PARAMS, rowWords, stepIndex, suggestionHref, suggestionRows, type Suggestion } from "./search-suggest-ui";

const company: Suggestion = { type: "company", label: "Aboni Knitwear Ltd.", sublabel: "Dhaka", slug: "aboni-knitwear" };

describe("where a row leads", () => {
  it("a supplier opens beside the results: the search, its filters and the selection stay, the old pane and tab go", () => {
    const href = suggestionHref(company, { pathname: "/app/discover", search: "q=knit&cert=gots&tab=sources&site=2&record=other&line=6105&page=3" });
    const url = new URL(href, "https://x.invalid");
    assert.equal(url.pathname, "/app/discover");
    assert.equal(url.searchParams.get("record"), "aboni-knitwear");
    assert.equal(url.searchParams.get("q"), "knit");
    assert.equal(url.searchParams.get("cert"), "gots");
    assert.equal(url.searchParams.get("page"), "3");
    for (const gone of ["tab", "site", "line"]) assert.equal(url.searchParams.get(gone), null, `${gone} belongs to the record that was open`);
  });

  it("from any other page a supplier is a search for its name with its record open", () => {
    const url = new URL(suggestionHref(company, { pathname: "/app/saved", search: "" }), "https://x.invalid");
    assert.equal(url.pathname, "/app/discover");
    assert.equal(url.searchParams.get("q"), "Aboni Knitwear Ltd.");
    assert.equal(url.searchParams.get("record"), "aboni-knitwear");
  });

  it("a category is its HS code, a certificate or a place sets its own filter, the words typed are `q`", () => {
    assert.equal(suggestionHref({ type: "heading", label: "Men's knit shirts", hs: "6105" }), "/app/discover?hs=6105");
    assert.equal(suggestionHref({ type: "cert", label: "GOTS certified", value: "GOTS", param: ["cert", "gots"] }), "/app/discover?cert=gots");
    assert.equal(suggestionHref({ type: "location", label: "Gazipur", value: "Gazipur", param: ["district", "Gazipur"] }), "/app/discover?district=Gazipur");
    assert.equal(suggestionHref({ type: "product", label: "Polo shirts", value: "Polo shirts" }), "/app/discover?q=Polo+shirts");
    assert.equal(suggestionHref({ type: "query", label: "knit shirts" }), "/app/discover?q=knit+shirts");
  });

  it("the record's own parameters are all dropped when another supplier opens", () => {
    for (const k of ["record", "tab", "site", "line", "lines", "rfq", "filters", "save"]) assert.ok(PANE_PARAMS.includes(k), k);
  });
});

describe("the arrow keys", () => {
  it("wrap at both ends; nothing active steps to the first on Down and the last on Up", () => {
    assert.equal(stepIndex(-1, 1, 4), 0);
    assert.equal(stepIndex(-1, -1, 4), 3);
    assert.equal(stepIndex(3, 1, 4), 0);
    assert.equal(stepIndex(0, -1, 4), 3);
    assert.equal(stepIndex(1, 1, 4), 2);
    assert.equal(stepIndex(-1, 1, 0), -1);
  });
});

describe("the rows", () => {
  it("the words typed come first so Enter's meaning is on screen; the server's rows follow", () => {
    const rows = suggestionRows("  knit ", [company], []);
    assert.deepEqual(rows[0], { type: "query", label: "knit" });
    assert.equal(rows[1], company);
  });

  it("an empty field lists the recent searches, and a stray recent row never shows over typing", () => {
    const recent: Suggestion = { type: "recent", label: "knit", href: "/app/discover?q=knit", count: 4645 };
    assert.deepEqual(suggestionRows("", [company], [recent]), [recent]);
    assert.ok(!suggestionRows("k", [recent, company], [recent]).some((r) => r.type === "recent"));
  });

  it("the field follows the URL's query on the results page and nowhere else", () => {
    assert.equal(fieldValue("/app/discover", "knit", "x"), "knit");
    assert.equal(fieldValue("/app/discover", null, "x"), "");
    assert.equal(fieldValue("/app/saved", "knit", "x"), "x");
  });

  it("the matching start of each typed word is set apart, in any case", () => {
    assert.deepEqual(highlightParts("Basic Knitwear Ltd.", "kn"), [
      { text: "Basic ", hit: false },
      { text: "Kn", hit: true },
      { text: "itwear Ltd.", hit: false },
    ]);
    assert.deepEqual(highlightParts("Aboni", ""), [{ text: "Aboni", hit: false }]);
  });
});

describe("the two lines a row draws (Paper's combobox: a name, then what it is)", () => {
  it("each kind says what it is; a supplier adds its place and nothing about its contacts or standing", () => {
    assert.deepEqual(rowWords(company), { name: "Aboni Knitwear Ltd.", sub: "Supplier · Dhaka" });
    assert.deepEqual(rowWords({ type: "company", label: "A", sublabel: null, slug: "a" }), { name: "A", sub: "Supplier" });
    assert.equal(rowWords({ type: "heading", label: "Men's knit shirts", hs: "6105" }).sub, "Product category · HS 6105");
    assert.equal(rowWords({ type: "location", label: "Gazipur", value: "Gazipur", param: ["city", "Gazipur"] }).sub, "Place · City");
    assert.equal(rowWords({ type: "location", label: "Gazipur", value: "Gazipur", param: ["district", "Gazipur"] }).sub, "Place · District");
    assert.equal(rowWords({ type: "recent", label: "knit", href: "/", count: 1 }).sub, "Recent search · 1 supplier");
    assert.equal(rowWords({ type: "recent", label: "knit", href: "/", count: 4645 }).sub, "Recent search · 4,645 suppliers");
    assert.equal(rowWords({ type: "recent", label: "knit", href: "/", count: null }).sub, "Recent search");
    assert.equal(rowWords({ type: "query", label: "knit" }).name, "Search “knit”");
    for (const s of [company, { type: "cert", label: "GOTS certified", value: "GOTS" } as Suggestion]) {
      const { name, sub } = rowWords(s);
      assert.doesNotMatch(`${name} ${sub}`, /@|\+880|score|grade|rating/i);
    }
  });
});
