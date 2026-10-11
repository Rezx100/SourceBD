import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { exportsCell, exportsHead } from "@/lib/dashboard/customs-search";
import { EMPTY_STATE, exportsSort, exportsView, parseDiscoverState, queryTitle, serializeDiscoverState, withoutExports } from "@/lib/discover-v32-state";

describe("exportsCell — line 1 the sort's figure, line 2 the shipments (Paper boards E, J1)", () => {
  const f = { fob_usd: 97_600_000, shipments: 4652, buyers: 131 };

  it("average shipment: to three figures, then the shipment count", () => {
    assert.deepEqual(exportsCell({ fob_usd: 21_760_000, shipments: 406, buyers: 30 }, "avg_shipment"), { key: "US$53,600 a shipment", detail: "406 shipments", shipments: "406 shipments" });
  });

  it("export value: the short figure over shipments and buyers", () => {
    assert.deepEqual(exportsCell(f, "export_value"), { key: "US$97.6m", detail: "4,652 shipments · 131 buyers", shipments: "4,652 shipments" });
  });

  it("shipments and buyers lead with their own figure", () => {
    assert.equal(exportsCell(f, "shipments").key, "4,652 shipments");
    assert.equal(exportsCell(f, "buyers").key, "131 buyers");
    assert.equal(exportsCell(f, "buyers").detail, "4,652 shipments");
  });

  it("a missing value never prints a made-up figure", () => {
    const c = exportsCell({ fob_usd: null, shipments: 12, buyers: null }, "avg_shipment");
    assert.equal(c.key, "12 shipments");
    assert.doesNotMatch(JSON.stringify(c), /US\$|NaN|null/);
  });

  it("the head names line 1", () => {
    assert.equal(exportsHead("avg_shipment"), "Average shipment");
    assert.equal(exportsHead("workers"), "Export value");
  });
});

describe("the exports view in the URL", () => {
  it("round-trips its three parameters and drops unknown values", () => {
    const s = parseDiscoverState({ exports: "1", exports_min: "10", ships: "uk", sort: "buyers" });
    assert.equal(serializeDiscoverState(s).toString(), "sort=buyers&exports=1&exports_min=10&ships=uk");
    const bad = parseDiscoverState({ exports_min: "7", ships: "fr", sort: "nope" });
    assert.equal(bad.exportsMin, null);
    assert.equal(bad.ships, null);
    assert.equal(bad.sort, "sources");
  });

  it("is on only for an entitled reader, and any exports parameter or sort turns it on", () => {
    for (const over of [{ exports: true }, { exportsMin: 1 as const }, { ships: "eu" as const }, { sort: "avg_shipment" as const }]) {
      const s = { ...EMPTY_STATE, ...over };
      assert.equal(exportsView(s, true), true, JSON.stringify(over));
      assert.equal(exportsView(s, false), false, `${JSON.stringify(over)} turned the view on for a reader who may not see it`);
    }
    assert.equal(exportsView(EMPTY_STATE, true), false);
  });

  it("orders by average shipment unless the buyer chose an exports sort, workers or name", () => {
    assert.equal(exportsSort({ ...EMPTY_STATE, exports: true }), "avg_shipment");
    assert.equal(exportsSort({ ...EMPTY_STATE, sort: "hs_lines" }), "avg_shipment");
    assert.equal(exportsSort({ ...EMPTY_STATE, sort: "name" }), "name");
    assert.equal(exportsSort({ ...EMPTY_STATE, sort: "shipments" }), "shipments");
  });

  it("names a saved or recent exports search by the view, not as every supplier", () => {
    assert.equal(queryTitle({ ...EMPTY_STATE, exports: true }), "Has customs exports");
    assert.equal(queryTitle({ ...EMPTY_STATE, sort: "buyers", type: ["factory"] }), "Has customs exports · Factory");
  });

  it("switching it off clears every exports parameter and an exports sort", () => {
    const off = withoutExports({ ...EMPTY_STATE, exports: true, exportsMin: 50, ships: "ca", sort: "export_value", page: 3 });
    assert.equal(exportsView(off, true), false);
    assert.equal(off.page, 1);
    assert.equal(off.sort, "sources");
  });
});
