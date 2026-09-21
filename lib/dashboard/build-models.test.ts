import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RfqList } from "@/components/dashboard/rfq-list";
import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import type { RfqListModel } from "./models";
import { sourceMark } from "./source-tiers";
import {
  allSourceCodes,
  buildCard,
  buildProductSheet,
  buildRfqRow,
  buildSheet,
  buildTableRow,
  brandListsEmptyWords,
  registerLabel,
  certBuildings,
  hasEpbRecord,
  motherRsc,
  ownPill,
  pillBuildings,
  recordPage,
  workersCoverageWords,
  workersFact,
} from "./build-models";
import type { RecordInput } from "./build-models";
import {
  aboniInput,
  ASWAD_U2_EXT,
  ASWAD_U2,
  longestHsListInput,
  oneRegisterManyNumbersInput,
  SQ_UNIT_3,
  SQ_UNIT_04,
  buildingBrandListsInput,
  arFashionInput,
  buildingSafetyOnlyInput,
  duplicateBrandRowsInput,
  longestProductListInput,
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
      ["Factory", "Dhaka", "Est. 1985", "3,166 workers across 2 sites"],
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
    assert.deepEqual(workersFact(aboniInput()), {
      value: 3166,
      source: "RSC",
      coverage: "2 sites",
      excluded: [],
      excludesRecord: false,
      groupUnknown: false,
    });
  });

  it("S M Knitwears: the figure is the Extension's, and the mother is named as excluded", () => {
    assert.deepEqual(workersFact(smKnitwearInput()), {
      value: 907,
      source: "RSC",
      coverage: "1 of the 2 sites on file",
      excluded: ["S M Knitwears Limited"],
      // The one site the figure leaves out is the record the buyer is reading.
      excludesRecord: true,
      groupUnknown: false,
    });
    assert.equal(buildTableRow(smKnitwearInput()).workersCoverage, "1 of the 2 sites on file, none of them this record");
    const sheet = buildSheet(smKnitwearInput());
    assert.match(sheet.facts.find((f) => f.label === "Workers")!.note ?? "", /1 of the 2 sites on file/);
    assert.match(sheet.facts.find((f) => f.label === "Workers")!.note ?? "", /excluded: S M Knitwears Limited/);
  });

  it("a single-site record claims no coverage, and a record with no figure claims nothing", () => {
    assert.equal(workersFact(zaheenSampleInput()).coverage, null);
    assert.equal(buildCard(zaheenSampleInput()).meta.find((f) => /workers/.test(f.text))?.text, "1,634 workers");
    assert.deepEqual(workersFact(arFashionInput()), {
      value: null,
      source: null,
      coverage: null,
      excluded: [],
      excludesRecord: false,
      groupUnknown: false,
    });
  });

  it("a batch figure the RSC rows do not reconcile with is shown without a coverage claim", () => {
    const input = aboniInput();
    input.workers = { value: 4000, source: "RSC", fetched_at: null };
    // Cycle 6: it was shown bare under an RSC mark, which reads as "RSC says
    // 4,000 for this site". The rows say 3,166 across two sites; what the
    // figure covers is unknown, so the mark comes off and the words say so.
    assert.deepEqual(workersFact(input), {
      value: 4000,
      source: null,
      coverage: null,
      excluded: [],
      excludesRecord: false,
      groupUnknown: true,
    });
    assert.equal(workersCoverageWords(workersFact(input)), "across this record and its buildings");
    const card = buildCard(input);
    assert.equal(card.meta.find((f) => /workers/.test(f.text))?.text, "4,000 workers across this record and its buildings");
    assert.equal(card.meta.find((f) => /workers/.test(f.text))?.mark, null);
  });
});

describe("RSC: the mother's row only, never a building's; every row the RPC returns is active", () => {
  it("S M Knitwears: only the Extension building has an active row, so the mother has no RSC block", () => {
    const input = smKnitwearInput();
    assert.equal(motherRsc(input.profile.rsc_remediation), null);
    const card = buildCard(input);
    assert.ok(!card.chips.some((c) => /RSC active/.test(c.label)), "the building's 53 % must not become the mother's fact");
    // Cycle 6: the chip named the building and then said nothing about it, so
    // the one thing RSC does cover here read as unremediated. It says whose
    // figure it is and then gives it, and 53 % behind schedule is a caution.
    const chip = card.chips.find((c) => /^RSC covers/.test(c.label));
    assert.equal(chip?.label, "RSC covers S M Knitwears Limited. (Extension) · 53 % · behind schedule");
    assert.equal(chip?.tone, "caution");
    const sheet = buildSheet(input);
    assert.equal(sheet.rsc, null);
    assert.deepEqual(sheet.rscBuildings, ["S M Knitwears Limited. (Extension)"]);
    assert.deepEqual(sheet.rscBuildingBlocks.map((b) => [b.name, b.progress, b.status]), [
      ["S M Knitwears Limited. (Extension)", 53, "behind schedule"],
    ]);
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
    assert.equal(latest, "18 May – 18 Sep 2026", "the sheet header is the span of every register's read, not the newest");
    assert.notEqual(latest, "18 Sep 2026", "a maximum is not a property of eleven registers");
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
        ["Motijheel", false],
        ["Year and workers not on file", true],
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
    assert.ok(card.chips.some((c) => c.tone === "quiet" && c.label === "Nothing else on file · 1 of 14 sources read"));
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
        ["Locations", "3"],
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
    // Cycle 9: production returns nine address rows for this record. Counting
    // rows gave 9; counting distinct text gave 7; the registers write the same
    // premises several ways, and `mergeUniqueLocations` — the matcher the
    // production profile's Locations section already uses — finds 3.
    assert.equal((aboniInput().profile.addresses ?? []).length, 9, "the payload still has the duplicate rows this guard is about");
    assert.equal(sheet.tabs.find((t) => t.label === "Locations")?.count, "3", "premises, not rows and not spellings");
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
    // Cycle 8: the four OEKO-TEX certificates all read "OEKO-TEX · no expiry
    // on file", because only Standard 100 of the six OEKO-TEX schemes was
    // named. 242 published records hold one that is not Standard 100.
    assert.deepEqual(
      sheet.certs.map((c) => [c.number, c.state, c.scheme]),
      [
        ["GOTS-28946", "valid", "GOTS"],
        ["124992", "expired", "WRAP Gold"],
        ["9741-mig", "no-expiry", "OEKO-TEX Made In Green"],
        ["9741-organic-cotton", "no-expiry", "OEKO-TEX Organic Cotton"],
        ["9741-100", "no-expiry", "OEKO-TEX Standard 100"],
        ["9741-step", "no-expiry", "OEKO-TEX STeP"],
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
    assert.equal(ps.otherExporters, 1633);
  });

  // Cycle 5, finding 10: `Certified scope` dropped the `Products:` half — the
  // only part saying what the certificate covers — and cut ten operations to
  // three with nothing to say it had.
  it("the certified scope keeps the products half and counts the operations it did not list", () => {
    const scope = ps.facts.find((f) => f.label === "Certified scope")!;
    // Cycle 6: GOTS writes a multi-word operation with a comma inside it
    // ("Embroidery, embellishment"), so splitting on commas invented two
    // operations out of one and the count was wrong in the same breath. The
    // nine real operations on GOTS-31587 are Dyeing; Embroidery, embellishment;
    // Finishing; Knitting; Manufacturing; Packing; Pre-treatment; Printing;
    // Washing, laundering — three shown and six counted.
    // Cycle 8: commas joined the three shown operations, and one of them IS
    // "embroidery, embellishment", so the line showed three and read as four
    // over a scope of nine. A semicolon between items keeps the commas inside
    // them unambiguous; the products half has no such phrase, so it keeps
    // commas.
    assert.equal(scope.value, "GOTS-31587 · dyeing; embroidery, embellishment; finishing +6 · products: men's apparel");
    assert.equal((scope.value?.split(" · ")[1]?.match(/;/g) ?? []).length, 2, "three operations, two separators");
    // The other certificate on the same record carries the longer phrase
    // ("Warehousing, distribution of non-final products") and its own products
    // half, which a comma split would have shredded into three.
    const twin = aboniInput();
    // The same record's second GOTS certificate, read on a day it was still
    // valid (it lapsed on 4 Apr 2026); its ten operations include the phrase.
    twin.profile.certifications = [twin.profile.certifications[1]!];
    twin.today = new Date("2026-03-01T10:00:00Z");
    const twinScope = buildProductSheet(twin, "6105").facts.find((f) => f.label === "Certified scope")!;
    assert.equal(
      twinScope.value,
      "GOTS-27605 · dyeing; embroidery, embellishment; finishing +7 · products: babies' apparel, children's apparel, children's denim apparel +9",
    );
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
  it("open + no quote reads as the enum and the count, never as a reply state; quotes = quoted", () => {
    // `rfq_list` carries no thread and no reply, so nothing in the read
    // supports "awaiting". The label is the enum and the quote count.
    assert.equal(buildRfqRow({ ...base, status: "open" }, null, TODAY).status.label, "Open · no quote yet");
    assert.equal(
      buildRfqRow({ ...base, status: "open", ship_by: "2026-09-01" }, null, TODAY).status.label,
      "Open · no quote yet",
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

// ---------------------------------------------------------------------------
// Cycle 6 guards.
// ---------------------------------------------------------------------------

describe("recordPage: a link is a page about this record, or there is no link", () => {
  // Every URL shape production's `source_url` columns actually hold, sorted
  // into the two answers. A mark's accessible name promises "opens the
  // register page", so a false positive is the screen lying to a screen reader.
  const PAGES = [
    "https://www.bgmea.com.bd/member/71",
    "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd",
    "https://wrapcompliance.org/certified-facility/7865/",
    "https://www.global-trace-base.org/SCO039488/certificate-document",
    "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~1wdI2V~Gc5OsM1AI-9iRdEvDZMRbc_8T2o/",
    "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/12868.pdf",
    "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=9342",
    "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx",
  ];
  const NOT_PAGES = [
    // Front doors: the register, not the record.
    "https://bgapmea.org/",
    "https://www.rsc-bd.org/",
    "https://www.bkmea.com/",
    "https://epb.gov.bd",
    "https://member.bkmea.com",
    "https://global-standard.org",
    "https://www.oeko-tex.com",
    "https://wrapcompliance.org",
    "https://www.bgmea.com.bd",
    // A search form is not a record page even with the record's name in it.
    "https://example.org/search?q=aboni",
    "https://www.bgmea.com.bd/member-search",
    "https://edb.epb.gov.bd/find/2068",
    "https://x.org/directory/3",
    "https://x.org/lookup?id=7",
    // A bulk API listing is a file of everybody, which is what M&S's row is.
    "https://opensupplyhub.org/api/facilities/?contributors=10061&countries=BD&pageSize=50&embed=1&sort_by=name_asc",
    // A named section of the register is not a record either. No production
    // row is this shape today, but the rule decides for every URL the
    // scrapers add next, and a mark that says "opens the register page" must
    // not open a list of everybody.
    "https://www.bgmea.com.bd/members",
    "https://member.bkmea.com/membership/list",
    "https://wrapcompliance.org/certified-facilities",
    "https://services.oeko-tex.com/newoekotex/portal/for-new-website",
    // Not a URL at all, or not one a browser should follow.
    "",
    "bgmea.com.bd/member/71",
    "javascript:alert(1)",
    "ftp://files.example.org/1.pdf",
    "not a url",
  ];

  for (const url of PAGES) it(`is a record page: ${url.slice(0, 60)}`, () => assert.equal(recordPage(url), true));
  for (const url of NOT_PAGES) it(`is not a record page: ${JSON.stringify(url).slice(0, 60)}`, () => assert.equal(recordPage(url), false));

  it("null and undefined are not links", () => {
    assert.equal(recordPage(null), false);
    assert.equal(recordPage(undefined), false);
  });
});

describe("the meta line's negative agrees with itself in number", () => {
  it("one missing fact is singular, two are joined, three are a list", () => {
    const only = (input: RecordInput) => buildCard(input).meta.find((f) => /not on file/.test(f.text))?.text;
    // Adventure Garments files its year and its headcount, and has a district.
    assert.equal(only(longestProductListInput()), undefined);
    const noYear = longestProductListInput();
    noYear.profile.supplier.established_date = null;
    assert.equal(only(noYear), "Year not on file");
    const noYearNoWorkers = longestProductListInput();
    noYearNoWorkers.profile.supplier.established_date = null;
    noYearNoWorkers.profile.supplier.employees_total = null;
    noYearNoWorkers.workers = null;
    assert.equal(only(noYearNoWorkers), "Year and workers not on file");
    // A.R. Fashion has no year and no workers — but its district IS on file,
    // in the BGMEA address row its own payload carries ("… Motijheel, Dhaka").
    // The negative used to name it anyway, over 685 published records whose
    // columns are empty and whose payload holds a sourced address.
    assert.equal(only(arFashionInput()), "Year and workers not on file");
    assert.doesNotMatch(only(arFashionInput()) ?? "", /Districts|years|workerss/);
    const noAddress = arFashionInput();
    noAddress.profile.addresses = [];
    noAddress.profile.supplier.address_raw = null;
    assert.equal(only(noAddress), "District, year and workers not on file", "with nothing anywhere, the negative stands");
  });
});

describe("a record with two numbers at the same register", () => {
  it("S M Knitwears' two EPB registrations are both shown, under one EPB mark", () => {
    const p = smKnitwearInput().profile;
    const epb = p.pills.filter((x) => x.source_code.toUpperCase() === "EPB");
    assert.equal(epb.length, 2, "the fixture no longer carries the two-EPB shape this guard is about");
    const sheet = buildSheet(smKnitwearInput());
    const registers = sheet.facts.find((f) => f.label === "Registers")!;
    for (const pill of epb) assert.ok(registers.value?.includes(pill.value!), `${pill.value} is not on the Registers row`);
    // One square per register, however many numbers it filed.
    const epbMarks = (registers.marks ?? []).filter((m) => m.code === "EPB");
    assert.equal(epbMarks.length, 1, "EPB is stamped once per number instead of once per register");
    // And the card's mark row counts registers, not rows.
    const card = buildCard(smKnitwearInput());
    assert.equal(card.marks.filter((m) => m.code === "EPB").length, 1);
  });

  it("the fact-row marks are deduped and in rank order everywhere they appear", () => {
    for (const input of [aboniInput(), smKnitwearInput(), buildingSafetyOnlyInput(), duplicateBrandRowsInput()]) {
      const sheet = buildSheet(input);
      for (const row of sheet.facts) {
        const codes = (row.marks ?? []).map((m) => m.code);
        assert.deepEqual([...new Set(codes)], codes, `${input.profile.supplier.slug} "${row.label}" stamps a register twice`);
        const tiers = (row.marks ?? []).map((m) => m.tier);
        assert.deepEqual([...tiers].sort((a, b) => a - b), tiers, `${input.profile.supplier.slug} "${row.label}" is out of rank order`);
      }
      const cardCodes = buildCard(input).marks.map((m) => m.code);
      assert.deepEqual([...new Set(cardCodes)], cardCodes, `${input.profile.supplier.slug}'s mark row repeats a register`);
    }
  });
});

// ---------------------------------------------------------------------------
// Cycle 8 guards. The cycle-7 audit ran 263 mutations and 84 survived; these
// pin the classes those survivors reached, and the eight blocking findings.
// ---------------------------------------------------------------------------

describe("a building's brand list is named, never counted and never denied", () => {
  it("SQ Celsius is on no list of its own, and the screens say whose lists those are", () => {
    const input = buildingBrandListsInput();
    const p = input.profile;
    assert.equal((p.brand_attributions ?? []).filter((b) => !b.building_name).length, 0, "the fixture no longer carries the all-buildings shape");
    assert.equal((p.brand_attributions ?? []).length, 4);
    // The bare negative is a negative the payload contradicts. Eight published
    // mothers are in this shape; `brandBuildings` was written for them and
    // wired to nothing until cycle 8.
    const words = brandListsEmptyWords(p);
    assert.equal(words, `not on this record · ${SQ_UNIT_04}, ${SQ_UNIT_3} are listed`);
    assert.doesNotMatch(words, /not on 4 brand lists read/);
    const card = buildCard(input);
    assert.equal(card.tiles.find((t) => t.label === "Listed by")?.sub, words);
    assert.equal(buildSheet(input).products.buyerListsEmpty, words);
    assert.equal(buildProductSheet(input, "6105").facts.find((f) => f.label === "Buyer lists")?.checked, words);
    // And the buildings' rows are still not counted as the record's.
    assert.equal(card.marks.filter((m) => m.code.startsWith("BRAND_")).length, 0);
  });

  it("a record on a list of its own keeps the plain negative, and the mark", () => {
    const input = duplicateBrandRowsInput();
    assert.equal(brandListsEmptyWords(input.profile), "not on 4 brand lists read");
    assert.deepEqual(buildSheet(input).products.buyerLists, ["M&S", "NEXT"]);
  });
});

describe("the sheet's 'every source mark links' claim counts every mark the sheet draws", () => {
  /**
   * Aboni narrowed to the sources whose URL is a record page. RSC, BGAPMEA and
   * BKMEA file only their agency homepage, so on the whole record the claim is
   * correctly withheld — which means the `true` branch was unreachable from
   * any fixture, and the bug lived there. Dropping rows narrows a real
   * payload; nothing is added.
   */
  function everyRegisterHasAPage(): RecordInput {
    const input = aboniInput();
    // RSC, BGAPMEA and BKMEA file only their agency homepage; the three brand
    // lists link to a file of every supplier on the list, which is not a
    // register page however well it resolves.
    const notARecordPage = new Set(["RSC", "BGAPMEA", "BKMEA", "BRAND_ASOS", "BRAND_HM", "BRAND_NEXT"]);
    const p = input.profile;
    p.supplier.source_tags = (p.supplier.source_tags ?? []).filter((t) => !notARecordPage.has(t.toUpperCase()));
    p.pills = p.pills.filter((x) => !notARecordPage.has(x.source_code.toUpperCase()));
    p.provenance = (p.provenance ?? []).filter((x) => !notARecordPage.has(x.source_code.toUpperCase()));
    p.brand_attributions = [];
    p.addresses = [];
    p.rsc_remediation = null;
    return input;
  }

  it("a certificate whose document is a record page links, and is inside the claim", () => {
    const input = everyRegisterHasAPage();
    const sheet = buildSheet(input);
    const certMarks = sheet.certs.map((c) => sourceMark(c.markCode, c.documentUrl));
    assert.ok(certMarks.length >= 4, "the record no longer holds the certificates this guard is about");
    assert.ok(certMarks.every((m) => m.href), "a certificate document that is a record page must link");
    assert.equal(sheet.everyMarkLinks, true, "every mark this sheet draws links, so the claim stands");
  });

  it("one unlinked certificate mark is enough to withdraw the claim", () => {
    const input = everyRegisterHasAPage();
    // Production holds certificates with no document at all — the RPC returns
    // `document_url: null` — and the cert marks were outside the sum, so a
    // sheet like this one claimed every mark links while drawing one that
    // does not. Roughly a thousand published records reach this branch.
    input.profile.certifications = input.profile.certifications.map((c, i) => (i === 2 ? { ...c, document_url: null } : c));
    const sheet = buildSheet(input);
    assert.ok(sheet.certs.some((c) => c.documentUrl === null));
    assert.equal(sheet.everyMarkLinks, false);
  });

  it("the whole Aboni record withholds the claim, because three registers file only a homepage", () => {
    assert.equal(buildSheet(aboniInput()).everyMarkLinks, false);
  });

  it("a brand mark that links to the whole disclosure list withholds it too", () => {
    const input = everyRegisterHasAPage();
    // Put one brand list back: every mark now has an href, and the claim must
    // still be withheld, because "its register page" is not what that link
    // opens — the mark's own accessible name says "opens the disclosure list".
    input.profile.supplier.source_tags = [...(input.profile.supplier.source_tags ?? []), "BRAND_HM"];
    input.profile.brand_attributions = aboniInput().profile.brand_attributions!.filter((b) => b.source_code === "BRAND_HM");
    const sheet = buildSheet(input);
    const hm = sheet.marks.find((m) => m.code === "BRAND_HM")!;
    assert.ok(hm.href, "the file is real evidence and stays reachable");
    assert.equal(hm.opens, "list");
    assert.equal(sheet.everyMarkLinks, false);
  });

  it("a record with no marks at all does not make the claim either", () => {
    const bare = arFashionInput();
    bare.profile.addresses = [];
    bare.profile.pills = [];
    bare.profile.provenance = [];
    bare.profile.supplier.source_tags = [];
    assert.equal(buildSheet(bare).everyMarkLinks, false);
  });
});

describe("a mark is only drawn for a source the record itself holds", () => {
  it("Aswad's workers figure comes from its buildings' RSC rows, so no seventh square contradicts the count of six", () => {
    const input = buildingSafetyOnlyInput();
    assert.ok(!allSourceCodes(input.profile).includes("RSC"), "the record files no RSC registration of its own");
    const sheet = buildSheet(input);
    assert.equal(sheet.sourceCount, 6);
    assert.equal(sheet.marks.length, 6);
    const workers = sheet.facts.find((f) => f.label === "Workers")!;
    assert.equal(workers.value, "6,703");
    assert.deepEqual(workers.marks ?? [], [], "an RSC square here is a seventh source the bar does not count");
    // The words are what attribute it, and they name whose figure it is.
    assert.match(workers.note ?? "", /2 of the 3 sites on file/);
    assert.match(workers.note ?? "", /excluded/);
    // The card agrees with the sheet.
    assert.equal(buildCard(input).meta.find((f) => /workers/.test(f.text))?.mark, null);
  });

  it("Aboni does hold RSC, so its workers figure keeps the square", () => {
    assert.ok(allSourceCodes(aboniInput().profile).includes("RSC"));
    assert.equal(buildSheet(aboniInput()).facts.find((f) => f.label === "Workers")?.marks?.[0]?.code, "RSC");
  });
});

describe("register labels are words, not the register's column heading", () => {
  // The eleven labels `v_supplier_registry_ids_direct` holds, with how many
  // rows carry each (20 Sep 2026). `BTMA Member #SL` reached the screen
  // verbatim on 421 published records, and `OEKO_TEX Cert #` printed the
  // database's underscore, because the cleanup stripped only a trailing "#".
  const LABELS: [string, number, string][] = [
    ["BGAPMEA #", 1243, "BGAPMEA"],
    ["BGMEA Associate member #", 1686, "BGMEA Associate member"],
    ["BGMEA General member #", 4284, "BGMEA General member"],
    ["BKMEA #", 2578, "BKMEA"],
    ["BTMA Member #SL", 527, "BTMA Member"],
    ["EPB Reg #", 2480, "EPB Reg"],
    ["GOTS Cert #", 911, "GOTS Cert"],
    ["OEKO_TEX Cert #", 2923, "OEKO-TEX Cert"],
    ["RSC ID", 2253, "RSC ID"],
    ["SA8000 Cert #", 7, "SA8000 Cert"],
    ["WRAP Cert #", 434, "WRAP Cert"],
  ];

  for (const [stored, rows, words] of LABELS) {
    it(`"${stored}" (${rows} rows) reads as "${words}"`, () => {
      assert.equal(registerLabel(stored), words);
      assert.doesNotMatch(registerLabel(stored), /#|_/, "no register marker or database underscore reaches the screen");
    });
  }

  it("the sheet drops the grade word so the number reads as a number; the card keeps it", () => {
    const sheet = buildSheet(aboniInput());
    assert.match(sheet.facts.find((f) => f.label === "Registers")!.value ?? "", /BGMEA General 3498/);
    assert.equal(buildCard(arFashionInput()).tiles.find((t) => t.label === "Registers")?.sub, "associate member");
  });
});

describe("the factory address is the fullest one the payload holds, and is attributed", () => {
  it("a country-and-district stub gives way to the sourced street it contains", () => {
    // 1,010 published records file `address_raw` as "Bangladesh\nGazipur - 1710"
    // while `addresses[]` carries the street. Both strings are production's.
    const input = buildingRegistrationsInput();
    const stub = input.profile.supplier.address_raw!;
    assert.match(stub, /^Bangladesh/, "the fixture no longer has the stub this guard is about");
    const fact = buildSheet(input).facts.find((f) => f.label === "Factory address")!;
    assert.notEqual(fact.value, stub, "the sheet showed the worse of two real values");
    assert.ok(fact.value!.length > stub.length);
    // And it is now attributed rather than "source pending".
    assert.equal(fact.pendingSource, undefined);
    assert.ok((fact.marks?.length ?? 0) > 0);
  });

  it("an exact match keeps the profile column and its mark, and a record with no sourced row claims no source", () => {
    const aboni = buildSheet(aboniInput()).facts.find((f) => f.label === "Factory address")!;
    assert.equal(aboni.value, aboniInput().profile.supplier.address_raw);
    assert.equal(aboni.marks?.[0]?.code, "BKMEA");
    const zaheen = buildSheet(zaheenSampleInput()).facts.find((f) => f.label === "Factory address")!;
    assert.equal(zaheen.value, null);
  });

  it("a mailing row is never promoted to the factory address", () => {
    const input = buildingRegistrationsInput();
    input.profile.addresses = (input.profile.addresses ?? []).map((a) => ({ ...a, kind: "mailing" }));
    const fact = buildSheet(input).facts.find((f) => f.label === "Factory address")!;
    assert.equal(fact.value, input.profile.supplier.address_raw);
    assert.deepEqual(fact.marks ?? [], []);
  });
});

describe("Locations counts premises, not rows and not spellings", () => {
  // Cycle 8 counted distinct text, which is still a count of the table: the
  // registers write one place several ways ("Kewa, Bakultala, Sreepur, 1744,
  // Gazipur" and "…Sreepur, Gazipur - 1744"), and 79 published records
  // over-count that way. The kit now uses `mergeUniqueLocations`, the matcher
  // the production profile's own Locations section uses, so the tab and that
  // section cannot disagree.
  const CASES: [string, RecordInput, number, number, number][] = [
    ["Aboni", aboniInput(), 9, 7, 3],
    ["S M Knitwears", smKnitwearInput(), 15, 9, 5],
    ["SQ Celsius", buildingBrandListsInput(), 3, 3, 2],
    ["Aswad", buildingSafetyOnlyInput(), 9, 6, 4],
    ["Mahir", oneRegisterManyNumbersInput(), 10, 9, 6],
    ["Plummy", longestHsListInput(), 8, 5, 2],
  ];

  for (const [name, input, rows, distinctText, premises] of CASES) {
    it(`${name}: ${rows} rows, ${distinctText} distinct spellings, ${premises} premises`, () => {
      const addresses = input.profile.addresses ?? [];
      assert.equal(addresses.length, rows);
      assert.equal(new Set(addresses.map((a) => a.address)).size, distinctText, "the payload no longer has the shape this guard is about");
      assert.equal(buildSheet(input).tabs.find((t) => t.label === "Locations")?.count, String(premises));
      assert.ok(premises < distinctText || name === "SQ Celsius", `${name} would over-count if the dedupe were by text`);
    });
  }
});

describe("the RFQ row survives the shapes rfq_list can return", () => {
  const base = { id: "r", product_title: "T", quantity: 1, quantity_unit: "pcs", ship_by: null, created_at: "2026-09-09T10:00:00Z", quote_count: 0 } as const;

  it("a draft with no target says so rather than counting one, or NaN", () => {
    const row = buildRfqRow({ ...base, status: "open", target_supplier_count: 0 }, null, TODAY);
    assert.equal(row.supplierCount, 0);
    const html = renderToStaticMarkup(
      createElement(RfqList, {
        model: { sent: 1, quotes: 0, chips: [], rows: [row], footer: "1–1 of 1", toast: null } as RfqListModel,
      }),
    );
    assert.match(html, /No supplier on this draft/);
    assert.doesNotMatch(html, /NaN/);
    assert.doesNotMatch(html, /0 suppliers/);
  });

  it("a missing count is not a count", () => {
    const row = buildRfqRow({ ...base, status: "open", target_supplier_count: undefined as unknown as number }, null, TODAY);
    assert.equal(row.supplierCount, 0);
    assert.ok(Number.isFinite(row.supplierCount));
  });

  it("each of the four statuses the enum allows reads as its own words", () => {
    const words = (status: "open" | "accepted" | "closed" | "cancelled", quotes = 0) =>
      buildRfqRow({ ...base, status, quote_count: quotes, target_supplier_count: 1 }, null, TODAY).status.label;
    assert.equal(words("open"), "Open · no quote yet");
    assert.equal(words("open", 2), "Quoted · 2");
    assert.equal(words("accepted"), "Quote accepted");
    assert.equal(words("closed"), "Closed");
    assert.equal(words("cancelled"), "Cancelled", "a cancelled RFQ is not a closed one");
  });
});

describe("cycle 9: claims the fixtures did not previously reach", () => {
  it("a certificate whose document is the register's search form is not linked as the certificate", () => {
    // All seven SA8000 certificates in production carry
    // `https://sa-intl.org/sa8000-search/` — the search form `recordPage`
    // rejects by name. The square was correctly unlinked while the link
    // beside it promised the document and delivered a search page.
    const input = aboniInput();
    input.profile.certifications = [{ ...input.profile.certifications[0]!, kind: "sa8000", certificate_no: "23", document_url: "https://sa-intl.org/sa8000-search/" }];
    const sheet = buildSheet(input);
    assert.equal(sheet.certs[0]!.documentUrl, "https://sa-intl.org/sa8000-search/", "the payload still carries it");
    assert.equal(recordPage(sheet.certs[0]!.documentUrl), false);
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: sheet }));
    assert.doesNotMatch(html, /sa8000-search/, "nothing on the sheet opens the register's search form");
    assert.doesNotMatch(html, />Certificate\s*</, "no link promises a certificate document there is none of");
    assert.equal(sheet.everyMarkLinks, false);
  });

  it("the BGMEA grade chip says 'member' once", () => {
    // Every BGMEA label production holds already ends in "member #", and
    // 3,313 published records reach this chip because BGMEA is their only
    // source.
    for (const [name, input, words] of [
      ["A.R. Fashion", arFashionInput(), "BGMEA Associate member"],
      ["MG Niche Flair", buildingOnlyCertificateInput(), "BGMEA General member"],
      ["Adventure Garments", longestProductListInput(), "BGMEA General member"],
    ] as const) {
      const chip = buildCard(input).chips.find((c) => /^BGMEA/.test(c.label));
      assert.equal(chip?.label, words, name);
      assert.doesNotMatch(chip?.label ?? "", /member member/i, name);
    }
  });

  it("a mother covered by two buildings names the worst and counts the rest", () => {
    // 16 published mothers have two or more building RSC rows and none of
    // their own; naming only the behind-schedule one hid that a second
    // building is covered too.
    const input = buildingSafetyOnlyInput();
    assert.equal((input.profile.rsc_remediation as unknown[]).length, 2);
    const chip = buildCard(input).chips.find((c) => /^RSC covers/.test(c.label))!;
    assert.equal(chip.label, `RSC covers ${ASWAD_U2_EXT} +1 · 81 % · behind schedule`);
    assert.equal(chip.tone, "caution");
    // And both buildings still get their own block on the sheet.
    assert.deepEqual(buildSheet(input).rscBuildingBlocks.map((b) => b.name), [ASWAD_U2, ASWAD_U2_EXT]);
  });
});

// ---------------------------------------------------------------------------
// Cycle 10.

describe("the certified scope is whatever certificate carries one, and its absence is never a claim", () => {
  /** The record's certificates, narrowed to the kinds named. */
  function onlyKinds(input: RecordInput, kinds: string[]): RecordInput {
    const keep = new Set(kinds.map((k) => k.toLowerCase()));
    input.profile.certifications = (input.profile.certifications ?? []).filter((c) => keep.has(c.kind.toLowerCase()));
    return input;
  }

  it("a record whose only scope is WRAP's shows WRAP's, not 'no scope certificate'", () => {
    // The scope was read only from GOTS, so 434 published WRAP holders without
    // a live GOTS read "Certified scope — no scope certificate" on a page
    // listing a WRAP certificate whose scope names their products.
    const input = onlyKinds(smKnitwearInput(), ["wrap"]);
    const sheet = buildSheet(input);
    assert.ok(sheet.certs.length > 0, "the record no longer holds the certificates this guard is about");
    assert.ok(sheet.certs.every((c) => c.kind.toUpperCase() !== "GOTS"), "and none of them is a GOTS");
    assert.ok(sheet.products.certifiedScope, "a certificate carrying scope text must supply the scope");
    assert.match(sheet.products.certifiedScope!.scheme, /WRAP/);
    assert.ok(sheet.products.certifiedScope!.scope.length > 0);
  });

  it("an expired scope is shown as expired, not discarded", () => {
    const input = smKnitwearInput();
    input.profile.certifications = (input.profile.certifications ?? []).map((c) =>
      c.kind.toLowerCase() === "gots" ? { ...c, expires_on: "2020-01-01" } : c,
    );
    const scope = buildSheet(onlyKinds(input, ["gots"])).products.certifiedScope;
    assert.ok(scope, "an expired certificate is still the record's scope");
    assert.equal(scope!.state, "expired");
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(onlyKinds(input, ["gots"])) }));
    assert.match(html, /GOTS · expired/, "the sheet says the scope is expired rather than saying there is none");
  });

  it("no scope never claims a register was read and came back empty when the payload holds certificates", () => {
    const input = smKnitwearInput();
    input.profile.certifications = (input.profile.certifications ?? []).map((c) => ({ ...c, scope: null }));
    const sheet = buildSheet(input);
    assert.ok(sheet.certs.length > 0);
    assert.equal(sheet.products.certifiedScope, null);
    assert.equal(sheet.products.certifiedScopeEmpty, "no scope on the certificates on file");
    const ps = buildProductSheet(input, "6105");
    const row = ps.facts.find((f) => f.label === "Certified scope")!;
    assert.equal(row.value, null);
    assert.equal(row.checked, "no scope on the certificates on file");
    assert.notEqual(row.checked, "4 cert registers checked");
  });

  it("a record with no certificate at all keeps the words that name the registers read", () => {
    const sheet = buildSheet(arFashionInput());
    assert.equal(sheet.certs.length, 0);
    assert.equal(sheet.products.certifiedScopeEmpty, "none on 4 registers");
    const row = buildProductSheet(arFashionInput(), "6105").facts.find((f) => f.label === "Certified scope")!;
    assert.equal(row.checked, "none on 4 registers");
  });
});

describe("the factory address and its receipt do not depend on the order the RPC returned its rows", () => {
  /** Every array in the payload, reversed — the cheapest total perturbation. */
  function reversed(input: RecordInput): RecordInput {
    const p = input.profile;
    p.pills = [...p.pills].reverse();
    p.addresses = [...(p.addresses ?? [])].reverse();
    p.provenance = [...(p.provenance ?? [])].reverse();
    p.certifications = [...(p.certifications ?? [])].reverse();
    p.brand_attributions = [...(p.brand_attributions ?? [])].reverse();
    return input;
  }
  const addressFact = (i: RecordInput) => buildSheet(i).facts.find((f) => f.label === "Factory address")!;

  for (const [name, make] of [
    ["Aboni", aboniInput],
    ["S M Knitwears", smKnitwearInput],
    ["Aswad", buildingSafetyOnlyInput],
    ["the country-and-district stub", buildingRegistrationsInput],
  ] as const) {
    it(`${name}: the same address and the same marks either way round`, () => {
      assert.deepEqual(addressFact(make()), addressFact(reversed(make())));
    });
  }

  it("two registers that filed the same premises are both named, rather than one chosen by row order", () => {
    // `rows.find(...)` credited whichever the RPC listed first. The sentence
    // was identical either way and the square — a link to that register's
    // page — flipped, so one of the two was wrong every time.
    const input = aboniInput();
    const raw = input.profile.supplier.address_raw!;
    input.profile.addresses = [
      { kind: "factory", address: raw, source_code: "BKMEA" },
      { kind: "factory", address: raw.toLowerCase(), source_code: "BGMEA" },
    ];
    const fact = addressFact(input);
    assert.equal(fact.value, raw);
    assert.deepEqual(
      fact.marks?.map((m) => m.code),
      ["BGMEA", "BKMEA"],
      "both registers filed it, and the better rank comes first",
    );
    const flipped = aboniInput();
    flipped.profile.addresses = [...input.profile.addresses].reverse();
    assert.deepEqual(addressFact(flipped), fact);
  });

  it("two fuller rows of equal length resolve by rank, not by position", () => {
    const input = buildingRegistrationsInput();
    const raw = input.profile.supplier.address_raw!;
    const a = `${raw}, PLOT 9, KEWA`;
    const b = `${raw}, PLOT 8, KEWA`;
    input.profile.addresses = [
      { kind: "factory", address: b, source_code: "BKMEA" },
      { kind: "factory", address: a, source_code: "EPB" },
    ];
    const fact = addressFact(input);
    // EPB is tier 1 and BKMEA tier 2, so the government row wins whichever way
    // the rows arrive (AGENTS.md 5: the source trust hierarchy is law).
    assert.equal(fact.value, a);
    assert.deepEqual(fact.marks?.map((m) => m.code), ["EPB"]);
    const flipped = buildingRegistrationsInput();
    flipped.profile.addresses = [...input.profile.addresses].reverse();
    assert.deepEqual(addressFact(flipped), fact);
  });
});
