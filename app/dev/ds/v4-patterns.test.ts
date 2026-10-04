// The patterns of Paper's `03 Patterns` (B2): the words they say and what a buyer, a keyboard and
// a screen reader meet. Dates are fixed to 3 Oct 2026, the day the boards were drawn.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AcceptSummary,
  Bubble,
  CertTable,
  ClaimRail,
  ExportsTable,
  FactRow,
  LockedContact,
  LockedContactRow,
  NeedsAttention,
  QuoteComparison,
  Refusal,
  RscBlock,
  SanctionBanner,
  SiteList,
  SourceGroups,
  SourceList,
  SourcesCell,
  Timeline,
  REFUSAL,
  certHeading,
  certWords,
  isApproximate,
  lateWords,
  moqWarning,
  onFileWords,
  sortQuotes,
  usd,
  vsTarget,
  type Quote,
} from "@/components/patterns";
import { V4Patterns } from "./v4-patterns";

const TODAY = new Date("2026-10-03T00:00:00Z");
// Props typed per component demand `children`; `createElement` takes them as arguments (the lint rule).
const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => Parameters<typeof renderToStaticMarkup>[0];
const plain = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

test("every pattern of 03 Patterns has its section in /dev/ds", () => {
  const html = renderToStaticMarkup(createElement(V4Patterns));
  for (const t of ["Source marks", "Fact row", "Certificate row", "RSC block", "Sanction banner", "Locked contact", "Supplier list row", "Quote comparison", "Order timeline", "Chat", "Needs attention", "Locations", "Statement claim to confirm", "Exports"]) {
    assert.ok(html.includes(`data-pattern="${t}"`), t);
  }
});

test("a certificate's words: countdown inside 30 days, the date alone to 90, then valid until", () => {
  const w = (d: string | null) => certWords(d, TODAY);
  assert.deepEqual(w("2026-09-29"), { state: "expired", label: "Expired 29 Sep 2026" });
  assert.deepEqual(w("2026-10-03"), { state: "expiring", label: "Expires today · 3 Oct 2026" });
  assert.deepEqual(w("2026-10-04"), { state: "expiring", label: "Expires in 1 day · 4 Oct 2026" });
  assert.deepEqual(w("2026-10-08"), { state: "expiring", label: "Expires in 5 days · 8 Oct 2026" });
  assert.deepEqual(w("2026-11-02"), { state: "expiring", label: "Expires in 30 days · 2 Nov 2026" });
  assert.deepEqual(w("2026-11-03"), { state: "expiring", label: "Expires 3 Nov 2026" });
  assert.deepEqual(w("2027-01-01"), { state: "expiring", label: "Expires 1 Jan 2027" });
  assert.deepEqual(w("2027-01-02"), { state: "valid", label: "Valid until 2 Jan 2027" });
  assert.deepEqual(w(null), { state: "none", label: "No expiry date published" });
  assert.equal(certHeading(["expired", "expired", "valid", "none"]), "Certificates · 4 · 2 expired");
  assert.equal(certHeading(["valid"]), "Certificates · 1");
});

test("a quote against the target and the MOQ against the quantity, in words", () => {
  assert.equal(vsTarget(6.15, 6.5), "US$0.35 under");
  assert.equal(vsTarget(6.9, 6.5), "US$0.40 over");
  assert.equal(vsTarget(6.5, 6.5), "On target");
  assert.equal(moqWarning(12000, 10000), "12,000 pieces · above your 10,000");
  assert.equal(moqWarning(3000, 10000), null);
  assert.equal(usd(6.15), "US$6.15");
  assert.equal(usd(6), "US$6.00");
  assert.equal(usd(61500), "US$61,500");
  assert.equal(lateWords("2026-09-30", TODAY), "3 days late");
  assert.equal(lateWords("2026-10-02", TODAY), "1 day late");
  assert.equal(lateWords("2026-10-03", TODAY), null);
  assert.equal(isApproximate(69), true);
  assert.equal(isApproximate(70), false);
  assert.equal(isApproximate(null), true);
});

test("the certificates list puts problems first, counts them in the heading and links the document only when there is one", () => {
  const html = plain(
    h(CertTable, {
      today: TODAY,
      certs: [
        { scheme: "OEKO-TEX Standard 100", number: "32597-100", issuer: "OEKO-TEX", expiresOn: null, documentUrl: null },
        { scheme: "GOTS", number: "GOTS-31587", issuer: "TÜV", expiresOn: "2027-05-12", documentUrl: "/d/1" },
        { scheme: "WRAP", number: "7865", issuer: "WRAP", expiresOn: "2026-09-29", documentUrl: "/d/2" },
      ],
    }),
  );
  assert.ok(html.includes("Certificates · 3 · 1 expired"));
  const order = ["WRAP", "GOTS", "OEKO-TEX Standard 100"].map((s) => html.indexOf(`>${s}</span>`));
  assert.ok(order.every((v, i) => i === 0 || v > order[i - 1]!), "expired, then valid, then no expiry on file");
  assert.equal((html.match(/Open certificate/g) ?? []).length, 2, "a certificate with no document has no link");
});

test("a fact row keeps both disagreeing figures with their sources, and the chip only when given", () => {
  const html = plain(
    h(FactRow, {
      label: "Workforce",
      values: [
        { value: "4,200 employees", source: "As declared to BGMEA · checked 24 Jul 2026" },
        { value: "1,230 workers", source: "Counted by RSC · checked 24 Jul 2026" },
      ],
      chip: h("span", null, "Sources disagree"),
    }),
  );
  for (const s of ["4,200 employees", "As declared to BGMEA", "1,230 workers", "Counted by RSC", "Sources disagree"]) assert.ok(html.includes(s), s);
  assert.ok(!plain(h(FactRow, { label: "Year founded", values: [{ value: "1985" }] })).includes("Sources disagree"));
});

test("source marks: tier order with each group named, a name with no mark has no image, a stale date turns caution", () => {
  const groups = plain(h(SourceGroups, { sources: ["ASOS", "WRAP", "BGMEA", "EPB"] }));
  const at = ["Tier 1 · government and RSC", "Tier 2 · trade bodies", "Tier 3 · certification bodies", "Tier 4 · brand supplier lists"].map((t) => groups.indexOf(t));
  assert.ok(at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1]!)));
  assert.equal((groups.match(/<img/g) ?? []).length, 3, "ASOS is a name, not a logo");
  assert.ok(!/<img[^>]*alt="[^"]+"/.test(groups), "the name beside a mark says it, so the mark is decorative");
  const list = plain(h(SourceList, { today: TODAY, sources: [{ source: "BGMEA", checkedOn: "2026-07-24" }, { source: "BKMEA", checkedOn: "2026-05-02" }] }));
  assert.ok(list.includes("Sources · 2") && list.includes("24 Jul 2026"));
  assert.equal((list.match(/font-medium text-caution/g) ?? []).length, 1, "only the date past 90 days turns caution");
  const cell = plain(h(SourcesCell, { sources: ["EPB", "RSC", "BGMEA", "BKMEA", "GOTS", "WRAP", "ASOS", "H&M", "Next", "OEKO-TEX", "BGAPMEA"] }));
  assert.ok(cell.includes("8 more sources"));
  assert.ok(plain(h(SourcesCell, { sources: ["EPB", "RSC", "BGMEA", "BKMEA"] })).includes("1 more source<"));
});

test("locked contact gives counts with their nouns and never a value; nothing on file offers no unlock", () => {
  const locked = plain(h(LockedContact, { emails: 1, phones: 4, action: h("button", null, "Send RFQ") }));
  assert.ok(locked.includes("Email 1 on file · Phone 4 on file") && locked.includes("Contact details are locked.") && locked.includes("Send RFQ"));
  assert.ok(!/@|\+\d|tel:|mailto:/.test(locked));
  const none = plain(h(LockedContact, { emails: 0, phones: 0, action: h("button", null, "Send RFQ") }));
  assert.ok(none.includes("No email or phone on file") && !none.includes("Send RFQ") && !none.includes("locked"));
  assert.ok(plain(h(LockedContact, { emails: 0, phones: 2 })).includes("Phone 2 on file") && !plain(h(LockedContact, { emails: 0, phones: 2 })).includes("Email"));
  // All four kinds, in this order, each with its noun; website is a yes, never a number.
  const all = plain(h(LockedContact, { emails: 1, phones: 6, website: true, representatives: 2 }));
  assert.ok(all.includes("Email 1 on file · Phone 6 on file · Website on file · Contact person 2 on file"));
  const rest = plain(h(LockedContact, { emails: 0, phones: 0, website: true, representatives: 0 }));
  assert.ok(rest.includes("Website on file") && !rest.includes("Email") && !rest.includes("Phone") && !rest.includes("Contact person") && !rest.includes("No email or phone"));
  assert.equal(onFileWords(0, 0, false, 3), "Contact person 3 on file");
  assert.equal(onFileWords(0, 0), null);
  assert.ok(plain(h(LockedContactRow, { emails: 1, phones: 4, website: true, representatives: 1 })).includes("Email 1 on file · Phone 4 on file · Website on file · Contact person 1 on file"));
});

test("the sanction banner has no way to close and refuses the RFQ in words", () => {
  const banner = plain(h(SanctionBanner, { title: "On the UFLPA Entity List since [date of listing].", detail: REFUSAL }));
  assert.ok(banner.includes('role="alert"') && !banner.includes("<button") && !/aria-label="Close/.test(banner));
  assert.ok(plain(h(Refusal, null)).includes("You can't send this supplier an RFQ."));
});

test("the RSC block draws a missing report as a plain line and never a progress bar", () => {
  const reports = { Fire: "/f", Electrical: "/e", Structural: "/s", Boiler: null, "Corrective action plan": "/c" };
  const html = plain(h(RscBlock, { data: { factoryId: "10902", covered: false, remediation: "42% of initial items fixed", training: "Yet to start", workers: "250 workers", reports, checkedOn: "24 Jul 2026" } }));
  assert.ok(html.includes("No longer covered by RSC") && html.includes("Boiler: no report published") && html.includes("42% of initial items fixed"));
  assert.equal((html.match(/<a /g) ?? []).length, 4);
  assert.ok(!/role="progressbar"|<progress|<meter/.test(html));
  assert.ok(plain(h(RscBlock, { data: { factoryId: "9342", covered: true, remediation: null, training: null, workers: null, reports: { ...reports, Boiler: "/b" }, checkedOn: "30 Jul 2026" } })).includes("Covered by RSC"));
});

test("quotes: cheapest first, no-reply rows kept, a sample says so, and the sheet repeats the total", () => {
  const act = h("button", null, "Accept quote");
  const quotes: Quote[] = [
    { status: "quoted", supplier: "S M Knitwears Limited", price: 6.9, moq: 12000, leadDays: 75, validUntil: "25 Oct 2026", action: act },
    { status: "no-reply", supplier: "Thermax Woven Dyeing Ltd.", sentOn: "18 Jul 2026" },
    { status: "quoted", supplier: "Aboni Knitwear Ltd.", price: 6.15, moq: 3000, leadDays: 60, validUntil: "30 Oct 2026", action: act },
  ];
  assert.deepEqual(sortQuotes(quotes).map((q) => q.supplier), ["Aboni Knitwear Ltd.", "S M Knitwears Limited", "Thermax Woven Dyeing Ltd."]);
  const html = plain(h(QuoteComparison, { sample: true, title: "Hoodies", quantity: 10000, shipBy: "15 Oct 2026", target: 6.5, quotes }));
  for (const s of ["Sample figures", "US$0.35 under", "US$0.40 over", "12,000 pieces · above your 10,000", "No reply yet · RFQ sent 18 Jul 2026", "2 quotes, 1 no reply"]) assert.ok(html.includes(s), s);
  assert.ok(!plain(h(QuoteComparison, { title: "Hoodies", quantity: 10000, shipBy: "15 Oct 2026", target: 6.5, quotes })).includes("Sample figures"), "a real quote carries no sample label");
  assert.ok(plain(h(AcceptSummary, { price: 6.15, quantity: 10000, leadDays: 60, sample: true })).includes("US$61,500 in total"));
});

test("the timeline names what is late, marks the current step once, and folds done work on a phone", () => {
  const items = [
    { name: "PO issued", status: "done", on: "2026-08-22", byline: "Logged by you" },
    { name: "Fabric in house", status: "done", on: "2026-09-19", byline: "Logged by Aboni Knitwear Ltd." },
    { name: "Trims in house", status: "planned", on: "2026-09-30", byline: "Planned by Aboni Knitwear Ltd. · not logged yet" },
    { name: "Bulk cutting started", status: "now", on: "2026-10-02", byline: "Logged by Aboni Knitwear Ltd." },
  ];
  const html = plain(h(Timeline, { today: TODAY, items }));
  assert.ok(html.includes("3 days late") && html.includes("Planned 30 Sep 2026") && html.includes("2 milestones done · last 19 Sep 2026"));
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 2, "once in the desktop list and once in the phone list");
});

test("chat: Read appears only under the message marked read, and the supplier's bubble is the white one", () => {
  const read = plain(h(Bubble, { from: "you", meta: "You · 11:22", read: true }, "Thank you, Monday works."));
  assert.ok(read.includes("You · 11:22 · Read"));
  assert.ok(!plain(h(Bubble, { from: "you", meta: "You · 11:05" }, "Tech pack attached.")).includes("Read"));
  const theirs = plain(h(Bubble, { from: "them", meta: "Aboni Knitwear Ltd. · 10:12" }, "Hello"));
  assert.ok(theirs.includes("bg-surface") && theirs.includes("self-start") && !theirs.includes("bg-brand-tint"));
});

test("needs attention counts its rows with the noun and says so when there are none", () => {
  const items = [
    { state: "expired", supplier: "Aboni Knitwear Ltd.", what: "WRAP 7865 expired 29 Sep 2026.", note: "No renewal on file.", action: h("button", null, "Ask for the new certificate") },
    { state: "expiring", supplier: "Mondol Intimates Ltd.", what: "GOTS-26992 expires in 5 days, 8 Oct 2026.", action: h("button", null, "Ask for the renewal") },
  ];
  const html = plain(h(NeedsAttention, { items }));
  assert.ok(html.includes("Needs attention · 2 certificates") && html.includes("Ask for the renewal"));
  assert.ok(plain(h(NeedsAttention, { items: [] })).includes("Nothing needs attention"));
});

test("a site says its kind and precision in words, and the selected one is marked", () => {
  const html = plain(
    h(SiteList, {
      selected: 2,
      sites: [
        { n: 1, kind: "factory-exact", address: "Plot 169", note: "From BGMEA" },
        { n: 2, kind: "factory-approx", address: "Nayapara, Kashimpur, Gazipur", note: "The pin marks the area, not the building." },
        { n: 3, kind: "office", address: "2B/1 Darussalam Road", note: "From BGMEA" },
      ],
    }),
  );
  for (const s of ["Factory · pinned to the address", "Factory · approximate location", "Office · registered and mailing address"]) assert.ok(html.includes(s), s);
  assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
});

test("the statement's download is blocked with its reason in words until every claim is confirmed", () => {
  const fill = h("button", null, "Fill in");
  const blocked = plain(h(ClaimRail, { downloadHref: "/d", claims: [{ label: "How many suppliers", action: fill }, { label: "Which factories", action: fill }] }));
  assert.ok(blocked.includes("Before you download · 2 claims to confirm") && blocked.includes("Confirm 2 claims to download.") && /<button[^>]*disabled=""[^>]*>Download statement/.test(blocked));
  const ready = plain(h(ClaimRail, { downloadHref: "/d", claims: [] }));
  assert.ok(ready.includes('href="/d"') && !ready.includes("Confirm"));
  assert.ok(plain(h(ClaimRail, { downloadHref: "/d", claims: [{ label: "x", action: fill }] })).includes("Confirm 1 claim to download."));
});

test("exports show the HS code in mono and carry none of what the boards forbid", () => {
  const html = plain(
    h(ExportsTable, {
      rows: [{ date: "28 Feb 2026", product: "Women's dresses, cotton knit", hs: "61044200", pieces: 30000, fobPerPiece: 4.06, fobValue: 121800, buyer: "Example Buyer A", destination: "Spain", mode: "Sea", detail: ["Left from Chittagong customs house"] }],
    }),
  );
  assert.ok(html.includes('class="font-mono text-sm text-ink-2">61044200') && html.includes("US$121,800") && html.includes("30,000"));
  assert.ok(!/notify|shipper/i.test(html));
});

// The patterns' own rules, read from their source.
const dir = join(process.cwd(), "components", "patterns");
const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);

test("the patterns have no typed colour, no cut-off text and no score, and import only the kit", () => {
  assert.ok(sources.length >= 15);
  for (const [file, src] of sources) {
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), `${file}: a typed hex colour`);
    assert.ok(!/\btruncate\b|text-ellipsis|line-clamp/.test(code), `${file}: text cut off`);
    assert.ok(!/\b(score|grade|rating|stars?)\b/i.test(code.replace(/"[^"]*"/g, "")), `${file}: a score-like value`);
    assert.ok(!/from "@\/components\/(ui|dashboard)/.test(src), `${file} imports the old kit`);
  }
});
