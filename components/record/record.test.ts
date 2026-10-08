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
import { TABS, certRows, keyFacts, needsLook, parseSite, parseTab, pendingLegend, recordSubline, sameName, sectionInView, siteCards, siteSummary, staleWords, summaryCells, tabCount } from "@/components/record/words";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const model = (input = aboniInput(), over: Partial<SupplierSheetModel> = {}): SupplierSheetModel => ({
  ...buildSheet(input, { supplierId: "id-1", rfqHref: "/app/rfqs/new?supplier=id-1", closeHref: "/app/discover?q=knit", contactCounts: { emails: 1, phones: 6, website: true, representatives: 1 } }),
  ...over,
});
const tabHref = (t: string) => `/app/discover?q=knit&record=x${t === "overview" ? "" : `&tab=${t}`}`;
const view = (m: SupplierSheetModel, props: { mode?: "pane" | "page"; tab?: (typeof TABS)[number]["id"]; backHref?: string | null } = {}) =>
  renderToStaticMarkup(h(RecordView, { model: m, mode: props.mode ?? "pane", tab: props.tab ?? "overview", tabHref, today: TODAY, backHref: props.backHref === undefined ? "/app/discover?q=knit" : props.backHref }));

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

  it("on a phone the page has a navigation bar of its own, stuck to the top, and the name on a plate under it", () => {
    // Founder, 6 Oct 2026: the top "wasn't designed for the mobile phone ... the back button on the
    // top looks very cheap and the company name pushes down".
    const page = view(model(), { mode: "page" });
    const nav = /<div data-record-bar="" class="([^"]*)"><a aria-label="Back to search" class="([^"]*)" href="([^"]*)">/.exec(plain(page));
    assert.ok(nav, "no bar");
    for (const c of ["sticky", "top-0", "z-raised", "h-topbar-phone", "border-b", "bg-surface", "sm:hidden"]) assert.ok(nav[1]!.split(" ").includes(c), `the bar lacks ${c}`);
    assert.ok(nav[2]!.split(" ").includes("h-touch"), "the way back is under 44 tall");
    assert.equal(nav[3], "/app/discover?q=knit", "back is not the search the record was opened from");
    // Opened from a link there is no search behind it, and the app's bars are hidden: back is the search itself.
    assert.match(view(model(), { mode: "page", backHref: null }), /<div data-record-bar=""[^>]*><a aria-label="Back to search" class="[^"]*" href="\/app">/);
    // The tabs stick under the bar from the first paint, before their script has measured it.
    assert.match(page, /<section aria-label="Supplier record" [^>]*class="[^"]*max-sm:\[--record-head:theme\(height\.topbar-phone\)\]/);
    // The name is Paper's 24 on a phone (it was 32, six lines for a long name), on a tonal plate.
    const head = /<header class="([^"]*)"><div [^>]*><h1 class="([^"]*)">/.exec(page);
    assert.ok(head && ["max-sm:bg-subtle", "max-sm:border-b"].every((c) => head[1]!.split(" ").includes(c)), "the name has no plate");
    assert.ok(head[2]!.split(" ").includes("text-xl") && !/max-sm:text-/.test(head[2]!), "the name is not 24 on a phone");
    // The desktop's "Back to results" is not drawn twice on a phone, and the pane has no bar at all.
    assert.match(page, /<div class="[^"]*\bmax-sm:hidden\b[^"]*"><a [^>]*>(?:<svg[\s\S]*?<\/svg>)?Back to results/);
    assert.doesNotMatch(view(model(), { mode: "pane" }), /data-record-bar|max-sm:bg-subtle/, "the drawer a narrow window gets has its own title: no bar, no plate");
    // The tabs' script counts the bar as what sticks over the sections, or a tab's section lands under it.
    assert.match(readFileSync(path.join(dir, "section-tabs.tsx"), "utf8"), /querySelectorAll\(":scope > header, :scope > \[data-record-bar\]"\)/);
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

// The critique of 7 Oct 2026 (`.impeccable/critique/2026-10-07T09-39-14Z__app-app-app.md`, item 1): the
// record's first screen said "Source not linked yet" seven times, each head fact two or three times,
// and jumped from h1 to h3.
describe("the record's first screen says each fact once, with its receipt", () => {
  it("never prints 'Source not linked yet': a fact without a register carries the pending mark and one legend", () => {
    // Aboni holds BGMEA and BKMEA, so every figure names its register; the factory types are the one fact no register is linked to.
    const full = keyFacts(model());
    assert.deepEqual(full.filter((f) => f.pending).map((f) => f.label), ["Factory types"]);
    assert.equal(full.find((f) => f.label === "Factory types")?.values[0]?.text, "Dyeing, Knit, Packaging, Woven", "the subline said Factory; the types it did not say stay");
    assert.equal(pendingLegend(full), "Source pending · 1");
    assert.doesNotMatch(view(model(), { mode: "page" }), /Source not linked/);
    assert.equal(pendingLegend([]), null);
    // Without them the machine count and the capacity are the record's but no register is linked: the mark, once each, and one legend.
    const bare = aboniInput();
    const gone = new Set(["BGMEA", "BKMEA"]);
    bare.profile.supplier.source_tags = bare.profile.supplier.source_tags.filter((t) => !gone.has(t));
    bare.profile.pills = bare.profile.pills.filter((x) => !gone.has(x.source_code));
    bare.profile.provenance = bare.profile.provenance.filter((x) => !gone.has(x.source_code));
    for (const mode of ["page", "pane"] as const) {
      const out = view(model(bare), { mode });
      assert.doesNotMatch(out, /Source not linked/, mode);
      const facts = keyFacts(model(bare));
      const pending = facts.filter((f) => f.pending);
      assert.deepEqual(pending.map((f) => f.label), ["Factory types", "Sewing machines", "Capacity"]);
      assert.ok(pending.every((f) => f.source === null), "a pending fact never also has a source sentence");
      assert.equal(pendingLegend(facts), "Source pending · 3");
      assert.equal((text(out).match(/Source pending · \d+/g) ?? []).length, 1, `${mode}: one legend`);
      // One mark under each pending fact, one in the legend, one on the filed product list's heading.
      assert.equal((out.match(/title="Source pending: /g) ?? []).length, 5, `${mode}: a mark per pending fact`);
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
    // One stale read: once in the Sources section and once in the page's Sources card, in the same words.
    assert.equal(count(model(aboniInput(), { sources: fresh.sources.map((s, i) => (i === 0 ? { ...s, readDate: "26 Jun 2025" } : s)) })), 2);
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
