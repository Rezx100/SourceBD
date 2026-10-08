// The v4 Saved pages (B6b): the words a buyer reads (the sort and page in the address, the first
// certificate to check and what its cell may say, the row's type and workers, the tab counts, a saved
// search's filters and its remembered count), the table, the bars and the phone list as drawn, and what
// the two routes put in the HTML for a filled, an empty and a failed read and for the record beside the
// list. Dates are fixed to 4 Oct 2026 for the words; the routes use the real clock, so their dates are
// built from it.
//
// The routes run over a fake Supabase client installed into the module cache before they load
// (the pattern in `components/orders/orders.test.ts`).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { aboniInput } from "@/lib/dashboard/fixtures";
import { SelectionContext } from "../search/selection";
import { SavedBar, SavedTable } from "./table";
import { SavedPhoneList, phoneLine } from "./phone";
import { SavedEmpty, SavedError, SearchesEmpty, SearchesError } from "./list";
import { SearchList } from "./searches";
import { LastSearchCardView } from "./last-search";
import { rfqHref } from "@/lib/dashboard/selection";
import { removeMessage, runRemove, runUndo } from "./transport";
import { SaveSearchForm, SaveSearchPanel, saveSummary } from "./save-search";
import {
  PAGE_SIZE,
  TOO_MANY,
  buildSavedItems,
  buildSearchItems,
  certCell,
  countWords,
  groupCerts,
  lastSearchCard,
  parsePage,
  parseSort,
  removedWords,
  savedCaption,
  savedExportHref,
  savedHref,
  searchFilters,
  searchesCaption,
  tabLabels,
  type CertRead,
  type SavedItem,
  type SavedRow,
} from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
type Handler = Answer | ((args: Record<string, unknown> | undefined) => Answer);
let rpcs: Record<string, Handler> = {};
let rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
let tables: Record<string, { data: unknown; error: unknown; count?: number }> = {};
const client = {
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    const h = rpcs[fn];
    if (h === undefined) return { data: fn === "production_workers_display_batch" ? [] : null, error: { code: "PGRST202", message: `no function ${fn}` } };
    return typeof h === "function" ? h(args) : h;
  },
  auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } }, error: null }) },
  from(table: string) {
    const answer = () => tables[table] ?? { data: [], error: null, count: 0 };
    const result = () => Promise.resolve(answer());
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      contains: () => chain,
      order: () => chain,
      update: () => chain,
      limit: () => result(),
      maybeSingle: () => Promise.resolve({ data: null }),
      then: (res: (v: unknown) => unknown) => result().then(res),
    };
    return chain;
  },
};
{
  const stub = (rel: string, exports: Record<string, unknown>) => {
    const id = require.resolve(path.join(OUT, rel));
    require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module;
  };
  stub("lib/supabase/server.js", { createSupabaseServerClient: async () => client });
  stub("lib/auth.js", { getServerRole: async () => "buyer" });
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stubs must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const html = (el: ReactElement) => plain(render(el));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const given = (a: Record<string, Handler>, t: typeof tables = {}) => {
  rpcs = a;
  tables = t;
  rpcCalls = [];
};

const NOW = new Date("2026-10-04T12:00:00Z");
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const ABONI = aboniInput();
const S1 = "0f1e2d3c-0000-4000-8000-000000000001";
const S2 = "0f1e2d3c-0000-4000-8000-000000000002";
const S3 = "0f1e2d3c-0000-4000-8000-000000000003";

const row = (id: string, over: Partial<SavedRow> = {}): SavedRow => ({
  id,
  slug: `slug-${id.slice(-1)}`,
  company_name: "TEX TOWN LTD.",
  entity_type: "factory",
  city: "Dhaka",
  district: "Dhaka",
  source_tags: ["BGMEA"],
  t13_source_count: 8,
  employees_total: 1408,
  saved_at: "2026-10-01T10:00:00Z",
  total_count: 3,
  ...over,
});
const ROWS: SavedRow[] = [
  row(S1),
  row(S2, { company_name: "Aboni Knitwear Ltd.", t13_source_count: 11, employees_total: 3166, saved_at: "2026-09-26T10:00:00Z", workers_own: 2662, workers_basis: "own", workers_source: "RSC" }),
  row(S3, { company_name: "A.R. Fashion", entity_type: "buying_house", city: null, district: null, employees_total: null, t13_source_count: 1, saved_at: "2026-06-12T10:00:00Z" }),
];
const cert = (kind: string, no: string, expires_on: string, sid: string): CertRead => ({ kind, certificate_no: no, expires_on, supplier: { id: sid } });
const CERTS = groupCerts([cert("wrap", "7865", "2026-05-28", S1)], [cert("gots", "G-1", "2026-10-08", S2), cert("oeko_tex", "O-1", "2026-12-01", S2)]);
const items = (certs = CERTS): SavedItem[] => buildSavedItems(ROWS, certs, NOW, { sort: "recent", page: 1 });

describe("the address", () => {
  it("a sort and a page are read from it and the defaults are dropped from every link", () => {
    assert.equal(parseSort("name"), "name");
    assert.equal(parseSort("bogus"), "recent");
    assert.equal(parseSort(["receipts"]), "receipts");
    assert.equal(parsePage("3"), 3);
    assert.equal(parsePage("0"), 1);
    assert.equal(parsePage("x"), 1);
    assert.equal(savedHref({ sort: "recent", page: 1 }), "/app/saved");
    assert.equal(savedHref({ sort: "name", page: 2 }), "/app/saved?sort=name&page=2");
    assert.equal(savedHref({ sort: "name", page: 1, open: "a b" }), "/app/saved?sort=name&open=a+b");
    assert.equal(savedHref({ sort: "recent", page: 1, open: "a", tab: "certificates" }), "/app/saved?open=a&tab=certificates");
    assert.equal(savedHref({ sort: "recent", page: 1, open: "a", tab: "overview" }), "/app/saved?open=a");
    assert.equal(savedHref({ sort: "recent", page: 1, open: null, tab: "certificates" }), "/app/saved", "a tab belongs to an open record");
  });

  it("Download CSV keeps the page's sort", () => {
    assert.equal(savedExportHref("recent"), "/api/v1/export?kind=saved&sort=recent");
    assert.equal(savedExportHref("name"), "/api/v1/export?kind=saved&sort=name");
  });

  // Critique of 8 Oct 2026, item 2: Saved's doors to the composer were a page jump away from the list.
  it("one RFQ to everyone ticked, and a row's own, open the composer in the pane beside this list", () => {
    assert.equal(rfqHref("/app/saved", [S1, S2]), `/app/saved?rfq=${S1},${S2}`);
    assert.equal(rfqHref("/app/saved?sort=name&page=2", [S1]), `/app/saved?sort=name&page=2&rfq=${S1}`);
    const first = buildSavedItems(ROWS, CERTS, NOW, { sort: "name", page: 2 })[0]!;
    assert.equal(first.rfqHref, `/app/saved?sort=name&page=2&rfq=${S1}`);
    assert.equal(first.listHref, "/app/saved?sort=name&page=2");
    assert.match(TOO_MANY, /up to 50 suppliers/);
  });
});

describe("the first certificate to check", () => {
  it("the worst certificate speaks first, with how many more follow", () => {
    const [a, b] = items();
    assert.equal(a!.cert.kind, "line");
    assert.deepEqual((a!.cert as { line: unknown }).line, { state: "expired", text: "WRAP expired 28 May 2026", more: 0 });
    // The same cell the results draw: the body's mark and the short state, the full date in its words.
    const summary = (a!.cert as { summary: { short: string; words: string; first: { code: string } } }).summary;
    assert.deepEqual([summary.short, summary.words, summary.first.code], ["Expired 28 May", "WRAP expired 28 May 2026", "WRAP"]);
    const line = (b!.cert as { kind: "line"; line: { state: string; text: string; more: number } }).line;
    assert.equal(line.state, "expiring");
    assert.match(line.text, /^GOTS expires in 4 days/);
    assert.equal(line.more, 1);
  });

  it("'Nothing to check' only when both reads worked; a failed read says it was not read", () => {
    assert.deepEqual(items()[2]!.cert, { kind: "clear" });
    const half = groupCerts(null, [cert("gots", "G-1", "2026-10-08", S2)]);
    assert.equal(half.complete, false);
    assert.deepEqual(certCell(half, S3, NOW), { kind: "unread" }, "a supplier not listed is not 'clear' when one read failed");
    assert.equal(certCell(half, S2, NOW).kind, "line", "a listed supplier still shows its certificate");
    assert.deepEqual(certCell(null, S1, NOW), { kind: "unread" });
  });
});

describe("a saved supplier's row", () => {
  it("the name cased, the type and place, workers with their second figure, sources, the day it was saved", () => {
    const [a, b, c] = items();
    assert.equal(a!.name, "Tex Town Ltd");
    assert.equal(a!.type, "Factory");
    assert.equal(a!.place, "Dhaka");
    assert.equal(a!.workers, "1,408");
    assert.equal(a!.sources, 8);
    assert.equal(a!.savedOn, "1 Oct 2026");
    assert.equal(b!.workers, "2,662");
    assert.match(b!.workersSecond?.short ?? "", /3,166/);
    assert.equal(c!.workers, null);
    assert.equal(c!.place, null);
    assert.equal(c!.type, "Buying house");
  });

  it("the name opens the record beside the list, keeping the sort and page; the phone opens it as a page with the way back", () => {
    const [a] = buildSavedItems(ROWS, CERTS, NOW, { sort: "name", page: 2 });
    assert.equal(a!.paneHref, "/app/saved?sort=name&page=2&open=slug-1");
    assert.equal(a!.pageHref, `/app/suppliers/slug-1?back=${encodeURIComponent("/app/saved?sort=name&page=2")}`);
  });

  it("the captions and tabs say only what was read", () => {
    assert.equal(savedCaption(11), "11 saved suppliers · only you see this list");
    assert.equal(savedCaption(1), "1 saved supplier · only you see this list");
    assert.equal(savedCaption(null), "Only you see this list");
    assert.deepEqual(tabLabels(11, 2), { suppliers: "Suppliers · 11", searches: "Saved searches · 2", phoneSearches: "Searches · 2" });
    assert.deepEqual(tabLabels(11, null), { suppliers: "Suppliers · 11", searches: "Saved searches", phoneSearches: "Searches" });
    assert.equal(removedWords(["Aboni Knitwear Ltd."]), "Removed Aboni Knitwear Ltd. from saved");
    assert.equal(removedWords(["a", "b", "c"]), "Removed 3 suppliers from saved");
    assert.equal(PAGE_SIZE, 24);
  });

  it("a phone's line under the name: type, place, sources and workers", () => {
    assert.equal(phoneLine(items()[0]!), "Factory · Dhaka · 8 sources · 1,408 workers");
    assert.equal(phoneLine(items()[2]!), "Buying house · 1 source");
  });
});

/** A selection with these ids ticked, as the provider would hand it. */
const selected = (ids: string[], over: Record<string, unknown> = {}) => {
  const set = new Set(ids);
  return { interactive: true, selected: set, isSelected: (id: string) => set.has(id), toggle() {}, toggleAllOnPage() {}, allState: "mixed", clear() {}, edits: 0, ...over };
};
const withSelection = (value: ReturnType<typeof selected>, el: ReactElement) => createElement(SelectionContext.Provider, { value: value as never }, el);

describe("the table", () => {
  it("the columns in Paper's order, a real table, each name opening the record in the pane", () => {
    const out = html(createElement(SavedTable, { items: items() }));
    // The results table's columns, in its order (critique of 7 Oct 2026, item 4: one grammar for the two tables).
    assert.match(text(out), /Supplier Type Location Workers Sources Certificates Saved on Actions/);
    assert.match(out, /<table\b/);
    assert.match(out, /<a(?=[^>]*href="\/app\/saved\?open=slug-1")(?=[^>]*data-open="record")[^>]*>Tex Town Ltd/);
    assert.match(text(out), /Tex Town Ltd Factory Dhaka 1,408 8 WRAP expired 28 May 2026 .*1 Oct 2026/);
    // The certificate is the results' compact cell: the body's mark and the state as a pill, the full date in the title.
    assert.match(out, /<td class="[^"]*py-1\.5[^"]*"><span class="flex flex-wrap[^"]*" title="WRAP expired 28 May 2026"><span class="sr-only">WRAP expired 28 May 2026<\/span>/);
    assert.match(out, /cert\/wrap\.png/);
    assert.match(out, /rounded-md[^"]*bg-cert-expired-bg[^"]*">Expired 28 May</);
    assert.match(text(out), /Nothing to check/);
    assert.match(out, /aria-label="Select all on this page"/);
    assert.match(out, /aria-label="More actions for Tex Town Ltd"/);
    // The results' row menu, word for word, then Remove from saved (Radix draws the menu only once opened, so the source is read).
    const table = readFileSync(path.join(process.cwd(), "components", "saved", "table.tsx"), "utf8");
    assert.match(table, /<MenuItem href=\{i\.rfqHref\}>Send RFQ<\/MenuItem>\s*<MenuItem href=\{i\.pageHref\}>Open full page<\/MenuItem>\s*<MenuItem onSelect=[\s\S]*?>Remove from saved<\/MenuItem>/);
  });

  it("a certificate that was not read says so, and never 'Nothing to check'", () => {
    const out = html(createElement(SavedTable, { items: items(groupCerts(null, null)) }));
    assert.match(text(out), /Not read just now/);
    assert.doesNotMatch(out, /Nothing to check/);
  });

  it("the open row is marked, and a supplier with no workers figure says so in words", () => {
    const out = html(createElement(SavedTable, { items: items(), currentSlug: "slug-1" }));
    assert.equal(out.match(/aria-current="true"/g)?.length, 1);
    assert.match(text(out), /A\.R\. Fashion Buying house .*Not published/);
  });
});

describe("the bulk bar", () => {
  const bar = (ids: string[]) => html(withSelection(selected(ids), createElement(SavedBar, { items: items() })));

  it("shows nothing while nothing is ticked", () => {
    assert.doesNotMatch(bar([]), /selected/);
  });

  it("names the count, offers Clear and Remove from saved, and sends one RFQ to everyone ticked", () => {
    const out = bar([S1, S2]);
    assert.match(text(out), /2 suppliers selected Clear Remove from saved Send one RFQ to 2 suppliers/);
    assert.match(out, new RegExp(`href="/app/saved\\?rfq=${S1},${S2}"`));
    assert.doesNotMatch(out, /rfqs\/new/);
    assert.match(bar([S1]), /1 supplier selected/);
    assert.match(bar([S1]), /Send one RFQ to 1 supplier</);
  });

  it("refuses past 50: the send is disabled and the rule is in words", () => {
    const many = Array.from({ length: 51 }, (_, i) => `0f1e2d3c-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`);
    const rows = many.map((id) => row(id));
    const out = html(withSelection(selected(many), createElement(SavedBar, { items: buildSavedItems(rows, CERTS, NOW, { sort: "recent", page: 1 }) })));
    assert.match(out, /aria-disabled="true"[^>]*>[\s\S]*Send one RFQ to 51 suppliers/);
    assert.doesNotMatch(out, /href="\/app\/rfqs\/new/);
    assert.match(text(out), new RegExp(TOO_MANY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

describe("the phone list", () => {
  it("each row is a 44 tick, the name as a link to the record page, the line and the certificate", () => {
    const out = html(createElement(SavedPhoneList, { items: items() }));
    assert.match(out, /aria-label="Select Tex Town Ltd"/);
    assert.match(out, /href="\/app\/suppliers\/slug-1\?back=%2Fapp%2Fsaved"/);
    assert.match(text(out), /Tex Town Ltd Factory · Dhaka · 8 sources · 1,408 workers WRAP expired 28 May 2026/);
    assert.doesNotMatch(out, /selected/);
  });

  it("with some ticked: the count, Clear, and an action bar with Remove and one RFQ", () => {
    const out = html(withSelection(selected([S1, S2]), createElement(SavedPhoneList, { items: items() })));
    assert.match(text(out), /2 selected Clear/);
    assert.match(text(out), /Remove Send one RFQ to 2/);
    assert.doesNotMatch(out, /rfqs\/new/);
    // React hoists the marks' image preloads ahead of the list.
    assert.match(out, /^(?:<link [^>]*\/>)*<div class="md:hidden pb-20">/, "the last rows keep their room above the action bar");
    assert.match(html(createElement(SavedPhoneList, { items: items() })), /^(?:<link [^>]*\/>)*<div class="md:hidden">/);
    assert.match(out, new RegExp(`href="/app/saved\\?rfq=${S1},${S2}"`));
  });
});

describe("removing and putting back", () => {
  const res = (ok: boolean, status = ok ? 200 : 500, body: unknown = {}) => ({ ok, status, json: async () => body });
  const items = [
    { id: S1, name: "Tex Town Ltd" },
    { id: S2, name: "Aboni Knitwear Ltd." },
  ];

  it("one DELETE per supplier, and everything that went is reported", async () => {
    const calls: string[] = [];
    const out = await runRemove(items, { fetch: async (url, init) => (calls.push(`${init?.method} ${url}`), res(true)) });
    assert.deepEqual(calls, [`DELETE /api/v1/saved?supplier_id=${S1}`, `DELETE /api/v1/saved?supplier_id=${S2}`]);
    assert.deepEqual(out.gone.map((g) => g.id), [S1, S2]);
    assert.equal(out.failed, 0);
    assert.equal(out.message, null);
  });

  it("a partial failure keeps the ones that went and says how many did not; a total failure says nothing changed", async () => {
    const some = await runRemove(items, { fetch: async (url) => res(url.endsWith(S1)) });
    assert.deepEqual(some.gone.map((g) => g.id), [S1]);
    assert.equal(some.failed, 1);
    assert.equal(some.message, "Could not remove 1 of 2. The others were removed.");
    const none = await runRemove(items, { fetch: async () => { throw new Error("offline"); } });
    assert.equal(none.gone.length, 0);
    assert.equal(none.message, "Could not remove them. Nothing was changed. Try again.");
    assert.equal(removeMessage(0, 3), null);
  });

  it("Undo is the bar's bulk save of exactly the ids that were removed, and a refusal says why in the search's words", async () => {
    let body = "";
    const ok = await runUndo([S1, S2], { fetch: async (_url, init) => ((body = init?.body ?? ""), res(true, 200, { count: 2, ids: [S1, S2] })) });
    assert.deepEqual(JSON.parse(body), { supplier_ids: [S1, S2] });
    assert.deepEqual(ok, { ok: true, message: null });
    const limited = await runUndo([S1], { fetch: async () => res(false, 429) });
    assert.equal(limited.ok, false);
    assert.match(limited.message ?? "", /Too many saves in the last minute/);
    const offline = await runUndo([S1], { fetch: async () => { throw new Error("offline"); } });
    assert.equal(offline.ok, false);
    assert.match(offline.message ?? "", /no connection/);
  });
});

describe("Save this search", () => {
  it("the summary is the filters and what they find today, or the filters alone when the count was not read", () => {
    assert.equal(saveSummary("knit · Sanctioned hidden", 4645), "knit · Sanctioned hidden · 4,645 suppliers today");
    assert.equal(saveSummary("knit", 1), "knit · 1 supplier today");
    assert.equal(saveSummary("knit", null), "knit");
  });

  it("the popover: a named dialog that does not claim to be modal, the summary, the name field, Cancel and Save search, and no promise of an email", () => {
    const out = html(createElement(SaveSearchPanel, { search: "q=knit", defaultName: "knit", summary: "knit · 4,645 suppliers today", closeHref: "/app/discover?q=knit", nextHref: "/app/discover?q=knit&saved=1" }));
    assert.match(out, /<section role="dialog" aria-label="Save this search" aria-modal="false"/);
    assert.match(text(out), /Save this search knit · 4,645 suppliers today Name Cancel Save search/);
    assert.match(out, /<input\b(?=[^>]*\sname="name")(?=[^>]*\svalue="knit")(?=[^>]*\smaxLength="120"|[^>]*\smaxlength="120")[^>]*>/);
    assert.match(out, /aria-label="Close"/);
    assert.doesNotMatch(text(out), /new matches|email/i, "no switch is offered unless the database has it (0113)");
  });

  it("with 0113 the form offers 'Tell me about new matches', off until chosen, and says what it sends", () => {
    const withIt = html(createElement(SaveSearchPanel, { search: "q=knit", defaultName: "knit", summary: "s", closeHref: "/a", nextHref: "/b", alerts: true }));
    assert.match(withIt, /<input\b(?=[^>]*\srole="switch")(?![^>]*\schecked="")[^>]*>/);
    assert.match(text(withIt), /Tell me about new matches One email on Monday, only when something new matches/);
    const touch = html(createElement(SaveSearchForm, { search: "q=knit", defaultName: "knit", nextHref: "/n", cancelHref: "/c", touch: true, alerts: true }));
    assert.match(text(touch), /Tell me about new matches One email on Monday, only when something new matches/);
    assert.match(touch, /h-8 w-\[52px\]/, "a phone's switch is the 52 x 32 one");
  });

  it("the form: the name is named after the search and cut to 120, and the live region is always in the page", () => {
    const out = html(createElement(SaveSearchForm, { search: "q=knit", defaultName: "x".repeat(200), nextHref: "/app/searches", cancelHref: "/app/searches" }));
    assert.equal(out.match(/value="(x+)"/)?.[1]?.length, 120);
    assert.match(out, /<p role="status" aria-live="polite" class="sr-only"><\/p>/);
    // Only the popover's footer runs full width (negative margins); the page's does not bleed out of its column.
    assert.doesNotMatch(out, /-mx-4/);
    assert.match(html(createElement(SaveSearchPanel, { search: "q=knit", defaultName: "knit", summary: "s", closeHref: "/a", nextHref: "/b" })), /-mx-4 border-t border-line px-4 py-3/);
    const touch = html(createElement(SaveSearchForm, { search: "q=knit", defaultName: "knit", nextHref: "/app/searches", cancelHref: "/app/searches", touch: true }));
    assert.match(touch, /h-input-touch/, "a phone's field is 48 tall");
    assert.doesNotMatch(touch, />Cancel</, "a phone's sheet has its close, not a Cancel");
  });
});

describe("the states", () => {
  it("empty teaches what a saved list gets you and offers search; a failed read never says 'No saved suppliers yet'", () => {
    const empty = html(createElement(SavedEmpty));
    assert.match(text(empty), /No saved suppliers yet\. Save suppliers to check them here\. A saved list gets you:/);
    assert.match(text(empty), /A warning before any certificate expires/);
    assert.match(empty, /href="\/app"[^>]*>Search suppliers/);
    const err = html(createElement(SavedError, { retryHref: "/app/saved?sort=name" }));
    assert.match(err, /role="alert"/);
    assert.match(text(err), /We couldn't load your saved suppliers\. Nothing has been removed\./);
    assert.match(err, /href="\/app\/saved\?sort=name"[^>]*>Try again/);
    assert.doesNotMatch(err, /No saved suppliers yet/);
    assert.match(text(html(createElement(SearchesEmpty))), /No saved searches yet\./);
    assert.match(text(html(createElement(SearchesError, { retryHref: "/app/searches" }))), /We couldn't load your saved searches\./);
  });
});

describe("a saved search", () => {
  const SEARCH = { id: "s1", name: "GOTS knit factories in Gazipur", query_state: { search: "q=knit&cert=gots&district=Gazipur" }, created_at: "2026-09-01T10:00:00Z", last_count: 101, last_counted_at: "2026-10-04T08:00:00Z", href: "/app/discover?q=knit" };

  it("its filters in words; the count and when it was taken", () => {
    assert.match(searchFilters(SEARCH.query_state), /knit/i);
    // In words, each value once, the family names and the defaults left out (critique of 7 Oct 2026, item 9).
    assert.equal(searchFilters({ search: "q=knit&cert=gots&district=Gazipur" }), "knit, GOTS, Gazipur");
    assert.equal(searchFilters({ search: "cert=gots:expired&hs=6110" }), "HS 6110, GOTS, expired");
    assert.doesNotMatch(searchFilters({ search: "q=knit&cert=gots&district=Gazipur" }), /Certificate ·|Sanctioned hidden|·/);
    // A search that kept no filter is every published supplier; the default (sanctioned hidden) goes without saying.
    assert.equal(searchFilters({ search: "" }), "All published suppliers");
    assert.equal(searchFilters(null), "All published suppliers");
    assert.deepEqual(countWords(101, "2026-10-04T08:00:00Z", NOW), { count: "101", words: "suppliers today" });
    assert.match(countWords(101, "2026-10-01T08:00:00Z", NOW).words, /^suppliers · counted /);
    assert.deepEqual(countWords(null, null, NOW), { count: null, words: "not counted yet" });
    assert.equal(searchesCaption(2), "2 saved searches · only you see them");
    assert.equal(searchesCaption(1), "1 saved search · only you see it");
    assert.equal(searchesCaption(0), "None saved yet · only you see them");
    assert.equal(searchesCaption(null), "Only you see them");
    assert.equal(searchesCaption(200, true), "The 200 most recent saved searches · only you see them");
  });

  it("the row: name, filters, the count, Run search to the redirect route, and a Delete that asks first", () => {
    const out = html(createElement(SearchList, { items: buildSearchItems([SEARCH, { ...SEARCH, id: "s2", name: "", last_count: null, last_counted_at: null }], NOW) }));
    assert.match(text(out), /GOTS knit factories in Gazipur/);
    assert.match(text(out), /101 suppliers today/);
    assert.match(out, /href="\/app\/discover\?q=knit"[^>]*>Run search/);
    assert.match(text(out), /Untitled search/);
    assert.match(text(out), /not counted yet/);
    assert.match(out, /aria-label="More actions for GOTS knit factories in Gazipur"/);
    assert.doesNotMatch(out, /Email me|new matches/, "a switch nobody read (0113 not applied) is not drawn");
  });

  it("the switch says what is on: every Monday, or no email; saved at once, drawn only where it was read", () => {
    const out = html(createElement(SearchList, { items: buildSearchItems([SEARCH, { ...SEARCH, id: "s2", name: "Other" }, { ...SEARCH, id: "s3", name: "Unread" }], NOW, { s1: true, s2: false }) }));
    assert.equal(out.match(/role="switch"/g)?.length, 4, "two searches, a desktop row and a phone row each; s3 was not read");
    assert.match(text(out), /Email me new matches every Monday/);
    assert.match(text(out), /No email for new matches/);
    assert.match(out, /<input\b(?=[^>]*\srole="switch")(?=[^>]*\schecked="")[^>]*>/);
    assert.equal(out.match(/\schecked=""/g)?.length, 2, "only s1 is on (a desktop row and a phone row)");
    assert.deepEqual(buildSearchItems([SEARCH], NOW, { s1: true }).map((i) => i.alert), [true]);
    assert.deepEqual(buildSearchItems([SEARCH], NOW, null).map((i) => i.alert), [null]);
    assert.deepEqual(buildSearchItems([SEARCH], NOW, {}).map((i) => i.alert), [null]);
  });
});

describe("Save your last search?", () => {
  const read = (over: Record<string, unknown> = {}) => ({ state: { search: "q=knit&cert=gots" }, searched_at: "2026-10-01T09:00:00Z", saved: false, ...over });

  it("is offered for a search from the last 7 days that no saved search holds, under the name its filters give it", () => {
    const card = lastSearchCard(read(), NOW)!;
    assert.equal(card.search, "q=knit&cert=gots");
    assert.match(card.filters, /knit/i);
    assert.equal(card.name, card.name.slice(0, 120));
    assert.ok(card.name.length > 0);
    assert.equal(card.when, "3d ago");
    assert.match(card.runHref, /^\/app\/discover\?.*q=knit/);
  });

  it("is not offered when it is already saved, older than 7 days, missing, empty or unreadable; a database without 0113 is no card", () => {
    assert.equal(lastSearchCard(read({ saved: true }), NOW), null);
    assert.equal(lastSearchCard(read({ saved: undefined }), NOW), null, "'saved' not said is not 'not saved'");
    assert.equal(lastSearchCard(read({ searched_at: "2026-09-26T09:00:00Z" }), NOW), null);
    assert.ok(lastSearchCard(read({ searched_at: "2026-09-27T12:00:00Z" }), NOW), "exactly 7 days is still offered");
    assert.equal(lastSearchCard(read({ searched_at: "nonsense" }), NOW), null);
    assert.equal(lastSearchCard(read({ state: { search: "" } }), NOW), null);
    assert.equal(lastSearchCard(read({ state: null }), NOW), null);
    assert.equal(lastSearchCard(null, NOW), null);
    assert.equal(lastSearchCard([], NOW), null);
    assert.equal(lastSearchCard("x", NOW), null);
  });

  it("the card names the search, says when it was run, and offers Run search and Save search", () => {
    const out = html(createElement(LastSearchCardView, { card: lastSearchCard(read(), NOW)! }));
    assert.match(out, /<section[^>]*aria-label="Save your last search\?"/);
    assert.match(text(out), /Save your last search\? .*knit.* You ran it 3d ago\. Only you see your saved searches\./i);
    assert.match(out, /href="\/app\/discover\?[^"]*q=knit[^"]*"[^>]*>Run search/);
    assert.match(out, /<button[^>]*>Save search<\/button>/);
    assert.match(out, /role="status" aria-live="polite"/, "a refusal is announced");
  });
});

const RECORD = {
  buyer_supplier_profile: { data: ABONI.profile, error: null },
  supplier_epb_hscodes: { data: ABONI.hscodes.map((h) => ({ code: h.code, description: h.description, source_url: h.source_url })), error: null },
  supplier_contact_counts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null },
};
const LIST: Handler = { data: ROWS, error: null };
const EXPIRED: Handler = { data: { total: 1, rows: [cert("wrap", "7865", "2026-05-28", S1)] }, error: null };
const EXPIRING: Handler = { data: { total: 1, rows: [cert("gots", "G-1", day(10), S2)] }, error: null };
const base = (over: Record<string, Handler> = {}, t: typeof tables = { saved_searches: { data: [], error: null, count: 2 } }) =>
  given({ buyer_saved_list: LIST, compliance_expired_certs: EXPIRED, compliance_expiring_certs: EXPIRING, ...RECORD, ...over }, t);

async function page(file: string, props: unknown = {}): Promise<{ html: string } | { threw: string }> {
  try {
    const el = await route(file)(props);
    return { html: plain(render(el)) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}
const saved = async (sp: Record<string, string> = {}) => (await page("app/(app)/app/saved/page.js", { searchParams: Promise.resolve(sp) })) as { html: string };
const searches = async () => (await page("app/(app)/app/searches/page.js")) as { html: string };

describe("/app/saved", () => {
  it("lists every saved supplier with its first certificate to check, under the two tabs and the sort", async () => {
    base();
    const out = await saved();
    assert.match(text(out.html), /Saved 3 saved suppliers · only you see this list/);
    assert.match(text(out.html), /Download CSV Sort: recently saved/);
    assert.match(out.html, /<h1[^>]*>Saved<\/h1>/);
    assert.match(text(out.html), /Suppliers · 3/);
    assert.match(text(out.html), /Saved searches · 2/);
    assert.match(out.html, /href="\/app\/searches"/);
    assert.match(text(out.html), /Tex Town Ltd Factory Dhaka 1,408 8 WRAP expired 28 May 2026/);
    assert.match(text(out.html), /GOTS expires in/);
    assert.match(text(out.html), /A\.R\. Fashion .* Nothing to check/);
    assert.doesNotMatch(out.html, /data-record-pane/);
    assert.ok(rpcCalls.some((c) => c.fn === "buyer_saved_list" && c.args?.p_limit === PAGE_SIZE && c.args?.p_offset === 0));
    assert.match(out.html, /Showing 1–3 of 3 suppliers/);
  });

  it("a supplier whose certificates are all valid prints the first one to lapse, and a worse one still comes first", async () => {
    base({ compliance_expiring_certs: { data: { total: 3, rows: [cert("wrap", "W-9", day(200), S3), cert("gots", "G-1", day(10), S2), cert("oeko_tex", "O-1", day(300), S2)] }, error: null } });
    const out = text((await saved()).html);
    assert.match(out, /A\.R\. Fashion .* WRAP valid until/);
    assert.doesNotMatch(out, /A\.R\. Fashion .* Nothing to check/);
    assert.match(out, /2 certificates: GOTS expires in 10 days/, "a valid one never outranks an expiring one");
    assert.equal(rpcCalls.find((c) => c.fn === "compliance_expiring_certs")?.args?.p_window_days, 365, "the widest window the read allows, so valid certificates come back");
  });

  it("?sort= and ?page= go to the read, and a certificate read that failed is 'not read', never 'nothing to check'", async () => {
    base({ compliance_expired_certs: { data: null, error: { message: "no function" } } });
    const out = await saved({ sort: "name", page: "2" });
    assert.ok(rpcCalls.some((c) => c.fn === "buyer_saved_list" && c.args?.p_sort === "name" && c.args?.p_offset === PAGE_SIZE));
    assert.match(text(out.html), /Not read just now/);
    assert.doesNotMatch(out.html, /Nothing to check/);
    assert.match(text(out.html), /GOTS expires in/, "the read that worked still lists");
  });

  it("no saved suppliers is the teaching state; a page past the end says so; a failed read is an error, never 'none'", async () => {
    base({ buyer_saved_list: { data: [], error: null } });
    const none = (await saved()).html;
    assert.match(text(none), /No saved suppliers yet\./);
    assert.doesNotMatch(none, /Download CSV/, "nothing to download");
    assert.match(text((await saved({ page: "4" })).html), /That page is past the end of your saved list\./);
    base({ buyer_saved_list: { data: null, error: { message: "down" } } });
    const failed = await saved();
    assert.match(failed.html, /role="alert"/);
    assert.match(text(failed.html), /We couldn't load your saved suppliers\./);
    assert.doesNotMatch(failed.html, /No saved suppliers yet/);
    assert.doesNotMatch(failed.html, /Suppliers · 0/, "no count stands in for a failed read");
  });

  it("?open= draws the record in the pane beside a narrow list, marks its row, and Close keeps the sort", async () => {
    base();
    const out = await saved({ open: "slug-1", sort: "name" });
    assert.match(out.html, /data-record="pane"/);
    assert.match(out.html, /Aboni Knitwear Ltd/, "the record's name");
    assert.equal(rpcCalls.find((c) => c.fn === "buyer_supplier_profile")?.args?.p_slug, "slug-1");
    assert.match(out.html, /aria-current="true"/);
    assert.match(out.html, /href="\/app\/saved\?sort=name"[^>]*aria-label="Close"|aria-label="Close"[^>]*href="\/app\/saved\?sort=name"/);
    assert.doesNotMatch(out.html, /<table\b/, "beside a pane the list is the narrow one");
    for (const key of ["email_primary", "phones", "contact_name", "contact_role"]) assert.ok(!out.html.includes(key), `${key} reached the HTML`);
  });

  it("a record that cannot be found, or that is slow, says so in the pane beside a list that still works", async () => {
    base({ buyer_supplier_profile: { data: null, error: null } });
    const none = await saved({ open: "slug-1" });
    assert.match(none.html, /No record for that link/);
    assert.match(none.html, /Tex Town Ltd/);
    base({ buyer_supplier_profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } } });
    const slow = await saved({ open: "slug-1" });
    assert.match(slow.html, /This record could not be read in time/);
    assert.match(slow.html, /href="\/app\/saved\?open=slug-1"[^>]*>Try again/);
  });
});

describe("/app/searches", () => {
  const SEARCH_ROWS = [
    { id: "0f1e2d3c-0000-4000-8000-0000000000a1", name: "GOTS knit factories in Gazipur", query_state: { search: "q=knit&cert=gots" }, created_at: "2026-09-01T10:00:00Z", last_count: 101, last_counted_at: new Date().toISOString() },
    { id: "0f1e2d3c-0000-4000-8000-0000000000a2", name: "WRAP factories in Dhaka", query_state: { search: "q=wrap" }, created_at: "2026-08-01T10:00:00Z", last_count: 193, last_counted_at: new Date().toISOString() },
  ];

  it("lists the saved searches under the same header, the Saved searches tab current, with the supplier count on the other", async () => {
    base({}, { saved_searches: { data: SEARCH_ROWS, error: null, count: 2 } });
    const out = await searches();
    assert.match(text(out.html), /Saved 2 saved searches · only you see them/);
    // The count is a mono figure beside the label, read as "Saved searches · 2".
    assert.match(out.html, />Saved searches<span class="[^"]*font-mono[^"]*"><span class="sr-only"> · <\/span>2<\/span><\/a>/);
    assert.match(text(out.html), /Suppliers · 3/);
    assert.match(text(out.html), /GOTS knit factories in Gazipur/);
    assert.match(text(out.html), /101 suppliers today/);
    assert.match(out.html, /href="\/app\/discover\?[^"]*"[^>]*>Run search/);
    assert.doesNotMatch(out.html, /Sort:/, "a sort belongs to the suppliers");
  });

  it("draws each search's switch from its own alert_weekly; a row that did not answer it, or a failed read, draws none", async () => {
    const withAlerts = SEARCH_ROWS.map((r, i) => ({ ...r, alert_weekly: i === 0 }));
    base({}, { saved_searches: { data: withAlerts, error: null, count: 2 } });
    const out = await searches();
    assert.match(text(out.html), /Email me new matches every Monday/);
    assert.match(text(out.html), /No email for new matches/);
    base({}, { saved_searches: { data: SEARCH_ROWS, error: null, count: 2 } });
    assert.doesNotMatch((await searches()).html, /role="switch"/, "no alert_weekly on the rows: nothing was read, nothing is claimed");
  });

  it("offers the last search above the list when it is recent and not saved; no card when it is saved, old, unread or 0113 is missing", async () => {
    const recent = { state: { search: "q=knit" }, searched_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), saved: false };
    base({ buyer_last_search: { data: recent, error: null } }, { saved_searches: { data: SEARCH_ROWS, error: null, count: 2 } });
    const out = await searches();
    assert.match(text(out.html), /Save your last search\?/);
    assert.match(text(out.html), /You ran it 2d ago/);
    assert.ok(out.html.indexOf("Save your last search?") < out.html.indexOf("GOTS knit factories in Gazipur"), "the card sits above the list");
    for (const answer of [{ data: { ...recent, saved: true }, error: null }, { data: { ...recent, searched_at: "2026-01-01T00:00:00Z" }, error: null }, { data: null, error: null }, { data: null, error: { message: "no function buyer_last_search" } }]) {
      base({ buyer_last_search: answer }, { saved_searches: { data: SEARCH_ROWS, error: null, count: 2 } });
      assert.doesNotMatch((await searches()).html, /Save your last search\?/);
    }
    base({ buyer_last_search: { data: recent, error: null } }, { saved_searches: { data: null, error: { message: "down" } } });
    const failed = await searches();
    assert.doesNotMatch(failed.html, /Save your last search\?/, "a failed list is the page's one message");
    assert.match(text(failed.html), /We couldn't load your saved searches\./);
  });

  it("none saved teaches how to save, and the last search can be the first one; a failed read is an error, never 'none'", async () => {
    base({}, { saved_searches: { data: [], error: null, count: 0 } });
    assert.match(text((await searches()).html), /No saved searches yet\./);
    base({ buyer_last_search: { data: { state: { search: "q=knit" }, searched_at: new Date().toISOString(), saved: false }, error: null } }, { saved_searches: { data: [], error: null, count: 0 } });
    const first = text((await searches()).html);
    assert.match(first, /Save your last search\?/);
    assert.match(first, /No saved searches yet\./);
    base({}, { saved_searches: { data: null, error: { message: "down" } } });
    const failed = await searches();
    assert.match(failed.html, /role="alert"/);
    assert.match(text(failed.html), /We couldn't load your saved searches\./);
    assert.doesNotMatch(failed.html, /No saved searches yet/);
  });
});
