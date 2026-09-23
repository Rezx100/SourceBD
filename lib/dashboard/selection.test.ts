import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  allOnPageSelected,
  announceBulkSaved,
  bulkExportHref,
  bulkSaveMessage,
  onBulkSaved,
  SEND_RFQ_MAX,
  selectAllState,
  toggleAllOnPage,
  toggleId,
} from "./selection";

describe("discover bulk-selection math", () => {
  it("toggles one id in and back out without touching the rest", () => {
    const start = new Set(["a", "b"]);
    const added = toggleId(start, "c");
    assert.deepEqual([...added].sort(), ["a", "b", "c"]);
    assert.deepEqual([...start].sort(), ["a", "b"], "the input set is not mutated");
    const removed = toggleId(added, "b");
    assert.deepEqual([...removed].sort(), ["a", "c"]);
  });

  it("select-all on a page with nothing selected selects every row", () => {
    const next = toggleAllOnPage(new Set(), ["p1", "p2", "p3"]);
    assert.deepEqual([...next].sort(), ["p1", "p2", "p3"]);
  });

  it("select-all on a PARTLY selected page selects the rest — it does not clear the page", () => {
    // The box reads "mixed" here, and clicking a mixed box completes it.
    const next = toggleAllOnPage(new Set(["p2"]), ["p1", "p2", "p3"]);
    assert.deepEqual([...next].sort(), ["p1", "p2", "p3"]);
  });

  it("select-all again, once every row is on, clears the page", () => {
    const next = toggleAllOnPage(new Set(["p1", "p2", "p3"]), ["p1", "p2", "p3"]);
    assert.deepEqual([...next], []);
  });

  it("the select-all box is checked, mixed or clear — never 'clear' over a partly selected page", () => {
    assert.equal(selectAllState(new Set(), ["p1", "p2"]), false);
    assert.equal(selectAllState(new Set(["p1"]), ["p1", "p2"]), "mixed");
    assert.equal(selectAllState(new Set(["p1", "p2"]), ["p1", "p2"]), true);
    assert.equal(selectAllState(new Set(), []), false);
  });

  it("select-all is off when only some of the page is selected — a half-checked page is not \"all\"", () => {
    assert.equal(allOnPageSelected(new Set(["p1"]), ["p1", "p2"]), false);
    assert.equal(allOnPageSelected(new Set(["p1", "p2"]), ["p1", "p2"]), true);
    // An empty page is never "all selected" — that reads as a checked
    // select-all box over zero rows, which is not a fact this page has.
    assert.equal(allOnPageSelected(new Set(), []), false);
  });

  it("the bulk Export link keeps the page's own query and adds the selection", () => {
    const page = "/api/v1/discover/export?q=knit&sort=name&page=3&per=25";
    const href = bulkExportHref(page, ["a", "b"]);
    assert.equal(href, `${page}&ids=a,b`);
    const u = new URL(href, "https://x.invalid");
    assert.equal(u.searchParams.get("page"), "3");
    assert.equal(u.searchParams.get("ids"), "a,b", "without ids the route exports the whole result set");
    assert.equal(bulkExportHref("/api/v1/discover/export", ["a"]), "/api/v1/discover/export?ids=a");
  });

  it("the bulk-save message names what happened and never asks for a retry that cannot work", () => {
    assert.equal(bulkSaveMessage(200, 1), "Saved 1 supplier");
    assert.equal(bulkSaveMessage(200, 7), "Saved 7 suppliers");
    assert.match(bulkSaveMessage(401, 3), /Sign in/);
    assert.doesNotMatch(bulkSaveMessage(401, 3), /try again/i);
    assert.match(bulkSaveMessage(429, 3), /minute/);
    assert.match(bulkSaveMessage(500, 3), /Try again/);
  });

  it("a bulk save reaches exactly the row buttons it saved, whatever the id's case", () => {
    const bus = new EventTarget();
    const hits: string[] = [];
    const offA = onBulkSaved(bus, "aaaa", () => hits.push("a"));
    onBulkSaved(bus, "bbbb", () => hits.push("b"));
    announceBulkSaved(bus, ["AAAA", "cccc"]);
    assert.deepEqual(hits, ["a"]);
    offA();
    announceBulkSaved(bus, ["aaaa"]);
    assert.deepEqual(hits, ["a"], "an unsubscribed button no longer hears");
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
