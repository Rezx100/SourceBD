// The founder's video of 29 Sep 2026, PR 6 (hand-off
// `context/feature-specs/handoff-dashboard-video-29sep.md`): the RFQ form.
// The composer took 68% of the region and crushed the results to a 28rem
// table; while composing, the results are now a slim rail of names (still
// tickable into the RFQ) and the composer takes the rest.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildTableRow } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";
import { PanelFooter, PanelHeader } from "./results-panel";
import { RESULTS_COLUMNS, ResultsTable } from "./results-table";
import { RfqComposer } from "./rfq-composer";
import { RecordPane, ResultsColumn } from "./sheet";

const source = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("the results step aside to a slim rail while an RFQ is composed", () => {
  it("the rail is the box and the name: no marks, workers or row actions", () => {
    const row = { ...buildTableRow(aboniInput()), rfqHref: "/app/discover?rfq=x" };
    const html = renderToStaticMarkup(createElement(ResultsTable, { rows: [row], compact: true, rail: true }));
    assert.deepEqual(RESULTS_COLUMNS.rail, [36, null]);
    assert.equal((html.match(/<col\b/g) ?? []).length, 2);
    assert.match(html, /role="checkbox"/, "a buyer can still tick a supplier into the RFQ");
    assert.match(html, />Aboni Knitwear Ltd</);
    assert.doesNotMatch(html, /data-action="rfq"|data-workers-cell|aria-label="Source: /);
    assert.doesNotMatch(html, /<table[^>]*min-w-\[/, "the rail must not scroll sideways");
    assert.doesNotMatch(html, /data-open="record"/, "a name in the rail opens the record over the composer and loses the draft");
  });

  it("the column is 18rem and the composer takes the rest of the region", () => {
    const col = renderToStaticMarkup(createElement(ResultsColumn, { besideRecord: true, rail: true } as ComponentProps<typeof ResultsColumn>, "x"));
    assert.match(col, /\blg:w-\[18rem\] lg:flex-none\b/);
    const pane = renderToStaticMarkup(createElement(RecordPane, { wide: true } as ComponentProps<typeof RecordPane>, "x"));
    assert.match(pane, /data-pane-wide="true" class="[^"]*\blg:flex-1\b/);
    assert.doesNotMatch(pane, /68%/);
  });

  it("the search page draws the rail, and no filter bar, while the composer is open", () => {
    const page = source("app/(app)/app/discover/page.tsx");
    assert.match(page, /<ResultsColumn besideRecord=\{paneOpen\} rail=\{composerOpen\}>/);
    assert.match(page, /\{composerOpen \? null : \(\s*<form action=\{DISCOVER_PATH\}/);
    assert.match(page, /rail=\{composerOpen\}\s*\n\s*density=/);
    assert.match(page, /state\.view === "table" \|\| composerOpen/, "a card list in an 18rem rail");
  });
});

describe("the rail's header and footer are one line each (founder's review, 29 Sep 2026)", () => {
  it("the header is the count and the search's words cut to fit, with no sort, save or density", () => {
    const model = {
      title: "pants · Sanctioned hidden",
      total: 1120,
      shown: 25,
      firstRow: 51,
      sortLabel: "Most registers & certifiers",
      view: "table" as const,
      saveHref: "/app/discover?q=pants&save=1",
      sortOptions: [{ value: "sources", label: "Most registers & certifiers", href: "?sort=sources", active: true }],
      densityOptions: [{ value: "default", label: "Default", href: "?d=default", active: true }],
    };
    const html = renderToStaticMarkup(createElement(PanelHeader, { model, compact: true, rail: true }));
    assert.match(html, /<h1[^>]*><span class="shrink-0 text-sm font-medium text-ink-strong">1,120 suppliers<\/span><span title="pants · Sanctioned hidden" class="[^"]*\btruncate\b[^"]*">pants · Sanctioned hidden<\/span><\/h1>/);
    assert.doesNotMatch(html, /<details|aria-label="Save search"|Density|51–75/, "the rail's header draws a control or the range");
  });

  it("the footer is the range and two page buttons, with no rows-per-page menu", () => {
    const html = renderToStaticMarkup(
      createElement(PanelFooter, { rail: true, shown: 25, total: 1120, perPage: 25, page: 3, prevHref: "?page=2", nextHref: "?page=4", perHrefs: [{ n: 25, href: "?per=25" }] }),
    );
    assert.match(html, /51–75 of 1,120/);
    assert.match(html, /aria-label="Previous page"/);
    assert.match(html, /aria-label="Next page"/);
    assert.doesNotMatch(html, /<details|per page|Page 3 of/, "the rail's footer wraps with a menu or the page count");
  });
});

describe("the Send RFQ hint names the buyer's own keys", () => {
  it("says Ctrl ↵ until a Mac says otherwise, and the screen-reader hint names the same key", () => {
    // Founder's review, 29 Sep 2026: "⌘↵" on Windows. The server cannot know
    // the platform, so it draws the Control form and a Mac swaps in ⌘ after
    // hydration (`useApplePlatform`); the handler takes either key.
    const row = buildTableRow(aboniInput());
    const target = { id: "8ce50581-2d84-4cc2-93de-506394eade5d", slug: row.slug, name: row.name, initials: row.initials, tier: 1 as const, marks: row.marks, place: "Dhaka", type: "Factory", sanctioned: false };
    const html = renderToStaticMarkup(createElement(RfqComposer, { targets: [target], workspace: null, closeHref: "/app/discover?q=knit" }));
    assert.match(html, /<kbd[^>]*>Ctrl ↵<\/kbd>/);
    assert.doesNotMatch(html, /⌘/);
    assert.match(html, /Control plus Enter also sends\./);
    assert.match(source("components/dashboard/rfq-composer.tsx"), /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key === "Enter"/, "the hint promises a key the handler no longer takes");
  });
});
