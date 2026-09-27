// The craft pass of 27 Sep 2026: the record tray's entrance, the page fade,
// the topbar typeahead, the illustrated empty states and the browser
// surfaces. Each test pins the boundary a buyer's browser sees — the rendered
// HTML or the shipped stylesheet — so the motion cannot be dropped, an
// illustration cannot be renamed away, and a suggestion cannot point at the
// wrong page without this file going red.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { light, resolve } from "@/lib/design/tokens";
import { Topbar } from "./app-shell";
import { revealCurrentNavItem } from "./nav-current";
import { fieldValue } from "./search-typeahead";
import { EMPTY_ART, Cell, EmptyState, PageSection, rowClass } from "./page";
import { Button, Menu, MenuItem, buttonClass } from "./controls";
import { formatMoney, formatQuantity, formatRelative, formatTime } from "@/lib/dashboard/facts";
import * as kit from "./index";
import { Sheet } from "./sheet";
import { stepIndex, suggestionHint, suggestionHref, type Suggestion } from "./search-typeahead";

const repoRoot = process.cwd();

describe("typeahead: where a suggestion leads", () => {
  it("a record opens its own page, slug encoded", () => {
    const s: Suggestion = { type: "company", label: "Aboni Knitwear Ltd", sublabel: "Savar, Dhaka", slug: "aboni-knitwear" };
    assert.equal(suggestionHref(s), "/app/suppliers/aboni-knitwear");
    assert.equal(suggestionHref({ ...s, slug: "a b/c" }), "/app/suppliers/a%20b%2Fc");
  });

  it("a product runs as free text; a place and a certificate set their own filter", () => {
    assert.equal(suggestionHref({ type: "product", label: "Knitted shirts", value: "Knitted shirts" }), "/app/discover?q=Knitted+shirts");
    assert.equal(
      suggestionHref({ type: "location", label: "Dhaka", value: "Dhaka", param: ["district", "Dhaka"] }),
      "/app/discover?district=Dhaka",
    );
    assert.equal(suggestionHref({ type: "cert", label: "GOTS", value: "GOTS", param: ["cert", "gots"] }), "/app/discover?cert=gots");
  });

  it("the hint says what kind of thing a row is", () => {
    assert.equal(suggestionHint({ type: "company", label: "x", sublabel: "Gazipur", slug: "x" }), "Gazipur");
    assert.equal(suggestionHint({ type: "company", label: "x", sublabel: null, slug: "x" }), "Supplier");
    assert.equal(suggestionHint({ type: "location", label: "Savar", value: "Savar", param: ["city", "Savar"] }), "City");
    assert.equal(suggestionHint({ type: "location", label: "Dhaka", value: "Dhaka", param: ["district", "Dhaka"] }), "District");
    assert.equal(suggestionHint({ type: "cert", label: "WRAP", value: "WRAP" }), "Certificate");
  });

  it("arrow keys wrap at both ends and enter the list from either end", () => {
    assert.equal(stepIndex(-1, 1, 3), 0);
    assert.equal(stepIndex(-1, -1, 3), 2);
    assert.equal(stepIndex(2, 1, 3), 0);
    assert.equal(stepIndex(0, -1, 3), 2);
    assert.equal(stepIndex(1, 1, 3), 2);
    assert.equal(stepIndex(-1, 1, 0), -1);
  });
});

describe("typeahead: the topbar field as the browser receives it", () => {
  it("is still the GET form's q field, named for ⌘K, and now a combobox over a listbox", () => {
    const html = renderToStaticMarkup(
      createElement(Topbar, { model: { caption: "", initial: "R", searchAction: "/app/discover", searchQuery: "polo" } }),
    );
    assert.match(html, /<input[^>]*name="q"/);
    assert.match(html, /<input[^>]*data-search="topbar"/);
    assert.match(html, /<input[^>]*role="combobox"/);
    assert.match(html, /<input[^>]*value="polo"/);
    assert.match(html, /<ul[^>]*role="listbox"[^>]*hidden/);
    assert.doesNotMatch(html, /outline-none/, "the field must keep the global focus ring");
  });

  it("shows the results page's own query, and elsewhere what the caller started it with", () => {
    // Off the results page the URL has no query the field should mirror: the
    // app starts it empty (the layout passes none) and the gallery keeps its
    // own — the first version synced to the URL there too and blanked the
    // gallery's field a frame after hydration.
    assert.equal(fieldValue("/app/discover", "polo", "knit"), "polo");
    assert.equal(fieldValue("/app/discover", null, "knit"), "", "a results page with no query shows a stale one");
    assert.equal(fieldValue("/dev/ds", null, "knit"), "knit", "the gallery's field is wiped");
    assert.equal(fieldValue("/app/rfqs", "polo", ""), "", "a query leaks off the results page");
    assert.equal(fieldValue(null, "polo", ""), "", "no router, no results page");
  });

  it("renders no listbox where there is no search form", () => {
    const html = renderToStaticMarkup(createElement(Topbar, { model: { caption: "", initial: null } }));
    assert.doesNotMatch(html, /role="listbox"/);
  });
});

describe("empty states: the illustrations", () => {
  it("every named illustration is a file the app can serve, with its provenance", () => {
    for (const art of EMPTY_ART) {
      const file = path.join(repoRoot, "public", "illustrations", `${art}.svg`);
      assert.ok(existsSync(file), `${art}.svg is missing`);
      const svg = readFileSync(file, "utf8");
      assert.doesNotMatch(svg, /<metadata/, `${art}.svg still carries generator metadata`);
      assert.doesNotMatch(svg, /<text/, `${art}.svg carries text, which cannot be translated`);
      // Only token colours: ink, brand, surface and quiet.line — read from
      // the token file, so the illustrations follow it if a value changes.
      const allowed = ["ink", "brand", "surface", "quiet.line"].map((ref) => resolve(light, ref).toUpperCase());
      for (const fill of svg.matchAll(/fill="([^"]+)"/g)) {
        assert.ok(allowed.includes(fill[1]!.toUpperCase()), `${art}.svg paints ${fill[1]}, which is not a token colour`);
      }
    }
    const provenance = readFileSync(path.join(repoRoot, "public", "illustrations", "PROVENANCE.md"), "utf8");
    for (const art of EMPTY_ART) assert.match(provenance, new RegExp(`${art}\\.svg`), `${art}.svg has no provenance line`);
  });

  it("a page-level empty state shows its illustration as a decorative image and rises in", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { art: "rfq", title: "Your first RFQ lands here." }, "Suppliers answer inside the platform."));
    assert.match(html, /<img[^>]*src="\/illustrations\/rfq\.svg"[^>]*alt=""/);
    assert.match(html, /animate-rise/);
    assert.match(html, /motion-reduce:animate-none/);
  });

  it("a section's empty state keeps the compact icon note", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { icon: "clock", title: "No quotes yet" }));
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<svg/);
  });
});

describe("the record tray's entrance", () => {
  it("the pane slides in and holds still under reduced motion; the full page does not animate", () => {
    type SheetProps = Parameters<typeof Sheet>[0];
    const pane = renderToStaticMarkup(createElement(Sheet, { label: "Supplier record" } as SheetProps, "x"));
    assert.match(pane, /data-record-pane=""[^>]*animate-sheet-in/);
    assert.match(pane, /motion-reduce:animate-none/);
    const page = renderToStaticMarkup(createElement(Sheet, { label: "Supplier record", mode: "page" } as SheetProps, "x"));
    assert.doesNotMatch(page, /animate-sheet-in/);
  });

  it("every entrance in the motion grammar lands visible (fills both ways) and is an entrance, not a loop", () => {
    const config = readFileSync(path.join(repoRoot, "tailwind.config.ts"), "utf8");
    const block = /animation: \{([\s\S]*?)\n {6}\},/.exec(config);
    assert.ok(block, "no animation block in tailwind.config.ts");
    const lines = block![1]!.split("\n").filter((l) => l.includes(":"));
    assert.ok(lines.length >= 4, "the four entrances are missing");
    for (const line of lines) {
      assert.match(line, /both/, `an entrance without \`both\` fill starts invisible when the animation cannot run: ${line.trim()}`);
      assert.doesNotMatch(line, /infinite/, `an entrance must not loop: ${line.trim()}`);
    }
  });
});

describe("the phone strip shows where the buyer is", () => {
  const item = (calls: object[]) => ({ scrollIntoView: (o: object) => calls.push(o) });

  it("scrolls the current item into view only when the strip overflows", () => {
    const calls: object[] = [];
    const nav = (overflow: boolean) => ({
      scrollWidth: overflow ? 900 : 200,
      clientWidth: 375,
      querySelector: (s: string) => (s === "[aria-current]" ? item(calls) : null),
    });
    assert.equal(revealCurrentNavItem(nav(true)), true);
    assert.deepEqual(calls, [{ inline: "center", block: "nearest" }]);
    assert.equal(revealCurrentNavItem(nav(false)), false, "the desktop rail has nothing to scroll");
    assert.equal(calls.length, 1);
  });

  it("does nothing on a page no nav item points at", () => {
    assert.equal(revealCurrentNavItem({ scrollWidth: 900, clientWidth: 375, querySelector: () => null }), false);
    assert.equal(revealCurrentNavItem(null), false);
  });

  it("the strip follows every navigation: the reveal is keyed on the current item, and the rail passes it", () => {
    // The rail is the layout's and lives across client navigations, so an
    // effect that ran on mount alone revealed the first page's item and never
    // moved again. `renderToStaticMarkup` runs no effects; the source is the guard.
    const navCurrent = readFileSync(path.join(repoRoot, "components", "dashboard", "nav-current.tsx"), "utf8");
    assert.match(navCurrent, /\}, \[currentKey\]\);/, "the reveal effect is not keyed on the current item");
    const rail = readFileSync(path.join(repoRoot, "components", "dashboard", "sidebar-nav.tsx"), "utf8");
    assert.match(rail, /<NavCurrent currentKey=\{current\.key\} \/>/, "the rail does not hand the strip the current item");
  });
});

describe("the browser's own surfaces carry the palette", () => {
  const css = readFileSync(path.join(repoRoot, "app", "ds.css"), "utf8");

  it("selection, caret, native controls and the scrollbar use token colours", () => {
    assert.match(css, /::selection\s*\{[^}]*var\(--ds-brand-tint-strong\)/);
    assert.match(css, /accent-color:\s*rgb\(var\(--ds-brand\)\)/);
    assert.match(css, /caret-color:\s*rgb\(var\(--ds-brand\)\)/);
    assert.match(css, /scrollbar-color:\s*rgb\(var\(--ds-line-strong\)/);
  });

  it("the reduced-motion rule still zeroes every animation and transition", () => {
    const rule = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
    assert.ok(rule, "the reduced-motion rule is gone");
    assert.match(rule![1]!, /animation-duration: 0\.01ms !important/);
    assert.match(rule![1]!, /transition-duration: 0\.01ms !important/);
    assert.match(rule![1]!, /scroll-behavior: auto !important/, "smooth scrolling must switch off with motion");
  });
});

// ---------------------------------------------------------------------------
// The enterprise pass (27 Sep 2026): the quiet button tiers, the menu, the
// tonal panels, the one set of formatters, and the kit index the gallery
// imports through.
// ---------------------------------------------------------------------------

describe("the button tiers", () => {
  const VARIANTS = ["primary", "default", "ghost", "danger"] as const;
  const cls = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

  it("every tier draws its disabled state, for the native attribute and for aria-disabled", () => {
    for (const variant of VARIANTS) {
      const html = renderToStaticMarkup(createElement(Button, { variant, disabled: true }, "Send"));
      const c = cls(html);
      assert.ok(c.includes("disabled:text-ink-disabled"), `${variant}: a disabled button looks live`);
      assert.ok(c.includes("aria-disabled:text-ink-disabled"), `${variant}: an aria-disabled control looks live`);
      assert.ok(c.includes("disabled:cursor-not-allowed"), `${variant}: a disabled button keeps the pointer`);
      assert.ok(c.includes("disabled:active:scale-100"), `${variant}: a disabled button still presses in`);
      // A disabled tier must not keep its hover: the hover would say "live".
      assert.ok(c.some((x) => x.startsWith("disabled:hover:")), `${variant}: hover still lights a disabled button`);
      assert.match(html, /<button[^>]*\sdisabled=""/);
    }
  });

  it("three sizes, 28 / 32 / 36, and `lg` is the 36 stop", () => {
    const h = (props: Record<string, unknown>) => cls(renderToStaticMarkup(createElement(Button, props, "Go")));
    assert.ok(h({ size: "sm" }).includes("h-7"));
    assert.ok(h({}).includes("h-control"), "md is the default");
    assert.ok(h({ size: "lg" }).includes("h-9"));
    assert.ok(h({ lg: true }).includes("h-9"), "the lg alias is the lg size");
    assert.ok(h({ size: "sm", icon: true }).includes("w-7"), "a square icon button at sm");
  });

  it("loading swaps in a spinner, disables the control and says it is busy", () => {
    const html = renderToStaticMarkup(createElement(Button, { variant: "primary", loading: true }, "Send RFQ"));
    assert.match(html, /<button[^>]*\sdisabled=""/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /animate-spin motion-reduce:animate-none/);
    assert.match(html, /Send RFQ/, "the label stays, so the bar does not jump");
    // A loading link is not a link: it renders the disabled button.
    assert.doesNotMatch(renderToStaticMarkup(createElement(Button, { href: "/app/rfqs", loading: true }, "Open")), /<a\b/);
  });

  it("a link drawn as a button shares the button's class list exactly", () => {
    for (const variant of VARIANTS) {
      const link = renderToStaticMarkup(createElement(Button, { variant, size: "sm", href: "/app/rfqs" }, "Open"));
      assert.equal(/class="([^"]*)"/.exec(link)?.[1], buttonClass({ variant, size: "sm" }), variant);
    }
  });
});

describe("the menu", () => {
  it("is a native disclosure whose items mark the active one, and opens upward when asked", () => {
    const html = renderToStaticMarkup(
      createElement(
        Menu,
        { label: "Rows per page", summary: "25 per page", up: true, align: "left" } as Parameters<typeof Menu>[0],
        createElement(MenuItem, { href: "?per=25", active: true } as Parameters<typeof MenuItem>[0], "25 per page"),
        createElement(MenuItem, { href: "?per=50" } as Parameters<typeof MenuItem>[0], "50 per page"),
      ),
    );
    assert.match(html, /^<details\b/);
    assert.match(html, /<summary aria-label="Rows per page"/);
    assert.match(html, /<div role="menu" class="[^"]*\bbottom-full\b/);
    const items = [...html.matchAll(/<a role="menuitem" href="([^"]+)"([^>]*)>/g)].map((m) => [m[1], /aria-current="true"/.test(m[2]!)]);
    assert.deepEqual(items, [
      ["?per=25", true],
      ["?per=50", false],
    ]);
    // The check shows on the active item only; the others keep its space.
    assert.equal((html.match(/class="[^"]*\binvisible\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /overflow-hidden/, "a menu inside overflow-hidden is clipped");
  });
});

describe("the page's panels are drawn by tone", () => {
  it("a section's panel has no hairline; outlined adds the soft edge; bare draws no panel", () => {
    const panel = (props: Record<string, unknown>) =>
      /<section[^>]*>[\s\S]*?(<div class="[^"]*rounded-md[^"]*">)/.exec(
        renderToStaticMarkup(createElement(PageSection, { title: "Sources", ...props } as Parameters<typeof PageSection>[0], "x")),
      )?.[1] ?? "";
    assert.match(panel({}), /bg-surface/);
    assert.doesNotMatch(panel({}), /border-line|\bborder\b/, "a section panel carries a hairline again");
    assert.match(panel({ outlined: true }), /shadow-edge/);
    assert.doesNotMatch(panel({ outlined: true }), /border-line/);
    assert.equal(panel({ bare: true }), "", "bare draws its children on the canvas");
  });

  it("a numeric column is right-aligned and tabular; a row's class list tells current, selected and sanctioned apart", () => {
    const cell = renderToStaticMarkup(
      createElement("table", null, createElement("tbody", null, createElement("tr", null, createElement(Cell, { align: "right" }, "3,166")))),
    );
    assert.match(cell, /class="[^"]*text-right[^"]*tabular-nums/);
    assert.match(rowClass({ current: true }), /\bbg-brand-tint\b/);
    assert.match(rowClass({ selected: true }), /shadow-\[inset_2px_0_0_rgb\(var\(--ds-brand\)\)\]/);
    assert.match(rowClass({ sanctioned: true }), /shadow-\[inset_3px_0_0_rgb\(var\(--ds-sanction\)\)\]/);
    assert.doesNotMatch(rowClass(), /brand|sanction/);
  });
});

describe("one way to write a time, an amount and a quantity", () => {
  it("formatMoney: two decimals, up to four under a cent, the ISO code after the figure", () => {
    assert.equal(formatMoney(6.4, "USD"), "6.40 USD");
    assert.equal(formatMoney(26550, "USD"), "26,550.00 USD");
    assert.equal(formatMoney(0.0045, "EUR"), "0.0045 EUR");
    assert.equal(formatMoney(0, "GBP"), "0.00 GBP");
    assert.equal(formatMoney(null, "USD"), null);
    assert.equal(formatMoney(Number.NaN, "USD"), null);
  });

  it("formatQuantity: never rounded, the unit after it", () => {
    assert.equal(formatQuantity(12000, "pcs"), "12,000 pcs");
    assert.equal(formatQuantity(1250.5, "kg"), "1,250.5 kg");
    assert.equal(formatQuantity(undefined, "pcs"), null);
  });

  it("formatTime: the day and the UTC clock, so the server and the browser agree", () => {
    assert.equal(formatTime("2026-09-12T14:30:00Z"), "12 Sep 2026, 14:30");
    assert.equal(formatTime("2026-09-12T04:05:00+06:00"), "11 Sep 2026, 22:05");
    assert.equal(formatTime("not a date"), null);
    assert.equal(formatTime(null), null);
  });

  it("formatRelative: minutes, hours, days, then the day itself", () => {
    const now = new Date("2026-09-27T12:00:00Z");
    assert.equal(formatRelative("2026-09-27T11:59:30Z", now), "just now");
    assert.equal(formatRelative("2026-09-27T11:56:00Z", now), "4m ago");
    assert.equal(formatRelative("2026-09-26T13:00:00Z", now), "23h ago");
    assert.equal(formatRelative("2026-09-24T12:00:00Z", now), "3d ago");
    assert.equal(formatRelative("2026-08-01T12:00:00Z", now), "1 Aug 2026");
    assert.equal(formatRelative("nope", now), null);
  });
});

describe("the kit index", () => {
  it("exports every value the gallery imports from it", () => {
    const src = readFileSync(path.join(repoRoot, "app", "dev", "ds", "dashboard-screens.tsx"), "utf8");
    const block = /import\s*\{([^}]*)\}\s*from\s*"@\/components\/dashboard";/.exec(src)?.[1];
    assert.ok(block, "the gallery no longer imports from the kit index; this guard needs rewriting");
    const values = block!
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("type "));
    assert.ok(values.length >= 10, `guard: the gallery's value imports (${values.join(", ")})`);
    for (const name of values) assert.ok(name in kit, `components/dashboard/index.ts does not export ${name}`);
    // And nothing the index names is missing from the module it re-exports.
    for (const [name, value] of Object.entries(kit)) assert.notEqual(value, undefined, `the index re-exports ${name} from a module that has none`);
  });
});
