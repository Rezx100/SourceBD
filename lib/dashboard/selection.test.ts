import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  allOnPageSelected,
  announceBulkSaved,
  bulkExportHref,
  bulkSaveMessage,
  clearKeepingFocus,
  exportMessage,
  reserveBarSpace,
  runBulkSave,
  selectionValue,
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

  it("a bulk save says how many selected suppliers were no longer listed", () => {
    assert.equal(bulkSaveMessage(200, 3, 0), "Saved 3 suppliers");
    assert.match(bulkSaveMessage(200, 3, 2), /^Saved 3 suppliers\. 2 are no longer listed/);
    assert.match(bulkSaveMessage(200, 0, 1), /1 is no longer listed and was not saved/);
  });

  it("every export refusal becomes a sentence, and a short file is called short", () => {
    assert.match(exportMessage(429, {}), /Wait a minute/);
    assert.match(exportMessage(409, {}), /Reload the page/);
    assert.match(exportMessage(403, {}), /buyer account/);
    assert.match(exportMessage(503, {}), /Try again/);
    assert.equal(exportMessage(200, { rows: 3, requested: 3 }), "Export downloaded.");
    assert.match(exportMessage(200, { rows: 2, requested: 5 }), /^Exported 2 of 5\. 3 are no longer/);
    assert.equal(exportMessage(200, { rows: NaN, requested: 5 }), "Export downloaded.");
    for (const st of [400, 401, 403, 409, 429, 500, 503, "network"] as const) {
      assert.doesNotMatch(exportMessage(st, {}), /[{}"]/, "never raw JSON");
    }
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

  it("the provider's value reports mixed, toggles through its setter, and clears", () => {
    let state: ReadonlySet<string> = new Set(["p1"]);
    const set = (f: (s: ReadonlySet<string>) => ReadonlySet<string>) => {
      state = f(state);
    };
    const v = selectionValue(state, ["p1", "p2"], set);
    assert.equal(v.interactive, true);
    assert.equal(v.allState, "mixed");
    assert.equal(v.isSelected("p1"), true);
    v.toggleAllOnPage();
    assert.deepEqual([...state].sort(), ["p1", "p2"]);
    v.toggle("p1");
    assert.deepEqual([...state], ["p2"]);
    v.clear();
    assert.equal(state.size, 0);
  });

  it("Clear moves focus BEFORE it empties the selection that unmounts the bar", () => {
    const order: string[] = [];
    clearKeepingFocus({ focus: () => order.push("focus") }, () => order.push("clear"));
    assert.deepEqual(order, ["focus", "clear"]);
    clearKeepingFocus(null, () => order.push("clear"));
    assert.deepEqual(order, ["focus", "clear", "clear"], "a missing target still clears");
  });

  it("the bar reserves its height, re-scrolls the focused box, follows re-wraps, and gives the space back (WCAG 2.4.11)", () => {
    const root = { style: { scrollPaddingBottom: "4px" } };
    const bar = { offsetHeight: 56 };
    const scrolled: unknown[] = [];
    let fit: (() => void) | null = null;
    let observed: unknown = null;
    let disconnected = false;
    const undo = reserveBarSpace(root, bar, { scrollIntoView: (o) => scrolled.push(o) }, (f) => {
      fit = f;
      return { observe: (t) => (observed = t), disconnect: () => (disconnected = true) };
    });
    assert.equal(root.style.scrollPaddingBottom, "64px");
    assert.deepEqual(scrolled, [{ block: "nearest" }], "the box ticked to show the bar may now be under it");
    assert.equal(observed, bar);
    bar.offsetHeight = 120;
    fit!();
    assert.equal(root.style.scrollPaddingBottom, "128px", "a wrapped bar is taller");
    undo();
    assert.equal(root.style.scrollPaddingBottom, "4px");
    assert.equal(disconnected, true);
  });

  describe("the bar's bulk save", () => {
    const ok = (body: unknown, status = 200) => async () => ({ ok: status < 300, status, json: async () => body });

    it("sends every selected id in one request and announces only what the server saved", async () => {
      const sent: { url: string; body: string }[] = [];
      const saved: string[][] = [];
      const msg = await runBulkSave(["a", "b", "c"], {
        fetch: async (url, init) => {
          sent.push({ url, body: init.body });
          return ok({ count: 2, skipped: 1, ids: ["a", "b"] })();
        },
        onSaved: (ids) => saved.push(ids),
      });
      assert.equal(sent.length, 1);
      assert.equal(sent[0]?.url, "/api/v1/saved");
      assert.deepEqual(JSON.parse(sent[0]?.body ?? "{}"), { supplier_ids: ["a", "b", "c"] });
      assert.deepEqual(saved, [["a", "b"]]);
      assert.match(msg, /^Saved 2 suppliers\. 1 is no longer listed/);
    });

    it("on a refusal it neither announces nor refreshes, and says why", async () => {
      for (const [status, re] of [[401, /Sign in/], [429, /minute/], [500, /Try again/]] as const) {
        let called = false;
        const msg = await runBulkSave(["a"], { fetch: ok({ error: "x" }, status), onSaved: () => (called = true) });
        assert.equal(called, false, `onSaved ran on ${status}`);
        assert.match(msg, re);
      }
    });

    it("a dropped connection is a message, not an unhandled rejection", async () => {
      const msg = await runBulkSave(["a"], {
        fetch: async () => {
          throw new TypeError("Failed to fetch");
        },
        onSaved: () => assert.fail("onSaved on a network error"),
      });
      assert.match(msg, /no connection/);
    });
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
