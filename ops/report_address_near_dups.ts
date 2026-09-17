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
  "alif-manufacturing",
  "shiplu-textile-and-spinning-mills",
  "fahad-knit-fashion",
  "aliens-texwear",
  "caretex-sourcing",
  "city-import",
  "loyal-apparels",
  "knittex-industries",
  "mt-sweater",
  "db-trims",
  "mn-tex",
  "virtual-knitwear",
  "talent-apparels",
  "earthee-wear",
  "rezaul-apparels",
  "crony-tex-sweater",
  "lodestar-fashions",
  "expert-global-trims",
  "universal-trims",
  "incredible-fashions",
  "rahimaaziz-knitspin",
  "nilorn-bangladesh",
];
const mustStayMulti: Array<{ slug: string; kind: string; minLocations: number }> = [
  { slug: "siji-garments", kind: "factory", minLocations: 2 },
  { slug: "kamal-yarn", kind: "factory", minLocations: 2 },
  { slug: "blue-bird-fashion", kind: "registered", minLocations: 3 },
  { slug: "alif-manufacturing", kind: "factory", minLocations: 2 },
  { slug: "aliens-texwear", kind: "factory", minLocations: 2 },
  { slug: "caretex-sourcing", kind: "registered", minLocations: 3 },
  { slug: "city-import", kind: "registered", minLocations: 2 },
  { slug: "db-trims", kind: "registered", minLocations: 2 },
  { slug: "earthee-wear", kind: "mailing", minLocations: 2 },
  { slug: "virtual-knitwear", kind: "mailing", minLocations: 2 },
  { slug: "db-trims", kind: "factory", minLocations: 2 },
  { slug: "incredible-fashions", kind: "registered", minLocations: 2 },
  { slug: "universal-trims", kind: "factory", minLocations: 2 },
];
const mustNotAbsorb: Array<{
  slug: string;
  kind: string;
  campusOnly: RegExp;
  concat: RegExp;
}> = [
  {
    slug: "blue-bird-fashion",
    kind: "registered",
    campusOnly: /House # 62 \(1st Floor\), Road # 3, Block-B, Niketon/,
    concat: /87, New Eskaton/,
  },
  {
    slug: "kamal-yarn",
    kind: "factory",
    campusOnly: /P\.S: Valuka/,
    concat: /Meherbari/,
  },
  {
    slug: "caretex-sourcing",
    kind: "registered",
    campusOnly: /House # 161 \(5th Floor\), Road # 1, DOHS, Baridhara DOHS, Dhaka$/,
    concat: /74, East Kazipara/,
  },
  {
    slug: "city-import",
    kind: "registered",
    campusOnly: /House # 430, Road # 30, New DOHS/,
    concat: /292, Inner Circular/,
  },
  {
    slug: "paxar-bangladesh",
    kind: "factory",
    campusOnly: /Plot # 167-169, Dhaka EPZ-Ext\. Area, Savar, Dhaka-1349/,
    concat: /EPZ-Old\. Area/,
  },
  {
    slug: "earthee-wear",
    kind: "mailing",
    campusOnly: /Plot # 27, Holding # 1\/A, Milk Vita Road/,
    concat: /HOUSE NO-01, ROAD NO\.-09/,
  },
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
  { slug: "shiplu-textile-and-spinning-mills", kind: "factory" },
  { slug: "shiplu-textile-and-spinning-mills", kind: "mailing" },
  { slug: "fahad-knit-fashion", kind: "factory" },
  { slug: "mt-sweater", kind: "factory" },
  { slug: "falcon-international-knit-composite", kind: "factory" },
  { slug: "falcon-international-knit-composite", kind: "mailing" },
  { slug: "mn-tex", kind: "factory" },
  { slug: "virtual-knitwear", kind: "factory" },
  { slug: "talent-apparels", kind: "factory" },
  { slug: "rezaul-apparels", kind: "factory" },
  { slug: "crony-tex-sweater", kind: "mailing" },
  { slug: "lodestar-fashions", kind: "factory" },
  { slug: "expert-global-trims", kind: "factory" },
  { slug: "rahimaaziz-knitspin", kind: "mailing" },
  { slug: "nilorn-bangladesh", kind: "factory" },
  { slug: "the-delta-accessories", kind: "registered" },
];
const mustCoLocate: Array<{ slug: string; kind: string; left: RegExp; right: RegExp }> = [
  {
    slug: "db-trims",
    kind: "registered",
    left: /South Avenue Tower, 6th floor, House # 50/,
    right: /South Avenue Tower \(6th floor\), House # 50/,
  },
  {
    slug: "universal-trims",
    kind: "factory",
    left: /Plot No # 14/,
    right: /PLOT # 10 & 14/,
  },
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
const underMergeHits = [
  ...mustMergeToOne.flatMap((watch) => {
    const group = fixture.groups.find((g) => g.slug === watch.slug && g.kind === watch.kind);
    if (!group) return [{ ...watch, locations: 0, reason: "missing-from-fixture" }];
    const locations = mergeUniqueLocations(group.rows).length;
    if (locations !== 1) {
      return [{ slug: watch.slug, kind: watch.kind, locations }];
    }
    return [];
  }),
  ...mustCoLocate.flatMap((watch) => {
    const group = fixture.groups.find((g) => g.slug === watch.slug && g.kind === watch.kind);
    if (!group) return [{ slug: watch.slug, kind: watch.kind, reason: "missing-from-fixture" }];
    const merged = mergeUniqueLocations(group.rows);
    const leftLoc = merged.find((loc) => loc.source_rows.some((r) => watch.left.test(r.address)));
    const rightLoc = merged.find((loc) => loc.source_rows.some((r) => watch.right.test(r.address)));
    if (!leftLoc || !rightLoc) {
      return [{ slug: watch.slug, kind: watch.kind, reason: "missing-row" }];
    }
    if (leftLoc !== rightLoc) {
      return [{ slug: watch.slug, kind: watch.kind, reason: "pair-still-split" }];
    }
    return [];
  }),
];
const absorptionHits = mustNotAbsorb.flatMap((watch) => {
  const group = fixture.groups.find((g) => g.slug === watch.slug && g.kind === watch.kind);
  if (!group) return [{ ...watch, reason: "missing-from-fixture" }];
  const merged = mergeUniqueLocations(group.rows);
  const campusLoc = merged.find((loc) =>
    loc.source_rows.some((r) => watch.campusOnly.test(r.address)),
  );
  const concatLoc = merged.find((loc) =>
    loc.source_rows.some((r) => watch.concat.test(r.address)),
  );
  if (!campusLoc || !concatLoc) {
    return [{ slug: watch.slug, kind: watch.kind, reason: "missing-row" }];
  }
  if (campusLoc === concatLoc) {
    return [{ slug: watch.slug, kind: watch.kind, reason: "campus-inside-concat" }];
  }
  return [];
});
const namedOverMerges = overMergeHits.length + absorptionHits.length;
const lines = [
  "# Address near-dup report",
  "",
  `Fixture exported_at: ${fixture.exported_at}`,
  `Groups in fixture: ${fixture.groups.length}`,
  `Matcher merged to 1 location: **${mergedToOne}** (was 1,622 on the previous matcher)`,
  `Groups still showing 2+ locations: **${stillMulti}** (was 1,652)`,
  `Conflicting-plot merges (must be 0): **${conflictingIdMerges}**`,
  `Named over-merges (must be 0): **${namedOverMerges}**`,
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
      absorptionHits,
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
      absorptionHits,
      underMergeHits,
      named,
    },
    null,
    2,
  ),
);
