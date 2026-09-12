/**
 * Read-only near-dup report: run the profile address matcher on the checked-in
 * multi-string fixture (published production groups). Never mutates the DB.
 *
 *   ./node_modules/.bin/tsc -p tsconfig.npm-test.json
 *   node node_modules/.cache/sourcebd-tests/ops/report_address_near_dups.js
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  mergeUniqueLocations,
  sourceRowsHaveConflictingIds,
  type AddressRowRaw,
} from "../lib/dedup-addresses";

type FixtureRow = AddressRowRaw;
type FixtureGroup = {
  slug: string;
  company_name: string;
  kind: string;
  rows: FixtureRow[];
};
type Fixture = {
  exported_at: string;
  baseline: {
    published_address_rows: number;
    published_suppliers_with_address: number;
    multi_string_groups_by_kind: number;
  };
  groups: FixtureGroup[];
};

const root = process.cwd();
const fixture = JSON.parse(
  readFileSync(join(root, "lib/fixtures/v-supplier-addresses-multi-string.json"), "utf8"),
) as Fixture;

const namedSlugs = [
  "habitus-fashion",
  "fakhruddin-textile-mills",
  "siji-garments",
  "kamal-yarn",
  "blue-bird-fashion",
  "asf-fabrics-mills",
  "mango-knit-composite",
  "mondol-fashions",
  "sfu-fashion",
  "fin-bangla-apparels",
  "bangladesh-naxis",
  "echoknits",
  "bangladesh-spinners-and-knitters",
];
const mustStayMulti: Array<{ slug: string; kind: string; minLocations: number }> = [
  { slug: "siji-garments", kind: "factory", minLocations: 2 },
  { slug: "kamal-yarn", kind: "factory", minLocations: 2 },
  { slug: "blue-bird-fashion", kind: "registered", minLocations: 2 },
];
const mustMergeToOne: Array<{ slug: string; kind: string }> = [
  { slug: "habitus-fashion", kind: "factory" },
  { slug: "fakhruddin-textile-mills", kind: "factory" },
  { slug: "asf-fabrics-mills", kind: "mailing" },
  { slug: "mango-knit-composite", kind: "factory" },
  { slug: "mondol-fashions", kind: "mailing" },
  { slug: "sfu-fashion", kind: "factory" },
  { slug: "fin-bangla-apparels", kind: "factory" },
  { slug: "bangladesh-naxis", kind: "registered" },
  { slug: "echoknits", kind: "factory" },
  { slug: "bangladesh-spinners-and-knitters", kind: "factory" },
];
const stillSplit: Array<{
  slug: string;
  company_name: string;
  kind: string;
  strings: number;
  locations: number;
  displays: string[];
}> = [];
let mergedToOne = 0;
let conflictingIdMerges = 0;

for (const group of fixture.groups) {
  const distinct = new Set(group.rows.map((r) => r.address.trim()));
  const merged = mergeUniqueLocations(group.rows);
  if (merged.length === 1) mergedToOne += 1;
  else {
    stillSplit.push({
      slug: group.slug,
      company_name: group.company_name,
      kind: group.kind,
      strings: distinct.size,
      locations: merged.length,
      displays: merged.map((m) => m.displayAddress),
    });
  }
  for (const loc of merged) {
    if (sourceRowsHaveConflictingIds(loc.source_rows, loc.source_rows)) {
      conflictingIdMerges += 1;
    }
  }
}

const named = namedSlugs.map((slug) => {
  const groups = fixture.groups.filter((g) => g.slug === slug);
  return {
    slug,
    groups: groups.map((g) => {
      const merged = mergeUniqueLocations(g.rows);
      return {
        kind: g.kind,
        strings: new Set(g.rows.map((r) => r.address.trim())).size,
        locations: merged.length,
        display: merged.map((m) => m.displayAddress),
        variantCount: merged.map((m) => m.variants.length),
      };
    }),
  };
});

const stillMulti = stillSplit.length;
const overMergeHits = mustStayMulti.flatMap((watch) => {
  const group = fixture.groups.find((g) => g.slug === watch.slug && g.kind === watch.kind);
  if (!group) return [{ ...watch, locations: 0, reason: "missing-from-fixture" }];
  const locations = mergeUniqueLocations(group.rows).length;
  if (locations < watch.minLocations) {
    return [{ slug: watch.slug, kind: watch.kind, minLocations: watch.minLocations, locations }];
  }
  return [];
});
const underMergeHits = mustMergeToOne.flatMap((watch) => {
  const group = fixture.groups.find((g) => g.slug === watch.slug && g.kind === watch.kind);
  if (!group) return [{ ...watch, locations: 0, reason: "missing-from-fixture" }];
  const locations = mergeUniqueLocations(group.rows).length;
  if (locations !== 1) {
    return [{ slug: watch.slug, kind: watch.kind, locations }];
  }
  return [];
});
const lines = [
  "# Address near-dup report",
  "",
  `Fixture exported_at: ${fixture.exported_at}`,
  `Groups in fixture: ${fixture.groups.length}`,
  `Matcher merged to 1 location: **${mergedToOne}** (was 1,622 on the previous matcher)`,
  `Groups still showing 2+ locations: **${stillMulti}** (was 1,652)`,
  `Conflicting-plot merges (must be 0): **${conflictingIdMerges}**`,
  `Named over-merges (must be 0): **${overMergeHits.length}**`,
  `Named under-merges (must be 0): **${underMergeHits.length}**`,
  "",
  "Named suppliers:",
  ...named.flatMap((n) => [
    `- ${n.slug}: ` +
      n.groups
        .map((g) => `${g.kind} ${g.strings} strings → ${g.locations} location(s)`)
        .join("; "),
  ]),
  "",
  "Remaining multi-location groups (slug, kind, locations):",
  "",
];
for (const g of stillSplit) {
  lines.push(`- ${g.slug} (${g.kind}) ${g.strings} strings → ${g.locations}`);
  for (const d of g.displays) {
    lines.push(`  - ${d.replace(/\s+/g, " ")}`);
  }
}

writeFileSync(join(root, "ops/plans/address-near-dup-report.md"), `${lines.join("\n")}\n`);
writeFileSync(
  join(root, "ops/plans/address-near-dup-remaining.json"),
  JSON.stringify(
    {
      mergedToOne,
      stillMulti,
      conflictingIdMerges,
      overMergeHits,
      underMergeHits,
      named,
      stillSplit,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      groups: fixture.groups.length,
      mergedToOne,
      stillMulti,
      conflictingIdMerges,
      overMergeHits,
      underMergeHits,
      named,
    },
    null,
    2,
  ),
);
