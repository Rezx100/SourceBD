import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  brandsInCustoms,
  capacityNote,
  customsBuyers,
  revealRows,
  certCheckLine,
  customsBand,
  customsRows,
  formatUsdShort,
  marketRows,
  tidyBuyer,
  type VolzaExports,
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
  parseDay,
  initials,
  placeLabel,
  RSC_STATUS_WORDS,
  rscStatusNeedsLook,
  rscStatusUnmapped,
  rscStatusWords,
  rscTrainingWords,
  sortCerts,
  splitQualifier,
} from "./facts";

const TODAY = new Date("2026-09-18T10:00:00Z");

describe("certificate state (valid · expiring ≤ 90 days · expired; undated is listed, so valid)", () => {
  it("classifies the four states on the day boundaries", () => {
    assert.equal(certState(null, TODAY), "valid", "only OEKO-TEX is undated: its label check lists it without a date");
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
    assert.equal(certStateLabel(oeko), "Listed as valid");
    assert.equal(certChipLabel(oeko), "OEKO-TEX Standard 100 listed as valid");
    assert.equal(certTableLabel(wrap), "WRAP Gold 11 d");
    assert.equal(certTableLabel(gots), "GOTS valid");
    assert.equal(oeko.scheme, "OEKO-TEX Standard 100");
    assert.deepEqual(
      sortCerts([oeko, old, gots, wrap]).map((c) => c.number),
      ["7865", "GOTS-31587", "32597-100", "GOTS-27605"],
    );
    // Cycle 5, finding 12: the sub-line returned on the expiring branch, so an
    // expired certificate vanished from the card whenever another was expiring.
    // Aboni holds both, and the buyer needs to see both.
    assert.equal(certTileSubline([gots, wrap, oeko, old]), "1 expiring in 11 days · 1 expired");
    assert.equal(certTileSubline([gots, wrap]), "1 expiring in 11 days");
    assert.equal(certTileSubline([gots, oeko, old]), "1 expired");
    assert.equal(certTileSubline([gots]), "all valid");
    assert.equal(certTileSubline([]), null);
  });

  it("never invents a scheme name", () => {
    assert.equal(certScheme("sa8000"), "SA8000");
    assert.equal(certScheme("bsci"), "BSCI");
  });
});

describe("a day as a buyer types it (parseDay)", () => {
  it("reads the app's own form, day-first numerals and ISO, and refuses what is not a day", () => {
    for (const [text, iso] of [
      ["15 Nov 2026", "2026-11-15"],
      ["15 November 2026", "2026-11-15"],
      ["1 sept 2027", "2027-09-01"],
      ["15/11/2026", "2026-11-15"],
      ["15.11.2026", "2026-11-15"],
      ["15-11-2026", "2026-11-15"],
      ["2026-11-15", "2026-11-15"],
      [" 5 Jan 2027 ", "2027-01-05"],
      ["31 Nov 2026", null],
      ["11/15/2026", null],
      ["15 Ju 2026", null],
      ["soon", null],
      ["", null],
    ] as const) assert.equal(parseDay(text), iso, text);
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

  it("the qualifier after a name moves to the second line; nothing that is part of the name moves", () => {
    // Real published names (production, 29 Sep 2026; the hand-off's list).
    const cases: [string, string, string | null][] = [
      ["Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)", "Zaheen Knitwears Limited", "Shed - 3, 4, 5, 10, 11, 12, 13 · Building - Security, ETP and Fire Pump"],
      ["Knit Softwear Ltd. (Unit-2)", "Knit Softwear Ltd.", "Unit-2"],
      ["Intramex Knit Wear Ltd. (Unit-2)", "Intramex Knit Wear Ltd.", "Unit-2"],
      ["Maitri Knitting Unit-2", "Maitri Knitting", "Unit-2"],
      ["MG Niche Flair Limited Unit-2", "MG Niche Flair Limited", "Unit-2"],
      ["Aswad Composite Mills Ltd. ( U-2) (Extension)", "Aswad Composite Mills Ltd.", "U-2 · Extension"],
      ["Aswad Composite Mills Ltd.(unit-1)", "Aswad Composite Mills Ltd.", "unit-1"],
      ["Spectra Sweaters Ltd. (Previously Panache Knitted Creations Ltd.)", "Spectra Sweaters Ltd.", "Previously Panache Knitted Creations Ltd."],
      ["MG Shirtex Ltd (Dhakkhin Khan) (Previously THE ROSE GARMENTS DESIGNERS LTD)", "MG Shirtex Ltd", "Dhakkhin Khan · Previously THE ROSE GARMENTS DESIGNERS LTD"],
      ["Rehash Accessories & Sourcing Ltd. (A Sister Concern of Sharif Enterprise)", "Rehash Accessories & Sourcing Ltd.", "A Sister Concern of Sharif Enterprise"],
      ["M/S. Orba Traders (Concern of Orba Bangladesh)", "M/S. Orba Traders", "Concern of Orba Bangladesh"],
      ["Silver Composite Textile Mills Ltd. (Unit-3, Textile)", "Silver Composite Textile Mills Ltd.", "Unit-3, Textile"],
      ["Aboni Knitwear (New Shed)", "Aboni Knitwear", "New Shed"],
      // Part of the name, in the middle, or not balanced: left whole.
      ["Robintex (Bangladesh) Ltd.", "Robintex (Bangladesh) Ltd.", null],
      ["Indochine Apparel (Bangladesh) Limited, Unit 2 Building", "Indochine Apparel (Bangladesh) Limited, Unit 2 Building", null],
      ["D.H. Euro Hi-Tech Co. (BD) Ltd", "D.H. Euro Hi-Tech Co. (BD) Ltd", null],
      ["Sanowara Fashions (Pvt.) Ltd", "Sanowara Fashions (Pvt.) Ltd", null],
      ["Apex Holdings (Bangladesh)", "Apex Holdings (Bangladesh)", null],
      ["Alim Knit (BD)", "Alim Knit (BD)", null],
      ["Sayem Fashions (Pvt.)", "Sayem Fashions (Pvt.)", null],
      ["Aswad Composite Mills Ltd. ( U-2", "Aswad Composite Mills Ltd. ( U-2", null],
      ["Odd Name Ltd) (Unit-2)", "Odd Name Ltd) (Unit-2)", null],
      ["(Unit-2)", "(Unit-2)", null],
      ["Aboni Knitwear Ltd", "Aboni Knitwear Ltd", null],
      ["Unity Fabrics", "Unity Fabrics", null],
    ];
    for (const [name, base, qualifier] of cases) {
      assert.deepEqual(splitQualifier(name), { base, qualifier }, name);
      // Nothing is dropped: every word of the name is in the base or the qualifier.
      const words = (s: string) => s.replace(/[()&,·]/g, " ").split(/\s+/).filter(Boolean);
      assert.deepEqual(words(`${base} ${qualifier ?? ""}`), words(name), `${name} lost a word`);
    }
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

describe("every value the database's enums allow reads as words (cycle 8)", () => {
  // `select unnest(enum_range(null::cert_kind))` — fourteen values; production
  // holds four today, and the other ten were reaching a buyer's chip as the
  // database's own token ("SEDEX_SMETA", "ISO9001", "OTHER").
  const CERT_KINDS = [
    "wrap", "bsci", "sedex_smeta", "oeko_tex", "gots", "grs", "rcs", "bci",
    "fairtrade", "iso9001", "iso14001", "iso45001", "sa8000", "other",
  ];

  // WRAP, GOTS, BSCI, GRS, RCS, OCS, BCI and SA8000 are acronyms, so their
  // label IS the upper-cased token — what must not happen is the *fallback*
  // being reached, which is how "SEDEX_SMETA", "ISO9001" and "OTHER" got out.
  const NAMED: Record<string, string> = {
    wrap: "WRAP", bsci: "BSCI", sedex_smeta: "Sedex SMETA", oeko_tex: "OEKO-TEX", gots: "GOTS",
    grs: "GRS", rcs: "RCS", bci: "Better Cotton", fairtrade: "Fairtrade", iso9001: "ISO 9001",
    iso14001: "ISO 14001", iso45001: "ISO 45001", sa8000: "SA8000", other: "Certificate",
  };

  for (const kind of CERT_KINDS) {
    it(`cert_kind "${kind}" reads as "${NAMED[kind]}"`, () => {
      const label = certScheme(kind);
      assert.equal(label, NAMED[kind]);
      assert.doesNotMatch(label, /_/, `"${kind}" renders as "${label}", which is the column value`);
    });
  }

  it("the enum list is the whole enum, so a new kind cannot slip past unnamed", () => {
    assert.equal(CERT_KINDS.length, 14, "`select unnest(enum_range(null::cert_kind))` returned fourteen on 20 Sep 2026");
    assert.deepEqual(Object.keys(NAMED).sort(), [...CERT_KINDS].sort());
  });

  // `select unnest(enum_range(null::entity_type))` — four values; production
  // holds three.
  for (const [type, words] of [
    ["factory", "Factory"],
    ["buying_house", "Buying house"],
    ["agent", "Agent"],
    ["unknown", "Unknown type"],
  ] as const) {
    it(`entity_type "${type}" reads as "${words}"`, () => assert.equal(entityLabel(type), words));
  }

  it("a value neither enum has still reads as a type, not as a column value", () => {
    assert.equal(entityLabel("trading_house"), "Trading house");
    assert.equal(entityLabel(null), "Unknown type");
    assert.equal(entityLabel(""), "Unknown type");
  });

  // `select scope, count(*) from certifications where kind='oeko_tex' group by 1`
  const OEKO = [
    ["OEKO-TEX STANDARD 100", 2588, "OEKO-TEX Standard 100"],
    ["STeP", 190, "OEKO-TEX STeP"],
    ["MADE IN GREEN", 71, "OEKO-TEX Made In Green"],
    ["ORGANIC COTTON", 60, "OEKO-TEX Organic Cotton"],
    ["ECO PASSPORT", 13, "OEKO-TEX Eco Passport"],
    ["DETOX TO ZERO", 1, "OEKO-TEX Detox To Zero"],
  ] as const;

  for (const [scope, rows, words] of OEKO) {
    it(`OEKO-TEX "${scope}" (${rows} certificates) reads as "${words}"`, () => {
      assert.equal(certScheme("oeko_tex", scope), words);
    });
  }

  it("242 published records hold an OEKO-TEX certificate that is not Standard 100, and none of them reads as a bare OEKO-TEX", () => {
    for (const [scope] of OEKO) assert.notEqual(certScheme("oeko_tex", scope), "OEKO-TEX");
    // With no scope at all there is nothing to name, and the scheme stands.
    assert.equal(certScheme("oeko_tex", null), "OEKO-TEX");
  });
});

describe("a certificate expiring today says today (cycle 8)", () => {
  it("0 days left is 'expires today', 1 is singular, 2 is plural", () => {
    const at = (expires: string) => certChipLabel(certModel({ kind: "wrap", certificate_no: "1", issuer: "WRAP", expires_on: expires, scope: "Gold", document_url: null }, TODAY));
    // Four published certificates expire on the day of the read.
    assert.equal(at("2026-09-18"), "WRAP Gold expires today");
    assert.equal(at("2026-09-19"), "WRAP Gold expires in 1 day");
    assert.equal(at("2026-09-20"), "WRAP Gold expires in 2 days");
    assert.equal(at("2026-09-17"), "WRAP Gold expired 17 Sep 2026");
  });
});

describe("the certificate tile and the chip agree on a certificate expiring today (cycle 9)", () => {
  const cert = (expires: string) => certModel({ kind: "wrap", certificate_no: "1", issuer: "WRAP", expires_on: expires, scope: "Gold", document_url: null }, TODAY);

  it("0 days is 'today' in both, and the counts stay right", () => {
    // Four published certificates expire on the read date. The chip said
    // "expires today" and the tile said "expiring in 0 days" beside it.
    assert.equal(certChipLabel(cert("2026-09-18")), "WRAP Gold expires today");
    assert.equal(certTileSubline([cert("2026-09-18")]), "1 expiring today");
    assert.equal(certTileSubline([cert("2026-09-18"), cert("2026-09-18")]), "2 expiring today");
    assert.equal(certTileSubline([cert("2026-09-19")]), "1 expiring in 1 day");
    assert.equal(certTileSubline([cert("2026-09-25")]), "1 expiring in 7 days");
    // The soonest is the one named, whichever order they arrive in.
    assert.equal(certTileSubline([cert("2026-09-25"), cert("2026-09-18")]), "2 expiring today");
    assert.equal(certTileSubline([cert("2026-09-18"), cert("2026-09-25")]), "2 expiring today");
  });
});

describe("certCheckLine (spec-etl-freshness §3)", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const check = (over: Partial<import("./facts").CertCheck> = {}) => ({
    kind: "gots", certificate_no: "GOTS-1", listing_status: "listed",
    checked_at: "2026-10-06T03:00:00Z", delisted_at: null, ...over,
  });
  const reads = { gots: "2026-10-06T03:10:00Z" };

  it("says when the body last showed it", () => {
    assert.deepEqual(certCheckLine("gots", "2026-12-15", check(), reads, now), { text: "checked with GOTS 6 Oct 2026", caution: false });
  });
  it("an expired certificate the body still lists with nothing newer", () => {
    assert.equal(certCheckLine("gots", "2026-09-03", check(), reads, now)?.text, "GOTS lists no newer certificate (checked 6 Oct 2026)");
    assert.equal(certCheckLine("gots", "2026-09-03", check(), reads, now, true)?.text, "checked with GOTS 6 Oct 2026");
  });
  it("no longer listed, in caution, with what it was", () => {
    assert.deepEqual(certCheckLine("gots", "2026-12-15", check({ listing_status: "no_longer_listed" }), reads, now), {
      text: "GOTS no longer lists it (was valid until 15 Dec 2026)", caution: true,
    });
  });
  it("past the 72-hour SLA it is not re-checked, and says so", () => {
    const stale = certCheckLine("wrap", "2026-12-15", check({ kind: "wrap", checked_at: "2026-06-26T00:00:00Z" }), reads, now);
    assert.deepEqual(stale, { text: "last shown by WRAP 26 Jun 2026 · not re-checked since", caution: true });
  });
  it("OEKO-TEX has no dates: listed on", () => {
    assert.equal(certCheckLine("oeko_tex", null, check({ kind: "oeko_tex" }), {}, now)?.text, "listed by OEKO-TEX on 6 Oct 2026");
  });
  it("nothing for an unread scheme or a certificate with no check", () => {
    assert.equal(certCheckLine("bsci", null, check(), reads, now), null);
    assert.equal(certCheckLine("gots", null, undefined, reads, now), null);
  });
});
describe("customs exports (critique of 11 Oct 2026)", () => {
  it("tidies a buyer to its legal ending or its first number, keeping short words as filed", () => {
    assert.equal(tidyBuyer("THE HADDAD APPAREL GROUP LTD 131 D"), "The Haddad Apparel Group Ltd");
    assert.equal(tidyBuyer("BUGATTI GMBH HANSA STRASSE 55 32049"), "Bugatti GmbH");
    assert.equal(tidyBuyer("GATE A S TEXTILNA 643523 034 0"), "Gate A S Textilna");
    assert.equal(tidyBuyer("TJX UK"), "TJX UK");
    assert.equal(tidyBuyer("Action Service Distributie B V"), "Action Service Distributie B V");
    assert.equal(tidyBuyer("167081 Canada Inc"), "167081 Canada Inc");
    assert.equal(tidyBuyer("SA FASHION TRADING LTD 12"), "SA Fashion Trading Ltd");
    assert.equal(tidyBuyer("  "), null);
  });

  it("states totals in three figures at most", () => {
    assert.equal(formatUsdShort(190_961_493), "US$191m");
    assert.equal(formatUsdShort(21_698_439), "US$21.7m");
    assert.equal(formatUsdShort(4_965_812), "US$4.97m");
    assert.equal(formatUsdShort(999_600), "US$1m");
    assert.equal(formatUsdShort(51_920), "US$52k");
    assert.equal(formatUsdShort(4_900_000), "US$4.9m");
  });

  const base: VolzaExports = { shipments: 9, fob_usd: 58627, buyers: 3, window_start: "2024-09-01", window_end: "2026-08-31", volza_name: null, top_shipments: [], fetched_at: "2026-10-10T20:36:01Z" };
  const top = { shipment_date: "2025-05-18T00:00:00", hsn_code: "62034200", product_description: "GAB CARGO", buyer_name: "CHEEK S A CUYO 3040", destination_country: "Argentina", trade_value_usd: 34203.34, unit_rate_usd: 2.25, unit: "PCS" };

  it("a supplier that ships to one country names it from its stored shipment, and no market rows", () => {
    const v = { ...base, top_record: top, markets: null, summary: { count_of_unique_destination_countries: 1 } };
    assert.equal(customsBand(v).shipsTo, "Argentina");
    assert.deepEqual(marketRows(v), []);
  });

  it("no markets line without the counts, and no date unless the stored shipment is the latest", () => {
    const band = customsBand({ ...base, top_shipments: [top] });
    assert.equal(band.shipsTo, null);
    assert.equal(band.window, "Sep 2024 – Aug 2026");
    assert.ok(!band.figures.some((f) => f.label.includes("latest")), "the biggest shipment's date passed off as the latest");
    assert.ok(customsBand({ ...base, top_record: top, record_sort: "date" }).figures.some((f) => f.value === "18 May 2025" && f.label === "latest shipment on record"));
  });

  it("markets with shipments first, by shipments; a market with none says so", () => {
    const v = { ...base, markets: { "United Kingdom": { shipments: 0, fob_usd: null, buyers: null, top: null }, EU: { shipments: 3, fob_usd: 9000, buyers: 1, top: null }, "United States": { shipments: 6, fob_usd: 40000, buyers: 2, top: null } } };
    assert.deepEqual(marketRows(v).map((r) => [r.label, r.value]), [["United States", "6 shipments · US$40k · 2 buyers"], ["EU", "3 shipments · US$9k · 1 buyer"], ["United Kingdom", "No shipments to the UK"]]);
    assert.equal(customsBand(v).shipsTo, "US, EU");
  });

  it("a product filed mostly in capitals reads in sentence case", () => {
    const v = { ...base, top_record: { ...top, product_description: "MEN'S BASIC T SHIRT (Men's T-Shirt)" } };
    assert.match(customsRows(v).find((r) => r.label === "Biggest shipment")!.note!, /^Men's basic t shirt \(men's t-shirt\) \(HS 6203\.42\) to Cheek S A, Argentina$/);
  });
});

describe("capacityNote: a filed capacity that looks wrong gets one of two plain notes, never a rewrite (11 Oct 2026)", () => {
  // Real figures from the first 73: each register's number and the supplier's own exports.
  const top = { shipment_date: null, hsn_code: null, product_description: null, buyer_name: null, destination_country: null, trade_value_usd: null, unit: "PCS" };
  const exports = (fob: number, rate: number, shipments = 500): VolzaExports => ({
    shipments, fob_usd: fob, buyers: 10, window_start: "2024-09-01", window_end: "2026-08-31", volza_name: null,
    top_shipments: [], top_record: { ...top, unit_rate_usd: rate }, fetched_at: "2026-10-10T20:36:01Z",
  });
  const cap = (day: number | null, dozen: number | null) => ({ production_capacity_pcs_day: day, production_capacity_dozen_yearly: dozen });
  const ASK = "Filed figures look inconsistent; confirm with the supplier";

  it("exports well over the filed figure: RAM Apparel ships about 14 times its 25,000 dozen", () => {
    assert.equal(capacityNote(cap(null, 25000), exports(64369118, 7.77)), "Exports suggest more than this");
  });
  it("a filed figure far above exports: Hamza Clothing's 20,000,000 dozen a year", () => {
    assert.equal(capacityNote(cap(null, 20000000), exports(21698440, 1.72)), ASK);
    // A handful of shipments says too little; the size check alone still catches this one.
    assert.equal(capacityNote(cap(null, 2000000), exports(21698440, 1.72, 12)), null);
  });
  it("exports that fit the larger figure: no note (Moon Readywears' daily figure fits)", () => {
    assert.equal(capacityNote(cap(15000, null), exports(41243211, 4.02)), null);
  });
  it("the registers' own figures checked against each other, with or without exports", () => {
    assert.equal(capacityNote(cap(15000, 90000), null), ASK, "Moon Readywears: 4.5m pieces a day's worth against 1.1m");
    assert.equal(capacityNote(cap(8000, 8000), null), ASK, "the same number per day and per year");
    assert.equal(capacityNote(cap(7000, 2120000), null), ASK, "a year of pieces filed as dozens");
    assert.equal(capacityNote(cap(10000, 250000), null), null, "10,000 a day and 250,000 dozen a year are the same 3 million pieces");
  });
  it("more than one factory makes; nothing filed, nothing said; only pieces compared", () => {
    assert.equal(capacityNote(cap(null, 15000000), null), ASK);
    assert.equal(capacityNote(cap(1000000, null), null), null, "Aboni's 1,000,000 a day is at the line, not over it");
    assert.equal(capacityNote(cap(null, null), exports(64369118, 7.77)), null);
    const kilos = { ...exports(64369118, 7.77), top_record: { ...top, unit: "KGS", unit_rate_usd: 7.77 } };
    assert.equal(capacityNote(cap(null, 25000), kilos), null);
  });
});

describe("customs buyers sit beside the brands' own lists, never in place of them (11 Oct 2026)", () => {
  const ship = (buyer: string | null) => ({ shipment_date: null, hsn_code: null, product_description: null, buyer_name: buyer, destination_country: null, trade_value_usd: null, unit_rate_usd: null, unit: "PCS" });
  const v = (buyers: (string | null)[]): VolzaExports => ({
    shipments: 406, fob_usd: 1, buyers: 43, window_start: "2024-09-01", window_end: "2026-08-31", volza_name: null, fetched_at: "2026-10-10T20:36:01Z",
    top_shipments: [ship(buyers[0] ?? null)], top_record: ship(buyers[0] ?? null),
    markets: { "United Kingdom": { shipments: 5, fob_usd: 1, buyers: 1, top: ship(buyers[1] ?? null) }, EU: { shipments: 5, fob_usd: 1, buyers: 1, top: ship(buyers[2] ?? null) }, Canada: { shipments: 0, fob_usd: null, buyers: null, top: null } },
  });

  it("distinct, tidied buyers from the shipments on file; none for a reader the read refused", () => {
    assert.deepEqual(customsBuyers(v(["THE HADDAD APPAREL GROUP LTD 131 D", "TJX UK", "THE HADDAD APPAREL GROUP LTD 131 D"])), ["The Haddad Apparel Group Ltd", "TJX UK"]);
    assert.deepEqual(customsBuyers(null), []);
  });
  it("a listed brand is marked only when a customs buyer names it, strictly", () => {
    const agreed = brandsInCustoms(["H&M", "NEXT", "Primark"], v(["H & M HENNES & MAURITZ GBC AB", "NEXT LEVEL APPAREL INC", "PENNEYS DUBLIN"]));
    assert.deepEqual([...agreed].sort(), ["H&M", "Primark"], "Next Level Apparel is not NEXT");
    assert.equal(brandsInCustoms(["H&M"], null).size, 0);
  });
});

describe("the reveal's rows: one order is one row, a price only where the database checked it (12 Oct 2026)", () => {
  const rec = { date: "2026-08-31", product: "BABIES BOYS WOVEN TROUSER", hs_code: "62034200", buyer: "H M HENNES MAURITZ GBC AB", buyer_city: "Stockholm", buyer_country: "", destination: "Netherlands", unit: "PCS", value_usd: 646, weight_kg: 43, unit_price_usd: 3.4 };

  it("adds up the shipments of one order and keeps another day, buyer, country or product apart", () => {
    const rows = revealRows([rec, { ...rec, destination: "Spain" }, { ...rec, buyer: "h m hennes  mauritz gbc ab", value_usd: 1906, weight_kg: 127 }, { ...rec, date: "2026-08-30" }, { ...rec, product: "Babies girls woven trouser" }]);
    assert.deepEqual(rows.map((r) => [r.shipments, r.value, r.weight]), [[2, "US$2,552", "170 kg"], [1, "US$646", "43 kg"], [1, "US$646", "43 kg"], [1, "US$646", "43 kg"]]);
    assert.equal(rows[0]!.buyerTo, "H M Hennes Mauritz GBC AB, Stockholm · Netherlands");
    assert.equal(rows[0]!.pieces, "About 751 pcs at US$3.40 a piece");
  });

  it("prints no quantity when any shipment in the row has no checked price, and no city that was not filed", () => {
    const rows = revealRows([rec, { ...rec, unit_price_usd: null }, { ...rec, date: "2026-08-29", buyer_city: "Not Available", unit_price_usd: undefined, value_usd: null, weight_kg: null }]);
    assert.deepEqual(rows.map((r) => [r.shipments, r.pieces, r.value, r.weight]), [[2, null, "US$1,292", "86 kg"], [1, null, null, null]]);
    assert.equal(rows[1]!.buyerTo, "H M Hennes Mauritz GBC AB · Netherlands");
  });
});
