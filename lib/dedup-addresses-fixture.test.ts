import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  cleanAddressString,
  idSetsOverlap,
  mergeUniqueLocations,
  normaliseAddressKey,
  premisesIdentifiers,
  isRenumberAliasRow,
  type AddressRowRaw,
} from "./dedup-addresses";

type FixtureGroup = {
  slug: string;
  company_name: string;
  kind: string;
  rows: AddressRowRaw[];
};

type Fixture = {
  baseline: {
    published_address_rows: number;
    published_suppliers_with_address: number;
    multi_string_groups_by_kind: number;
  };
  groups: FixtureGroup[];
};

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "lib/fixtures/v-supplier-addresses-multi-string.json"), "utf8"),
) as Fixture;

function groupOf(slug: string, kind: string): FixtureGroup {
  const g = fixture.groups.find((x) => x.slug === slug && x.kind === kind);
  assert.ok(g, `missing fixture group ${slug} ${kind}`);
  return g;
}

function visibleKey(address: string): string {
  return address.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("published multi-string fixture", () => {
  it("records the recomputed published baseline", () => {
    assert.equal(fixture.baseline.published_address_rows, 27732);
    assert.equal(fixture.baseline.published_suppliers_with_address, 9921);
    assert.equal(fixture.baseline.multi_string_groups_by_kind, 3274);
    assert.equal(fixture.groups.length, 3274);
  });

  it("merges Habitus Fashion factory to one premises with visible variants", () => {
    const merged = mergeUniqueLocations(groupOf("habitus-fashion", "factory").rows);
    assert.equal(merged.length, 1);
    assert.ok(merged[0]!.variants.length >= 1);
    assert.ok(merged[0]!.variants.every((v) => v.authorities.length > 0));
  });

  it("merges Fakhruddin Textile Mills factory to one premises", () => {
    assert.equal(
      mergeUniqueLocations(groupOf("fakhruddin-textile-mills", "factory").rows).length,
      1,
    );
  });

  it("merges Habitus and Fakhruddin mailing spelling variants to one row each", () => {
    assert.equal(mergeUniqueLocations(groupOf("habitus-fashion", "mailing").rows).length, 1);
    assert.equal(
      mergeUniqueLocations(groupOf("fakhruddin-textile-mills", "mailing").rows).length,
      1,
    );
  });

  it("merges Anwar/Anower Tower and DEPZ FSSFB#2 factory groups", () => {
    assert.equal(mergeUniqueLocations(groupOf("3m-label", "factory").rows).length, 1);
    assert.equal(
      mergeUniqueLocations(groupOf("kaixi-fashion-bangladesh", "factory").rows).length,
      1,
    );
  });

  it("merges zero-padded CEPZ and Uttara holdings that are the same premises", () => {
    for (const [slug, kind] of [
      ["technical-apparels", "factory"],
      ["the-aladin-apparels", "factory"],
      ["maksons-spinning-mills", "mailing"],
      ["earthee-wear", "factory"],
      ["anam-garments", "mailing"],
    ] as const) {
      const n = mergeUniqueLocations(groupOf(slug, kind).rows).length;
      assert.equal(n, 1, `${slug} ${kind} still ${n} locations`);
    }
  });

  it("never merges a pair of source rows whose plot numbers conflict", () => {
    for (const group of fixture.groups) {
      const rows = group.rows;
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = premisesIdentifiers(rows[i]!.address);
          const b = premisesIdentifiers(rows[j]!.address);
          if (a.size === 0 || b.size === 0 || idSetsOverlap(a, b)) continue;
          const merged = mergeUniqueLocations([rows[i]!, rows[j]!]);
          assert.equal(
            merged.length,
            2,
            `${group.slug} ${group.kind} merged conflicting ids ${[...a]} vs ${[...b]}`,
          );
        }
      }
    }
  });

  it("never leaves an unbridged non-overlapping id pair in one location", () => {
    for (const group of fixture.groups) {
      const merged = mergeUniqueLocations(group.rows);
      for (const loc of merged) {
        const rows = loc.source_rows;
        const hinges = rows.filter((row) => isRenumberAliasRow(row.address));
        const hingeIds = hinges.map((row) => premisesIdentifiers(row.address));
        for (let i = 0; i < rows.length; i++) {
          const ia = premisesIdentifiers(rows[i]!.address);
          if (ia.size === 0) continue;
          for (let j = i + 1; j < rows.length; j++) {
            const ib = premisesIdentifiers(rows[j]!.address);
            if (ib.size === 0) continue;
            if (idSetsOverlap(ia, ib)) continue;
            const bridged = hingeIds.some((ih) => idSetsOverlap(ia, ih) && idSetsOverlap(ib, ih));
            assert.ok(
              bridged,
              `${group.slug} ${group.kind} fused unbridged ids at ${loc.displayAddress}`,
            );
          }
        }
      }
    }
  });

  it("does not invent extra locations beyond the distinct strings", () => {
    for (const group of fixture.groups) {
      const strings = new Set(group.rows.map((r) => r.address.trim())).size;
      const n = mergeUniqueLocations(group.rows).length;
      assert.ok(n >= 1 && n <= strings, `${group.slug} ${group.kind}: ${n} locations from ${strings} strings`);
    }
  });

  it("keeps every distinct cleaned spelling visible as the row or an Also recorded as variant", () => {
    for (const group of fixture.groups) {
      const merged = mergeUniqueLocations(group.rows);
      const cleaned = new Set(
        group.rows.map((r) => cleanAddressString(r.address)).filter(Boolean),
      );
      const visible = new Set<string>();
      for (const loc of merged) {
        visible.add(visibleKey(loc.displayAddress));
        for (const variant of loc.variants) visible.add(visibleKey(variant.address));
      }
      for (const spelling of cleaned) {
        assert.ok(
          visible.has(visibleKey(spelling)),
          `${group.slug} ${group.kind} hid spelling: ${spelling}`,
        );
      }
    }
  });

  it("merges named same-premises spelling groups from the remaining-split sweep", () => {
    const expectOne: Array<[string, string]> = [
      ["dream-yard-attires", "mailing"],
      ["cassiopea-fashion", "factory"],
      ["bengal-fine-knitex", "factory"],
      ["fashion-47-bd", "factory"],
      ["gazaria-elastic-industries", "factory"],
      ["jersey-knit-fashion", "factory"],
      ["ma-j-and-j", "factory"],
      ["modern-syntex", "factory"],
      ["mondol-fabrics", "mailing"],
      ["prudent-fashions", "factory"],
      ["safia-apparels", "factory"],
      ["chowdhury-accessories", "factory"],
      ["b2b-excellence", "factory"],
      ["harrods-knitwear", "mailing"],
      ["modish-attires", "factory"],
      ["modish-attires", "mailing"],
      ["best-style-composite", "factory"],
      ["shamser-knit-fashions", "mailing"],
      ["shamser-knit-fashions", "factory"],
      ["sikder-garments-accessories", "factory"],
      ["east-coast-knitwear", "factory"],
      ["asf-fabrics-mills", "mailing"],
      ["mango-knit-composite", "factory"],
      ["mondol-fashions", "mailing"],
      ["sfu-fashion", "factory"],
      ["fin-bangla-apparels", "factory"],
      ["bangladesh-naxis", "registered"],
      ["echoknits", "factory"],
      ["bangladesh-spinners-and-knitters", "factory"],
      ["shiplu-textile-and-spinning-mills", "factory"],
      ["shiplu-textile-and-spinning-mills", "mailing"],
      ["fahad-knit-fashion", "factory"],
      ["mt-sweater", "factory"],
      ["falcon-international-knit-composite", "factory"],
      ["falcon-international-knit-composite", "mailing"],
    ];
    for (const [slug, kind] of expectOne) {
      const n = mergeUniqueLocations(groupOf(slug, kind).rows).length;
      assert.equal(n, 1, `${slug} ${kind} still ${n} locations`);
    }
    assert.equal(mergeUniqueLocations(groupOf("logos-apparels", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("glory-textile-and-apparels", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("prs-apparels", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("rising-knit-textiles", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("tory-fashion-wear", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("zaee-trims", "factory").rows).length, 2);
    assert.equal(mergeUniqueLocations(groupOf("columbia-multi-tech-jv", "registered").rows).length, 2);
    assert.equal(
      mergeUniqueLocations(groupOf("i-and-i-accessories", "factory").rows).length,
      2,
      "Dhaka Chunkutia stays apart from the merged Hathazari South Pahartali factory",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("goumati-knitwear", "factory").rows).length,
      2,
      "BSCIC Shashangaon stays apart from merged Talla Road Khapur/Knanpur",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("tropical-knitex", "factory").rows).length,
      2,
      "Chandra stays apart from Chandona in Kaliakoir",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("zas-apparels", "factory").rows).length,
      2,
      "company name plus postcode stays apart from Shantidhara Bhuigar",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("eslite-garments-bangladesh", "factory").rows).length,
      2,
      "Jamirdia stays apart from Square Masterbari when the village is named on only one side",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("takwoa-accessories", "factory").rows).length,
      2,
      "East Kolmeshwar tower stays apart from a Board Bazar post-office row",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("powertex-fashions", "factory").rows).length,
      2,
      "Mansur Plaza at Board Bazar stays apart from Kathora Industrial Park",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("givensee-garments", "factory").rows).length,
      2,
      "Hotapara stays apart from the merged Bishia/Kuribari/Monipur factory",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("aim-knitwear", "mailing").rows).length,
      2,
      "Shamoli House 1 stays apart from Hajee Delgoni Mohammadpur",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("mukul-printing-and-packaging-industries", "registered").rows)
        .length,
      2,
      "Uttara House 16 Sector 1 stays apart from House 01 Sector 10",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("jm-knitwear", "registered").rows).length,
      2,
      "Banani House 3 stays apart from Hosue 5 Nikunjo",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("ahmed-house-hold-products", "registered").rows).length,
      2,
      "Mirpur Plot I/6 Road37 stays apart from Road 7",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("univogue-garments", "factory").rows).length,
      3,
      "CEPZ Plot 1-5, Plot 57-59, and the Unit-1; Unit-2; … concat stay three rows",
    );
    {
      const group = groupOf("univogue-garments", "factory");
      const uni = mergeUniqueLocations(group.rows);
      const locOf = (needle: RegExp) => {
        const i = uni.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
        assert.ok(i >= 0, `univogue missing ${needle}`);
        return i;
      };
      assert.notEqual(locOf(/Plot # 1-5/), locOf(/Plot#57/), "univogue 1-5 vs 57-59");
      assert.notEqual(locOf(/Unit-1/), locOf(/Plot#57/), "univogue unit-list is not the 57-59 campus");
      assert.notEqual(locOf(/Unit-1/), locOf(/Plot # 1-5/), "univogue unit-list is not the 1-5 campus");
      const concat = uni[locOf(/Unit-1/)]!;
      assert.ok(
        concat.source_rows.some((r) => /Unit-2/.test(r.address) && /Unit-3/.test(r.address)),
        "univogue Unit-2/Unit-3 sit on the concat row",
      );
      assert.ok(
        !uni[locOf(/Plot#57/)]!.source_rows.some((r) => /Unit-2/.test(r.address)),
        "univogue Unit-2 is not the 57-59 campus-only row",
      );
      assert.ok(
        !uni[locOf(/Plot # 1-5/)]!.source_rows.some((r) => /Unit-3/.test(r.address)),
        "univogue Unit-3 is not the 1-5 campus-only row",
      );
    }
    assert.equal(
      mergeUniqueLocations(groupOf("liz-fashion-industries", "factory").rows).length,
      3,
      "Chandora, Chandona and Chandra stay three premises",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("aanytex", "factory").rows).length,
      2,
      "Harirampur stays apart from Baonia on CH Plot 1260",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("blue-planet-knit-composite", "factory").rows).length,
      2,
      "Sreepur stays apart from Sripur at Bartopa",
    );
    {
      const bp = mergeUniqueLocations(groupOf("blue-planet-knit-composite", "factory").rows);
      const locOf = (needle: RegExp) => {
        const i = bp.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
        assert.ok(i >= 0, `blue-planet missing ${needle}`);
        return i;
      };
      assert.notEqual(locOf(/SREEPUR/), locOf(/Sripur/), "blue-planet SREEPUR vs Sripur source rows");
    }
    assert.equal(
      mergeUniqueLocations(groupOf("belkuchi-spinning-mills", "factory").rows).length,
      2,
      "Moishtek Sonargaon stays apart from Mouchak Kaliakoir",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("alif-lam-mim-printing-accessories", "factory").rows).length,
      3,
      "Shubadda, Chunkutia and Bramonkritta stay three premises",
    );
    {
      const lib = mergeUniqueLocations(groupOf("liberty-knitwear", "factory").rows);
      assert.equal(lib.length, 3, `liberty-knitwear factory still ${lib.length}`);
      const locOf = (needle: RegExp) => {
        const i = lib.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
        assert.ok(i >= 0, `liberty missing ${needle}`);
        return i;
      };
      assert.notEqual(locOf(/Pallibyddut/), locOf(/Fatullah PS/), "liberty Chandra vs Ramarbag");
    }
    {
      const lan = mergeUniqueLocations(groupOf("lantabur-apparels", "factory").rows);
      const satra = lan.findIndex((l) =>
        l.source_rows.some((r) => /Satrapara/i.test(r.address)),
      );
      const holding = lan.findIndex((l) =>
        l.source_rows.some((r) => /Holding No\. 574\/1/i.test(r.address)),
      );
      assert.ok(satra >= 0 && holding >= 0, "lantabur missing Satrapara or 574/1");
      assert.notEqual(satra, holding, "lantabur Satrapara is not the Kewa holding");
    }
    assert.equal(
      mergeUniqueLocations(groupOf("satil-knitwear", "factory").rows).length,
      1,
      "Sashongaon vs Enayetnagar on B-329/330 is one Fatullah BSCIC plot",
    );
    assert.equal(
      mergeUniqueLocations(groupOf("texture-knitwear", "factory").rows).length,
      1,
      "A-45 Enayetnagar vs Shasangaon is one Fatullah BSCIC plot",
    );
    {
      const fame = mergeUniqueLocations(groupOf("fame-apparels", "factory").rows);
      const locOf = (needle: RegExp) => {
        const i = fame.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
        assert.ok(i >= 0, `fame missing ${needle}`);
        return i;
      };
      assert.equal(
        locOf(/Shilpanagary/i),
        locOf(/SHASONGAON/),
        "fame B-188 Shilpanagary vs SHASONGAON",
      );
    }
  });

  it("keeps concatenated campuses apart and same-house floor lists together", () => {
    const once = (slug: string, kind: string) => mergeUniqueLocations(groupOf(slug, kind).rows);
    const locOf = (
      merged: ReturnType<typeof mergeUniqueLocations>,
      needle: RegExp,
      label: string,
    ) => {
      const i = merged.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
      assert.ok(i >= 0, `${label} missing ${needle}`);
      return i;
    };
    const campusOutsideConcat = (
      merged: ReturnType<typeof mergeUniqueLocations>,
      campus: RegExp,
      concat: RegExp,
      label: string,
    ) => {
      const campusI = locOf(merged, campus, label);
      const concatI = locOf(merged, concat, `${label} concat`);
      assert.notEqual(campusI, concatI, label);
      assert.ok(
        !merged[concatI]!.source_rows.some((r) => campus.test(r.address)),
        `${label}: campus-only source row must not sit in the concat location`,
      );
    };

    const knit = once("knit-plus", "factory");
    assert.equal(knit.length, 4, `knit-plus factory still ${knit.length}`);
    campusOutsideConcat(
      knit,
      /Jaharchanda, Belma, Ashulia, Dhaka/,
      /DYEING UNIT-JAHAR CHANDA/,
      "knit-plus Jaharchanda-only vs dyeing concat",
    );
    campusOutsideConcat(
      knit,
      /Plot # 2036, Mouchak, Kaliakoir/,
      /DYEING UNIT-JAHAR CHANDA/,
      "knit-plus Mouchak vs dyeing concat",
    );
    assert.notEqual(
      locOf(knit, /Plot # 2036, Mouchak, Kaliakoir/, "knit-plus Mouchak"),
      locOf(knit, /Jaharchanda, Belma, Ashulia, Dhaka/, "knit-plus Jaharchanda"),
      "knit-plus Mouchak vs Jaharchanda",
    );

    const salek = once("salek-textile", "factory");
    campusOutsideConcat(
      salek,
      /Shafipur, Kaliakor/,
      /Rotor Unit:/,
      "salek Shafipur vs rotor/fabric concat",
    );
    campusOutsideConcat(
      salek,
      /Mahana, Bhabanipur/,
      /Rotor Unit:/,
      "salek Bhabanipur vs rotor/fabric concat",
    );

    const rahman = once("rahman-sports-wear", "factory");
    assert.equal(rahman.length, 3, `rahman-sports-wear factory still ${rahman.length}`);
    campusOutsideConcat(
      rahman,
      /Plot # B-369, 370, 371 BSCIC Hosiery Industrial Estate/,
      /EXTENDED ADDRESS/,
      "rahman B-369 vs extended concat",
    );
    campusOutsideConcat(
      rahman,
      /Purbo Keodhala, Madanpur, Bandar, Narayanganj - 1400/,
      /EXTENDED ADDRESS/,
      "rahman OEKO Purbo-only vs extended concat",
    );
    assert.notEqual(
      locOf(rahman, /Plot # B-369, 370, 371 BSCIC Hosiery Industrial Estate/, "rahman B-369"),
      locOf(rahman, /Purbo Keodhala, Madanpur, Bandar, Narayanganj - 1400/, "rahman OEKO Purbo"),
      "rahman B-369 vs Purbo Keodhala",
    );

    const belkuchi = once("belkuchi-spinning-mills", "mailing");
    campusOutsideConcat(
      belkuchi,
      /Rahmat Tower/,
      /Mailing Address:/,
      "belkuchi Dilkusha vs mailing concat",
    );
    campusOutsideConcat(
      belkuchi,
      /Sena Kalyan Bhaban, \(14th floor\)/,
      /Mailing Address:/,
      "belkuchi Motijheel-only vs mailing concat",
    );

    const anowara = once("anowara-fashions", "factory");
    campusOutsideConcat(
      anowara,
      /35\/A Hajiganj Road, Narayanganj - 1400/,
      /AND EXTENDED/,
      "anowara 35/A vs North Hajigonj concat",
    );

    const liberty = once("liberty-knitwear", "factory");
    assert.equal(liberty.length, 3, `liberty-knitwear factory still ${liberty.length}`);
    campusOutsideConcat(
      liberty,
      /Pallibyddut/,
      /NARAYANGANJ & G-88/,
      "liberty Chandra-only vs AND concat",
    );
    campusOutsideConcat(
      liberty,
      /Fatullah PS/,
      /NARAYANGANJ & G-88/,
      "liberty Ramarbag-only vs AND concat",
    );
    assert.notEqual(
      locOf(liberty, /Pallibyddut/, "liberty Chandra"),
      locOf(liberty, /Fatullah PS/, "liberty Ramarbag"),
      "liberty Chandra vs Ramarbag",
    );

    const fashion2000 = once("fashion-2000", "factory");
    assert.equal(
      locOf(fashion2000, /367\/1, Senpara, Parbatta/, "fashion-2000 house"),
      locOf(fashion2000, /GROUND TO 3RD FLOOR/, "fashion-2000 floors"),
      "fashion-2000 same house with floor span",
    );
    const kss = once("kss-knit-composite", "mailing");
    assert.equal(
      locOf(kss, /Mehnaz Mansur Tower, House # 11\/A, Road # 130/, "kss house"),
      locOf(kss, /LEVEL # 6 & 7/, "kss levels"),
      "kss-knit same house with level list",
    );
    const samir = once("samir-spinning-mills", "mailing");
    assert.equal(
      locOf(samir, /Room # 22/, "samir room 22"),
      locOf(samir, /Room No- 22 & 34/, "samir rooms"),
      "samir same house with room list",
    );
    const lantabur = once("lantabur-apparels", "factory");
    assert.equal(
      locOf(lantabur, /Holding # 295/, "lantabur 295"),
      locOf(lantabur, /Holding No\. 574\/1, Kewa Boherarchala, Sreepur/, "lantabur 574/1"),
      "lantabur 295 sits with 574/1",
    );
    assert.notEqual(
      locOf(lantabur, /Holding No\. 574\/1/, "lantabur 574/1"),
      locOf(lantabur, /Satrapara/, "lantabur Satrapara"),
      "lantabur Satrapara is not the Kewa holding",
    );
    const crony = once("crony-tex-sweater", "factory");
    assert.equal(
      locOf(crony, /Block # B, BSCIC I\/E/, "crony block B"),
      locOf(crony, /SHASHONGAON/, "crony shashongaon"),
      "crony Fatullah BSCIC vs SHASHONGAON",
    );
    const alamode = once("alamode-apparels", "factory");
    assert.equal(
      locOf(alamode, /Kalughat/, "alamode kalughat"),
      locOf(alamode, /kalurgaht/, "alamode kalurgaht"),
      "alamode Kalughat vs kalurgaht",
    );
    const arrayFashion = once("array-fashion", "factory");
    assert.notEqual(
      locOf(arrayFashion, /South Bagber/, "array bagber"),
      locOf(arrayFashion, /Shaibrampur/, "array shaibrampur"),
      "array-fashion South Bagber vs Shaibrampur",
    );
    const victory = once("victory-knitting", "factory");
    assert.equal(
      locOf(victory, /Rajul Plot # 24/, "victory rajul"),
      locOf(victory, /RAJUK , PLOT-24/, "victory rajuk"),
      "victory Rajul vs RAJUK",
    );
    const doreen = once("doreen-garments", "factory");
    assert.equal(
      locOf(doreen, /Dakkhin Panishail, N\.K\. Link Road/, "doreen dakkhin"),
      locOf(doreen, /Dhakkin Panishail, Kashempur/, "doreen dhakkin"),
      "doreen Dhakkin Panishail vs Dakkhin Panishail",
    );
    const cottonFair = once("cotton-fair", "factory");
    assert.notEqual(
      locOf(cottonFair, /65\/2, NAYAMATI ROAD/, "cotton 65/2"),
      locOf(cottonFair, /A-65\/66 BSCIC/, "cotton A-65/66"),
      "cotton-fair 65/2 vs A-65/66",
    );
  });

  it("keeps competing villages and Ext/Old concatenations on separate location rows", () => {
    const once = (slug: string, kind: string) => mergeUniqueLocations(groupOf(slug, kind).rows);
    const locOf = (
      merged: ReturnType<typeof mergeUniqueLocations>,
      needle: RegExp,
      label: string,
    ) => {
      const i = merged.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
      assert.ok(i >= 0, `${label} missing ${needle}`);
      return i;
    };

    const beta = once("beta-packaging", "factory");
    assert.equal(beta.length, 4, `beta-packaging factory still ${beta.length}`);
    const kewa = locOf(beta, /Kewa Mouja/, "beta kewa");
    const dhanua = locOf(beta, /Dhanua, Maona/, "beta dhanua");
    const satiabari = locOf(beta, /Satiabari, Rajendrapur/, "beta satiabari");
    assert.notEqual(dhanua, satiabari, "beta Dhanua vs Satiabari");
    assert.notEqual(kewa, dhanua, "beta Kewa vs Dhanua");
    assert.notEqual(kewa, satiabari, "beta Kewa vs Satiabari");
    assert.notEqual(
      locOf(beta, /Mahona, Duptara/, "beta mahona"),
      dhanua,
      "beta Mahona vs Dhanua",
    );
    assert.equal(
      locOf(beta, /Bhangnahati, Sreepur/, "beta bhangnahati"),
      kewa,
      "beta Bhangnahati sits with Kewa Mouja",
    );

    const peakFactory = once("peak-apparels", "factory");
    assert.equal(peakFactory.length, 2, `peak-apparels factory still ${peakFactory.length}`);
    assert.notEqual(
      locOf(peakFactory, /Vogra/, "peak vogra"),
      locOf(peakFactory, /242 SHARIFPUR/, "peak sharifpur"),
      "peak-apparels factory Vogra vs 242 Sharifpur",
    );
    const peakMail = once("peak-apparels", "mailing");
    assert.equal(peakMail.length, 2, "peak-apparels mailing Vogra vs Sharifpur");

    const paxar = once("paxar-bangladesh", "factory");
    assert.equal(paxar.length, 2, `paxar-bangladesh factory still ${paxar.length}`);
    assert.notEqual(
      locOf(paxar, /Plot # 167-169, Dhaka EPZ-Ext\. Area, Savar, Dhaka-1349/, "paxar ext-only"),
      locOf(paxar, /EPZ-Old\. Area/, "paxar concat"),
      "paxar Ext-only vs Ext+Old concat",
    );

    const euro = once("euro-knit-spin-garments", "factory");
    assert.equal(euro.length, 2, `euro-knit-spin-garments factory still ${euro.length}`);
    assert.notEqual(
      locOf(euro, /Nayamati, Kutubpur/, "euro nayamati"),
      locOf(euro, /B-94/, "euro B-94"),
      "euro-knit Nayamati vs B-94 BSCIC",
    );

    const howAreYou = once("how-are-you-textile-industries", "factory");
    assert.equal(howAreYou.length, 2, `how-are-you factory still ${howAreYou.length}`);
    assert.notEqual(
      locOf(howAreYou, /MOUNA \(MASTERBARI\) KEYA/, "how-are-you mouna"),
      locOf(howAreYou, /Plot-2023\(SA\), Gilarchala/, "how-are-you gilarchala"),
      "how-are-you Mouna vs Gilarchala Plot-2023",
    );

    const agami = once("agami-apparels", "factory");
    assert.equal(agami.length, 2, `agami-apparels factory still ${agami.length}`);
    assert.notEqual(
      locOf(agami, /Nayapara, Kathgora/, "agami nayapara"),
      locOf(agami, /Kathgara, Bishmail/, "agami bishmail"),
      "agami Nayapara vs Bishmail/Kathgara",
    );
  });

  it("keeps competing Kewa/Chodhona, Jamirdia/Meherbari, and House 62/82 apart", () => {
    const once = (slug: string, kind: string) => mergeUniqueLocations(groupOf(slug, kind).rows);
    const locOf = (
      merged: ReturnType<typeof mergeUniqueLocations>,
      needle: RegExp,
      label: string,
    ) => {
      const i = merged.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
      assert.ok(i >= 0, `${label} missing ${needle}`);
      return i;
    };

    const siji = once("siji-garments", "factory");
    assert.equal(siji.length, 2, `siji-garments factory still ${siji.length}`);
    assert.notEqual(
      locOf(siji, /Teknog Para, Chodhona/, "siji chodhona"),
      locOf(siji, /Kewa, Sreepur/, "siji kewa"),
      "siji Teknog/Chodhona vs Kewa on plot 47",
    );

    const kamal = once("kamal-yarn", "factory");
    assert.equal(kamal.length, 2, `kamal-yarn factory still ${kamal.length}`);
    assert.notEqual(
      locOf(kamal, /Meherbari/, "kamal meherbari"),
      locOf(kamal, /Jamirdia, Habirbari, P\.S: Valuka/, "kamal jamirdia-only"),
      "kamal-yarn Meherbari concat vs Jamirdia-only",
    );
    assert.ok(
      !kamal[locOf(kamal, /Meherbari/, "kamal concat")]!.source_rows.some((r) =>
        /P\.S: Valuka/.test(r.address),
      ),
      "kamal-yarn campus-only source row must not sit in the concat location",
    );

    const blueBird = once("blue-bird-fashion", "registered");
    assert.equal(blueBird.length, 3, `blue-bird-fashion registered still ${blueBird.length}`);
    assert.notEqual(
      locOf(blueBird, /House # 62 \(1st Floor\), Road # 3, Block-B, Niketon/, "blue-bird 62-only"),
      locOf(blueBird, /House # 82/, "blue-bird 82 concat"),
      "blue-bird House 62-only vs House 82 concat",
    );
    assert.notEqual(
      locOf(blueBird, /House # 62 \(1st Floor\), Road # 3, Block-B, Niketon/, "blue-bird 62-only eskaton"),
      locOf(blueBird, /87, New Eskaton/, "blue-bird eskaton concat"),
      "blue-bird House 62-only vs 87 Eskaton concat",
    );
    assert.ok(
      !blueBird[locOf(blueBird, /87, New Eskaton/, "blue-bird eskaton src")]!.source_rows.some((r) =>
        /House # 62 \(1st Floor\), Road # 3, Block-B, Niketon/.test(r.address),
      ),
      "blue-bird campus-only source row must not sit in the Eskaton concat location",
    );

    const alif = once("alif-manufacturing", "factory");
    assert.equal(alif.length, 2, `alif-manufacturing factory still ${alif.length}`);
    assert.notEqual(
      locOf(alif, /Bora Dharmapur, Lalmai/, "alif comilla"),
      locOf(alif, /Kaicha Bari, Ashulia/, "alif ashulia"),
      "alif Comilla vs Ashulia",
    );
    assert.notEqual(
      locOf(alif, /Bora Dharmapur, Lalmai/, "alif comilla savar"),
      locOf(alif, /Kaichabari, Savar/, "alif savar"),
      "alif Comilla vs Savar",
    );
    assert.equal(
      locOf(alif, /Kaicha Bari, Ashulia/, "alif ashulia savar"),
      locOf(alif, /Kaichabari, Savar/, "alif savar pair"),
      "alif Ashulia vs Savar same premises",
    );

    const aliens = once("aliens-texwear", "factory");
    assert.equal(aliens.length, 2, `aliens-texwear factory still ${aliens.length}`);
    assert.notEqual(
      locOf(aliens, /Hatimara/, "aliens hatimara"),
      locOf(aliens, /SURA BARI/, "aliens sura bari"),
      "aliens Hatimara vs SURA BARI",
    );

    const caretex = once("caretex-sourcing", "registered");
    assert.equal(caretex.length, 3, `caretex-sourcing registered still ${caretex.length}`);
    assert.notEqual(
      locOf(caretex, /House # 161 \(5th Floor\), Road # 1, DOHS, Baridhara DOHS/, "caretex 161-only"),
      locOf(caretex, /74, East Kazipara/, "caretex kazipara"),
      "caretex House 161-only vs 74 Kazipara concat",
    );
    assert.notEqual(
      locOf(caretex, /House # 161 \(5th Floor\), Road # 1, DOHS, Baridhara DOHS/, "caretex baridhara"),
      locOf(caretex, /Pallabi, Mirpur DOHS/, "caretex pallabi"),
      "caretex Baridhara DOHS vs Pallabi/Mirpur DOHS",
    );
    assert.notEqual(
      locOf(caretex, /Pallabi, Mirpur DOHS/, "caretex pallabi vs kazipara"),
      locOf(caretex, /74, East Kazipara/, "caretex kazipara vs pallabi"),
      "caretex Pallabi vs 74 Kazipara concat",
    );
    assert.ok(
      !caretex[locOf(caretex, /74, East Kazipara/, "caretex kazipara src")]!.source_rows.some((r) =>
        /House # 161 \(5th Floor\), Road # 1, DOHS, Baridhara DOHS, Dhaka$/.test(r.address),
      ),
      "caretex campus-only source row must not sit in the Kazipara concat location",
    );
    assert.ok(
      !caretex[locOf(caretex, /74, East Kazipara/, "caretex kazipara pallabi src")]!.source_rows.some(
        (r) => /Pallabi, Mirpur DOHS/.test(r.address),
      ),
      "caretex Pallabi source row must not sit in the Kazipara concat location",
    );

    const dbTrims = once("db-trims", "registered");
    assert.equal(dbTrims.length, 2, `db-trims registered still ${dbTrims.length}`);
    assert.equal(
      locOf(dbTrims, /South Avenue Tower, 6th floor, House # 50/, "db-trims sat comma"),
      locOf(dbTrims, /South Avenue Tower \(6th floor\), House # 50/, "db-trims sat no-comma"),
      "db-trims South Avenue Tower spellings",
    );
    assert.notEqual(
      locOf(dbTrims, /102, Green Road/, "db-trims green road"),
      locOf(dbTrims, /South Avenue Tower, 6th floor, House # 50/, "db-trims sat vs green"),
      "db-trims Green Road vs South Avenue Tower",
    );

    const mnTex = once("mn-tex", "factory");
    assert.equal(mnTex.length, 1, `mn-tex factory still ${mnTex.length}`);

    const virtualKnit = once("virtual-knitwear", "factory");
    assert.equal(virtualKnit.length, 1, `virtual-knitwear factory still ${virtualKnit.length}`);

    const talent = once("talent-apparels", "factory");
    assert.equal(talent.length, 1, `talent-apparels factory still ${talent.length}`);

    const eartheeMail = once("earthee-wear", "mailing");
    assert.equal(eartheeMail.length, 2, `earthee-wear mailing still ${eartheeMail.length}`);
    assert.notEqual(
      locOf(eartheeMail, /Plot # 27, Holding # 1\/A/, "earthee plot 27"),
      locOf(eartheeMail, /HOUSE NO-01, ROAD NO\.-09/, "earthee house 01"),
      "earthee Plot 27 Holding 1/A vs House 01 Mirpur-12",
    );

    const cityImport = once("city-import", "registered");
    assert.equal(cityImport.length, 2, `city-import registered still ${cityImport.length}`);
    assert.notEqual(
      locOf(cityImport, /House # 430, Road # 30, New DOHS/, "city 430-only"),
      locOf(cityImport, /292, Inner Circular/, "city 292"),
      "city-import House 430-only vs 292 Inner Circular concat",
    );

    const loyal = once("loyal-apparels", "factory");
    assert.equal(loyal.length, 2, `loyal-apparels factory still ${loyal.length}`);

    const knittexMail = once("knittex-industries", "mailing");
    assert.equal(knittexMail.length, 2, `knittex-industries mailing still ${knittexMail.length}`);

    const mtSweater = once("mt-sweater", "factory");
    assert.equal(mtSweater.length, 1, `mt-sweater factory still ${mtSweater.length}`);
  });

  it("never co-locates a never-same place pair in one location", () => {
    const pairs: Array<[string, string]> = [
      ["sreepur", "sripur"],
      ["nawabganj", "chapainawabganj"],
      ["chandra", "chandona"],
      ["chandra", "chandora"],
      ["chandona", "chandora"],
    ];
    for (const group of fixture.groups) {
      const merged = mergeUniqueLocations(group.rows);
      for (const loc of merged) {
        const blob = loc.source_rows
          .map((r) => ` ${normaliseAddressKey(r.address)} `)
          .join(" ");
        for (const [x, y] of pairs) {
          const hasX = new RegExp(`\\b${x}\\b`).test(blob);
          const hasY = new RegExp(`\\b${y}\\b`).test(blob);
          assert.ok(
            !(hasX && hasY),
            `${group.slug} ${group.kind} co-located ${x} with ${y}`,
          );
        }
      }
    }
  });
});
