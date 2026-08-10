import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  registryPillRef,
  resolveHeaderRegistration,
} from "./header-registration";

describe("header registration", () => {
  const pills = [
    { source_code: "BGMEA", value: "general-48291" },
    { source_code: "EPB", value: "BD06289", inherited_from: "parent-id" },
    { source_code: "EPB", value: "8006289" },
  ] as const;

  it("header registration ref matches the EPB compliance registry ref", () => {
    const epbRef = registryPillRef(pills, "EPB");
    const header = resolveHeaderRegistration(pills);

    assert.equal(epbRef, "8006289");
    assert.ok(header);
    assert.equal(header.sourceCode, "EPB");
    assert.equal(header.value, epbRef);
    assert.equal(header.statValue, "EPB 8006289");
  });

  it("ignores facility-labelled pills so a building EPB cannot become the mother filing", () => {
    const mixed = [
      {
        source_code: "EPB",
        value: "FACILITY-ONLY",
        building_name: "Acme Ltd (Extension)",
      },
      { source_code: "EPB", value: "8006289" },
    ];
    assert.equal(registryPillRef(mixed, "EPB"), "8006289");
    const header = resolveHeaderRegistration(mixed);
    assert.ok(header);
    assert.equal(header.value, "8006289");
  });

  it("returns null when only facility-labelled EPB/RJSC/BIN exist", () => {
    const onlyFacility = [
      {
        source_code: "EPB",
        value: "FACILITY-ONLY",
        building_name: "Acme Ltd (Unit-2)",
      },
    ];
    assert.equal(registryPillRef(onlyFacility, "EPB"), null);
    assert.equal(resolveHeaderRegistration(onlyFacility), null);
  });
});
