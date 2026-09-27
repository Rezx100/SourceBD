// Boundary tests for the Messages and Orders rebuild: the HTML a buyer's
// browser receives for the states they see — the empty inbox that says how it
// fills, a failed read that never pretends to be empty, the open thread marked
// current, the order status badges, the tab counts and the milestone timeline.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { ConversationHeader, INBOX_EMPTY_COPY, INBOX_ERROR_COPY, Inbox, type InboxThread } from "./inbox";
import {
  MilestoneTimeline,
  ORDERS_EMPTY_COPY,
  ORDERS_ERROR_COPY,
  OrderStatusBadge,
  OrderTabs,
  OrdersTable,
  inTab,
  parseOrderTab,
  type OrderRow,
  type OrderStatus,
} from "./orders";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const thread = (over: Partial<InboxThread> = {}): InboxThread => ({
  id: "11111111-1111-4111-8111-111111111111",
  supplier_id: "s1",
  supplier_slug: "aboni-knitwear",
  supplier_name: "Aboni Knitwear Limited",
  supplier_entity_type: "factory",
  rfq_id: "22222222-2222-4222-8222-222222222222",
  subject: "Knitted polo shirts",
  last_message_at: null,
  created_at: "2026-09-01T10:00:00Z",
  message_count: 3,
  ...over,
});

const order = (status: OrderStatus, over: Partial<OrderRow> = {}): OrderRow => ({
  id: `order-${status}`,
  supplier_id: "s1",
  supplier_slug: "aboni-knitwear",
  supplier_name: "Aboni Knitwear Limited",
  rfq_id: null,
  po_number: null,
  product_title: `Polo shirts ${status}`,
  quantity: 12000,
  quantity_unit: "pcs",
  unit_price: 3.2,
  currency: "USD",
  total_value: 38400,
  incoterm: "FOB",
  ship_to_country: "GB",
  target_ship_date: "2026-11-01",
  target_delivery_date: null,
  actual_ship_date: null,
  actual_delivery_date: null,
  carrier_name: null,
  tracking_number: null,
  status,
  milestone_count: 0,
  latest_milestone: null,
  viewer_role: "buyer",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-02T10:00:00Z",
  ...over,
});

describe("Messages — the inbox", () => {
  it("an empty inbox teaches how it fills and offers a new RFQ", () => {
    const out = html(createElement(Inbox, { threads: [], error: false }));
    assert.match(out, /No conversations yet/);
    assert.ok(out.includes(INBOX_EMPTY_COPY.replace(/'/g, "&#x27;")), out);
    assert.match(out, /href="\/app\/rfqs\/new"/);
  });

  it("a failed read says so and never draws the empty state", () => {
    const out = html(createElement(Inbox, { threads: [], error: true }));
    assert.match(out, /role="alert"/);
    assert.ok(out.includes(INBOX_ERROR_COPY));
    assert.doesNotMatch(out, /No conversations yet/);
  });

  it("the list page offers 'Pick a conversation' and marks no thread current", () => {
    const out = html(createElement(Inbox, { threads: [thread()], error: false }));
    assert.match(out, /Pick a conversation/);
    assert.match(out, /href="\/app\/messages\/11111111-1111-4111-8111-111111111111"/);
    assert.doesNotMatch(out, /aria-current/);
    assert.match(out, /3 messages/);
  });

  it("the thread page marks the open thread current and hides the list on a phone", () => {
    const other = thread({ id: "33333333-3333-4333-8333-333333333333", supplier_name: "Zaheen Knitwear" });
    const out = html(
      createElement(Inbox, { threads: [thread(), other], error: false, currentId: thread().id }, "CONVERSATION"),
    );
    assert.equal(out.match(/aria-current="page"/g)?.length, 1);
    assert.match(out, /href="\/app\/messages\/11111111-1111-4111-8111-111111111111" aria-current="page"|aria-current="page"[^>]*href="\/app\/messages\/11111111/);
    assert.match(out, /<nav aria-label="Conversations" class="[^"]*hidden lg:block/);
    assert.match(out, /CONVERSATION/);
    assert.doesNotMatch(out, /Pick a conversation/);
  });

  it("the conversation header links the supplier record and the RFQ, and has a Back link", () => {
    const out = html(createElement(ConversationHeader, { thread: thread() }));
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear"/);
    assert.match(out, /href="\/app\/rfqs\/22222222-2222-4222-8222-222222222222"/);
    assert.match(out, /href="\/app\/messages"[^>]*>.*Back to messages/);
    const noRfq = html(createElement(ConversationHeader, { thread: thread({ rfq_id: null }) }));
    assert.doesNotMatch(noRfq, /View RFQ/);
  });
});

describe("Orders — status, tabs and table", () => {
  it("delivered is the one positive status; cancelled is never the sanction red", () => {
    const delivered = html(createElement(OrderStatusBadge, { status: "delivered" }));
    assert.match(delivered, /bg-positive-tint/);
    assert.match(delivered, /Delivered/);
    for (const s of ["draft", "in_production", "shipped", "in_transit", "cancelled"] as const) {
      const out = html(createElement(OrderStatusBadge, { status: s }));
      assert.match(out, /bg-surface-sunken/, s);
      assert.doesNotMatch(out, /sanction|danger/, s);
    }
    assert.match(html(createElement(OrderStatusBadge, { status: "in_production" })), /In production/);
  });

  it("tabs count every order once per tab they belong to, and an unknown tab is All", () => {
    const orders = [order("draft"), order("shipped"), order("delivered"), order("cancelled")];
    assert.equal(orders.filter((o) => inTab(o, "active")).length, 2);
    assert.equal(parseOrderTab("bogus"), "all");
    const out = html(createElement(OrderTabs, { orders, tab: "active" }));
    assert.match(out, /aria-current="page"[^>]*>Active<span[^>]*>2</);
    assert.match(out, />All<span[^>]*>4</);
    assert.match(out, /href="\/app\/orders\?status=delivered"/);
  });

  it("an empty account teaches how orders arrive; a failed read never pretends to be empty", () => {
    const empty = html(createElement(OrdersTable, { rows: [], error: false, tab: "all" }));
    assert.match(empty, /No orders yet/);
    assert.ok(empty.includes(ORDERS_EMPTY_COPY));
    const failed = html(createElement(OrdersTable, { rows: [], error: true, tab: "all" }));
    assert.ok(failed.includes(ORDERS_ERROR_COPY));
    assert.doesNotMatch(failed, /No orders yet/);
    const emptyTab = html(createElement(OrdersTable, { rows: [], error: false, tab: "cancelled" }));
    assert.match(emptyTab, /No cancelled orders\./);
  });

  it("a row opens the order, right-aligns the numbers and counts in the footer", () => {
    const out = html(
      createElement(OrdersTable, {
        rows: [order("shipped", { po_number: "PO-77", latest_milestone: { kind: "qc_passed", label: null, occurred_on: "2026-09-10" } })],
        error: false,
        tab: "all",
      }),
    );
    assert.match(out, /href="\/app\/orders\/order-shipped"/);
    assert.match(out, /after:absolute after:inset-0/);
    assert.match(out, /PO PO-77/);
    assert.match(out, /Qc passed/);
    assert.match(out, /text-right tabular-nums[^"]*">12,000 pcs/);
    assert.match(out, /1–1 of 1/);
  });

  it("the milestone timeline lists each event with its date, and teaches when empty", () => {
    const empty = html(createElement(MilestoneTimeline, { milestones: [] }));
    assert.match(empty, /No milestones logged yet/);
    const out = html(
      createElement(MilestoneTimeline, {
        milestones: [
          { id: "m1", kind: "production_started", label: null, occurred_on: "2026-09-05", notes: null, created_by: null, created_at: "" },
          { id: "m2", kind: "custom", label: "Cutting started", occurred_on: "2026-09-06", notes: "Line 4", created_by: null, created_at: "" },
        ],
      }),
    );
    assert.match(out, /<ol/);
    assert.match(out, /Production started/);
    assert.match(out, /Cutting started/);
    assert.match(out, /dateTime="2026-09-06"/);
    assert.match(out, /Line 4/);
  });
});

describe("Messages and Orders pages stay inside the dashboard kit", () => {
  const ROOT = process.cwd();
  const files = [
    "app/(app)/app/messages/page.tsx",
    "app/(app)/app/messages/[thread]/page.tsx",
    "app/(app)/app/messages/[thread]/thread-realtime.tsx",
    "app/(app)/app/orders/page.tsx",
    "app/(app)/app/orders/new/page.tsx",
    "app/(app)/app/orders/[id]/page.tsx",
    "components/order-create-form.tsx",
    "components/order-milestone-form.tsx",
    "components/order-status-editor.tsx",
  ];
  for (const f of files) {
    it(`${f} imports no components/ui, no Phosphor, and no hex colour`, () => {
      const src = readFileSync(path.join(ROOT, f), "utf8");
      assert.doesNotMatch(src, /from "@\/components\/ui\//);
      assert.doesNotMatch(src, /@phosphor-icons/);
      assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/);
    });
  }
});
