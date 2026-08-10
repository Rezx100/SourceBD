import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasCapacityData } from "./has-capacity-data";

function empty() {
  return {
    machines_sewing: null,
    production_capacity_dozen_yearly: null,
    production_capacity_pcs_day: null,
    employees_total: null,
    employees_male: null,
    employees_female: null,
    bepza_zone: null,
    factory_types: [] as string[],
  };
}

describe("hasCapacityData", () => {
  it("RSC-only workers open the Capacity tab when registry employees_total is null", () => {
    assert.equal(hasCapacityData(empty(), { value: 3046 }), true);
  });

  it("false when neither registry nor selected workers nor other capacity fields", () => {
    assert.equal(hasCapacityData(empty()), false);
    assert.equal(hasCapacityData(empty(), { value: null }), false);
  });

  it("still true from registry employees_total alone", () => {
    assert.equal(
      hasCapacityData({ ...empty(), employees_total: 144 }),
      true,
    );
  });
});
