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

  it("never leaves two conflicting-id source rows inside one merged location", () => {
    for (const group of fixture.groups) {
      const merged = mergeUniqueLocations(group.rows);
      for (const loc of merged) {
        const idSets = loc.source_rows.map((r) => premisesIdentifiers(r.address));
        for (let i = 0; i < idSets.length; i++) {
          for (let j = i + 1; j < idSets.length; j++) {
            const a = idSets[i]!;
            const b = idSets[j]!;
            if (a.size === 0 || b.size === 0) continue;
            assert.ok(
              idSetsOverlap(a, b),
              `${group.slug} ${group.kind} fused ${[...a]} vs ${[...b]} in one location`,
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
      2,
      "CEPZ Plot 1-5 stays apart from Plot 57-59",
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
      assert.equal(locOf(/Unit-1/), locOf(/Plot#57/), "univogue unit-list sits with 57-59");
      assert.notEqual(locOf(/Unit-1/), locOf(/Plot # 1-5/), "univogue unit-list is not the 1-5 campus");
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
      const locOf = (needle: RegExp) => {
        const i = lib.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
        assert.ok(i >= 0, `liberty missing ${needle}`);
        return i;
      };
      assert.notEqual(locOf(/Chandra/i), locOf(/Ramarbag, Kutubpur/i), "liberty Chandra vs Ramarbag");
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
      const locOf = (needle: RegExp) =>
        fame.findIndex((l) => l.source_rows.some((r) => needle.test(r.address)));
      assert.equal(
        locOf(/Shilpanagary/i),
        locOf(/SHASONGAON/),
        "fame B-188 Shilpanagary vs SHASONGAON",
      );
    }
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
