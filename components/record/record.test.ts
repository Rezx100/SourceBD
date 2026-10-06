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
import type { LocationRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { RecordView } from "@/components/record/record-view";
import { TABS, certRows, keyFacts, needsLook, parseSite, parseTab, recordSubline, sectionInView, siteCards, siteSummary, summaryCells, tabCount } from "@/components/record/words";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const model = (input = aboniInput(), over: Partial<SupplierSheetModel> = {}): SupplierSheetModel => ({
  ...buildSheet(input, { supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", closeHref: "/app/discover?q=knit", contactCounts: { emails: 1, phones: 6, website: true, representatives: 1 } }),
  ...over,
});
const tabHref = (t: string) => `/app/discover?q=knit&record=x${t === "overview" ? "" : `&tab=${t}`}`;
const view = (m: SupplierSheetModel, props: { mode?: "pane" | "page"; tab?: (typeof TABS)[number]["id"] } = {}) =>
  renderToStaticMarkup(h(RecordView, { model: m, mode: props.mode ?? "pane", tab: props.tab ?? "overview", tabHref, today: TODAY, backHref: "/app/discover?q=knit" }));

describe("the record's tabs", () => {
  it("are six links to the same record, the open one marked, and a stranger is the Overview", () => {
    const out = view(model());
    const nav = /<nav aria-label="Record sections"[\s\S]*?<\/nav>/.exec(out)?.[0] ?? "";
    assert.deepEqual([...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]!).replace(/ · \d+$/, "").trim()), TABS.map((t) => t.label));
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
    assert.match(cells[4]!.value, /^\d+ sources?$/);
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
    assert.equal(cells.certificates!.value, "None found");
    assert.equal(cells.rsc!.value, "Not covered");
    assert.equal(cells.workers!.value, "Not published");
    assert.equal(cells.workers!.sub, "ask in your RFQ");
    assert.equal(cells.sources!.value, "1 source");
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
    assert.equal(cell.tone, expired ? "danger" : expiring ? "caution" : undefined);
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
    const bar = /<div class="sticky bottom-0 sm:hidden">([\s\S]*?)<\/div><\/section>/.exec(view(sanctioned()))?.[1] ?? "";
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

  it("says the details are locked from the counts alone, and nothing when the count could not be read", () => {
    const out = text(view(model(), { mode: "page" }));
    assert.match(out, /Email 1 on file · Phone 6 on file · Website on file · Contact person 1 on file/);
    assert.match(out, /Contact details are locked\. Send an RFQ and the supplier replies here\./);
    // Every kind the register holds is named in the column and again in the foot line; a kind that is absent is not.
    const withTwo = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 1, phones: 6, website: true, representatives: 2 }, held: null } }), { mode: "page" }));
    assert.equal(withTwo.match(/Email 1 on file · Phone 6 on file · Website on file · Contact person 2 on file/g)?.length, 2, "the column and the foot line");
    const phonesOnly = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 0, phones: 2, website: false, representatives: 0 }, held: null } }), { mode: "page" }));
    assert.match(phonesOnly, /Phone 2 on file/);
    assert.doesNotMatch(phonesOnly, /Email \d|Website on file|Contact person/);
    const none = text(view(model(aboniInput(), { contact: { hidden: "", plan: null, counts: { emails: 0, phones: 0, website: false, representatives: 0 }, held: null } }), { mode: "page" }));
    assert.match(none, /No email or phone on file/);
    assert.doesNotMatch(none, /on file · locked/);
    const unread = text(view(model(arFashionInput(), { contact: { hidden: "", plan: null, counts: null, held: null } }), { mode: "page" }));
    assert.doesNotMatch(unread, /No email or phone on file|on file · locked/, "an unread count claims none on file");
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
    const picked = renderToStaticMarkup(h(RecordView, { model: model(aboniInput(), { locations: rows }), mode: "page", tab: "sites", tabHref, today: TODAY, site: 2 }));
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
      assert.ok(!/\btruncate\b|text-ellipsis|line-clamp/.test(code), `${file}: text cut off`);
      assert.ok(!/\b(score|grade|rating|stars?)\b/i.test(code.replace(/"[^"]*"/g, "").replace(/`[^`]*`/g, "")), `${file}: a score-like value`);
      assert.ok(!/from "@\/components\/(ui|dashboard)\//.test(src), `${file} imports the old kit`);
    }
  });
});
