import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDiscoverWorkersSelection } from "./enrich-discover-workers";

describe("applyDiscoverWorkersSelection", () => {
  it("Alliance-style: RSC replaces registry 144 with 3046", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "a", employees_total: 144, slug: "alliance" }],
      { a: { workers_count: 3046, fetched_at: "2025-01-01T00:00:00Z" } },
    );
    assert.equal(rows[0]?.employees_total, 3046);
  });

  it("leaves registry when no RSC", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "b", employees_total: 500 }],
      {},
    );
    assert.equal(rows[0]?.employees_total, 500);
  });

  it("null stays null when neither source", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "c", employees_total: null }],
      {},
    );
    assert.equal(rows[0]?.employees_total, null);
  });
});
