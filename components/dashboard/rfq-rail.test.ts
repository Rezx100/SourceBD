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
