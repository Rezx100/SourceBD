import assert from "node:assert/strict";
import { test } from "node:test";

import { RESET_WINDOW_SEC, signedInWithin } from "./recent-sign-in";

const NOW = 1_800_000_000;

test("a reset link used a minute ago is recent; one used past the window is not", () => {
  assert.equal(signedInWithin([{ method: "recovery", timestamp: NOW - 60 }], RESET_WINDOW_SEC, NOW), true);
  assert.equal(signedInWithin([{ method: "recovery", timestamp: NOW - RESET_WINDOW_SEC - 1 }], RESET_WINDOW_SEC, NOW), false);
});

test("a days-old password sign-in never counts, whatever else is in the claim", () => {
  assert.equal(
    signedInWithin([{ method: "password", timestamp: NOW - 3 * 86_400 }, { method: "otp" }], RESET_WINDOW_SEC, NOW),
    false,
  );
});

test("no claim, the timeless string form, or a time in the future counts as not recent", () => {
  for (const amr of [undefined, null, [], ["pwd"], [{ method: "otp", timestamp: "now" }], [{ timestamp: NOW + 3600 }]]) {
    assert.equal(signedInWithin(amr, RESET_WINDOW_SEC, NOW), false, JSON.stringify(amr));
  }
});
