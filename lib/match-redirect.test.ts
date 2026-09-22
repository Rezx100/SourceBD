import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { MATCH_PATH, MATCH_TARGET, matchRedirectSearch } from "./match-redirect";

describe("/app/match redirect", () => {
  it("turns Ask on and keeps everything the caller arrived with", () => {
    assert.equal(matchRedirectSearch(new URLSearchParams()), "?ask=1");
    assert.equal(matchRedirectSearch(new URLSearchParams("q=knit polo")), "?q=knit+polo&ask=1");
    assert.equal(
      matchRedirectSearch(new URLSearchParams("q=denim&district=Dhaka")),
      "?q=denim&district=Dhaka&ask=1",
    );
    // Ask already on, or explicitly off: the destination is Ask mode either way.
    assert.equal(matchRedirectSearch(new URLSearchParams("ask=0&q=x")), "?ask=1&q=x");
  });

  it("does not let the caller redirect themselves somewhere else", () => {
    // The target is a constant, never anything the caller supplied.
    assert.equal(MATCH_TARGET, "/app/discover");
    const out = matchRedirectSearch(new URLSearchParams("next=https://evil.example"));
    assert.ok(!out.includes("//evil.example"), out);
  });

  it("is the only implementation — both call sites go through it", () => {
    // The defect this closes: middleware.ts built the search string itself,
    // answered first, so the route handler that carried the query was dead and
    // the buyer's words were dropped. Two implementations of one redirect.
    // Neither file may rebuild the search string for itself again.
    const repoRoot = process.cwd();
    for (const rel of ["middleware.ts", "app/(app)/app/match/route.ts"]) {
      // Comments stripped: `src.includes("matchRedirectSearch")` was
      // satisfied by the name appearing in a comment while the handler built
      // the search string itself, and the hard-coded check missed any
      // spelling that was not exactly quote-?ask=1-quote.
      const src = readFileSync(path.join(repoRoot, rel), "utf8")
        .replace(new RegExp(String.raw`/\*[\s\S]*?\*/`, "g"), "")
        .replace(new RegExp(String.raw`(^|[^:])//.*$`, "gm"), "$1");
      assert.ok(
        src.includes("matchRedirectSearch"),
        `${rel} answers ${MATCH_PATH} without the shared helper`,
      );
      // Any way of naming the destination query itself, not just one
      // spelling: a literal "?ask=1", a bare "ask=1", or `set("ask", …)`
      // outside the helper. The helper is the only place that may say it.
      const spellsItOut = src.match(/["'`][?&]?ask=1["'`]|["'`]ask["'`]\s*,/g) ?? [];
      assert.equal(
        spellsItOut.length,
        0,
        `${rel} builds the Ask query itself (${spellsItOut[0]}); that is how the caller's query got dropped`,
      );
    }
  });
});
