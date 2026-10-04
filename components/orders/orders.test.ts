// The v4 orders pages (B5c): the words and sums a buyer reads (the tabs, the status, a ship-by date
// that has passed, the four figures, the steps that were logged and who logged them, what an order
// of each status lets the viewer do), what the three routes put in the HTML for a filled, an empty
// and a failed read, and the body the New order page posts. Dates are fixed to 4 Oct 2026.
//
// The routes run over a fake Supabase client installed into the module cache before they load
// (the pattern in `components/rfqs/rfqs.test.ts`).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RfqDoc } from "../rfqs/doc";
import { editPatch, postOrder } from "./actions";
import { OrderDetail, OrderDetailError } from "./detail";
import { OrderPaneRows, OrderPhoneRows, OrdersEmpty, OrdersError, TabEmpty } from "./list";
import { acceptHint, chooserRows, orderMissing, orderPayload, orderValue, valueLine, type OrderFields } from "./new-model";
import { OrdersTable } from "./table";
import {
  buildOrderItems,
  cancelSummary,
  cancelTitle,
  detailGroups,
  inTab,
  listCaption,
  milestoneName,
  orderPowers,
  orderSteps,
  ordersHref,
  parseOrderTab,
  shipLate,
  startedLine,
  summaryCells,
  supplierLine,
  type OrderDoc,
  type OrderRow,
} from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
let rpcs: Record<string, Answer> = {};
let tables: Record<string, Answer> = {};
const VIEWER = "user-viewer";
const client = {
  rpc: async (fn: string) => rpcs[fn] ?? { data: null, error: { code: "PGRST202", message: `no function ${fn}` } },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => tables[table] ?? { data: null, error: null } }),
    }),
  }),
  auth: { getUser: async () => ({ data: { user: { id: VIEWER } }, error: null }) },
};
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const html = (el: ReactElement) => plain(render(el));

async function outcome(run: () => ReactElement | Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: plain(render(await run())) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

const TODAY = new Date("2026-10-04T00:00:00Z");
const id = (n: number) => `0f1e2d3c-0000-4000-8000-00000000000${n}`;
const [ID1, ID2, ID3, ID4, ID5, ID6] = [1, 2, 3, 4, 5, 6].map(id);
const RFQ = id(9);
const QUOTE = id(8);

const row = (oid: string, over: Partial<OrderRow> = {}): OrderRow => ({
  id: oid,
  supplier_id: "s-mondol",
  supplier_slug: "mondol-fabrics",
  supplier_name: "Mondol Fabrics Ltd.",
  rfq_id: null,
  po_number: "PO-2026-0917",
  product_title: "Women's knitted dresses",
  quantity: 20000,
  quantity_unit: "pcs",
  unit_price: 4.2,
  currency: "USD",
  total_value: 84000,
  incoterm: "FOB",
  ship_to_country: "United Kingdom",
  target_ship_date: "2026-10-20",
  target_delivery_date: null,
  actual_ship_date: null,
  actual_delivery_date: null,
  status: "in_production",
  milestone_count: 0,
  latest_milestone: null,
  viewer_role: "buyer",
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  ...over,
});

const ROWS: OrderRow[] = [
  row(ID1, { target_ship_date: "2026-10-01", milestone_count: 2, latest_milestone: { kind: "production_started", label: null, occurred_on: "2026-09-20" } }),
  row(ID2, { status: "draft", product_title: "Kids' pyjama sets", po_number: null, unit_price: null, total_value: null, target_ship_date: null, created_at: "2026-10-02T10:00:00Z" }),
  row(ID3, { status: "shipped", product_title: "Men's cotton trousers", actual_ship_date: "2026-09-28", target_delivery_date: "2026-10-20" }),
  row(ID4, { status: "delivered", product_title: "Polo shirts", actual_delivery_date: "2026-09-30" }),
  row(ID5, { status: "cancelled", product_title: "Old order", updated_at: "2026-09-15T10:00:00Z" }),
  row(ID6, { status: "in_transit", product_title: "Heavyweight hoodies", target_ship_date: null, latest_milestone: { kind: "customs_cleared", label: null, occurred_on: "2026-10-02" } }),
];
const items = () => buildOrderItems(ROWS, TODAY);
const itemOf = (oid: string) => items().find((i) => i.id === oid)!;

describe("the tabs and the status", () => {
  it("a status falls in one tab; In progress holds production, shipped and in transit", () => {
    assert.equal(ROWS.filter((o) => inTab(o, "progress")).length, 3);
    assert.deepEqual(ROWS.filter((o) => inTab(o, "draft")).map((o) => o.id), [ID2]);
    assert.deepEqual(ROWS.filter((o) => inTab(o, "delivered")).map((o) => o.id), [ID4]);
    assert.deepEqual(ROWS.filter((o) => inTab(o, "cancelled")).map((o) => o.id), [ID5]);
    assert.equal(ROWS.filter((o) => inTab(o, "all")).length, 6);
  });

  it("an old ?status=active link opens In progress, a bad one the whole list", () => {
    assert.equal(parseOrderTab("active"), "progress");
    assert.equal(parseOrderTab("delivered"), "delivered");
    assert.equal(parseOrderTab("bogus"), "all");
    assert.equal(parseOrderTab(["draft"]), "all");
    assert.equal(parseOrderTab(undefined), "all");
    assert.equal(ordersHref("all"), "/app/orders");
    assert.equal(ordersHref("progress"), "/app/orders?status=progress");
    assert.equal(ordersHref("progress", ID1), `/app/orders?status=progress&open=${ID1}`);
    assert.equal(ordersHref("all", ID1), `/app/orders?open=${ID1}`);
  });

  it("the caption counts the orders and the ones in progress", () => {
    assert.equal(listCaption(ROWS), "6 orders · 3 in progress");
    assert.equal(listCaption([ROWS[3]!]), "1 order · 0 in progress");
    assert.equal(listCaption([]), "0 orders · 0 in progress");
  });

  it("a step is its label, else its kind in words", () => {
    assert.equal(milestoneName({ kind: "qc_passed", label: null }), "QC passed");
    assert.equal(milestoneName({ kind: "custom", label: "  Sample approved " }), "Sample approved");
    assert.equal(milestoneName({ kind: "some_thing", label: null }), "Some thing");
  });
});

describe("a ship-by date that has passed", () => {
  const at = (status: OrderRow["status"], target_ship_date: string | null) => shipLate({ status, target_ship_date }, TODAY);

  it("is said in days, only on a draft or an order in production", () => {
    assert.equal(at("in_production", "2026-10-01"), "Ship by date passed: 3 days late");
    assert.equal(at("draft", "2026-10-03"), "Ship by date passed: 1 day late");
  });

  it("is nothing today, in the future, with no date, or once goods are on their way", () => {
    assert.equal(at("in_production", "2026-10-04"), null);
    assert.equal(at("in_production", "2026-10-20"), null);
    assert.equal(at("in_production", null), null);
    assert.equal(at("shipped", "2026-10-01"), null);
    assert.equal(at("delivered", "2026-10-01"), null);
    assert.equal(at("cancelled", "2026-10-01"), null);
  });
});

describe("the list items", () => {
  it("an order in production: the title, PO, supplier, value, a late ship-by in words, and the latest step", () => {
    const i = itemOf(ID1);
    assert.equal(i.title, "Women's knitted dresses");
    assert.equal(i.po, "PO-2026-0917");
    assert.equal(i.supplier, "Mondol Fabrics Ltd.");
    assert.equal(i.qty, "20,000 pieces");
    assert.equal(i.value, "US$84,000");
    assert.deepEqual(i.chip, { tone: "production", label: "In production" });
    assert.deepEqual(i.dates, { line: "Ship by 1 Oct 2026", sub: "Production started · 20 Sep 2026", late: "Ship by date passed: 3 days late" });
    assert.equal(i.phone, "Mondol Fabrics Ltd. · US$84,000 · 20,000 pieces");
    assert.equal(i.asSupplier, false);
  });

  it("a draft with no price says so, and when it was saved", () => {
    const i = itemOf(ID2);
    assert.equal(i.value, null);
    assert.equal(i.po, null);
    assert.equal(i.chip.label, "Draft");
    assert.deepEqual(i.dates, { line: "No ship-by date yet", sub: "Saved 2 Oct 2026", late: null });
    assert.equal(i.phone, "Mondol Fabrics Ltd. · no price yet · 20,000 pieces");
  });

  it("shipped says when it left and when it is due; in transit with no dates falls back to the latest step", () => {
    assert.deepEqual(itemOf(ID3).dates, { line: "Shipped 28 Sep 2026", sub: "Due 20 Oct 2026", late: null });
    assert.deepEqual(itemOf(ID6).dates, { line: "Shipped", sub: "Customs cleared · 2 Oct 2026", late: null });
    assert.equal(itemOf(ID6).chip.label, "In transit");
  });

  it("delivered and cancelled say so, with their date", () => {
    assert.deepEqual(itemOf(ID4).dates, { line: "Delivered 30 Sep 2026", sub: null, late: null });
    assert.deepEqual(itemOf(ID5).dates, { line: "Cancelled", sub: "Updated 15 Sep 2026", late: null });
    assert.equal(itemOf(ID5).chip.tone, "cancelled");
  });

  it("an order the buyer is the supplier on is marked", () => {
    const [i] = buildOrderItems([row(ID1, { viewer_role: "supplier" })], TODAY);
    assert.equal(i!.asSupplier, true);
  });
});

const doc = (over: Partial<OrderDoc> = {}): OrderDoc => ({
  id: ID1,
  rfq_id: RFQ,
  accepted_quote_id: QUOTE,
  po_number: "PO-2026-0917",
  product_title: "Women's knitted dresses",
  quantity: 20000,
  quantity_unit: "pcs",
  unit_price: 4.2,
  currency: "USD",
  total_value: 84000,
  incoterm: "FOB",
  origin_port: "Chattogram",
  destination_port: "Felixstowe",
  ship_to_country: "United Kingdom",
  target_ship_date: "2026-10-20",
  target_delivery_date: "2026-11-20",
  actual_ship_date: null,
  actual_delivery_date: null,
  carrier_name: null,
  tracking_number: null,
  status: "in_production",
  notes: "Pack in 12s.",
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
  supplier: { id: "s-mondol", slug: "mondol-fabrics", company_name: "Mondol Fabrics Ltd.", entity_type: "factory", city: "Kashimpur", district: "Gazipur" },
  viewer_role: "buyer",
  // newest first, as `order_get` returns them
  milestones: [
    { id: "m4", kind: "production_started", label: null, occurred_on: "2026-09-20", notes: "Cutting began", created_by: VIEWER, created_at: "2026-09-20T09:00:00Z" },
    { id: "m3", kind: "custom", label: "Sample approved", occurred_on: "2026-09-10", notes: null, created_by: null, created_at: "2026-09-10T09:00:00Z" },
    { id: "m2", kind: "materials_sourced", label: null, occurred_on: "2026-09-05", notes: null, created_by: "supplier-user", created_at: "2026-09-05T09:00:00Z" },
    { id: "m1", kind: "po_issued", label: null, occurred_on: "2026-08-22", notes: null, created_by: VIEWER, created_at: "2026-08-22T09:00:00Z" },
  ],
  ...over,
});

describe("one order", () => {
  it("four figures: value, price, quantity, ship-by; 'No price yet' and 'Not set' where nothing is on file", () => {
    assert.deepEqual(summaryCells(doc()), [
      { label: "Order value", value: "US$84,000" },
      { label: "Price", value: "US$4.20 per piece" },
      { label: "Quantity", value: "20,000 pieces" },
      { label: "Ship by", value: "20 Oct 2026" },
    ]);
    const bare = summaryCells(doc({ unit_price: null, total_value: null, target_ship_date: null }));
    assert.deepEqual(bare.map((c) => c.value), ["No price yet", "No price yet", "20,000 pieces", "Not set"]);
  });

  it("the supplier line is the kind and the place", () => {
    assert.equal(supplierLine(doc().supplier), "Factory · Kashimpur, Gazipur");
    assert.equal(supplierLine({ ...doc().supplier, entity_type: "buying_house", city: null, district: null }), "Buying house");
    assert.equal(supplierLine({ ...doc().supplier, entity_type: "agent", city: "Dhaka", district: null }), "Supplier · Dhaka");
  });

  it("the steps run oldest first, only the ones that were logged, the latest 'now' while it is live", () => {
    const steps = orderSteps(doc(), VIEWER);
    assert.deepEqual(steps.map((s) => s.name), ["PO issued", "Materials sourced", "Sample approved", "Production started"]);
    assert.deepEqual(steps.map((s) => s.status), ["done", "done", "done", "now"]);
    assert.deepEqual(steps.map((s) => s.on), ["2026-08-22", "2026-09-05", "2026-09-10", "2026-09-20"]);
  });

  it("each step says who logged it: you, the supplier, or nobody known; a note follows", () => {
    const steps = orderSteps(doc(), VIEWER);
    assert.deepEqual(steps.map((s) => s.byline), ["Logged by you", "Logged by Mondol Fabrics Ltd.", "Logged", "Logged by you · Cutting began"]);
    assert.equal(orderSteps(doc(), null)[0]!.byline, "Logged by Mondol Fabrics Ltd.", "with no viewer known nothing is called 'you'");
  });

  it("a delivered or cancelled order has no 'now' step, and an order with none logged has no steps", () => {
    assert.ok(orderSteps(doc({ status: "delivered" }), VIEWER).every((s) => s.status === "done"));
    assert.ok(orderSteps(doc({ status: "cancelled" }), VIEWER).every((s) => s.status === "done"));
    assert.deepEqual(orderSteps(doc({ milestones: [] }), VIEWER), []);
  });

  it("shipping and dates list only what is on file; tracking says when it will come, and not on a closed order", () => {
    const g = detailGroups(doc());
    assert.deepEqual(g.map((x) => x.title), ["Shipping", "Dates"]);
    assert.deepEqual(g[0]!.rows, [
      { label: "Incoterm", value: "FOB" },
      { label: "From port", value: "Chattogram" },
      { label: "To port", value: "Felixstowe" },
      { label: "Ship to", value: "United Kingdom" },
      { label: "Tracking", value: "Added when it ships" },
    ]);
    assert.deepEqual(g[1]!.rows, [
      { label: "Ship by", value: "20 Oct 2026" },
      { label: "Deliver by", value: "20 Nov 2026" },
    ]);
    assert.ok(detailGroups(doc({ tracking_number: "MAEU123", carrier_name: "Maersk" }))[0]!.rows.some((r) => r.label === "Tracking" && r.value === "MAEU123"));
    const closed = detailGroups(doc({ status: "delivered" }))[0]!.rows;
    assert.ok(!closed.some((r) => r.label === "Tracking"));
    const none = doc({ incoterm: null, origin_port: null, destination_port: null, ship_to_country: null, target_ship_date: null, target_delivery_date: null, status: "cancelled" });
    assert.deepEqual(detailGroups(none), [], "a group with nothing in it is left out");
  });

  it("where it started: the date, the RFQ it came from, and when it last changed", () => {
    assert.match(startedLine(doc()), /^Started 22 Aug 2026 from your accepted quote · updated /);
    assert.match(startedLine(doc({ rfq_id: null })), /^Started 22 Aug 2026 · updated /);
  });

  it("the cancel dialog names the order, the supplier, the quantity and the value", () => {
    assert.equal(cancelTitle(doc()), "Cancel order PO-2026-0917?");
    assert.equal(cancelTitle(doc({ po_number: null })), "Cancel order Women's knitted dresses?");
    assert.equal(cancelSummary(doc()), "Women's knitted dresses · Mondol Fabrics Ltd. · 20,000 pieces · US$84,000");
    assert.equal(cancelSummary(doc({ total_value: null })), "Women's knitted dresses · Mondol Fabrics Ltd. · 20,000 pieces");
  });
});

describe("what each status lets the viewer do", () => {
  it("a buyer edits and logs steps; cancels only a draft or an order in production", () => {
    assert.deepEqual(orderPowers({ viewer_role: "buyer", status: "draft" }), { buyer: true, edit: true, cancel: true, update: true });
    assert.equal(orderPowers({ viewer_role: "buyer", status: "in_production" }).cancel, true);
    for (const status of ["shipped", "in_transit", "delivered"] as const) {
      const p = orderPowers({ viewer_role: "buyer", status });
      assert.equal(p.cancel, false, `${status} can be cancelled`);
      assert.equal(p.edit, true);
      assert.equal(p.update, true);
    }
  });

  it("a cancelled order can be neither edited, updated nor cancelled again", () => {
    assert.deepEqual(orderPowers({ viewer_role: "buyer", status: "cancelled" }), { buyer: true, edit: false, cancel: false, update: false });
  });

  it("a supplier may log a step and nothing else; a person who is both is the buyer", () => {
    assert.deepEqual(orderPowers({ viewer_role: "supplier", status: "in_production" }), { buyer: false, edit: false, cancel: false, update: true });
    assert.equal(orderPowers({ viewer_role: "both", status: "in_production" }).cancel, true);
  });
});

describe("the detail view", () => {
  const detail = (o: OrderDoc, mode: "pane" | "page" = "page", threadId: string | null = "t1") => html(createElement(OrderDetail, { order: o, mode, today: TODAY, threadId, viewerId: VIEWER, closeHref: "/app/orders?status=progress" }));

  it("a page has one h1 and a way back; a pane has an h2, Close and Open full page", () => {
    const page = detail(doc());
    assert.equal((page.match(/<h1/g) ?? []).length, 1);
    assert.match(page, /<h1[^>]*>Women's knitted dresses<\/h1>/);
    assert.match(page, /data-detail=""/);
    assert.doesNotMatch(page, /data-record-pane/);
    assert.ok(page.includes("Back to orders"));
    const pane = detail(doc(), "pane");
    assert.doesNotMatch(pane, /<h1/);
    assert.match(pane, /<h2[^>]*>Women's knitted dresses<\/h2>/);
    assert.match(pane, /data-record-pane=""/);
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(pane)?.[0] ?? "", /href="\/app\/orders\?status=progress"/);
    assert.ok(pane.includes(`href="/app/orders/${ID1}"`) && pane.includes("Open full page"));
  });

  it("says who the order is with, the figures, the steps in order with who logged them, and the details", () => {
    const out = detail(doc());
    assert.ok(out.includes('href="/app/suppliers/mondol-fabrics"'));
    assert.ok(out.includes("Factory · Kashimpur, Gazipur"));
    assert.ok(out.includes("PO-2026-0917"));
    for (const s of ["US$84,000", "US$4.20 per piece", "20,000 pieces", "Progress · 4 steps", "Logged by you", "Logged by Mondol Fabrics Ltd.", "Cutting began", "Felixstowe", "Pack in 12s."]) assert.ok(out.includes(s), s);
    assert.ok(out.indexOf("PO issued") < out.indexOf("Production started"), "the steps run oldest first");
    assert.ok(out.includes(`href="/app/rfqs/${RFQ}"`) && out.includes("From RFQ"));
  });

  it("Message the supplier is there only when a conversation exists", () => {
    const withThread = detail(doc());
    assert.ok(withThread.includes('href="/app/messages/t1"') && withThread.includes("Message Mondol Fabrics"));
    assert.doesNotMatch(detail(doc(), "page", null), /Message Mondol|\/app\/messages\//);
  });

  it("a buyer sees Add update and the menu; a supplier sees Add update and no menu; a cancelled order has neither", () => {
    const buyer = detail(doc());
    assert.ok(buyer.includes("Add update") && buyer.includes("More actions"));
    const supplier = detail(doc({ viewer_role: "supplier" }));
    assert.ok(supplier.includes("Add update"));
    assert.doesNotMatch(supplier, /More actions/);
    const cancelled = detail(doc({ status: "cancelled" }));
    assert.doesNotMatch(cancelled, /Add update|More actions/);
    assert.doesNotMatch(cancelled, /This order was cancelled/, "its steps are kept and shown");
    assert.match(detail(doc({ status: "cancelled", milestones: [] })), /This order was cancelled\. Nothing was logged on it\./);
  });

  it("an order with no steps says how one gets logged; a late ship-by is in words above the steps", () => {
    const empty = detail(doc({ milestones: [], target_ship_date: "2026-10-01" }));
    assert.ok(empty.includes("Progress · 0 steps") && empty.includes("none logged yet"));
    assert.ok(empty.includes("Nothing logged yet."));
    assert.ok(empty.includes("Ship by date passed: 3 days late"));
  });

  it("a read that failed keeps the title and offers a retry, never an empty order", () => {
    const out = html(createElement(OrderDetailError, { title: "Women's knitted dresses", mode: "page", closeHref: "/app/orders", retryHref: `/app/orders/${ID1}` }));
    assert.match(out, /<h1[^>]*>Women's knitted dresses<\/h1>/);
    assert.ok(out.includes("We couldn't load this order.") && out.includes(`href="/app/orders/${ID1}"`) && out.includes("Try again"));
  });
});

describe("the table, the pane rows and the phone rows", () => {
  const table = html(createElement(OrdersTable, { items: items(), tab: "all" }));

  it("the columns, and every row opens its order beside the list", () => {
    for (const h of ["Order", "Supplier", "Quantity", "Value", "Status", "Ship by · latest update"]) assert.ok(table.includes(`>${h}`), h);
    assert.ok(table.includes(`href="/app/orders?open=${ID1}"`));
    assert.doesNotMatch(table, new RegExp(`href="/app/orders/${ID1}"`), "a row jumps to the page");
    const tabbed = html(createElement(OrdersTable, { items: items(), tab: "progress" }));
    assert.ok(tabbed.includes(`href="/app/orders?status=progress&open=${ID1}"`), "the open link keeps the tab");
  });

  it("figures, PO numbers, a missing price and a late ship-by in words", () => {
    for (const s of ["PO-2026-0917", "No PO number yet", "US$84,000", "No price yet", "20,000 pieces", "In production", "Ship by date passed: 3 days late", "Shipped 28 Sep 2026", "Delivered 30 Sep 2026"]) assert.ok(table.includes(s), s);
  });

  it("the open row is marked and is the only one; a supplier's own order says 'As supplier'", () => {
    const o = html(createElement(OrdersTable, { items: items(), tab: "all", currentId: ID3 }));
    assert.equal((o.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(o, /aria-selected="true"/);
    assert.doesNotMatch(table, /As supplier/);
    const s = html(createElement(OrdersTable, { items: buildOrderItems([row(ID1, { viewer_role: "supplier" })], TODAY), tab: "all" }));
    assert.ok(s.includes("As supplier"));
  });

  it("beside a pane a row is the title and 'PO · supplier', the open one marked", () => {
    const out = html(createElement(OrderPaneRows, { items: items(), tab: "progress", currentId: ID1 }));
    assert.ok(out.includes("PO-2026-0917 · Mondol Fabrics Ltd.") && out.includes("No PO number yet · Mondol Fabrics Ltd."));
    assert.equal((out.match(/aria-current="true"/g) ?? []).length, 1);
    assert.ok(out.includes(`href="/app/orders?status=progress&open=${ID2}"`));
  });

  it("on a phone a row opens the order as a page, with the line, the caution and the dates", () => {
    const out = html(createElement(OrderPhoneRows, { items: items() }));
    assert.ok(out.includes(`href="/app/orders/${ID1}"`));
    assert.ok(out.includes("Mondol Fabrics Ltd. · US$84,000 · 20,000 pieces"));
    assert.ok(out.includes("Ship by date passed: 3 days late"));
    assert.ok(out.includes("Ship by 1 Oct 2026 · Production started · 20 Sep 2026"));
  });

  it("an empty tab says what belongs there; no orders yet teaches where one starts; a failed read says so", () => {
    assert.ok(html(createElement(TabEmpty, { tab: "delivered" })).includes("No delivered orders"));
    const empty = html(createElement(OrdersEmpty));
    assert.ok(empty.includes("No orders yet") && empty.includes('href="/app/orders/new"') && empty.includes('href="/app/rfqs"'));
    assert.doesNotMatch(empty, /planned|late step|3 days late/, "the empty state promises a timeline the data does not hold");
    const err = html(createElement(OrdersError, { retryHref: "/app/orders" }));
    assert.ok(err.includes("We couldn't load your orders.") && err.includes("Try again"));
    assert.doesNotMatch(err, /No orders yet/);
  });
});

// ---- the routes ----

const LIST = "app/(app)/app/orders/(list)/page.js";
const LOADING = "app/(app)/app/orders/(list)/loading.js";
const PAGE = "app/(app)/app/orders/[id]/page.js";
const NEW = "app/(app)/app/orders/new/page.js";
const listRpcs = (): Record<string, Answer> => ({
  order_list: { data: ROWS, error: null },
  rfq_list: { data: [{}, {}, {}], error: null },
  rfq_draft_list: { data: [{}], error: null },
});

describe("/app/orders", () => {
  it("draws the table with the caption, the tabs with their counts, and the phone's switch", async () => {
    rpcs = listRpcs();
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.ok(r.html.includes("6 orders · 3 in progress"));
    assert.ok(r.html.includes("Women's knitted dresses") && r.html.includes("Heavyweight hoodies"));
    assert.match(r.html, /Orders · 6/, "the phone switch counts the orders");
    assert.match(r.html, /RFQs · 4/, "and the RFQs with the drafts");
    assert.match(r.html, /In progress[^<]*(<[^>]+>)*[^<]*3/);
    assert.ok(r.html.includes('href="/app/orders/new"') && r.html.includes("New order"));
  });

  it("a tab shows only its rows, and an old ?status=active opens In progress", async () => {
    rpcs = listRpcs();
    const delivered = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ status: "delivered" }) }) as Promise<ReactElement>);
    assert.ok("html" in delivered);
    assert.match(delivered.html, /Polo shirts/);
    assert.doesNotMatch(delivered.html, /Women's knitted dresses|Old order/);
    assert.match(delivered.html, /<a aria-current="page"[^>]*href="\/app\/orders\?status=delivered"/);
    const active = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ status: "active" }) }) as Promise<ReactElement>);
    assert.ok("html" in active);
    assert.match(active.html, /Heavyweight hoodies/);
    assert.doesNotMatch(active.html, /Polo shirts|Old order/);
    assert.match(active.html, /<a aria-current="page"[^>]*href="\/app\/orders\?status=progress"/);
  });

  it("a tab with nothing in it says what belongs there, not 'No orders yet'", async () => {
    rpcs = { ...listRpcs(), order_list: { data: ROWS.filter((o) => o.status !== "cancelled"), error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ status: "cancelled" }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /No cancelled orders/);
    assert.doesNotMatch(r.html, /No orders yet/);
  });

  it("?open= draws the order in a pane with its Close, and marks its row", async () => {
    rpcs = { ...listRpcs(), order_get: { data: doc(), error: null }, thread_list: { data: [{ id: "t1", supplier_id: "s-mondol", rfq_id: RFQ }], error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID1, status: "progress" }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /aria-label="Order: Women's knitted dresses"/);
    assert.match(r.html, /data-record-pane=""/);
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(r.html)?.[0] ?? "", /href="\/app\/orders\?status=progress"/);
    assert.match(r.html, new RegExp(`<a[^>]*aria-current="true"[^>]*href="[^"]*open=${ID1}|<a[^>]*href="[^"]*open=${ID1}[^"]*"[^>]*aria-current="true"`));
    assert.ok(r.html.includes("Add update") && r.html.includes("Open full page") && r.html.includes("Logged by you"));
    assert.ok(r.html.includes("Message Mondol Fabrics"), "the thread for this supplier and RFQ is offered");
  });

  it("an id that cannot be read is a notice in the pane, never a 404 on the list", async () => {
    rpcs = { ...listRpcs(), order_get: { data: null, error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID4 }) }) as Promise<ReactElement>);
    assert.ok("html" in r, `the list threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /This order could not be opened/);
    assert.match(r.html, /Men's cotton trousers/, "the list itself is gone");
    const bad = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: "not-an-id" }) }) as Promise<ReactElement>);
    assert.ok("html" in bad && /This order could not be opened/.test(bad.html));
  });

  it("an order whose read failed says it did not load, under its own title", async () => {
    rpcs = { ...listRpcs(), order_get: { data: null, error: { message: "timeout" } } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /We couldn't load this order\./);
    assert.match(r.html, /Women's knitted dresses/);
    assert.match(r.html, /Try again/);
  });

  it("a failed list says so, with no counts and no empty state standing in", async () => {
    rpcs = { ...listRpcs(), order_list: { data: null, error: { message: "boom" } } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /We couldn't load your orders\./);
    assert.match(r.html, /role="alert"/);
    assert.doesNotMatch(r.html, /No orders yet|\d+ in progress/);
  });

  it("with no orders an old ?open= link opens no pane beside the teaching state", async () => {
    rpcs = { ...listRpcs(), order_list: { data: [], error: null }, order_get: { data: null, error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /No orders yet/);
    assert.doesNotMatch(r.html, /This order could not be opened|data-record-pane/);
  });

  it("with no orders it teaches where one starts", async () => {
    rpcs = { ...listRpcs(), order_list: { data: [], error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.match(r.html, /No orders yet/);
    assert.ok(r.html.includes('href="/app/orders/new"') && r.html.includes('href="/app/rfqs"'));
    assert.doesNotMatch(r.html, /aria-label="Order status"/, "tabs over nothing");
  });

  it("without rfq_draft_list (not migrated) or with rfq_list failing, the list still draws", async () => {
    rpcs = { order_list: { data: ROWS, error: null } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({}) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.doesNotMatch(r.html, /role="alert"/);
    assert.match(r.html, /Women's knitted dresses/);
  });

  it("has its loading skeleton in the (list) group", async () => {
    const r = await outcome(() => route(LOADING)() as ReactElement);
    assert.ok("html" in r);
    assert.match(r.html, /role="status"/);
    assert.match(r.html, /aria-busy="true"/);
    assert.ok(r.html.includes("Loading orders"));
  });
});

describe("/app/orders/[id]", () => {
  const thread = { thread_list: { data: [{ id: "t1", supplier_id: "s-mondol", rfq_id: RFQ }], error: null } };

  it("draws the same order as a page: one h1, the steps, the supplier, the RFQ it came from, the bars hidden on a phone", async () => {
    rpcs = { order_get: { data: doc(), error: null }, ...thread };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.equal((r.html.match(/<h1/g) ?? []).length, 1);
    assert.match(r.html, /<h1[^>]*>Women's knitted dresses<\/h1>/);
    assert.match(r.html, /data-detail=""/);
    assert.doesNotMatch(r.html, /data-record-pane/);
    assert.ok(r.html.includes("Back to orders"));
    assert.ok(r.html.includes('href="/app/messages/t1"'));
    assert.ok(r.html.includes('href="/app/suppliers/mondol-fabrics"'));
    assert.ok(r.html.includes(`href="/app/rfqs/${RFQ}"`));
    assert.ok(r.html.includes("Logged by you") && r.html.includes("Progress · 4 steps"));
  });

  it("an order the caller cannot read is a 404, and no loading state sits above it", async () => {
    rpcs = { order_get: { data: null, error: null }, ...thread };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: "nope" }) }) as Promise<ReactElement>);
    assert.ok("threw" in r, "the page rendered an order it could not read");
    assert.match(r.threw, /NOT_FOUND|404/);
    const dir = path.join(process.cwd(), "app", "(app)", "app", "orders");
    for (const f of ["loading.tsx", "[id]/loading.tsx", "new/loading.tsx"]) assert.ok(!existsSync(path.join(dir, f)), `orders/${f} wraps a route that answers 404`);
    assert.ok(existsSync(path.join(dir, "(list)", "loading.tsx")), "the list lost its skeleton");
  });

  it("a read that failed is not a 404: the title stands and the page says it did not load", async () => {
    rpcs = { order_get: { data: null, error: { message: "timeout" } }, order_list: { data: ROWS, error: null } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r, "a failed read became a 404");
    assert.match(r.html, /We couldn't load this order\./);
    assert.match(r.html, /<h1[^>]*>Women's knitted dresses/);
    rpcs.order_list = { data: [], error: null };
    const unknown = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }) as Promise<ReactElement>);
    assert.ok("threw" in unknown, "an order nobody can name and nobody could read is not found");
  });

  it("a read that failed with the list unreadable too is still not a 404", async () => {
    rpcs = { order_get: { data: null, error: { message: "timeout" } }, order_list: { data: null, error: { message: "timeout" } } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r, "an outage became a 404");
    assert.match(r.html, /We couldn't load this order\./);
    assert.ok(r.html.includes(`href="/app/orders/${ID1}"`) && r.html.includes("Try again"));
  });

  it("a supplier on the order may log a step and sees no menu", async () => {
    rpcs = { order_get: { data: doc({ viewer_role: "supplier" }), error: null }, ...thread };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: ID1 }) }) as Promise<ReactElement>);
    assert.ok("html" in r);
    assert.ok(r.html.includes("Add update"));
    assert.doesNotMatch(r.html, /More actions/);
  });
});

const rfqRow = (rid: string, over: Record<string, unknown> = {}) => ({
  id: rid,
  product_title: "Women's knitted dresses",
  quantity: 20000,
  quantity_unit: "pcs",
  target_unit_price: 4.5,
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
const rfqDoc = (over: Partial<RfqDoc> = {}): RfqDoc => ({
  id: RFQ,
  product_title: "Men's heavyweight French terry hoodies, 420gsm",
  product_description: null,
  quantity: 10000,
  quantity_unit: "pcs",
  target_unit_price: 8.9,
  currency: "USD",
  ship_to_country: "United Kingdom",
  ship_by: "2026-10-15",
  status: "open",
  accepted_quote_id: null,
  message: "Dear supplier",
  questions: [],
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
    { id: "q-aboni", supplier_id: "s-aboni", supplier_slug: "aboni-knitwear", supplier_name: "Aboni Knitwear Ltd.", supplier_entity_type: "factory", unit_price: 8.55, currency: "USD", lead_time_days: 60, moq: 3000, valid_until: "2026-10-30", notes: null, status: "submitted", created_at: "2026-07-19T10:00:00Z", updated_at: "2026-07-19T10:00:00Z" },
  ],
  thread_id: null,
  ...over,
});

describe("choosing the supplier", () => {
  it("the suppliers of recent RFQs, each once, with the quote they gave or that they have not replied", () => {
    const rows = chooserRows([rfqDoc(), rfqDoc({ id: id(7), product_title: "Older RFQ", quotes: [] })]);
    assert.deepEqual(rows.map((r) => r.name), ["Aboni Knitwear Ltd.", "S M Knitwears Limited", "Thermax Woven Dyeing Ltd."], "a supplier on two RFQs is listed once");
    assert.equal(rows[0]!.line, "Quoted US$8.55 per piece for Men's heavyweight French terry hoodies, 420gsm · Factory · Savar, Dhaka");
    assert.equal(rows[2]!.line, "RFQ sent 18 Jul 2026, no reply yet · Factory · Narsingdi");
    assert.deepEqual(chooserRows([]), []);
  });

  it("a withdrawn quote is not 'Quoted'", () => {
    const d = rfqDoc({ quotes: rfqDoc().quotes.map((q) => ({ ...q, status: "withdrawn" as const })) });
    assert.match(chooserRows([d])[0]!.line, /^RFQ sent 18 Jul 2026, no reply yet/);
  });

  it("'Faster: accept a quote' is the first open RFQ with quotes waiting, and its best price", () => {
    assert.deepEqual(acceptHint([rfqDoc()]), { id: RFQ, title: "Men's heavyweight French terry hoodies, 420gsm", waiting: 2, best: "US$8.55 per piece" });
    assert.equal(acceptHint([rfqDoc({ quotes: [] })]), null);
    assert.equal(acceptHint([rfqDoc({ status: "accepted" })]), null, "an accepted RFQ already has its order");
    assert.equal(acceptHint([]), null);
  });
});

describe("the order's value, and what is posted", () => {
  const fields = (over: Partial<OrderFields> = {}): OrderFields => ({ title: "", quantity: "", unit: "pcs", price: "", currency: "USD", po: "", incoterm: "", originPort: "", destinationPort: "", shipTo: "", shipBy: "", deliverBy: "", notes: "", ...over });

  it("the value is quantity times price, and nothing until both are numbers", () => {
    assert.equal(orderValue("20000", "4.2", "USD"), "US$84,000");
    assert.equal(orderValue("3", "0.1", "USD"), "US$0.30", "no floating-point tail");
    assert.equal(orderValue("", "4.2", "USD"), null);
    assert.equal(orderValue("20000", "", "USD"), null);
    assert.equal(orderValue("0", "4.2", "USD"), null);
    assert.equal(orderValue("abc", "4.2", "USD"), null);
  });

  it("the line under it says what was typed, with the terms when there are some", () => {
    assert.equal(valueLine({ quantity: "20000", unit: "pcs", price: "4.2", currency: "USD", incoterm: "FOB", originPort: "Chattogram" }), "20,000 pieces at US$4.20 per piece, FOB Chattogram");
    assert.equal(valueLine({ quantity: "20000", unit: "sets", price: "4.2", currency: "USD", incoterm: "", originPort: "Chattogram" }), "20,000 sets at US$4.20 per set", "a port with no incoterm is not a term");
    assert.equal(valueLine({ quantity: "", unit: "pcs", price: "4.2", currency: "USD", incoterm: "", originPort: "" }), null);
  });

  it("Create order waits for a product, a quantity and a unit, and says which", () => {
    assert.deepEqual(orderMissing({ title: "", quantity: "", unit: "pcs" }), ["a product", "a quantity"]);
    assert.deepEqual(orderMissing({ title: "Dresses", quantity: "0", unit: "" }), ["a quantity", "a unit"]);
    assert.deepEqual(orderMissing({ title: "Dresses", quantity: "10", unit: "pcs" }), []);
  });

  it("an order from an accepted quote posts the quote, one from a supplier posts the supplier; empty fields are left out", () => {
    const f = fields({ title: " Dresses ", quantity: "20000", price: "4.2", currency: "usd", po: "PO-1", shipBy: "2026-10-20" });
    assert.deepEqual(orderPayload(f, { quoteId: QUOTE }), { action: "create", currency: "USD", accepted_quote_id: QUOTE, product_title: "Dresses", quantity: 20000, quantity_unit: "pcs", unit_price: 4.2, po_number: "PO-1", target_ship_date: "2026-10-20" });
    const bare = orderPayload(fields({ title: "Dresses", quantity: "5", currency: "" }), { supplierId: "s-1" });
    assert.deepEqual(bare, { action: "create", currency: "USD", supplier_id: "s-1", product_title: "Dresses", quantity: 5, quantity_unit: "pcs" });
    assert.ok(!("accepted_quote_id" in bare) && !("unit_price" in bare));
  });
});

describe("editing an order", () => {
  const start = { status: "in_production", incoterm: "FOB", origin_port: "", destination_port: "", ship_to_country: "United Kingdom", target_ship_date: "2026-10-20", target_delivery_date: "", actual_ship_date: "", actual_delivery_date: "", carrier_name: "", tracking_number: "", po_number: "PO-1", notes: "" };

  it("posts only what changed, so a stale status is never written back; an emptied field is sent as empty to clear it", () => {
    assert.deepEqual(editPatch(start, start), {});
    assert.deepEqual(editPatch({ ...start, po_number: "PO-2" }, start), { po_number: "PO-2" });
    assert.deepEqual(editPatch({ ...start, incoterm: "", carrier_name: "Maersk" }, start), { incoterm: "", carrier_name: "Maersk" });
  });
});

describe("posting an order action", () => {
  it("posts the body to the orders route, and says why when it fails", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const ok = (async (url: string, init: { body: string }) => {
      seen.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
    assert.equal(await postOrder({ action: "cancel", order_id: ID1 }, ok), null);
    assert.deepEqual(seen, [{ url: "/api/v1/orders", body: { action: "cancel", order_id: ID1 } }]);
    const refused = (async () => ({ ok: false, status: 409, json: async () => ({ detail: "order has shipped" }) })) as unknown as typeof fetch;
    assert.equal(await postOrder({ action: "cancel", order_id: ID1 }, refused), "order has shipped");
    const bare = (async () => ({ ok: false, status: 500, json: async () => null })) as unknown as typeof fetch;
    assert.match((await postOrder({ action: "cancel", order_id: ID1 }, bare)) ?? "", /error 500/);
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    assert.equal(await postOrder({ action: "cancel", order_id: ID1 }, down), "offline");
  });
});

describe("/app/orders/new", () => {
  const accepted = { id: QUOTE, rfq_id: RFQ, supplier_id: "s-aboni", unit_price: 8.55, currency: "USD", status: "accepted" };
  const supplierRow = (over: Record<string, unknown> = {}) => ({ id: "s-aboni", company_name: "Aboni Knitwear Ltd.", slug: "aboni-knitwear", entity_type: "factory", city: "Savar", district: "Dhaka", is_published: true, is_sanctioned: false, ...over });
  const go = (sp: Record<string, string>) => outcome(() => route(NEW)({ searchParams: Promise.resolve(sp) }) as Promise<ReactElement>);

  it("?from_quote= fills the form from the accepted quote and has no Change", async () => {
    tables = { rfq_quotes: { data: accepted, error: null } };
    rpcs = { rfq_get: { data: rfqDoc(), error: null } };
    const r = await go({ from_quote: QUOTE });
    assert.ok("html" in r, `threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /<h1[^>]*>New order<\/h1>/);
    assert.ok(r.html.includes("Aboni Knitwear Ltd.") && r.html.includes("Factory · Savar, Dhaka"));
    assert.ok(r.html.includes("Men's heavyweight French terry hoodies, 420gsm"));
    assert.match(r.html, /value="10000"/);
    assert.match(r.html, /value="8.55"/);
    assert.ok(r.html.includes("US$85,500"), "the value beside the form");
    assert.ok(r.html.includes("Back to the RFQ") && r.html.includes(`href="/app/rfqs/${RFQ}"`));
    assert.doesNotMatch(r.html, />Change</);
    assert.ok(r.html.includes("Price per piece"));
  });

  it("a quote that already started an order opens that order, not a twin; a cancelled one does not count", async () => {
    tables = { rfq_quotes: { data: accepted, error: null } };
    const made = { id: ID1, rfq_id: RFQ, supplier_id: "s-aboni", status: "in_production" };
    rpcs = { rfq_get: { data: rfqDoc(), error: null }, order_list: { data: [made], error: null } };
    const dup = await go({ from_quote: QUOTE });
    assert.ok("threw" in dup && /NEXT_REDIRECT/.test(dup.threw) && dup.threw.includes(`/app/orders/${ID1}`), JSON.stringify(dup).slice(0, 120));
    rpcs.order_list = { data: [{ ...made, status: "cancelled" }], error: null };
    assert.ok("html" in (await go({ from_quote: QUOTE })), "a cancelled order blocked a new one");
    rpcs.order_list = { data: null, error: { message: "boom" } };
    assert.ok("html" in (await go({ from_quote: QUOTE })), "an unreadable order list blocked the form");
  });

  it("the price label follows the unit the RFQ was in", async () => {
    tables = { rfq_quotes: { data: accepted, error: null } };
    rpcs = { rfq_get: { data: rfqDoc({ quantity_unit: "sets" }), error: null } };
    const r = await go({ from_quote: QUOTE });
    assert.ok("html" in r);
    assert.ok(r.html.includes("Price per set") && !r.html.includes("Price per piece"));
  });

  it("a quote that is not accepted, is not found, or whose supplier is not on its RFQ is a 404; a malformed id goes back to the list", async () => {
    tables = { rfq_quotes: { data: { ...accepted, status: "submitted" }, error: null } };
    rpcs = { rfq_get: { data: rfqDoc(), error: null } };
    const submitted = await go({ from_quote: QUOTE });
    assert.ok("threw" in submitted && /NOT_FOUND|404/.test(submitted.threw));
    tables = { rfq_quotes: { data: null, error: null } };
    const missing = await go({ from_quote: QUOTE });
    assert.ok("threw" in missing && /NOT_FOUND|404/.test(missing.threw));
    tables = { rfq_quotes: { data: { ...accepted, supplier_id: "s-other" }, error: null } };
    const stranger = await go({ from_quote: QUOTE });
    assert.ok("threw" in stranger && /NOT_FOUND|404/.test(stranger.threw));
    const bad = await go({ from_quote: "nope" });
    assert.ok("threw" in bad && /NEXT_REDIRECT/.test(bad.threw) && bad.threw.includes("/app/orders"));
  });

  it("?supplier= opens the form for that supplier, with a way to change and a way back to the orders", async () => {
    tables = { suppliers: { data: supplierRow(), error: null } };
    const r = await go({ supplier: id(5) });
    assert.ok("html" in r, `threw ${"threw" in r ? r.threw : ""}`);
    assert.ok(r.html.includes("Aboni Knitwear Ltd.") && r.html.includes("Back to orders"));
    assert.match(r.html, /<a[^>]*href="\/app\/orders\/new"[^>]*>Change</);
    assert.ok(r.html.includes("Not priced yet"));
    assert.ok(r.html.includes("Add a product, a quantity to create it."), "Create order says what is still needed");
  });

  it("a sanctioned, an unpublished or an unknown supplier never reaches the form", async () => {
    for (const data of [supplierRow({ is_sanctioned: true }), supplierRow({ is_published: false }), null]) {
      tables = { suppliers: { data, error: null } };
      const r = await go({ supplier: id(5) });
      assert.ok("threw" in r && /NOT_FOUND|404/.test(r.threw), JSON.stringify(data));
    }
    tables = { suppliers: { data: null, error: { message: "denied" } } };
    const failed = await go({ supplier: id(5) });
    assert.ok("threw" in failed && /NOT_FOUND|404/.test(failed.threw));
    const bad = await go({ supplier: "nope" });
    assert.ok("threw" in bad && /NEXT_REDIRECT/.test(bad.threw));
  });

  it("with neither it is the chooser: the suppliers the buyer asked, and the 'Faster' card for quotes waiting", async () => {
    rpcs = { rfq_list: { data: [rfqRow(RFQ)], error: null }, rfq_get: { data: rfqDoc(), error: null } };
    const r = await go({});
    assert.ok("html" in r, `threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /<h1[^>]*>New order<\/h1>/);
    assert.ok(r.html.includes("From your RFQs") && r.html.includes("Aboni Knitwear Ltd.") && r.html.includes("Thermax Woven Dyeing Ltd."));
    assert.ok(r.html.includes(`href="/app/orders/new?supplier=s-aboni"`));
    assert.ok(r.html.includes("Faster: accept a quote") && r.html.includes("2 quotes waiting · best US$8.55 per piece"));
    assert.ok(r.html.includes(`href="/app/rfqs/${RFQ}"`) && r.html.includes("Compare quotes"));
    assert.ok(r.html.includes("Type a supplier's name") && r.html.includes("Type to search all suppliers"));
    assert.ok(r.html.includes("These open once you choose a supplier."));
  });

  it("the buyer's cancelled RFQs and ones where they are the supplier are not offered; with none read the chooser still draws", async () => {
    rpcs = { rfq_list: { data: [rfqRow(id(7), { status: "cancelled" }), rfqRow(id(6), { viewer_role: "supplier" })], error: null }, rfq_get: { data: rfqDoc(), error: null } };
    const filtered = await go({});
    assert.ok("html" in filtered);
    assert.doesNotMatch(filtered.html, /From your RFQs|Faster: accept a quote/);
    rpcs = { rfq_list: { data: null, error: { message: "boom" } } };
    const failed = await go({});
    assert.ok("html" in failed);
    assert.ok(failed.html.includes("Type a supplier's name"));
    assert.doesNotMatch(failed.html, /Faster: accept a quote/);
  });
});
