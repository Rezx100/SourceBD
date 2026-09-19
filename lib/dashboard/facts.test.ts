import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  certChipLabel,
  certModel,
  certScheme,
  certState,
  certStateLabel,
  certTableLabel,
  certTileSubline,
  daysUntil,
  displayName,
  entityLabel,
  establishedYearOf,
  formatCount,
  formatDay,
  initials,
  placeLabel,
  rscStatusWords,
  sortCerts,
} from "./facts";

const TODAY = new Date("2026-09-18T10:00:00Z");

describe("certificate state (spec §5: valid · expiring ≤ 90 days · expired · no expiry on file)", () => {
  it("classifies the four states on the day boundaries", () => {
    assert.equal(certState(null, TODAY), "no-expiry");
    assert.equal(certState("2026-09-17", TODAY), "expired");
    assert.equal(certState("2026-09-18", TODAY), "expiring"); // 0 days: still valid today, expiring
    assert.equal(certState("2026-12-17", TODAY), "expiring"); // exactly 90 days
    assert.equal(certState("2026-12-18", TODAY), "valid"); // 91 days
    assert.equal(daysUntil("2026-09-29", TODAY), 11);
  });

  it("reads the real Aboni certificates the way the artifact shows them", () => {
    const gots = certModel(
      { kind: "gots", certificate_no: "GOTS-31587", issuer: "TÜV Rheinland (China) Ltd.", expires_on: "2027-05-12", scope: "Operations: Dyeing, Knitting | Products: Men's apparel", document_url: null },
      TODAY,
    );
    const wrap = certModel(
      { kind: "wrap", certificate_no: "7865", issuer: "WRAP", expires_on: "2026-09-29", scope: "Gold | Industries: Apparel", document_url: null },
      TODAY,
    );
    const oeko = certModel({ kind: "oeko_tex", certificate_no: "32597-100", issuer: "OEKO-TEX", expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: null }, TODAY);
    const old = certModel({ kind: "gots", certificate_no: "GOTS-27605", issuer: "GSCS", expires_on: "2026-04-04", scope: null, document_url: null }, TODAY);
    assert.equal(certChipLabel(gots), "GOTS valid to 12 May 2027");
    assert.equal(certChipLabel(wrap), "WRAP Gold expires in 11 days");
    assert.equal(certChipLabel(old), "GOTS expired 4 Apr 2026");
    assert.equal(certStateLabel(wrap), "Expires 29 Sep 2026 · 11 days");
    assert.equal(certStateLabel(oeko), "No expiry on file");
    assert.equal(certTableLabel(wrap), "WRAP Gold 11 d");
    assert.equal(certTableLabel(gots), "GOTS valid");
    assert.equal(oeko.scheme, "OEKO-TEX Standard 100");
    assert.deepEqual(
      sortCerts([oeko, old, gots, wrap]).map((c) => c.number),
      ["7865", "GOTS-31587", "GOTS-27605", "32597-100"],
    );
    assert.equal(certTileSubline([gots, wrap, oeko, old]), "1 expiring in 11 days");
    assert.equal(certTileSubline([gots, oeko, old]), "1 expired · 1 no expiry");
    assert.equal(certTileSubline([gots]), "all valid");
  });

  it("never invents a scheme name", () => {
    assert.equal(certScheme("sa8000"), "SA8000");
    assert.equal(certScheme("bsci"), "BSCI");
  });
});

describe("plain formatting", () => {
  it("dates, counts, years", () => {
    assert.equal(formatDay("2026-09-18T05:17:33.22837+00:00"), "18 Sep 2026");
    assert.equal(formatDay(null), null);
    assert.equal(formatCount(3314), "3,314");
    assert.equal(formatCount(null), null);
    assert.equal(establishedYearOf("1985"), "1985");
    assert.equal(establishedYearOf(null), null);
  });

  it("names: capitals are re-cased without mangling initials, brackets, hyphens or suffixes; mixed case is verbatim", () => {
    assert.equal(displayName("ABONI KNITWEAR LTD."), "Aboni Knitwear Ltd");
    assert.equal(displayName("S M KNITWEARS LIMITED"), "S M Knitwears Limited");
    assert.equal(displayName("A.R. Fashion"), "A.R. Fashion");
    // Real shapes from the register (ops/plans): initials, brackets, hyphens, units, region codes.
    assert.equal(displayName("G.A.B. LIMITED"), "G.A.B. Limited");
    assert.equal(displayName("A.K.M. KNIT WEAR LTD."), "A.K.M. Knit Wear Ltd");
    assert.equal(displayName("SANOWARA FASHIONS (PVT.) LTD."), "Sanowara Fashions (Pvt.) Ltd");
    assert.equal(displayName("SILVER COMPOSITE TEXTILE MILLS LTD. (UNIT-3, TEXTILE)"), "Silver Composite Textile Mills Ltd. (Unit-3, Textile)");
    assert.equal(displayName("AL-FALAH KNIT GARMENTS LTD."), "Al-Falah Knit Garments Ltd");
    assert.equal(displayName("D.H. EURO HI-TECH CO. (BD) LTD."), "D.H. Euro Hi-Tech CO. (BD) Ltd");
    assert.equal(displayName("UNITED KNITWEAR (PVT)LTD."), "United Knitwear (Pvt)Ltd");
    const zaheen = "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";
    assert.equal(displayName(zaheen), zaheen);
  });

  it("initials, place, type", () => {
    assert.equal(initials("Aboni Knitwear Ltd"), "AK");
    assert.equal(initials("S M Knitwears Limited"), "SM");
    assert.equal(initials("A.R. Fashion"), "AR");
    assert.equal(initials("Zaheen Knitwears Limited (Shed - 3, 4)"), "ZK");
    assert.equal(placeLabel("Dhaka", "Dhaka"), "Dhaka");
    assert.equal(placeLabel("Savar", "Dhaka"), "Savar, Dhaka");
    assert.equal(placeLabel(null, null), null);
    assert.equal(entityLabel("buying_house"), "Buying house");
    assert.equal(entityLabel("unknown"), "Unknown type");
  });

  it("RSC status: five labels from the nine stored spellings", () => {
    assert.equal(rscStatusWords("initialcompleted"), "initial plan completed");
    assert.equal(rscStatusWords("Behind Schedule"), "behind schedule");
    assert.equal(rscStatusWords("On Track"), "on track");
    assert.equal(rscStatusWords(null), null);
  });
});
