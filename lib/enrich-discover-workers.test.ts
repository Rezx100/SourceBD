import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDiscoverWorkersSelection,
  enrichDiscoverWorkers,
  parseDisplayBatch,
} from "./enrich-discover-workers";

describe("parseDisplayBatch", () => {
  it("parses RSC and registry entries", () => {
    const m = parseDisplayBatch({
      a: { value: 3046, source: "RSC", fetched_at: "2025-01-01T00:00:00Z" },
      b: { value: 500, source: "registry", fetched_at: null },
    });
    assert.equal(m.a?.value, 3046);
    assert.equal(m.a?.source, "RSC");
    assert.equal(m.b?.value, 500);
  });

  it("ignores malformed entries", () => {
    const m = parseDisplayBatch({
      a: { value: "x", source: "RSC" },
      b: { value: 1, source: "nope" },
    });
    assert.deepEqual(m, {});
  });
});

describe("applyDiscoverWorkersSelection", () => {
  it("Alliance-style: batch RSC 3046 replaces registry 144", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "a", employees_total: 144 }],
      { a: { value: 3046, source: "RSC", fetched_at: "2025-01-01T00:00:00Z" } },
    );
    assert.equal(rows[0]?.employees_total, 3046);
  });

  it("Esquire-style group headline 6369 (not mother-only 5801, not 8107)", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "e", employees_total: 7539 }],
      { e: { value: 6369, source: "RSC", fetched_at: null } },
    );
    assert.equal(rows[0]?.employees_total, 6369);
  });

  it("leaves registry when batch has no entry", () => {
    const rows = applyDiscoverWorkersSelection(
      [{ id: "b", employees_total: 500 }],
      {},
    );
    assert.equal(rows[0]?.employees_total, 500);
  });
});

describe("enrichDiscoverWorkers", () => {
  it("applies batch values from production_workers_display_batch", async () => {
    const client = {
      rpc: async () => ({
        data: {
          a: { value: 3046, source: "RSC", fetched_at: null },
        },
        error: null,
      }),
    };
    const rows = await enrichDiscoverWorkers(client, [
      { id: "a", employees_total: 144 },
    ]);
    assert.equal(rows[0]?.employees_total, 3046);
  });

  it("RPC error keeps original registry figures (silent fallback)", async () => {
    const client = {
      rpc: async () => ({
        data: null,
        error: { message: "boom" },
      }),
    };
    const rows = await enrichDiscoverWorkers(client, [
      { id: "a", employees_total: 144 },
    ]);
    assert.equal(rows[0]?.employees_total, 144);
  });
});
