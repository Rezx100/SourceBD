import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cleanAddressString,
  mergeUniqueLocations,
  normaliseAddressKey,
} from "./dedup-addresses";

describe("mergeUniqueLocations", () => {
  it("merges Maymashingo and Mymensing variants at Sm Tower 80/6 with both authorities", () => {
    const rows = [
      {
        kind: "registered",
        address: "Sm Tower, 80/6 Maymashingo Road, Dhaka",
        source_code: "EPB",
        fetched_at: "2026-06-27T00:00:00Z",
      },
      {
        kind: "factory",
        address: "Sm Tower, 80/6 Mymensing Road, Dhaka",
        source_code: "BGMEA",
        fetched_at: "2026-06-27T00:00:00Z",
      },
    ] as const;

    const merged = mergeUniqueLocations([...rows]);

    assert.equal(merged.length, 1);
    assert.ok(merged[0]!.authorities.includes("EPB"));
    assert.ok(merged[0]!.authorities.includes("BGMEA"));
    assert.ok(merged[0]!.displayAddress.length >= rows[0]!.address.length);
  });

  it("normalises spelling variants to the same token key", () => {
    const a = normaliseAddressKey("Sm Tower, 80/6 Maymashingo Road, Dhaka");
    const b = normaliseAddressKey("Sm Tower, 80/6 Mymensing Road, Dhaka");
    assert.ok(a.includes("mymensingh"));
    assert.ok(b.includes("mymensingh"));
  });
});

describe("cleanAddressString", () => {
  it("drops empty segments so double commas never render", () => {
    assert.equal(
      cleanAddressString("Sm Tower,, 80/6 Road, , Dhaka"),
      "Sm Tower, 80/6 Road, Dhaka",
    );
  });
});
