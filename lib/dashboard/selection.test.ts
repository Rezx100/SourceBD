import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { allOnPageSelected, SEND_RFQ_MAX, selectionCaption, toggleAllOnPage, toggleId } from "./selection";

describe("discover bulk-selection math", () => {
  it("toggles one id in and back out without touching the rest", () => {
    const start = new Set(["a", "b"]);
    const added = toggleId(start, "c");
    assert.deepEqual([...added].sort(), ["a", "b", "c"]);
    assert.deepEqual([...start].sort(), ["a", "b"], "the input set is not mutated");
    const removed = toggleId(added, "b");
    assert.deepEqual([...removed].sort(), ["a", "c"]);
  });

  it("select-all on the page adds every page id and keeps any already selected off-page", () => {
    const start = new Set(["from-a-previous-page"]);
    const next = toggleAllOnPage(start, ["p1", "p2", "p3"]);
    assert.deepEqual([...next].sort(), ["from-a-previous-page", "p1", "p2", "p3"]);
  });

  it("select-all again, once every page id is already on, clears just the page ids", () => {
    const start = new Set(["from-a-previous-page", "p1", "p2", "p3"]);
    const next = toggleAllOnPage(start, ["p1", "p2", "p3"]);
    assert.deepEqual([...next], ["from-a-previous-page"]);
  });

  it("select-all is off when only some of the page is selected — a half-checked page is not \"all\"", () => {
    assert.equal(allOnPageSelected(new Set(["p1"]), ["p1", "p2"]), false);
    assert.equal(allOnPageSelected(new Set(["p1", "p2"]), ["p1", "p2"]), true);
    // An empty page is never "all selected" — that reads as a checked
    // select-all box over zero rows, which is not a fact this page has.
    assert.equal(allOnPageSelected(new Set(), []), false);
  });

  it("captions pluralise on the count, not a hardcoded word", () => {
    assert.equal(selectionCaption(1), "1 supplier selected");
    assert.equal(selectionCaption(0), "0 suppliers selected");
    assert.equal(selectionCaption(7), "7 suppliers selected");
  });

  it("SEND_RFQ_MAX stays pinned to the API's own MAX_TARGETS", () => {
    // Two numbers for one question is exactly how the SQL replay guard
    // rotted in the REZ-B cycles: a restated constant that quietly drifts
    // from the value that actually enforces the rule. Read the API's cap out
    // of its source instead of copying the digits a second time.
    const src = readFileSync(path.join(process.cwd(), "app/api/v1/rfqs/route.ts"), "utf8");
    const m = src.match(/const MAX_TARGETS = (\d+);/);
    assert.ok(m, "could not read MAX_TARGETS out of app/api/v1/rfqs/route.ts");
    assert.equal(SEND_RFQ_MAX, Number(m[1]));
  });
});
