/**
 * Read-only: print remaining multi-location groups whose display rows
 * look like the same premises (shared identifiers, shared leading
 * village, or high token overlap). Used for the full-population sweep.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  mergeUniqueLocations,
  premisesIdentifiers,
  idSetsOverlap,
  type AddressRowRaw,
} from "../lib/dedup-addresses";

type FixtureGroup = {
  slug: string;
  company_name: string;
  kind: string;
  rows: AddressRowRaw[];
};

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "lib/fixtures/v-supplier-addresses-multi-string.json"), "utf8"),
) as { groups: FixtureGroup[] };

const suspects: Array<{
  slug: string;
  kind: string;
  reason: string;
  displays: string[];
}> = [];

for (const group of fixture.groups) {
  const merged = mergeUniqueLocations(group.rows);
  if (merged.length < 2) continue;
  for (let i = 0; i < merged.length; i++) {
    for (let j = i + 1; j < merged.length; j++) {
      const a = merged[i]!;
      const b = merged[j]!;
      const idsA = premisesIdentifiers(a.displayAddress);
      const idsB = premisesIdentifiers(b.displayAddress);
      const pair = mergeUniqueLocations([...a.source_rows, ...b.source_rows]);
      if (pair.length === 1) {
        suspects.push({
          slug: group.slug,
          kind: group.kind,
          reason: "pair-merge-but-group-split (should not happen)",
          displays: [a.displayAddress, b.displayAddress],
        });
        continue;
      }
      if (idsA.size > 0 && idsB.size > 0 && idSetsOverlap(idsA, idsB)) {
        suspects.push({
          slug: group.slug,
          kind: group.kind,
          reason: `shared identifiers ${[...idsA].filter((x) => idsB.has(x)).join(",")}`,
          displays: [a.displayAddress, b.displayAddress],
        });
      }
    }
  }
}

console.log(JSON.stringify({ suspectCount: suspects.length, suspects }, null, 2));
