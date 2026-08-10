/**
 * REZ-115 — buyer-facing BGMEA register wording from the pill label.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bgmeaRegisterPlainLabel } from "./bgmea-register-label";

describe("bgmeaRegisterPlainLabel", () => {
  it("names General and Associate from the view label", () => {
    assert.equal(bgmeaRegisterPlainLabel("BGMEA General member #"), "General member");
    assert.equal(
      bgmeaRegisterPlainLabel("BGMEA Associate member #"),
      "Associate member",
    );
  });

  it("does not invent a register from a legacy bare label", () => {
    assert.equal(bgmeaRegisterPlainLabel("BGMEA Reg #"), null);
    assert.equal(bgmeaRegisterPlainLabel(null), null);
  });
});
