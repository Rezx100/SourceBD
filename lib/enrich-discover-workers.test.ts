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

describe("what the headline worker figure covers is derived, not assumed", () => {
  // The batch returns {value, source, fetched_at} and says nothing about
  // composition — but the row still carries the record's OWN registry figure
  // when this runs, so the two together answer it. Two earlier passes missed
  // that: one marked every row a group (so "across this record and its
  // buildings" printed under every standalone factory), the other dropped
  // composition and labelled a roll-up "on the register", naming a register
  // that holds no such number.
  const at = (value: number, source: "RSC" | "registry" = "registry") => ({
    value,
    source,
    fetched_at: null,
  });

  it("equal figures mean the record's own number", () => {
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 900 }], { a: at(900) });
    assert.equal(row?.workers_basis, "own");
    assert.equal(row?.employees_total, 900);
  });

  it("a larger figure means the record plus buildings", () => {
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 2662 }], { a: at(3166) });
    assert.equal(row?.workers_basis, "group");
    assert.equal(row?.employees_total, 3166);
  });

  it("no figure of its own means the number belongs to other sites", () => {
    // The RSC-preferred sum covers RSC sites only, so a root that files no
    // RSC figure is dropped from its own headline number. Printed bare, that
    // tells a buyer a factory employs people it does not.
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: null }], { a: at(907, "RSC") });
    assert.equal(row?.workers_basis, "excludes-record");
    assert.equal(row?.workers_source, "RSC");
  });

  it("a row the batch does not answer for carries no basis at all", () => {
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 500 }], {});
    assert.equal(row?.workers_basis, undefined);
    assert.equal(row?.workers_source, undefined);
    assert.equal(row?.employees_total, 500);
  });

  it("the three states are genuinely distinguished, not a constant", () => {
    // Pinning the defect directly: hard-coding any one basis fails here.
    const rows = applyDiscoverWorkersSelection(
      [
        { id: "own", employees_total: 900 },
        { id: "group", employees_total: 2662 },
        { id: "none", employees_total: null },
      ],
      { own: at(900), group: at(3166), none: at(907, "RSC") },
    );
    assert.deepEqual(
      rows.map((r) => r.workers_basis),
      ["own", "group", "excludes-record"],
    );
  });
});
