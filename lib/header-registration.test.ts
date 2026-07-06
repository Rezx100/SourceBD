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
});
