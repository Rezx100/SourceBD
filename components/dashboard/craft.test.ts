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
import { EMPTY_ART, EmptyState } from "./page";
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
