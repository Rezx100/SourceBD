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
    assert.ok(run.sets.some((s) => s.value === "sent"), "a 201 is not reported as sent");
  });

  it("an ended session is told to sign in, not to try again", async () => {
    stub("fetch", async () => ({ ok: false, status: 401 }));
    const { run, submit } = form(["The address is wrong.", "idle", null]);
    await submit();
    assert.ok(run.sets.some((s) => s.value === "failed"));
    assert.ok(run.sets.some((s) => typeof s.value === "string" && /Sign in again/.test(s.value)), JSON.stringify(run.sets));
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
    let stopped = false;
    let focused = false;
    const target = { open: true, querySelector: () => ({ focus: () => void (focused = true) }) };
    (details!.props.onKeyDown as (e: unknown) => void)({ key: "Escape", currentTarget: target, stopPropagation: () => void (stopped = true) });
    assert.equal(stopped, true, "Escape reaches the sheet and closes the record too");
    assert.equal(target.open, false);
    assert.equal(focused, true, "focus is not returned to the menu button");
  });
});

describe("DialogFocus — focus follows the dialog's content", () => {
  function world(search: string) {
    const state = { search, focusedDialog: 0, listener: null as null | ((e: unknown) => void), focusedOpener: 0 };
    stub("window", { location: { get search() { return state.search; } } });
    stub("document", {
      querySelector: (sel: string) => (sel === '[role="dialog"]' ? { focus: () => void state.focusedDialog++ } : null),
      addEventListener: (_: string, f: (e: unknown) => void) => void (state.listener = f),
      removeEventListener: () => void (state.listener = null),
      querySelectorAll: () => [
        { getAttribute: () => "/app/discover?q=knit&record=aboni-knitwear", closest: () => null, focus: () => void state.focusedOpener++ },
      ],
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
    assert.equal(first.refs[0]!.current, "aboni-knitwear", "the opener is forgotten when the content changes");
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
    cleanup();
    await tick();
    assert.equal(w.focusedOpener, 1, "focus does not return to the result that opened the record");
  });
});
