/**
 * REZ-114 — resolveProfileWorkers boundary (Alliance / Esquire).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveProfileWorkers } from "./build-profile-workers";
import type { FacilityPanel } from "./format-facility-group";
import {
  formatWorkersHeadline,
  isGroupWorkers,
  workersCaption,
  workersDisplayValue,
} from "./profile-metrics";

function emptyMetric(overrides: Partial<FacilityPanel["group"]["employees_total"]> = {}) {
  return {
    own: null,
    known_sum: null,
    facility_count: 0,
    building_count: 1,
    unknown_count: 1,
    ...overrides,
  };
}

describe("resolveProfileWorkers", () => {
  it("Alliance-like: declared 144 + RSC 3046 → headline 3046 RSC (not 144)", () => {
    const h = resolveProfileWorkers({
      companyName: "Alliance Knit Composite",
      employeesTotal: 144,
      rscSites: [
        {
          workers_count: 3046,
          fetched_at: "2026-07-30T22:18:49.373839+00:00",
          building_name: null,
        },
      ],
      panel: null,
    });
    assert.equal(workersDisplayValue(h), 3046);
    assert.equal(h.source, "RSC");
    assert.equal(h.fetchedAt, "2026-07-30T22:18:49.373839+00:00");
    assert.ok(!isGroupWorkers(h));
    assert.match(workersCaption(h), /RSC/);
  });

  it("Esquire-like: mother RSC 5801 + unit RSC 568 → 6369, never declared mix 8107", () => {
    const panel: FacilityPanel = {
      facility_count: 1,
      facilities: [
        {
          name: "Unit 1",
          employees_total: 568,
          addresses: [],
          pills: [],
          rsc: {
            progress_pct: null,
            workers_count: 568,
            fetched_at: "2026-07-01T00:00:00+00:00",
            remediation_status: null,
            training_status: null,
          },
        },
      ],
      group: {
        // Declared mix the UI must not show as the worker group figure.
        employees_total: emptyMetric({
          own: 7539,
          known_sum: 8107,
          facility_count: 1,
          building_count: 2,
          unknown_count: 0,
        }),
        machines_sewing: emptyMetric({
          own: 140,
          known_sum: 140,
          facility_count: 1,
          building_count: 2,
          unknown_count: 1,
        }),
        production_capacity_pcs_day: emptyMetric(),
        production_capacity_dozen_yearly: emptyMetric(),
      },
    };

    const h = resolveProfileWorkers({
      companyName: "Esquire Knit Composite",
      employeesTotal: 7539,
      rscSites: [
        {
          workers_count: 5801,
          fetched_at: "2026-07-15T00:00:00+00:00",
          building_name: null,
        },
      ],
      panel,
    });

    assert.ok(isGroupWorkers(h));
    assert.equal(workersDisplayValue(h), 6369);
    assert.equal(h.source, "RSC");
    assert.equal(h.mode, "group");
    assert.equal(h.includedCount, 2);
    assert.equal(h.totalCount, 2);
    assert.notEqual(workersDisplayValue(h), 8107);
    assert.notEqual(workersDisplayValue(h), 7539);
    assert.equal(formatWorkersHeadline(h), "6,369 across 2 of 2 sites");
  });

  it("neither registry nor RSC → null / Unknown caption", () => {
    const h = resolveProfileWorkers({
      companyName: "Empty Co",
      employeesTotal: null,
      rscSites: null,
      panel: null,
    });
    assert.equal(workersDisplayValue(h), null);
    assert.equal(h.source, null);
    assert.equal(
      workersCaption(h),
      "No authority has published a workforce figure",
    );
  });
});
