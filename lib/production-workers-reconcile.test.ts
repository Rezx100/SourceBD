/**
 * Durable guard: SQL batch must implement the same site set + RSC-prefer rule
 * as lib/profile-metrics groupWorkers (REZ-114 cross-path).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { applyDiscoverWorkersSelection } from "./enrich-discover-workers";
import { groupWorkers } from "./profile-metrics";

const MIG = join(
  process.cwd(),
  "supabase/migrations/20260810071000_production_workers_display_batch.sql",
);

describe("production_workers_display_batch SQL invariants", () => {
  const sql = readFileSync(MIG, "utf8");

  it("includes mother + facility_of buildings in the site set", () => {
    assert.match(sql, /facility_of\s*=\s*r\.root_id/);
    assert.match(sql, /union all/i);
  });

  it("prefers RSC single-source (never mixes registry into RSC sum)", () => {
    assert.match(sql, /prefer_rsc/);
    assert.match(
      sql,
      /where s\.source = case when f\.prefer_rsc then 'RSC' else 'registry' end/,
    );
  });
});

describe("list card vs profile headline reconciliation (shared fixtures)", () => {
  it("Esquire-like: groupWorkers 6369 equals discover apply of batch 6369", () => {
    const group = groupWorkers([
      {
        label: "mother",
        employees_total: 7539,
        rsc_workers_count: 5801,
        rsc_fetched_at: null,
      },
      {
        label: "unit",
        employees_total: 568,
        rsc_workers_count: 568,
        rsc_fetched_at: null,
      },
    ]);
    assert.equal(group.value, 6369);
    const card = applyDiscoverWorkersSelection(
      [{ id: "e", employees_total: 7539 }],
      { e: { value: group.value as number, source: "RSC", fetched_at: null } },
    );
    assert.equal(card[0]?.employees_total, group.value);
  });

  it("Alliance-like: site 3046 equals discover apply of batch 3046", () => {
    const card = applyDiscoverWorkersSelection(
      [{ id: "a", employees_total: 144 }],
      { a: { value: 3046, source: "RSC", fetched_at: null } },
    );
    assert.equal(card[0]?.employees_total, 3046);
  });
});
