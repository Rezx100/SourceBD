// The buyer app on a phone (`context/feature-specs/handoff-dashboard-mobile.md`).
//
// M0, the founder's video of 30 Sep 2026: a record and the RFQ composer could
// not be scrolled on a phone at all. Below 768px the window scrolls, and the
// pane's scroll region, which contained its overscroll, swallowed every swipe.
// Two trays stayed open at once, and nothing but their own button closed one.
// Every field zoomed the page on iOS.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { phoneFontSize } from "@/lib/design/tokens";
import { installMenuDismiss, MENU_NAME, placePanel } from "@/lib/dashboard/menu-dismiss";
import { MORE_NAV, NAV, PHONE_TABS } from "@/lib/dashboard/nav";
import { buildCard, buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { AccountMenu } from "./account-menu";
import { AppShell } from "./app-shell";
import { Checkbox, Menu, MenuItem, Seg, buttonClass } from "./controls";
import { DataTable } from "./page";
import { ReportProblem } from "./report-problem";
import { PanelHeader } from "./results-panel";
import { ResultsTable } from "./results-table";
import { SupplierResultCard } from "./supplier-result-card";
import { SupplierSheet } from "./supplier-sheet";
import { SearchComposer } from "./search-composer";
import { RecordPane, ResultsColumn, SheetScroll } from "./sheet";
import { goToSection, sectionAt, type TabClick } from "./sheet-tabs";

const source = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const KIT = "components/dashboard";
/** Every kit component's source, its comments left out (they name `<details>` in prose). */
const kitSources = () =>
  readdirSync(path.join(process.cwd(), KIT))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: source(`${KIT}/${f}`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "") }));
const classOf = (html: string, re: RegExp) => re.exec(html)?.[1] ?? "";
const bare = (cls: string, utility: string) => cls.split(/\s+/).includes(utility);

describe("M0. one scroller on a phone: the window below md, the regions from md", () => {
  it("the shell's main, the results column and the record's scroll region scroll themselves only from md", () => {
    const shell = renderToStaticMarkup(
      createElement(
        AppShell,
        { sidebar: { counts: { suppliers: null, rfqs: null, saved: null }, recent: [], plan: { name: "" } }, topbar: { caption: "", initial: null } } as unknown as ComponentProps<typeof AppShell>,
        null,
      ),
    );
    const regions = {
      main: classOf(shell, /<main [^>]*class="([^"]*)"/),
      results: classOf(renderToStaticMarkup(createElement(ResultsColumn, null, "x")), /^<div class="([^"]*)"/),
      sheet: classOf(renderToStaticMarkup(createElement(SheetScroll, null, "x")), /data-sheet-scroll="true" class="([^"]*)"/),
    };
    for (const [name, cls] of Object.entries(regions)) {
      assert.ok(cls, `${name}: not found, so this guard would pass vacuously`);
      assert.ok(bare(cls, "md:overflow-y-auto"), `${name} does not scroll itself from md: ${cls}`);
      assert.ok(!bare(cls, "overflow-y-auto") && !bare(cls, "overscroll-contain"), `${name} is a scroll region on a phone, where the window scrolls: ${cls}`);
    }
    assert.ok(bare(regions.sheet, "md:overscroll-contain"), "from md a pane's scroll chains into the results beside it");
    // Sideways, main clips on a phone: a pane sliding in 32px widened the page
    // and the phone zoomed out. `clip`, never `hidden`, which is a scroll container.
    assert.ok(bare(regions.main, "max-md:overflow-x-clip"), `a pane or a skeleton can widen a phone's page: ${regions.main}`);
    assert.ok(!/overflow(-x)?-hidden/.test(regions.main), regions.main);
  });

  it("nothing in the kit contains its overscroll unless it is bounded at every width", () => {
    // A box that grows to its content cannot scroll; containing its overscroll
    // then swallows the swipe the window needed. A bottom sheet or a tray with
    // a max height scrolls inside itself, and there it belongs.
    const offenders: string[] = [];
    for (const { file, text } of kitSources()) {
      for (const m of text.matchAll(/"([^"\n]*)"/g)) {
        const cls = m[1]!;
        if (bare(cls, "overscroll-contain") && !cls.split(/\s+/).some((c) => /^max-h-/.test(c))) offenders.push(`${file}: ${cls}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("every sideways scroll region holds its absolutely placed children, so none widens a phone's page", () => {
    // Below md nothing above a table clips it any more. A screen-reader label
    // (`.sr-only`, absolutely placed) in a table's last column escaped its
    // scroll region to the nearest positioned box, and Saved grew to 1,041px:
    // the phone zoomed the whole page out to fit it.
    const loose: string[] = [];
    for (const { file, text } of kitSources()) {
      for (const m of text.matchAll(/"([^"\n]*)"/g)) {
        const cls = m[1]!.split(/\s+/);
        if (cls.some((c) => /(^|:)overflow-x-auto$/.test(c)) && !cls.some((c) => c === "relative" || c === "sticky")) loose.push(`${file}: ${m[1]}`);
      }
    }
    assert.deepEqual(loose, []);
  });

  /** A tab, its sticky nav, the pane's scroll region and a section, as goToSection reads them. */
  function tab(scrollHeight: number, clientHeight: number) {
    const calls: string[] = [];
    const target = { getBoundingClientRect: () => ({ top: 900 }), hasAttribute: () => true, setAttribute: () => {}, focus: () => {} };
    const scroller = {
      scrollTop: 100,
      scrollHeight,
      clientHeight,
      getBoundingClientRect: () => ({ top: 60 }),
      querySelector: (sel: string) => (sel === '[id="products"]' ? target : null),
      scrollTo: (o: { top: number }) => calls.push(`pane ${o.top}`),
    };
    const nav = { getBoundingClientRect: () => ({ height: 49 }) };
    const link = { hash: "#products", getAttribute: () => null, closest: (sel: string) => (sel === "[data-sheet-scroll]" ? scroller : sel === "nav" ? nav : null) };
    const g = globalThis as { window?: unknown };
    const before = g.window;
    g.window = {
      scrollY: 300,
      matchMedia: () => ({ matches: false }),
      getComputedStyle: () => ({ top: "48px" }),
      scrollTo: (o: { top: number }) => calls.push(`window ${o.top}`),
      history: { replaceState: () => {} },
    };
    try {
      goToSection({ currentTarget: link, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => {} } as unknown as TabClick);
    } finally {
      g.window = before;
    }
    return calls;
  }

  it("a tab scrolls the window when the pane cannot scroll, landing the section under the stuck tabs", () => {
    // 900 + 300 − (49 + 48): the section's place on the page, less the tabs and their sticky offset.
    assert.deepEqual(tab(5000, 5000), ["window 1103"]);
    // 900 − 60 + 100 − 49: inside the pane, as from md.
    assert.deepEqual(tab(5000, 700), ["pane 891"]);
  });
});

describe("M0. trays: one open at a time, closed by a press outside or Escape, kept on the screen", () => {
  it("every tray in the kit is a named disclosure with a marked panel, and none is an ARIA menu", () => {
    const menu = renderToStaticMarkup(createElement(Menu, { label: "Sort", summary: "Sort" } as ComponentProps<typeof Menu>, createElement(MenuItem, { href: "?s=1" } as ComponentProps<typeof MenuItem>, "One")));
    const account = renderToStaticMarkup(createElement(AccountMenu, { account: { initial: "R", name: "R", email: null }, place: "topbar" }));
    const report = renderToStaticMarkup(createElement(ReportProblem, { page: "/app/suppliers/x" }));
    for (const html of [menu, account, report]) {
      assert.match(html, new RegExp(`^<details name="${MENU_NAME}"`));
      assert.match(html, /data-menu-panel=""/);
      assert.doesNotMatch(html, /role="menu(item)?"/);
    }
    // Any <details> whose panel floats is a tray, and a tray carries the name.
    const unnamed: string[] = [];
    for (const { file, text } of kitSources()) {
      for (const m of text.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)) {
        if (/\babsolute\b/.test(m[2]!) && !/name=\{MENU_NAME\}/.test(m[1]!)) unnamed.push(`${file}: <details${m[1]}>`);
      }
    }
    assert.deepEqual(unnamed, []);
  });

  it("the shell mounts the dismiss once, and the typeahead closes on a touch", () => {
    assert.equal((source(`${KIT}/app-shell.tsx`).match(/<MenuDismiss \/>/g) ?? []).length, 1);
    const typeahead = source(`${KIT}/search-typeahead.tsx`);
    assert.match(typeahead, /addEventListener\("pointerdown", onDown\)/);
    assert.doesNotMatch(typeahead, /"mousedown"/, "iOS sends no mouse event for a tap on plain content");
  });

  /** A document with `details` trays, as installMenuDismiss reads it. */
  function doc() {
    const listeners: Record<string, (e: unknown) => void> = {};
    const styles: Record<string, string>[] = [];
    const make = (id: string) => {
      const style: Record<string, string> = {};
      styles.push(style);
      const summary = { focused: false, focus() { this.focused = true; }, getBoundingClientRect: () => ({ top: 660, bottom: 692, left: 300, right: 380, width: 80, height: 32 }) };
      const panel = { style, getBoundingClientRect: () => ({ top: 700, bottom: 1000, left: 300, right: 520, width: 220, height: 300 }) };
      const d = {
        id, tagName: "DETAILS", open: false, summary,
        getAttribute: (k: string) => (k === "name" ? MENU_NAME : null),
        contains: (n: unknown) => n === d || n === summary || n === panel,
        querySelector: (sel: string) => (sel.includes("summary") ? summary : panel),
      };
      return d;
    };
    const a = make("a");
    const b = make("b");
    const document = {
      activeElement: null as unknown,
      addEventListener: (t: string, f: (e: unknown) => void, capture: boolean) => {
        assert.equal(capture, true, `${t} is not heard in the capture phase`);
        listeners[t] = f;
      },
      removeEventListener: (t: string) => delete listeners[t],
      querySelectorAll: () => [a, b].filter((d) => d.open),
      defaultView: { innerWidth: 390, innerHeight: 844, getComputedStyle: () => ({ position: "absolute" }), addEventListener: (t: string, f: (e: unknown) => void) => void (listeners[`window:${t}`] = f), removeEventListener: (t: string) => delete listeners[`window:${t}`] },
    };
    const off = installMenuDismiss(document as unknown as Document);
    return { a, b, document, listeners, styles, off };
  }

  it("a press outside closes the open tray, a press inside does not, Escape closes it and is marked handled", () => {
    const { a, document, listeners, off } = doc();
    a.open = true;
    listeners.pointerdown!({ target: a.summary });
    assert.equal(a.open, true, "a press on the tray's own button closed it before its click could");
    listeners.pointerdown!({ target: {} });
    assert.equal(a.open, false, "a press outside left the tray open");
    a.open = true;
    let prevented = false;
    listeners.keydown!({ key: "Escape", preventDefault: () => (prevented = true) });
    assert.equal(a.open, false);
    assert.ok(prevented, "the record's own Escape would close the record too");
    assert.equal(a.summary.focused, false, "focus was elsewhere, and Escape pulled it into the tray");
    a.open = true;
    document.activeElement = a.summary;
    listeners.keydown!({ key: "Escape", preventDefault: () => {} });
    assert.equal(a.summary.focused, true, "focus inside the tray is not returned to its button");
    // With nothing open, Escape is the record's.
    prevented = false;
    listeners.keydown!({ key: "Escape", preventDefault: () => (prevented = true) });
    assert.equal(prevented, false);
    // Choosing an item closes its tray, even when the choice goes nowhere new.
    a.open = true;
    listeners.click!({ target: { closest: (sel: string) => (sel.includes("[data-menu-item]") ? { closest: () => a } : null) } });
    assert.equal(a.open, false, "Archive, chosen, left the menu open over the row");
    off();
    assert.deepEqual(Object.keys(listeners), []);
  });

  it("opening a tray closes the other and keeps it on the screen", () => {
    const { a, b, listeners, styles } = doc();
    a.open = true;
    b.open = true;
    listeners.toggle!({ target: b });
    assert.equal(a.open, false, "two trays open at once");
    // 300–520 wide on a 390 screen, 700–1000 tall on 844: moved left and up above its button.
    assert.equal(styles[1]!.translate, "-138px -344px");
  });

  it("placePanel moves a panel in from the edges, opens it upward, or bounds it", () => {
    const view = { width: 390, height: 844 };
    const button = { top: 400, bottom: 432, left: 20, right: 100, width: 80, height: 32 };
    const fits = placePanel({ top: 436, bottom: 636, left: 20, right: 240, width: 220, height: 200 }, button, view);
    assert.deepEqual(fits, { dx: 0, dy: 0, maxHeight: null });
    const off = placePanel({ top: 436, bottom: 636, left: 240, right: 510, width: 270, height: 200 }, button, view);
    assert.equal(off.dx, -128, "the panel runs off the right edge");
    const tall = placePanel({ top: 436, bottom: 1300, left: 20, right: 240, width: 220, height: 864 }, button, view);
    assert.deepEqual(tall, { dx: 0, dy: 0, maxHeight: 400 }, "a panel that fits neither way is bounded and scrolls");
  });
});

describe("M0. touch: fields do not zoom, hover does not stick", () => {
  it("nothing in the kit is shown only under a hovering pointer", () => {
    // `hover:` needs a pointer that hovers now, so an action revealed only on
    // hover (Products' Send RFQ and Edit) was gone on a phone, not two taps away.
    const hidden: string[] = [];
    for (const { file, text } of kitSources()) {
      for (const m of text.matchAll(/"([^"\n]*)"/g)) {
        const cls = m[1]!.split(/\s+/);
        if (cls.includes("invisible") && cls.some((c) => /group-hover(\/\w+)?:visible$/.test(c)) && !cls.includes("[@media(hover:none)]:visible")) hidden.push(`${file}: ${m[1]}`);
      }
    }
    assert.deepEqual(hidden, []);
  });

  it("a field is 16px on a touch screen, and hover styles need a pointer that hovers", () => {
    const css = source("app/ds.css");
    assert.match(css, /@media \(pointer: coarse\) \{\s*\[data-shell\] :is\(input, select, textarea\) \{\s*font-size: max\(1rem, 1em\);/);
    assert.match(css, /@media \(hover: hover\) \{\s*\.link:hover \{/);
    assert.match(source("tailwind.config.ts"), /future: \{ hoverOnlyWhenSupported: true \}/);
  });
});

describe("M1. the navigation at the foot of a phone, and the phone's size scale", () => {
  const shell = (active: string) =>
    renderToStaticMarkup(
      createElement(
        AppShell,
        {
          sidebar: { active, counts: { suppliers: 10266, rfqs: 2, saved: 3 }, recent: [], plan: { name: "Free", note: "public beta" }, account: { initial: "R", name: "Rezaul Karim", email: "r@example.invalid" } },
          topbar: { caption: "", initial: "R", searchAction: "/app/discover" },
        } as unknown as ComponentProps<typeof AppShell>,
        "x",
      ),
    );
  const bar = (html: string) => /<nav aria-label="Tab bar" class="fixed [\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
  const tabs = (html: string) =>
    [...bar(html).matchAll(/<(a|summary)\b([^>]*class="[^"]*\btext-nav-label\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
      attrs: m[2]!,
      body: m[3]!,
      label: m[3]!.replace(/<[^>]+>/g, "").trim(),
    }));

  it("the phone's type step: body 16, a card's title 17, a section 17, a page title 22, the record's name 24, only below 640px", () => {
    const px = (rem: string) => Math.round(parseFloat(rem) * 16);
    assert.deepEqual(Object.fromEntries(Object.entries(phoneFontSize).map(([k, [size]]) => [k, px(size)])), { base: 16, title: 17, xl: 17, "3xl": 24, "page-title": 22 });
    const tw = source("tailwind.config.ts");
    assert.match(tw, /addBase\(\{ "@media not all and \(min-width: 640px\)": \{ "\[data-shell\]": appFontVars\(phoneFontSize\) \} \}\)/, "the phone step is not scoped to phones");
    assert.match(tw, /!\(key in appFontSize\) && !\(key in phoneFontSize\)/, "a phone size would not read its variable");
    assert.match(source(`${KIT}/page.tsx`), /<h1 className="text-page-title font-semibold/, "the page title is not on its token");
  });

  it("the bar holds five tabs in order, each a 24px icon over an 11px label, and marks only the current one", () => {
    const saved = tabs(shell("saved"));
    assert.deepEqual(saved.map((t) => t.label), ["Search", "Saved", "RFQs", "Messages", "More"]);
    for (const t of saved) assert.match(t.body, /<svg[^>]*width="24" height="24"/, `${t.label}: not a 24px icon`);
    assert.deepEqual(saved.map((t) => /aria-current="page"/.test(t.attrs)), [false, true, false, false, false]);
    assert.match(saved[1]!.attrs, /\btext-ink-strong\b[^"]*shadow-\[inset_0_2px_0_rgb\(var\(--ds-accent\)\)\]/, "the current tab is marked by colour alone");
    assert.doesNotMatch(saved[0]!.attrs, /\btext-ink-strong\b/);
    // A page under More marks More, and the item in its sheet.
    const orders = shell("orders");
    assert.match(tabs(orders)[4]!.attrs, /\btext-ink-strong\b/, "on Orders, More does not read as current");
    assert.match(orders, /<a data-menu-item=""(?=[^>]*aria-current="page")[^>]*href="\/app\/orders"/);
  });

  it("More holds every destination the bar does not, then the account and Sign out", () => {
    const sheet = /aria-label="More" class="fixed [\s\S]*?<\/details>/.exec(bar(shell("search")))?.[0] ?? "";
    assert.ok(sheet, "no More sheet");
    const hrefs = [...sheet.matchAll(/<a data-menu-item=""[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, MORE_NAV.map((n) => n.href));
    assert.deepEqual(MORE_NAV.map((n) => n.key).sort(), NAV.filter((n) => !PHONE_TABS.includes(n.key)).map((n) => n.key).sort());
    assert.match(sheet, /Rezaul Karim/);
    assert.match(sheet, /<form action="\/auth\/sign-out" method="post"><button type="submit" data-menu-item=""[^>]*>[\s\S]*?Sign out/);
    assert.match(sheet, /data-menu-close=""[^>]*>Done</, "the sheet has no Done");
  });

  it("the bar is fixed to the foot above the safe area, the page is padded for it, and both bars step aside for a detail", () => {
    const html = shell("search");
    const cls = /<nav aria-label="Tab bar" class="([^"]*)"/g;
    const barClass = [...html.matchAll(cls)].map((m) => m[1]!).find((c) => c.startsWith("fixed"))!;
    for (const c of ["fixed", "bottom-0", "pb-[env(safe-area-inset-bottom)]", "md:hidden", "group-has-[[data-detail]]/shell:hidden"]) assert.ok(bare(barClass, c), `${c}: ${barClass}`);
    const main = classOf(html, /<main [^>]*class="([^"]*)"/);
    assert.ok(bare(main, "max-md:pb-[calc(theme(height.tabbar)_+_env(safe-area-inset-bottom))]"), main);
    assert.ok(bare(main, "max-md:group-has-[[data-detail]]/shell:pb-0"), main);
    const topbar = classOf(html, /<div class="(glass [^"]*)"/);
    for (const c of ["max-md:sticky", "max-md:top-0", "max-md:h-topbar-phone", "max-md:group-has-[[data-detail]]/shell:hidden"]) assert.ok(bare(topbar, c), `${c}: ${topbar}`);
    // What floats at the foot of a phone page sits above the bar, not under it.
    const lift = "max-md:bottom-[calc(theme(height.tabbar)_+_env(safe-area-inset-bottom)";
    assert.ok(source(`${KIT}/selection-bar.tsx`).includes(lift), "the selection bar sits under the tab bar");
    assert.ok(source(`${KIT}/toast.tsx`).includes(lift), "a toast sits under the tab bar");
    // The rail is from md only: no strip across the top of a phone.
    assert.match(html, /<aside[^>]*class="hidden [^"]*\bmd:flex\b/);
    assert.match(renderToStaticMarkup(createElement(RecordPane, null, "x")), /^<div data-detail=""/);
  });
});

describe("M2. the search on a phone", () => {
  const composer = renderToStaticMarkup(
    createElement(SearchComposer, {
      chips: [{ key: "q", label: "knit", removeHref: "/app/discover" }],
      submits: true,
      filtersHref: "/app/discover?q=knit&filters=1",
      setCount: 2,
      menus: createElement("span", null, "menus"),
    }),
  );

  it("the filter box drops its card: Filters · N, then one row of menus and filters that scrolls sideways", () => {
    const box = classOf(composer, /^<div class="([^"]*)"/);
    for (const c of ["max-sm:bg-transparent", "max-sm:shadow-none", "max-sm:p-0"]) assert.ok(bare(box, c), `${c}: ${box}`);
    assert.match(composer, /<a class="[^"]*\bsm:hidden\b[^"]*" href="\/app\/discover\?q=knit&amp;filters=1">[\s\S]*?Filters<span[^>]*>· (?:<!-- -->)?2<\/span><\/a>/, "no Filters · N on a phone");
    const row = classOf(composer, /<div class="(relative flex min-w-0 flex-1[^"]*)"/);
    for (const c of ["max-sm:flex-nowrap", "max-sm:overflow-x-auto", "max-sm:snap-x", "max-sm:[scrollbar-width:none]"]) assert.ok(bare(row, c), `${c}: ${row}`);
    assert.match(composer, /bg-gradient-to-l from-canvas to-transparent sm:hidden/, "no fade at the row's edge");
    assert.match(composer, /<button type="submit" aria-label="Search" class="hidden [^"]*\bsm:grid\b/, "the go disc reloads the same search on a phone");
    assert.match(composer, /class="hidden [^"]*\bsm:inline-flex\b"[^>]*>[\s\S]*?Add filter/, "Add filter shows on a phone, beside Filters");
    assert.match(composer, /aria-label="Remove knit" class="hit"/, "the chip's × is a 12px target");
    assert.match(source("app/(app)/app/discover/page.tsx"), /setCount=\{filterCount\(state\)\}/, "the phone's Filters count is not the set filters");
  });

  it("below sm every tray is a bottom sheet with a scrim, a Done and 52px rows; the tab bar steps aside for it", () => {
    const menu = renderToStaticMarkup(createElement(Menu, { label: "Sort", summary: "Sort" } as ComponentProps<typeof Menu>, createElement(MenuItem, { href: "?s=1" } as ComponentProps<typeof MenuItem>, "One")));
    const panel = classOf(menu, /data-menu-panel="" class="([^"]*)"/);
    for (const c of ["max-sm:fixed", "max-sm:inset-x-0", "max-sm:bottom-0", "max-sm:max-h-[70dvh]", "max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]", "max-sm:rounded-t-lg"]) assert.ok(bare(panel, c), `${c}: ${panel}`);
    assert.match(menu, /<div data-menu-close="" aria-hidden="true" class="fixed inset-0 [^"]*\bsm:hidden\b/, "no scrim takes the tap outside the sheet");
    assert.match(menu, /<button type="button" data-menu-close=""[^>]*>Done<\/button>/);
    assert.match(menu, /<a data-menu-item=""[^>]*class="[^"]*\bmax-sm:min-h-sheet-row\b/);
    const bar = source(`${KIT}/bottom-nav.tsx`);
    assert.match(bar, /max-sm:group-has-\[main_details\[name=sb-menu\]\[open\]\]\/shell:hidden/, "the tab bar covers a sheet opened from the page");
    // …and so does the selection bar: the Sort sheet opens inside the isolated results panel.
    assert.match(source(`${KIT}/selection-bar.tsx`), /max-sm:group-has-\[main_details\[name=sb-menu\]\[open\]\]\/shell:hidden/, "the selection bar covers the Sort sheet");
  });

  it("the results header: the title on one line, the count on one line, then Sort, the switch and a ⋯ with the rest", () => {
    const html = renderToStaticMarkup(
      createElement(PanelHeader, {
        model: {
          title: "knit · Sanctioned hidden",
          total: 4645,
          shown: 25,
          sortLabel: "Most registers & certifiers",
          view: "table" as const,
          saveHref: "?save=1",
          exportHref: "/api/v1/discover/export?q=knit",
          sortOptions: [{ value: "sources", label: "Most registers & certifiers", href: "?sort=sources", active: true }],
          densityOptions: [{ value: "default", label: "Default", href: "?d=default", active: true }],
        },
      }),
    );
    assert.match(html, /<span data-line="" class="max-sm:block max-sm:truncate">knit · Sanctioned hidden<\/span>/);
    assert.match(html, /<span class="[^"]*\bwhitespace-nowrap tabular-nums\b[^"]*">4,645 suppliers · 1–25<\/span>/, "the count breaks inside its range");
    assert.equal((html.match(/<details name="sb-menu"[^>]*><summary aria-label="Sort"/g) ?? []).length, 1, "one set of sort items, moved by CSS");
    const more = /<details name="sb-menu" class="[^"]*\bsm:hidden\b[^"]*"><summary aria-label="More for this search"[\s\S]*?<\/details>/.exec(html)?.[0] ?? "";
    assert.ok(more, "no ⋯ on a phone");
    for (const t of ["Save search", "Export CSV", "Default"]) assert.match(more, new RegExp(`>${t}<`), `${t} is not in the ⋯`);
    assert.match(html, /<div class="contents max-sm:hidden">[\s\S]*?Save search[\s\S]*?Export CSV/, "the full row of controls shows on a phone too");
  });
});

describe("M3. the list and the card on a phone", () => {
  it("below sm the table is a list of rows: the box and the supplier, a metrics line, the whole row opening the record; below xl the compact grid", () => {
    const row = { ...buildTableRow(aboniInput()), supplierId: "8ce50581-2d84-4cc2-93de-506394eade5d" };
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [row] }));
    const table = classOf(html, /<table class="([^"]*)"/);
    assert.ok(!table.split(/\s+/).some((c) => /^min-w-\[/.test(c)), `a phone's table has a minimum width, so it scrolls sideways: ${table}`);
    assert.ok(bare(table, "sm:min-w-[30rem]") && bare(table, "xl:min-w-[60rem]"), table);
    const cols = [...html.matchAll(/<col\b([^>]*)\/?>/g)].map((m) => /class="([^"]*)"/.exec(m[1]!)?.[1] ?? "");
    assert.deepEqual(
      cols.map((c) => (c.includes("max-sm:hidden") ? "phone" : c.includes("max-xl:hidden") ? "wide" : "all")),
      ["all", "all", "phone", "wide", "wide", "phone", "phone"],
      "the columns a phone and a tablet drop",
    );
    const cells = [...html.matchAll(/<(td|th)\b[^>]*class="([^"]*)"/g)].filter((m) => m[1] === "td" || /scope="row"/.test(m[0]));
    assert.deepEqual(
      cells.map((m) => (m[2]!.includes("max-sm:hidden") ? "phone" : m[2]!.includes("max-xl:hidden") ? "wide" : "all")),
      ["all", "all", "phone", "wide", "wide", "phone", "phone"],
      "a row's cells do not drop with their columns",
    );
    assert.match(html, /<div data-line="" class="[^"]*\bsm:hidden\b[^"]*">[\s\S]*?workers/, "no metrics line on a phone");
    assert.match(html, /data-open="record"[^>]*class="[^"]*max-sm:after:absolute max-sm:after:inset-0/, "the row does not open the record");
    assert.match(html, /<th scope="row" class="[^"]*\bmax-sm:relative\b/);
    assert.match(html, /role="checkbox"[^>]*class="[^"]*\bhit\b/, "the row's box is a 16px target");
    assert.match(html, /<span class="group\/open relative inline-flex max-xl:hidden">/, "Open crowds the tablet's actions column");
  });

  it("the card on a phone: one column, two chips then +N, the marks on one line, the thumbnails snapping under a fade, the actions last", () => {
    const html = renderToStaticMarkup(createElement(SupplierResultCard, { card: buildCard(aboniInput()) }));
    const card = classOf(html, /<article [^>]*class="([^"]*)"/);
    for (const c of ["max-sm:grid", "max-sm:grid-cols-[auto_auto_minmax(0,1fr)]", "max-sm:px-4"]) assert.ok(bare(card, c), `${c}: ${card}`);
    assert.match(html, /max-sm:\[&amp;&gt;\*:nth-child\(n\+3\):not\(\[data-more\]\)\]:hidden/, "more than two chips on a phone");
    assert.match(html, /<span data-more="" class="text-sm text-ink-subtle sm:hidden">\+4/, "no +N for the chips a phone drops");
    assert.match(html, /max-sm:flex-nowrap max-sm:gap-1\.5 max-sm:\[&amp;&gt;\*\]:size-5/, "the marks wrap, or are not 20px");
    assert.match(html, /<ul [^>]*class="[^"]*\bmax-sm:snap-x\b/, "the thumbnails do not snap");
    assert.match(html, /<li class="w-12 shrink-0 snap-start"/);
    assert.match(html, /bg-gradient-to-l from-surface to-transparent sm:hidden/, "no fade at the strip's edge");
    assert.match(html, /<p data-line="" [^>]*class="[^"]*max-sm:line-clamp-2 sm:truncate/, "the facts are cut to one line on a phone");
    assert.match(html, /<a(?=[^>]*aria-label="Open [^"]*beside the results")(?=[^>]*class="[^"]*\bmax-sm:hidden\b)[^>]*>/, "Open is on the phone's card, which opens the record itself");
    assert.match(html, /max-sm:order-last max-sm:col-span-full max-sm:justify-end/, "the actions are not the card's last row");
  });
});

describe("M4. the record on a phone", () => {
  const html = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...buildSheet(aboniInput()), closeHref: "/app/discover?q=knit", fullHref: "/app/suppliers/aboni-knitwear" } }));

  it("a sticky bar: ‹ Results below lg, no read range or Expand on a phone, the name once the head has gone", () => {
    const bar = classOf(html, /<div class="(flex min-h-\[52px\][^"]*)"/);
    for (const c of ["max-md:sticky", "max-md:top-[theme(height.topbar-phone)]", "max-md:group-has-[[data-detail]]/shell:top-0", "max-md:bg-surface"]) assert.ok(bare(bar, c), `${c}: ${bar}`);
    assert.match(html, /<a(?=[^>]*\blg:hidden\b)[^>]*href="\/app\/discover\?q=knit"[^>]*>(?:(?!<\/a>)[\s\S])*Results/, "no way back to the results on a phone");
    assert.match(html, /aria-label="Close"[^>]*class="[^"]*\bhidden lg:inline-flex\b|class="[^"]*\bhidden lg:inline-flex\b[^"]*"[^>]*aria-label="Close"/, "a × on a phone, where nothing sits beside the record");
    assert.match(html, /<span data-line="" title="Read [^"]*" class="hidden [^"]*\bmd:inline\b/, "the read range crowds a phone's bar");
    assert.match(html, /<span aria-hidden="true" data-name="" title="[^"]+" class="[^"]*\bmd:hidden\b[^"]*">Aboni Knitwear Ltd<\/span>/, "no name in the bar for when the head has scrolled away");
    assert.match(html, /<div data-record-head=""/);
  });

  it("the head: the name on two lines at most, the facts without dots, one line of marks", () => {
    assert.match(html, /<h1 [^>]*><span data-name="" title="[^"]+" class="block max-sm:line-clamp-2 sm:truncate">/);
    const meta = /export function MetaLine[\s\S]*?\n}\n/.exec(source(`${KIT}/supplier-result-card.tsx`).replace(/\r\n/g, "\n"))?.[0] ?? "";
    assert.ok(meta, "MetaLine moved; this guard needs rewriting");
    assert.doesNotMatch(meta, /content-\['·'\]/, "a wrapped facts line starts with a dot again");
    assert.match(html, /max-sm:flex-nowrap max-sm:gap-1\.5 max-sm:\[&amp;&gt;\*\]:size-5 max-sm:\[&amp;&gt;\*:last-child\]:hidden/, "the head's marks wrap on a phone, or keep their count");
  });

  it("the tabs stick under the bar, snap, fade at their edge, and follow the section on screen", () => {
    const nav = classOf(html, /<nav aria-label="Record sections" tabindex="0" class="([^"]*)"/);
    for (const c of ["max-md:top-[calc(theme(height.topbar-phone)_+_52px)]", "max-md:group-has-[[data-detail]]/shell:top-[52px]", "max-md:snap-x", "max-md:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]"]) {
      assert.ok(bare(nav, c), `${c}: ${nav}`);
    }
    assert.match(html, /<a href="#products"[^>]*class="[^"]*\bmax-md:h-11 max-md:snap-start\b/);
    assert.equal(sectionAt([{ id: "overview", top: 300 }, { id: "products", top: 900 }], 100), "overview", "above every section, the first is current");
    assert.equal(sectionAt([{ id: "overview", top: -800 }, { id: "products", top: 90 }, { id: "sources", top: 600 }], 100), "products");
    assert.match(html, /<section id="products" class="[^"]*max-md:scroll-mt-\[148px\] max-md:group-has-\[\[data-detail\]\]\/shell:scroll-mt-\[96px\]/, "a section lands under the stuck bar and tabs");
  });

  it("a fact is two lines on a phone, and the action bar sticks to the foot above the home bar", () => {
    assert.match(html, /class="flex min-h-fact-row [^"]*max-sm:grid max-sm:grid-cols-\[minmax\(0,1fr\)_auto\]/, "a fact takes three lines, the mark alone on the last");
    const bar = classOf(html, /<div class="(glass flex shrink-0 flex-wrap[^"]*)"/);
    for (const c of ["max-md:sticky", "max-md:bottom-0", "max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"]) assert.ok(bare(bar, c), `${c}: ${bar}`);
    assert.match(html, /class="[^"]*max-sm:flex-1[^"]*"[^>]*>[\s\S]{0,400}?Send RFQ|Send RFQ[\s\S]{0,10}/);
    const focus = source(`${KIT}/dialog-focus.tsx`);
    assert.match(focus, /if \(paneIsScreen\(\)\) window\.scrollTo\(0, 0\);/, "a record opens part-way down on a phone");
    assert.match(focus, /row\.scrollIntoView\(\{ block: "center" \}\)/, "closing a record leaves the row it came from off the screen");
  });
});

describe("M5. the composer, the other pages and the touch sweep", () => {
  it("the composer on a phone: 16px gutters, the preview behind 'Preview message', Send in a sticky footer", () => {
    const src = source(`${KIT}/rfq-composer.tsx`);
    assert.match(src, /className="grid gap-6 p-6 max-md:gap-5 max-md:p-4 /, "24px gutters on a phone");
    assert.match(src, /<details ref=\{previewRef\} open [^>]*aria-label="Preview">\s*<summary [^>]*\bsm:hidden\b[^>]*>[\s\S]*?Preview message/, "the preview is not behind a disclosure on a phone");
    assert.match(src, /!window\.matchMedia\("\(min-width: 640px\)"\)\.matches\) previewRef\.current\.open = false/, "the preview stays open on a phone");
    assert.match(src, /max-md:sticky max-md:bottom-0 max-md:z-sticky max-md:pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/, "Send is at the end of the form on a phone");
    assert.match(src, /className="max-sm:h-bar-button max-sm:flex-1">\s*<Icon name="send" \/> Send RFQ/);
  });

  it("every data table is a list on a phone: no header row, no minimum width, each row a block of its cells", () => {
    const html = renderToStaticMarkup(createElement(DataTable, { label: "Orders", minWidth: "56rem" } as ComponentProps<typeof DataTable>, createElement("tbody", null)));
    const table = classOf(html, /<table class="([^"]*)"/).replace(/&amp;/g, "&");
    for (const c of ["max-sm:!min-w-0", "max-sm:block", "max-sm:[&_thead]:hidden", "max-sm:[&_tr]:flex", "max-sm:[&_tr]:flex-wrap", "max-sm:[&_td]:p-0"]) assert.ok(bare(table, c), `${c}: ${table}`);
  });

  it("every small control reaches 44px under a finger: icon buttons, boxes, the view switch, marks, reasons and the ⋯", () => {
    assert.ok(bare(buttonClass({ icon: true, size: "sm" }), "hit"), "an icon button is a 28px target");
    assert.ok(!bare(buttonClass({ size: "sm" }), "hit"), "a labelled button is wide enough already");
    assert.match(renderToStaticMarkup(createElement(Checkbox, { on: false, label: "Select" })), /class="hit /);
    assert.match(renderToStaticMarkup(createElement(Seg, { label: "View", value: "a", options: [{ value: "a", label: "A", icon: "table" }] })), /class="hit /);
    assert.match(source(`${KIT}/marks.tsx`), /className=\{cn\(classes, "hit"\)\}/, "a source mark's link is a 16px target");
    assert.match(source(`${KIT}/sheet.tsx`), /className="hit inline-flex min-h-6 min-w-6/, "a reason is a 24px target");
    assert.match(source(`${KIT}/report-problem.tsx`), /className="hit flex h-control w-control/, "the record's ⋯ is a 32px target");
    // The hit area never moves a positioned control: `:where` has no weight.
    assert.match(source("app/ds.css"), /@media \(pointer: coarse\) \{[\s\S]*?:where\(\.hit\) \{\s*position: relative;[\s\S]*?\.hit::after \{\s*content: "";\s*position: absolute;\s*inset: -8px;/);
    assert.match(buttonClass({}), /\[touch-action:manipulation\]/, "a tap waits for a double-tap zoom");
  });
});
