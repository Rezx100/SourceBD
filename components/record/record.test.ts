// The supplier record on the v4 kit (B4c): what a buyer, a keyboard and a screen reader meet in
// the pane and on the full page. The route tests (`app/(app)/app/record-routes.test.ts`) cover
// the boundary; these cover the view's own rules from the real fixtures: the tabs are links, a
// sanctioned record is refused in words and never in a greyed button, a missing figure is a
// sentence and never a zero, a long name is never cut, and no contact value or score exists.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildSheet } from "@/lib/dashboard/build-models";
import { TODAY, aboniInput, arFashionInput, longestNameInput, sanctionedInput, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import type { ContactDetailsRead, LocationRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { onFileWords, rankCerts } from "@/components/patterns";
import { GLOSSARY, define } from "@/lib/dashboard/glossary";
import { tierWords } from "@/lib/dashboard/source-tiers";
import { mailHref, siteHref, telHref } from "@/components/record/contact-card";
import { RecordView } from "@/components/record/record-view";
import { TABS, certRows, keyFacts, needsLook, parseSite, parseTab, recordSubline, sameName, sectionInView, siteCards, siteSummary, staleWords, summaryCells, tabCount } from "@/components/record/words";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const model = (input = aboniInput(), over: Partial<SupplierSheetModel> = {}): SupplierSheetModel => ({
  ...buildSheet(input, { supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", closeHref: "/app/discover?q=knit", contactCounts: { emails: 1, phones: 6, website: true, representatives: 1 } }),
  ...over,
});
const tabHref = (t: string) => `/app/discover?q=knit&record=x${t === "overview" ? "" : `&tab=${t}`}`;
type ViewProps = { mode?: "pane" | "page"; tab?: (typeof TABS)[number]["id"]; backHref?: string | null };
const both = (m: SupplierSheetModel, props: ViewProps = {}) =>
  renderToStaticMarkup(h(RecordView, { model: m, mode: props.mode ?? "pane", tab: props.tab ?? "overview", tabHref, today: TODAY, backHref: props.backHref === undefined ? "/app/discover?q=knit" : props.backHref }));
// A phone's record (`PhoneRecord`, Paper page 35) is a second drawing of the same model, beside the desktop's and
// hidden from 640. `view` is the record without it, so "said once" means once on the screen a reader has; `phone`
// is that drawing alone. The action bar after it belongs to both.
const PHONE = /<div data-record-phone=""[\s\S]*?(?=<div data-record-actions="")/;
const view = (m: SupplierSheetModel, props: ViewProps = {}) => both(m, props).replace(PHONE, "");
const phone = (m: SupplierSheetModel, props: ViewProps = {}) => PHONE.exec(both(m, props))?.[0] ?? "";

describe("the record on a phone never pans sideways (founder, 11 Oct 2026)", () => {
  it("clips its width and wraps a long value, in the pane and on the page, without becoming a scroller of its own", () => {
    for (const mode of ["pane", "page"] as const) {
      const root = /<section aria-label="Supplier record"[^>]*class="([^"]*)"/.exec(view(model(), { mode }))?.[1] ?? "";
      for (const c of ["min-w-0", "overflow-x-clip", "[overflow-wrap:break-word]"]) assert.ok(root.split(" ").includes(c), `${mode}: ${c}`);
      // `hidden` or `auto` would make the record the sticky tabs' scroller, and they would stop sticking.
      assert.ok(!/\boverflow-(x-|y-)?(hidden|auto|scroll)\b/.test(root), `${mode}: ${root}`);
    }
  });
});

describe("the record on a phone (Paper page 35, the supplier drawer)", () => {
  const VOLZA: NonNullable<SupplierSheetModel["volza"]> = {
    shipments: 406, fob_usd: 21698439.68, buyers: 43, window_start: "2024-09-01", window_end: "2026-08-31", volza_name: "Hamza Clothing Ltd.", fetched_at: "2026-09-17T21:33:30+00:00", top_shipments: [],
    markets: { EU: { shipments: 236, fob_usd: 15553268.46, buyers: 10, top: null }, "United States": { shipments: 100, fob_usd: 4965812.04, buyers: 11, top: null } },
    small_orders: { under_pcs: 1000, shipments: 26, of: 406 },
  };
  const LISTS = [
    { list: "ofac_sdn", last_read: "2026-09-17T02:10:00Z" },
    { list: "eu_sanctions", last_read: "2026-09-12T02:30:00Z" },
    { list: "uflpa", last_read: "2026-09-08T02:40:00Z" },
    { list: "us_wro", last_read: null },
  ];

  it("draws every section on the one page in tab order, every tab a link, and the three statuses jump to their sections", () => {
    // Founder, 12 Oct 2026: one tab's view at a time sent the reader back to the strip for each section.
    const out = plain(phone(model(), { mode: "page" }));
    assert.deepEqual([...out.matchAll(/data-phone-panel="([a-z]+)"/g)].map((m) => m[1]), TABS.map((t) => t.id));
    assert.doesNotMatch(out, /data-phone-panel="[a-z]+"[^>]* hidden=""/, "a section is hidden until its tab is tapped");
    // Each lands under the bar, the short statuses and the strip (56 + 42 + 48, less the 12px gap over it), and the foot marks the last tab.
    assert.equal((out.match(/data-phone-panel="[a-z]+" class="[^"]*scroll-mt-\[134px\]/g) ?? []).length, TABS.length);
    // What parts two sections is a gap of the page's ground between hairlines, not a solid grey bar (founder, 12 Oct 2026).
    const panels = /<div data-phone-panels="" class="([^"]*)"/.exec(out)![1]!.replace(/&gt;/g, ">");
    for (const c of ["[&>*+*]:before:h-3", "[&>*+*]:before:border-y", "[&>*+*]:before:border-line", "[&>*+*]:before:bg-subtle"]) assert.ok(panels.split(" ").includes(c), `the divider lacks ${c}`);
    assert.doesNotMatch(panels, /border-t-8|border-sunken/);
    // Contact is the last card of the scroll, after Products, and no longer part of the Overview (founder, 12 Oct 2026).
    assert.match(out, /data-phone-panel="products"[\s\S]*<section aria-label="Contact" data-phone-contact=""[\s\S]*<\/section><\/div><div data-phone-end=""/);
    assert.doesNotMatch(/data-phone-panel="overview"[\s\S]*?data-phone-panel="exports"/.exec(out)![0], />Contact</);
    assert.match(out, /<div data-phone-end="" aria-hidden="true"><\/div><\/div>$/);
    const tabsSrc = readFileSync(path.join(dir, "phone-tabs.tsx"), "utf8");
    assert.match(tabsSrc, /sectionInView\(ORDER, inBand, atEnd, prev\)/, "the strip does not follow the scroll");
    // A tapped tab keeps its mark until the reader moves the page (a short last section never reaches the band),
    // and a reader the browser brought back to their place is not thrown to the section's top.
    assert.match(tabsSrc, /MOVES = \["touchstart", "wheel", "keydown"\]/);
    assert.doesNotMatch(tabsSrc, /scrollend|setTimeout/);
    assert.match(tabsSrc, /scrollY\) === 0\) panel\(initial\)\?\.scrollIntoView/);
    const strip = /<nav aria-label="Record sections"[^>]*>([\s\S]*?)<\/nav>/.exec(out)![1]!;
    assert.equal((strip.match(/<a /g) ?? []).length, TABS.length);
    assert.match(strip, /aria-current="page"[^>]*>Overview/);
    assert.match(strip, /href="\/app\/discover\?q=knit&record=x&tab=sources"/);
    // The statuses: a row each, pressed state and all, to Safety, Certificates and Sources.
    const summary = /<ul aria-label="Summary"[^>]*>([\s\S]*?)<\/ul>/.exec(out)![1]!;
    assert.deepEqual([...summary.matchAll(/href="[^"]*?(?:&tab=([a-z]+))?"/g)].map((m) => m[1]), ["safety", "certificates", "sources"]);
    assert.equal((summary.match(/active:bg-sunken/g) ?? []).length, 3);
    assert.match(text(summary), /Safety .* Certificates .* Sanctions Not listed/);
  });

  it("does not build the map, or repeat the desktop's anchors, until Sites is the tab shown", () => {
    assert.doesNotMatch(phone(model(), { mode: "page" }), /id="locations"|id="record-/);
    assert.match(view(model(), { mode: "page" }), /id="locations"/);
  });

  it("says there are no customs records in words the read supports, and only when it has none to show", () => {
    const none = phone(model(), { mode: "page", tab: "exports" });
    assert.match(none, /data-phone-empty="customs"/);
    assert.match(text(none), /We have no customs records for this supplier yet That says nothing about whether it exports; it only means we have no receipt to show\./);
    // The read cannot tell "never looked up" from "no match": neither is claimed, and no count is invented.
    assert.doesNotMatch(text(none), /looked it up|found no shipments|Checked so far|not checked/i);
    assert.match(text(none), /What it ships/, "the EPB export lines went with the customs records");
    // A record the reader's plan does not include is on file: the plans line says so, never "no records".
    assert.doesNotMatch(phone(model(aboniInput(), { shipments: { state: "upgrade" } }), { mode: "page" }), /data-phone-empty="customs"/);
    const held = phone(model(aboniInput(), { volza: VOLZA }), { mode: "page" });
    assert.doesNotMatch(held, /data-phone-empty="customs"/);
    assert.match(text(held), /Export value, 2 years US\$21\.7m/);
    assert.match(text(held), /Where it goes Share of export value, by market European Union 236 shipments · 10 buyers 72%/);
    assert.match(text(held), /Shipments under 1,000 pieces 6%/);
    // Customs figures are per supplier and per market: no line or code carries a share or a value.
    assert.doesNotMatch(text(held), /on the year before|Placeholder|Top 5 take/);
  });

  it("prints the UFLPA line with the list's own read date, and never that the list was not read", () => {
    const read = text(phone(model(aboniInput(), { sanctionLists: LISTS }), { mode: "page" }));
    assert.match(read, /Sanctions lists · not listed Read for every supplier, not only this one US Treasury \(OFAC\) 17 Sep European Union 12 Sep US forced labour \(UFLPA\) No link found · not a clearance · read 8 Sep/);
    // A list with no read on file is left out: nothing is said about it.
    assert.doesNotMatch(read, /not read|WRO/i);
    const unread = text(phone(model(aboniInput(), { sanctionLists: LISTS.filter((l) => l.list !== "uflpa") }), { mode: "page" }));
    assert.doesNotMatch(unread, /UFLPA|not read/i);
    assert.doesNotMatch(text(phone(model(), { mode: "page" })), /UFLPA|Sanctions lists ·/, "an unread set of lists is described");
    // A sanctioned record is never told "no link found".
    const listed = text(phone(model(sanctionedInput(), { sanctionLists: LISTS }), { mode: "page" }));
    assert.match(listed, /US forced labour \(UFLPA\) read 8 Sep/);
    assert.doesNotMatch(listed, /No link found|not listed/i);
  });

  it("says a record outside the RSC programme is not the same as unsafe, and never shows a buyer that their RFQs did not load", () => {
    const out = text(phone(model(aboniInput(), { rsc: null, rscBuildings: [], rscBuildingBlocks: [], rfqs: { count: null, rows: [], empty: "", error: true } }), { mode: "page" }));
    assert.match(out, /Not in the RSC programme .* Not the same as unsafe RSC covers factories that brands signed up\./);
    // Founder, 12 Oct 2026: a red "Your RFQs didn't load · Retry" over the record. A side read that failed is left out; it claims nothing.
    assert.doesNotMatch(out, /didn't load|did not load|Retry|Your RFQs/);
  });

  it("leaves the certifier's scope text and the amber records notice out, and lists the customs buyers once, as pills", () => {
    const m = model(aboniInput(), { volza: { ...VOLZA, window_end: "2026-05-31", top_record: { shipment_date: "2026-05-30", hsn_code: "620520", product_description: "MENS SHIRT", buyer_name: "HUGO BOSS TICINO S A VIA SANT APOLLONIA 32", destination_country: "Germany", trade_value_usd: 1000, unit_rate_usd: null, unit: "PCS" } } });
    const scoped = { ...m, certs: m.certs.map((c) => ({ ...c, scope: "Operations: Dyeing, Embroidery | Products: Greige yarn" })) };
    const out = text(phone(scoped, { mode: "page" }));
    assert.ok(scoped.certs.length > 0, "guard: a certificate");
    assert.doesNotMatch(out, /Operations: Dyeing|Greige yarn/, "a certificate card prints the scope");
    assert.doesNotMatch(out, /Shipments after that date are not counted here yet/, "the amber notice is back on Exports");
    assert.match(out, /The records end \d+ days ago/, "the footnote still says how far behind the records are");
    assert.match(out, /Buyers of 43 Hugo Boss Ticino S A As named on customs records: often an importer or an agent, not the brand\./);
    assert.doesNotMatch(out, /Buyers in shipment records/, "the buyers are said twice on one page");
    // The desktop keeps its Key facts row.
    assert.match(text(view(scoped, { mode: "page" })), /Buyers in shipment records/);
  });

  it("keeps the contact locked: how many are on file, never a value", () => {
    const out = text(phone(model(), { mode: "page" }));
    assert.match(out, /Contact 1 email on file · 6 phone numbers on file · Website on file · 1 contact person on file Locked\. Send an RFQ and the supplier replies in Messages\./);
    const unread = text(phone(model(aboniInput(), { contact: { hidden: "", plan: null, counts: null, held: null, details: null } }), { mode: "page" }));
    assert.match(unread, /Contact details are locked Send an RFQ/);
    assert.doesNotMatch(unread, /on file Locked/);
  });
});

describe("the record's tabs", () => {
  it("are six links to the same record, the open one marked, and a stranger is the Overview", () => {
    const out = view(model());
    const nav = /<nav aria-label="Record sections"[\s\S]*?<\/nav>/.exec(out)?.[0] ?? "";
    assert.deepEqual([...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]!).trim().replace(/ · \d+$/, "")), TABS.map((t) => t.label));
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(nav, /<a\b[^>]*aria-current="page"[^>]*>Overview/);
    for (const t of TABS.slice(1)) assert.ok(plain(nav).includes(`tab=${t.id}`), `no link to ${t.id}`);
    assert.equal(parseTab("nonsense"), "overview");
    assert.equal(parseTab(["safety", "x"]), "safety");
    assert.equal(parseTab(undefined), "overview");
  });

  it("carry a count only where the record holds something, and the same figure the panel prints", () => {
    const a = model();
    assert.equal(tabCount(a, "certificates"), a.certs.length);
    assert.equal(tabCount(a, "sources"), a.sources.length);
    const none = model(arFashionInput());
    assert.equal(tabCount(none, "certificates"), null, "a record with no certificate says no number, not 0");
    assert.equal(tabCount(none, "products"), null);
    assert.equal(tabCount(none, "sources"), 1);
  });

  it("sit over all six sections, stacked in tab order, the address's tab the marked one", () => {
    for (const t of TABS) {
      const out = view(model(), { tab: t.id });
      const at = TABS.map((o) => out.search(new RegExp(`<div id="record-${o.id}" role="region" aria-label="${o.label}"`)));
      assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1]!)), `${t.id}: every section, in tab order`);
      const nav = /<nav aria-label="Record sections"[\s\S]*?<\/nav>/.exec(out)?.[0] ?? "";
      assert.match(nav, new RegExp(`<a\\b[^>]*aria-current="page"[^>]*>${t.label}`), t.id);
      assert.ok(plain(nav).includes(`#record-${t.id}"`), `${t.id}: without script the link still lands on its section`);
    }
    const out = view(model(), { mode: "page" });
    const ids = [...out.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "a certificate's anchor is on its row once, not in Overview and Certificates both");
  });

  it("follow the scroll: the first section in the reading band, the last at the foot, else where the reader was", () => {
    const order = TABS.map((t) => t.id);
    assert.equal(sectionInView(order, new Set(), false, "overview"), "overview", "nothing in the band keeps the mark");
    assert.equal(sectionInView(order, new Set(["sites", "safety"] as const), false, "overview"), "safety", "the higher of two on screen");
    assert.equal(sectionInView(order, new Set(["sources"] as const), false, "overview"), "sources");
    assert.equal(sectionInView(order, new Set(["sources"] as const), true, "sources"), "products", "a short last section is marked at the foot");
  });
});

describe("the summary", () => {
  it("is five cells of what the registers hold, each a count or a state and none a score", () => {
    const cells = summaryCells(model(), TODAY);
    assert.deepEqual(cells.map((c) => c.key), ["sanctions", "certificates", "rsc", "workers", "sources"]);
    assert.equal(cells[0]!.value, "Not listed");
    // The value is the figure alone under its label: "Sources · 11", never "Sources · 11 sources".
    assert.match(cells[4]!.value, /^\d+$/);
    assert.match(cells[3]!.value, /^[\d,]+$/);
    const out = text(view(model()));
    assert.doesNotMatch(out, /\b(score|grade|rating|stars?)\b/i);
  });

  it("dates 'Not listed' by the lists' last read, and says when that read is overdue", () => {
    const at = (iso: string | null) => summaryCells({ ...model(), sanctionsReadAt: iso }, TODAY)[0]!;
    assert.equal(at(null).sub, null, "no read date claims none");
    const fresh = at(new Date(TODAY.getTime() - 3600_000).toISOString());
    assert.equal(fresh.value, "Not listed");
    assert.match(fresh.sub ?? "", /^on the lists read \d{1,2} \w{3} \d{4}$/);
    assert.equal(fresh.tone, undefined);
    const stale = at(new Date(TODAY.getTime() - 5 * 86400_000).toISOString());
    assert.match(stale.sub ?? "", /^lists last read \d{1,2} \w{3} \d{4} · not re-read since$/);
    assert.equal(stale.tone, "caution");
  });

  it("says what is missing in words: no certificate, no RSC record, no workers figure", () => {
    const cells = Object.fromEntries(summaryCells(model(arFashionInput()), TODAY).map((c) => [c.key, c]));
    // In the strip a missing figure is the dash, its words for a screen reader and in the line under it.
    assert.deepEqual([cells.certificates!.value, cells.certificates!.valueWords], ["–", "No certificates on file"]);
    assert.equal(cells.rsc!.value, "Not covered");
    assert.deepEqual([cells.workers!.value, cells.workers!.valueWords], ["–", "Not published"]);
    assert.equal(cells.workers!.sub, "Not published · ask in your RFQ");
    assert.match(view(model(arFashionInput())), /<span aria-hidden="true" class="text-ink-3" title="Not published">–<\/span><span class="sr-only">Not published<\/span>/);
    assert.equal(cells.sources!.value, "1");
    assert.match(cells.sources!.sub ?? "", /^BGMEA · \d{1,2} \w{3} 2026$/);
  });

  it("names the certificate problem first: how many are expired or expiring, and which schemes", () => {
    const m = model();
    const states = m.certs.map((c) => c.state);
    const cell = summaryCells(m, TODAY).find((c) => c.key === "certificates")!;
    const expired = states.filter((s) => s === "expired").length;
    const expiring = states.filter((s) => s === "expiring").length;
    if (expired) assert.match(cell.value, new RegExp(`^${m.certs.length} · ${expired} expired$`));
    else if (expiring) assert.match(cell.value, new RegExp(`^${m.certs.length} · ${expiring} expiring$`));
    else assert.equal(cell.value, String(m.certs.length));
    // Founder, 8 Oct 2026: a date that passed is caution, as DESIGN.md's Colors says; the XCircle keeps it apart from expiring.
    assert.equal(cell.tone, expired || expiring ? "caution" : undefined);
    assert.equal(cell.lapsed, expired > 0);
    assert.notEqual(cell.tone as string, "danger");
  });

  it("puts the first line under the name together from the record, never from a guess", () => {
    const line = recordSubline(model());
    assert.match(line, /^Factory/);
    assert.match(recordSubline(model(arFashionInput())), /^Buying house/);
    // A record that files no year or parent says neither.
    assert.doesNotMatch(recordSubline(model(arFashionInput())), /founded|part of/);
    assert.ok(!/undefined|null/.test(line));
  });
});

describe("a sanctioned record", () => {
  const sanctioned = () => model(sanctionedInput());

  it("is a solid band, the refusal in words where Send RFQ would be, and Save still works", () => {
    const out = view(sanctioned());
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(plain(out), /You can't send this supplier an RFQ\./);
    assert.ok(!out.includes('href="/app/rfqs/new'), "Send RFQ is a live link on a sanctioned record");
    assert.doesNotMatch(out, />Send RFQ</);
    assert.match(out, /data-save="id-1"/, "Save is gone from a record that stays readable for due diligence");
    // The refusal is replaced, not greyed: nothing says disabled.
    assert.doesNotMatch(out, /\sdisabled=""|aria-disabled="true"/);
  });

  it("puts the match where it is read: which list, what it matched, when it was checked", () => {
    const m = sanctioned();
    const out = text(view(m));
    assert.match(out, /Sanctions matches/);
    assert.match(out, /The record stays readable for due diligence\. Save still works, so the supplier can be tracked\./);
    assert.match(out, /On the /);
  });

  it("on a phone swaps the action bar for the refusal, with Save beside it", () => {
    const bar = /<div data-record-actions="" class="[^"]*">([\s\S]*?)<\/div><\/section>/.exec(view(sanctioned()))?.[1] ?? "";
    assert.match(bar, /role="status"/);
    assert.match(plain(bar), /You can't send this supplier an RFQ\./);
    assert.match(bar, /data-save="id-1"/);
    assert.ok(!bar.includes("/app/rfqs/new"));
  });
});

describe("the view's rules", () => {
  it("never cuts a name: 125 characters are in the heading whole", () => {
    const m = model(longestNameInput());
    assert.ok(m.name.length > 100, "guard: a long name");
    const out = view(m);
    assert.ok(plain(out).includes(m.name), "the name is cut");
    assert.doesNotMatch(out, /truncate|line-clamp|text-ellipsis/);
    // A phone's page: the h1 holds it whole and wraps; only the stuck bar's repeat of it (hidden from a screen reader) is one line.
    const h1 = /<h1 data-phone-name="" class="([^"]*)">([^<]*)<\/h1>/.exec(phone(m, { mode: "page" }));
    assert.ok(h1 && plain(h1[2]!) === m.name && !/truncate|line-clamp|text-ellipsis/.test(h1[1]!), "a phone cuts the name");
  });

  it("heads the pane with an h2 (the search owns the h1) and the page with the h1", () => {
    assert.match(view(model(), { mode: "pane" }), /<h2 class="[^"]*">/);
    assert.doesNotMatch(view(model(), { mode: "pane" }), /<h1\b/);
    assert.match(view(model(), { mode: "page" }), /<h1 class="[^"]*">/);
  });

  it("offers Open full page and Close on the pane and neither on the page, and Back to results only on the page", () => {
    const pane = view(model(), { mode: "pane" });
    assert.match(pane, />Open full page</);
    assert.match(pane, /aria-label="Close"/);
    assert.doesNotMatch(pane, /Back to results/);
    const page = view(model(), { mode: "page" });
    assert.match(page, /Back to results/);
    assert.doesNotMatch(page, /aria-label="Close"|>Open full page</);
    // The way back carries the search the record was opened from.
    assert.match(plain(pane), /href="\/app\/suppliers\/aboni-knitwear\?back=%2Fapp%2Fdiscover%3Fq%3Dknit">Open full page/);
  });

  it("on a phone the page has a bar of its own, stuck to the top, with Share and the way back, and the name is the h1 under it", () => {
    // Paper page 35 (`d-overview`, `d-overview-scrolled`), after the founder's note of 6 Oct 2026 that the
    // top "wasn't designed for the mobile phone".
    const page = plain(phone(model(), { mode: "page" }));
    assert.match(page, /^<div data-record-phone="" class="[^"]*\bsm:hidden\b/, "the phone's record is drawn from 640");
    const bar = /<div data-record-bar="" class="([^"]*)">/.exec(page);
    assert.ok(bar, "no bar");
    // No ground until the name has left its row (founder, 12 Oct 2026: an empty bar over the name wasted the top of the screen).
    for (const c of ["sticky", "top-0", "z-raised", "h-14", "data-[stuck]:bg-surface"]) assert.ok(bar[1]!.split(" ").includes(c), `the bar lacks ${c}`);
    assert.ok(!bar[1]!.split(" ").includes("bg-surface"), "the bar covers the name's row");
    assert.match(page, /<header class="[^"]*-mt-14[^"]*"><h1 data-phone-name="" class="[^"]*pr-\[88px\]/, "the name does not share the bar's row, clear of the buttons");
    assert.match(page, /<button type="button" aria-label="Share"/);
    // The X is a link, 36 round with a 44 target, back to the search the record was opened from (a page has nothing to "close").
    const close = /<a aria-label="Back to search" class="([^"]*)" href="([^"]*)">/.exec(page);
    assert.ok(close && close[1]!.includes("before:-inset-1") && close[1]!.includes("active:bg-line"), "the way back has no 44 target or no pressed state");
    assert.equal(close[2], "/app/discover?q=knit", "back is not the search the record was opened from");
    // Opened from a link there is no search behind it, and the app's bars are hidden: back is the search itself.
    assert.match(phone(model(), { mode: "page", backHref: null }), /<a aria-label="Back to search" class="[^"]*" href="\/app">/);
    assert.match(page, /<h1 data-phone-name="" class="[^"]*text-2xl\/\[36px\][^"]*">Aboni Knitwear Ltd<\/h1>/);
    // The desktop's head, body and "Back to results" are not drawn on a phone, and the phone's are not drawn twice.
    const desk = view(model(), { mode: "page" });
    assert.match(desk, /<header class="[^"]*\bmax-sm:hidden\b/);
    assert.match(desk, /<div class="[^"]*\bmax-sm:hidden\b[^"]*"><a [^>]*>(?:<svg[\s\S]*?<\/svg>)?Back to results/);
    assert.doesNotMatch(desk, /data-record-bar|data-phone-/);
    // The drawer a narrow window gets has its own Close, and a title that says only "Supplier": no bar, and the name is said (founder, 12 Oct 2026).
    const drawer = phone(model(), { mode: "pane" });
    assert.doesNotMatch(drawer, /data-record-bar|aria-label="Back to search"|-mt-14/);
    assert.match(drawer, /<h2 data-phone-name="" class="[^"]*">Aboni Knitwear Ltd<\/h2>/);
  });

  it("a phone's action bar is fixed to the foot of the screen on the page, and the record keeps room for it", () => {
    // Founder, 6 Oct 2026: stuck inside the scrolling record, "it shakes or stutters when I scroll up
    // and down fast. It's not fixed there". Fixed, as the app's own tab bar is.
    const page = view(model(), { mode: "page" });
    const bar = /<div data-record-actions="" class="([^"]*)">/.exec(page)?.[1]?.split(" ") ?? [];
    for (const c of ["fixed", "inset-x-0", "bottom-0", "z-sticky", "sm:hidden"]) assert.ok(bar.includes(c), `the bar lacks ${c}`);
    assert.ok(!bar.includes("sticky"));
    assert.match(page, /<section aria-label="Supplier record" [^>]*class="[^"]*max-sm:pb-\[calc\(theme\(spacing\.action-bar\)_\+_env\(safe-area-inset-bottom\)\)\]/, "the record ends under the bar");
    assert.match(page, /<div class="[^"]*pb-\[env\(safe-area-inset-bottom\)\][^"]*">(?:<button[\s\S]*?<\/button>(?:<span[^>]*><\/span>)?)?<div class="min-w-0 flex-1"><a [^>]*>Send RFQ/, "the bar ignores the phone's safe area");
    // In the drawer a narrow window gets, the drawer scrolls, not the screen: there it sticks, with no room held.
    const pane = view(model(), { mode: "pane" });
    const inPane = /<div data-record-actions="" class="([^"]*)">/.exec(pane)?.[1]?.split(" ") ?? [];
    assert.ok(inPane.includes("sticky") && !inPane.includes("fixed"));
    assert.doesNotMatch(pane, /max-sm:pb-\[calc/);
  });

  it("a phone's bars hold still on a scroll: each on its own layer, and the stuck tabs are not themselves a scroller", () => {
    // Founder, 10 Oct 2026: the tabs at the top and Save and Send RFQ at the foot "jerk, stutter and shake" on a phone.
    const page = view(model(), { mode: "page" });
    const layer = "[transform:translateZ(0)]";
    const onPhone = phone(model(), { mode: "page" });
    assert.ok(/<div data-record-bar="" class="([^"]*)"/.exec(onPhone)![1]!.split(" ").includes(layer), "the top bar repaints with the page");
    assert.ok(/<div data-record-actions="" class="([^"]*)"/.exec(page)![1]!.split(" ").includes(layer), "the action bar repaints with the page");
    const phoneTabs = /<div data-phone-tabs="" class="([^"]*)"><nav aria-label="Record sections" class="([^"]*)"/.exec(onPhone);
    assert.ok(phoneTabs && phoneTabs[1]!.split(" ").includes("sticky") && phoneTabs[1]!.split(" ").includes(layer) && !phoneTabs[1]!.includes("overflow"), "a phone's stuck tabs scroll sideways too");
    assert.ok(phoneTabs[2]!.split(" ").includes("overflow-x-auto"));
    // Founder, 12 Oct 2026: the rail moved up and down under a finger. The hairline is the box's, so the strip is
    // as tall as its tabs and has nothing to scroll by; it never scrolls on that axis.
    assert.ok(phoneTabs[1]!.split(" ").includes("border-b") && phoneTabs[2]!.split(" ").includes("overflow-y-hidden") && !/\bborder-b\b/.test(phoneTabs[2]!), "the strip can move up and down");
    const stuck = /<div class="([^"]*)"><nav aria-label="Record sections" class="([^"]*)"/.exec(page);
    assert.ok(stuck, "the tabs have no sticky box of their own");
    assert.ok(stuck[1]!.split(" ").includes("sticky") && stuck[1]!.split(" ").includes(layer) && !stuck[1]!.includes("overflow"), "what sticks scrolls sideways too");
    assert.ok(stuck[2]!.split(" ").includes("overflow-x-auto") && !stuck[2]!.split(" ").includes("sticky"));
    // The strip follows the marked tab at once, never with a smooth scroll while the page moves.
    assert.doesNotMatch(readFileSync(path.join(dir, "section-tabs.tsx"), "utf8"), /bar\.scrollTo\(/);
  });

  it("on the page, a phone hides the app's bars (data-detail) and the page has a contact column from 1024", () => {
    const page = view(model(), { mode: "page" });
    assert.match(page, /data-detail=""/);
    assert.match(page, /<aside aria-label="Contact and sources" class="hidden w-details/);
    assert.doesNotMatch(view(model(), { mode: "pane" }), /data-detail|<aside/);
  });

  it("holds no contact value and no score, whatever the payload carried", () => {
    const leaky = zaheenSampleInput();
    const out = view(buildSheet(leaky, { supplierId: "id-1" }));
    for (const v of Object.values(leaky.leaked)) assert.ok(!out.includes(v as string), `a contact value reached the record: ${String(v)}`);
    for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) assert.ok(!out.includes(key), key);
  });

  // Founder, 12 Oct 2026: Growth, Enterprise and admins see the details. The database decides who (0145);
  // the view draws what it was given and nothing else.
  describe("the contact details, when the database returned them", () => {
    const DETAILS = {
      emails: ["sales@aboni.example", "md@aboni.example"],
      phones: ["+880 1754392350", "02-9876543"],
      website: "www.aboni.example/contact",
      person: "Md. Karim Uddin",
      role: "Managing Director",
    };
    const COUNTS = { emails: 2, phones: 2, website: true, representatives: 1 };
    const unlocked = (input = aboniInput(), details: ContactDetailsRead = DETAILS) =>
      buildSheet(input, { supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", contactCounts: COUNTS, contactDetails: details });
    const cards = (html: string) => html.match(/<section aria-label="Contact" data-contact-details=""[\s\S]*?<\/section>/g) ?? [];

    it("draws each as a link that writes, dials or opens the site, in the page's column and in the pane", () => {
      for (const mode of ["page", "pane"] as const) {
        const out = view(unlocked(), { mode });
        // The page draws the column's card and, under 1024, the same card in the main column; the pane has the one.
        assert.equal(cards(out).length, mode === "page" ? 2 : 1, mode);
        const card = cards(out)[0]!;
        assert.match(card, /<a href="mailto:sales@aboni\.example"[^>]*>sales@aboni\.example<\/a>/);
        assert.match(card, /<a href="mailto:md@aboni\.example"/);
        assert.match(card, /<a href="tel:\+8801754392350"[^>]*>\+880 1754392350<\/a>/);
        assert.match(card, /<a href="tel:\+88029876543"[^>]*>02-9876543<\/a>/);
        // No scheme was filed, so the link gains https; it opens apart and vouches for nothing.
        assert.match(card, /<a href="https:\/\/www\.aboni\.example\/contact" target="_blank" rel="noopener noreferrer nofollow"[^>]*>www\.aboni\.example\/contact<\/a>/);
        assert.match(text(card), /Contact Contact person Md\. Karim Uddin Managing Director Emails sales@aboni\.example md@aboni\.example Phone numbers \+880 1754392350 02-9876543 Website www\.aboni\.example\/contact/);
        // Links are the brand's ink, never the solid brand.
        assert.doesNotMatch(card, /\btext-brand\b(?!-)|\bbg-brand\b(?!-)/);
        // Nothing says locked: not the card, not the foot line.
        assert.doesNotMatch(text(out), /Contact details are locked|Locked · |emails on file|phone numbers on file/, mode);
      }
      // The page's second card is the main column's, hidden where the column is drawn.
      assert.match(view(unlocked(), { mode: "page" }), /<div class="lg:hidden"><section aria-label="Contact" data-contact-details=""/);
    });

    it("a phone draws them in its Contact section, the last of the scroll, under the section's one heading", () => {
      const out = phone(unlocked(), { mode: "page" });
      const section = /<section aria-label="Contact" data-phone-contact=""[\s\S]*?<\/section><\/section>/.exec(out)?.[0] ?? "";
      assert.match(section, /<div data-contact-details="" class="[^"]*rounded-\[10px\]/, "the details are not in the phone's Contact section");
      assert.equal(text(section).trim(), "Contact Contact person Md. Karim Uddin Managing Director Emails sales@aboni.example md@aboni.example Phone numbers +880 1754392350 02-9876543 Website www.aboni.example/contact");
      assert.match(section, /<a href="tel:\+8801754392350"/);
      // As wide as the section, not the desktop column's 344; long values wrap; a row is 44 tall for a thumb.
      assert.doesNotMatch(section, /max-w-details/);
      const link = /<a href="mailto:sales@aboni\.example" class="([^"]*)"/.exec(section)?.[1]?.split(" ") ?? [];
      for (const c of ["py-2.5", "text-md", "[overflow-wrap:anywhere]", "text-brand-ink"]) assert.ok(link.includes(c), c);
      assert.doesNotMatch(text(out), /Locked\. Send an RFQ|Contact details are locked/);
    });

    it("a scheme the register filed is kept only when it is http or https", () => {
      assert.equal(siteHref("http://aboni.example"), "http://aboni.example");
      assert.equal(siteHref("HTTPS://aboni.example"), "HTTPS://aboni.example");
      assert.equal(siteHref("javascript:alert(1).example"), "https://javascript:alert(1).example");
      // A filed "?bcc=" stays part of the address instead of becoming a header.
      assert.equal(mailHref("a@b.example?bcc=x@y.example"), "mailto:a@b.example%3Fbcc%3Dx%40y.example");
      // A local number gains the country code; a foreign one keeps its own.
      assert.equal(telHref("01754-392350"), "tel:+8801754392350");
      assert.equal(telHref("1754392350"), "tel:+8801754392350");
      assert.equal(telHref("0088 02 9876543"), "tel:+88029876543");
      assert.equal(telHref("+44 20 7946 0000"), "tel:+442079460000");
      // A label before the number and an extension after it are not dialled.
      assert.equal(telHref("Tel: +880-2-55012345, Ext 114"), "tel:+880255012345");
    });

    it("only the kinds the record holds are drawn, and a record holding none says so without a lock", () => {
      const phoneOnly = cards(view(unlocked(aboniInput(), { emails: [], phones: ["01754392350"], website: null, person: null }), { mode: "page" }))[0]!;
      assert.equal(text(phoneOnly).trim(), "Contact Phone number 01754392350");
      assert.doesNotMatch(phoneOnly, /mailto:|target="_blank"/);
      const none = cards(view(unlocked(aboniInput(), { emails: [], phones: [], website: null, person: null }), { mode: "page" }))[0]!;
      assert.equal(text(none).trim(), "Contact No email or phone on file");
      assert.doesNotMatch(none, /<a /);
    });

    it("without them the record is the locked one, byte for byte", () => {
      const before = buildSheet(aboniInput(), { supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", contactCounts: COUNTS });
      assert.equal(before.contact.details, null);
      for (const mode of ["page", "pane"] as const) {
        const locked = both(before, { mode });
        assert.equal(both(unlocked(aboniInput(), null), { mode }), locked, mode);
        assert.doesNotMatch(locked, /data-contact-details|mailto:|href="tel:/, mode);
        assert.match(text(locked), /Locked · 2 emails on file · 2 phone numbers on file · Website on file · 1 contact person on file/, mode);
      }
    });

    it("a sanctioned record never draws them, whatever the read returned: it keeps the locked card", () => {
      // The database answers null for a sanctioned supplier (0145, run in supabase/ci/assert-0145.sql);
      // the sheet holds the same line, so an older function could not put a mail link on this record.
      for (const input of [sanctionedInput(), zaheenSampleInput()]) {
        const sheet = unlocked(input);
        assert.equal(sheet.sanctioned, true, "guard: the record is sanctioned");
        assert.equal(sheet.contact.details, null);
        for (const mode of ["page", "pane"] as const) {
          const out = both(sheet, { mode });
          assert.doesNotMatch(out, /data-contact-details|mailto:|href="tel:|aboni\.example/, mode);
          assert.match(text(out), /2 emails on file · 2 phone numbers on file · Website on file · 1 contact person on file/, mode);
        }
        assert.match(text(view(sheet, { mode: "page" })), /Contact details are locked\. Send an RFQ and the supplier replies here\./);
      }
    });

    it("an account at its daily limit keeps the locked card, with one line that says why, on the desktop and on a phone", () => {
      const LIMIT = "You've reached today's limit for contact details. They open again tomorrow.";
      const sheet = unlocked(aboniInput(), "limited");
      assert.equal(sheet.contact.details, null);
      assert.equal(sheet.contact.limited, true);
      const ON_FILE = "2 emails on file · 2 phone numbers on file · Website on file · 1 contact person on file";
      for (const mode of ["page", "pane"] as const) {
        const out = view(sheet, { mode });
        assert.doesNotMatch(out, /data-contact-details|mailto:|href="tel:|aboni\.example/, mode);
        // The page's column and, where the column is not drawn, the end of the overview: one card in the pane, two on the page.
        const cardTexts = (out.match(/<section aria-label="Contact"[\s\S]*?<\/section>/g) ?? []).map((c) => text(c).trim());
        assert.equal(cardTexts.length, mode === "page" ? 2 : 1, mode);
        for (const c of cardTexts) assert.equal(c, `Contact ${ON_FILE} Contact details are locked. Send an RFQ and the supplier replies here. ${LIMIT}`, mode);
        // The card says it, so the foot line is not drawn beside it.
        assert.doesNotMatch(text(out), /Locked · /, mode);
      }
      // A count that could not be read still says why the card is locked.
      const unread = text(view({ ...sheet, contact: { ...sheet.contact, counts: null } }, { mode: "page" }));
      assert.match(unread, /Contact Contact details are locked\. Send an RFQ and the supplier replies here\. You've reached today's limit for contact details\. They open again tomorrow\./);
      const section = /<section aria-label="Contact" data-phone-contact=""[\s\S]*?<\/section><\/section>/.exec(phone(sheet, { mode: "page" }))?.[0] ?? "";
      assert.equal(text(section).trim(), `Contact ${ON_FILE} Locked. Send an RFQ and the supplier replies in Messages. ${LIMIT}`);
      // Nobody else is told about a limit: not a reader with no details, not one who sees them.
      for (const other of [unlocked(aboniInput(), null), unlocked()]) assert.doesNotMatch(text(both(other, { mode: "page" })), /today's limit/);
    });

    it("what the profile payload carried still never renders: only what came through details does", () => {
      // The fixture is drawn as a sanctioned SAMPLE, which never shows details; here it is an ordinary record.
      const leaky = { ...zaheenSampleInput(), sanctionSample: false };
      const out = both(unlocked(leaky), { mode: "page" });
      assert.match(out, /mailto:sales@aboni\.example/, "guard: the details are drawn");
      for (const v of Object.values(leaky.leaked).flat()) assert.ok(!out.includes(v), `a contact value from the payload reached the record: ${v}`);
      for (const key of ["email_primary", "contact_name", "contact_role"]) assert.ok(!out.includes(key), key);
    });
  });

  it("says the details are locked from the counts alone, and nothing when the count could not be read", () => {
    const out = text(view(model(), { mode: "page" }));
    assert.match(out, /1 email on file · 6 phone numbers on file · Website on file · 1 contact person on file/);
    assert.match(out, /Contact details are locked\. Send an RFQ and the supplier replies here\./);
    // Every kind the register holds is named in the column and again in the foot line; a kind that is absent is not.
    const withTwo = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 1, phones: 6, website: true, representatives: 2 }, held: null, details: null } }), { mode: "page" }));
    assert.equal(withTwo.match(/1 email on file · 6 phone numbers on file · Website on file · 2 contact people on file/g)?.length, 2, "the column and the foot line");
    const phonesOnly = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 0, phones: 2, website: false, representatives: 0 }, held: null, details: null } }), { mode: "page" }));
    assert.match(phonesOnly, /2 phone numbers on file/);
    assert.doesNotMatch(phonesOnly, /Email \d|Website on file|Contact person/);
    const none = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 0, phones: 0, website: false, representatives: 0 }, held: null, details: null } }), { mode: "page" }));
    assert.match(none, /No email or phone on file/);
    assert.doesNotMatch(none, /Locked · /);
    // The foot line leads with what it is (critique of 8 Oct 2026, item 7), and the two cards say "Last read" alike.
    assert.match(out, /Locked · 1 email on file · 6 phone numbers on file · Website on file · 1 contact person on file/);
    assert.doesNotMatch(out, /on file · locked/);
    assert.doesNotMatch(readFileSync(path.join(dir, "..", "patterns", "source-mark.tsx"), "utf8"), /Last checked/);
    const unread = text(view(model(arFashionInput(), { contact: { hidden: "", plan: null, counts: null, held: null, details: null } }), { mode: "page" }));
    assert.doesNotMatch(unread, /No email or phone on file|Locked · /, "an unread count claims none on file");
  });

  // Critique of 8 Oct 2026, item 5: the page said its sources twice and "11" three times; "Needs a look"
  // kept model order while the strip ranked by date, so GOTS and WRAP swapped between the pane and Saved.
  it("the page says its sources once: the strip's count opens the Sources tab, the aside keeps Contact only, the section stays", () => {
    const page = view(model(), { mode: "page" });
    assert.equal((page.match(/<h[23][^>]*>Sources · \d+<\/h[23]>/g) ?? []).length, 1, "the sources list is drawn twice");
    assert.doesNotMatch(page, /<aside[^>]*>[\s\S]*?<section aria-label="Sources"/, "the aside still carries the source list");
    const strip = /<dl aria-label="Summary"[\s\S]*?<\/dl>/.exec(page)?.[0] ?? "";
    assert.match(strip, /data-define="Sources"[\s\S]*?<a[^>]*href="\/app\/discover\?q=knit&amp;record=x&amp;tab=sources#record-sources"[^>]*>\d+<\/a>/, "the Sources cell is not a link to the tab");
    assert.ok((page.match(/Sources · \d+/g) ?? []).length <= 2, "the count said three times (strip, tab, aside)");
  });

  it("'Needs a look' and the strip lead with the worst lapse, in rankCerts's one order, everywhere", () => {
    const row = (scheme: string, expiresOn: string) => ({ scheme, number: null, issuer: null, expiresOn, documentUrl: null });
    // Model order GOTS then WRAP; GOTS lapsed earlier, so WRAP (the latest lapse) leads.
    assert.deepEqual(needsLook([row("GOTS", "2026-01-04"), row("WRAP", "2026-03-29"), row("OEKO-TEX", "2027-05-01")], TODAY).map((r) => r.scheme), ["WRAP", "GOTS"]);
    // Two expiring: the soonest leads.
    assert.deepEqual(needsLook([row("GOTS", "2026-11-01"), row("WRAP", "2026-10-08")], TODAY).map((r) => r.scheme), ["WRAP", "GOTS"]);
    const m = model();
    const rows = needsLook(certRows(m), TODAY);
    const ranked = rankCerts(certRows(m), TODAY).filter((r) => r.w.state === "expired" || r.w.state === "expiring").map((r) => r.c.scheme);
    assert.deepEqual(rows.map((r) => r.scheme), ranked);
    const cell = summaryCells(m, TODAY).find((c) => c.key === "certificates")!;
    if (rows.length > 0) assert.ok(cell.sub?.startsWith(rows[0]!.scheme), `the strip leads with ${cell.sub}, the rows with ${rows[0]!.scheme}`);
  });

  // Critique of 8 Oct 2026, item 6: heuristic 10 sat at 1 for three runs; nothing defined RSC, a tier,
  // "fixed" or a mark's "+3" on hover or focus. One glossary, one `Define`.
  it("every strip label, every Sources group heading and the panel's own words resolve to a glossary entry, drawn as a defined term", () => {
    const m = model();
    for (const c of summaryCells(m, TODAY)) assert.ok(define(c.label), `${c.label} has no definition`);
    for (const rank of [1, 2, 3, 4, 5, 6] as const) assert.ok(define(tierWords(rank)), `${tierWords(rank)} has no definition`);
    assert.ok(define(tierWords(1, "RSC")));
    for (const term of ["fixed", "stale read", "more", "EPB", "BGMEA", "BKMEA", "BGAPMEA", "BTMA", "GOTS", "WRAP", "OEKO-TEX"]) assert.ok(define(term), `${term} has no definition`);
    for (const [term, what] of Object.entries(GLOSSARY)) assert.ok(/^[A-Z\u201c].{40,}[.]$/.test(what), `${term}: one plain sentence, ending in a full stop`);
    assert.equal(define("nonsense"), null);
    // Round 3, item 5: the help layer reaches the results and the composer.
    assert.ok(define("FOB"), "FOB has no definition");
    const table = readFileSync(path.join(process.cwd(), "components", "search", "table.tsx"), "utf8");
    assert.match(table, /sort=\{state\("sources"\)\} href=\{sortHrefs\.sources\} title=\{SOURCES_TITLE\}/, "the Sources header has no title");
    const composer = readFileSync(path.join(process.cwd(), "components", "rfqs", "composer.tsx"), "utf8");
    assert.match(composer, /<Defined text=\{q\} \/>/, "the questions list does not define its terms");
    const attention = readFileSync(path.join(process.cwd(), "components", "patterns", "attention.tsx"), "utf8");
    assert.match(attention, /<Define term=\{it\.scheme\}>/, "an attention row's scheme is not defined");
    const page = view(m, { mode: "page", tab: "sources" });
    const strip = /<dl aria-label="Summary" tabindex="0" aria-describedby="([^"]+)"/.exec(page);
    assert.ok(strip, "the strip is not one tab stop");
    assert.equal(strip[1]!.split(" ").length, 5, "the strip is not described by its five definitions");
    for (const id of strip[1]!.split(" ")) assert.ok(page.includes(`<span id="${id}" class="sr-only">`), `${id} names no definition`);
    const inStrip = page.slice(page.indexOf('<dl aria-label="Summary"'), page.indexOf("</dl>", page.indexOf('<dl aria-label="Summary"')));
    assert.doesNotMatch(inStrip, /<span tabindex="0" data-define=/, "a label in the strip is a tab stop of its own");
    for (const label of ["Sanctions", "Certificates", "RSC", "Workers", "Sources"]) {
      // Round 3, item 6: the strip is the one tab stop; its labels are reached through it and by hover.
      const m2 = new RegExp(`<span tabindex="-1" data-define="${label}" aria-describedby="([^"]+)"[^>]*>${label}</span>`).exec(page);
      assert.ok(m2, `${label} is not a defined term in the strip`);
      assert.ok(page.includes(`<span id="${m2![1]}" class="sr-only">${define(label)!.replace(/'/g, "&#x27;")}</span>`), `${label}'s definition is not read to a screen reader`);
    }
    assert.match(page, /data-define="Government register"|data-define="Industry body"/, "the Sources group headings are not defined");
    if (/fixed</.test(page)) assert.match(page, /data-define="fixed"[^>]*>\d+% fixed</);
    assert.match(page, /class="[^"]*decoration-dotted/, "a defined term is not marked by a dotted underline");
  });

  it("the long captions wrap at 72 characters: the Sources caption and the RSC block's", () => {
    const page = view(model(), { mode: "page" });
    assert.match(page, /<p class="max-w-\[72ch\] text-xs text-ink-3">[^<]*registers?[^<]*<\/p>/, "the Sources caption runs the panel's width");
    if (/RSC factory/.test(page)) assert.match(page, /<p class="max-w-\[72ch\] text-xs text-ink-3">RSC factory/, "the RSC caption runs the panel's width");
  });

  it("lists problems first: only expired and expiring certificates are under 'Needs a look'", () => {
    const m = model();
    const rows = needsLook(certRows(m), TODAY);
    for (const r of rows) assert.match(text(view(m)), new RegExp(r.scheme.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")));
    assert.equal(rows.length > 0, m.certs.some((c) => c.state === "expired" || c.state === "expiring"));
    if (rows.length === 0) assert.doesNotMatch(view(m), /Needs a look/);
  });

  it("gives every key fact a source line or a sentence for its absence, never a bare dash", () => {
    for (const f of keyFacts(model())) {
      assert.ok(f.values.length > 0 || f.empty, `${f.label} is a blank`);
      for (const v of f.values) assert.ok(v.text.trim() && v.text !== "—", `${f.label} prints a dash`);
    }
    const out = text(view(model(arFashionInput())));
    assert.match(out, /Founded Not on file/);
  });
});

// The critique of 7 Oct 2026 (`.impeccable/critique/2026-10-07T09-39-14Z__app-app-app.md`, item 1): the
// record's first screen said "Source not linked yet" seven times, each head fact two or three times,
// and jumped from h1 to h3.
describe("the record's first screen says each fact once, with its receipt", () => {
  it("a fact without a register is the value alone: no 'Source not linked yet', no pending mark, no legend", () => {
    const full = keyFacts(model());
    assert.equal(full.find((f) => f.label === "Factory types")?.values[0]?.text, "Dyeing, Knit, Packaging, Woven", "the subline said Factory; the types it did not say stay");
    const bare = aboniInput();
    const gone = new Set(["BGMEA", "BKMEA"]);
    bare.profile.supplier.source_tags = bare.profile.supplier.source_tags.filter((t) => !gone.has(t));
    bare.profile.pills = bare.profile.pills.filter((x) => !gone.has(x.source_code));
    bare.profile.provenance = bare.profile.provenance.filter((x) => !gone.has(x.source_code));
    for (const mode of ["page", "pane"] as const) {
      const out = view(model(bare), { mode });
      assert.doesNotMatch(out, /Source not linked|Source pending/, mode);
    }
  });

  it("marks the figures the ETL attributes to a register: founding year, machines and capacity name BGMEA or BKMEA", () => {
    const m = model();
    const by = Object.fromEntries(m.facts.map((f) => [f.label, f]));
    assert.deepEqual(by["Sewing machines"]!.marks?.map((x) => x.code), ["BGMEA", "BKMEA"]);
    assert.deepEqual(by["Capacity, as filed"]!.marks?.map((x) => x.code), ["BKMEA"]);
    assert.match(text(view(m)), /Sewing machines 850 From BGMEA, BKMEA/);
  });

  it("starts Key facts after the subline: type, founded and parent group are said once, in the line under the name", () => {
    const m = model();
    const line = recordSubline(m);
    assert.match(line, /^Factory · .* · founded 1985 · part of Babylon Group$/);
    const labels = keyFacts(m).map((f) => f.label);
    for (const said of ["Type", "Founded", "Parent group"]) assert.ok(!labels.includes(said), `${said} is said again under Key facts`);
    const out = text(view(m, { mode: "page" }));
    assert.equal((out.match(/Babylon Group/g) ?? []).length, 1, "the parent group is said once");
    assert.equal((out.match(/1985/g) ?? []).length, 1, "the founding year is said once");
    // A record whose subline cannot say the year still says so under Key facts.
    assert.ok(keyFacts(model(arFashionInput())).some((f) => f.label === "Founded" && f.empty));
  });

  it("the summary strip's value is the figure alone under its label", () => {
    const cells = Object.fromEntries(summaryCells(model(), TODAY).map((c) => [c.key, c]));
    assert.equal(cells.workers!.value, "3,166");
    assert.equal(cells.sources!.value, String(model().sourceCount));
    assert.doesNotMatch(text(view(model())), /\d workers\b.*Sources|\d+ sources/);
  });

  it("one name: the registered name is the shown name whatever its case, spacing or punctuation", () => {
    assert.ok(sameName("ABONI KNITWEAR LTD.", "Aboni Knitwear Ltd"));
    assert.ok(sameName("S M Knitwears  Limited", "S.M. Knitwears Limited"));
    assert.ok(!sameName("Aboni Knitwear Ltd", "Aboni Knitwear Unit-2 Ltd"));
    const m = model();
    assert.equal(m.name, "Aboni Knitwear Ltd");
    assert.ok(!keyFacts(m).some((f) => f.label === "Registered name"), "ABONI KNITWEAR LTD. survives beside Aboni Knitwear Ltd");
    assert.equal((text(view(m, { mode: "page" })).match(/aboni knitwear ltd/gi) ?? []).length, 1, "the name is on the screen once");
  });

  it("runs the headings in order: h1 then h2 on the page, h2 then h3 in the pane, never skipping a level", () => {
    for (const [mode, first] of [["page", 1], ["pane", 2]] as const) {
      const levels = [...view(model(), { mode, tab: "overview" }).matchAll(/<h([1-6])\b/g)].map((x) => Number(x[1]));
      assert.equal(levels[0], first, `${mode}: the name`);
      let prev: number = first;
      for (const l of levels) {
        assert.ok(l <= prev + 1, `${mode}: h${prev} jumps to h${l}`);
        prev = l;
      }
      assert.ok(levels.includes(first + 1), `${mode}: the sections head one level under the name`);
    }
  });

  it("a stale register read is an hourglass with its words, so the clock keeps one meaning (expiry)", () => {
    assert.equal(staleWords("26 Jun 2026", new Date("2026-10-06T10:00:00Z")), "read 102 days ago");
    assert.equal(staleWords("6 Oct 2026", new Date("2026-10-06T10:00:00Z")), null);
    assert.equal(staleWords(null, TODAY), null);
    const count = (m: SupplierSheetModel) => (text(view(m, { mode: "page", tab: "overview" })).match(/read \d+ days ago/g) ?? []).length;
    const fresh = model(aboniInput(), { sources: model().sources.map((s) => ({ ...s, readDate: "17 Sep 2026" })) });
    assert.equal(count(fresh), 0, "a fresh read is its date");
    // One stale read, said once: in the Sources section (the aside no longer repeats the list; critique of 8 Oct 2026, item 5).
    assert.equal(count(model(aboniInput(), { sources: fresh.sources.map((s, i) => (i === 0 ? { ...s, readDate: "26 Jun 2025" } : s)) })), 1);
    assert.doesNotMatch(view(fresh, { mode: "page" }), /Not dated/);
    // The glyph is Phosphor's hourglass, not the clock the certificate rows use.
    assert.match(readFileSync(path.join(dir, "panels.tsx"), "utf8"), /Hourglass size=\{12\}/);
    assert.doesNotMatch(readFileSync(path.join(dir, "panels.tsx"), "utf8"), /\bClock\b/);
    assert.doesNotMatch(readFileSync(path.join(dir, "..", "patterns", "source-mark.tsx"), "utf8"), /\bClock\b/);
  });

  it("folds 'Products as filed' by default and unfolds it on the Products tab; the Sources column sticks on the page", () => {
    const overview = view(model(), { mode: "page", tab: "overview" });
    assert.match(overview, /<details class="group\/filed[^"]*"><summary/);
    assert.doesNotMatch(overview, /<details open="" class="group\/filed/);
    assert.match(view(model(), { mode: "page", tab: "products" }), /<details open="" class="group\/filed/);
    assert.match(overview, /<aside aria-label="Contact and sources" class="[^"]*lg:sticky[^"]*lg:self-start/);
  });
});

// Critique of 7 Oct 2026, item 9: the one genuine side-tab, a second dark green and 10px text in the map's
// popups, a 7px baseline gap between the two headers, and a summary line ~147 characters long.
describe("the small tidy", () => {
  it("the map's popups use the tokens, no second dark green, nothing under 12px", () => {
    const map = readFileSync(path.join(dir, "locations-map.tsx"), "utf8");
    assert.doesNotMatch(map, /#[0-9a-fA-F]{3,6}\b/, "a hand-typed colour in the map");
    assert.doesNotMatch(map, /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px|text-\[1[01]px\]|text-\[[0-9]px\]/, "text under 12px in the map");
    assert.match(map, /import \{ light as C \} from "@\/lib\/design\/tokens";/);
    assert.match(map, /color:\$\{C\.ink\.strong\}/);
  });

  it("the error block keeps its tint and icon and loses the side rule; the pane head shares the list bar's baseline; the summary wraps at 72", () => {
    const feedback = readFileSync(path.join(dir, "..", "kit", "feedback.tsx"), "utf8");
    assert.doesNotMatch(feedback, /border-left-width|border-l-danger/);
    assert.match(feedback, /role="alert" className=\{cn\("flex flex-col items-start gap-3 rounded-md bg-danger-tint p-5"/);
    const pane = view(model(), { mode: "pane" });
    const head = /<header class="([^"]*)">/.exec(pane)?.[1]?.split(" ") ?? [];
    assert.ok(head.includes("sm:pt-3") && !head.includes("sm:pt-5"), "the pane head sits 7px under the list bar's title");
    const withSummary = view(model(aboniInput(), { summary: "A".repeat(147) }), { mode: "page" });
    assert.match(withSummary, /<p class="max-w-\[72ch\] text-base text-ink-2">A{147}<\/p>/);
  });
});

const pin = (confidencePct: number | null) => ({ latitude: 23.8, longitude: 90.3, confidencePct, addressStatus: "full_address" });
const site = (address: string, kind: string, over: Partial<LocationRow> = {}): LocationRow => ({ kind, address, marks: [], alsoRecordedAs: ["PLOT 1 OLD SPELLING"], ...over });

describe("the Sites tab (B4d)", () => {
  const rows = [
    site("Office, Mirpur, Dhaka", "Registered office · Mailing address", { office: true, pin: pin(92) }),
    site("Plot 4, Hemayetpur, Savar", "Factory", { office: false, pin: null }),
    site("Nayapara, Kashimpur, Gazipur", "Factory", { office: false, pin: pin(55) }),
    site("Plot 169, Hemayetpur, Savar", "Factory", { office: false, pin: pin(88) }),
  ];

  it("numbers pinned sites first, so a card's number is its pin's number, and says in words how each is pinned", () => {
    const cards = siteCards(rows);
    assert.deepEqual(cards.map((c) => c.address), ["Office, Mirpur, Dhaka", "Nayapara, Kashimpur, Gazipur", "Plot 169, Hemayetpur, Savar", "Plot 4, Hemayetpur, Savar"]);
    assert.deepEqual(cards.map((c) => c.n), [1, 2, 3, 4]);
    assert.deepEqual(cards.map((c) => c.words), ["Office · registered office and mailing address", "Factory · approximate location", "Factory · pinned to the address", "Factory · not pinned yet"]);
    assert.equal(cards[1]!.note, "The pin marks the area, not the building.");
    assert.equal(cards[2]!.note, "From the record's own address");
    assert.equal(siteSummary(cards), "3 factory sites and 1 office");
    assert.equal(siteSummary(cards.slice(0, 1)), "1 office");
    assert.equal(siteSummary(cards.slice(2, 3)), "1 factory site");
  });

  it("a pin without a confidence is approximate, and a record whose pins were not read claims nothing about pins", () => {
    assert.equal(siteCards([site("A", "Factory", { office: false, pin: pin(null) })])[0]!.words, "Factory · approximate location");
    const unread = siteCards([site("A", "Factory"), site("B", "Mailing address")]);
    assert.deepEqual(unread.map((c) => c.words), ["Factory", "Office · mailing address"], "an unread cache still said 'pinned'");
    assert.equal(siteCards([site("C", "Registered")])[0]!.kind, "office", "a registered-only address was drawn as a factory");
    assert.ok(unread.every((c) => c.pin === null));
  });

  it("prints one clean address per site, never the registry's other spellings (RC-09)", () => {
    const out = view(model(aboniInput(), { locations: rows }), { mode: "page", tab: "sites" });
    assert.doesNotMatch(out, /OLD SPELLING|Also filed as|registry spellings/);
    for (const r of rows) assert.ok(plain(out).includes(r.address), r.address);
    assert.match(text(out), /Sites · 4 3 factory sites and 1 office/);
  });

  it("links every card to its own site, so the list works with no script, and marks the selected one", () => {
    const out = view(model(aboniInput(), { locations: rows }), { mode: "page", tab: "sites" });
    const hrefs = [...plain(out).matchAll(/<a\b[^>]*href="([^"]*site=\d)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, 4);
    assert.ok(hrefs.every((h, i) => h!.endsWith(`site=${i + 1}`)));
    assert.equal((out.match(/aria-current="true"/g) ?? []).length, 0);
    const picked = renderToStaticMarkup(h(RecordView, { model: model(aboniInput(), { locations: rows }), mode: "page", tab: "sites", tabHref, today: TODAY, site: 2 })).replace(PHONE, "");
    assert.equal((picked.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(picked, /<li aria-current="true"[\s\S]*?Nayapara/);
  });

  it("draws the map controls only when there is a key and a pin, and never a map for a record with no pin", () => {
    const key = process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
    try {
      process.env.NEXT_PUBLIC_BARIKOI_API_KEY = "test-key";
      const mapped = text(view(model(aboniInput(), { locations: rows }), { mode: "page", tab: "sites" }));
      assert.match(mapped, /Street Satellite/);
      assert.match(mapped, /Show nearby suppliers/);
      const none = text(view(model(aboniInput(), { locations: rows.map((r) => ({ ...r, pin: null })) }), { mode: "page", tab: "sites" }));
      assert.doesNotMatch(none, /Satellite|nearby suppliers/);
      delete process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
      assert.doesNotMatch(text(view(model(aboniInput(), { locations: rows }), { mode: "page", tab: "sites" })), /Satellite/);
    } finally {
      if (key === undefined) delete process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
      else process.env.NEXT_PUBLIC_BARIKOI_API_KEY = key;
    }
  });

  it("reads ?site= as a whole number from 1 and nothing else", () => {
    assert.equal(parseSite("2"), 2);
    assert.equal(parseSite(["3", "4"]), 3);
    for (const bad of ["0", "-1", "2.5", "abc", "", "1000", undefined, null]) assert.equal(parseSite(bad as string | undefined), null, String(bad));
  });

  it("drops the Overview's address row when the record has sites to show, and keeps it when it has none", () => {
    assert.ok(!keyFacts(model(aboniInput(), { locations: rows })).some((f) => f.label === "Address"));
    const bare = model(aboniInput(), { locations: [] });
    assert.equal(keyFacts(bare).some((f) => f.label === "Address"), bare.facts.some((f) => f.label === "Factory address"));
  });
});

// The new pieces' own rules, read from their source.
const dir = path.join(process.cwd(), "components", "record");
// `locations-map.tsx` is the existing Barikoi capture (moved here from components/supplier in B11c): its map paints
// with typed colours by design, and it is on the old-colour list for that reason. The rules below are the record's own.
const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts") && f !== "locations-map.tsx").map((f) => [f, readFileSync(path.join(dir, f), "utf8")] as const);

describe("the record components' rules", () => {
  it("hand a client component only data: no function crosses from the server page into SitesView", () => {
    // renderToStaticMarkup does not enforce the server/client boundary, Next does, and answers with an error page.
    const panels = sources.find(([f]) => f === "panels.tsx")![1];
    const use = /<SitesView\b[\s\S]*?\/>/.exec(panels)?.[0] ?? "";
    assert.ok(use.length > 0, "guard: SitesView is used in panels.tsx");
    assert.doesNotMatch(use, /=>|function\s*\(/, "a function prop on a client component");
    assert.match(sources.find(([f]) => f === "sites-view.tsx")![1], /^"use client";/);
  });

  it("have no typed colour, no cut-off text and no score, and take the old kit for nothing", () => {
    assert.ok(sources.length >= 5);
    for (const [file, src] of sources) {
      const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), `${file}: a typed hex colour`);
      // One line is cut by design: the name repeated in a phone's stuck bar (Paper page 35, `d-overview-scrolled`),
      // hidden from a screen reader, with the whole name in the h1 under it.
      const uncut = file === "phone-record.tsx" ? code.replace(/<p aria-hidden className="[^"]*\btruncate\b[^"]*group-data-\[stuck\]\/bar:opacity-100">/, "") : code;
      assert.ok(!/\btruncate\b|text-ellipsis|line-clamp/.test(uncut), `${file}: text cut off`);
      assert.ok(!/\b(score|grade|rating|stars?)\b/i.test(code.replace(/"[^"]*"/g, "").replace(/`[^`]*`/g, "")), `${file}: a score-like value`);
      assert.ok(!/from "@\/components\/(ui|dashboard)\//.test(src), `${file} imports the old kit`);
    }
  });
});

// The founder opened three certificate links on 6 Oct 2026 and landed on a 404 (WRAP), an expired key
// (OEKO-TEX) and "Error loading data" (GOTS, for a supplier GOTS had stopped listing since our last read).
describe("a certificate links only to a page that opens (6 Oct 2026)", () => {
  // GOTS-31587 as GOTS last showed it: `hoursAgo` back, listed or not.
  const checked = (hoursAgo: number, listing_status = "listed"): SupplierSheetModel => {
    const m = model();
    const live = m.certs.find((c) => c.number === "GOTS-31587")!;
    const at = new Date(TODAY.getTime() - hoursAgo * 3_600_000).toISOString();
    return { ...m, certChecks: { reads: { gots: at }, certs: [{ kind: live.kind, certificate_no: "GOTS-31587", listing_status, checked_at: at, delisted_at: listing_status === "listed" ? null : at }] } };
  };
  const GOTS_LINK = /<a\b[^>]*href="https:\/\/global-standards\.org\/suppliers\/certified-suppliers\/details\?gtbid=SCO039488"[^>]*>Open on GOTS<\/a>/;

  it("a GOTS certificate opens the directory's public page while our check of GOTS is in date", () => {
    for (const mode of ["pane", "page"] as const) {
      const certs = plain(view(checked(1), { mode, tab: "certificates" }));
      assert.match(certs, GOTS_LINK, mode);
      assert.equal((certs.match(/Open on GOTS/g) ?? []).length, 1, `${mode}: the expired GOTS-27605 has no page left and no link`);
      assert.ok(!certs.includes("global-trace-base.org"), `${mode} still links to the login-walled document`);
    }
  });

  it("and has no link once the check is overdue, GOTS has dropped it, or GOTS was never read", () => {
    const row = (m: SupplierSheetModel) => certRows(m, TODAY).find((r) => r.number === "GOTS-31587")!;
    assert.ok(row(checked(1)).documentUrl, "guard: a check in date links");
    assert.equal(row(checked(24 * 30)).documentUrl, null, "a month-old check cannot say the page is still there");
    assert.equal(row(checked(1, "no_longer_listed")).documentUrl, null);
    assert.equal(row(model()).documentUrl, null, "no check at all");
  });

  it("no WRAP or OEKO-TEX certificate links anywhere on the record, and no mark opens a certifier's page", () => {
    for (const mode of ["pane", "page"] as const) {
      const out = plain(view(checked(1), { mode }));
      assert.ok(/WRAP/.test(out) && /OEKO-TEX/.test(out), "guard: the record holds both");
      assert.doesNotMatch(out, /href="[^"]*(wrapcompliance\.org|oeko-tex\.com|global-trace-base\.org)/);
      assert.doesNotMatch(out, /Open certificate|Open label check/);
      assert.equal((out.match(/global-standards\.org/g) ?? []).length, 1, `${mode}: the one GOTS link is its certificate's row`);
    }
  });

  it("the Document column is drawn only when a certificate has a page to open", () => {
    const head = (m: SupplierSheetModel) => text(/<section aria-label="Certificates"[\s\S]*?<ul>/.exec(view(m, { mode: "page", tab: "certificates" }))?.[0] ?? "");
    assert.match(head(checked(1)), /Certificate Issued by State Document/);
    assert.match(head(model()), /Certificate Issued by State\s*$/);
  });
});

describe("the registrations and the sources read as columns (6 Oct 2026: 'scattered, I have to look really closely')", () => {
  it("a membership is its register's name, then its number: 'Reg' and 'reg. no.' are not printed", () => {
    const fact = keyFacts(model()).find((f) => f.label === "Memberships")!;
    const rows = fact.values.map((v) => v.membership!);
    assert.ok(rows.length >= 3, "guard: Aboni holds several registrations");
    assert.doesNotMatch(fact.source ?? "", /^From /, "every line carries its register's mark, so 'From EPB, BGMEA' under them says it twice");
    assert.deepEqual(rows.find((r) => r.name === "EPB"), { mark: "EPB", name: "EPB", qualifier: null, number: "BD04293" });
    assert.ok(rows.every((r) => r.number && !/\breg\b/i.test(`${r.name} ${r.qualifier ?? ""}`)));
    const out = text(/<div id="record-overview"[\s\S]*?<div id="record-certificates"/.exec(view(model(), { mode: "page" }))?.[0] ?? "");
    assert.match(out, /EPB registration number BD04293/);
    assert.doesNotMatch(out, /reg\. no\./);
  });

  it("a source's number is the register's own, never our key for the read", () => {
    const sources = model().sources;
    const refs = (code: string) => sources.find((s) => s.mark.code.toUpperCase() === code)!.refs;
    assert.deepEqual(refs("EPB"), ["BD04293"]);
    assert.deepEqual(refs("RSC"), ["9342"], "RSC files the factory id itself");
    assert.deepEqual(refs("GOTS"), ["GOTS-27605", "GOTS-31587"]);
    assert.deepEqual(refs("WRAP"), ["7865"]);
    assert.deepEqual(refs("BRAND_HM"), [], "a brand list's row has no number a buyer could quote");
    for (const s of sources) for (const r of s.refs) assert.doesNotMatch(r, /:|^(gots|wrap|oeko-tex)-|^[0-9a-f]{16}$/, `${s.mark.code}: ${r}`);
  });

  it("the sources are grouped by kind, best rank first, each kind said once", () => {
    const out = view(model(), { mode: "page", tab: "sources" });
    const kinds = [...out.matchAll(/<section aria-label="([^"]+)"[^>]*><h3/g)].map((m) => plain(m[1]!));
    assert.deepEqual(kinds, [...new Set(model().sources.map((s) => s.tier))]);
    assert.equal(kinds[0], "Government register");
    assert.equal((out.match(/<li\b[^>]*@container/g) ?? []).length, model().sources.length, "one row per source");
    // The words come from a row's own tier slug, the order from its mark's rank: a kind can come back after another.
    const [a, b, c] = model().sources;
    const split = view(model(aboniInput(), { sources: [{ ...a!, tier: "Foreign regulator" }, { ...b!, tier: "Cross-check only" }, { ...c!, tier: "Foreign regulator" }] }), { mode: "page", tab: "sources" });
    assert.deepEqual([...split.matchAll(/<section aria-label="([^"]+)"[^>]*><h3/g)].map((m) => m[1]), ["Foreign regulator", "Cross-check only"]);
    // In the pane the name is the h2, so a group is an h4 there.
    assert.equal((view(model(), { mode: "pane", tab: "sources" }).match(/<section aria-label="[^"]+"[^>]*><h4/g) ?? []).length, kinds.length);
  });
});
describe("a record scrolled inside a pane (6 Oct 2026: no map on Sites, and the tabs hung loose under a header that had scrolled away)", () => {
  it("the record is never squeezed to its pane's height: a sticky header lets go at the end of a box that short", () => {
    for (const mode of ["pane", "page"] as const) {
      const root = /<section[^>]*data-record="[^"]*"[^>]*>/.exec(view(model(aboniInput()), { mode }))![0];
      assert.ok(!/\bmin-h-0\b/.test(root), `${mode}: the record may shrink below its sections, so its header stops sticking one pane down`);
    }
  });

  it("every view that stacks the sections reads the map's pins, whichever tab the address names", () => {
    for (const file of ["app/(app)/app/discover/page.tsx", "app/(app)/app/suppliers/[slug]/page.tsx", "components/saved/record.tsx"]) {
      const src = readFileSync(path.join(process.cwd(), ...file.split("/")), "utf8");
      assert.match(src, /\bpins: true,/, `${file}: the Sites section is always on the page, so its pins are always read`);
      assert.ok(!/\bpins: [^t\n]*=== "sites"/.test(src), `${file}: pins are read only when the address says tab=sites, so a reader who scrolls to Sites gets no map`);
    }
  });
});

describe("the record's minors, round 3 (critique of 8 Oct 2026, round 3, item 7)", () => {
  it("Certificates links to its tab as Sources does, and on the page Needs a look sits under Contact", () => {
    const m = model();
    const page = view(m, { mode: "page" });
    assert.match(page, /<a [^>]*href="[^"]*tab=certificates#record-certificates"/, "the Certificates value is not a link to its tab");
    assert.match(page, /<a [^>]*href="[^"]*tab=sources#record-sources"/);
    const aside = page.slice(page.indexOf('aria-label="Contact and sources"'));
    assert.match(aside, /aria-label="Needs a look"/, "the page's right column has no Needs a look");
    const pane = view(m);
    assert.equal((pane.match(/aria-label="Needs a look"/g) ?? []).length, 1, "the pane keeps Needs a look in its column, once");
  });

  it("a contact count leads with its noun", () => {
    assert.equal(onFileWords(1, 6, true, 2), "1 email on file · 6 phone numbers on file · Website on file · 2 contact people on file");
    assert.equal(onFileWords(2, 1, false, 1), "2 emails on file · 1 phone number on file · 1 contact person on file");
  });

  // Solid brand green is the primary button's (frame.test reads text and borders; this reads the phone record's fills).
  it("the phone record fills no bar or tile with solid brand green", () => {
    for (const f of ["phone-record.tsx", "line-view.tsx"]) assert.doesNotMatch(readFileSync(path.join(process.cwd(), "components", "record", f), "utf8"), /\bbg-brand\b(?!-)/, f);
  });
});
