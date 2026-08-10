/**
 * REZ-73 — display formatting for SQL group metrics (no arithmetic).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGroupMetric,
  sanitizeFacilityPanel,
  type GroupMetric,
} from "./format-facility-group";

function m(partial: Partial<GroupMetric> & Pick<GroupMetric, "own">): GroupMetric {
  return {
    facility_count: 0,
    building_count: 1,
    unknown_count: 0,
    known_sum: partial.own,
    ...partial,
  };
}

describe("formatGroupMetric", () => {
  it("shows own when there are no facilities", () => {
    assert.equal(formatGroupMetric(m({ own: 1200 })), "1,200");
  });
  it("reports unknown own with no facilities", () => {
    assert.equal(formatGroupMetric(m({ own: null, known_sum: null })), "unknown");
  });
  it("phrases a full known group total", () => {
    assert.equal(
      formatGroupMetric(
        m({
          own: 1000,
          known_sum: 2034,
          facility_count: 2,
          building_count: 3,
          unknown_count: 0,
        }),
      ),
      "2,034 across 3 buildings",
    );
  });
  it("phrases a lower bound when some buildings are unknown", () => {
    assert.equal(
      formatGroupMetric(
        m({
          own: 1000,
          known_sum: 1800,
          facility_count: 2,
          building_count: 3,
          unknown_count: 1,
        }),
      ),
      "at least 1,800 across 3 buildings, 1 unknown",
    );
  });
  it("phrases all-unknown across buildings", () => {
    assert.equal(
      formatGroupMetric(
        m({
          own: null,
          known_sum: null,
          facility_count: 1,
          building_count: 2,
          unknown_count: 2,
        }),
      ),
      "unknown across 2 buildings, 2 unknown",
    );
  });
});

describe("sanitizeFacilityPanel", () => {
  it("keeps name, addresses, pills, rsc and strips secrets", () => {
    const cleaned = sanitizeFacilityPanel({
      facility_count: 1,
      facilities: [
        {
          name: "Unit-2",
          slug: "secret",
          phone: "+8801",
          email: "x@y.z",
          id: "uuid",
          addresses: [
            {
              kind: "factory",
              address: "Gazipur",
              source_code: "RSC",
              phone: "leak",
            },
          ],
          pills: [
            {
              source_code: "RSC",
              label: "RSC ID",
              value: "1",
              verified: true,
              source_url: "https://www.rsc-bd.org/",
            },
          ],
          rsc: {
            progress_pct: 50,
            workers_count: 10,
            remediation_status: "ok",
            training_status: null,
          },
        } as never,
      ],
      group: {
        employees_total: m({
          own: 1,
          facility_count: 1,
          building_count: 2,
          unknown_count: 0,
          known_sum: 1,
        }),
        machines_sewing: m({
          own: 1,
          facility_count: 1,
          building_count: 2,
          unknown_count: 0,
          known_sum: 1,
        }),
        production_capacity_pcs_day: m({
          own: 1,
          facility_count: 1,
          building_count: 2,
          unknown_count: 0,
          known_sum: 1,
        }),
        production_capacity_dozen_yearly: m({
          own: null,
          known_sum: null,
          facility_count: 1,
          building_count: 2,
          unknown_count: 2,
        }),
      },
    });
    assert.deepEqual(cleaned.facilities, [
      {
        name: "Unit-2",
        addresses: [{ kind: "factory", address: "Gazipur", source_code: "RSC" }],
        pills: [
          {
            source_code: "RSC",
            label: "RSC ID",
            value: "1",
            verified: true,
            source_url: "https://www.rsc-bd.org/",
          },
        ],
        rsc: {
          progress_pct: 50,
          workers_count: 10,
          remediation_status: "ok",
          training_status: null,
        },
      },
    ]);
    assert.equal(JSON.stringify(cleaned.facilities).includes("secret"), false);
    assert.equal(JSON.stringify(cleaned.facilities).includes("leak"), false);
  });
});
