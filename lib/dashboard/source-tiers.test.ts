import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isKnownSource, marksFromTags, publicPage, sourceMark, tierFromSlug, tierWords, topTier } from "./source-tiers";

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
    // `public.sources` spells it ILAB; without the alias the Sources section
    // printed "not in the trust table" over a tier-5 regulator.
    assert.ok(isKnownSource("ILAB"));
    assert.equal(sourceMark("ILAB").tier, 5);
    assert.equal(sourceMark("ILAB").label, "ILAB");
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

// Each was opened on 6 Oct 2026: WRAP answered 404, OEKO-TEX "Profile key has expired", Global Trace
// Base a login, and the GOTS directory "Error loading data" for a supplier it no longer lists.
describe("a stored link that ends nowhere is not a link", () => {
  it("drops WRAP's facility page and OEKO-TEX's keyed profile, and sends a GTB document to the GOTS directory", () => {
    assert.equal(publicPage("https://wrapcompliance.org/certified-facility/7865/"), null);
    assert.equal(publicPage("https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/32597~1wdFVs~O_k6dxb3kavK9_H_E7YoN0nL2CE/"), null);
    assert.equal(publicPage("https://www.global-trace-base.org/SCO039488/certificate-document"), "https://global-standards.org/suppliers/certified-suppliers/details?gtbid=SCO039488");
    assert.equal(publicPage("https://www.bgmea.com.bd/member/71"), "https://www.bgmea.com.bd/member/71");
    assert.equal(publicPage(null), null);
  });

  it("no certifier's mark links: a mark cannot know whether GOTS still lists the supplier", () => {
    assert.equal(sourceMark("WRAP", "https://wrapcompliance.org/certified-facility/7865/").href, null);
    assert.equal(sourceMark("OEKO_TEX", "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~x/").href, null);
    assert.equal(sourceMark("GOTS", "https://www.global-trace-base.org/SCO039488/certificate-document").href, null);
    assert.equal(sourceMark("GOTS", "https://global-standards.org/suppliers/certified-suppliers/details?gtbid=SCO039488").href, null);
    assert.equal(sourceMark("BGMEA", "https://www.bgmea.com.bd/member/71").href, "https://www.bgmea.com.bd/member/71");
    assert.equal(sourceMark("EPB", "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd").href, "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd");
  });
});

describe("tier words", () => {
  it("never calls the RMG Sustainability Council a government register", () => {
    assert.equal(tierWords(1, "RSC"), "Industry-led programme");
    assert.equal(tierWords(1, "rsc"), "Industry-led programme");
    assert.equal(tierWords(1, "EPB"), "Government register");
    assert.equal(tierWords(1), "Government register");
  });
});
