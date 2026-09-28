// The buyer app's suggestions, in the order a buyer reads them (founder's
// walkthrough, 28 Sep 2026): "shirt" led with a company found through its
// product list. These pin the order and the matching at the function the
// route calls, with the rows the route would feed it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appSuggestions,
  certSuggestions,
  companySuggestions,
  headingSuggestions,
  locationSuggestions,
  placeWords,
  prefixMatch,
  productSuggestions,
  words,
} from "./search-suggest";

describe("matching", () => {
  it("every typed word starts a word of the text", () => {
    assert.equal(prefixMatch("Basic Shirts Ltd.", "bas shi"), true);
    assert.equal(prefixMatch("Basic Shirts Ltd.", "irts"), false);
    assert.equal(prefixMatch("Men's woven shirts", "mens"), true);
  });

  it("a hyphenated word matches as its parts and whole", () => {
    assert.deepEqual(words("Men's T-shirts", true), ["mens", "t", "shirts", "tshirts"]);
    assert.equal(prefixMatch("T-shirts", "shirt"), true);
    assert.equal(prefixMatch("T-shirts", "tshirt"), true);
    assert.equal(prefixMatch("T-shirts", "t-shirt"), true);
  });
});

describe("product categories", () => {
  it("'shirt' names the shirt headings, the most-exported first, and T-shirts among them", () => {
    const hs = headingSuggestions("shirt").map((s) => (s.type === "heading" ? s.hs : ""));
    assert.equal(hs.length, 4);
    for (const code of ["6105", "6205", "6109"]) assert.ok(hs.includes(code), `HS ${code} is offered for "shirt": ${hs.join(", ")}`);
  });

  it("a buyer's own word finds the heading it means", () => {
    assert.ok(headingSuggestions("hoodie").some((s) => s.type === "heading" && s.hs === "6110"));
    assert.ok(headingSuggestions("jeans").some((s) => s.type === "heading" && s.hs === "6203"));
    assert.ok(headingSuggestions("bra").some((s) => s.type === "heading" && s.hs === "6212"));
  });

  it("a longer word that merely starts with a synonym is not that garment", () => {
    for (const word of ["capacity", "teens", "briefing"]) assert.deepEqual(headingSuggestions(word), [], `"${word}" named a category`);
    assert.ok(headingSuggestions("tees").some((s) => s.type === "heading" && s.hs === "6109"), "a plural still finds its heading");
  });

  it("a code typed as a code is that heading first", () => {
    const first = headingSuggestions("6205")[0];
    assert.ok(first && first.type === "heading" && first.hs === "6205");
    assert.deepEqual(headingSuggestions("x"), [], "one letter is not a category");
  });
});

describe("suppliers", () => {
  const rows = [
    { slug: "agami", name: "Agami Fashions Limited", city: "Gazipur", district: "Gazipur" },
    { slug: "basic-shirts", name: "Basic Shirts Ltd.", city: "Gazipur", district: "Gazipur" },
    { slug: "sm", name: "SM Sourcing", city: "Konabari", district: "Gazipur" },
  ];

  it("only a NAME match is suggested — a product-list match is not", () => {
    const out = companySuggestions(rows, "shirt");
    assert.deepEqual(
      out.map((s) => (s.type === "company" ? s.slug : "")),
      ["basic-shirts"],
      "Agami Fashions came first for 'shirt' because its product list said shirts",
    );
  });

  it("a place that is both the city and the district is said once", () => {
    assert.equal(placeWords("Gazipur", "Gazipur"), "Gazipur");
    assert.equal(placeWords("Konabari", "Gazipur"), "Konabari, Gazipur");
    assert.equal(placeWords(null, "Dhaka"), "Dhaka");
    const [s] = companySuggestions(rows, "basic");
    assert.ok(s && s.type === "company" && s.sublabel === "Gazipur");
  });
});

describe("the order of the list", () => {
  it("categories, then products as filed, then certificates and places, then suppliers", () => {
    const out = appSuggestions({
      query: "shirt",
      companies: [{ slug: "basic-shirts", name: "Basic Shirts Ltd.", city: null, district: "Gazipur" }],
      products: ["Shirts", "Polo shirts", "Knit Shirt"],
      districts: [],
      cities: [],
    });
    const kinds = out.map((s) => s.type);
    assert.equal(kinds[0], "heading");
    assert.ok(kinds.indexOf("company") > kinds.lastIndexOf("heading"), "a supplier never leads the list");
    assert.ok(kinds.indexOf("product") > kinds.lastIndexOf("heading"));
  });

  it("a product the headings already name is not repeated", () => {
    const out = productSuggestions(["Men's woven shirts", "Polo shirts"], "shirt", ["Men's woven shirts"]);
    assert.deepEqual(out.map((s) => s.label), ["Polo shirts"]);
  });

  it("certificates by name or by what they stand for; places district first", () => {
    assert.deepEqual(certSuggestions("organic").map((s) => s.label), ["GOTS certified"]);
    const places = locationSuggestions(["Gazipur"], ["Gazipur", "Gazipur Sadar"], "gaz");
    assert.deepEqual(
      places.map((p) => (p.type === "location" ? p.param : null)),
      [
        ["district", "Gazipur"],
        ["city", "Gazipur Sadar"],
      ],
    );
  });
});
