// Behaviour of the results page's client controls, by invoking their REAL
// handlers (hook-harness.ts) rather than reading their source. Every test
// here stubs the browser globals its handler touches and restores them.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { Button } from "./controls";
import { EARLIER, ExportLink, STILL_EXPORTING } from "./export-link";
import { callWithHooks, findAll, textOf } from "./hook-harness";
import { SaveRecordButton } from "./save-record-button";
import { SaveSearchForm } from "./save-search-form";
import { SelectionBar, STILL_SAVING } from "./selection-bar";
import { SELECT_ALL_ID, SelectionContext, type SelectionContextValue } from "./selection";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};
function stub(name: string, value: unknown) {
  if (!(name in saved)) saved[name] = g[name];
  g[name] = value;
}
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) g[k] = v;
  for (const k of Object.keys(saved)) delete saved[k];
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status < 300,
  status,
  headers: new Headers(headers),
  json: async () => body,
  blob: async () => new Blob(["a,b\n"]),
});

function selection(ids: string[], over: Partial<SelectionContextValue> = {}): SelectionContextValue {
  return {
    interactive: true,
    selected: new Set(ids),
    isSelected: (id) => ids.includes(id),
    toggle: () => {},
    toggleAllOnPage: () => {},
    allState: false,
    clear: () => {},
    edits: 0,
    ...over,
  };
}

function bar(sel: SelectionContextValue, router: { refresh(): void }, state?: unknown[]) {
  return callWithHooks(SelectionBar, { exportHref: "/api/v1/discover/export?q=knit&page=2" }, {
    state,
    contexts: new Map<unknown, unknown>([
      [SelectionContext, sel],
      [AppRouterContext, router],
    ]),
  });
}

const buttonNamed = (tree: unknown, label: string) => {
  const found = findAll(tree as never, (el) => el.type === Button && textOf(el.props.children as never).trim() === label);
  assert.equal(found.length, 1, `expected one "${label}" button, found ${found.length}`);
  return found[0]!;
};

describe("the bulk bar's handlers, invoked", () => {
  // Hook order in SelectionBar: state 0 busy, 1 status, 2 exportStatus;
  // refs 0 barRef, 1 generation, 2 saving; effect 0 the edits reset.
  it("Save sends the WHOLE selection in one request, announces and refreshes once, and reports", async () => {
    const bodies: unknown[] = [];
    let refreshes = 0;
    stub("window", new EventTarget());
    stub("fetch", async (url: string, init: { body: string }) => {
      bodies.push({ url, body: JSON.parse(init.body) });
      return json(200, { ok: true, count: 3, skipped: 0, ids: [A, B, C] });
    });
    const run = bar(selection([A, B, C]), { refresh: () => (refreshes += 1) });
    const save = buttonNamed(run.out, "Save");
    await (save.props.onClick as () => Promise<void>)();
    assert.deepEqual(bodies, [{ url: "/api/v1/saved", body: { supplier_ids: [A, B, C] } }]);
    assert.equal(refreshes, 1);
    const statuses = run.sets.filter((s) => s.hook === 1).map((s) => s.value);
    assert.deepEqual(statuses.slice(-1), ["Saved 3 suppliers"]);
    const busy = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.deepEqual(busy, [true, false], "busy must be released");
  });

  it("a full page of 100 selected goes in that one request, every id", async () => {
    // Three ids could not tell "the whole selection" from "the first 30".
    const many = Array.from({ length: 100 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const sent: string[][] = [];
    stub("window", new EventTarget());
    stub("fetch", async (_url: string, init: { body: string }) => {
      sent.push((JSON.parse(init.body) as { supplier_ids: string[] }).supplier_ids);
      return json(200, { ok: true, count: many.length, skipped: 0, ids: many });
    });
    const run = bar(selection(many), { refresh: () => {} });
    await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
    assert.deepEqual(sent, [many]);
  });

  it("one save at a time: a second click while one runs sends nothing and says why", async () => {
    // Two saves in flight let a slow earlier one's result, or its failure,
    // be lost behind the newer one. Now there is never a second.
    stub("window", new EventTarget());
    let release: (v: unknown) => void = () => {};
    let calls = 0;
    stub("fetch", async () => {
      calls += 1;
      // Only the first hangs; a second, if one went out, answers at once, so
      // the test fails rather than waits.
      if (calls > 1) return json(200, { ok: true, count: 1, skipped: 0, ids: [A] });
      return new Promise((r) => (release = r));
    });
    const run = bar(selection([A]), { refresh: () => {} });
    const save = buttonNamed(run.out, "Save").props.onClick as () => Promise<void>;
    const first = save();
    await save(); // double click, or a click after a selection change
    assert.equal(calls, 1, "a second save went out while the first was running");
    assert.equal(run.sets.filter((x) => x.hook === 1).map((x) => x.value).pop(), STILL_SAVING);
    release(json(200, { ok: true, count: 1, skipped: 0, ids: [A] }));
    await first;
  });

  it("a selection change mid-save does not interrupt it; its result, or its failure, is said for the earlier selection", async () => {
    for (const [status, body, said] of [
      [200, { ok: true, count: 1, skipped: 0, ids: [A] }, "For your earlier selection: Saved 1 supplier"],
      [429, { error: "rate_limited" }, "For your earlier selection: Too many saves in the last minute. Wait a minute and save again."],
    ] as const) {
      stub("window", new EventTarget());
      let run: ReturnType<typeof bar> | null = null;
      stub("fetch", async () => {
        run!.effects[0]!(); // the buyer ticks another box: the real edits effect
        return json(status, body);
      });
      run = bar(selection([A], { edits: 7 }), { refresh: () => {} });
      assert.deepEqual(run.deps[0], [7], "the bar's reset is not keyed on the buyer's edits");
      await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
      const statuses = run.sets.filter((x) => x.hook === 1).map((x) => x.value);
      // The reset did not wipe the running save's status, and the outcome
      // is never a bare "Saved 1" that reads as the new selection.
      assert.deepEqual(statuses, ["", said], `${status}: ${JSON.stringify(statuses)}`);
      assert.deepEqual(run.sets.filter((x) => x.hook === 0).map((x) => x.value), [true, false]);
    }
  });

  it("an idle message goes on the next selection change", () => {
    const run = bar(selection([A]), { refresh: () => {} }, [false, "Saved 1 supplier", ""]);
    run.effects[0]!();
    assert.deepEqual(run.sets.filter((x) => x.hook === 1).map((x) => x.value), [""]);
  });

  it("after Clear the bar stays while a save runs or its outcome shows, and shows it", () => {
    // Clear used to hide the bar, and with it the only place a late outcome
    // could be read. Nothing selected, but something to say: the bar stays.
    const running = bar(selection([]), { refresh: () => {} }, [true, "", ""]);
    assert.ok(findAll(running.out as never, (el) => el.props.role === "group").length === 1, "the bar went while a save was running");
    for (const [state, text] of [
      [[false, "For your earlier selection: Too many saves.", ""], "For your earlier selection: Too many saves."],
      [[false, "", "For your earlier selection: Exported 2 suppliers."], "For your earlier selection: Exported 2 suppliers."],
    ] as const) {
      const shown = bar(selection([]), { refresh: () => {} }, [...state]);
      const regions = findAll(shown.out as never, (el) => el.type === "span" && el.props.role === "status" && !String(el.props.className ?? "").includes("sr-only"));
      assert.ok(regions.some((r) => textOf(r.props.children as never).includes(text)), `not on screen after Clear: ${text}`);
      // No action is offered on nothing, but the Export inside stays mounted.
      const actions = findAll(shown.out as never, (el) => el.props.hidden === true);
      assert.equal(actions.length, 1, "the actions are not hidden with nothing selected");
      assert.equal(findAll(actions[0] as never, (el) => el.type === ExportLink).length, 1, "the Export was unmounted with nothing selected");
    }
    const idle = bar(selection([]), { refresh: () => {} }, [false, "", ""]);
    assert.equal(findAll(idle.out as never, (el) => el.props.role === "group").length, 0, "an idle, empty bar stayed");
  });

  it("Clear moves focus to the select-all box, THEN clears", () => {
    const order: string[] = [];
    stub("document", { getElementById: (id: string) => ({ focus: () => order.push(`focus:${id}`) }) });
    const run = bar(selection([A], { clear: () => order.push("clear") }), { refresh: () => {} });
    (buttonNamed(run.out, "Clear").props.onClick as () => void)();
    assert.deepEqual(order, [`focus:${SELECT_ALL_ID}`, "clear"]);
  });
});

describe("ExportLink's handler, invoked", () => {
  // Hook order in ExportLink: state 0 status, 1 busy; refs 0 current,
  // 1 running, 2 mounted; effect 0 the resetOn reset, 1 mount/unmount.
  const click = (over: Record<string, unknown> = {}) => {
    let prevented = 0;
    return { e: { metaKey: false, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => (prevented += 1), ...over }, prevented: () => prevented };
  };
  const doc = () => {
    const anchors: { href: string; download: string; clicks: number }[] = [];
    return {
      anchors,
      value: {
        createElement: () => {
          const a = { href: "", download: "", clicks: 0, click() { a.clicks += 1; }, remove() {} };
          anchors.push(a);
          return a;
        },
        body: { appendChild: () => {} },
      },
    };
  };

  it("a plain click downloads the server's file in place, says what it got, and frees busy", async () => {
    const d = doc();
    const fetched: string[] = [];
    stub("document", d.value);
    stub("fetch", async (url: string) => {
      fetched.push(url);
      return json(200, null, { "Content-Disposition": 'attachment; filename="sourcebd-selected-1-of-2.csv"', "X-SourceBD-Rows": "1" });
    });
    const run = callWithHooks(ExportLink, { href: "/api/v1/discover/export?ids=a,b", label: "Export", requested: 2 });
    const link = buttonNamed(run.out, "Export");
    const c = click();
    await (link.props.onClick as (e: unknown) => Promise<void>)(c.e);
    assert.equal(c.prevented(), 1, "the navigation must be stopped");
    assert.deepEqual(fetched, ["/api/v1/discover/export?ids=a,b"]);
    assert.equal(d.anchors.length, 1);
    assert.equal(d.anchors[0]!.download, "sourcebd-selected-1-of-2.csv");
    assert.equal(d.anchors[0]!.clicks, 1);
    const statuses = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.equal(statuses[statuses.length - 1], "Exported 1 of 2. 1 is no longer on this page of results.");
    assert.deepEqual(run.sets.filter((s) => s.hook === 1).map((s) => s.value), [true, false], "busy must be released");
  });

  it("a refusal keeps the page and says why; nothing is saved", async () => {
    const d = doc();
    stub("document", d.value);
    stub("fetch", async () => json(429, { error: "rate_limited" }));
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export" });
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(d.anchors.length, 0);
    const statuses = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.match(String(statuses[statuses.length - 1]), /Too many exports/);
  });

  it("a modifier or middle click is left to the browser — no fetch, no preventDefault", async () => {
    let fetched = 0;
    stub("fetch", async () => {
      fetched += 1;
      return json(200, null);
    });
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export" });
    for (const over of [{ ctrlKey: true }, { button: 1 }]) {
      const c = click(over);
      await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(c.e);
      assert.equal(c.prevented(), 0);
    }
    assert.equal(fetched, 0);
  });

  it("a selection change mid-export does not cancel it: the file arrives and is said to be for the earlier selection", async () => {
    // Cancelling left a buyer who had heard "Preparing the export…" waiting
    // for a file that never came. The REAL reset effect runs mid-request.
    const d = doc();
    stub("document", d.value);
    const told: string[] = [];
    let run: ReturnType<typeof callWithHooks> | null = null;
    stub("fetch", async () => {
      // The real reset, twice, as ticking two boxes would: it must erase
      // nothing while the export runs. (The harness replays this render's
      // props, so the new selection is then set as React's next render would.)
      run!.effects[0]!();
      run!.effects[0]!();
      run!.refs[0]!.current = 9;
      return json(200, null, { "Content-Disposition": 'attachment; filename="sourcebd-selected-1.csv"', "X-SourceBD-Rows": "1" });
    });
    run = callWithHooks(ExportLink, { href: "/x", label: "Export", requested: 1, resetOn: 7, onStatus: (s: string) => told.push(s) });
    assert.deepEqual(run.deps[0], [7], "the reset is not keyed on resetOn");
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(d.anchors.length, 1, "the export was abandoned by a selection change");
    const statuses = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.deepEqual(statuses, ["Preparing the export…", `${EARLIER}Export downloaded.`], JSON.stringify(statuses));
    assert.deepEqual(told, statuses, "the parent was not told what the link says");
  });

  it("an idle message goes on the next selection change", () => {
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export", resetOn: 2 }, { state: ["Exported 1 supplier.", false] });
    run.effects[0]!();
    assert.deepEqual(run.sets.filter((s) => s.hook === 0).map((s) => s.value), [""]);
  });

  it("one export at a time: a second click while one runs sends nothing and says why", async () => {
    let calls = 0;
    let release: (v: unknown) => void = () => {};
    stub("document", doc().value);
    stub("fetch", async () => {
      calls += 1;
      if (calls > 1) return json(429, { error: "rate_limited" });
      return new Promise((r) => (release = r));
    });
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export" });
    const go = buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>;
    const first = go(click().e);
    await go(click().e);
    assert.equal(calls, 1, "a second export went out while the first was running");
    assert.equal(run.sets.filter((s) => s.hook === 0).map((s) => s.value).pop(), STILL_EXPORTING);
    release(json(429, { error: "rate_limited" }));
    await first;
  });

  it("an Export that unmounts mid-download (a new page) does not save onto the new page", async () => {
    const d = doc();
    stub("document", d.value);
    let unmount: (() => void) | null = null;
    stub("fetch", async () => {
      unmount!();
      return json(200, null, { "Content-Disposition": 'attachment; filename="old.csv"', "X-SourceBD-Rows": "1" });
    });
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export", requested: 1, resetOn: 0 });
    const cleanup = run.effects[1]!(); // React runs the mount effect…
    assert.equal(typeof cleanup, "function", "nothing marks the link unmounted");
    unmount = cleanup as () => void; // …and its cleanup on unmount.
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(d.anchors.length, 0, "the file was saved after its Export unmounted");
  });

  it("the bar hands its Export the selection's count, edits and a status listener, exactly once", () => {
    const run = bar(selection([A, B], { edits: 7 }), { refresh: () => {} });
    const links = findAll(run.out as never, (el) => el.type === ExportLink);
    assert.equal(links.length, 1, `expected one Export in the bar, found ${links.length}`);
    assert.equal(links[0]!.props.requested, 2);
    assert.equal(links[0]!.props.resetOn, 7, "the bar's Export is not reset by the buyer's selection edits");
    (links[0]!.props.onStatus as (s: string) => void)("Preparing the export…");
    assert.deepEqual(run.sets.filter((s) => s.hook === 2).map((s) => s.value), ["Preparing the export…"], "the bar does not keep the Export's status");
  });
});

describe("a row's Save and the saved-search form, invoked", () => {
  it("a row Save of a supplier no longer listed says so, and does not flip to Saved", async () => {
    stub("window", new EventTarget());
    stub("fetch", async () => json(404, { error: "This supplier is no longer listed." }));
    const run = callWithHooks(SaveRecordButton, { supplierId: A, saved: false });
    const btn = findAll(run.out, (el) => el.type === Button)[0]!;
    await (btn.props.onClick as () => Promise<void>)();
    const on = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.ok(!on.includes(true), "flipped to Saved");
    const status = run.sets.filter((s) => s.hook === 2).map((s) => s.value);
    assert.match(String(status[status.length - 1]), /no longer listed/);
  });

  it("the form blames the name field only for a name error", async () => {
    const submit = async (status: number, error: string) => {
      stub("fetch", async () => json(status, { error }));
      const run = callWithHooks(SaveSearchForm, { search: "q=knit", defaultName: "Knit" }, {
        contexts: new Map<unknown, unknown>([[AppRouterContext, { push() {}, refresh() {} }]]),
      });
      const form = findAll(run.out, (el) => el.type === "form")[0]!;
      await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
      const nameError = run.sets.filter((s) => s.hook === 2).map((s) => s.value);
      const errorText = run.sets.filter((s) => s.hook === 1).map((s) => s.value);
      return { nameError: nameError[nameError.length - 1], message: String(errorText[errorText.length - 1]) };
    };
    const name = await submit(400, "invalid name");
    assert.equal(name.nameError, true);
    const limit = await submit(409, "saved search limit reached");
    assert.equal(limit.nameError, false);
    assert.match(limit.message, /limit of 200/);
    const long = await submit(400, "search too long to save");
    assert.equal(long.nameError, false);
    assert.match(long.message, /too long/);
  });
});
