import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
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
});
