import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { marksFromTags, sourceMark, tierFromSlug, topTier } from "./source-tiers";

describe("source rank (spec §2: government > industry bodies > cert bodies > brand lists > foreign regulators)", () => {
  it("ranks every register and brand list the database carries", () => {
    assert.equal(sourceMark("EPB").tier, 1);
    assert.equal(sourceMark("RSC").tier, 1);
    assert.equal(sourceMark("BGMEA").tier, 2);
    assert.equal(sourceMark("BGAPMEA").tier, 2);
    assert.equal(sourceMark("gots").tier, 3);
    assert.equal(sourceMark("OEKO_TEX").tier, 3);
    assert.equal(sourceMark("BRAND_HM").tier, 4);
    assert.equal(sourceMark("UFLPA").tier, 5);
  });

  it("stamps and labels are the artifact's", () => {
    assert.deepEqual(
      ["EPB", "RSC", "BGMEA", "BKMEA", "BGAPMEA", "GOTS", "OEKO_TEX", "WRAP", "BRAND_HM", "BRAND_ASOS", "BRAND_NEXT"].map((c) => sourceMark(c).mark),
      ["EP", "RS", "BG", "BK", "BA", "GO", "OT", "WR", "HM", "AS", "NX"],
    );
    assert.equal(sourceMark("BRAND_HM").label, "H&M");
    assert.equal(sourceMark("OEKO_TEX").label, "OEKO-TEX");
    assert.equal(sourceMark("BGMEA").name, "Bangladesh Garment Manufacturers & Exporters Association");
  });

  it("an unknown code can never outrank a mapped one", () => {
    assert.equal(sourceMark("SOMETHING_NEW").tier, 5);
    assert.equal(sourceMark("BRAND_ZARA").tier, 4);
    assert.equal(sourceMark("BRAND_ZARA").label, "Zara");
    assert.equal(tierFromSlug("tier1_gov"), 1);
    assert.equal(tierFromSlug("tier6_crosscheck"), 5);
  });

  it("the mark row: one per source, best rank first, deduplicated across spellings", () => {
    const marks = marksFromTags(["BGMEA", "BGAPMEA", "EPB", "BRAND_ASOS", "WRAP", "GOTS", "BRAND_HM", "BRAND_NEXT", "RSC", "BKMEA", "OEKO_TEX", "oeko-tex"]);
    assert.equal(marks.length, 11);
    assert.deepEqual(
      marks.map((m) => m.mark),
      ["EP", "RS", "BA", "BG", "BK", "GO", "OT", "WR", "AS", "HM", "NX"],
    );
    assert.equal(topTier(["BGMEA"]), 2);
    assert.equal(topTier([]), 5);
  });
});
