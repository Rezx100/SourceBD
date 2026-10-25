// The motion foundation (M0, handoff-mercury-motion-sitewide.md §4), as it stands since every page took the home
// page's design (25 Oct 2026): nothing plays with no window, the marketing durations are the plan's, and the night
// ground comes from the tokens.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { motion as tokens, transitionDuration } from "@/lib/design/tokens";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const M = require("@/components/site/motion") as typeof import("@/components/site/motion");

describe("motion", () => {
  it("with no window there is nothing to play", () => {
    assert.equal(M.stillPreferred(), true);
  });

  it("the marketing durations are the plan's (§4)", () => {
    assert.equal(transitionDuration.reveal, `${tokens.revealMs}ms`);
    assert.equal("tone" in transitionDuration, false, "no ground crossfades any more");
    assert.deepEqual([tokens.risePx, tokens.swapOutMs, tokens.swapInMs, tokens.featureMs, tokens.marqueeMs, tokens.cursorMs, tokens.typeMs, tokens.streamMs], [24, 200, 320, 6500, 60000, 600, 45, 60]);
  });

  it("both grounds come from the tokens", () => {
    const config = readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");
    assert.match(config, /"--mk-ground-paper": toChannels\(resolve\(light, "canvas"\)\), "--mk-ground-night": toChannels\(homeGrounds\.night\.ground\)/);
  });

  it("the coded demos and their stage are gone: every picture of the product is a recording (founder, 25 Oct 2026)", () => {
    const src = readFileSync(join(process.cwd(), "components/site/motion.tsx"), "utf8");
    assert.doesNotMatch(src, /DemoStage|useScene|PageMain/);
  });
});
