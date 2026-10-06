// The search landing and results (B4a): what a buyer, a keyboard and a screen reader meet on
// /app and /app/discover, and the rules Paper drew into them (no cards, nothing cut off, the
// first certificate problem in words, the selection and its bar). Dates are fixed to 3 Oct 2026.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

{
  // The client hooks need a mounted App Router; only they are replaced.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = {
    id: navId,
    filename: navId,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      ...realNav,
      useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
      useSearchParams: () => new URLSearchParams("q=knit"),
      usePathname: () => "/app/discover",
    },
  } as unknown as NodeJS.Module;
}

/* eslint-disable @typescript-eslint/no-require-imports -- the navigation stub above must be in the cache first. */
const { certLine } = require("@/components/patterns") as typeof import("@/components/patterns");
const { attentionOf, attentionWords, certName, loadNeedsAttention } = require("@/lib/dashboard/needs-attention") as typeof import("@/lib/dashboard/needs-attention");
const { SearchLanding } = require("@/components/search/landing") as typeof import("@/components/search/landing");
const { pushRecent } = require("@/components/search/record-recent-search") as typeof import("@/components/search/record-recent-search");
const { startsNavigation } = require("@/components/search/pending-nav") as typeof import("@/components/search/pending-nav");
const { mapLimited } = require("@/lib/map-limited") as typeof import("@/lib/map-limited");
const { ResultsBar, bulkRfqHref, TOO_MANY } = require("@/components/search/bulk-bar") as typeof import("@/components/search/bulk-bar");
const { SelectionContext, SelectionProvider } = require("@/components/search/selection") as typeof import("@/components/search/selection");
const { ResultsTable } = require("@/components/search/table") as typeof import("@/components/search/table");
const { PaneListToolbar, PhoneToolbar, ResultsToolbar, barMenus, resultsTitle } = require("@/components/search/toolbar") as typeof import("@/components/search/toolbar");
const { PaneRows, PhoneRows, ResultsEmpty, ResultsError, ResultsSkeleton, familyWords } = require("@/components/search/list") as typeof import("@/components/search/list");
const { onRowKey } = require("@/components/search/keys") as typeof import("@/components/search/keys");
const { resultRow } = require("@/components/search/model") as typeof import("@/components/search/model");
const { EMPTY_STATE, parseDiscoverState } = require("@/lib/discover-v32-state") as typeof import("@/lib/discover-v32-state");
const { appliedChips, clearedForm, countKey, formOf, groupsSet, searchOf, showLabel, summaryOf } = require("@/components/search/filter-model") as typeof import("@/components/search/filter-model");
const { FilterPane } = require("@/components/search/filters") as typeof import("@/components/search/filters");
const { selectionValue } = require("@/lib/dashboard/selection") as typeof import("@/lib/dashboard/selection");
/* eslint-enable @typescript-eslint/no-require-imports */
import type { ResultRow } from "@/components/search/model";

const TODAY = new Date("2026-10-03T00:00:00Z");
const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const plain = (el: Parameters<typeof renderToStaticMarkup>[0]) => html(el).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/** The href of the first link whose words contain `text`, whatever order its attributes are in. */
function hrefOf(out: string, text: string): string | undefined {
  for (const m of out.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    if (m[2]!.replace(/<[^>]*>/g, "").includes(text)) return /href="([^"]*)"/.exec(m[1]!)?.[1];
  }
  return undefined;
}

const ZAHEEN = "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";
const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  slug: "aboni-knitwear",
  supplierId: "id-aboni",
  name: "Aboni Knitwear Ltd.",
  type: "Factory",
  place: "Dhaka",
  workers: "3,166",
  workersSecond: null,
  sources: 11,
  cert: { state: "expired", text: "WRAP expired 29 Sep 2026", more: 3 },
  paneHref: "/app/discover?q=knit&record=aboni-knitwear",
  pageHref: "/app/suppliers/aboni-knitwear?back=%2Fapp%2Fdiscover%3Fq%3Dknit",
  sanctioned: false,
  ...over,
});
const rows = [row(), row({ slug: "zaheen", supplierId: "id-zaheen", name: ZAHEEN, cert: null, sources: 4 }), row({ slug: "sm", supplierId: "id-sm", name: "SM Sourcing", cert: { state: "valid", text: "WRAP valid until 8 Jan 2027", more: 4 } })];
const sortHrefs = { workers: "/app/discover?q=knit&sort=workers", sources: "/app/discover?q=knit" };

describe("the certificate line of a row", () => {
  it("says the worst certificate first, in Paper's words, and counts the rest", () => {
    const line = certLine(
      [
        { scheme: "OEKO-TEX Standard 100", expiresOn: "2027-05-01" },
        { scheme: "WRAP", expiresOn: "2026-09-29" },
        { scheme: "GOTS", expiresOn: "2026-10-31" },
        { scheme: "SA8000", expiresOn: null },
      ],
      TODAY,
    );
    assert.deepEqual(line, { state: "expired", text: "WRAP expired 29 Sep 2026", more: 3 });
    assert.deepEqual(certLine([{ scheme: "GOTS", expiresOn: "2026-11-01" }], TODAY), { state: "expiring", text: "GOTS expires in 29 days · 1 Nov 2026", more: 0 });
    assert.deepEqual(certLine([{ scheme: "GOTS", expiresOn: "2026-12-01" }], TODAY), { state: "expiring", text: "GOTS expires 1 Dec 2026", more: 0 });
    assert.deepEqual(certLine([{ scheme: "GOTS", expiresOn: "2026-10-08" }], TODAY)?.text, "GOTS expires in 5 days · 8 Oct 2026");
    assert.deepEqual(certLine([{ scheme: "WRAP", expiresOn: "2027-01-26" }], TODAY), { state: "valid", text: "WRAP valid until 26 Jan 2027", more: 0 });
    assert.equal(certLine([], TODAY), null, "no certificate is the row's own words, never an invented line");
  });

  it("of two expired, the one that lapsed most recently leads; of two expiring, the soonest", () => {
    assert.equal(certLine([{ scheme: "GOTS", expiresOn: "2026-08-09" }, { scheme: "WRAP", expiresOn: "2026-09-29" }], TODAY)?.text, "WRAP expired 29 Sep 2026");
    assert.equal(certLine([{ scheme: "GOTS", expiresOn: "2026-10-30" }, { scheme: "WRAP", expiresOn: "2026-10-08" }], TODAY)?.text, "WRAP expires in 5 days · 8 Oct 2026");
  });

  it("a model row carries the line, the figure with its separator and both worker figures where they differ", () => {
    const r = resultRow(
      {
        slug: "aboni",
        name: "Aboni Knitwear Ltd.",
        place: "Dhaka",
        initials: "AK",
        topTier: 1 as never,
        sourceCount: 11,
        marks: [],
        certs: [{ kind: "wrap", scheme: "WRAP", number: "7865", issuer: null, scope: null, expiresOn: "2026-09-29", state: "expired", daysLeft: -4, documentUrl: null, markCode: "wrap" }],
        certsEmptyReason: null,
        photos: [],
        totalLines: 0,
        linesEmptyReason: null,
        type: "Factory",
        workers: 3314,
        workersCoverage: "on the supplier record",
        workersSecondShort: "3,166 RSC",
        workersSecond: "3,166 workers · RSC inspection",
        sanctioned: false,
        supplierId: "id-aboni",
        recordHref: "/app/discover?record=aboni",
      },
      TODAY,
      "/app/suppliers/aboni",
    );
    assert.equal(r.workers, "3,314");
    assert.deepEqual(r.workersSecond, { short: "3,166 RSC", words: "3,166 workers · RSC inspection" });
    assert.equal(r.cert?.text, "WRAP expired 29 Sep 2026");
    assert.equal(r.paneHref, "/app/discover?record=aboni");
    assert.equal(r.pageHref, "/app/suppliers/aboni");
  });
});

describe("the results table", () => {
  const out = plain(h(SelectionProvider, { pageIds: rows.map((r) => r.supplierId) }, h(ResultsTable, { rows, sort: { key: "sources", dir: "desc" }, sortHrefs })));

  it("is a real table with Paper's columns, the sorted one marked, and the name opens the record in the pane", () => {
    assert.match(out, /<table/);
    for (const col of ["Supplier", "Type", "Location", "Workers", "Sources", "Certificates"]) assert.ok(out.includes(`>${col}`), col);
    assert.match(out, /aria-sort="descending"/);
    assert.match(out, /href="\/app\/discover\?q=knit&sort=workers"/, "Workers sorts the search");
    assert.equal(hrefOf(out, "Aboni Knitwear Ltd."), "/app/discover?q=knit&record=aboni-knitwear");
    assert.ok(out.includes('data-open="record"'));
    assert.ok(out.includes('aria-label="Select Aboni Knitwear Ltd."'), "the box names its row");
    assert.ok(out.includes('aria-label="Select all on this page"'));
  });

  it("the 100-character name is whole, and nothing is cut off", () => {
    assert.ok(out.includes(ZAHEEN));
    assert.ok(!/\btruncate\b|text-ellipsis|line-clamp/.test(out));
  });

  it("the first certificate problem is words with a glyph, 'No certificates found' is its own line", () => {
    assert.ok(out.includes("WRAP expired 29 Sep 2026") && out.includes("· 3 more certificates"));
    assert.ok(out.includes("WRAP valid until 8 Jan 2027"));
    assert.ok(out.includes("No certificates found"));
  });

  it("a sanctioned supplier says so in words on its row, and keeps its place", () => {
    const sanctioned = plain(h(SelectionProvider, { pageIds: ["x"] }, h(ResultsTable, { rows: [row({ name: "Sample Garments Ltd", slug: "sample", supplierId: "x", sanctioned: true })], sort: { key: "workers", dir: "asc" }, sortHrefs })));
    assert.match(sanctioned, /On the sanctions list/);
    assert.match(sanctioned, /Sample Garments Ltd/);
  });

  it("two worker figures stay two: the record's own and the other beside it, with its source in the title", () => {
    const two = plain(h(ResultsTable, { rows: [row({ workers: "3,314", workersSecond: { short: "3,166 RSC", words: "3,166 workers · RSC inspection" } })], sort: { key: "sources", dir: "desc" }, sortHrefs }));
    assert.ok(two.includes("3,314") && two.includes("3,166 RSC") && two.includes('title="3,166 workers · RSC inspection"'));
  });
});

describe("the row keys", () => {
  type Fake = { tagName: string; focused: boolean; clicked: string[]; focus(): void; parentElement: unknown; querySelector(sel: string): { click(): void } | null };
  const make = (n: number): Fake[] => {
    const list: Fake[] = [];
    const parent = { querySelectorAll: () => list };
    for (let i = 0; i < n; i++) {
      const r: Fake = {
        tagName: "TR",
        focused: false,
        clicked: [],
        focus() {
          this.focused = true;
        },
        parentElement: parent,
        querySelector(sel) {
          return { click: () => r.clicked.push(sel) };
        },
      };
      list.push(r);
    }
    return list;
  };
  const press = (key: string, target: unknown, mod: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => {
    let prevented = false;
    onRowKey({ key, target, metaKey: false, ctrlKey: false, altKey: false, ...mod, preventDefault: () => (prevented = true) });
    return prevented;
  };

  it("arrows and j/k move between rows, Enter opens the record, Space ticks the box", () => {
    const [a, b, c] = make(3) as [Fake, Fake, Fake];
    assert.equal(press("ArrowDown", a), true);
    assert.ok(b.focused);
    press("j", b);
    assert.ok(c.focused);
    c.focused = false;
    press("ArrowUp", c);
    assert.ok(b.focused);
    press("Enter", a);
    assert.deepEqual(a.clicked, ['a[data-open="record"]']);
    press(" ", a);
    assert.deepEqual(a.clicked, ['a[data-open="record"]', 'input[type="checkbox"]:not(:disabled)']);
  });

  it("a modified key, or a key pressed inside a link or a box, is left alone", () => {
    const [a] = make(1) as [Fake];
    assert.equal(press("ArrowDown", a, { ctrlKey: true }), false);
    assert.equal(press("Enter", { ...a, tagName: "A" }), false);
    assert.equal(press("x", a), false);
  });
});

describe("the bar over the table", () => {
  const toolbar = h("p", null, "THE-FILTER-BAR");
  const bar = (selected: string[]) => {
    const set = new Set(selected);
    const ids = rows.map((r) => r.supplierId!);
    const value = selectionValue(set, ids, () => {}, 0, () => {});
    return plain(h(SelectionContext.Provider, { value }, h(ResultsBar, { toolbar, exportHref: "/api/v1/discover/export?q=knit", searchHref: "/app/discover?q=knit", pageSize: 3 })));
  };

  it("shows the filter bar until something is ticked, then the bulk bar replaces it", () => {
    assert.ok(bar([]).includes("THE-FILTER-BAR"));
    const three = bar(["id-aboni", "id-zaheen"]);
    assert.ok(!three.includes("THE-FILTER-BAR"));
    assert.ok(three.includes("2 suppliers selected"));
    assert.ok(three.includes("Select all 3 on this page"));
    assert.ok(three.includes(">Save<") && three.includes("Download CSV"));
    assert.ok(three.includes('aria-label="Clear selection"'));
  });

  it("Send RFQ names how many, and opens the composer on this search with every ticked supplier", () => {
    const two = bar(["id-aboni", "id-zaheen"]);
    assert.equal(hrefOf(two, "Send RFQ to 2 suppliers"), "/app/discover?q=knit&rfq=id-aboni,id-zaheen");
    assert.equal(bulkRfqHref("/app/discover", ["a", "b"]), "/app/discover?rfq=a,b");
    assert.ok(bar(["id-aboni"]).includes("1 supplier selected") && bar(["id-aboni"]).includes("Send RFQ to 1 supplier<"));
  });

  it("more than one RFQ can take: the action is refused in words, not hidden", () => {
    const many = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const value = selectionValue(new Set(many), many, () => {}, 0, () => {});
    const out = plain(h(SelectionContext.Provider, { value }, h(ResultsBar, { toolbar, exportHref: "#", searchHref: "/app/discover", pageSize: 51 })));
    assert.ok(out.includes(TOO_MANY));
    assert.match(out, /aria-disabled="true"[^>]*>Send RFQ to 51 suppliers/);
    assert.ok(!/href="\/app\/discover\?rfq=/.test(out));
  });
});

describe("the bar over the results", () => {
  const state = { ...EMPTY_STATE, q: "knit" };
  const hrefFor = () => "/app/discover?q=knit";
  const bar = plain(h(ResultsToolbar, { state, title: "knit · 4,645 suppliers", hrefFor, filtersHref: "/app/discover?q=knit&filters=1", filtersOpen: false, saveHref: "/app/discover?q=knit&save=1", more: h("i", null, "MORE") }));

  it("the title carries the query and the count; Certificates and Location are menus; the query is not also a chip", () => {
    assert.equal(resultsTitle("knit", 4645), "knit · 4,645 suppliers");
    assert.equal(resultsTitle("", 1), "1 supplier");
    assert.equal(resultsTitle("knit", null), "knit");
    assert.ok(bar.includes("knit · 4,645 suppliers"));
    assert.ok(bar.includes(">Certificates<") && bar.includes(">Location<"));
    assert.ok(!bar.includes("Remove knit"));
  });

  it("a set filter fills its menu and says its value; other families join the bar only once set", () => {
    assert.deepEqual(barMenus(state).map((m) => m.key), ["certificate", "place"]);
    const withHs = { ...state, hs: ["6105"], district: ["Gazipur"] };
    assert.deepEqual(barMenus(withHs).map((m) => m.key), ["product", "certificate", "place"]);
    const set = plain(h(ResultsToolbar, { state: { ...state, cert: [{ kind: "sa8000" as const, state: "valid" as const }] }, title: "t", hrefFor, filtersHref: "#", filtersOpen: false, saveHref: "#", more: null }));
    assert.ok(set.includes("Certificates: SA8000") && set.includes("bg-brand-tint"));
    assert.ok(!set.includes("Remove Certificate"), "a certificate a menu holds is not drawn twice");
  });

  it("sanctioned suppliers are held back in words, with the way to lift it", () => {
    assert.ok(bar.includes("Hiding sanctioned suppliers") && bar.includes("Show them"));
    const shown = plain(h(ResultsToolbar, { state: { ...state, sanctioned: true }, title: "t", hrefFor: (s: { sanctioned: boolean }) => (s.sanctioned ? "X" : "Y"), filtersHref: "#", filtersOpen: false, saveHref: "#", more: null }));
    assert.ok(!shown.includes("Hiding sanctioned suppliers"));
  });

  it("Save search, Sort, Filters and More are on the right; Filters names how many are on", () => {
    assert.ok(bar.includes("Save search") && bar.includes("Sort: most sources") && bar.includes(">MORE<"));
    assert.match(bar, /aria-label="Filters, 1 on"/, "the query counts as the one filter that is on");
    assert.match(plain(h(ResultsToolbar, { state: EMPTY_STATE, title: "t", hrefFor, filtersHref: "#", filtersOpen: false, saveHref: "#", more: null })), /aria-label="Filters"/);
    const on = plain(h(ResultsToolbar, { state: { ...state, hs: ["6105"] }, title: "t", hrefFor, filtersHref: "#", filtersOpen: false, saveHref: "#", more: null }));
    assert.match(on, /aria-label="Filters, 2 on"/);
  });

  it("when nothing matches, or the search failed, there is nothing to save, sort or download: the filters alone", () => {
    const bare = plain(h(ResultsToolbar, { state, title: "knit · 0 suppliers", hrefFor, filtersHref: "#", filtersOpen: false, saveHref: "#", more: h("i", null, "MORE"), bare: true }));
    assert.ok(bare.includes("Add filter") && bare.includes("Hiding sanctioned suppliers"));
    assert.ok(!bare.includes("Save search") && !bare.includes("Sort:") && !bare.includes("MORE"));
  });

  it("beside a pane the bar is the title with Filters and Sort", () => {
    const narrow = plain(h(PaneListToolbar, { state: { ...state, cert: [{ kind: "wrap" as const, state: "valid" as const }] }, title: "knit · 4,645 suppliers", hrefFor, filtersHref: "#" }));
    assert.ok(narrow.includes("Filters · 2 on") && narrow.includes("Sort: most sources"));
  });

  it("a phone's bar is a 48-tall field with its ×, the count, and two 44-tall halves", () => {
    const phone = plain(h(PhoneToolbar, { state: { ...state, per: 50 as const }, count: "4,645 suppliers", hrefFor, filtersHref: "#" }));
    assert.match(phone, /role="search"/);
    assert.ok(phone.includes('value="knit"') && phone.includes('aria-label="Clear the search"'));
    assert.match(phone, /<input[^>]*role="combobox"[^>]*aria-expanded="false"/, "a combobox, closed until the buyer types or focuses it");
    assert.match(phone, /type="hidden" name="per" value="50"/, "the field carries the other filters");
    assert.ok(!/name="q" value=/.test(phone.replace('name="q" value="knit"', "")), "the query is the field, not also a hidden input");
    assert.ok(phone.includes("4,645 suppliers") && phone.includes("Sort: most sources") && phone.includes("Hiding sanctioned suppliers"));
    assert.match(phone, /h-input-touch/);
    assert.match(phone, /h-touch/);
  });

  it("every bar is one line: nothing in it may wrap, however many filters are on", () => {
    const busy = { ...state, hs: ["6105", "6109"], cert: [{ kind: "gots" as const, state: "valid" as const }], district: ["Gazipur"] };
    const props = { state: busy, title: "t", hrefFor, filtersHref: "#" };
    const full = plain(h(ResultsToolbar, { ...props, filtersOpen: false, saveHref: "#", more: null }));
    for (const out of [full, plain(h(PaneListToolbar, props)), plain(h(PhoneToolbar, { ...props, count: "t" }))]) assert.ok(!out.includes("flex-wrap"), "a bar that wraps breaks into two lines");
    assert.match(full, /overflow-x-auto/, "the filters scroll sideways when they outgrow the bar");
    assert.match(full, /sr-only">Save search</, "Save search keeps its name when it is drawn as its icon");
  });
});

describe("the narrow list and the phone's rows", () => {
  it("while loading, the table's column head is the desktop's alone; a phone waits on its own rows", () => {
    const out = plain(h(ResultsSkeleton, { title: "knit" }));
    const head = /<div[^>]*>(?=<span[^>]*>Supplier<)/.exec(out)![0];
    assert.match(head, /max-md:hidden/, "a phone shows the desktop's column head over its skeleton");
    assert.match(out, /<div class="md:hidden" aria-hidden="true">/, "a phone has no skeleton rows of its own");
  });

  it("beside a pane: name, type and place, the first certificate problem, the count; the open row is marked", () => {
    const out = plain(h(PaneRows, { rows, currentSlug: "aboni-knitwear" }));
    assert.ok(out.includes("Aboni Knitwear Ltd.") && out.includes("11 sources") && out.includes("Factory · Dhaka"));
    assert.match(out, /aria-current="true"[^>]*href="\/app\/discover\?q=knit&record=aboni-knitwear"|href="\/app\/discover\?q=knit&record=aboni-knitwear"[^>]*aria-current="true"/);
    assert.ok(out.includes(ZAHEEN) && out.includes("No certificates found"));
  });

  it("on a phone a row opens the record as a page, and the way back is in the address", () => {
    const out = plain(h(PhoneRows, { rows }));
    assert.ok(out.includes('href="/app/suppliers/aboni-knitwear?back=%2Fapp%2Fdiscover%3Fq%3Dknit"'));
    assert.ok(out.includes("Factory · Dhaka · 11 sources"));
  });
});

describe("when a search ends in nothing", () => {
  const state = { ...EMPTY_STATE, q: "knit", cert: [{ kind: "sa8000" as const, state: "valid" as const }], district: ["Gazipur"] };

  it("names the filter to remove and how many that finds, offers to clear, and to save", () => {
    const out = plain(h(ResultsEmpty, { state, explain: [{ dropped: "district", remaining: 1 }, { dropped: "cert", remaining: 0 }], clearHref: "/app/discover", saveHref: "/app/discover?save=1" }));
    assert.ok(out.includes("No suppliers match these filters."));
    assert.ok(out.includes("Without Gazipur, 1 supplier matches."));
    assert.match(out, />Remove Gazipur · show 1 supplier</);
    assert.match(out, /href="\/app\/discover">Clear all filters/);
    assert.match(out, /href="\/app\/discover\?save=1">save this search/);
    assert.ok(!out.includes("Remove Certificate"), "dropping a filter that finds nothing is no suggestion");
  });

  it("the words of a family are its chips'", () => {
    assert.equal(familyWords(state, "district"), "Gazipur");
    assert.equal(familyWords(state, "cert"), "Certificate · SA8000, valid");
    assert.equal(familyWords(state, "nothing"), null);
  });

  it("a search that failed keeps the filters and offers the same address again", () => {
    const out = plain(h(ResultsError, { failure: "busy", retryHref: "/app/discover?q=knit" }));
    assert.ok(out.includes("We couldn't load suppliers.") && out.includes("Your filters are kept."));
    assert.match(out, /role="alert"/);
    assert.match(out, /href="\/app\/discover\?q=knit"[^>]*>Try again/);
  });
});

describe("needs attention", () => {
  const exp = { total: 5, rows: [{ kind: "wrap", certificate_no: "7865", expires_on: "2026-09-29", supplier: { id: "a", slug: "aboni", company_name: "Aboni Knitwear Ltd." } }] };
  const soon = { total: 3, rows: [{ kind: "gots", certificate_no: "GOTS-26992", expires_on: "2026-10-08", supplier: { id: "m", slug: "mondol", company_name: "Mondol Intimates Ltd." } }, { kind: "gots", certificate_no: null, expires_on: "2026-10-03", supplier: { id: "n", slug: "n", company_name: "N Ltd" } }] };

  it("one total, one list: the heading, the rows and the 'see all' link cannot disagree", () => {
    const a = attentionOf(exp, soon, TODAY, 3)!;
    assert.equal(a.total, 8);
    assert.deepEqual(a.rows.map((r) => r.what), ["WRAP 7865 expired 29 Sep 2026.", "GOTS-26992 expires in 5 days, 8 Oct 2026.", "GOTS expires today, 3 Oct 2026."]);
    assert.equal(a.rows[0]!.note, "No renewal on file.");
    assert.equal(a.rows[1]!.note, undefined);
    assert.deepEqual(attentionWords(8), { heading: "Needs attention · 8", seeAll: "See all 8 certificates" });
    assert.equal(attentionWords(1).seeAll, "See all 1 certificate");
    assert.equal(attentionOf(exp, soon, TODAY, 1)!.rows.length, 1, "the list is cut, the total is not");
  });

  it("a read that failed is not zero", () => {
    assert.equal(attentionOf(null, null, TODAY), null);
    assert.equal(attentionOf(null, soon, TODAY)!.total, 3);
    assert.equal(attentionOf({ total: 0, rows: [] }, { total: 0, rows: [] }, TODAY)!.total, 0);
  });

  it("the ask goes through an RFQ, the one channel a supplier answers on", () => {
    assert.equal(attentionOf(exp, null, TODAY)!.rows[0]!.askHref, "/app/rfqs/new?supplier=a");
    assert.equal(certName("gots", "GOTS-26992"), "GOTS-26992");
    assert.equal(certName("wrap", "7865"), "WRAP 7865");
    assert.equal(certName("wrap", null), "WRAP");
  });

  it("the loader asks both RPCs and survives one failing", async () => {
    const calls: string[] = [];
    const supabase = {
      rpc: async (fn: string) => {
        calls.push(fn);
        return fn === "compliance_expired_certs" ? { data: null, error: { message: "x" } } : { data: soon, error: null };
      },
    };
    const a = await loadNeedsAttention(supabase, TODAY);
    assert.deepEqual(calls.sort(), ["compliance_expired_certs", "compliance_expiring_certs"]);
    assert.equal(a!.total, 3);
    assert.equal(await loadNeedsAttention({ rpc: async () => { throw new Error("down"); } }, TODAY), null);
  });
});

describe("the landing", () => {
  const attention = attentionOf({ total: 1, rows: [{ kind: "wrap", certificate_no: "7865", expires_on: "2026-09-29", supplier: { id: "a", slug: "aboni", company_name: "Aboni Knitwear Ltd." } }] }, { total: 7, rows: [] }, TODAY)!;
  const out = plain(h(SearchLanding, { published: 10268, attention, counts: Promise.resolve({}), saved: Promise.resolve([]) }));

  it("is search first: one heading, the published count, the filter menus, the common searches, then the work queue", () => {
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.ok(out.includes("10,268 suppliers") && out.includes("every fact from a named source"));
    assert.ok(out.includes("Products exported") && out.includes("Company type") && out.includes("Hiding sanctioned suppliers"));
    assert.match(out, /aria-label="Common searches"/);
    assert.ok(out.includes("GOTS-certified knitwear"));
    assert.ok(out.indexOf('role="search"') < out.indexOf("Needs attention · 8"), "the field comes before the work queue");
    assert.ok(out.includes("See all 8 certificates"));
    assert.match(out, /href="\/app\/rfqs\/new\?supplier=a"[^>]*>Ask for the new certificate/);
  });

  it("lists no supplier before the buyer searches, and draws its one field at every width, the one Ctrl K reaches", () => {
    assert.doesNotMatch(out, /<table|data-row="result"/);
    // Founder's walkthrough, 6 Oct 2026: the field was md:hidden while the topbar stepped its
    // own aside on this page, so a desktop had no search field at all.
    const form = out.match(/<form[^>]*role="search"[^>]*>/)?.[0] ?? "";
    assert.ok(form, "the page draws a search form");
    assert.doesNotMatch(form, /\bhidden\b/);
    assert.equal(out.match(/data-search="topbar"/g)?.length, 1, "exactly one field carries the shortcut target");
    assert.match(out, /<input[^>]*role="combobox"[^>]*aria-controls=/, "the field suggests as it is typed");
    assert.match(out, /<button[^>]*type="submit"[^>]*>Search<\/button>/);
  });

  it("a recent search is kept once, whatever order or page it was run at", () => {
    const label = "HS 6110 · Sanctioned hidden";
    const byWorkers = { label, href: "/app/discover?hs=6110&sort=workers", count: 1777 };
    const bySources = { label, href: "/app/discover?hs=6110", count: 1777 };
    const other = { label: "Shirt · Sanctioned hidden", href: "/app/discover?q=shirt", count: 1403 };
    const list = pushRecent(pushRecent(pushRecent([], byWorkers), other), bySources);
    assert.deepEqual(list.map((r) => r.href), [bySources.href, other.href]);
  });

  it("the common searches' counts are read a few at a time, in order", async () => {
    let live = 0;
    let peak = 0;
    const got = await mapLimited([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, async (n) => {
      peak = Math.max(peak, ++live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return n * 10;
    });
    assert.equal(peak, 3);
    assert.deepEqual(got, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    assert.deepEqual(await mapLimited([], 3, async () => 1), []);
  });

  it("a plain click on a link starts the loading bar; a new-tab click does not", () => {
    const link = (href: string, target: string | null = null) => ({ closest: () => ({ getAttribute: (n: string) => (n === "href" ? href : target) }) });
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    const here = "https://app.example/app";
    assert.equal(startsNavigation({ ...click, target: link("/app/discover?hs=6110") }, here), true);
    assert.equal(startsNavigation({ ...click, ctrlKey: true, target: link("/app/discover") }, here), false);
    assert.equal(startsNavigation({ ...click, target: link("/app/discover", "_blank") }, here), false);
    assert.equal(startsNavigation({ ...click, target: { closest: () => null } }, here), false);
    // "Try again" is this page: the pathname never changes, so the bar would never come down.
    assert.equal(startsNavigation({ ...click, target: link("/app") }, here), false);
    assert.equal(startsNavigation({ ...click, target: link("https://global-standards.org/x") }, here), false);
  });

  it("an unread certificate check says so with a way to try again; it does not say nothing needs attention", () => {
    const failed = plain(h(SearchLanding, { published: null, attention: null, counts: Promise.resolve({}), saved: Promise.resolve(null) }));
    assert.ok(failed.includes("We couldn't load the certificate checks.") && failed.includes("Try again"));
    assert.ok(!failed.includes("Nothing needs attention"));
    assert.ok(failed.includes("Every published supplier"));
  });
});

describe("the filter pane's draft (B4b)", () => {
  const at = (qs: string) => parseDiscoverState(new URLSearchParams(qs));
  const SEARCH = "q=knit&cert=gots:valid,wrap:valid&district=Gazipur&city=Savar&type=factory&hs=6105,6109&reg=BGMEA,EPB&brand=hm&workers_min=500&workers_max=2000&est_from=1990&min_sources=3&rsc=active&sanctioned=1&sort=workers";

  it("a draft that was not touched is the search it started as, so Show N suppliers opens what the count counted", () => {
    const state = at(SEARCH);
    assert.deepEqual(searchOf(state, formOf(state)), { ...state, page: 1 });
    assert.equal(countKey(searchOf(state, formOf(state))), countKey(state));
  });

  it("the page and the sort do not change the count's key, a filter does", () => {
    const state = at("q=knit&reg=BGMEA&page=3&sort=workers");
    assert.equal(countKey(state), countKey(at("q=knit&reg=BGMEA")));
    assert.notEqual(countKey(state), countKey(at("q=knit&reg=BKMEA")));
    assert.notEqual(countKey(state), countKey(at("q=knit&reg=BGMEA&sanctioned=1")));
  });

  it("Clear all drops every filter and keeps the query, the sort and the standing filter", () => {
    const state = at(SEARCH);
    const cleared = searchOf(state, clearedForm());
    assert.equal(cleared.q, "knit");
    assert.equal(cleared.sort, "workers");
    assert.equal(cleared.sanctioned, false, "sanctioned suppliers are held back again");
    for (const k of ["hs", "cert", "reg", "brand", "district", "city", "type"] as const) assert.deepEqual(cleared[k], [], k);
    for (const k of ["minSources", "rsc", "estFrom", "estTo", "workersMin", "workersMax"] as const) assert.equal(cleared[k], null, k);
  });

  it("a status with no certificate ticked applies to nothing; with one, to all that are", () => {
    const base = at("q=knit");
    assert.deepEqual(searchOf(base, { ...clearedForm(), certState: "expired" }).cert, []);
    assert.deepEqual(searchOf(base, { ...clearedForm(), cert: ["wrap", "gots"], certState: "expired" }).cert, [
      { kind: "gots", state: "expired" },
      { kind: "wrap", state: "expired" },
    ]);
  });

  it("a lapsed RSC filter in the address is kept until the switch is touched", () => {
    const state = at("rsc=lapsed");
    assert.equal(searchOf(state, formOf(state)).rsc, "lapsed");
    assert.equal(searchOf(state, { ...formOf(state), rsc: true, rscLapsed: false }).rsc, "active");
    assert.equal(searchOf(state, { ...formOf(state), rscLapsed: false }).rsc, null);
  });

  it("every typed value goes through the address's own parser: a number is clamped, a heading cut to four digits, a stranger dropped", () => {
    const state = searchOf(at("q=knit"), { ...clearedForm(), hs: "61051, abc, 6109", workersMin: "0", estFrom: "1700", reg: ["BGMEA", "NOPE"], minSources: "9" });
    assert.deepEqual(state.hs, ["6105", "6109"]);
    assert.equal(state.workersMin, 1);
    assert.equal(state.estFrom, 1900);
    assert.deepEqual(state.reg, ["BGMEA"]);
    assert.equal(state.minSources, 5);
  });

  it("the button says how many, in the singular for one, and nothing invented when the count could not be read", () => {
    assert.equal(showLabel(71), "Show 71 suppliers");
    assert.equal(showLabel(4645), "Show 4,645 suppliers");
    assert.equal(showLabel(1), "Show 1 supplier");
    assert.equal(showLabel(0), "Show 0 suppliers");
    assert.equal(showLabel(null), "Show suppliers");
  });

  it("a group's words are what a phone row prints under its name, and the groups that are set are the ones that open", () => {
    const f = formOf(at(SEARCH));
    assert.equal(summaryOf(f, "cert"), "GOTS, WRAP · valid");
    assert.equal(summaryOf(f, "place"), "Gazipur, Savar");
    assert.equal(summaryOf(f, "type"), "Factory");
    assert.equal(summaryOf(f, "hs"), "HS 6105, HS 6109");
    assert.equal(summaryOf(f, "reg"), "BGMEA, EPB");
    assert.equal(summaryOf(f, "brand"), "H&M");
    assert.equal(summaryOf(f, "size"), "500–2000 workers · founded from 1990");
    assert.equal(summaryOf(f, "sources"), "At least 3");
    assert.deepEqual(groupsSet(at("q=knit&cert=gots&district=Gazipur")), ["cert", "place"]);
    assert.deepEqual(groupsSet(at("q=knit")), []);
  });

  it("the chips are the filters that are on, one each, and the query and the standing filter are not among them", () => {
    const chips = appliedChips(at("q=knit&cert=gots&district=Gazipur&reg=BGMEA"));
    assert.deepEqual(chips.map((c) => c.label), ["Certificate: GOTS", "Location: Gazipur", "Member of: BGMEA"]);
    const without = chips.find((c) => c.key === "place")!.without;
    assert.deepEqual(without.district, []);
    assert.equal(without.q, "knit");
    assert.deepEqual(without.cert, [{ kind: "gots", state: "any" }]);
    assert.deepEqual(appliedChips(at("q=knit")), []);
  });
});

describe("the filter pane (B4b)", () => {
  const state = parseDiscoverState(new URLSearchParams("q=knit&cert=gots&district=Gazipur"));
  const pane = (s = state, count: number | null = 71) => plain(h(FilterPane, { state: s, count, closeHref: "/app/discover?q=knit&cert=gots&district=Gazipur" }));

  it("opens each group the search sets, with the count on the button and the chips beside", () => {
    const out = pane();
    assert.match(out, /<form aria-label="Filters"/);
    assert.match(out, /Show 71 suppliers/);
    assert.match(out, /Certificate: GOTS/);
    assert.match(out, /Location: Gazipur/);
    // Certificates and Location are set, so their controls are on the page; Company type is not.
    assert.match(out, /<input\b(?=[^>]*\sname="cert")(?=[^>]*\svalue="gots")(?=[^>]*\schecked="")[^>]*>/);
    assert.match(out, /aria-expanded="true"[^>]*>[\s\S]*?Certificates/);
    assert.ok(!out.includes('name="type"'), "a group nothing set opens closed");
  });

  it("every chip's × and Show them keep the pane open and the search's query", () => {
    const out = pane();
    for (const label of ["Certificate: GOTS", "Location: Gazipur"]) {
      const m = new RegExp(`aria-label="Remove ${label}"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*aria-label="Remove ${label}"`).exec(out);
      const to = (m?.[1] ?? m?.[2] ?? "").replace(/&amp;/g, "&");
      assert.match(to, /q=knit/, label);
      assert.match(to, /filters=1/, label);
    }
    const show = hrefOf(out, "Show them") ?? "";
    assert.match(show.replace(/&amp;/g, "&"), /sanctioned=1/);
    assert.match(show.replace(/&amp;/g, "&"), /filters=1/);
    assert.ok(!/Show them/.test(pane({ ...state, sanctioned: true })), "nothing is held back, so nothing to show");
  });

  it("says Show suppliers, with no number, when the count could not be read", () => {
    assert.match(pane(state, null), /Show suppliers</);
  });

  it("holds no score and no contact field", () => {
    const out = pane();
    for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) assert.ok(!out.includes(key), key);
  });
});

// The new pieces' own rules, read from their source.
const dir = path.join(process.cwd(), "components", "search");
const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => [f, readFileSync(path.join(dir, f), "utf8")] as const);

describe("the search components' rules", () => {
  it("have no typed colour, no cut-off text and no score, and import nothing from the old kit", () => {
    assert.ok(sources.length >= 12);
    for (const [file, src] of sources) {
      const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), `${file}: a typed hex colour`);
      assert.ok(!/\btruncate\b|text-ellipsis|line-clamp/.test(code), `${file}: text cut off`);
      assert.ok(!/\b(score|grade|rating|stars?)\b/i.test(code.replace(/"[^"]*"/g, "")), `${file}: a score-like value`);
      const old = [...src.matchAll(/from "@\/components\/(ui|dashboard)\/([^"]+)"/g)].map((m) => `${m[1]}/${m[2]}`);
      // The behaviour modules the old kit held (where the recent searches are kept, where focus returns to) now live here.
      assert.deepEqual(old, [], `${file} imports the old kit: ${old.join(", ")}`);
    }
  });

  it("the landing and the results hold no result cards (D-7)", () => {
    for (const [file, src] of sources) assert.ok(!/SupplierResultCard|view=cards|supplier-result-card/.test(src), `${file}: cards are dropped`);
    const page = readFileSync(path.join(process.cwd(), "app", "(app)", "app", "discover", "page.tsx"), "utf8");
    assert.ok(!/SupplierResultCard|supplier-result-card/.test(page));
  });
});
