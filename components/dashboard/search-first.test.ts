// The founder's walkthrough of the buyer app, 28 Sep 2026: fourteen things a
// buyer saw, each pinned here at the boundary the buyer's browser meets — the
// rendered HTML or the shipped stylesheet — so none can come back quietly.
//
//  1. The app opens on a search landing, not a desk; Search in the rail goes there.
//  2. The landing lists no supplier: a field, filters, templates, saved searches.
//  3. Suggestions lead with the words typed and categories; companies by name only.
//  4. One focus ring on the search field, and the shortcut in the buyer's keys.
//  5. Row actions always drawn, in a column of their own.
//  6. Certificates as one-line pills.
//  7. Loading skeletons that draw (their styles were left in the old stylesheet).
//  8. The record streams beside the results; the search is read from a cache.
//  9. The record: grouped facts at full width, registers as a list, a dashed
//     mark for "source pending", a slim contact strip.
// 10. The same two worker figures in the search and on Saved.
// 11. Sticky headers meet the top of their scroll region.
// 12. A company suggestion opens beside the results.
// 13. Beside a pane the results header stays on one line.
// 14. A place that is both city and district is said once.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildSheet, buildTableRow } from "@/lib/dashboard/build-models";
import { discoverWorkers, workersSecondShort } from "@/lib/dashboard/build-discover-row";
import { aboniInput, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import { NAV, navMatch } from "@/lib/dashboard/nav";
import { SEARCH_TEMPLATES, filterMenus, templateHref } from "@/lib/dashboard/search-templates";
import { EMPTY_STATE, parseDiscoverState } from "@/lib/discover-v32-state";
import { Topbar } from "./app-shell";
import { PanelHeader } from "./results-panel";
import { CertPill, RESULTS_COLUMNS, ResultsTable } from "./results-table";
import { SavedDesk, deskFrom } from "./saved-desk";
import { SavedList } from "./saved-list";
import { SearchLanding } from "./search-landing";
import { highlightParts, suggestionHref, suggestionRows, type Suggestion } from "./search-typeahead";
import { FactsPanel, PENDING_LEGEND, ResultsColumn, SheetTabs, collapseRepeatedLines } from "./sheet";
import { SupplierSheet, groupFacts } from "./supplier-sheet";
import { isApplePlatform, pageDrawsOwnField } from "./topbar-search-slot";
import { WorkersCell } from "./workers-cell";

const repoRoot = process.cwd();
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("1–2. the search landing is the first viewport", () => {
  it("the rail's Search opens /app, and a search's results sit under Search", () => {
    assert.equal(NAV.find((n) => n.key === "search")?.href, "/app");
    assert.deepEqual(navMatch("/app"), { key: "search", exact: true });
    assert.deepEqual(navMatch("/app/discover"), { key: "search", exact: false });
    assert.equal(NAV.find((n) => n.key === "suppliers")?.href, "/app/discover", "Suppliers is the whole ledger");
  });

  it("the landing's /app is the root, never a section every page sits under", () => {
    // Matched as a prefix, `/app` claimed every page and the rail marked
    // Search current on Saved, RFQs and every record.
    assert.deepEqual(navMatch("/app/saved"), { key: "saved", exact: true });
    assert.deepEqual(navMatch("/app/rfqs/abc"), { key: "rfqs", exact: false });
    assert.deepEqual(navMatch("/app/suppliers/aboni"), { key: "suppliers", exact: false });
    assert.deepEqual(navMatch("/app/nowhere"), { key: null, exact: false });
  });

  it("draws one large field, the filters, the templates — and no supplier", () => {
    const html = render(
      createElement(SearchLanding, {
        published: 10266,
        counts: Promise.resolve({}),
        saved: Promise.resolve([]),
        filtersHref: "/app?filters=1",
      }),
    );
    assert.equal(html.match(/<h1\b/g)?.length, 1);
    assert.match(html, /<form[^>]*role="search"[^>]*action="\/app\/discover"|<form[^>]*action="\/app\/discover"[^>]*role="search"/);
    assert.match(html, /data-search="topbar"/, "the landing's field is the one the shortcut focuses");
    const landing = readFileSync(path.join(repoRoot, "components/dashboard/search-landing.tsx"), "utf8");
    assert.match(landing, /<SearchShortcut \/>/, "the landing advertises Ctrl K; the topbar's listener is not mounted there");
    assert.match(html, /10,266 published suppliers/);
    assert.match(html, /href="\/app\?filters=1"[^>]*>.*All filters/);
    assert.match(html, /href="\/app\/discover"[^>]*>Browse all 10,266 suppliers/);
    for (const t of SEARCH_TEMPLATES) assert.ok(html.includes(templateHref(t).replace(/&/g, "&amp;")), `template ${t.key} links to its search`);
    // The filter menus (founder's video, 29 Sep 2026), not rows of pills.
    for (const m of filterMenus(EMPTY_STATE)) assert.match(html, new RegExp(`<summary aria-label="${m.label}"`), m.label);
    assert.doesNotMatch(html, /data-row="result"|<table/, "a supplier listed before the buyer searched");
  });

  it("every template is a search the results page reads back exactly", () => {
    for (const t of SEARCH_TEMPLATES) {
      const href = templateHref(t);
      const back = parseDiscoverState(new URLSearchParams(href.split("?")[1] ?? ""));
      assert.deepEqual(back, t.state, `${t.key} does not survive its own URL`);
    }
  });

  it("the topbar's field steps aside on the landing only", () => {
    assert.equal(pageDrawsOwnField("/app"), true);
    assert.equal(pageDrawsOwnField("/app/"), true);
    assert.equal(pageDrawsOwnField("/app/discover"), false);
    assert.equal(pageDrawsOwnField("/app/saved"), false);
  });
});

describe("3, 12. the suggestions", () => {
  it("the words typed come first, so Enter's meaning is always on screen", () => {
    const fetched: Suggestion[] = [
      { type: "heading", label: "Men's woven shirts", hs: "6205" },
      { type: "company", label: "Basic Shirts Ltd.", sublabel: "Gazipur", slug: "basic-shirts" },
    ];
    const rows = suggestionRows("shirt", fetched, []);
    assert.deepEqual(rows.map((r) => r.type), ["query", "heading", "company"]);
    assert.deepEqual(suggestionRows("", fetched, [{ type: "recent", label: "Knit polos", href: "/app/discover?q=polo", count: 12 }]).map((r) => r.type), ["recent"]);
  });

  it("a category runs the heading's search", () => {
    assert.equal(suggestionHref({ type: "heading", label: "Men's woven shirts", hs: "6205" }), "/app/discover?hs=6205");
  });

  it("a company opens BESIDE the results — the buyer's search kept, other panes closed", () => {
    const co: Suggestion = { type: "company", label: "Basic Shirts Ltd.", sublabel: null, slug: "basic-shirts" };
    assert.equal(
      suggestionHref(co, { pathname: "/app/discover", search: "q=knit&cert=gots&rfq=abc&line=6105" }),
      "/app/discover?q=knit&cert=gots&record=basic-shirts",
    );
    assert.equal(suggestionHref(co, { pathname: "/app/saved", search: "" }), "/app/discover?q=Basic+Shirts+Ltd.&record=basic-shirts");
    assert.ok(!suggestionHref(co).startsWith("/app/suppliers/"), "a company suggestion threw the search away for a page of its own");
  });

  it("the typed words are set apart where they start a word of the label", () => {
    assert.deepEqual(highlightParts("Men's woven shirts", "shi"), [
      { text: "Men's woven ", hit: false },
      { text: "shi", hit: true },
      { text: "rts", hit: false },
    ]);
    assert.deepEqual(highlightParts("T-shirts", "shirt"), [
      { text: "T-", hit: false },
      { text: "shirt", hit: true },
      { text: "s", hit: false },
    ]);
  });

  it("the suggestion list paints above the page: the frosted topbar carries a z-index", () => {
    const html = render(createElement(Topbar, { model: { caption: "", initial: "R", searchAction: "/app/discover" } }));
    const bar = /<div class="glass([^"]*)"/.exec(html)?.[1] ?? "";
    assert.match(bar, /\brelative\b/);
    assert.match(bar, /\bz-raised\b/, "backdrop-filter makes the topbar a stacking context; without a z-index its list slid under the results");
    // …and no higher than the onboarding tour's z-50 scrim, which must cover it.
    const tour = readFileSync(path.join(repoRoot, "components/onboarding/tour.tsx"), "utf8");
    assert.match(tour, /fixed inset-0 z-50\b/, "guard: the tour's scrim moved; recheck the topbar's z-index against it");
    assert.doesNotMatch(bar, /\bz-(sticky|overlay|modal|toast|\[)/);
  });
});

describe("4. the search field", () => {
  const html = render(createElement(Topbar, { model: { caption: "", initial: "R", searchAction: "/app/discover" } }));

  it("one focus indicator: the field's own, and none inside it", () => {
    const input = /<input[^>]*data-search="topbar"[^>]*>/.exec(html)?.[0] ?? "";
    assert.match(input, /focus-visible:outline-none/, "the input drew the global ring inside the field");
    // A filled field (founder's pick, 29 Sep 2026): no border and no ring; typing turns it white with a 2px ink line under it.
    assert.match(html, /<form[^>]*bg-surface-sunken[^>]*focus-within:bg-surface focus-within:shadow-\[inset_0_0_0_1px_rgb\(var\(--ds-line\)\),inset_0_-2px_0_rgb\(var\(--ds-ink-strong\)\)\]/);
    assert.doesNotMatch(/<form[^>]*>/.exec(html)?.[0] ?? "", /\bborder-brand\b|\bring-/);
  });

  it("the shortcut is said in the buyer's keys, Ctrl until the browser says it is a Mac", () => {
    assert.doesNotMatch(html, /⌘K/);
    assert.match(html, /<kbd[^>]*aria-label="Control K"[^>]*>Ctrl<span>K<\/span><\/kbd>/);
    assert.equal(isApplePlatform("MacIntel", ""), true);
    assert.equal(isApplePlatform("Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
    assert.equal(isApplePlatform("", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  });
});

describe("5–6. the ledger rows", () => {
  const row = { ...buildTableRow(aboniInput()), supplierId: "8ce50581-2d84-4cc2-93de-506394eade5d", rfqHref: "/app/discover?rfq=x", recordHref: "/app/discover?record=aboni-knitwear" };

  it("Save, Open and RFQ are always drawn, in a column of their own, never hover-gated", () => {
    const html = render(createElement(ResultsTable, { rows: [row] }));
    assert.doesNotMatch(html, /group-hover:inline-flex|group-focus-within:inline-flex/);
    const cells = [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!);
    const last = cells.at(-1)!;
    assert.match(last, /data-save=/);
    assert.match(last, /data-action="open"/);
    assert.match(last, /data-action="rfq"/);
    const name = /<th scope="row"[\s\S]*?<\/th>/.exec(html)![0];
    assert.doesNotMatch(name, /data-action=|data-save=/, "the actions squeezed the name onto three lines");
  });

  it("a certificate is one pill on one line; its state is in its name", () => {
    const html = render(createElement(CertPill, { cert: { kind: "WRAP", scheme: "WRAP Gold", state: "valid", daysLeft: 200, expiresOn: "2027-01-08", number: null, issuer: "", scope: null, documentUrl: null, markCode: "WRAP" } as never }));
    assert.match(html, /whitespace-nowrap/);
    assert.match(html, /aria-label="WRAP Gold, [^"]+"/);
    assert.doesNotMatch(text(html), /valid/, "the pill repeats in words what its icon says");
    const expiring = render(createElement(CertPill, { cert: { kind: "GOTS", scheme: "GOTS", state: "expiring", daysLeft: 17, expiresOn: "2026-10-15", number: null, issuer: "", scope: null, documentUrl: null, markCode: "GOTS" } as never }));
    assert.match(text(expiring), /GOTS 17 d/);
  });
});

describe("7. loading skeletons draw", () => {
  const css = readFileSync(path.join(repoRoot, "app/ds.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("the bar primitive has a size, a ground and a sweep in the kit's own stylesheet", () => {
    const rule = /\.skel\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    assert.match(rule, /display:\s*block/, "an inline span with a width draws nothing");
    assert.match(rule, /background-color:\s*rgb\(var\(--ds-skeleton\)\)/);
    assert.match(css, /\.skel::after\s*\{[^}]*animation:\s*ds-skel-sweep/);
    assert.match(css, /\.skel\.tone-card\s*\{/);
    assert.match(css, /@keyframes ds-skel-sweep/);
  });

  it("the results and Saved skeletons draw the page's own frame", () => {
    const discover = readFileSync(path.join(repoRoot, "app/(app)/app/discover/loading.tsx"), "utf8");
    assert.match(discover, /<ResultsColumn>/);
    assert.match(discover, /<Panel\b/);
    // The skeleton's grid is the ledger's own columns, in order.
    const grid = /grid-cols-\[([^\]]+)\]/.exec(discover)?.[1] ?? "";
    assert.equal(
      grid,
      RESULTS_COLUMNS.wide.map((w) => (w === null ? "minmax(0,1fr)" : `${w}px`)).join("_"),
      "the loading skeleton's columns drifted from the ledger's",
    );
    assert.match(readFileSync(path.join(repoRoot, "app/(app)/app/saved/loading.tsx"), "utf8"), /<ResultsColumn>/);
    assert.match(readFileSync(path.join(repoRoot, "app/(app)/app/(search)/loading.tsx"), "utf8"), /max-w-\[920px\]/);
  });
});

describe("8. opening a record does not wait on the search", () => {
  const page = readFileSync(path.join(repoRoot, "app/(app)/app/discover/page.tsx"), "utf8");

  it("the results are read through the shared cache", () => {
    assert.match(page, /readSearch\(state, \(\) => fetchDiscoverV32\(supabase, state\)\)/);
  });

  it("the record is read inside its own Suspense boundary, keyed per record, with the record's silhouette", () => {
    assert.match(page, /<Suspense\s+key=\{`\$\{recordSlug\}:/);
    // A line's own silhouette while a line is read, the record's otherwise
    // (founder's video, 29 Sep 2026: a line flashed the whole record's).
    assert.match(page, /fallback=\{\s*<RecordPane[^>]*>\s*\{lineCode \? <LineSkeleton \/> : <RecordSkeleton \/>\}/);
    assert.doesNotMatch(page.slice(0, page.indexOf("async function DiscoverRecord")), /loadRecordSheet\(/, "the page body awaits the record again");
    // The RFQ form too (founder's video, 29 Sep 2026: "Send RFQ … has to be
    // lightning fast"): its suppliers and the workspace are read inside a
    // boundary of its own, so the whole page no longer waits on them.
    assert.match(page, /<Suspense\s+key=\{`rfq:\$\{rfqIds\.join\(","\)\}`\}\s+fallback=\{\s*<RecordPane[^>]*>\s*<ComposerSkeleton \/>/);
    assert.doesNotMatch(page.slice(0, page.indexOf("async function DiscoverComposer")), /settings_get|TARGET_COLUMNS\)/, "the page body awaits the composer's reads");
    const saved = readFileSync(path.join(repoRoot, "app/(app)/app/saved/page.tsx"), "utf8");
    assert.match(saved, /<Suspense\s+key=\{openSlug\}\s+fallback=\{\s*<RecordPane[^>]*>\s*<RecordSkeleton \/>/);
  });
});

describe("9. the record", () => {
  const html = render(createElement(SupplierSheet, { model: buildSheet(aboniInput(), { contactCounts: { emails: 1, phones: 6, representatives: 0, website: true } }) }));

  it("the facts take the pane's width; no viewport breakpoint puts the contact card beside them", () => {
    assert.doesNotMatch(html, /grid-cols-\[1fr_300px\]/);
    const overview = html.slice(html.indexOf('id="overview"'), html.indexOf('id="products"'));
    assert.ok(overview.indexOf("Registered name") < overview.indexOf('data-locked="true"'), "the contact strip comes after the facts");
  });

  it("the facts are grouped under their own headings", () => {
    const groups = groupFacts(buildSheet(aboniInput()).facts).map((g) => g.title);
    assert.deepEqual(groups, ["Company", "Location", "Workforce and capacity", "Registrations"]);
    for (const g of groups) assert.match(html, new RegExp(`>${g}<`));
  });

  it("the registers are a list, each with its register's square", () => {
    const regs = html.slice(html.indexOf(">Registers<"), html.indexOf("</ul>", html.indexOf(">Registers<")));
    const items = [...regs.matchAll(/<li\b/g)];
    assert.equal(items.length, 4);
    assert.match(regs, /BGMEA General/);
  });

  it("source pending is SourceBD's own mark in the mark column, explained once", () => {
    // A document with a clock, not a dashed square that read as a tick box
    // (founder's video, 29 Sep 2026); named, with the full words on hover.
    assert.match(html, /<span title="Source pending: [^"]+"[^>]*><svg[^>]*role="img"[^>]*aria-label="Source pending"/);
    assert.doesNotMatch(html, /border-dashed border-quiet-line"[^>]*><span class="sr-only">source pending/);
    const legend = html.lastIndexOf(`${PENDING_LEGEND}</span>`);
    assert.ok(legend > 0, "the one legend under the facts");
    const factsOnly = html.slice(html.indexOf('id="overview"'), legend);
    assert.doesNotMatch(text(factsOnly), /source pending/i, "the words came back as a caption on every row");
  });

  it("an address line filed twice in a row reads once", () => {
    assert.equal(collapseRepeatedLines("Holding 79, Kaliakoir\nGazipur\nGazipur"), "Holding 79, Kaliakoir\nGazipur");
    assert.equal(collapseRepeatedLines("Dhaka\nSavar\nDhaka"), "Dhaka\nSavar\nDhaka", "only a repeat in a row is dropped");
  });

  it("the tabs stick flush: their space above is padding, not a margin the marks show through", () => {
    const tabs = render(createElement(SheetTabs, { tabs: [{ label: "Overview", count: null, href: "#overview", active: true }] }));
    const cls = /<nav[^>]*class="([^"]*)"/.exec(tabs)![1]!;
    assert.match(cls, /\bsticky\b/);
    assert.match(cls, /\bpt-2\b/);
    assert.doesNotMatch(cls, /\bmt-\d/);
  });

  it("a sanctioned record's strip does not offer an RFQ", () => {
    const s = render(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput(), {}) }));
    assert.match(s, /data-locked="true"/);
  });
});

describe("10. the same worker figures in the search and on Saved", () => {
  it("the profile's figure is on screen under the record's own wherever they differ", () => {
    const w = discoverWorkers({ employees_total: 793, workers_own: 770, workers_basis: "own", workers_source: "RSC" });
    assert.equal(w.own, 770);
    assert.equal(workersSecondShort(w), "793 RSC");
    const cell = render(createElement(WorkersCell, { own: 770, second: "793 RSC" }));
    assert.match(text(cell), /770 793 RSC/);
    const same = discoverWorkers({ employees_total: 770, workers_own: 770, workers_basis: "own", workers_source: "registry" });
    assert.equal(workersSecondShort(same), null);
  });

  it("Saved prints the record's own figure first and the profile's under it, as the search does", () => {
    const html = render(
      createElement(SavedList, {
        rows: [
          {
            id: "1",
            slug: "logos",
            company_name: "LOGOS APPARELS LIMITED",
            entity_type: "factory",
            city: "Gazipur",
            district: "Gazipur",
            source_tags: ["BGMEA"],
            employees_total: 5195,
            workers_own: 2030,
            workers_basis: "group",
            workers_source: "RSC",
            saved_at: "2026-09-27T10:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 24,
        sort: "recent",
        failed: false,
      }),
    );
    assert.match(text(html), /2,030 5,195 with buildings/);
  });
});

describe("11. sticky headers meet the top of their scroll region", () => {
  it("the results column's gutter is inside it, not on the scroll region", () => {
    const html = render(createElement(ResultsColumn, null, createElement("p", null, "x")));
    const outer = /^<div class="([^"]*)"/.exec(html)![1]!;
    assert.match(outer, /overflow-y-auto/);
    assert.doesNotMatch(outer, /(^|\s)(p|pt|py)-\d/, "padding on the scroll region stops a sticky header short of the top");
  });
});

describe("13. beside a pane the results header is one line", () => {
  it("compact keeps sort and save as icon buttons and drops the rest", () => {
    const html = render(
      createElement(PanelHeader, {
        compact: true,
        model: {
          title: "shirt",
          total: 1403,
          shown: 25,
          sortLabel: "Most registers & certifiers",
          view: "table",
          saveHref: "/app/discover?q=shirt&save=1",
          exportHref: "/api/v1/discover/export?q=shirt",
          sortOptions: [{ value: "sources", label: "Most registers & certifiers", href: "?", active: true }],
          densityOptions: [{ value: "default", label: "Default", href: "?", active: true }],
        },
      }),
    );
    assert.match(html, /aria-label="Save search"/);
    assert.doesNotMatch(html, /Export CSV|Density|role="group"/);
  });
});

describe("the desk on Saved", () => {
  it("alerts open the record beside the list; a failed read claims no all-clear", () => {
    const doc = deskFrom({
      alerts: [{ kind: "cert_expiring", supplier_id: "s", supplier_slug: "tex-town", company_name: "TEX TOWN LTD", cert_kind: "gots", expires_on: "2026-10-15" }],
      recent_activity: [],
    });
    assert.ok(doc);
    const html = render(createElement(SavedDesk, { doc, failed: false, openHref: (slug: string) => `/app/saved?open=${slug}`, today: new Date("2026-09-28T09:00:00Z") }));
    assert.match(html, /href="\/app\/saved\?open=tex-town"[^>]*>Tex Town Ltd</);
    assert.match(html, /GOTS expires 15 Oct 2026/);
    const failed = render(createElement(SavedDesk, { doc: null, failed: true, openHref: () => "" }));
    assert.match(failed, /could not be read/);
    assert.doesNotMatch(failed, /No certificates/);
    assert.equal(deskFrom({ alerts: "x" }), null);
  });
});

describe("the facts panel on its own", () => {
  it("a list row sets one item a line and leaves the mark column to its items", () => {
    const html = render(
      createElement(FactsPanel, {
        rows: [{ label: "Registers", value: "BGMEA General 6843", items: [{ label: "BGMEA General", code: "6843", mark: null }] }],
      }),
    );
    assert.match(html, /<li\b[^>]*>.*BGMEA General.*6843/);
  });
});
