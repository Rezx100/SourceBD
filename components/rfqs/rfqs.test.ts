// The RFQ list, pane and page (B5a): the words and sums a buyer reads (best quote against the
// target, MOQ above the quantity, a lead time that misses ship-by), and what the two routes put
// in the HTML for a filled, an empty and a failed read. Dates are fixed to 4 Oct 2026.
//
// The routes run over a fake Supabase client installed into the module cache before they
// load (the pattern in `app/(app)/app/record-routes.test.ts`).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AcceptBody, acceptNext, postAccept } from "./accept";
import { detailModel, otherRfqLine, type RfqDoc } from "./doc";
import { RfqDetail } from "./detail";
import { RfqPhoneRows } from "./list";
import { RfqTable } from "./table";
import {
  buildListItems,
  chipFor,
  itemsFor,
  listCaption,
  missesShipBy,
  money,
  notRepliedWords,
  parseRfqSort,
  parseRfqTab,
  perUnit,
  quoteTotal,
  rfqsHref,
  shipByWords,
  shortName,
  sortQuotes,
  tabOf,
  versus,
  type DraftRow,
  type OrderLite,
  type QuoteLite,
  type RfqRow,
} from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
let rpcs: Record<string, Answer> = {};
let tables: Record<string, Answer> = {};
const calls: { table: string; ids: unknown }[] = [];
const client = {
  rpc: async (fn: string) => rpcs[fn] ?? { data: null, error: { code: "PGRST202", message: `no function ${fn}` } },
  from: (table: string) => ({
    select: () => ({
      in: async (_col: string, ids: unknown) => {
        calls.push({ table, ids });
        return tables[table] ?? { data: [], error: null };
      },
    }),
  }),
};
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props: unknown) => Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: plain(render(await run())) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

const TODAY = new Date("2026-10-04T00:00:00Z");
const ID1 = "0f1e2d3c-0000-4000-8000-000000000001";
const ID2 = "0f1e2d3c-0000-4000-8000-000000000002";
const ID3 = "0f1e2d3c-0000-4000-8000-000000000003";
const ID4 = "0f1e2d3c-0000-4000-8000-000000000004";

const row = (id: string, over: Partial<RfqRow> = {}): RfqRow => ({
  id,
  product_title: "Men's heavyweight French terry hoodies, 420gsm",
  quantity: 10000,
  quantity_unit: "pcs",
  target_unit_price: 8.9,
  currency: "USD",
  ship_by: "2026-10-15",
  status: "open",
  accepted_quote_id: null,
  target_supplier_count: 3,
  quote_count: 2,
  viewer_role: "buyer",
  created_at: "2026-07-18T10:00:00Z",
  updated_at: "2026-07-18T10:00:00Z",
  ...over,
});

const QUOTES: QuoteLite[] = [
  { rfq_id: ID1, supplier_id: "s-sm", unit_price: 9.3, currency: "USD", moq: 12000, status: "submitted" },
  { rfq_id: ID1, supplier_id: "s-aboni", unit_price: 8.55, currency: "USD", moq: 3000, status: "submitted" },
  { rfq_id: ID1, supplier_id: "s-gone", unit_price: 7.0, currency: "USD", moq: null, status: "withdrawn" },
];
const NAMES = new Map([
  ["s-aboni", "Aboni Knitwear Ltd."],
  ["s-sm", "S M Knitwears Limited"],
  ["s-mondol", "Mondol Fabrics Ltd."],
]);
const ROWS: RfqRow[] = [
  row(ID1),
  row(ID2, { product_title: "Men's cotton trousers", quantity: 4500, target_unit_price: 6.4, ship_by: "2026-12-01", target_supplier_count: 3, quote_count: 0, created_at: "2026-10-01T10:00:00Z" }),
  row(ID3, { product_title: "Women's knitted dresses", quantity: 20000, status: "accepted", target_supplier_count: 1, quote_count: 1, created_at: "2026-07-24T10:00:00Z", accepted_quote_id: "q-m" }),
  row(ID4, { product_title: "Old request", status: "cancelled", quote_count: 0, created_at: "2026-05-01T10:00:00Z" }),
];
const DRAFTS: DraftRow[] = [
  { id: "d1", payload: { product_title: "Knitted polo shirts, 220 gsm", quantity: 12000, quantity_unit: "pcs" }, target_supplier_ids: ["a", "b"], updated_at: "2026-10-02T08:00:00Z" },
];
const ORDERS: OrderLite[] = [{ id: "o1", rfq_id: ID3, po_number: "PO-2026-0917" }];
const MONDOL: QuoteLite = { rfq_id: ID3, supplier_id: "s-mondol", unit_price: 4.2, currency: "USD", moq: null, status: "accepted" };

const items = () => buildListItems({ rows: ROWS, drafts: DRAFTS, quotes: [...QUOTES, MONDOL], names: NAMES, orders: ORDERS, today: TODAY });
const itemOf = (id: string) => items().find((i) => i.id === id)!;

describe("the words", () => {
  it("money, units and the target in the buyer's words", () => {
    assert.equal(money(8.55, "USD"), "US$8.55");
    assert.equal(money(85500, "USD"), "US$85,500");
    assert.equal(money(8.5, "EUR"), "EUR 8.50");
    assert.equal(perUnit("pcs"), "piece");
    assert.equal(perUnit("sets"), "set");
    assert.equal(perUnit("kg"), "kg");
    assert.deepEqual(versus(8.55, 8.9, "USD"), { words: "US$0.35 under target", over: false });
    assert.deepEqual(versus(3.1, 2.95, "USD"), { words: "US$0.15 over target", over: true });
    assert.equal(versus(8.9, 8.9, "USD")?.words, "On target");
    assert.equal(versus(8.9, null, "USD"), null, "a quote against a target nobody set");
  });

  it("a name as a sentence uses it, without the company suffix", () => {
    assert.equal(shortName("Aboni Knitwear Ltd."), "Aboni Knitwear");
    assert.equal(shortName("S M Knitwears Limited"), "S M Knitwears");
    assert.equal(shortName("Mondol Fabrics"), "Mondol Fabrics");
  });

  it("tabs: open with no quote waits, open with quotes is quoted, cancelled and closed are closed", () => {
    assert.equal(tabOf({ status: "open", quote_count: 0 }), "waiting");
    assert.equal(tabOf({ status: "open", quote_count: 1 }), "quoted");
    assert.equal(tabOf({ status: "accepted", quote_count: 1 }), "accepted");
    assert.equal(tabOf({ status: "cancelled", quote_count: 0 }), "closed");
    assert.equal(tabOf({ status: "closed", quote_count: 3 }), "closed");
    assert.equal(chipFor("open", 2).label, "2 quotes");
    assert.equal(chipFor("open", 1).label, "1 quote");
    assert.equal(chipFor("open", 0).label, "Waiting for quotes");
  });

  it("an old link still opens the right tab, and a bad one the whole list", () => {
    assert.equal(parseRfqTab("open"), "waiting");
    assert.equal(parseRfqTab("drafts"), "draft");
    assert.equal(parseRfqTab("closed"), "closed");
    assert.equal(parseRfqTab("bogus"), "all");
    assert.equal(parseRfqTab(["open"]), "all");
    assert.equal(parseRfqSort("ship_by"), "ship_by");
    assert.equal(parseRfqSort("x"), "recent");
    assert.equal(rfqsHref("all"), "/app/rfqs");
    assert.equal(rfqsHref("quoted", ID1, "ship_by"), `/app/rfqs?status=quoted&sort=ship_by&open=${ID1}`);
  });

  it("who has not replied, in words, and nothing once everyone has", () => {
    assert.equal(notRepliedWords(3, 2), "1 supplier has not replied");
    assert.equal(notRepliedWords(50, 4), "46 suppliers have not replied");
    assert.equal(notRepliedWords(2, 2), null);
  });

  it("ship-by says how close it is only for an open RFQ inside 30 days", () => {
    assert.equal(shipByWords("2026-10-15", TODAY, true), "in 11 days");
    assert.equal(shipByWords("2026-11-03", TODAY, true), "in 30 days");
    assert.equal(shipByWords("2026-11-04", TODAY, true), null);
    assert.equal(shipByWords("2026-10-01", TODAY, true), "3 days ago");
    assert.equal(shipByWords("2026-10-15", TODAY, false), null, "an accepted RFQ is not racing the date");
    assert.equal(shipByWords(null, TODAY, true), null);
  });

  it("a lead time that ends after ship-by misses it; the total is the quantity or the MOQ when higher", () => {
    assert.equal(missesShipBy(60, "2026-10-15", TODAY), true);
    assert.equal(missesShipBy(11, "2026-10-15", TODAY), false);
    assert.equal(missesShipBy(null, "2026-10-15", TODAY), false);
    assert.equal(missesShipBy(60, null, TODAY), false);
    assert.equal(quoteTotal(8.55, 10000, 3000), 85500);
    assert.equal(quoteTotal(9.3, 10000, 12000), 111600);
    assert.equal(quoteTotal(9.3, 10000, null), 93000);
  });

  it("quotes that still count come first, cheapest first; an accepted one leads", () => {
    const sorted = sortQuotes([
      { id: "w", status: "withdrawn" as const, unit_price: 1 },
      { id: "b", status: "submitted" as const, unit_price: 9.3 },
      { id: "a", status: "submitted" as const, unit_price: 8.55 },
      { id: "r", status: "rejected" as const, unit_price: 2 },
    ]);
    assert.deepEqual(sorted.map((q) => q.id), ["a", "b", "w", "r"]);
    assert.equal(sortQuotes([{ id: "x", status: "submitted" as const, unit_price: 1 }, { id: "y", status: "accepted" as const, unit_price: 5 }])[0]!.id, "y");
  });
});

describe("the list items", () => {
  it("the best quote is the cheapest that still counts, against the target, with its supplier's short name", () => {
    const i = itemOf(ID1);
    assert.deepEqual(i.best, { price: "US$8.55 per piece", versus: "US$0.35 under target", over: false, supplier: "Aboni Knitwear" });
    assert.deepEqual(i.chip, { tone: "quoted", label: "2 quotes" });
    assert.equal(i.chipNote, "1 supplier has not replied");
    assert.equal(i.detail, "10,000 pieces · target US$8.90 per piece");
    assert.equal(i.shipBy.near, "in 11 days");
    assert.equal(i.paneLine, "10,000 pieces · best US$8.55 per piece, US$0.35 under target");
    assert.equal(i.moqNote, null);
  });

  it("an accepted RFQ shows the quote that was accepted and the order that started", () => {
    const i = itemOf(ID3);
    assert.equal(i.chip.label, "Accepted");
    assert.equal(i.chipNote, "Order PO-2026-0917 started");
    assert.equal(i.best?.price, "US$4.20 per piece");
    assert.equal(i.best?.supplier, "Mondol Fabrics");
    assert.equal(i.shipBy.near, null);
    const noOrder = buildListItems({ rows: [ROWS[2]!], drafts: [], quotes: [MONDOL], names: NAMES, orders: [], today: TODAY })[0]!;
    assert.equal(noOrder.chipNote, "No order yet");
  });

  it("a waiting RFQ says how many have replied, and 'No quotes yet' where the best would be", () => {
    const i = itemOf(ID2);
    assert.equal(i.chip.label, "Waiting for quotes");
    assert.equal(i.chipNote, "0 of 3 replied");
    assert.equal(i.best, null);
    assert.equal(i.bestEmpty, "No quotes yet");
    assert.equal(i.shipBy.near, null, "58 days is not near");
  });

  it("a draft is a row of its own: dashed Draft, saved date, 'Not sent'", () => {
    const d = itemOf("d1");
    assert.equal(d.kind, "draft");
    assert.equal(d.chip.label, "Draft");
    assert.equal(d.chipNote, "Saved 2 Oct 2026");
    assert.equal(d.bestEmpty, "Not sent yet");
    assert.equal(d.sent, null);
    assert.equal(d.suppliers, "2 suppliers");
    assert.equal(d.detail, "12,000 pieces · no target price");
    const untitled = buildListItems({ rows: [], drafts: [{ id: "d2", payload: {}, target_supplier_ids: null, updated_at: "2026-10-03T08:00:00Z" }], quotes: [], names: NAMES, orders: [], today: TODAY })[0]!;
    assert.equal(untitled.title, "Untitled draft");
    assert.equal(untitled.suppliers, "0 suppliers");
  });

  it("quotes that could not be read never read as 'No quotes yet' on a row that has some", () => {
    const out = buildListItems({ rows: [ROWS[0]!, ROWS[1]!], drafts: [], quotes: null, names: NAMES, orders: [], today: TODAY });
    assert.equal(out.find((i) => i.id === ID1)!.bestEmpty, "Open to compare");
    assert.equal(out.find((i) => i.id === ID2)!.bestEmpty, "No quotes yet");
  });

  it("the best price's MOQ above the quantity is a caution on the phone row", () => {
    const rows = [row(ID1, { product_title: "Kids' cotton pyjama sets", quantity: 24000, quantity_unit: "sets", target_unit_price: 2.95, quote_count: 1 })];
    const quotes: QuoteLite[] = [{ rfq_id: ID1, supplier_id: "s-mondol", unit_price: 3.1, currency: "USD", moq: 30000, status: "submitted" }];
    const i = buildListItems({ rows, drafts: [], quotes, names: NAMES, orders: [], today: TODAY })[0]!;
    assert.equal(i.moqNote, "Best price has MOQ 30,000 sets, above your 24,000");
    assert.equal(i.best?.price, "US$3.10 per set");
    assert.equal(i.best?.over, true);
  });

  it("tabs filter, count and sort; the caption counts RFQs sent and quotes received", () => {
    const all = items();
    assert.equal(itemsFor(all, "quoted", "recent").length, 1);
    assert.equal(itemsFor(all, "draft", "recent").length, 1);
    assert.equal(itemsFor(all, "closed", "recent").length, 1);
    assert.deepEqual(itemsFor(all, "all", "ship_by").slice(0, 3).map((i) => i.id), [ID3, ID1, ID4], "soonest ship-by first; ties keep the newest-first order");
    assert.equal(itemsFor(all, "all", "ship_by").at(-1)!.id, "d1", "an RFQ with no ship-by date sorts last");
    assert.equal(listCaption(ROWS, DRAFTS), "5 RFQs · 4 sent · 3 quotes received");
    assert.equal(listCaption([], []), "0 RFQs · 0 sent · 0 quotes received");
  });
});

const doc = (over: Partial<RfqDoc> = {}): RfqDoc => ({
  id: ID1,
  product_title: "Men's heavyweight French terry hoodies, 420gsm",
  product_description: "A first bulk run for the UK market. Black, charcoal and navy.",
  quantity: 10000,
  quantity_unit: "pcs",
  target_unit_price: 8.9,
  currency: "USD",
  ship_to_country: "United Kingdom",
  ship_by: "2026-10-15",
  status: "open",
  accepted_quote_id: null,
  message: "Dear supplier",
  questions: ["Price per piece at this quantity", "MOQ per colour"],
  created_at: "2026-07-18T10:00:00Z",
  updated_at: "2026-07-18T10:00:00Z",
  viewer_role: "buyer",
  targets: [
    { id: "s-aboni", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Savar", district: "Dhaka" },
    { id: "s-sm", slug: "sm-knitwears", company_name: "S M Knitwears Limited", entity_type: "factory", city: "Gazipur", district: null },
    { id: "s-thermax", slug: "thermax", company_name: "Thermax Woven Dyeing Ltd.", entity_type: "factory", city: "Narsingdi", district: null },
  ],
  quotes: [
    { id: "q-sm", supplier_id: "s-sm", supplier_slug: "sm-knitwears", supplier_name: "S M Knitwears Limited", supplier_entity_type: "factory", unit_price: 9.3, currency: "USD", lead_time_days: 75, moq: 12000, valid_until: "2026-10-25", notes: null, status: "submitted", created_at: "2026-07-20T10:00:00Z", updated_at: "2026-07-20T10:00:00Z" },
    { id: "q-aboni", supplier_id: "s-aboni", supplier_slug: "aboni-knitwear", supplier_name: "Aboni Knitwear Ltd.", supplier_entity_type: "factory", unit_price: 8.55, currency: "USD", lead_time_days: 60, moq: 3000, valid_until: "2026-10-30", notes: "Price holds for 30 days.", status: "submitted", created_at: "2026-07-19T10:00:00Z", updated_at: "2026-07-19T10:00:00Z" },
  ],
  thread_id: "t1",
  ...over,
});

describe("the detail model", () => {
  const m = detailModel(doc(), TODAY);

  it("the header says what was asked and to whom, in the buyer's words", () => {
    assert.equal(m.facts, "10,000 pieces · target US$8.90 per piece · ship by 15 Oct 2026 · to the United Kingdom");
    assert.equal(m.sentLine, "Sent 18 Jul 2026 to 3 suppliers, each on their own");
    assert.equal(m.sentLinePane, "Sent 18 Jul 2026 to 3 suppliers · to the United Kingdom");
    assert.equal(m.chip.label, "2 quotes");
    assert.equal(m.quotesTitle, "Quotes · 2");
    assert.equal(m.notReplied, "1 supplier has not replied");
    assert.equal(m.targetHead, "vs US$8.90 target");
  });

  it("quotes come best first with their totals; the quiet supplier is listed after", () => {
    assert.deepEqual(m.quotes.map((q) => q.supplier), ["Aboni Knitwear Ltd.", "S M Knitwears Limited"]);
    const [a, s] = m.quotes;
    assert.equal(a!.price, "US$8.55");
    assert.equal(a!.versus, "US$0.35 under");
    assert.equal(a!.total, "US$85,500");
    assert.equal(a!.place, "Factory · Savar, Dhaka");
    assert.equal(s!.total, "US$111,600", "the MOQ is higher than the quantity, so the total is for the MOQ");
    assert.deepEqual(m.noReply.map((n) => n.supplier), ["Thermax Woven Dyeing Ltd."]);
    assert.equal(m.noReply[0]!.sent, "18 Jul 2026");
  });

  it("a lead time past ship-by and an MOQ above the quantity are cautions in words", () => {
    const [a, s] = m.quotes;
    assert.equal(a!.missWords, "60 days ends after 15 Oct 2026");
    assert.equal(a!.moqWarn, null);
    assert.equal(s!.moqWarn, "Above 10,000");
    assert.equal(s!.moqSentence, "MOQ 12,000 pieces, above your 10,000");
    assert.deepEqual(s!.cautions, ["The 75-day lead time ends after your ship-by date, 15 Oct 2026.", "Their MOQ, 12,000 pieces, is above your 10,000 pieces."]);
    assert.match(m.footnote, /Misses ship-by means the lead time ends after 15 Oct 2026\./);
  });

  it("only a buyer with an open RFQ can accept; a supplier cannot; an accepted RFQ cannot", () => {
    assert.equal(m.canAccept, true);
    assert.equal(detailModel(doc({ viewer_role: "supplier" }), TODAY).canAccept, false);
    assert.equal(detailModel(doc({ status: "accepted" }), TODAY).canAccept, false);
  });

  it("no target price: no 'vs' column head and no difference", () => {
    const n = detailModel(doc({ target_unit_price: null }), TODAY);
    assert.equal(n.targetHead, null);
    assert.equal(n.quotes[0]!.versus, null);
    assert.equal(n.sortWords, "Cheapest first");
    assert.match(n.facts, /no target price/);
  });

  it("other RFQs as a line", () => {
    assert.equal(otherRfqLine({ ...ROWS[1]!, product_title: "Hoodies" }), "Hoodies, 4,500 pieces · waiting for quotes · sent 1 Oct 2026");
  });
});

describe("what a quote is not compared with", () => {
  it("a quote in another currency is never set against the target, never ranked above one in the target's currency, and never the best", () => {
    const eur = { ...doc().quotes[0]!, id: "q-eur", unit_price: 1, currency: "EUR", supplier_id: "s-eur", supplier_slug: "eur-co", supplier_name: "Eur Co" };
    const m = detailModel(doc({ quotes: [eur, ...doc().quotes] }), TODAY);
    assert.equal(m.quotes.at(-1)!.supplier, "Eur Co", "the EUR quote leads the USD ones");
    assert.equal(m.quotes.at(-1)!.versus, null);
    const q: QuoteLite[] = [{ rfq_id: ID1, supplier_id: "s-eur", unit_price: 1, currency: "EUR", moq: null, status: "submitted" }, ...QUOTES];
    const best = buildListItems({ rows: [ROWS[0]!], drafts: [], quotes: q, names: NAMES, orders: [], today: TODAY })[0]!;
    assert.equal(best.best?.price, "US$8.55 per piece");
  });

  it("a supplier is never offered the buyer's Create order, even on their own accepted quote", () => {
    const accepted = doc({ viewer_role: "supplier", status: "accepted", quotes: [{ ...doc().quotes[0]!, status: "accepted" }] });
    const out = plain(renderToStaticMarkup(createElement(RfqDetail, { rfq: accepted, mode: "page", today: TODAY, closeHref: "/app/rfqs" })));
    assert.ok(out.includes("Accepted"));
    assert.doesNotMatch(out, /Create order|Open order|from_quote/);
  });
});

describe("accepting", () => {
  it("says what it closes and what comes next, and repeats the figures and the cautions", () => {
    const q = detailModel(doc(), TODAY).quotes[1]!;
    const out = plain(renderToStaticMarkup(createElement(AcceptBody, { shortName: "S M Knitwears", summary: q.summary, cautions: q.cautions })));
    for (const s of ["US$9.30 per piece", "10,000 pieces", "US$111,600", "75 days", acceptNext("S M Knitwears"), "ship-by date, 15 Oct 2026"]) assert.ok(out.includes(s), s);
    assert.match(acceptNext("Aboni Knitwear"), /closes the RFQ to other quotes/);
    assert.match(out, /role="note"/);
    assert.doesNotMatch(plain(renderToStaticMarkup(createElement(AcceptBody, { shortName: "A", summary: q.summary, cautions: [] }))), /role="note"/);
  });

  it("posts the accept action to the RFQ route, and says why when it fails", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const ok = (async (url: string, init: { body: string }) => {
      seen.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
    assert.equal(await postAccept("q1", ok), null);
    assert.deepEqual(seen, [{ url: "/api/v1/rfqs", body: { action: "accept_quote", quote_id: "q1" } }]);
    const refused = (async () => ({ ok: false, status: 409, json: async () => ({ detail: "rfq is not open" }) })) as unknown as typeof fetch;
    assert.equal(await postAccept("q1", refused), "rfq is not open");
    const bare = (async () => ({ ok: false, status: 500, json: async () => null })) as unknown as typeof fetch;
    assert.match((await postAccept("q1", bare)) ?? "", /error 500/);
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    assert.equal(await postAccept("q1", down), "offline");
  });
});

describe("the table and the phone rows", () => {
  const out = plain(renderToStaticMarkup(createElement(RfqTable, { items: items(), tab: "all", sort: "recent" })));

  it("every RFQ row opens its RFQ beside the list; a draft reopens in the composer", () => {
    assert.ok(out.includes(`href="/app/rfqs?open=${ID1}"`));
    assert.ok(out.includes('href="/app/rfqs/new?draft=d1"'));
    assert.doesNotMatch(out, new RegExp(`href="/app/rfqs/${ID1}"`), "a row jumps to the page");
  });

  it("the columns, the best quote with its difference and supplier, and the ship-by sort", () => {
    for (const h of ["RFQ", "Sent to", "Status", "Best quote vs your target", "Ship by", "Sent"]) assert.ok(out.includes(`>${h}`), h);
    assert.ok(out.includes("US$8.55 per piece"));
    assert.ok(out.includes("US$0.35 under target · Aboni Knitwear"));
    assert.ok(out.includes("in 11 days"));
    assert.ok(out.includes("Order PO-2026-0917 started"));
    assert.ok(out.includes("Not sent yet") && out.includes("Not sent"));
    assert.match(out, /<th[^>]*aria-sort="none"[^>]*><a[^>]*href="\/app\/rfqs\?sort=ship_by"/);
    const sorted = plain(renderToStaticMarkup(createElement(RfqTable, { items: items(), tab: "quoted", sort: "ship_by" })));
    assert.match(sorted, /aria-sort="ascending"/);
    assert.ok(sorted.includes('href="/app/rfqs?status=quoted"'), "the sort toggles back to recent");
  });

  it("the open row is marked and is the only one", () => {
    const o = plain(renderToStaticMarkup(createElement(RfqTable, { items: items(), tab: "all", sort: "recent", currentId: ID2 })));
    assert.equal((o.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(o, /aria-selected="true"/);
  });

  it("a supplier's own RFQ is marked 'As supplier'", () => {
    const o = plain(renderToStaticMarkup(createElement(RfqTable, { items: buildListItems({ rows: [row(ID1, { viewer_role: "supplier" })], drafts: [], quotes: [], names: NAMES, orders: [], today: TODAY }), tab: "all", sort: "recent" })));
    assert.ok(o.includes("As supplier"));
    assert.doesNotMatch(out, /As supplier/);
  });

  it("on a phone a row opens the RFQ as a page, with the price large and the caution in words", () => {
    const phone = plain(renderToStaticMarkup(createElement(RfqPhoneRows, { items: items() })));
    assert.ok(phone.includes(`href="/app/rfqs/${ID1}"`));
    assert.ok(phone.includes('href="/app/rfqs/new?draft=d1"'));
    assert.ok(phone.includes("US$8.55") && phone.includes("per piece · US$0.35 under your target"));
    assert.ok(phone.includes("Sent to 3 suppliers · best from Aboni Knitwear · 10,000 pieces"));
    assert.ok(phone.includes("Mondol Fabrics at US$4.20 per piece · order started"));
  });
});

// ---- the routes ----

const LIST = "app/(app)/app/rfqs/(list)/page.js";
const PAGE = "app/(app)/app/rfqs/[id]/page.js";
const LIST_RPCS = (): Record<string, Answer> => ({
  rfq_list: { data: ROWS, error: null },
  rfq_draft_list: { data: DRAFTS, error: null },
  order_list: { data: [{ id: "o1", rfq_id: ID3, po_number: "PO-2026-0917" }], error: null },
});
const quotesTable = () => ({
  rfq_quotes: { data: [...QUOTES, MONDOL].map((q) => ({ ...q })), error: null },
  suppliers: { data: [...NAMES].map(([id, company_name]) => ({ id, company_name })), error: null },
});

describe("/app/rfqs", () => {
  it("draws the table with the best quotes, and reads quotes only for the buyer's own RFQs that have some", async () => {
    rpcs = LIST_RPCS();
    tables = quotesTable();
    calls.length = 0;
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r);
    assert.ok(r.html.includes("US$8.55 per piece") && r.html.includes("Aboni Knitwear"));
    assert.ok(r.html.includes("5 RFQs · 4 sent · 3 quotes received"));
    assert.match(r.html, /Draft · 1/);
    assert.match(r.html, /Orders · 1/, "the phone switch counts the orders");
    const quoteRead = calls.find((c) => c.table === "rfq_quotes");
    assert.deepEqual((quoteRead?.ids as string[]).slice().sort(), [ID1, ID3].sort());
  });

  it("?open= draws the RFQ in a pane with its Close, and marks its row", async () => {
    rpcs = { ...LIST_RPCS(), rfq_get: { data: doc(), error: null } };
    tables = quotesTable();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID1, status: "quoted" }) }));
    assert.ok("html" in r);
    assert.match(r.html, /aria-label="RFQ: Men's heavyweight French terry hoodies, 420gsm"/);
    assert.match(r.html, /data-record-pane=""/);
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(r.html)?.[0] ?? "", /href="\/app\/rfqs\?status=quoted"/);
    assert.match(r.html, new RegExp(`<tr[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="[^"]*open=${ID1}`));
    assert.ok(r.html.includes("Accept quote"), "the pane lost Accept");
    assert.ok(r.html.includes("Open full page"));
  });

  it("an id that cannot be read is a notice in the pane, never a 404 on the list", async () => {
    rpcs = { ...LIST_RPCS(), rfq_get: { data: null, error: null } };
    tables = quotesTable();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID4 }) }));
    assert.ok("html" in r, `the list threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /This RFQ could not be opened/);
    assert.match(r.html, /Men's cotton trousers/, "the list itself is gone");
    const bad = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: "not-an-id" }) }));
    assert.ok("html" in bad && /This RFQ could not be opened/.test(bad.html));
  });

  it("an RFQ whose read failed says the quotes did not load, under its own title", async () => {
    rpcs = { ...LIST_RPCS(), rfq_get: { data: null, error: { message: "timeout" } } };
    tables = quotesTable();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID1 }) }));
    assert.ok("html" in r);
    assert.match(r.html, /We couldn't load the quotes\./);
    assert.match(r.html, /Your RFQ is safe and suppliers can still reply\./);
    assert.match(r.html, /Try again/);
  });

  it("a failed list says so, with no counts and no empty state standing in", async () => {
    rpcs = { ...LIST_RPCS(), rfq_list: { data: null, error: { message: "boom" } } };
    tables = {};
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r);
    assert.match(r.html, /We couldn't load your RFQs\./);
    assert.match(r.html, /role="alert"/);
    assert.doesNotMatch(r.html, /No RFQs yet|\d+ sent/);
  });

  it("with nothing sent it teaches where an RFQ starts, and a draft alone is not 'no RFQs'", async () => {
    rpcs = { rfq_list: { data: [], error: null }, rfq_draft_list: { data: [], error: null }, order_list: { data: [], error: null } };
    tables = {};
    const empty = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in empty);
    assert.match(empty.html, /No RFQs yet/);
    assert.ok(empty.html.includes('href="/app/discover"') && empty.html.includes('href="/app/rfqs/new"'));
    rpcs.rfq_draft_list = { data: DRAFTS, error: null };
    const draftOnly = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in draftOnly);
    assert.doesNotMatch(draftOnly.html, /No RFQs yet/);
    assert.match(draftOnly.html, /Knitted polo shirts/);
  });

  it("when the quotes cannot be read the rows say to open them, never 'No quotes yet'", async () => {
    rpcs = LIST_RPCS();
    tables = { rfq_quotes: { data: null, error: { message: "denied" } } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r);
    assert.ok(r.html.includes("Open to compare"));
  });

  it("a full 1,000-row page of quotes may be a cut one, so the rows say to open them", async () => {
    rpcs = LIST_RPCS();
    tables = { rfq_quotes: { data: Array.from({ length: 1000 }, () => ({ ...QUOTES[1]! })), error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r);
    assert.ok(r.html.includes("Open to compare"));
  });

  it("without rfq_draft_list or order_list (not migrated) the list still draws", async () => {
    rpcs = { rfq_list: { data: ROWS, error: null } };
    tables = quotesTable();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.ok("html" in r);
    assert.doesNotMatch(r.html, /role="alert"/);
    assert.match(r.html, /Men's cotton trousers/);
  });

  it("a tab shows only its rows", async () => {
    rpcs = LIST_RPCS();
    tables = quotesTable();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ status: "waiting" }) }));
    assert.ok("html" in r);
    assert.match(r.html, /Men's cotton trousers/);
    assert.doesNotMatch(r.html, /Women's knitted dresses/);
    assert.match(r.html, /<a aria-current="page"[^>]*href="\/app\/rfqs\?status=waiting"/);
  });
});

describe("/app/rfqs/[id]", () => {
  it("draws the same RFQ as a page: one h1, the quotes, the order link on an accepted one, the apps bars hidden on a phone", async () => {
    rpcs = { rfq_get: { data: doc(), error: null }, rfq_list: { data: ROWS, error: null }, order_list: { data: [], error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in r);
    assert.equal((r.html.match(/<h1/g) ?? []).length, 1);
    assert.match(r.html, /<h1[^>]*>Men's heavyweight French terry hoodies, 420gsm<\/h1>/);
    assert.match(r.html, /data-detail=""/);
    assert.doesNotMatch(r.html, /data-record-pane/);
    assert.ok(r.html.includes("Back to RFQs"));
    assert.ok(r.html.includes('href="/app/messages/t1"') && r.html.includes("Open messages"));
    assert.ok(r.html.includes('href="/app/suppliers/aboni-knitwear"'));
    assert.ok(r.html.includes("Misses ship-by"));
    assert.ok(r.html.includes("No reply yet · RFQ sent 18 Jul 2026"));
    assert.ok(r.html.includes("Each got its own copy. None sees the others."));
    assert.ok(r.html.includes("Your other RFQs"));
    const accepted = doc({ status: "accepted", accepted_quote_id: "q-aboni", quotes: doc().quotes.map((q) => (q.id === "q-aboni" ? { ...q, status: "accepted" as const } : { ...q, status: "rejected" as const })) });
    rpcs.rfq_get = { data: accepted, error: null };
    const after = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in after);
    assert.ok(after.html.includes('href="/app/orders/new?from_quote=q-aboni"') && after.html.includes("Create order"));
    assert.ok(after.html.includes("Not chosen"));
    rpcs.order_list = { data: [{ id: "o9", rfq_id: ID1, po_number: null }], error: null };
    const withOrder = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in withOrder && withOrder.html.includes('href="/app/orders/o9"') && !withOrder.html.includes("from_quote"));
  });

  it("a supplier sees no Accept on an RFQ they received", async () => {
    rpcs = { rfq_get: { data: doc({ viewer_role: "supplier" }), error: null }, rfq_list: { data: [], error: null }, order_list: { data: [], error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in r);
    assert.doesNotMatch(r.html, /Accept quote/);
    assert.doesNotMatch(r.html, /Open messages/);
  });

  it("an open RFQ offers Accept on each submitted quote, the best one first", async () => {
    rpcs = { rfq_get: { data: doc(), error: null }, rfq_list: { data: [], error: null }, order_list: { data: [], error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in r);
    // Table, compact rows and phone cards each draw their own Accept, per submitted quote.
    assert.equal((r.html.match(/>Accept quote</g) ?? []).length, 6);
    const first = /<button[^>]*class="([^"]*)"[^>]*>Accept quote</.exec(r.html)?.[1] ?? "";
    assert.match(first, /bg-brand/, "the best quote's Accept is the primary one");
  });

  it("an RFQ the caller cannot read is a 404, and no loading state sits above it", async () => {
    rpcs = { rfq_get: { data: null, error: null }, rfq_list: { data: [], error: null }, order_list: { data: [], error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: "nope" }) }));
    assert.ok("threw" in r, "the page rendered an RFQ it could not read");
    assert.match(r.threw, /NOT_FOUND|404/);
    const dir = path.join(process.cwd(), "app", "(app)", "app", "rfqs");
    for (const f of ["loading.tsx", "[id]/loading.tsx"]) assert.ok(!existsSync(path.join(dir, f)), `rfqs/${f} wraps a route that answers 404`);
    assert.ok(existsSync(path.join(dir, "(list)", "loading.tsx")), "the list lost its skeleton");
  });

  it("a read that failed is not a 404: the title stands and the quotes say they did not load", async () => {
    rpcs = { rfq_get: { data: null, error: { message: "timeout" } }, rfq_list: { data: ROWS, error: null }, order_list: { data: [], error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("html" in r, "a failed read became a 404");
    assert.match(r.html, /We couldn't load the quotes\./);
    assert.match(r.html, /<h1[^>]*>Men's heavyweight/);
    rpcs.rfq_list = { data: [], error: null };
    const unknown = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }));
    assert.ok("threw" in unknown, "an RFQ nobody can name and nobody could read is not found");
  });
});
