// The record bar's client controls — Share, Report a problem and the overlay's
// focus handling — by invoking their REAL handlers (hook-harness.ts). Cycle 4
// found each of them "tested" through something that could not fail: a
// `data-share-href` attribute nothing read, the request-body helper instead of
// the form that sends it, and a source regex for the focus effect. Every
// mutation it tried on the handlers themselves survived.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { buildSheet } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { Button } from "./controls";
import { CopyLinkButton } from "./copy-link-button";
import { DialogFocus } from "./dialog-focus";
import { callWithHooks, findAll, textOf } from "./hook-harness";
import { FEEDBACK_ENDPOINT, ReportProblem } from "./report-problem";
import { SelectionProvider } from "./selection";
import { SupplierSheet } from "./supplier-sheet";

const g = globalThis as unknown as Record<string, unknown>;
const saved = new Map<string, PropertyDescriptor | undefined>();
/** Replace a global for one test; `navigator` is a getter in Node 21+, so define, not assign. */
function stub(name: string, value: unknown) {
  if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(g, name));
  Object.defineProperty(g, name, { value, configurable: true, writable: true });
}
afterEach(() => {
  for (const [name, d] of saved) {
    if (d) Object.defineProperty(g, name, d);
    else delete g[name];
  }
  saved.clear();
});

const ORIGIN = "https://sourcebd.net";
const SEARCH = `${ORIGIN}/app/discover?q=knit&record=aboni-knitwear`;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("SupplierSheet hands its controls the record's own page", () => {
  for (const [where, closeHref] of [["overlay", "/app/discover?q=knit"], ["full page", null]] as const) {
    it(`${where}: Share and Report a problem both get /app/suppliers/<slug>, never the search`, () => {
      const model = buildSheet(aboniInput(), { closeHref, fullHref: "/app/suppliers/aboni-knitwear" });
      const out = callWithHooks(SupplierSheet, { model }).out;
      const share = findAll(out, (el) => el.type === CopyLinkButton);
      const report = findAll(out, (el) => el.type === ReportProblem);
      assert.equal(share.length, 1);
      assert.equal(report.length, 1);
      assert.equal(share[0]!.props.href, "/app/suppliers/aboni-knitwear");
      assert.equal(report[0]!.props.page, "/app/suppliers/aboni-knitwear");
    });
  }
});

describe("CopyLinkButton — Share copies the record's page", () => {
  const click = (run: ReturnType<typeof callWithHooks>) => {
    const [button] = findAll(run.out, (el) => el.type === Button);
    return (button!.props.onClick as () => Promise<void>)();
  };

  it("writes the absolute record URL to the clipboard, not the address bar's search", async () => {
    let written: string | null = null;
    stub("window", { location: { origin: ORIGIN, href: SEARCH } });
    stub("navigator", { clipboard: { writeText: async (s: string) => void (written = s) } });
    const run = callWithHooks(CopyLinkButton, { href: "/app/suppliers/aboni-knitwear" });
    await click(run);
    assert.equal(written, `${ORIGIN}/app/suppliers/aboni-knitwear`);
    assert.deepEqual(run.sets.map((s) => s.value), [`${ORIGIN}/app/suppliers/aboni-knitwear`, "copied"]);
  });

  it("a refused clipboard says so and shows the link to copy by hand", async () => {
    stub("window", { location: { origin: ORIGIN, href: SEARCH } });
    stub("navigator", { clipboard: { writeText: async () => Promise.reject(new Error("denied")) } });
    const run = callWithHooks(CopyLinkButton, { href: "/app/suppliers/aboni-knitwear" });
    await click(run);
    assert.equal(run.sets.at(-1)!.value, "failed");
    const failed = textOf(callWithHooks(CopyLinkButton, { href: "/app/suppliers/aboni-knitwear" }, { state: ["failed", `${ORIGIN}/app/suppliers/aboni-knitwear`] }).out);
    assert.match(failed, /Could not copy/);
    assert.ok(failed.includes(`${ORIGIN}/app/suppliers/aboni-knitwear`), `the failure does not give the link: ${failed}`);
    assert.doesNotMatch(failed, /address bar/, "the address bar holds the search, not the record");
  });
});

describe("ReportProblem — the form sends what the feedback route reads", () => {
  const PAGE = "/app/suppliers/aboni-knitwear";
  // Hook order: 0 message, 1 state, 2 error.
  const form = (state: unknown[]) => {
    const run = callWithHooks(ReportProblem, { page: PAGE }, { state });
    const [f] = findAll(run.out, (el) => el.type === "form");
    return { run, submit: () => (f!.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} }) };
  };

  it("posts page_path and message to /api/v1/feedback, naming the record", async () => {
    const calls: { url: string; init: { method: string; body: string } }[] = [];
    stub("fetch", async (url: string, init: { method: string; body: string }) => (calls.push({ url, init }), { ok: true, status: 201 }));
    const { run, submit } = form(["  The address is wrong.  ", "idle", null]);
    await submit();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, FEEDBACK_ENDPOINT);
    assert.equal(calls[0]!.init.method, "POST");
    assert.deepEqual(JSON.parse(calls[0]!.init.body), { page_path: PAGE, message: "The address is wrong." });
    const last = (hook: number) => run.sets.filter((s) => s.hook === hook).at(-1)?.value;
    assert.equal(last(1), "sent", "a 201 is not reported as sent");
    assert.equal(last(0), "", "the sent report is left in the box");
  });

  it("an ended session is told to sign in, not to try again", async () => {
    stub("fetch", async () => ({ ok: false, status: 401 }));
    const { run, submit } = form(["The address is wrong.", "idle", null]);
    await submit();
    // The LAST word the reader is left with, not any word on the way.
    const last = (hook: number) => run.sets.filter((s) => s.hook === hook).at(-1)?.value;
    assert.equal(last(1), "failed");
    assert.match(String(last(2)), /Sign in again/, JSON.stringify(run.sets));
  });

  it("a note under ten characters is refused before any request", async () => {
    let called = false;
    stub("fetch", async () => ((called = true), { ok: true, status: 201 }));
    const { run, submit } = form(["short", "idle", null]);
    await submit();
    assert.equal(called, false);
    assert.ok(run.sets.some((s) => typeof s.value === "string" && /at least 10 characters/.test(s.value)));
  });

  it("typing after a report clears the thanks; Escape closes the menu and not the sheet", () => {
    const run = callWithHooks(ReportProblem, { page: PAGE }, { state: ["", "sent", null] });
    const [area] = findAll(run.out, (el) => el.type === "textarea");
    (area!.props.onChange as (e: unknown) => void)({ target: { value: "More" } });
    assert.ok(run.sets.some((s) => s.value === "idle"), "the thanks outlives a new report");

    const [details] = findAll(run.out, (el) => el.type === "details");
    let focused = false;
    const target = { open: true, querySelector: () => ({ focus: () => void (focused = true) }) };
    // One event, as the browser delivers it: React's listener on the document
    // runs the menu's handler, then the sheet's own document listener
    // (`DialogFocus`) sees the SAME event. stopPropagation cannot stop a second
    // listener on the same node, so a stub for it proved nothing (cycle 6).
    const event = {
      key: "Escape",
      currentTarget: target,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
    };
    (details!.props.onKeyDown as (e: unknown) => void)(event);
    assert.equal(target.open, false);
    assert.equal(focused, true, "focus is not returned to the menu button");
    assert.equal(sheetEscape(event), false, "Escape in the open menu also closed the record — and the typed report with it");

    // With the menu closed, Escape is the sheet's.
    const plain = { ...event, currentTarget: { open: false, querySelector: () => null }, defaultPrevented: false };
    (details!.props.onKeyDown as (e: unknown) => void)(plain);
    assert.equal(sheetEscape(plain), true, "a closed menu swallows the Escape that should close the sheet");
  });
});

/** Run the sheet's real Escape listener (`DialogFocus`) on an event; true when it closed the sheet. */
function sheetEscape(event: unknown): boolean {
  let listener: ((e: unknown) => void) | null = null;
  stub("window", { location: { search: "?q=knit&record=aboni-knitwear" } });
  stub("document", {
    querySelector: () => ({ focus() {} }),
    addEventListener: (_: string, f: (e: unknown) => void) => void (listener = f),
    removeEventListener() {},
    querySelectorAll: () => [],
  });
  let pushed = false;
  const run = callWithHooks(DialogFocus, { closeHref: "/app/discover?q=knit", openKey: "x" }, {
    contexts: new Map([[AppRouterContext, { push: () => void (pushed = true) }]]),
  });
  run.effects[1]!();
  (listener as unknown as (e: unknown) => void)(event);
  return pushed;
}

describe("DialogFocus — focus follows the dialog's content", () => {
  function world(search: string) {
    const state = { search, focusedDialog: 0, listener: null as null | ((e: unknown) => void), focusedOpener: 0, focused: [] as string[] };
    stub("window", { location: { get search() { return state.search; } } });
    stub("document", {
      querySelector: (sel: string) => (sel === "[data-record-pane]" ? { focus: () => void state.focusedDialog++ } : null),
      addEventListener: (_: string, f: (e: unknown) => void) => void (state.listener = f),
      removeEventListener: () => void (state.listener = null),
      // The results: the company and one of its buildings, each opening its own record.
      querySelectorAll: () =>
        ["aboni-knitwear", "aboni-knitwear-unit-2"].map((slug) => ({
          getAttribute: () => `/app/discover?q=knit&record=${slug}`,
          closest: () => null,
          focus: () => void (state.focusedOpener++, state.focused.push(slug)),
        })),
    });
    return state;
  }
  const pushes: unknown[][] = [];
  const router = { push: (...a: unknown[]) => void pushes.push(a) };
  const mount = (openKey: string, refs?: { current: unknown }[]) =>
    callWithHooks(DialogFocus, { closeHref: "/app/discover?q=knit", openKey }, { contexts: new Map([[AppRouterContext, router]]), refs });

  it("moves focus to the dialog on open, and again when the content under it changes", () => {
    const w = world("?q=knit&record=aboni-knitwear");
    const first = mount("aboni-knitwear:");
    first.effects[0]!();
    assert.equal(w.focusedDialog, 1, "focus is not moved to the dialog on open");
    // The effect is keyed on what is shown: a record → its line is a new key,
    // so React re-runs it. On the old deps it never re-ran and focus fell to the body.
    assert.deepEqual(first.deps[0], ["aboni-knitwear:"]);
    w.search = "?q=knit&record=aboni-knitwear&line=6105";
    const line = mount("aboni-knitwear:6105", first.refs);
    assert.notDeepEqual(line.deps[0], first.deps[0]);
    line.effects[0]!();
    assert.equal(w.focusedDialog, 2);
    // The opener is the record link, by the parameter it was opened with (a
    // list page opens its detail with `open=`, the search with `record=`).
    assert.deepEqual(first.refs[0]!.current, { key: "record", id: "aboni-knitwear" }, "the opener is forgotten when the content changes");
  });

  it("Escape goes back to the search, and closing returns focus to the result that opened it", async () => {
    const w = world("?q=knit&record=aboni-knitwear");
    pushes.length = 0;
    const run = mount("aboni-knitwear:");
    run.effects[0]!();
    const cleanup = run.effects[1]!() as () => void;
    assert.ok(w.listener, "no Escape handler");
    let prevented = false;
    w.listener!({ key: "Escape", defaultPrevented: false, preventDefault: () => void (prevented = true) });
    assert.equal(prevented, true);
    assert.deepEqual(pushes, [["/app/discover?q=knit", { scroll: false }]]);
    w.listener!({ key: "Escape", defaultPrevented: true, preventDefault() {} });
    assert.equal(pushes.length, 1, "an Escape already handled (the more menu's) closes the sheet as well");
    // By the time the sheet unmounts the URL no longer names the record; the
    // opener must already be known.
    w.search = "?q=knit";
    cleanup();
    await tick();
    assert.equal(w.focusedOpener, 1, "focus does not return to the result that opened the record");
    assert.deepEqual(w.focused, ["aboni-knitwear"]);
  });

  it("a building's notice that leads to its company returns focus to the building's result, which opened it", async () => {
    const w = world("?q=knit&record=aboni-knitwear-unit-2");
    const notice = mount("notice:aboni-knitwear-unit-2");
    notice.effects[0]!();
    // "Open the company's record": same frame, new content, new URL.
    w.search = "?q=knit&record=aboni-knitwear";
    const record = mount("aboni-knitwear:", notice.refs);
    record.effects[0]!();
    assert.equal(w.focusedDialog, 2, "focus does not follow the notice into the record");
    const cleanup = record.effects[1]!() as () => void;
    w.search = "?q=knit";
    cleanup();
    await tick();
    assert.deepEqual(w.focused, ["aboni-knitwear-unit-2"], "focus returns to a result the buyer never clicked");
  });
});

describe("SelectionProvider — a page that could not be read keeps the selection", () => {
  // Opening a record over the results re-runs the search; when that re-run
  // failed, the page passed no rows and the provider pruned the selection to
  // them — the buyer's bulk selection, gone (cycle 11). `null` is "unread".
  const run = (pageIds: readonly string[] | null) => {
    const r = callWithHooks(SelectionProvider, { pageIds, children: null }, { state: [new Set(["a", "b"]), 0] });
    for (const effect of r.effects) effect();
    return r.sets.filter((s) => s.hook === 0).map((s) => (typeof s.value === "function" ? (s.value as (x: Set<string>) => Set<string>)(new Set(["a", "b"])) : s.value));
  };

  it("prunes nothing when the page was not read", () => {
    assert.deepEqual(run(null), [], "an unread page pruned the selection");
  });

  it("still prunes to the rows a read page holds", () => {
    const [next] = run(["b", "c"]);
    assert.deepEqual([...(next as Set<string>)], ["b"], "guard: a read page prunes to its rows");
  });
});
