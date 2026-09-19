import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCard, buildProductSheet, buildRfqRow, buildSheet, buildTableRow, motherRsc } from "./build-models";
import { aboniInput, arFashionInput, smKnitwearInput, TODAY, ZAHEEN_NAME, zaheenSampleInput } from "./fixtures";

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
      ["Factory", "Dhaka", "Est. 1985", "3,166 workers"],
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

  it("four tiles with the sub-line into the sheet", () => {
    assert.deepEqual(
      card.tiles.map((t) => [t.label, t.value, t.sub]),
      [
        ["Certificates", "4 on file", "1 expiring in 11 days"],
        ["Export lines", "12 HS lines", "EPB exporter page"],
        ["Listed by", "ASOS, H&M, NEXT", "3 brand lists"],
        ["Registers", "4 registers", "EPB · BGAPMEA · BGMEA · BKMEA"],
      ],
    );
    assert.equal(card.tiles[1]!.href, "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd");
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
    assert.equal(hm?.href, null, "no page on file → no link, never a made-up one");
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
      [card.marks.length, card.topTier],
      [1, 2],
    );
    assert.deepEqual(
      card.tiles.map((t) => [t.value, t.sub]),
      [
        [null, "none on 4 registers"],
        [null, "not on the EPB list"],
        [null, "not on 6 brand lists"],
        ["BGMEA 330", "associate member"],
      ],
    );
    assert.equal(card.photos.length, 0);
    assert.equal(card.totalLines, 0);
    assert.ok(card.chips.some((c) => c.tone === "quiet" && c.label === "Nothing else on file · 1 of 25 sources"));
    assert.ok(card.chips.every((c) => c.tone !== "caution" && c.tone !== "sanction"));
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

  it("a production record is not sanctioned unless the database says so", () => {
    const card = buildCard(aboniInput());
    assert.equal(card.sanctioned, false);
    assert.equal(card.sanctionSample, undefined);
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
        ["Locations", "2"],
        ["Facilities", null],
        ["RFQs", null],
      ],
    );
  });

  it("every fact row has a value or 'Not on file' with what was checked; a mark only where attributed, else 'source pending'", () => {
    const byLabel = Object.fromEntries(sheet.facts.map((f) => [f.label, f]));
    assert.equal(byLabel["Workers"]!.value, "3,166");
    assert.equal(byLabel["Workers"]!.marks?.[0]?.code, "RSC");
    assert.equal(byLabel["Factory address"]!.marks?.[0]?.code, "BGMEA", "the factory row whose text is the address shown names its register");
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
    assert.equal(sheet.tabs.find((t) => t.label === "Locations")?.count, "2", "from the addresses array");
    assert.equal(sheet.tabs.find((t) => t.label === "RFQs")?.count, null, "no RFQ query exists yet — no literal");
  });

  it("the address mark needs a `factory` row whose text is the address shown — never a mailing, inherited or other-register row", () => {
    const byLabel = (i: ReturnType<typeof aboniInput>) => Object.fromEntries(buildSheet(i).facts.map((f) => [f.label, f]));
    const bkmeaText = aboniInput();
    bkmeaText.profile.supplier.address_raw = "HOUSE 12, ROAD 2, DHAKA"; // the BKMEA mailing row's text
    assert.deepEqual(byLabel(bkmeaText)["Factory address"]!.marks, [], "a mailing row never marks the factory address");
    assert.equal(byLabel(bkmeaText)["Factory address"]!.pendingSource, true);
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

  it("safety: the meter, the five links, a missing boiler report is a dashed quiet chip", () => {
    assert.equal(sheet.rsc?.progress, 100);
    assert.equal(sheet.rsc?.status, "initial plan completed");
    assert.equal(sheet.rsc?.training, "training completed");
    assert.deepEqual(
      sheet.rsc?.links.map((l) => [l.label, l.href !== null]),
      [["Fire", true], ["Structural", true], ["Electrical", true], ["Boiler", false], ["CAP", true]],
    );
    assert.equal(sheet.rsc?.ref, "9342");
  });

  it("the almost-empty record reads 'Not on file' everywhere with the registers checked", () => {
    const empty = buildSheet(arFashionInput());
    assert.ok(empty.facts.filter((f) => f.value === null).length >= 6);
    assert.equal(empty.rsc, null);
    assert.equal(empty.certs.length, 0);
    assert.equal(empty.products.lines, 0);
    assert.equal(empty.tabs.find((t) => t.label === "Locations")?.count, null, "no addresses array in the payload → no count");
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
});

describe("buildProductSheet — HS 6105 on the Aboni record", () => {
  const ps = buildProductSheet(aboniInput(), "6105");
  it("heading, photo, other lines, certified scope, and the live exporter count minus this supplier", () => {
    assert.equal(ps.hs, "6105");
    assert.equal(ps.heading, "Men's or boys' shirts, knitted or crocheted");
    assert.equal(ps.photo.src, "/products/hs/hs-6105.webp");
    const byLabel = Object.fromEntries(ps.facts.map((f) => [f.label, f]));
    assert.equal(byLabel["Other lines"]!.value, "6102 · 6103 · 6104 · 6106 · 6107 · 6108 · 6109 · 6110 · 6111 · 6114 · 6115");
    assert.equal(byLabel["Exporting since"]!.value, null);
    assert.equal(byLabel["Price · MOQ · lead time"]!.value, null);
    assert.match(byLabel["Certified scope"]!.value ?? "", /^GOTS-31587 · dyeing, knitting, manufacturing/);
    assert.equal(byLabel["Certified scope"]!.badge?.label, "Valid to 12 May 2027");
    assert.equal(byLabel["Product list"]!.pendingSource, true, "the product list is not stamped with a guessed register");
    assert.deepEqual(byLabel["Product list"]!.marks, []);
    assert.equal(ps.otherExporters, 1634);
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
});
