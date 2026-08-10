import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAIN_PLANT_LABEL,
  asRscSites,
  buildingGroupKey,
  groupByBuilding,
  rscProgressPct,
  rscRowTitle,
  rscSiteLabel,
  shouldShowBuildingSectionHeading,
} from "./compliance-building-groups";

describe("buildingGroupKey", () => {
  it("maps empty / null to Main plant", () => {
    assert.deepEqual(buildingGroupKey(null), {
      key: "__main__",
      label: MAIN_PLANT_LABEL,
    });
    assert.deepEqual(buildingGroupKey("  "), {
      key: "__main__",
      label: MAIN_PLANT_LABEL,
    });
  });

  it("keeps facility suffix intact in the label", () => {
    const g = buildingGroupKey("EPYLLION STYLE LTD. (EXTENSION 2)");
    assert.equal(g.label, "EPYLLION STYLE LTD. (EXTENSION 2)");
    assert.equal(g.key, "epyllion style ltd. (extension 2)");
  });
});

describe("groupByBuilding", () => {
  it("returns empty for empty input", () => {
    assert.deepEqual(groupByBuilding([]), []);
  });

  it("puts Main plant first, then buildings in first-seen order", () => {
    const groups = groupByBuilding([
      { id: 1, building_name: "Unit-2" },
      { id: 2, building_name: null },
      { id: 3, building_name: "Extension" },
      { id: 4, building_name: "Unit-2" },
      { id: 5 },
    ]);
    assert.equal(groups.length, 3);
    assert.equal(groups[0]!.label, MAIN_PLANT_LABEL);
    assert.deepEqual(
      groups[0]!.items.map((r) => r.id),
      [2, 5],
    );
    assert.equal(groups[1]!.label, "Unit-2");
    assert.deepEqual(
      groups[1]!.items.map((r) => r.id),
      [1, 4],
    );
    assert.equal(groups[2]!.label, "Extension");
  });

  it("mother-only stays a single Main plant group", () => {
    const groups = groupByBuilding([
      { source_code: "BGMEA", building_name: null },
      { source_code: "RSC", building_name: undefined },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.label, MAIN_PLANT_LABEL);
    assert.equal(groups[0]!.items.length, 2);
  });

  it("facility-only has no Main plant group", () => {
    const groups = groupByBuilding([
      { building_name: "Ext A" },
      { building_name: "Ext B" },
    ]);
    assert.equal(groups.length, 2);
    assert.ok(groups.every((g) => g.label !== MAIN_PLANT_LABEL));
  });
});

describe("rscProgressPct / rscSiteLabel / headings", () => {
  it("clamps progress and leaves null/NaN alone", () => {
    assert.equal(rscProgressPct(null), null);
    assert.equal(rscProgressPct(100), 100);
    assert.equal(rscProgressPct(-5), 0);
    assert.equal(rscProgressPct(140), 100);
    assert.equal(rscProgressPct(Number.NaN), null);
  });

  it("labels missing building as Main plant", () => {
    assert.equal(rscSiteLabel(null), MAIN_PLANT_LABEL);
    assert.equal(rscSiteLabel("Green Textile Limited (Unit-3)"), "Green Textile Limited (Unit-3)");
  });

  it("suppresses Main plant heading and RSC title when only main", () => {
    assert.equal(shouldShowBuildingSectionHeading(1, "__main__"), false);
    assert.equal(shouldShowBuildingSectionHeading(2, "__main__"), true);
    assert.equal(shouldShowBuildingSectionHeading(1, "unit-2"), true);
    assert.equal(rscRowTitle(null, 1), null);
    assert.equal(rscRowTitle(null, 2), MAIN_PLANT_LABEL);
    assert.equal(rscRowTitle("Extension", 1), "Extension");
  });
});

describe("asRscSites", () => {
  it("returns null for null/undefined/empty array", () => {
    assert.equal(asRscSites(null), null);
    assert.equal(asRscSites(undefined), null);
    assert.equal(asRscSites([]), null);
  });

  it("wraps a legacy single object and passes arrays through", () => {
    const one = asRscSites({ progress_pct: 50 });
    assert.equal(one!.length, 1);
    assert.equal(asRscSites([{ a: 1 }, { a: 2 }])!.length, 2);
  });
});
