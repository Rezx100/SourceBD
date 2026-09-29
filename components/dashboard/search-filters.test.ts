// The founder's video of 29 Sep 2026, PR 4 (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`): the search.
//
//  1. Filters are one row of menus, each value toggled by a link; a set menu
//     shows its value on its button; a value the menus hold is not drawn a
//     second time as a chip.
//  2. Green is spent on the primary action only: inside the app the tints,
//     links, focus and ticked boxes are slate.
//  3. The app's text is one step up, and only the app's.
//  4. The row's open control is SourceBD's own icon with its word on hover.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { filterMenus, inFilterMenu, menuSummary } from "@/lib/dashboard/search-templates";
import { appFontSize, fontSize } from "@/lib/design/tokens";
import { EMPTY_STATE, discoverChips, discoverHref, type DiscoverState } from "@/lib/discover-v32-state";
import { FilterMenus } from "./filter-menus";

const source = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const at = (over: Partial<DiscoverState>): DiscoverState => ({ ...EMPTY_STATE, ...over });
const menu = (s: DiscoverState, key: string) => filterMenus(s).find((m) => m.key === key)!;

describe("1. the filter menus", () => {
  it("each option toggles one value and starts the results again at page 1", () => {
    const s = at({ q: "knit", hs: ["6109"], page: 3 });
    const product = menu(s, "product");
    const tee = product.options.find((o) => o.code === "6109")!;
    assert.equal(tee.on, true);
    assert.deepEqual(tee.toggled.hs, [], "choosing a set value takes it off");
    assert.equal(tee.toggled.page, 1);
    assert.equal(tee.toggled.q, "knit", "the rest of the search is kept");
    const shirts = product.options.find((o) => o.code === "6205")!;
    assert.deepEqual(shirts.toggled.hs, ["6109", "6205"]);
    const gots = menu(s, "certificate").options.find((o) => o.label === "GOTS")!;
    assert.deepEqual(gots.toggled.cert, [{ kind: "gots", state: "valid" }]);
    assert.deepEqual(menu(at({ cert: [{ kind: "gots", state: "expired" }] }), "certificate").options[0]!.toggled.cert, [], "off takes every state of that scheme");
    assert.equal(menu(s, "more").options[0]!.toggled.rsc, "active");
  });

  it("a value set elsewhere (the typeahead, the pane) joins its menu, so it can be taken off there", () => {
    const s = at({ hs: ["6104"], district: ["Mymensingh"] });
    assert.ok(menu(s, "product").options.some((o) => o.code === "6104" && o.on));
    assert.ok(menu(s, "place").options.some((o) => o.label === "Mymensingh" && o.on));
  });

  it("a set menu says its value, or how many, on its own button", () => {
    assert.equal(menuSummary(menu(EMPTY_STATE, "product")), null);
    assert.equal(menuSummary(menu(at({ district: ["Gazipur"] }), "place")), "Gazipur");
    assert.equal(menuSummary(menu(at({ district: ["Gazipur", "Dhaka"] }), "place")), "2 selected");
    const html = renderToStaticMarkup(createElement(FilterMenus, { state: at({ cert: [{ kind: "gots", state: "valid" }] }) }));
    assert.match(html, /<summary aria-label="Certificate: GOTS" class="[^"]*\bbg-accent-tint-strong\b/);
    assert.match(html, /<summary aria-label="Product" class="(?![^"]*bg-accent-tint-strong)/);
  });

  it("every option is a link to the search with it toggled, and the landing's say what they find", () => {
    const html = renderToStaticMarkup(createElement(FilterMenus, { state: EMPTY_STATE, counts: { "hs-6109": 1763, "district-Gazipur": 1819 } }));
    for (const m of filterMenus(EMPTY_STATE)) {
      for (const o of m.options) assert.ok(html.includes(`href="${discoverHref(o.toggled).replace(/&/g, "&amp;")}"`), `${m.label} · ${o.label}`);
    }
    assert.match(html, /T-shirts[\s\S]*?>1,763</);
    assert.match(html, /Gazipur[\s\S]*?>1,819</);
    assert.doesNotMatch(renderToStaticMarkup(createElement(FilterMenus, { state: EMPTY_STATE })), /1,763/, "the results show no whole-corpus count");
  });

  it("a filter a menu shows is not drawn again as a chip; one it does not show keeps its chip", () => {
    const s = at({ q: "knit", hs: ["6109"], cert: [{ kind: "gots", state: "valid" }, { kind: "wrap", state: "expiring" }], district: ["Dhaka"], type: ["factory"], rsc: "active", reg: ["BGMEA"] });
    const kept = discoverChips(s).filter((c) => !inFilterMenu(c.key, s)).map((c) => c.key);
    assert.deepEqual(kept.sort(), ["cert-wrap-expiring", "q", "reg-BGMEA", "sanctioned"].sort());
    assert.match(source("app/(app)/app/discover/page.tsx"), /chips=\{chips\.filter\(\(c\) => !inFilterMenu\(c\.key, state\)\)/);
    assert.match(source("app/(app)/app/discover/page.tsx"), /menus=\{<FilterMenus state=\{state\} \/>\}/);
  });
});

describe("2. green on the primary action only, inside the app", () => {
  it("the app shell remaps the green tints and link ink to slate, and leaves the solid green alone", () => {
    const css = source("app/ds.css");
    const block = /\[data-shell\] \{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    for (const v of ["--ds-brand-ink: var(--ds-accent-ink)", "--ds-brand-tint: var(--ds-accent-tint)", "--ds-brand-tint-strong: var(--ds-accent-tint-strong)", "--ds-focus: var(--ds-accent)"]) {
      assert.ok(block.includes(v), v);
    }
    assert.doesNotMatch(block, /--ds-brand:/, "the primary button and the logo stay green");
    assert.match(block, /accent-color: rgb\(var\(--ds-accent\)\)/);
  });
});

describe("3. the app's text, one step up", () => {
  it("the app shell sets the larger sizes; everywhere else keeps the base scale", () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(appFontSize).map(([k, [size]]) => [k, size])),
      { eyebrow: "0.75rem", xs: "0.8125rem", sm: "0.875rem", base: "0.9375rem", title: "1rem" },
      "the founder's pick: caption 13, label 14, body 15, title 16, eyebrow 12",
    );
    assert.equal(fontSize.sm![0], "0.8125rem", "the marketing site's scale is unchanged");
    const tw = source("tailwind.config.ts");
    assert.match(tw, /fontSize: scaledFontSize\(\)/);
    assert.match(tw, /addBase\(\{ "\[data-shell\]": appFontVars\(\) \}\)/);
    assert.match(source("components/dashboard/app-shell.tsx"), /data-shell=""/);
  });
});

describe("4. the row's open control says what it does", () => {
  it("SourceBD's own icon, with its word shown under the pointer and on focus", () => {
    const table = source("components/dashboard/results-table.tsx");
    assert.match(table, /<SbIcon name="open-beside" \/>/);
    assert.doesNotMatch(table, /<Icon name="pane" \/>/);
    assert.match(table, /group-hover\/open:opacity-100 group-focus-within\/open:opacity-100"\s*>\s*Open\s*</);
  });
});
