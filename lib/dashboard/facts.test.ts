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
  RSC_STATUS_WORDS,
  rscStatusNeedsLook,
  rscStatusUnmapped,
  rscStatusWords,
  rscTrainingWords,
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
    // Cycle 5, finding 12: the sub-line returned on the expiring branch, so an
    // expired certificate vanished from the card whenever another was expiring.
    // Aboni holds both, and the buyer needs to see both.
    assert.equal(certTileSubline([gots, wrap, oeko, old]), "1 expiring in 11 days · 1 expired · 1 no expiry");
    assert.equal(certTileSubline([gots, wrap]), "1 expiring in 11 days");
    assert.equal(certTileSubline([gots, oeko, old]), "1 expired · 1 no expiry");
    assert.equal(certTileSubline([gots]), "all valid");
    assert.equal(certTileSubline([]), null);
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
    // Cycle 6: "CO." is Company, not a region code, and the keep-upper list had
    // it — the register's own spelling shouted back at the buyer mid-name.
    assert.equal(displayName("D.H. EURO HI-TECH CO. (BD) LTD."), "D.H. Euro Hi-Tech Co. (BD) Ltd");
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

  // Cycle 6: the spellings are not a guess. `select remediation_status,
  // count(*) from rsc_remediation where active group by 1` returned exactly
  // these five on 19 Sep 2026 — one of them differing from another only by
  // case and a space, which is why the mapping strips both before matching.
  const STORED_REMEDIATION: [string, number, string][] = [
    ["behindschedule", 907, "behind schedule"],
    ["initialcompleted", 638, "initial plan completed"],
    ["ontrack", 38, "on track"],
    ["notfinalized", 36, "not finalised"],
    ["Behind schedule", 1, "behind schedule"],
  ];

  for (const [stored, rows, words] of STORED_REMEDIATION) {
    it(`RSC remediation "${stored}" (${rows} active rows) reads as "${words}"`, () => {
      assert.equal(rscStatusWords(stored), words);
      assert.equal(rscStatusUnmapped(stored), false);
    });
  }

  it("every remediation spelling that needs a buyer's attention is flagged, and the others are not", () => {
    assert.deepEqual(
      STORED_REMEDIATION.filter(([stored]) => rscStatusNeedsLook(stored)).map(([, , words]) => words),
      ["behind schedule", "not finalised", "behind schedule"],
    );
    assert.equal(rscStatusWords(null), null);
    assert.equal(rscStatusWords(""), null);
    // A spelling the mapping has never seen is shown as filed rather than
    // dropped or guessed, and is reported as unmapped so it can be added.
    assert.equal(rscStatusWords("partially remediated"), "partially remediated");
    assert.equal(rscStatusUnmapped("partially remediated"), true);
    assert.deepEqual([...RSC_STATUS_WORDS].sort(), [
      "behind schedule",
      "initial plan completed",
      "not finalised",
      "not implemented",
      "on track",
    ]);
  });

  // `select training_status, count(*) …` returned exactly these four.
  const STORED_TRAINING: [string, number, string][] = [
    ["completed", 923, "training completed"],
    ["yet to start", 461, "training yet to start"],
    ["ongoing", 235, "training ongoing"],
    ["unknown", 1, "training status not on file"],
  ];

  for (const [stored, rows, words] of STORED_TRAINING) {
    it(`RSC training "${stored}" (${rows} active rows) reads as "${words}"`, () => {
      assert.equal(rscTrainingWords(stored), words);
    });
  }
});
