import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDiscoverWorkersSelection,
  enrichDiscoverWorkers,
  familyRange,
  parseDisplayBatch,
  rangeWords,
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

describe("what the display figure covers comes from the batch, never from the numbers", () => {
  // Three earlier passes got this wrong. The last inferred composition by
  // comparing the display figure with the record's own: but the batch prefers
  // RSC, so a standalone factory whose RSC headcount differs from its register
  // figure read as "this record and its buildings" (639 live factories).
  // 0104's batch says which sites it summed; that is the only source now.
  const at = (
    value: number,
    source: "RSC" | "registry",
    sites?: number,
    includes_root?: boolean,
  ) => ({ value, source, fetched_at: null, ...(sites === undefined ? {} : { sites, includes_root }) });

  it("a standalone factory whose RSC figure differs from its register is still its own figure", () => {
    for (const rsc of [500, 600]) {
      const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 550 }], { a: at(rsc, "RSC", 1, true) });
      assert.equal(row?.workers_basis, "own", `RSC ${rsc} vs register 550 on one site called ${row?.workers_basis}`);
      assert.equal(row?.workers_own, 550);
    }
  });

  it("this record and at least one building is a group", () => {
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 2662 }], { a: at(3166, "registry", 2, true) });
    assert.equal(row?.workers_basis, "group");
    assert.equal(row?.employees_total, 3166);
    assert.equal(row?.workers_own, 2662);
  });

  it("a sum that leaves this record out says so, even when it has a figure of its own", () => {
    // RSC preference drops a root with no RSC row, register figure or not.
    for (const own of [null, 1200]) {
      // One building, and two: "sites > 1" must never outrank a sum that
      // leaves this record out, or it reads "this record and its buildings".
      for (const sites of [1, 2]) {
        const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: own }], { a: at(907, "RSC", sites, false) });
        assert.equal(row?.workers_basis, "excludes-record", `sites ${sites}, root left out, called ${row?.workers_basis}`);
        assert.equal(row?.workers_own, own);
      }
    }
  });

  it("without the batch's word, a differing figure is unknown, never a group", () => {
    const [same] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 900 }], { a: at(900, "registry") });
    const [diff] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 2662 }], { a: at(3166, "registry") });
    assert.equal(same?.workers_basis, "own");
    assert.equal(diff?.workers_basis, "unknown");
  });

  it("parseDisplayBatch carries the composition through, and only when both keys are sound", () => {
    const m = parseDisplayBatch({
      a: { value: 1, source: "RSC", fetched_at: null, sites: 2, includes_root: true },
      b: { value: 1, source: "RSC", fetched_at: null, sites: "2", includes_root: true },
    });
    assert.deepEqual([m.a?.sites, m.a?.includes_root], [2, true]);
    assert.deepEqual([m.b?.sites, m.b?.includes_root], [undefined, undefined]);
  });

  it("a row the batch does not answer for carries no basis at all", () => {
    const [row] = applyDiscoverWorkersSelection([{ id: "a", employees_total: 500 }], {});
    assert.equal(row?.workers_basis, undefined);
    assert.equal(row?.workers_source, undefined);
    assert.equal(row?.employees_total, 500);
  });
});

// Founder, 13 Oct 2026: a company with buildings shows its workforce as a range, the same on the
// record and in search. The live figures below are production's on that day (0148's dry run).
describe("familyRange: the workforce of a company with buildings", () => {
  it("runs from the larger of the two figures to their sum, rounded outwards", () => {
    // Anowara Fashions filed 280; its two attached buildings hold 801 + 21 on the safety register.
    assert.deepEqual(familyRange(280, 822), [800, 1150]);
    assert.equal(rangeWords([800, 1150]), "800–1,150");
    // Zaheen Knitwears filed 3,944; its sheds hold 1,634. The filing may already count them.
    assert.deepEqual(familyRange(3944, 1634), [3900, 5600]);
    // Under 500 the step is 10, so a small company's range is not swallowed by the rounding.
    assert.deepEqual(familyRange(120, 44), [120, 170]);
  });

  it("is nothing without both figures: a company alone keeps its one figure", () => {
    for (const [own, buildings] of [[280, null], [null, 822], [280, 0], [0, 822], [undefined, undefined]] as const) {
      assert.equal(familyRange(own, buildings), null);
    }
  });

  it("reaches a list row only when the database sent both figures", () => {
    const batch = parseDisplayBatch({
      a: { value: 822, source: "RSC", fetched_at: null, sites: 2, includes_root: false, own: 280, buildings: 822 },
      b: { value: 500, source: "registry", fetched_at: null, sites: 1, includes_root: true },
      c: { value: 900, source: "RSC", fetched_at: null, sites: 2, includes_root: true, own: 400 },
    });
    const rows = applyDiscoverWorkersSelection(
      [{ id: "a", employees_total: 280 }, { id: "b", employees_total: 500 }, { id: "c", employees_total: 400 }],
      batch,
    );
    assert.deepEqual(rows.map((r) => r.workers_range), [[800, 1150], null, null]);
    // The row's own figure is still there for the Workers sort.
    assert.equal(rows[0]?.workers_own, 280);
  });
});
