/**
 * REZ-114 — selection rules: RSC authority, single-source group, null ≠ 0.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateGroupMetric,
  formatMachineGroup,
  formatProfileWorkersFact,
  formatSourceLabel,
  formatWorkersHeadline,
  groupWorkers,
  headlineWorkers,
  selectOwnMachine,
  selectSiteWorkers,
  unknownWorkersLabel,
  type SiteWorkerInput,
} from "./profile-metrics";

function site(
  label: string,
  partial: Partial<
    Pick<SiteWorkerInput, "employees_total" | "rsc_workers_count" | "rsc_fetched_at">
  > = {},
): SiteWorkerInput {
  return {
    label,
    employees_total: partial.employees_total ?? null,
    rsc_workers_count: partial.rsc_workers_count ?? null,
    rsc_fetched_at: partial.rsc_fetched_at ?? null,
  };
}

describe("formatProfileWorkersFact (header observable text)", () => {
  it("Alliance: 3046 not 144", () => {
    const f = formatProfileWorkersFact({
      value: 3046,
      caption: "RSC",
    });
    assert.equal(f.valueText, "3,046");
    assert.notEqual(f.valueText, "144");
  });

  it("Esquire group: 6369 never 8107", () => {
    const f = formatProfileWorkersFact({
      value: 6369,
      caption: "RSC · 2 of 2 sites",
    });
    assert.equal(f.valueText, "6,369");
    assert.notEqual(f.valueText, "8,107");
  });

  it("neither source → Unknown", () => {
    const f = formatProfileWorkersFact({
      value: null,
      caption: "No authority has published a workforce figure",
    });
    assert.equal(f.valueText, "Unknown");
  });
});

describe("selectSiteWorkers", () => {
  it("Alliance-like: declared 144 + RSC 3046 → select 3046 RSC", () => {
    const s = selectSiteWorkers(
      site("Alliance Knit Composite", {
        employees_total: 144,
        rsc_workers_count: 3046,
        rsc_fetched_at: "2026-07-30T22:18:49.373839+00:00",
      }),
    );
    assert.equal(s.value, 3046);
    assert.equal(s.source, "RSC");
    assert.equal(s.fetchedAt, "2026-07-30T22:18:49.373839+00:00");
  });

  it("registry-only site → registry", () => {
    const s = selectSiteWorkers(site("Registry Co", { employees_total: 900 }));
    assert.equal(s.value, 900);
    assert.equal(s.source, "registry");
    assert.equal(s.fetchedAt, null);
  });

  it("neither → Unknown / null", () => {
    const s = selectSiteWorkers(site("Empty Co"));
    assert.equal(s.value, null);
    assert.equal(s.source, null);
    assert.equal(unknownWorkersLabel(), "Unknown");
  });
});

describe("groupWorkers / headlineWorkers", () => {
  it("Esquire-like: mother RSC 5801 + unit RSC 568 → 6369 across 2 of 2, never 8107", () => {
    const mother = site("Esquire Knit Composite", {
      employees_total: 7539,
      rsc_workers_count: 5801,
    });
    const unit = site("Unit 1", {
      employees_total: 568,
      rsc_workers_count: 568,
    });
    const g = groupWorkers([mother, unit]);
    assert.equal(g.mode, "group");
    assert.equal(g.source, "RSC");
    assert.equal(g.value, 6369);
    assert.equal(g.includedCount, 2);
    assert.equal(g.totalCount, 2);
    assert.deepEqual(g.excludedLabels, []);
    assert.notEqual(g.value, 8107);
    assert.equal(formatWorkersHeadline(g), "6,369 across 2 of 2 sites");

    const h = headlineWorkers(mother, [unit]);
    assert.ok("mode" in h);
    assert.equal((h as typeof g).value, 6369);
  });

  it("mixed: mother RSC 1000 + building registry-only 500 → RSC 1000 across 1 of 2", () => {
    const mother = site("Mother RSC", {
      employees_total: 2000,
      rsc_workers_count: 1000,
    });
    const building = site("Building A", { employees_total: 500 });
    const g = groupWorkers([mother, building]);
    assert.equal(g.mode, "group");
    assert.equal(g.source, "RSC");
    assert.equal(g.value, 1000);
    assert.equal(g.includedCount, 1);
    assert.equal(g.totalCount, 2);
    assert.deepEqual(g.excludedLabels, ["Building A"]);
    assert.equal(formatWorkersHeadline(g), "1,000 across 1 of 2 sites");
  });

  it("no RSC anywhere → sum registry sites", () => {
    const g = groupWorkers([
      site("Mother", { employees_total: 100 }),
      site("Unit", { employees_total: 50 }),
    ]);
    assert.equal(g.source, "registry");
    assert.equal(g.value, 150);
    assert.equal(g.includedCount, 2);
  });

  it("every site unknown → null / unknown mode", () => {
    const g = groupWorkers([site("A"), site("B")]);
    assert.equal(g.mode, "unknown");
    assert.equal(g.value, null);
    assert.equal(formatWorkersHeadline(g), "Unknown");
  });

  it("mother alone uses site selection", () => {
    const h = headlineWorkers(
      site("Solo", { employees_total: 144, rsc_workers_count: 3046 }),
    );
    assert.ok(!("mode" in h));
    assert.equal(h.value, 3046);
    assert.equal(h.source, "RSC");
  });
});

describe("formatSourceLabel", () => {
  it("labels RSC with fetch date and registry without", () => {
    assert.match(
      formatSourceLabel("RSC", "2026-07-30T22:18:49.373839+00:00"),
      /^RSC · fetched /,
    );
    assert.equal(formatSourceLabel("registry", null), "registry");
    assert.equal(formatSourceLabel(null), "");
  });
});

describe("machines / capacity GroupMetric", () => {
  it("null never sums as 0 in machine group formatter", () => {
    const m = aggregateGroupMetric(null, [null, null]);
    assert.equal(m.known_sum, null);
    assert.equal(m.unknown_count, 3);
    assert.equal(m.own, null);
    assert.match(formatMachineGroup(m), /^unknown across/);
    assert.doesNotMatch(formatMachineGroup(m), /\b0\b/);
  });

  it("building machines roll into known_sum lower bound while own remains", () => {
    const m = aggregateGroupMetric(140, [40, null]);
    assert.equal(m.own, 140);
    assert.equal(selectOwnMachine(140).value, 140);
    assert.equal(m.known_sum, 180);
    assert.equal(m.unknown_count, 1);
    assert.equal(m.facility_count, 2);
    assert.equal(m.building_count, 3);
    assert.equal(
      formatMachineGroup(m),
      "at least 180 across 3 sites, 1 unknown",
    );
  });
});
