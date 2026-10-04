// The founder's video of 29 Sep 2026, the stability half (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`, PR 1):
//
//  1. Clicking a record tab scrolled the whole app: the search's filter bar
//     slid off the top and an empty strip opened at the foot. A tab now
//     scrolls the pane's own region, and nothing above it can be scrolled.
//  2. The worker figures ran under the row's Save and RFQ icons, and the
//     compact actions column could not hold its own two buttons.
//  3. Names broke mid-word ("Benchmar k") beside a pane. Since the founder's
//     review of 29 Sep a name is one line cut at the end (the One-Line Name
//     Rule), so a row is two lines and the column is not sized for a word.
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

import { buildTableRow } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { SOURCE_LOGO_FILES } from "@/lib/dashboard/source-logos";
import { AppShell } from "./app-shell";
import { RESULTS_COLUMNS, RESULTS_MIN_WIDTH, ResultsTable } from "./results-table";
import { SheetSection, Workbench } from "./sheet";
import { callWithHooks } from "./hook-harness";
import { SheetTabs, goToSection, type TabClick } from "./sheet-tabs";
import { WorkersCell } from "./workers-cell";

const repoRoot = process.cwd();
const source = (p: string) => readFileSync(path.join(repoRoot, p), "utf8");

describe("1. a record tab scrolls the pane, never the app", () => {
  it("the shell and every list-and-pane frame refuse to be scrolled, by a script as much as by a person", () => {
    const shell = renderToStaticMarkup(
      createElement(
        AppShell,
        { sidebar: { counts: { suppliers: null, rfqs: null, saved: null }, recent: [], plan: { name: "" } }, topbar: { caption: "", initial: null } } as unknown as ComponentProps<typeof AppShell>,
        null,
      ),
    );
    const root = /^<div [^>]*class="([^"]*)"/.exec(shell)?.[1] ?? "";
    assert.match(root, /\bmd:overflow-clip\b/, `the shell root can be scrolled: ${root}`);
    assert.doesNotMatch(root, /overflow-hidden/, "`hidden` still lets a fragment or a focus call scroll the shell");
    const frame = renderToStaticMarkup(createElement(Workbench, null, "x"));
    assert.match(frame, /\blg:overflow-clip\b/);
    // Every page that lays a list beside a pane draws that frame, not a copy of it.
    for (const page of [
      "app/(app)/app/saved/page.tsx",
      "app/(app)/app/saved/loading.tsx",
    ]) {
      const s = source(page);
      assert.match(s, /<Workbench>/, `${page} does not draw the Workbench frame`);
      assert.doesNotMatch(s, /lg:flex-row/, `${page} draws a list-and-pane frame of its own`);
    }
    // The search is on the v4 frame (B4): its list and pane are `ListPane`, which scrolls
    // each in its own box; the page draws no list-and-pane frame of its own, and the
    // landing and the loading states sit inside the frame's scrolling `<main>`.
    const orders = source("app/(app)/app/orders/(list)/page.tsx");
    assert.match(orders, /<ListPane\b/, "the order list does not draw the frame's list and pane");
    assert.doesNotMatch(orders, /<Workbench>|lg:flex-row/, "the order list draws a list-and-pane frame of its own");
    const rfqs = source("app/(app)/app/rfqs/(list)/page.tsx");
    assert.match(rfqs, /<ListPane\b/, "the RFQ list does not draw the frame's list and pane");
    assert.doesNotMatch(rfqs, /<Workbench>|lg:flex-row/, "the RFQ list draws a list-and-pane frame of its own");
    const discover = source("app/(app)/app/discover/page.tsx");
    assert.match(discover, /<ListPane\b/, "the search does not draw the frame's list and pane");
    assert.doesNotMatch(discover, /<Workbench>|lg:flex-row/, "the search draws a list-and-pane frame of its own");
    assert.match(source("components/frame/list-pane.tsx"), /overflow-y-auto/, "the frame's list and pane do not scroll themselves");
  });

  it("every tab link carries the handler", () => {
    const nav = callWithHooks(SheetTabs, {
      tabs: [
        { label: "Overview", count: null, href: "#overview", active: true },
        { label: "Products", count: "6", href: "#products" },
        { label: "Facilities", count: null, href: null },
      ],
    }).out;
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
  // Measured in Geist, 29 Sep 2026, at the buyer app's text (one step up,
  // PR 4): the workers second line at 13px ("11,119 with buildings") is
  // 115px; its words alone 83px. The workers checks below keep the margin the
  // 12px measurements had.
  // px-3 either side, the tile, its gap: 40px and 12 in the list, 24px and 10 beside a pane.
  const NAME_CHROME = { wide: 24 + 40 + 12, compact: 24 + 24 + 10 };
  const fixed = (cols: readonly (number | null)[]) => cols.reduce<number>((s, w) => s + (w ?? 0), 0);

  it("a name is one line cut at the end, so a row is two lines and the table fits the column beside a pane", () => {
    // The One-Line Name Rule (founder, 29 Sep 2026) replaced "the supplier
    // column keeps its longest word": at its minimum the column still shows
    // about ten characters of name, and beside a pane at 1280 (a 1048px
    // region, the pane at half, 16px gutters) the compact table fits without
    // scrolling sideways.
    for (const layout of ["wide", "compact"] as const) {
      const text = RESULTS_MIN_WIDTH[layout] - fixed(RESULTS_COLUMNS[layout]) - NAME_CHROME[layout];
      assert.ok(text >= 90, `${layout}: at the table's minimum a name gets ${text}px`);
    }
    // The wide table below xl (a tablet): the compact grid, its dropped columns 0.
    const mid = RESULTS_MIN_WIDTH.mid - fixed(RESULTS_COLUMNS.mid) - NAME_CHROME.wide;
    assert.ok(mid >= 90, `below xl a name gets ${mid}px`);
    // At 768 the content region is 768 − the 232px rail − 2 × 24px, and the panel's own edges.
    assert.ok(RESULTS_MIN_WIDTH.mid <= 768 - 232 - 48 - 2, "a tablet's list scrolls sideways");
    assert.ok(RESULTS_MIN_WIDTH.compact <= 1048 - Math.min(760, Math.max(480, 1048 / 2)) - 32, "beside a pane at 1280 the compact table scrolls sideways");
    assert.ok(RESULTS_MIN_WIDTH.wide <= 1048 - 48, "at 1280 the wide table scrolls sideways");
    const table = source("components/dashboard/results-table.tsx");
    assert.match(table, /compact \? "min-w-\[28rem\]" : "sm:min-w-\[30rem\] xl:min-w-\[60rem\]"/, "RESULTS_MIN_WIDTH no longer says what the table draws");
    assert.match(table, /size=\{compact \? "sm" : "row"\}/, "NAME_CHROME no longer says which tile the row draws");
    assert.equal(RESULTS_MIN_WIDTH.compact, 28 * 16);
    assert.equal(RESULTS_MIN_WIDTH.wide, 60 * 16);
    // Two lines per row, each cut to one, for the longest name there is.
    const zaheen = "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";
    for (const layout of ["wide", "compact", "rail"] as const) {
      const row = { ...buildTableRow(aboniInput()), name: zaheen, slug: "zaheen", type: "Factory", place: "Narayanganj" };
      const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [row], compact: layout !== "wide", rail: layout === "rail" }));
      const cell = /<th scope="row"[\s\S]*?<\/th>/.exec(html)?.[0] ?? "";
      const lines = [...cell.matchAll(/<(?:span|div)[^>]*data-name=""[^>]*>([^<]*)</g)];
      assert.deepEqual(lines.map((m) => m[1]), ["Zaheen Knitwears Limited", "Shed - 3, 4, 5, 10, 11, 12, 13 · Building - Security, ETP and Fire Pump · Factory · Narayanganj"], `${layout}: not the base name over the qualifier line`);
      for (const [tag] of cell.matchAll(/<(?:span|div)[^>]*data-name=""[^>]*>/g)) assert.match(tag, /\btruncate\b/, `${layout}: a name line can wrap: ${tag}`);
      assert.match(html, new RegExp(`title="${zaheen.replace(/[()]/g, "\\$&").replace(/&/g, "&amp;")}"`), `${layout}: hovering the name does not show all of it`);
      assert.doesNotMatch(cell, /overflow-wrap:anywhere/, `${layout}: a name line still wraps`);
    }
  });

  it("every header label and its sort caret fit their column on one line", () => {
    // Founder's review, 29 Sep 2026: at the app's 13px "Registers &
    // certifiers" and "Export lines" wrapped, the caret on their words.
    // Measured in Geist, 500 13px (a header's `text-xs` in the app), 29 Sep
    // 2026. A label not measured here fails, so a new one gets measured.
    const LABEL: Record<string, number> = { Supplier: 51, Sources: 49.9, Certificates: 70.6, "Export lines": 72, Workers: 50.4 };
    const CARET = 4 + 12; // `gap-1` and the 12px caret, drawn (hidden until active) on every sortable header
    const PAD: Record<string, number> = { "px-1": 8, "px-2": 16, "px-3": 24 };
    const sortHrefs = { name: "?sort=name", sources: "?sort=sources", cert_expiry: "?sort=cert_expiry", hs_lines: "?sort=hs_lines", workers: "?sort=workers" };
    for (const layout of ["wide", "compact"] as const) {
      const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [], compact: layout === "compact", sortHrefs }));
      const cols = RESULTS_COLUMNS[layout];
      const heads = [...html.matchAll(/<th scope="col"[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/th>/g)];
      assert.equal(heads.length, cols.length, `${layout}: one header per column`);
      heads.forEach(([, cls, inner], i) => {
        const label = inner!.replace(/<[^>]+>/g, "").trim();
        if (label === "Select" || label === "Actions") return;
        assert.ok(label in LABEL, `${layout}: "${label}" is not measured; measure it in Geist at 13px medium and add it`);
        const width = cols[i] ?? RESULTS_MIN_WIDTH[layout] - fixed(cols);
        const pad = PAD[/\bpx-[123]\b/.exec(cls!)?.[0] ?? ""] ?? 32;
        assert.ok(LABEL[label]! + CARET <= width - pad, `${layout}: "${label}" needs ${LABEL[label]! + CARET}px and its column gives ${width - pad}px`);
      });
    }
  });

  it("the actions and workers columns hold their contents", () => {
    // Wide: Save, Open and RFQ, 28px each with 2px gaps, inside px-2.
    assert.ok(RESULTS_COLUMNS.wide[6]! - 16 >= 3 * 28 + 2 * 2);
    // Compact: Save and RFQ inside px-1 — 64px with px-2 overflowed by 10px.
    assert.ok(RESULTS_COLUMNS.compact[4]! - 8 >= 2 * 28 + 2);
    // Workers, px-3: the whole second line wide, its words alone beside a pane.
    assert.ok(RESULTS_COLUMNS.wide[5]! - 24 >= 128);
    assert.ok(RESULTS_COLUMNS.compact[3]! - 24 >= 85);
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
