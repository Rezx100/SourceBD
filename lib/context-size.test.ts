import test from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";

// Boot files are read by every agent session. They are capped so history
// gets archived instead of accumulating (AGENTS.md rule 3, workflow step 4).
// A failure here means "move closeouts to context/archive/", never "raise the cap".
const CAPS_BYTES: Record<string, number> = {
  "context/current-state.md": 16 * 1024,
  "context/feature-specs/active.md": 6 * 1024,
};

// npm test runs from the repo root; the compiled test lives under
// node_modules/.cache, so __dirname would point at the wrong tree.
const repoRoot = process.cwd();

for (const [rel, cap] of Object.entries(CAPS_BYTES)) {
  test(`${rel} stays under its boot cap (${cap / 1024} KB)`, () => {
    const size = statSync(path.join(repoRoot, rel)).size;
    assert.ok(
      size <= cap,
      `${rel} is ${size} bytes, cap is ${cap}. Archive dated sections into context/archive/ instead of raising the cap.`,
    );
  });
}
