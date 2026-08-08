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
});
