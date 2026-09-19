import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCard,
  buildProductSheet,
  buildRfqRow,
  buildSheet,
  buildTableRow,
  certBuildings,
  hasEpbRecord,
  motherRsc,
  ownPill,
  pillBuildings,
  recordPage,
  workersFact,
} from "./build-models";
import {
  aboniInput,
  arFashionInput,
  buildingOnlyCertificateInput,
  buildingRegistrationsInput,
  HOSSAIN_BUILDING,
  inheritedPillsInput,
  LONG_NAME_125,
  MG_BUILDING,
  sanctionedInput,
  smKnitwearInput,
  TODAY,
  ZAHEEN_NAME,
  zaheenSampleInput,
} from "./fixtures";

describe("buildCard — the 11-source record (Aboni)", () => {
  const card = buildCard(aboniInput());

  it("identity: formatted name, initials on the top rank, eleven marks", () => {
    assert.equal(card.name, "Aboni Knitwear Ltd");
    assert.equal(card.initials, "AK");
    assert.equal(card.topTier, 1);
    assert.equal(card.marks.length, 11);
    assert.equal(card.sanctioned, false);
  });

  it("meta: type · place · est. · workers; a mark only where the payload attributes the fact", () => {
    assert.deepEqual(
      card.meta.map((f) => f.text),
      ["Factory", "Dhaka", "Est. 1985", "3,166 workers across 2 of 2 sites"],
    );
    assert.equal(card.meta[3]!.mark?.code, "RSC", "workers come from the RSC display batch");
    assert.equal(card.meta[1]!.mark, null, "city/district are derived fields — no register mark");
    assert.equal(card.meta[0]!.mark, null, "type is not attributed per field by the RPC — no best-guess mark");
    assert.equal(card.meta[2]!.mark, null);
  });

  it("chips are facts in status hues, never a score; expiring soonest first among certificates", () => {
    assert.deepEqual(
      card.chips.map((c) => [c.tone, c.label]),
      [
        ["caution", "WRAP Gold expires in 11 days"],
        ["positive", "GOTS valid to 12 May 2027"],
        ["positive", "RSC active · 100 % remediated"],
        ["neutral", "EPB exporter · 12 lines"],
        ["neutral", "Listed by ASOS, H&M, NEXT"],
      ],
    );
    assert.ok(card.chips.every((c) => !/%\s*match|score|rating|verified/i.test(c.label)));
  });

  it("four tiles with the sub-line into the record", () => {
    assert.deepEqual(
      card.tiles.map((t) => [t.label, t.value, t.sub]),
      [
        ["Certificates", "4 on file", "1 expiring in 11 days · 1 expired · 1 no expiry"],
        ["Export lines", "12 HS lines", "EPB exporter page"],
        ["Listed by", "ASOS, H&M, NEXT", "3 brand lists"],
        ["Registers", "4 registers", "EPB · BGAPMEA · BGMEA · BKMEA"],
      ],
    );
    assert.equal(card.tiles[1]!.href, "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd");
  });

  // Cycle 5, finding 12: `certTileSubline` returned on the expiring branch, so
  // an expired certificate disappeared from the card whenever another was
  // expiring. Aboni holds both.
  it("the certificates sub-line names every state that needs a look, not only the soonest", () => {
    const sub = card.tiles[0]!.sub ?? "";
    assert.match(sub, /1 expiring in 11 days/);
    assert.match(sub, /1 expired/, "an expired certificate may not vanish because another is expiring");
    assert.match(sub, /1 no expiry/);
  });

  // Cycle 5, finding 18: the results panel has no #certificates or #sources of
  // its own; a bare fragment was a link to nothing.
  it("a tile's sub-line link opens the record at that section, never a fragment of the results page", () => {
    for (const t of card.tiles) {
      if (!t.href) continue;
      assert.ok(
        t.href.startsWith("https://") || t.href.startsWith("/app/suppliers/aboni-knitwear#"),
        `${t.label} links to ${t.href}, which is neither a register page nor a section of the record`,
      );
    }
  });

  it("the strip: six rarest lines first, the rest counted", () => {
    assert.equal(card.photos.length, 6);
    assert.equal(card.totalLines, 12);
    assert.equal(card.photos[0]!.hs, "6115"); // socks: 954 exporters, Aboni's rarest line
    assert.ok(card.photos.every((p) => p.src !== null));
    assert.equal(card.why, null);
    assert.equal(card.epbReadDate, "14 Aug 2026");
  });

  it("marks link to the register page the record carries", () => {
    const bg = card.marks.find((m) => m.code === "BGMEA");
    assert.equal(bg?.href, "https://www.bgmea.com.bd/member/71");
    const hm = card.marks.find((m) => m.code === "BRAND_HM");
    assert.equal(hm?.href, "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx", "the list file is the page this record is on");
  });

  // Cycle 5, finding 7: 43 marks promised "opens the register page" and opened
  // an agency front door instead. Aboni's BGAPMEA, BKMEA and RSC pills all
  // carry a homepage and nothing else.
  it("a mark whose only URL is an agency homepage carries no link at all", () => {
    for (const code of ["BGAPMEA", "BKMEA", "RSC"]) {
      assert.equal(card.marks.find((m) => m.code === code)?.href, null, `${code} links to its homepage, which is not this record's page`);
    }
    assert.equal(recordPage("https://bgapmea.org/"), false);
    assert.equal(recordPage("https://www.rsc-bd.org/"), false);
    assert.equal(recordPage("https://www.bkmea.com/"), false);
    assert.equal(recordPage("https://www.bgmea.com.bd/member/71"), true);
    assert.equal(recordPage("https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd"), true);
  });

  it("a failed lines read renders as unknown, never as 'no lines'", () => {
    const c = buildCard({ ...aboniInput(), hscodes: [], hscodesError: true });
    assert.equal(c.linesUnknown, true);
    assert.equal(c.photos.length, 0);
    assert.deepEqual(c.tiles[1], { label: "Export lines", value: null, sub: "EPB could not be read" });
    assert.ok(c.chips.some((x) => x.label === "EPB lines could not be read"));
    assert.ok(!c.chips.some((x) => /Not on the EPB/.test(x.label)));
  });
});

// Cycle 5, finding 8. `production_workers_display_batch` returns one number for
// the whole group. Printed bare under a single RSC mark it reads as this site's
// headcount: Aboni's 3,166 is 2,662 + 504 across two RSC sites, and S M
// Knitwears' 907 belongs to the Extension building while the mother has no RSC
// row at all.
describe("workersFact — a group figure says how many sites it covers", () => {
  it("Aboni: the mother and its shed, reconciled against the batch figure", () => {
    assert.deepEqual(workersFact(aboniInput()), { value: 3166, source: "RSC", coverage: "2 of 2 sites", excluded: [] });
  });

  it("S M Knitwears: the figure is the Extension's, and the mother is named as excluded", () => {
    assert.deepEqual(workersFact(smKnitwearInput()), {
      value: 907,
      source: "RSC",
      coverage: "1 of 2 sites",
      excluded: ["S M Knitwears Limited"],
    });
    assert.equal(buildTableRow(smKnitwearInput()).workersCoverage, "1 of 2 sites");
    const sheet = buildSheet(smKnitwearInput());
    assert.match(sheet.facts.find((f) => f.label === "Workers")!.note ?? "", /1 of 2 sites/);
    assert.match(sheet.facts.find((f) => f.label === "Workers")!.note ?? "", /excluded: S M Knitwears Limited/);
  });

  it("a single-site record claims no coverage, and a record with no figure claims nothing", () => {
    assert.equal(workersFact(zaheenSampleInput()).coverage, null);
    assert.equal(buildCard(zaheenSampleInput()).meta.find((f) => /workers/.test(f.text))?.text, "1,634 workers");
    assert.deepEqual(workersFact(arFashionInput()), { value: null, source: null, coverage: null, excluded: [] });
  });

  it("a batch figure the RSC rows do not reconcile with is shown without a coverage claim", () => {
    const input = aboniInput();
    input.workers = { value: 4000, source: "RSC", fetched_at: null };
    assert.deepEqual(workersFact(input), { value: 4000, source: "RSC", coverage: null, excluded: [] });
  });
});

describe("RSC: the mother's row only, never a building's; every row the RPC returns is active", () => {
  it("S M Knitwears: only the Extension building has an active row, so the mother has no RSC block", () => {
    const input = smKnitwearInput();
    assert.equal(motherRsc(input.profile.rsc_remediation), null);
    const card = buildCard(input);
    assert.ok(!card.chips.some((c) => /RSC active/.test(c.label)), "the building's 53 % must not become the mother's fact");
    assert.ok(card.chips.some((c) => c.tone === "neutral" && c.label === "RSC covers S M Knitwears Limited. (Extension)"));
    const sheet = buildSheet(input);
    assert.equal(sheet.rsc, null);
    assert.deepEqual(sheet.rscBuildings, ["S M Knitwears Limited. (Extension)"]);
    assert.equal(sheet.tabs.find((t) => t.label === "Safety")?.count, null);
  });

  it("a blank remediation status is not a warning", () => {
    const input = aboniInput();
    (input.profile.rsc_remediation as { remediation_status: string | null }[])[0]!.remediation_status = null;
    const card = buildCard(input);
    const chip = card.chips.find((c) => /^RSC/.test(c.label));
    assert.equal(chip?.tone, "positive");
    assert.equal(chip?.label, "RSC active · 100 % remediated");
  });

  // Cycle 4 fix, unguarded until cycle 6: the read date is the RSC row's own
  // `fetched_at`, not the profile's latest read of any register.
  it("the safety read date is the RSC row's own fetch, not the register's latest read", () => {
    assert.equal(buildSheet(aboniInput()).rsc?.readDate, "30 Jul 2026");
    const latest = buildSheet(aboniInput()).readDate;
    assert.equal(latest, "18 Sep 2026", "the profile's latest read is a different day, so the two cannot be confused");
  });

  // Cycle 4 fix, unguarded until cycle 6, plus cycle 5 finding 16: an absent
  // percentage is not 0 %, and `Math.round(undefined)` reached the meter as NaN.
  it("an unknown remediation percentage renders no meter and no NaN", () => {
    const input = aboniInput();
    const rows = input.profile.rsc_remediation as Record<string, unknown>[];
    delete rows[0]!.progress_pct;
    const sheet = buildSheet(input);
    assert.equal(sheet.rsc?.progress, null, "no figure is not 0 %");
    assert.ok(!Number.isNaN(sheet.rsc?.progress as unknown as number));
    const chip = buildCard(input).chips.find((c) => /^RSC/.test(c.label));
    assert.doesNotMatch(chip?.label ?? "", /NaN/);
    assert.equal(chip?.label, "RSC active");
  });

  // The RSC id on the Safety caption must be this record's, not a building's.
  it("the RSC reference is the record's own pill", () => {
    assert.equal(buildSheet(aboniInput()).rsc?.ref, "9342", "23602 belongs to the New Shed");
  });
});

describe("buildCard — the almost-empty record (A.R. Fashion) is quiet, never a warning", () => {
  const card = buildCard(arFashionInput());

  it("one source, one register, everything else '—' with the reason", () => {
    assert.equal(card.marks.length, 1);
    assert.equal(card.topTier, 2);
    assert.deepEqual(
      card.meta.map((f) => [f.text, f.quiet ?? false]),
      [
        ["Buying house", false],
        ["District, year and workers not on file", true],
      ],
    );
    assert.equal(card.epbReadDate, null, "EPB holds no record for this supplier — no read date is claimed");
    assert.deepEqual(
      card.tiles.map((t) => [t.value, t.sub]),
      [
        [null, "none on 4 registers"],
        [null, "not on the EPB list"],
        [null, "not on 4 brand lists read"],
        ["BGMEA 330", "associate member"],
      ],
    );
    assert.equal(card.photos.length, 0);
    assert.equal(card.totalLines, 0);
    assert.ok(card.chips.some((c) => c.tone === "quiet" && c.label === "Nothing else on file · 1 of 25 sources"));
    assert.ok(card.chips.every((c) => c.tone !== "caution" && c.tone !== "sanction"));
  });

  // Cycle 5, finding 13. Six brand lists are configured; Inditex and Primark
  // hold zero companies (SQL, 19 Sep 2026), so "not on 6 brand lists" claims
  // two reads that never happened.
  it("the brand-list negative counts only the lists that hold records", () => {
    assert.equal(card.tiles[2]!.sub, "not on 4 brand lists read");
    const ps = buildProductSheet(arFashionInput(), "6105");
    assert.equal(ps.facts.find((f) => f.label === "Buyer lists")!.checked, "not on 4 brand lists read");
  });
});

// Cycle 5, finding 2. `v_supplier_registry_ids` unions a published parent
// factory's pills onto a published satellite and marks them `inherited_from`.
// Printing them puts another company's register numbers, and links to that
// company's register pages, on this record.
describe("a parent factory's registrations are never printed as the satellite's own", () => {
  const input = inheritedPillsInput();

  it("ownPill rejects an inherited row and keeps the record's own", () => {
    const pills = input.profile.pills;
    assert.equal(ownPill(pills[0]!), true, "the satellite's own RSC pill");
    assert.ok(pills.slice(1).every((x) => ownPill(x) === false));
  });

  it("the card carries one source, no inherited register, and no link to the parent's pages", () => {
    const card = buildCard(input);
    assert.deepEqual(card.marks.map((m) => m.code), ["RSC"]);
    assert.equal(card.tiles[3]!.value, null, "the parent's BGMEA and EPB numbers are not this record's registers");
    assert.match(card.tiles[3]!.sub ?? "", /^not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB/);
    const json = JSON.stringify(card);
    for (const leak of ["6077", "BD05954", "GOTS-28029", "37940-100", "bgmea.com.bd/member/54", "exporter/313"]) {
      assert.ok(!json.includes(leak), `the parent's ${leak} reached the card`);
    }
  });

  it("the sheet counts one source and states no EPB registration", () => {
    const sheet = buildSheet(input);
    assert.equal(sheet.sourceCount, 1);
    assert.equal(sheet.facts.find((f) => f.label === "Registers")!.value, null);
    const json = JSON.stringify(sheet);
    for (const leak of ["6077", "BD05954", "GOTS-28029", "37940-100", "member/54", "exporter/313"]) {
      assert.ok(!json.includes(leak), `the parent's ${leak} reached the sheet (the head's register number, the facts panel or a mark)`);
    }
    assert.equal(hasEpbRecord(input.profile), false, "the EPB number belongs to the parent factory");
    assert.equal(sheet.products.onEpb, false);
    assert.equal(sheet.products.exporterHref, null);
  });
});

// Cycle 5, finding 3. A building's registrations and certificates are unioned
// onto the mother with a `building_name`. They are not the record's, but the
// bare negative "not in BGMEA, BKMEA, …" over a payload that carries a BKMEA
// row is a negative the data does not support.
describe("a building's registrations are named, never counted and never denied", () => {
  const input = buildingRegistrationsInput();
  const card = buildCard(input);
  const sheet = buildSheet(input);

  it("pillBuildings and certBuildings name the building the rows belong to", () => {
    assert.deepEqual(pillBuildings(input.profile), [HOSSAIN_BUILDING]);
    assert.deepEqual(certBuildings(input.profile), [HOSSAIN_BUILDING]);
  });

  it("the record counts only its own source, and its own certificate", () => {
    assert.deepEqual(card.marks.map((m) => m.code), ["OEKO_TEX"], "the building's BKMEA and GOTS are not this record's sources");
    assert.deepEqual(sheet.certs.map((c) => c.kind), ["oeko_tex"]);
  });

  it("the Registers negative names the building rather than denying the registration", () => {
    const expected = `not in BGMEA, BKMEA, BGAPMEA, BTMA or EPB; registered under ${HOSSAIN_BUILDING}`;
    assert.equal(card.tiles[3]!.sub, expected);
    assert.equal(sheet.facts.find((f) => f.label === "Registers")!.checked, expected);
  });

  it("the sheet names the building that holds a certificate of its own", () => {
    assert.deepEqual(sheet.certBuildings, [HOSSAIN_BUILDING]);
  });

  // The same class with nothing of the record's own to soften it: MG Niche
  // Flair holds no certificate at all, and its Unit-2 holds the only one.
  it("a record with no certificate of its own names the building that has one, instead of saying none", () => {
    const only = buildingOnlyCertificateInput();
    const card = buildCard(only);
    const sheet2 = buildSheet(only);
    assert.equal(sheet2.certs.length, 0, "a building's certificate is not the record's");
    assert.deepEqual(sheet2.certBuildings, [MG_BUILDING]);
    assert.equal(card.tiles[0]!.sub, `none on this record · ${MG_BUILDING} holds one`);
    assert.equal(buildTableRow(only).certsEmptyReason, `none on this record · ${MG_BUILDING} holds one`);
    assert.notEqual(card.tiles[0]!.sub, "none on 4 registers", "the bare negative stands over a payload that carries a certificate");
    assert.equal(card.meta[0]!.text, "Unknown type", "the third company type spec §5 names");
  });
});

describe("buildCard / buildTableRow — the sanctioned sample keeps the full 100-character name", () => {
  it("is marked sanctioned as a sample, and the name is never shortened", () => {
    const input = zaheenSampleInput();
    const card = buildCard(input);
    const row = buildTableRow(input);
    assert.equal(card.sanctioned, true);
    assert.equal(card.sanctionSample, true);
    assert.equal(card.name.length, ZAHEEN_NAME.length);
    assert.equal(row.name.length, ZAHEEN_NAME.length);
    assert.equal(row.sanctioned, true);
    assert.equal(row.workers, 1634);
    assert.ok(card.chips.some((c) => c.tone === "caution" && /RSC active · 75 % · behind schedule/.test(c.label)));
  });

  // Cycle 5, test-adequacy critic: only the ProductSheet had a fixture whose
  // `is_sanctioned` was genuinely true, so the sample flag was the only thing
  // any test exercised. A production sanction must reach every model.
  it("a production sanction — not the gallery's sample flag — reaches the card, the row and the sheet", () => {
    const input = sanctionedInput();
    assert.equal(input.profile.supplier.is_sanctioned, true);
    assert.equal(input.sanctionSample, undefined);
    for (const model of [buildCard(input), buildTableRow(input), buildSheet(input), buildProductSheet(input, "6105")]) {
      assert.equal(model.sanctioned, true);
      assert.equal(model.sanctionSample, undefined, "a production sanction is never labelled a sample");
    }
  });

  it("a production record is not sanctioned unless the database says so", () => {
    const card = buildCard(aboniInput());
    assert.equal(card.sanctioned, false);
    assert.equal(card.sanctionSample, undefined);
    assert.equal(buildTableRow(aboniInput()).sanctioned, false);
    assert.equal(buildSheet(aboniInput()).sanctioned, false);
    assert.equal(buildProductSheet(aboniInput(), "6105").sanctioned, false);
  });
});

describe("buildSheet — facts panel and contact card", () => {
  const sheet = buildSheet(aboniInput());

  it("tabs carry the real counts in order", () => {
    assert.deepEqual(
      sheet.tabs.map((t) => [t.label, t.count]),
      [
        ["Overview", null],
        ["Products", "12"],
        ["Certificates", "4"],
        ["Safety", "RSC"],
        ["Sources", "11"],
        ["Locations", "9"],
        ["Facilities", null],
        ["RFQs", null],
      ],
    );
  });

  // Cycle 5, finding 18: #sources, #locations, #facilities and #rfqs are not
  // rendered by this sheet, so linking to them sent the reader nowhere.
  it("a tab links only to a section this sheet renders", () => {
    assert.deepEqual(
      sheet.tabs.filter((t) => t.href !== null).map((t) => t.href),
      ["#overview", "#products", "#certificates", "#safety"],
    );
    assert.deepEqual(
      sheet.tabs.filter((t) => t.href === null).map((t) => t.label),
      ["Sources", "Locations", "Facilities", "RFQs"],
    );
  });

  it("every fact row has a value or 'Not on file' with what was checked; a mark only where attributed, else 'source pending'", () => {
    const byLabel = Object.fromEntries(sheet.facts.map((f) => [f.label, f]));
    assert.equal(byLabel["Workers"]!.value, "3,166");
    assert.equal(byLabel["Workers"]!.marks?.[0]?.code, "RSC");
    // The two `factory` rows whose text equals the address shown are BKMEA's;
    // the BGMEA row carries a different address. The builder names the row that
    // matches, not the first one.
    assert.equal(byLabel["Factory address"]!.marks?.[0]?.code, "BKMEA", "the factory row whose text is the address shown names its register");
    assert.equal(byLabel["Capacity, as filed"]!.value, "1,000,000 pcs/day");
    assert.equal(byLabel["Established"]!.pendingSource, true);
    assert.deepEqual(byLabel["Established"]!.marks, []);
    assert.equal(byLabel["Registers"]!.value, "EPB Reg BD04293 · BGAPMEA 597 · BGMEA General 3498 · BKMEA 625 - B/2002");
    assert.equal(byLabel["Registers"]!.marks?.length, 4);
    assert.equal(byLabel["Registers"]!.marks?.[0]?.href, "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd");
    for (const f of sheet.facts) {
      if (f.value !== null) assert.ok((f.marks?.length ?? 0) > 0 || f.pendingSource === true, `${f.label} has a value but neither a mark nor 'source pending'`);
      else assert.ok(f.checked, `${f.label} reads "Not on file" without saying what was checked`);
    }
    assert.ok(!sheet.facts.some((f) => f.label === "Map pin"), "no pin row until the geocode is read (Locations, REZ-C)");
    assert.equal(sheet.tabs.find((t) => t.label === "Locations")?.count, "9", "from the addresses array production returns");
    assert.equal(sheet.tabs.find((t) => t.label === "RFQs")?.count, null, "no RFQ query exists yet — no literal");
  });

  it("the address mark needs a `factory` row whose text is the address shown — never a mailing, inherited or other-register row", () => {
    const byLabel = (i: ReturnType<typeof aboniInput>) => Object.fromEntries(buildSheet(i).facts.map((f) => [f.label, f]));
    const mailingText = aboniInput();
    mailingText.profile.supplier.address_raw = "2B/1, DARUSSALAM ROAD, MIRPUR-1, MIRPUR, DHAKA"; // the BKMEA mailing row's text
    assert.deepEqual(byLabel(mailingText)["Factory address"]!.marks, [], "a mailing row never marks the factory address");
    assert.equal(byLabel(mailingText)["Factory address"]!.pendingSource, true);
    const inherited = aboniInput();
    inherited.profile.addresses = [{ kind: "factory_inherited", address: inherited.profile.supplier.address_raw!, source_code: "BGMEA" }];
    assert.deepEqual(byLabel(inherited)["Factory address"]!.marks, [], "a parent's inherited row never marks the child's address");
    const twoRows = aboniInput();
    twoRows.profile.addresses = [
      { kind: "factory", address: "SOMEWHERE ELSE, GAZIPUR", source_code: "BGMEA" },
      { kind: "factory", address: twoRows.profile.supplier.address_raw!, source_code: "BKMEA" },
    ];
    assert.equal(byLabel(twoRows)["Factory address"]!.marks?.[0]?.code, "BKMEA", "the row whose text matches names the register, not the first row");
  });

  it("capacity filed yearly still renders; supplier-attested MOQ and lead time render when present", () => {
    const input = aboniInput();
    input.profile.supplier.production_capacity_pcs_day = null;
    input.profile.supplier.production_capacity_dozen_yearly = 4000000;
    input.profile.supplier.supplier_moq = 500;
    input.profile.supplier.supplier_lead_time_days = 45;
    const s2 = buildSheet(input);
    assert.equal(s2.facts.find((f) => f.label === "Capacity, as filed")?.value, "4,000,000 dozen/year");
    const ps = buildProductSheet(input, "6105");
    assert.equal(ps.facts.find((f) => f.label === "Price · MOQ · lead time")?.value, "MOQ 500 · lead time 45 days");
  });

  it("the contact card claims only that details are hidden — no kinds, no registers, no value — and no plan unless settings give one", () => {
    assert.equal(sheet.contact.hidden, "Contact details are shown on paid plans.");
    assert.equal(sheet.contact.plan, null);
    assert.equal(buildSheet(aboniInput(), { plan: "Free · public beta" }).contact.plan, "Free · public beta");
    assert.doesNotMatch(JSON.stringify(sheet), /@|\+880/);
  });

  it("safety: the meter, the five links, every report on file for this record", () => {
    assert.equal(sheet.rsc?.progress, 100);
    assert.equal(sheet.rsc?.status, "initial plan completed");
    assert.equal(sheet.rsc?.training, "training completed");
    // Production holds a boiler inspection URL for Aboni. The earlier fixture
    // nulled it and the test asserted "Boiler · not on file" — a fabricated
    // negative about a safety register, deleted with the fixture that carried it.
    assert.deepEqual(
      sheet.rsc?.links.map((l) => [l.label, l.href !== null]),
      [["Fire", true], ["Structural", true], ["Electrical", true], ["Boiler", true], ["CAP", true]],
    );
    assert.equal(sheet.rsc?.ref, "9342");
  });

  it("a missing report is a dashed quiet chip, not a claim that the record is short of one", () => {
    const input = aboniInput();
    (input.profile.rsc_remediation as { boiler_inspection_url: string | null }[])[0]!.boiler_inspection_url = null;
    const links = buildSheet(input).rsc!.links;
    assert.equal(links.find((l) => l.label === "Boiler")?.href, null);
  });

  it("the almost-empty record reads 'Not on file' everywhere with the registers checked", () => {
    const empty = buildSheet(arFashionInput());
    assert.ok(empty.facts.filter((f) => f.value === null).length >= 6);
    assert.equal(empty.rsc, null);
    assert.equal(empty.certs.length, 0);
    assert.equal(empty.products.lines, 0);
    assert.equal(empty.tabs.find((t) => t.label === "Locations")?.count, "1", "production returns one registered address");
  });
});

describe("buildSheet — a record with two EPB registrations (S M Knitwears)", () => {
  it("keeps both EPB numbers and links the exporter caption to the page whose id it names", () => {
    const sheet = buildSheet(smKnitwearInput());
    const registers = sheet.facts.find((f) => f.label === "Registers")!;
    assert.match(registers.value ?? "", /EPB Reg BD04237 · EPB Reg BD05278/);
    assert.equal(sheet.products.exporterHref, "https://edb.epb.gov.bd/exporter/1000/sm-knitwears-limited");
    assert.equal(sheet.products.exporterRef, "1000");
    const card = buildCard(smKnitwearInput());
    assert.equal(card.tiles[3]!.value, "4 registers");
    assert.equal(card.tiles[1]!.href, "https://edb.epb.gov.bd/exporter/1000/sm-knitwears-limited");
  });

  // Cycle 5, finding 11: the stat named one chapter, taken from the rarest
  // heading. S M Knitwears spans 61 and 62, so nine lines went unclaimed.
  it("the products stat names every chapter the lines span", () => {
    assert.deepEqual(buildSheet(smKnitwearInput()).products.chapters, ["61", "62"]);
    assert.deepEqual(buildSheet(aboniInput()).products.chapters, ["61"]);
  });

  // The six certificates of the spec's named record: the fixture had four until
  // it was re-read from production on 19 Sep 2026.
  it("carries the six certificates production holds", () => {
    const sheet = buildSheet(smKnitwearInput());
    assert.equal(sheet.certs.length, 6);
    assert.equal(sheet.tabs.find((t) => t.label === "Certificates")?.count, "6");
    // Sorted the way a buyer needs them: expiring, then valid, then expired,
    // then undated (§5's four states).
    assert.deepEqual(
      sheet.certs.map((c) => [c.number, c.state]),
      [
        ["GOTS-28946", "valid"],
        ["124992", "expired"],
        ["9741-mig", "no-expiry"],
        ["9741-step", "no-expiry"],
        ["9741-organic-cotton", "no-expiry"],
        ["9741-100", "no-expiry"],
      ],
    );
  });
});

describe("buildProductSheet — HS 6105 on the Aboni record", () => {
  const ps = buildProductSheet(aboniInput(), "6105");
  it("heading, photo, other lines, certified scope, and the live exporter count minus this supplier", () => {
    assert.equal(ps.hs, "6105");
    assert.equal(ps.exported, true);
    assert.equal(ps.heading, "Men's or boys' shirts, knitted or crocheted");
    assert.equal(ps.photo.src, "/products/hs/hs-6105.webp");
    const byLabel = Object.fromEntries(ps.facts.map((f) => [f.label, f]));
    assert.equal(byLabel["Other lines"]!.value, "6102 · 6103 · 6104 · 6106 · 6107 · 6108 · 6109 · 6110 · 6111 · 6114 · 6115");
    assert.equal(byLabel["Exporting since"]!.value, null);
    assert.equal(byLabel["Price · MOQ · lead time"]!.value, null);
    assert.equal(byLabel["Product list"]!.pendingSource, true, "the product list is not stamped with a guessed register");
    assert.deepEqual(byLabel["Product list"]!.marks, []);
    assert.equal(ps.otherExporters, 1634);
  });

  // Cycle 5, finding 10: `Certified scope` dropped the `Products:` half — the
  // only part saying what the certificate covers — and cut ten operations to
  // three with nothing to say it had.
  it("the certified scope keeps the products half and counts the operations it did not list", () => {
    const scope = ps.facts.find((f) => f.label === "Certified scope")!;
    assert.equal(scope.value, "GOTS-31587 · dyeing, embroidery, embellishment +8 · products: men's apparel");
    // Cycle 5, finding 21: the badge read "· No expiry on file" for an undated
    // certificate, because the scheme alone was stripped off "GOTS · no expiry".
    assert.equal(scope.badge?.label, "Valid to 12 May 2027");
    const undated = aboniInput();
    undated.profile.certifications = [{ ...undated.profile.certifications[0]!, expires_on: null }];
    const badge = buildProductSheet(undated, "6105").facts.find((f) => f.label === "Certified scope")!.badge;
    assert.equal(badge?.label, "No expiry on file");
    assert.doesNotMatch(badge?.label ?? "", /^\s*·/);
  });

  // Cycle 5, finding 9: the chapter name is the HS nomenclature, not something
  // EPB published about this record, and it was stamped with an EPB mark even
  // for a record on no EPB register at all.
  it("the chapter carries no register mark — it is the nomenclature, not a read", () => {
    const chapter = ps.facts.find((f) => f.label === "Chapter")!;
    assert.deepEqual(chapter.marks, []);
    assert.equal(chapter.note, "HS nomenclature");
    const offRegister = buildProductSheet(arFashionInput(), "6105");
    assert.deepEqual(offRegister.facts.find((f) => f.label === "Chapter")!.marks, []);
  });

  // Cycle 5, test-adequacy critic: every existing call passed "6105", which
  // Aboni does export, so the cycle-4 `exported` guard never ran.
  it("a heading the record does not export claims no exporter page and no exporter count", () => {
    const off = buildProductSheet(aboniInput(), "6205");
    assert.equal(off.exported, false);
    const page = off.facts.find((f) => f.label === "Exporter page")!;
    assert.equal(page.value, null);
    assert.equal(page.href, null);
    assert.deepEqual(page.marks, []);
    assert.equal(page.checked, "this line is not on the record's EPB page");
    assert.equal(off.otherExporters, null, "an exporter count would imply this record is one of them");
  });
});

describe("buildRfqRow — status words derived from the stored row", () => {
  const base = { id: "r1", product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, quote_count: 0, created_at: "2026-09-09T10:00:00Z" } as const;
  it("open + no quote = awaiting reply (never 'overdue' from ship-by); quotes = quoted", () => {
    assert.equal(buildRfqRow({ ...base, status: "open" }, null, TODAY).status.label, "Sent · awaiting reply");
    assert.equal(
      buildRfqRow({ ...base, status: "open", ship_by: "2026-09-01" }, null, TODAY).status.label,
      "Sent · awaiting reply",
      "a passed ship-by date is not a missed reply-by date; overdue needs REZ-D's derived_status",
    );
    assert.equal(buildRfqRow({ ...base, status: "open", quote_count: 2 }, null, TODAY).status.label, "Quoted · 2");
    assert.equal(buildRfqRow({ ...base, status: "accepted" }, null, TODAY).status.label, "Quote accepted");
    assert.equal(buildRfqRow({ ...base, status: "closed" }, null, TODAY).status.tone, "type");
    const row = buildRfqRow({ ...base, status: "open" }, { name: "Quattro Fashion Limited", tier: 2 }, TODAY);
    assert.equal(row.quantity, "100 pcs");
    assert.equal(row.sent, "9 Sep 2026");
    assert.equal(row.supplierInitials, "QF");
    assert.equal(row.hs, null, "no HS code is sniffed out of the free-text title");
    const unresolved = buildRfqRow({ ...base, status: "open", product_title: "6500 pcs of tees" }, null, TODAY);
    assert.equal(unresolved.supplierName, null);
    assert.equal(unresolved.supplierInitials, null);
    assert.equal(unresolved.supplierCount, 1);
  });

  // Cycle 5, finding 1: the RFQ list had no sanction field at all.
  it("a sanctioned target reaches the row; an unresolved or clean one does not claim one", () => {
    assert.equal(buildRfqRow({ ...base, status: "open" }, { name: "X", tier: 2, sanctioned: true }, TODAY).sanctioned, true);
    assert.equal(buildRfqRow({ ...base, status: "open" }, { name: "X", tier: 2 }, TODAY).sanctioned, false);
    assert.equal(buildRfqRow({ ...base, status: "open" }, null, TODAY).sanctioned, false);
  });
});

// Spec §3: the longest name of all is 125 characters and belongs to an
// unpublished record, so `buyer_supplier_profile` (published only) never serves
// it to a buyer surface. What the kit must still guarantee is that the name
// formatter does not cut, re-case or mangle it.
describe("the 125-character name survives the name formatter whole", () => {
  it("is 125 characters and passes through unchanged", async () => {
    const { displayName, initials } = await import("./facts");
    assert.equal(LONG_NAME_125.length, 125);
    assert.equal(displayName(LONG_NAME_125), LONG_NAME_125);
    assert.equal(initials(LONG_NAME_125), "IA");
  });
});
