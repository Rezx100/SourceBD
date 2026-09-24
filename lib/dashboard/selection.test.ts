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
  interceptPlainClick,
  pruneToPage,
  reserveBarSpace,
  rowSaveMessage,
  runExport,
  saveBlob,
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
    assert.match(bulkSaveMessage(404, 2), /nothing was saved/);
    assert.match(bulkSaveMessage(409, 2), /Save again/);
  });

  it("every export refusal becomes a sentence, and a short file is called short", () => {
    assert.match(exportMessage(429, {}), /Wait a minute/);
    assert.match(exportMessage(409, {}), /Reload the page/);
    assert.match(exportMessage(403, {}), /buyer account/);
    assert.match(exportMessage(401, {}), /buyer account/);
    assert.match(exportMessage(503, {}), /Try again/);
    assert.equal(exportMessage(200, { rows: 3, requested: 3 }), "Export downloaded.");
    assert.match(exportMessage(200, { rows: 2, requested: 5 }), /^Exported 2 of 5\. 3 are no longer/);
    assert.equal(exportMessage(200, { rows: NaN, requested: 5 }), "Export downloaded.");
    // The full export at its cap: the sentence says it stopped, like the filename.
    assert.match(exportMessage(200, { rows: 1000, matched: 3481, truncated: true }), /first 1000 of 3481/);
    assert.doesNotMatch(exportMessage(200, { rows: 245, matched: 300, truncated: true }), /stops at 245/, "the cap is not the row count");
    assert.match(exportMessage(200, { rows: 1000, truncated: true }), /first 1000 suppliers/);
    assert.equal(exportMessage(200, { rows: 1000, matched: 1000, truncated: false }), "Export downloaded.");
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

  it("only the buyer's own changes count as edits — a refresh's pruning does not", () => {
    // The bar clears its message on edits. A partial save's refresh prunes
    // the gone supplier; if that counted, "1 is no longer listed" vanished
    // the moment it arrived.
    let state: ReadonlySet<string> = new Set(["a", "b", "x"]);
    let edits = 0;
    const set = (f: (s: ReadonlySet<string>) => ReadonlySet<string>) => {
      state = f(state);
    };
    const v = () => selectionValue(state, ["a", "b", "c"], set, edits, () => (edits += 1));
    state = pruneToPage(state, ["a", "b", "c"]);
    assert.equal(edits, 0, "a prune is not an edit");
    v().toggle("c");
    v().toggleAllOnPage();
    v().clear();
    assert.equal(edits, 3, "tick, select-all and clear each count once");
  });

  it("a refresh that drops a selected row off the page drops it from the selection too", () => {
    const same = new Set(["a", "b"]);
    assert.equal(pruneToPage(same, ["a", "b", "c"]), same, "unchanged selection is the same object, so setState bails out");
    assert.deepEqual([...pruneToPage(new Set(["a", "b", "x"]), ["a", "b", "c"])].sort(), ["a", "b"]);
    assert.equal(pruneToPage(new Set(["x"]), []).size, 0);
  });

  it("Clear moves focus BEFORE it empties the selection that unmounts the bar", () => {
    const order: string[] = [];
    clearKeepingFocus({ focus: () => order.push("focus") }, () => order.push("clear"));
    assert.deepEqual(order, ["focus", "clear"]);
    clearKeepingFocus(null, () => order.push("clear"));
    assert.deepEqual(order, ["focus", "clear", "clear"], "a missing target still clears");
  });

  it("the bar reserves its height, scrolls the focused box clear when it mounts, re-fits the padding on re-wraps, and gives the space back (WCAG 2.4.11)", () => {
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

  it("a height-only window resize re-reads 'sticky': shrink below 32rem and the reserved space is handed back", () => {
    const root = { style: { scrollPaddingBottom: "" } };
    let sticky = true;
    let onResize: (() => void) | null = null;
    let unsubscribed = false;
    const undo = reserveBarSpace(root, { offsetHeight: 100 }, null, null, () => sticky, (fit) => {
      onResize = fit;
      return () => (unsubscribed = true);
    });
    assert.equal(root.style.scrollPaddingBottom, "108px");
    sticky = false;
    onResize!();
    assert.equal(root.style.scrollPaddingBottom, "", "an in-flow bar must not keep reserving space");
    sticky = true;
    onResize!();
    assert.equal(root.style.scrollPaddingBottom, "108px");
    undo();
    assert.equal(unsubscribed, true);
  });

  it("a bar that is NOT sticky (a short window, where it sits in flow) reserves nothing and scrolls nothing", () => {
    const root = { style: { scrollPaddingBottom: "4px" } };
    const scrolled: unknown[] = [];
    const undo = reserveBarSpace(root, { offsetHeight: 233 }, { scrollIntoView: (o) => scrolled.push(o) }, null, () => false);
    assert.equal(root.style.scrollPaddingBottom, "4px");
    assert.deepEqual(scrolled, []);
    undo();
    assert.equal(root.style.scrollPaddingBottom, "4px");
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

    it("an error page that is not JSON (a proxy's HTML 502) is still reported as the failure it is", async () => {
      const msg = await runBulkSave(["a"], {
        fetch: async () => ({ ok: false, status: 502, json: async () => JSON.parse("<html>bad gateway</html>") }),
        onSaved: () => assert.fail("onSaved on a 502"),
      });
      assert.match(msg, /Could not save them\. Try again\./);
      assert.doesNotMatch(msg, /no connection/);
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

  it("a row's Save names each outcome, including a supplier no longer listed", () => {
    assert.equal(rowSaveMessage(200, true), "Saved");
    assert.equal(rowSaveMessage(200, false), "Removed from saved");
    assert.match(rowSaveMessage(404, true), /no longer listed/);
    assert.match(rowSaveMessage(401, true), /Sign in/);
    assert.match(rowSaveMessage("network", true), /no connection/);
    assert.match(rowSaveMessage(500, true), /Try again/);
  });

  describe("Export, downloaded in place", () => {
    it("takes over only a plain left click; a modifier or middle click opens the link as usual", () => {
      const click = (over: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number }> = {}) => {
        let prevented = 0;
        const ours = interceptPlainClick({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, ...over, preventDefault: () => (prevented += 1) });
        return { ours, prevented };
      };
      assert.deepEqual(click(), { ours: true, prevented: 1 });
      for (const over of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
        assert.deepEqual(click(over), { ours: false, prevented: 0 }, JSON.stringify(over));
      }
    });

    const response = (status: number, headers: Record<string, string> = {}) => ({
      ok: status < 300,
      status,
      headers: { get: (n: string) => headers[n] ?? null },
      blob: async () => "csv-bytes",
    });

    it("saves the body once, under the server's own filename, and says when the file is short", async () => {
      const saved: [unknown, string][] = [];
      const msg = await runExport("/api/v1/discover/export?ids=a,b,c", 3, {
        fetch: async () =>
          response(200, {
            "Content-Disposition": 'attachment; filename="sourcebd-suppliers-2026-09-23-selected-2-of-3.csv"',
            "X-SourceBD-Rows": "2",
          }),
        save: (blob, name) => saved.push([blob, name]),
      });
      assert.deepEqual(saved, [["csv-bytes", "sourcebd-suppliers-2026-09-23-selected-2-of-3.csv"]]);
      assert.match(msg, /^Exported 2 of 3\./);
    });

    it("an ordinary full export (no truncation header) is just 'downloaded'", async () => {
      const msg = await runExport("/x", undefined, {
        fetch: async () => response(200, { "Content-Disposition": 'attachment; filename="f.csv"', "X-SourceBD-Rows": "12", "X-SourceBD-Matched": "12" }),
        save: () => {},
      });
      assert.equal(msg, "Export downloaded.");
    });

    it("with no filename header the file still gets a sensible name", async () => {
      const names: string[] = [];
      await runExport("/x", undefined, { fetch: async () => response(200, {}), save: (_b, n) => names.push(n) });
      assert.deepEqual(names, ["sourcebd-suppliers.csv"]);
    });

    it("the full export at its cap says so", async () => {
      const msg = await runExport("/x", undefined, {
        fetch: async () =>
          response(200, { "Content-Disposition": 'attachment; filename="f.csv"', "X-SourceBD-Rows": "1000", "X-SourceBD-Matched": "3481", "X-SourceBD-Truncated": "1" }),
        save: () => {},
      });
      assert.match(msg, /first 1000 of 3481/);
    });

    it("a refusal saves nothing and becomes a sentence; so does a dropped connection", async () => {
      for (const status of [400, 409, 429, 503]) {
        let saves = 0;
        const msg = await runExport("/x", 2, { fetch: async () => response(status), save: () => (saves += 1) });
        assert.equal(saves, 0, `saved a file on ${status}`);
        assert.doesNotMatch(msg, /[{}]/);
      }
      const offline = await runExport("/x", 2, {
        fetch: async () => {
          throw new TypeError("Failed to fetch");
        },
        save: () => assert.fail("saved offline"),
      });
      assert.match(offline, /no connection/);
    });

    it("saveBlob clicks one anchor carrying the filename, then revokes the URL later, not at once", () => {
      const events: string[] = [];
      const anchor = { href: "", download: "", click: () => events.push("click"), remove: () => events.push("remove") };
      const later: { fn?: () => void } = {};
      saveBlob(
        { createElement: () => anchor, body: { appendChild: () => events.push("append") } },
        { createObjectURL: () => "blob:1", revokeObjectURL: (u) => events.push(`revoke ${u}`) },
        (fn) => (later.fn = fn),
        "bytes",
        "sourcebd.csv",
      );
      assert.equal(anchor.href, "blob:1");
      assert.equal(anchor.download, "sourcebd.csv", "without download= the blob URL navigates the tab");
      assert.deepEqual(events, ["append", "click", "remove"]);
      assert.ok(later.fn, "the revoke was not deferred");
      later.fn();
      assert.deepEqual(events, ["append", "click", "remove", "revoke blob:1"]);
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
