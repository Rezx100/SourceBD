// Boundary tests for Saved (/app/saved) — the desk of certificate alerts and
// recent activity that was Home until the search landing became the app's
// first viewport (28 Sep 2026), then the saved list — and Saved searches
// (/app/searches): the HTML a buyer's browser receives for the empty, error
// and real-content states. The routes' own cases (`/app/saved?open=`) are in
// `app/(app)/app/buyer-pages-routes.test.ts`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { SavedDesk, activityLabel, deskFrom, type DeskModel } from "./saved-desk";
import { DeleteSavedSearch } from "./saved-controls";
import { SavedList, SavedSearchesTable, countedCaption, savedHref, type SavedListRow } from "./saved-list";
import type { SavedSearchJson } from "@/lib/saved-searches";

const EMPTY_DESK: DeskModel = { alerts: [], recent_activity: [] };
const TODAY = new Date("2026-10-01T09:00:00Z");

const desk = (doc: DeskModel | null, failed = false) =>
  renderToStaticMarkup(createElement(SavedDesk, { doc, failed, openHref: (slug: string) => savedHref("recent", 1, slug), today: TODAY }));

/** What a reader sees: the markup with its tags removed. */
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const ROW: SavedListRow = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "aboni-knitwear-ltd",
  company_name: "ABONI KNITWEAR LTD",
  entity_type: "factory",
  city: "Savar",
  district: "Dhaka",
  source_tags: ["BGMEA", "RSC"],
  employees_total: 3314,
  saved_at: "2026-09-20T10:00:00Z",
};

const saved = (over: Partial<Parameters<typeof SavedList>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(SavedList, { rows: [ROW], total: 1, page: 1, pageSize: 24, sort: "recent", failed: false, ...over }),
  );

const ALERT = {
  kind: "cert_expiring" as const,
  supplier_id: "s1",
  supplier_slug: "aboni",
  company_name: "ABONI KNITWEAR LTD",
  cert_kind: "oeko_tex",
  expires_on: "2026-10-12",
};

describe("the desk on Saved", () => {
  it("an empty desk is two caption lines, no panel, no art, no score", () => {
    const html = desk(EMPTY_DESK);
    for (const h of ["Alerts", "Recent activity"]) assert.match(html, new RegExp(`<h2[^>]*>${h}</h2>`));
    assert.match(html, /No certificates on your saved suppliers expire in the next 30 days/);
    assert.doesNotMatch(html, /<ul class="m-0 list-none p-0"|<img\b|role="alert"/);
    assert.doesNotMatch(html, /%|score|grade/i);
  });

  it("an alert names the supplier, the certificate and the date, then the days left — and opens the record beside the list", () => {
    const html = desk({ ...EMPTY_DESK, alerts: [ALERT] });
    assert.match(html, /href="\/app\/saved\?open=aboni"[^>]*>Aboni Knitwear Ltd<\/a>/);
    assert.match(html, /OEKO-TEX expires 12 Oct 2026<\/span><span class="[^"]*text-caution-ink[^"]*">in 11 days<\/span>/);
    assert.doesNotMatch(html, /bg-caution-tint|Expiring</, "the badge that repeated the sentence");
  });

  it("activity reads as words, and a failed read claims no all-clear", () => {
    assert.equal(activityLabel({ kind: "rsc_updated", detail: "52.6" }), "RSC remediation now at 53%");
    const failed = desk(null, true);
    assert.match(failed, /could not be read/);
    assert.doesNotMatch(failed, /No certificates|None yet|0 saved/);
    assert.equal(deskFrom(null), null);
    assert.deepEqual(deskFrom({ alerts: [], recent_activity: [] }), EMPTY_DESK);
    assert.match(text(desk({ ...EMPTY_DESK, alerts: [ALERT] })), /Aboni Knitwear Ltd OEKO-TEX expires/);
  });

  it("Saved draws the desk above its list", () => {
    const html = saved({ desk: createElement("p", { id: "the-desk" }, "desk") });
    assert.ok(html.indexOf('id="the-desk"') > html.indexOf("<h1"), "the desk sits under the page title");
    assert.ok(html.indexOf('id="the-desk"') < html.indexOf("<table"), "and above the list");
  });
});

describe("Saved", () => {
  it("draws a row with its type, place, workers and saved date, lit on hover", () => {
    const html = saved();
    assert.match(html, /<h1[^>]*>Saved<\/h1>/);
    assert.match(html, /1 saved supplier · only you can see this list/);
    assert.match(html, /Factory · Savar, Dhaka/);
    assert.match(html, /3,314/);
    assert.match(html, /20 Sep 2026/);
    assert.match(html, /1–1 of 1/);
    assert.match(html, /aria-label="Saved"/, "the unsave control is on the row");
    assert.match(html, /<tr class="[^"]*hover:bg-surface-sunken/);
  });

  it("the name opens the record beside the list; the pointer button is gone", () => {
    const html = saved();
    assert.match(html, /href="\/app\/saved\?open=aboni-knitwear-ltd"[^>]*>Aboni Knitwear Ltd</);
    assert.doesNotMatch(html, />Open</);
    assert.doesNotMatch(html, /href="\/app\/suppliers\//);
  });

  it("the open record's row is marked, and only that row", () => {
    const other = { ...ROW, id: "2", slug: "zaheen", company_name: "ZAHEEN KNITWEAR" };
    const html = saved({ rows: [ROW, other], total: 2, openSlug: "zaheen" });
    const rows = [...html.matchAll(/<tr class="([^"]*)"><th scope="row"/g)].map((m) => m[1]);
    assert.equal(rows.length, 2);
    assert.doesNotMatch(rows[0]!, /bg-brand-tint/);
    assert.match(rows[1]!, /bg-brand-tint/);
    assert.equal(html.match(/aria-current="true"/g)?.length, 1);
  });

  it("the sort applies on choice, with a hidden Apply for no script", () => {
    const html = saved({ sort: "name" });
    assert.match(html, /<form[^>]*action="\/app\/saved"/);
    assert.match(html, /<select[^>]*name="sort"/);
    assert.match(html, /<option value="name" selected="">Name \(A–Z\)<\/option>/);
    assert.match(html, /<button type="submit" class="[^"]*sr-only focus:not-sr-only[^"]*">Apply<\/button>/);
  });

  it("an empty list teaches where saving happens", () => {
    const html = saved({ rows: [], total: 0 });
    assert.match(html, /No saved suppliers yet/);
    assert.match(html, /Save a supplier from search or from its record/);
    assert.doesNotMatch(html, /<table/);
  });

  it("a failed read is an error note, not an empty list", () => {
    const html = saved({ rows: [], total: 0, failed: true });
    assert.match(html, /role="alert"[^>]*>.*Could not load your saved suppliers/);
    assert.doesNotMatch(html, /No saved suppliers yet/);
  });

  it("keeps the sort, page and open parameters", () => {
    assert.equal(savedHref("recent", 1), "/app/saved");
    assert.equal(savedHref("name", 3), "/app/saved?sort=name&page=3");
    assert.equal(savedHref("name", 3, "aboni"), "/app/saved?sort=name&page=3&open=aboni");
    const html = saved({ total: 50, page: 2, sort: "name" });
    assert.match(html, /25–25 of 50/);
    assert.match(html, /href="\/app\/saved\?sort=name"/);
    assert.match(html, /href="\/app\/saved\?sort=name&amp;page=3"/);
    assert.match(html, /href="\/app\/saved\?sort=name&amp;page=2&amp;open=aboni-knitwear-ltd"/, "the record opens on this page");
  });
});

describe("Saved searches", () => {
  const NOW = new Date("2026-09-27T12:00:00Z");
  const search = (over: Partial<SavedSearchJson> = {}): SavedSearchJson => ({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Knit polos, Gazipur",
    query_state: {},
    created_at: "2026-09-20T08:00:00Z",
    last_count: 3481,
    last_counted_at: "2026-09-27T10:00:00Z",
    href: "/app/discover?q=knit+polo",
    ...over,
  });

  it("a kit table: the name opens the search, the count says when it was taken, the date it was saved", () => {
    const html = renderToStaticMarkup(createElement(SavedSearchesTable, { searches: [search()], now: NOW }));
    assert.match(html, /role="region" aria-label="Saved searches"/);
    assert.deepEqual([...html.matchAll(/<th scope="col"[^>]*>([^<]*)</g)].map((m) => m[1]), ["Name", "Suppliers", "Saved on", ""]);
    assert.match(html, /href="\/app\/discover\?q=knit\+polo"[^>]*>Knit polos, Gazipur</);
    assert.match(text(html), /3,481 counted 2h ago/);
    assert.match(html, />20 Sep 2026</);
    assert.match(html, /aria-label="Delete Knit polos, Gazipur"[^>]*>Delete</);
  });

  it("a search never counted says so rather than 0", () => {
    assert.equal(countedCaption(null, NOW), "not counted yet");
    const html = renderToStaticMarkup(createElement(SavedSearchesTable, { searches: [search({ last_count: null, last_counted_at: null })], now: NOW }));
    assert.match(html, /not counted yet/);
    assert.doesNotMatch(text(html), /\b0 counted/);
  });

  it("empty is the illustrated state that says where saving happens", () => {
    const html = renderToStaticMarkup(createElement(SavedSearchesTable, { searches: [], now: NOW }));
    assert.match(html, /src="\/illustrations\/saved\.svg"/);
    assert.match(html, /Save a search from the results panel/);
    assert.doesNotMatch(html, /<table/);
  });

  it("Delete starts as one quiet button; the confirm comes after the click", () => {
    const html = renderToStaticMarkup(createElement(DeleteSavedSearch, { id: "x", name: "Knit polos" }));
    assert.match(html, /^<button type="button" class="[^"]*" aria-label="Delete Knit polos">Delete<\/button>$/);
    assert.doesNotMatch(html, /Delete this search\?/);
  });
});
