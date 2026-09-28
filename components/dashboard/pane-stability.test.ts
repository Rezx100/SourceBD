// The founder's video of 29 Sep 2026, the stability half (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`, PR 1):
//
//  1. Clicking a record tab scrolled the whole app: the search's filter bar
//     slid off the top and an empty strip opened at the foot. A tab now
//     scrolls the pane's own region, and nothing above it can be scrolled.
//  2. The worker figures ran under the row's Save and RFQ icons, and the
//     compact actions column could not hold its own two buttons.
//  3. Names broke mid-word ("Benchmar k") beside a pane: the supplier column
//     keeps room for its longest word in every layout.
//  4. Every click waited on the rate limit and then the role read, each a
//     round trip to California: the two now run side by side.
//  5. Register logos filled in one by one while scrolling: the layout
//     preloads them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SOURCE_LOGO_FILES } from "@/lib/dashboard/source-logos";
import { AppShell } from "./app-shell";
import { RESULTS_COLUMNS, RESULTS_MIN_WIDTH } from "./results-table";
import { SheetSection, Workbench } from "./sheet";
import { SheetTabs, goToSection, type TabClick } from "./sheet-tabs";
import { WorkersCell } from "./workers-cell";

const repoRoot = process.cwd();
const source = (p: string) => readFileSync(path.join(repoRoot, p), "utf8");

describe("1. a record tab scrolls the pane, never the app", () => {
  it("the shell and every list-and-pane frame refuse to be scrolled, by a script as much as by a person", () => {
    const shell = renderToStaticMarkup(
      createElement(
        AppShell,
        { sidebar: { counts: { suppliers: null, rfqs: null, saved: null }, recent: [], plan: { name: "" } }, topbar: { caption: "", initial: null } } as ComponentProps<typeof AppShell>,
        null,
      ),
    );
    const root = /^<div class="([^"]*)"/.exec(shell)?.[1] ?? "";
    assert.match(root, /\bmd:overflow-clip\b/, `the shell root can be scrolled: ${root}`);
    assert.doesNotMatch(root, /overflow-hidden/, "`hidden` still lets a fragment or a focus call scroll the shell");
    const frame = renderToStaticMarkup(createElement(Workbench, null, "x"));
    assert.match(frame, /\blg:overflow-clip\b/);
    // Every page that lays a list beside a pane draws that frame, not a copy of it.
    for (const page of [
      "app/(app)/app/discover/page.tsx",
      "app/(app)/app/discover/loading.tsx",
      "app/(app)/app/saved/page.tsx",
      "app/(app)/app/saved/loading.tsx",
      "app/(app)/app/orders/(list)/page.tsx",
      "app/(app)/app/rfqs/(list)/page.tsx",
      "app/(app)/app/(search)/page.tsx",
    ]) {
      const s = source(page);
      assert.match(s, /<Workbench>/, `${page} does not draw the Workbench frame`);
      assert.doesNotMatch(s, /lg:flex-row/, `${page} draws a list-and-pane frame of its own`);
    }
  });

  it("every tab link carries the handler", () => {
    const nav = SheetTabs({
      tabs: [
        { label: "Overview", count: null, href: "#overview", active: true },
        { label: "Products", count: "6", href: "#products" },
        { label: "Facilities", count: null, href: null },
      ],
    });
    const links: ReactElement<{ onClick?: unknown }>[] = [];
    const walk = (n: ReactNode) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (isValidElement<{ children?: ReactNode; onClick?: unknown }>(n)) {
        if (n.type === "a") links.push(n);
        walk(n.props.children);
      }
    };
    walk(nav);
    assert.equal(links.length, 3);
    for (const a of links) assert.equal(a.props.onClick, goToSection, "a tab follows its fragment, which scrolls every ancestor");
  });

  /** A tab, its sticky nav, the pane's scroll region and a section, as goToSection reads them. */
  function fixture(opts: { href?: string; disabled?: boolean } = {}) {
    const calls: string[] = [];
    const attrs = new Map<string, string>();
    const target = {
      getBoundingClientRect: () => ({ top: 900 }),
      hasAttribute: (k: string) => attrs.has(k),
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      focus: (o?: { preventScroll?: boolean }) => calls.push(`focus preventScroll=${o?.preventScroll} tabindex=${attrs.get("tabindex")}`),
    };
    const scroller = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 60 }),
      querySelector: (sel: string) => (sel === '[id="products"]' ? target : null),
      scrollTo: (o: { top: number; behavior: string }) => calls.push(`scroll ${o.top} ${o.behavior}`),
    };
    const nav = { getBoundingClientRect: () => ({ height: 49 }) };
    const link = {
      hash: opts.href ?? "#products",
      getAttribute: (k: string) => (k === "aria-disabled" && opts.disabled ? "true" : null),
      closest: (sel: string) => (sel === "[data-sheet-scroll]" ? scroller : sel === "nav" ? nav : null),
    };
    let prevented = false;
    const event = (extra: Partial<TabClick> = {}) =>
      ({
        currentTarget: link,
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: () => (prevented = true),
        ...extra,
      }) as unknown as TabClick;
    return { calls, event, prevented: () => prevented };
  }

  function withWindow(reduced: boolean, run: (replaced: string[]) => void) {
    const replaced: string[] = [];
    const g = globalThis as { window?: unknown };
    const before = g.window;
    g.window = {
      matchMedia: () => ({ matches: reduced }),
      history: { state: { __NA: true }, replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) },
    };
    try {
      run(replaced);
    } finally {
      g.window = before;
    }
  }

  it("a click scrolls only the pane's region, to the section under the sticky tabs, and replaces the fragment", () => {
    withWindow(false, (replaced) => {
      const f = fixture();
      goToSection(f.event());
      assert.ok(f.prevented(), "the browser was left to follow the fragment");
      // 900 − 60 + 100 − 49: the section's offset in the region, less the tabs.
      assert.deepEqual(f.calls, ["scroll 891 smooth", "focus preventScroll=true tabindex=-1"]);
      assert.deepEqual(replaced, ["#products"], "a tab click pushes history, or leaves the URL behind");
    });
    withWindow(true, () => {
      const f = fixture();
      goToSection(f.event());
      assert.equal(f.calls[0], "scroll 891 auto", "reduced motion still glides");
    });
  });

  it("a modified click, a tab with nothing behind it, and a missing section are left alone or stopped", () => {
    withWindow(false, (replaced) => {
      const modified = fixture();
      goToSection(modified.event({ metaKey: true }));
      assert.ok(!modified.prevented() && modified.calls.length === 0, "a ⌘-click is the browser's");
      const dead = fixture({ href: "", disabled: true });
      goToSection(dead.event());
      assert.ok(dead.prevented() && dead.calls.length === 0, "an inert tab jumped");
      const missing = fixture({ href: "#nowhere" });
      goToSection(missing.event());
      assert.ok(!missing.prevented(), "a fragment with no section in this pane must still work as a link");
      assert.deepEqual(replaced, []);
    });
  });

  it("a plain fragment lands a section below the sticky tabs, and a section is not a focus stop until a tab sends focus there", () => {
    for (const collapsible of [false, true]) {
      const html = renderToStaticMarkup(createElement(SheetSection, { id: "products", title: "Products", collapsible } as ComponentProps<typeof SheetSection>, "x"));
      assert.match(html, /\bscroll-mt-12\b/);
      assert.doesNotMatch(html, /tabindex/, "a click on a section's text would move focus to the whole section");
    }
  });
});

describe("2–3. every column holds what it carries", () => {
  // Measured in Geist, 29 Sep 2026: the longest word a register files in a
  // name at 14px medium ("MANUFACTURING") is 120px; the workers second line
  // at 12px ("11,119 with buildings") 118px; its words alone 78px.
  const LONGEST_WORD = 120;
  const NAME_CHROME = 24 + 24 + 10; // px-3 either side, the 24px tile, its gap
  const fixed = (cols: readonly (number | null)[]) => cols.reduce<number>((s, w) => s + (w ?? 0), 0);

  it("the supplier column keeps its longest word whole at the table's minimum width, beside a pane and not", () => {
    for (const layout of ["wide", "compact"] as const) {
      const name = RESULTS_MIN_WIDTH[layout] - fixed(RESULTS_COLUMNS[layout]);
      assert.ok(name - NAME_CHROME >= LONGEST_WORD, `${layout}: the supplier column falls to ${name}px, so a name breaks mid-word`);
    }
    const table = source("components/dashboard/results-table.tsx");
    assert.match(table, /compact \? "min-w-\[30rem\]" : "min-w-\[60rem\]"/, "RESULTS_MIN_WIDTH no longer says what the table draws");
    assert.equal(RESULTS_MIN_WIDTH.compact, 30 * 16);
    assert.equal(RESULTS_MIN_WIDTH.wide, 60 * 16);
  });

  it("the actions and workers columns hold their contents", () => {
    // Wide: Save, Open and RFQ, 28px each with 2px gaps, inside px-2.
    assert.ok(RESULTS_COLUMNS.wide[6]! - 16 >= 3 * 28 + 2 * 2);
    // Compact: Save and RFQ inside px-1 — 64px with px-2 overflowed by 10px.
    assert.ok(RESULTS_COLUMNS.compact[4]! - 8 >= 2 * 28 + 2);
    // Workers, px-3: the whole second line wide, its words alone beside a pane.
    assert.ok(RESULTS_COLUMNS.wide[5]! - 24 >= 118);
    assert.ok(RESULTS_COLUMNS.compact[3]! - 24 >= 78);
  });

  it("the second worker figure breaks between its figure and its words, never inside either", () => {
    const html = renderToStaticMarkup(createElement(WorkersCell, { own: 10500, second: "11,119 with buildings" }));
    assert.match(html, /<span class="whitespace-nowrap">11,119<\/span> <span class="whitespace-nowrap">with buildings<\/span>/);
    assert.doesNotMatch(html, /whitespace-nowrap[^>]*>11,119 with buildings</, "held to one line, it ran under the row's icons");
  });
});

describe("4. the gate's reads run side by side", () => {
  it("the role read starts before the rate-limit check is awaited, and the gate awaits that same read", () => {
    // Founder, 29 Sep 2026: "run the two side by side" — same checks, same
    // answers, one Amsterdam→California round trip fewer on every click.
    const mw = source("middleware.ts");
    const started = mw.indexOf("gateFor(cachedUserId)");
    const limited = mw.indexOf("await rlCheck(");
    assert.ok(started > 0 && limited > started, "the role read waits for the rate limit again");
    assert.match(mw, /const \{ data: profile \} = await gateFor\(user\.id\);/, "the gate reads the role a second time");
    assert.equal(mw.match(/\.from\("profiles"\)\.select\("role, is_suspended"\)/g)?.length, 1, "two role reads on one request");
  });
});

describe("5. register logos are preloaded", () => {
  it("the buyer layout preloads every mark file once", () => {
    assert.equal(new Set(SOURCE_LOGO_FILES).size, SOURCE_LOGO_FILES.length);
    assert.ok(SOURCE_LOGO_FILES.length >= 11);
    const layout = source("app/(app)/app/layout.tsx");
    assert.match(layout, /for \(const href of SOURCE_LOGO_FILES\) preload\(href, \{ as: "image" \}\)/);
  });
});
