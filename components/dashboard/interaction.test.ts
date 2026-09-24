// Behaviour of the results page's client controls, by invoking their REAL
// handlers (hook-harness.ts) rather than reading their source. Every test
// here stubs the browser globals its handler touches and restores them.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { Button } from "./controls";
import { ExportLink } from "./export-link";
import { callWithHooks, findAll, textOf } from "./hook-harness";
import { SaveRecordButton } from "./save-record-button";
import { SaveSearchForm } from "./save-search-form";
import { SelectionBar } from "./selection-bar";
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

  it("a Save click while busy sends no request", async () => {
    let fetched = 0;
    stub("window", new EventTarget());
    stub("fetch", async () => {
      fetched += 1;
      return json(200, { ok: true, count: 1, skipped: 0, ids: [A] });
    });
    const run = bar(selection([A]), { refresh: () => {} }, [true, ""]);
    await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
    assert.equal(fetched, 0);
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

  it("a Save that returns after the buyer changed the selection reports nothing about the old one", async () => {
    stub("window", new EventTarget());
    let run: ReturnType<typeof bar> | null = null;
    stub("fetch", async () => {
      run!.effects[0]!(); // the buyer ticked another box: the real edits effect
      return json(200, { ok: true, count: 1, skipped: 0, ids: [A] });
    });
    run = bar(selection([A]), { refresh: () => {} });
    await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
    const statuses = run.sets.filter((s) => s.hook === 1).map((s) => s.value);
    // Never a bare "Saved 1" that reads as the new selection...
    assert.ok(!statuses.some((v) => typeof v === "string" && v.startsWith("Saved")), `stale report: ${JSON.stringify(statuses)}`);
    // ...but said, scoped to the earlier one (WCAG 4.1.3: an outcome with no status is a silence).
    assert.equal(statuses[statuses.length - 1], "Your earlier save went through: Saved 1 supplier.");
  });

  it("a selection change frees Save, and a stale save does not take it back", async () => {
    // Save stuck busy after the buyer ticked another box: its next click
    // returned silently. The edits effect must free it...
    const mid = bar(selection([A, B]), { refresh: () => {} }, [true, ""]);
    mid.effects[0]!();
    assert.ok(mid.sets.some((x) => x.hook === 0 && x.value === false), "a selection change left Save busy");
    // ...and the old save, landing afterwards, must not touch busy again.
    // The reset here is the bar's real edits effect, run mid-request.
    stub("window", new EventTarget());
    let run: ReturnType<typeof bar> | null = null;
    stub("fetch", async () => {
      run!.effects[0]!();
      return json(200, { ok: true, count: 1, skipped: 0, ids: [A] });
    });
    run = bar(selection([A]), { refresh: () => {} });
    await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
    // Set by the click, freed by the reset, and not touched by the stale save.
    assert.deepEqual(run.sets.filter((x) => x.hook === 0).map((x) => x.value), [true, false]);
  });

  it("a save that FAILS after the selection changed still says so; the reset is keyed on the buyer's edits", async () => {
    // A superseded success is stale ("Saved 3" under "4 selected"); a
    // superseded failure is not — those suppliers are still unsaved.
    stub("window", new EventTarget());
    let run: ReturnType<typeof bar> | null = null;
    stub("fetch", async () => {
      run!.effects[0]!(); // the buyer ticked another box: the real edits effect
      return json(429, { error: "rate_limited" });
    });
    run = bar(selection([A, B], { edits: 7 }), { refresh: () => {} });
    assert.deepEqual(run.deps[0], [7], "the bar's reset is not keyed on the buyer's edits");
    await (buttonNamed(run.out, "Save").props.onClick as () => Promise<void>)();
    const statuses = run.sets.filter((x) => x.hook === 1).map((x) => x.value);
    assert.ok(
      statuses.some((v) => typeof v === "string" && v.startsWith("The earlier save did not go through") && /Too many saves/.test(v)),
      `a failed save was dropped without a word: ${JSON.stringify(statuses)}`,
    );
  });

  it("after Clear hides the bar, a late save's outcome is still announced", () => {
    // The bar's status line goes with the bar; the announcer is always there.
    const hidden = bar(selection([]), { refresh: () => {} }, [false, "The earlier save did not go through. Too many saves."]);
    assert.match(textOf(hidden.out as never), /The earlier save did not go through/, "the outcome went nowhere after Clear");
  });

  it("a slow earlier save landing after a newer one does not overwrite the newer result", async () => {
    stub("window", new EventTarget());
    let releaseFirst: (v: unknown) => void = () => {};
    let call = 0;
    let run: ReturnType<typeof bar> | null = null;
    stub("fetch", async () => {
      call += 1;
      if (call === 1) return new Promise((r) => (releaseFirst = r));
      return json(429, { error: "rate_limited" });
    });
    run = bar(selection([A]), { refresh: () => {} });
    const save = buttonNamed(run.out, "Save").props.onClick as () => Promise<void>;
    const first = save(); // slow
    run.effects[0]!(); // the buyer ticks another box, which frees Save
    await save(); // the newer save is refused
    releaseFirst(json(200, { ok: true, count: 1, skipped: 0, ids: [A] }));
    await first;
    const statuses = run.sets.filter((x) => x.hook === 1).map((x) => x.value);
    assert.match(String(statuses[statuses.length - 1]), /Too many saves/, `the newer refusal was overwritten: ${JSON.stringify(statuses)}`);
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

  it("a result that lands after the selection changed is dropped, not shown", async () => {
    const d = doc();
    stub("document", d.value);
    let run: ReturnType<typeof callWithHooks> | null = null;
    stub("fetch", async () => {
      run!.refs[0]!.current = Number(run!.refs[0]!.current) + 1; // resetOn moved
      return json(200, null, { "Content-Disposition": 'attachment; filename="f.csv"', "X-SourceBD-Rows": "1" });
    });
    run = callWithHooks(ExportLink, { href: "/x", label: "Export", requested: 1, resetOn: 0 });
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    const statuses = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    assert.deepEqual(statuses, ["Preparing the export…"], `stale result shown: ${JSON.stringify(statuses)}`);
    // Nor saved: it would land as the NEW selection's file, with no word said.
    assert.equal(d.anchors.length, 0, "the old selection's file was downloaded after the selection changed");
    // Nor may it free busy: the button already belongs to the next export.
    assert.deepEqual(run.sets.filter((s) => s.hook === 1).map((s) => s.value), [true]);
  });

  it("a selection change frees Export, so the next click is not swallowed", async () => {
    // Busy from the old export survived the reset, and a click on the new
    // selection returned silently: no request, no file, no message.
    const mid = callWithHooks(ExportLink, { href: "/x", label: "Export", resetOn: 1 }, { state: ["", true] });
    mid.effects[0]!();
    assert.ok(mid.sets.some((s) => s.hook === 1 && s.value === false), "a selection change left Export busy");
  });

  it("the REAL reset, run mid-export: keyed on resetOn, says the export was cancelled, and the old file is neither saved nor reported", async () => {
    // The test above moved the round by hand; this one runs the effect React
    // would run when the bar passes a new `resetOn`, while the fetch is out.
    const d = doc();
    stub("document", d.value);
    let run: ReturnType<typeof callWithHooks> | null = null;
    stub("fetch", async () => {
      run!.effects[0]!(); // the buyer ticked another box
      return json(200, null, { "Content-Disposition": 'attachment; filename="old.csv"', "X-SourceBD-Rows": "1" });
    });
    run = callWithHooks(ExportLink, { href: "/x", label: "Export", requested: 1, resetOn: 7 });
    assert.deepEqual(run.deps[0], [7], "the reset is not keyed on resetOn, so a selection change never runs it");
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(d.anchors.length, 0, "the old selection's file was saved after the reset");
    const statuses = run.sets.filter((s) => s.hook === 0).map((s) => s.value);
    // Not silence (the buyer heard "Preparing…" and would wait for a file),
    // and not the old export's own result either: that it was cancelled.
    assert.deepEqual(
      statuses,
      ["Preparing the export…", "The earlier export was cancelled because the selection changed. Export again for this selection."],
      `the cancel went unsaid, or the old export was reported: ${JSON.stringify(statuses)}`,
    );
    // busy: set by the click, freed by the reset, and not touched again.
    assert.deepEqual(run.sets.filter((s) => s.hook === 1).map((s) => s.value), [true, false]);
  });

  it("an Export that goes away mid-download (Clear, a new page) abandons its file", async () => {
    // The reset only ran on a changed selection. Clear unmounts the bar and
    // its Export; nothing moved the round, and the old file landed anyway.
    const d = doc();
    stub("document", d.value);
    let unmount: (() => void) | null = null;
    stub("fetch", async () => {
      unmount!();
      return json(200, null, { "Content-Disposition": 'attachment; filename="old.csv"', "X-SourceBD-Rows": "1" });
    });
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export", requested: 1, resetOn: 0 });
    const cleanup = run.effects[0]!(); // React runs the effect after the first commit…
    assert.equal(typeof cleanup, "function", "the reset effect returns no cleanup, so an unmount abandons nothing");
    unmount = cleanup as () => void; // …and its cleanup on unmount.
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(d.anchors.length, 0, "the file was saved after its Export unmounted");
  });

  it("a click while an export is running starts no second one", async () => {
    let fetched = 0;
    stub("fetch", async () => {
      fetched += 1;
      return json(200, null);
    });
    const run = callWithHooks(ExportLink, { href: "/x", label: "Export" }, { state: ["Preparing the export…", true] });
    await (buttonNamed(run.out, "Export").props.onClick as (e: unknown) => Promise<void>)(click().e);
    assert.equal(fetched, 0);
  });

  it("the bar hands its Export the selection's count and edits, exactly once", () => {
    const run = bar(selection([A, B], { edits: 7 }), { refresh: () => {} });
    const links = findAll(run.out as never, (el) => el.type === ExportLink);
    assert.equal(links.length, 1, `expected one Export in the bar, found ${links.length}`);
    assert.equal(links[0]!.props.requested, 2);
    assert.equal(links[0]!.props.resetOn, 7, "the bar's Export is not reset by the buyer's selection edits");
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
