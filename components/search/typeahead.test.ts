// The v4 search field's suggestions (Paper `02 Components` · Inputs, the supplier combobox): the
// markup a screen reader and a keyboard meet, and the keys, driven through the component's own
// handlers. The matching is `lib/search-suggest.test.ts`; where a row leads is
// `lib/search-suggest-ui.test.ts`.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { callWithHooks, findAll } from "@/components/dashboard/hook-harness";
import type { Suggestion } from "@/lib/search-suggest-ui";

{
  // The client hooks need a mounted App Router; only they are replaced.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = {
    id: navId,
    filename: navId,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      ...realNav,
      useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
      useSearchParams: () => new URLSearchParams("q=knit&cert=gots"),
      usePathname: () => "/app/discover",
    },
  } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SearchCombobox } = require("@/components/search/typeahead") as typeof import("@/components/search/typeahead");

type Props = Parameters<typeof SearchCombobox>[0];
type KeyEvent = { key: string; defaultPrevented: boolean; stopped?: boolean; preventDefault(): void; stopPropagation(): void };

const fetched: Suggestion[] = [
  { type: "heading", label: "Men's knit shirts", hs: "6105", detail: "Shirts, men's, knitted" },
  { type: "cert", label: "GOTS certified", value: "GOTS", param: ["cert", "gots"] },
  { type: "company", label: "Aboni Knitwear Ltd.", sublabel: "Dhaka", slug: "aboni-knitwear" },
  { type: "company", label: "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)", sublabel: "Narayanganj", slug: "zaheen" },
];

// useState order in the component: value, fetched, recent, open, active.
function drawn(props: Partial<Props> & { open?: boolean; active?: number; value?: string; rows?: Suggestion[] } = {}) {
  const { open = false, active = -1, value = "knit", rows = fetched, ...rest } = props;
  return callWithHooks(SearchCombobox, { variant: "topbar", placeholder: "Supplier, product or certificate", ...rest } as Props, { state: [value, rows, [], open, active] });
}

const html = (out: ReactNode) => renderToStaticMarkup(out as Parameters<typeof renderToStaticMarkup>[0]);
const inputOf = (run: ReturnType<typeof drawn>) => findAll(run.out, (e) => e.type === "input")[0]!;
const keyEvent = (key: string): KeyEvent => {
  const e: KeyEvent = { key, defaultPrevented: false, preventDefault: () => void (e.defaultPrevented = true), stopPropagation: () => void (e.stopped = true) };
  return e;
};

describe("the markup: a combobox over a listbox", () => {
  const out = html(drawn({ open: true, active: 2 }).out);

  it("one input named q, a combobox that says what it controls and which row is active", () => {
    assert.match(out, /<input[^>]*type="search"[^>]*name="q"[^>]*value="knit"/);
    assert.match(out, /role="combobox"/);
    assert.match(out, /aria-autocomplete="list"/);
    assert.match(out, /aria-expanded="true"/);
    const listId = /aria-controls="([^"]+)"/.exec(out)?.[1];
    assert.ok(listId && out.includes(`id="${listId}" role="listbox"`), "aria-controls points at the listbox");
    const active = /aria-activedescendant="([^"]+)"/.exec(out)?.[1];
    const selected = /<[a-z]+ id="([^"]+)"[^>]*aria-selected="true"/.exec(out)?.[1];
    assert.ok(active, "an active row is named");
    assert.equal(selected, active, "and it is the selected one");
  });

  it("the words typed come first, then the server's rows in its order; exactly one row is selected", () => {
    assert.equal((out.match(/role="option"/g) ?? []).length, fetched.length + 1);
    assert.equal((out.match(/aria-selected="true"/g) ?? []).length, 1);
    // The words typed are set apart inside a name, so read the text, not the tags.
    const text = out.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'");
    const order = ["Search “knit”", "Men's knit shirts", "GOTS certified", "Aboni Knitwear Ltd.", "Zaheen Knitwears Limited"].map((w) => text.indexOf(w));
    assert.ok(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1]!)), `order ${order}`);
  });

  it("the active row is Paper's brand-wash; a name wraps and is never cut; the line under it is 12px", () => {
    assert.match(out, /bg-brand-wash/);
    assert.doesNotMatch(out, /truncate|text-ellipsis|line-clamp/);
    assert.ok(out.includes("[overflow-wrap:anywhere]"));
    assert.ok(out.includes("Building - Security, ETP and Fire Pump"), "the 100-character name is printed whole");
    assert.match(out, /<span class="text-xs text-ink-3">Supplier · Dhaka<\/span>/);
    assert.ok(!/text-(\[?1[01]px|2xs|3xs)/.test(out), "nothing under 12px");
  });

  it("a supplier is a link that opens its record beside the results, keeping the search", () => {
    const href = /<a[^>]*href="([^"]*record=aboni-knitwear[^"]*)"/.exec(out)?.[1]?.replace(/&amp;/g, "&");
    assert.ok(href, "a link with record=");
    const url = new URL(href!, "https://x.invalid");
    assert.equal(url.pathname, "/app/discover");
    assert.equal(url.searchParams.get("q"), "knit");
    assert.equal(url.searchParams.get("cert"), "gots");
  });

  it("the list sits above a filter panel (z-toast over z-overlay), and the keys are named in the footer", () => {
    assert.match(out, /z-toast/);
    assert.ok(out.includes("Enter to open · arrows to move · Esc to close"));
    assert.match(out, /<span role="status" class="sr-only">5 suggestions<\/span>/, "the count is spoken");
  });

  it("no contact detail and no score in any suggestion", () => {
    assert.doesNotMatch(out, /@|\+880|mailto:|tel:|score|grade|rating/i);
  });

  it("closed, the list is hidden (not removed) and the field says so", () => {
    const closed = html(drawn({ open: false }).out);
    assert.match(closed, /aria-expanded="false"/);
    assert.doesNotMatch(closed, /aria-activedescendant/);
    assert.match(closed, /class="[^"]*\bhidden\b[^"]*"/);
  });

  it("the topbar's field is the one Ctrl K finds; a phone's is not, and is 16px with rows 44 tall", () => {
    assert.match(html(drawn({ shortcutTarget: true }).out), /data-search="topbar"/);
    const phone = html(drawn({ variant: "phone", open: true }).out);
    assert.doesNotMatch(phone, /data-search/);
    assert.match(phone, /text-md/);
    assert.ok((phone.match(/min-h-touch/g) ?? []).length >= fetched.length + 1, "every row is a 44 tall target");
    assert.match(phone, /max-md:hidden/, "the keyboard hint is for a desktop");
  });
});

describe("the keys", () => {
  const withDocument = (clicked: string[]) => {
    (globalThis as unknown as { document: unknown }).document = { getElementById: (id: string) => ({ click: () => clicked.push(id) }) };
  };
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("Down opens the list and moves to the first row, Up from nothing to the last; the default is stopped", () => {
    const run = drawn({ open: false, active: -1 });
    const down = keyEvent("ArrowDown");
    (inputOf(run).props.onKeyDown as (e: KeyEvent) => void)(down);
    assert.equal(down.defaultPrevented, true);
    assert.ok(run.sets.some((s) => s.hook === 3 && s.value === true), "opens");
    const step = run.sets.find((s) => s.hook === 4)?.value as (i: number) => number;
    assert.equal(step(-1), 0);
    assert.equal(step(4), 0, "wraps after the last (five rows)");
    const up = drawn({ open: true });
    (inputOf(up).props.onKeyDown as (e: KeyEvent) => void)(keyEvent("ArrowUp"));
    assert.equal((up.sets.find((s) => s.hook === 4)?.value as (i: number) => number)(-1), 4);
  });

  it("Escape closes the list and nothing behind it: the event is stopped; with the list closed it passes through", () => {
    const open = drawn({ open: true, active: 1 });
    const esc = keyEvent("Escape") ;
    (inputOf(open).props.onKeyDown as (e: KeyEvent) => void)(esc);
    assert.equal(esc.defaultPrevented, true);
    assert.equal(esc.stopped, true);
    assert.ok(open.sets.some((s) => s.hook === 3 && s.value === false));
    assert.ok(open.sets.some((s) => s.hook === 4 && s.value === -1));
    const closed = drawn({ open: false });
    const through = keyEvent("Escape") ;
    (inputOf(closed).props.onKeyDown as (e: KeyEvent) => void)(through);
    assert.equal(through.defaultPrevented, false, "a pane's Escape is not swallowed by a closed list");
    assert.equal(through.stopped, undefined);
  });

  it("Enter on the active row follows its link; with no row active it leaves the form to submit the words", () => {
    const clicked: string[] = [];
    withDocument(clicked);
    const on = drawn({ open: true, active: 3 });
    const enter = keyEvent("Enter");
    (inputOf(on).props.onKeyDown as (e: KeyEvent) => void)(enter);
    assert.equal(enter.defaultPrevented, true);
    assert.deepEqual(clicked, [":h0:-3"]);
    const none = drawn({ open: true, active: -1 });
    const plain = keyEvent("Enter");
    (inputOf(none).props.onKeyDown as (e: KeyEvent) => void)(plain);
    assert.equal(plain.defaultPrevented, false, "the GET form submits");
    assert.deepEqual(clicked, [":h0:-3"], "no row was followed");
  });

  it("Tab closes the list so focus moves on", () => {
    const run = drawn({ open: true, active: 1 });
    (inputOf(run).props.onKeyDown as (e: KeyEvent) => void)(keyEvent("Tab"));
    assert.ok(run.sets.some((s) => s.hook === 3 && s.value === false));
  });

  it("typing opens the list; a press outside closes it and the field keeps its text", () => {
    const run = drawn({ open: false });
    (inputOf(run).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "kni" } });
    assert.ok(run.sets.some((s) => s.hook === 0 && s.value === "kni"));
    assert.ok(run.sets.some((s) => s.hook === 3 && s.value === true));
    const listeners: Record<string, (e: { target: unknown }) => void> = {};
    (globalThis as unknown as { document: unknown }).document = {
      addEventListener: (n: string, f: (e: { target: unknown }) => void) => (listeners[n] = f),
      removeEventListener: () => {},
    };
    const outside = drawn({ open: true });
    outside.refs[0]!.current = { contains: () => false };
    // The effect that listens is the second one with an empty dependency list.
    const idx = outside.deps.findIndex((d) => Array.isArray(d) && d.length === 0);
    outside.effects[idx]!();
    listeners.pointerdown!({ target: {} });
    assert.ok(outside.sets.some((s) => s.hook === 3 && s.value === false));
    assert.ok(!outside.sets.some((s) => s.hook === 0), "the typed words are not cleared");
  });

  it("it shows a row that is a link only as an option the keyboard reaches by arrows, not by Tab", () => {
    const out = html(drawn({ open: true }).out);
    for (const m of out.matchAll(/<a\b[^>]*role="option"[^>]*>/g)) assert.match(m[0], /tabindex="-1"/);
  });
});

describe("the frame and the pages use the one field", () => {
  it("is not written twice: the topbar and both phone fields draw SearchCombobox", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const read = (p: string) => readFileSync(path.join(process.cwd(), ...p.split("/")), "utf8");
    for (const f of ["components/frame/topbar.tsx", "components/search/landing.tsx", "components/search/toolbar.tsx"]) {
      assert.match(read(f), /<SearchCombobox\b/, f);
    }
    assert.doesNotMatch(read("components/frame/topbar.tsx"), /function QueryInput/);
  });
});
