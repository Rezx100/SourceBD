import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupEpbHscodes,
  hsBuyerLabel,
  hsOverviewLede,
} from "./epb-hscode-labels";

describe("hsBuyerLabel", () => {
  it("uses the buyer name for live RMG headings", () => {
    assert.equal(hsBuyerLabel("6109", "T-shirts, singlets and other vests"), "T-shirts");
    assert.equal(hsBuyerLabel("6110", null), "Jerseys, pullovers & cardigans");
    assert.equal(hsBuyerLabel("6203", null), "Men's woven suits & trousers");
  });

  it("falls back to the first clause of the EPB description", () => {
    assert.equal(
      hsBuyerLabel("9999", "Industrial felt, nes"),
      "Industrial felt",
    );
  });
});

describe("groupEpbHscodes", () => {
  it("groups Interstoff-style knit and woven lines for a buyer scan", () => {
    const groups = groupEpbHscodes([
      { code: "6103", description: "Men's or boys' suits", source_url: null },
      { code: "6109", description: "T-shirts", source_url: null },
      { code: "6203", description: "Men's woven suits", source_url: null },
      { code: "6505", description: "Hats", source_url: null },
    ]);
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((i) => i.code)]),
      [
        ["Knit apparel", ["6103", "6109"]],
        ["Woven apparel", ["6203"]],
        ["Headgear", ["6505"]],
      ],
    );
  });
});

describe("hsOverviewLede", () => {
  it("says knit and woven when both chapters are present", () => {
    const groups = groupEpbHscodes([
      { code: "6109", description: null, source_url: null },
      { code: "6205", description: null, source_url: null },
    ]);
    assert.equal(
      hsOverviewLede(groups),
      "EPB lists this company as a knit and woven apparel exporter.",
    );
  });
});
