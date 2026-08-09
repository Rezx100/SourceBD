/**
 * REZ-73 — facility group roll-up for the mother profile (widened scope:
 * separate labelled figures, never one combined total).
 *
 * Mirrors the six acceptance cases of etl/tests/test_facility_rollup.py
 * (REZ-92) against the live web-side computation, plus the migration
 * containment pins for the 20260808_rez73 facilities payload. No database.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FACILITIES_PROFILE_MIGRATION,
  assertFacilitiesContainment,
  describeGroupMetric,
  projectFacilityGroup,
  type FacilityRollupBuilding,
  type FacilityRollupOwn,
} from "./facility-rollup";

function own(overrides: Partial<FacilityRollupOwn> = {}): FacilityRollupOwn {
  return {
    employees_total: 2000,
    machines_sewing: 100,
    production_capacity_pcs_day: 10_000,
    production_capacity_dozen_yearly: 50_000,
    ...overrides,
  };
}

function facility(
  name: string,
  overrides: Partial<FacilityRollupBuilding> = {},
): FacilityRollupBuilding {
  return {
    name,
    employees_total: 1000,
    machines_sewing: 50,
    production_capacity_pcs_day: 5_000,
    production_capacity_dozen_yearly: 20_000,
    ...overrides,
  };
}

describe("projectFacilityGroup", () => {
  it("with no facilities the group figure equals the mother's own (py #1)", () => {
    const proj = projectFacilityGroup(own({ employees_total: 2000 }), []);
    assert.equal(proj.facilityCount, 0);
    const m = proj.metrics.employees_total;
    assert.equal(m.own, 2000);
    assert.equal(m.knownSum, 2000);
    assert.equal(m.unknownCount, 0);
    assert.equal(m.isLowerBound, false);
    assert.equal(describeGroupMetric(m), "2,000");
  });

  it("sums the mother and two facilities arithmetically (py #2)", () => {
    const proj = projectFacilityGroup(own(), [
      facility("A (Extension)", { employees_total: 1500, machines_sewing: 40 }),
      facility("B (Unit-2)", { employees_total: 1700, machines_sewing: 60 }),
    ]);
    assert.equal(proj.facilityCount, 2);
    assert.equal(proj.metrics.employees_total.knownSum, 2000 + 1500 + 1700);
    assert.equal(proj.metrics.machines_sewing.knownSum, 100 + 40 + 60);
    // The headline own figure is never the sum.
    assert.equal(proj.metrics.employees_total.own, 2000);
    assert.equal(proj.metrics.employees_total.isLowerBound, false);
    assert.equal(
      describeGroupMetric(proj.metrics.employees_total),
      "5,200 across 3 buildings",
    );
  });

  it("treats a null facility figure as unknown, never zero (py #3)", () => {
    const proj = projectFacilityGroup(own(), [
      facility("Known (Extension)", { employees_total: 1500 }),
      facility("Unknown (Extension)", { employees_total: null }),
    ]);
    const m = proj.metrics.employees_total;
    assert.equal(m.knownSum, 3500);
    assert.equal(m.unknownCount, 1);
    assert.equal(m.knownCount, 2);
    assert.equal(m.isLowerBound, true);
    assert.equal(
      describeGroupMetric(m),
      "at least 3,500 across 3 buildings, 1 unknown",
    );
  });

  it("keeps the mother's own columns byte-identical (py #5)", () => {
    const before = own();
    const snapshot = { ...before };
    const proj = projectFacilityGroup(before, [
      facility("A (Extension)", { employees_total: 500 }),
    ]);
    assert.deepEqual(before, snapshot);
    for (const column of Object.keys(snapshot) as (keyof FacilityRollupOwn)[]) {
      assert.equal(proj.metrics[column].own, snapshot[column]);
    }
  });

  it("reports every building unknown without inventing a total (py all-unknown)", () => {
    const proj = projectFacilityGroup(own({ employees_total: null }), [
      facility("A (Extension)", { employees_total: null }),
      facility("B (Extension)", { employees_total: null }),
    ]);
    const m = proj.metrics.employees_total;
    assert.equal(m.knownSum, null);
    assert.equal(m.unknownCount, 3);
    assert.equal(m.isLowerBound, false);
    assert.equal(
      describeGroupMetric(m),
      "unknown across 3 buildings, 3 unknown",
    );
  });

  it("handles a null own figure with known facility figures", () => {
    const proj = projectFacilityGroup(own({ machines_sewing: null }), [
      facility("A (Extension)", { machines_sewing: 40 }),
    ]);
    const m = proj.metrics.machines_sewing;
    assert.equal(m.own, null);
    assert.equal(m.knownSum, 40);
    assert.equal(m.isLowerBound, true);
    assert.equal(
      describeGroupMetric(m),
      "at least 40 across 2 buildings, 1 unknown",
    );
  });

  it("describes a single-building group without plural drift", () => {
    // buildingCount is always 1 + facilityCount; with one facility the
    // wording stays "across 2 buildings" — the mother counts as a building.
    const proj = projectFacilityGroup(own(), [facility("A (Extension)")]);
    assert.equal(proj.metrics.employees_total.buildingCount, 2);
    assert.equal(
      describeGroupMetric(proj.metrics.employees_total),
      "3,000 across 2 buildings",
    );
  });
});

describe("20260808_rez73 migration containment", () => {
  it("pins the facilities CTE shape, PII keys, and REZ-93 invariants", () => {
    // npm test runs from the repo root; compiled __dirname is a cache dir.
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    assert.doesNotThrow(() => assertFacilitiesContainment({ migrationSql }));
  });

  it("rejects concat / dollar-quote / mixed-case key leak vectors", () => {
    const base = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    // Inject after the legitimate 'rsc' key — a first-`) as obj` or
    // /'[a-z_]+'/ lexer would keep the whitelist green while emitting slug.
    const rscAnchor = /'rsc',\s*fr\.obj/;
    assert.match(base, rscAnchor, "migration must contain the rsc key anchor");
    const inject = (keyExpr: string) => {
      const out = base.replace(rscAnchor, `'rsc', fr.obj, ${keyExpr}, f.slug`);
      assert.notEqual(out, base, `inject of ${keyExpr} must modify the SQL`);
      return out;
    };
    for (const [label, expr] of [
      ["concat", "('slu' || 'g')"],
      ["dollar", "$k$slug$k$"],
      ["mixed-case", "'Slug'"],
      ["source_ref literal", "'source_ref'"],
      ["sbi_total literal", "'sbi_total'"],
    ] as const) {
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: inject(expr) }),
        /forbidden key|lowercase snake literal|sbi_/i,
        `${label} key expression must fail containment`,
      );
    }
    // Nested `) as obj` before a forbidden key must not truncate the
    // top-level whitelist extraction.
    const truncated = base.replace(
      rscAnchor,
      `'rsc', (select (fr.obj) as obj), 'source_ref', f.slug`,
    );
    assert.notEqual(truncated, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: truncated }),
      /forbidden key|exactly|source_ref|lowercase snake literal/i,
      "nested ) as obj truncation must fail containment",
    );
  });

  it("pins the full definer set of every object 20260808 recreates", () => {
    // The 0097→20260808 rename closed one silent-overwrite window, but the
    // same class recurs the day anyone adds a later-sorting migration that
    // recreates one of these objects without re-pinning. The set of files
    // defining each object is closed: a new definer fails this test and
    // forces the author to state which body is live.
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    // Normalise quoted identifiers and catch dynamic EXECUTE recreates so
    // `"public".buyer_supplier_profile` / format(%I.%I) cannot slip past.
    const normalize = (sql: string) =>
      sql
        .replace(/"public"/gi, "public")
        .replace(/"(buyer_supplier_profile)"/gi, "$1")
        .replace(/"(v_supplier_addresses_direct)"/gi, "$1")
        .replace(/"(v_supplier_addresses)"/gi, "$1");
    const definersOf = (pattern: RegExp) =>
      files.filter((f) =>
        pattern.test(
          normalize(fs.readFileSync(path.join(migrationsDir, f), "utf8")),
        ),
      );
    const LIVE = "20260808_rez73_buyer_supplier_profile_facilities.sql";
    const expected: Record<string, string[]> = {
      "public.buyer_supplier_profile": [
        "0024_buyer_supplier_profile_rpc.sql",
        "0034_supplier_profile_editor.sql",
        "0036_supplier_relationships.sql",
        "0079_buyer_supplier_profile_strip_address_pii.sql",
        "0095_buyer_supplier_profile_facility_documents.sql",
        "20260725_rez_security_hardening_2.sql",
        LIVE,
      ],
      "public.v_supplier_addresses_direct": [
        "0014_rsc_inherited_addresses.sql",
        "0015_btma_address_branches.sql",
        "0016_bgapmea_address_branches.sql",
        "0017_epb_address_branches.sql",
        "0018_oeko_profile_address_branch.sql",
        "0082_supplier_pii_hardening.sql",
        LIVE,
      ],
      "public.v_supplier_addresses": [
        "0004_supplier_address_views.sql",
        "0014_rsc_inherited_addresses.sql",
        "0015_btma_address_branches.sql",
        "0016_bgapmea_address_branches.sql",
        "0017_epb_address_branches.sql",
        "0018_oeko_profile_address_branch.sql",
        "0057_perf_hotfix_inheritance_views_rewrite.sql",
        "0058_revert_inheritance_views_to_lateral.sql",
        "0082_supplier_pii_hardening.sql",
        LIVE,
      ],
    };
    const patterns: [string, RegExp][] = [
      [
        "public.buyer_supplier_profile",
        /create(?:\s+or\s+replace)?\s+function\s+public\.buyer_supplier_profile/i,
      ],
      [
        "public.v_supplier_addresses_direct",
        /create(?:\s+or\s+replace)?\s+view\s+public\.v_supplier_addresses_direct/i,
      ],
      [
        "public.v_supplier_addresses",
        /create(?:\s+or\s+replace)?\s+view\s+public\.v_supplier_addresses\b/i,
      ],
    ];
    for (const [objectName, pattern] of patterns) {
      const got = definersOf(pattern);
      assert.deepEqual(
        got,
        [...(expected[objectName] ?? [])].sort(),
        `${objectName} definers changed — if you added a migration recreating ` +
          `it, state which body is live and update this pin`,
      );
    }
    // Dynamic DO / EXECUTE format(%I.%I) recreates are a separate bypass
    // class: they never match the create regex, so fail closed if any
    // migration uses them against these objects.
    const DYNAMIC =
      /execute\s+format\s*\([\s\S]{0,240}(buyer_supplier_profile|v_supplier_addresses)/i;
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
      assert.ok(
        !DYNAMIC.test(sql),
        `${f} dynamically recreates a pinned object via EXECUTE format — ` +
          `add an explicit CREATE and update the definer-set pin`,
      );
    }
  });

  it("pins the facility→facility parent refusal trigger", () => {
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    assert.match(
      migrationSql,
      /create or replace function public\.enforce_facility_parent_is_company/i,
    );
    assert.match(
      migrationSql,
      /p\.facility_of is not null/,
    );
    assert.match(
      migrationSql,
      /trg_suppliers_facility_parent_is_company/,
    );
  });
});
