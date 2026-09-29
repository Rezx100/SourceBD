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
import { AccountMenu } from "./account-menu";
import { AppShell } from "./app-shell";
import { Menu, MenuItem } from "./controls";
import { ReportProblem } from "./report-problem";
import { RecordPane, ResultsColumn, SheetScroll } from "./sheet";
import { goToSection, type TabClick } from "./sheet-tabs";

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
    // The rail is from md only: no strip across the top of a phone.
    assert.match(html, /<aside[^>]*class="hidden [^"]*\bmd:flex\b/);
    assert.match(renderToStaticMarkup(createElement(RecordPane, null, "x")), /^<div data-detail=""/);
  });
});
