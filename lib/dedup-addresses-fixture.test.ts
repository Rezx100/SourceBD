import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  cleanAddressString,
  idSetsOverlap,
  mergeUniqueLocations,
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
        visible.add(loc.displayAddress);
        for (const variant of loc.variants) visible.add(variant.address);
      }
      for (const spelling of cleaned) {
        assert.ok(
          visible.has(spelling),
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
  });
});
