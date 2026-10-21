// The motion foundation (M0, handoff-mercury-motion-sitewide.md §4): a scene picks the right step for the time, the
// server draws a demo's last step (what reduced motion and a page with no script show), and every demo stage has its
// pause button.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { motion as tokens, transitionDuration } from "@/lib/design/tokens";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const M = require("@/components/site/motion") as typeof import("@/components/site/motion");

type S = { label: string; cursor?: string; click?: boolean };
const STEPS: { at: number; state: S }[] = [
  { at: 0, state: { label: "typing" } },
  { at: 900, state: { label: "rows", cursor: "row-1" } },
  { at: 1800, state: { label: "open", cursor: "row-1", click: true } },
];
const stage = (description = "A search for knit suppliers in Gazipur.") =>
  // eslint-disable-next-line react/no-children-prop -- a render function, which createElement's child list does not type.
  renderToStaticMarkup(createElement(M.DemoStage<S>, { steps: STEPS, description, children: (s: S) => createElement("p", { "data-cursor": "row-1" }, `step ${s.label}`) }));

describe("motion", () => {
  it("a scene shows the last step whose time has come", () => {
    assert.equal(M.stepAt(STEPS, 0), 0);
    assert.equal(M.stepAt(STEPS, 899), 0);
    assert.equal(M.stepAt(STEPS, 900), 1);
    assert.equal(M.stepAt(STEPS, 5000), 2);
    assert.equal(M.stepAt([{ at: 0, state: 1 }], 10), 0);
  });

  it("a scene starts from its finished step only when it is on screen as it mounts; out of sight it starts from its first (critique 22 Oct, S5)", () => {
    assert.equal(M.onScreen({ top: 120, bottom: 600 }, 900), true);
    assert.equal(M.onScreen({ top: 880, bottom: 1300 }, 900), true, "a sliver in view is on screen");
    assert.equal(M.onScreen({ top: 900, bottom: 1300 }, 900), false, "below the fold");
    assert.equal(M.onScreen({ top: -500, bottom: 0 }, 900), false, "scrolled past");
  });

  it("the server draws the last step: the page reads complete with no script and under reduced motion", () => {
    const out = stage();
    assert.match(out, /step open/);
    assert.doesNotMatch(out, /step typing|step rows/);
    assert.equal(M.stillPreferred(), true, "with no window there is nothing to play");
  });

  it("every demo stage has a labelled pause button, and the demo itself is hidden behind one sentence (WCAG 2.2.2)", () => {
    const out = stage();
    assert.match(out, /<button type="button" aria-label="Pause demo" aria-pressed="false"/);
    assert.match(out, /<figcaption class="sr-only">A search for knit suppliers in Gazipur\.<\/figcaption>/);
    assert.match(out, /<div aria-hidden="true"[^>]*><p data-cursor="row-1">step open<\/p><\/div>/);
  });

  it("the marketing durations are the plan's (§4)", () => {
    assert.equal(transitionDuration.reveal, `${tokens.revealMs}ms`);
    assert.equal(transitionDuration.tone, `${tokens.toneMs}ms`);
    assert.deepEqual([tokens.risePx, tokens.swapOutMs, tokens.swapInMs, tokens.tourItemMs, tokens.cursorMs, tokens.typeMs, tokens.streamMs], [24, 200, 320, 7000, 600, 45, 60]);
  });

  it("the tone shift renders the page's main landmark with its first tone", () => {
    const out = renderToStaticMarkup(createElement(M.ToneShift, { initial: "dark" }, createElement("section", { "data-tone": "dark" })));
    assert.match(out, /^<main id="main-content" data-tone="dark" data-ground="night"/);
    assert.match(renderToStaticMarkup(createElement(M.ToneShift, null, null)), /^<main id="main-content" data-tone="paper" class=/);
  });

  it("only the ground fades; nothing inside carries a tone transition, so text never passes through grey on grey (critique 22 Oct, S1)", () => {
    const night = renderToStaticMarkup(createElement(M.ToneShift, { initial: "dark" }, null));
    const paper = renderToStaticMarkup(createElement(M.ToneShift, null, null));
    assert.match(night, /class="[^"]*transition-\[background-color\][^"]*bg-\[rgb\(var\(--mk-ground-night\)\)\]"/);
    assert.match(paper, /class="[^"]*bg-\[rgb\(var\(--mk-ground-paper\)\)\]"/);
    assert.doesNotMatch(night, /transition-colors/);
    const config = readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");
    assert.doesNotMatch(config, /main\[data-tone\]\) \*/, "no rule fades every colour under the page");
    assert.match(config, /"--mk-ground-paper": toChannels\(resolve\(light, "canvas"\)\), "--mk-ground-night": toChannels\(resolve\(dark, "canvas"\)\)/, "both grounds come from the tokens");
  });

  it("the pause button sits under the demo's window, beside its caption, never over the product (critique 22 Oct, S6)", () => {
    const out = stage();
    const win = out.indexOf('data-ground="day"');
    const button = out.indexOf('aria-label="Pause demo"');
    assert.ok(win >= 0 && button > win);
    // The window closes before the row that holds the caption and the button opens.
    assert.match(out, /<\/div><\/div><div class="flex min-h-11[^"]*"><div class="min-w-0"><\/div><button type="button" aria-label="Pause demo"/);
  });
});
