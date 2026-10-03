// Orders at the boundary a buyer sees (closed-loop §14): the list as a
// workbench — `/app/orders?open=<id>` draws the order beside the table and
// marks its row, a bad id is a notice and never a 404 — the full page's 404,
// one date and money format, the grouped facts, the glyph on every status,
// and forms that stay shut until asked for (no primary at rest; cancelling
// asks inline, not through `window.confirm`).
//
// The routes run over a fake Supabase client installed into the module cache
// before they load (the pattern in `app/(app)/app/record-routes.test.ts`).
// The client handlers run through `hook-harness.ts`, so a test invokes the
// real `onClick` and sees what it posts.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { cancelOrderQuestion, OrderEditForm, OrderStatusEditor } from "@/components/order-status-editor";
import { OrderMilestoneForm } from "@/components/order-milestone-form";
import { Button } from "./controls";
import { callWithHooks, findAll, textOf } from "./hook-harness";
import {
  MILESTONE_KINDS,
  MilestoneTimeline,
  ORDERS_EMPTY_COPY,
  ORDERS_EMPTY_TITLE,
  ORDERS_ERROR_COPY,
  ORDER_STATUS_ICON,
  OrderDetail,
  OrderStatusBadge,
  OrderTabs,
  OrdersTable,
  inTab,
  milestoneKindLabel,
  ordersHref,
  parseOrderTab,
  type OrderDoc,
  type OrderRow,
  type OrderStatus,
} from "./orders";

// ---- a fake `@/lib/supabase/server`, before any route loads ----

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: unknown };
let answers: Record<string, Rpc> = {};
const client = { rpc: async (fn: string) => answers[fn] ?? { data: null, error: { message: `no answer for ${fn}` } } };
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props: unknown) => Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
/** The pane's focus handling reads the app router; a static render has none, so give it one. */
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));

/** `notFound()` throws with a digest; this names what a route reached. */
async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: render(await run()) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

// ---- fixtures ----

const ORDER_ID = "0f1e2d3c-0000-4000-8000-00000000a001";

const row = (id: string, status: OrderStatus, over: Partial<OrderRow> = {}): OrderRow => ({
  id,
  supplier_id: "s1",
  supplier_slug: "aboni-knitwear",
  supplier_name: "Aboni Knitwear Ltd",
  rfq_id: null,
  po_number: null,
  product_title: `Polo shirts ${id}`,
  quantity: 4300,
  quantity_unit: "pcs",
  unit_price: 6.15,
  currency: "USD",
  total_value: 26445,
  incoterm: "FOB",
  ship_to_country: "United Kingdom",
  target_ship_date: "2026-09-12",
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
  updated_at: "2026-09-20T10:00:00Z",
  ...over,
});

const DOC: OrderDoc = {
  id: ORDER_ID,
  rfq_id: "0f1e2d3c-0000-4000-8000-00000000b001",
  accepted_quote_id: null,
  po_number: "PO-77",
  product_title: "Cotton jersey t-shirts",
  quantity: 4300,
  quantity_unit: "pcs",
  unit_price: 6.15,
  currency: "USD",
  total_value: 26550,
  incoterm: "FOB",
  origin_port: "Chattogram",
  destination_port: null,
  ship_to_country: "United Kingdom",
  target_ship_date: "2026-09-12",
  target_delivery_date: null,
  actual_ship_date: null,
  actual_delivery_date: null,
  carrier_name: null,
  tracking_number: "MSKU1234567",
  status: "in_production",
  notes: "Pack in sixes.",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  supplier: { id: "s1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd", entity_type: "factory", city: "Gazipur", district: null },
  viewer_role: "buyer",
  milestones: [{ id: "m1", kind: "po_issued", label: null, occurred_on: "2026-09-03", notes: null, created_by: null, created_at: "" }],
};

const PRIMARY = /bg-brand text-brand-on/g;

// ---- the workbench route ----

describe("/app/orders — the order opens beside the table", () => {
  const LIST = "app/(app)/app/orders/(list)/page.js";

  it("?open= draws the order in a pane with its Close, and marks its row", async () => {
    answers = {
      order_list: { data: [row(ORDER_ID, "in_production"), row("other", "delivered")], error: null },
      order_get: { data: DOC, error: null },
      thread_list: { data: [{ id: "t1", supplier_id: "s1", rfq_id: DOC.rfq_id }], error: null },
    };
    const out = render(await route(LIST)({ searchParams: Promise.resolve({ status: "active", open: ORDER_ID }) }));
    assert.match(out, /data-record-pane=""/, "no pane beside the table");
    assert.match(out, /aria-label="Order: Cotton jersey t-shirts"/);
    // Close returns to the list at its tab.
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(out)?.[0] ?? "", /href="\/app\/orders\?status=active"/);
    // The open row is marked and its link opens it here; the other row is not in this tab at all.
    assert.match(out, new RegExp(`<tr aria-current="true" class="[^"]*bg-accent-tint[^"]*"><td[^>]*><a [^>]*href="/app/orders\\?status=active&amp;open=${ORDER_ID}"`));
    assert.equal((out.match(/aria-current="true"/g) ?? []).length, 1);
    // The conversation the order's RFQ opened, and the RFQ beside its own list.
    assert.match(out, /href="\/app\/messages\/t1"/);
    assert.match(out, /href="\/app\/rfqs\?open=0f1e2d3c-0000-4000-8000-00000000b001"/);
  });

  it("an id that cannot be read is a notice in the pane, never a 404 on the list", async () => {
    answers = { order_list: { data: [row("a", "draft")], error: null }, order_get: { data: null, error: { message: "not found" } } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: "not-an-order" }) }));
    assert.ok("html" in r, `the list threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /This order could not be opened/);
    assert.match(r.html, /Polo shirts a/, "the list itself is gone");
    assert.doesNotMatch(r.html, /aria-current="true"/);
  });

  it("with nothing open there is no pane and each row opens beside the list as a client navigation", async () => {
    answers = { order_list: { data: [row("a", "draft")], error: null } };
    const out = render(await route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.doesNotMatch(out, /data-record-pane/);
    assert.match(out, /href="\/app\/orders\?open=a"/);
    assert.doesNotMatch(out, /href="\/app\/orders\/a"/, "a row still jumps to the page");
  });
});

describe("/app/orders/[id] — the full page for deep links", () => {
  const PAGE = "app/(app)/app/orders/[id]/page.js";

  it("draws the same order as a page: no pane, no Close", async () => {
    answers = { order_get: { data: DOC, error: null }, thread_list: { data: [], error: null } };
    const out = render(await route(PAGE)({ params: Promise.resolve({ id: ORDER_ID }) }));
    assert.match(out, /<h1[^>]*>Cotton jersey t-shirts<\/h1>/);
    assert.doesNotMatch(out, /data-record-pane|aria-label="Close"/);
  });

  it("an order the caller cannot read is a 404", async () => {
    answers = { order_get: { data: null, error: { message: "not found" } } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: "nope" }) }));
    assert.ok("threw" in r, "the page rendered an order it could not read");
    assert.match(r.threw, /NOT_FOUND|404/);
  });

  it("no loading state sits above it, so the 404 is a status code and not a streamed 200", () => {
    const dir = path.join(process.cwd(), "app", "(app)", "app", "orders");
    for (const f of ["loading.tsx", "[id]/loading.tsx", "new/loading.tsx"]) {
      assert.ok(!existsSync(path.join(dir, f)), `orders/${f} wraps a route that answers 404`);
    }
    assert.ok(existsSync(path.join(dir, "(list)", "loading.tsx")), "the list lost its table skeleton");
  });
});

// ---- the list: tabs, empty and failed reads (moved here from messages-orders.test.ts) ----

describe("Orders — tabs and table", () => {
  it("tabs count every order once per tab they belong to, and an unknown tab is All", () => {
    const orders = [row("a", "draft"), row("b", "shipped"), row("c", "delivered"), row("d", "cancelled")];
    assert.equal(orders.filter((o) => inTab(o, "active")).length, 2);
    assert.equal(parseOrderTab("bogus"), "all");
    const out = render(createElement(OrderTabs, { orders, tab: "active" }));
    assert.match(out, /aria-current="page"[^>]*>Active<span[^>]*>2</);
    assert.match(out, />All<span[^>]*>4</);
    assert.match(out, /href="\/app\/orders\?status=delivered"/);
  });

  it("an empty account teaches how orders arrive; a failed read never pretends to be empty", () => {
    const empty = render(createElement(OrdersTable, { rows: [], error: false, tab: "all" }));
    assert.match(empty, new RegExp(ORDERS_EMPTY_TITLE));
    assert.ok(empty.includes(ORDERS_EMPTY_COPY));
    const failed = render(createElement(OrdersTable, { rows: [], error: true, tab: "all" }));
    assert.ok(failed.includes(ORDERS_ERROR_COPY));
    assert.doesNotMatch(failed, new RegExp(ORDERS_EMPTY_TITLE));
    assert.match(render(createElement(OrdersTable, { rows: [], error: false, tab: "cancelled" })), /No cancelled orders\./);
  });

  it("the whole row is the link, numbers are right-aligned, and the footer counts", () => {
    const out = render(createElement(OrdersTable, { rows: [row("a", "shipped", { po_number: "PO-77" })], error: false, tab: "all" }));
    assert.match(out, /after:absolute after:inset-0/);
    assert.match(out, /PO PO-77/);
    assert.match(out, /text-right tabular-nums[^"]*">4,300 pcs/);
    assert.match(out, /1–1 of 1/);
    // Beside an open order the table narrows to what names an order.
    const narrow = render(createElement(OrdersTable, { rows: [row("a", "shipped")], error: false, tab: "all", openId: "a" }));
    assert.doesNotMatch(narrow, />Quantity<|>Value<|>Updated</);
    assert.match(narrow, /Aboni Knitwear Ltd/, "the supplier left the narrow row");
  });
});

describe("the orders routes and forms stay inside the dashboard kit", () => {
  for (const f of [
    "app/(app)/app/orders/(list)/page.tsx",
    "app/(app)/app/orders/new/page.tsx",
    "app/(app)/app/orders/[id]/page.tsx",
    "components/order-create-form.tsx",
    "components/order-milestone-form.tsx",
    "components/order-status-editor.tsx",
  ]) {
    it(`${f} imports no components/ui, no Phosphor, no hex colour, and no browser-locale date`, () => {
      const src = readFileSync(path.join(process.cwd(), f), "utf8");
      assert.doesNotMatch(src, /from "@\/components\/ui\//);
      assert.doesNotMatch(src, /@phosphor-icons/);
      assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/);
      assert.doesNotMatch(src, /toLocale(?:Date)?String\(\)|window\.confirm/);
    });
  }
});

// ---- one format, grouped facts, glyphs ----

describe("the order, drawn", () => {
  const pane = render(createElement(OrderDetail, { order: DOC, threadId: null, mode: "pane", closeHref: "/app/orders" }));

  it("dates read 12 Sep 2026 and money 6.15 USD, the same in the table and the order", () => {
    const table = render(createElement(OrdersTable, { rows: [row("a", "shipped", { latest_milestone: { kind: "qc_passed", label: null, occurred_on: "2026-09-10" } })], error: false, tab: "all" }));
    for (const s of ["12 Sep 2026", "26,445.00 USD", "4,300 pcs", "QC passed · 10 Sep 2026", "20 Sep 2026"]) assert.ok(table.includes(s), `table: ${s}`);
    for (const s of ["12 Sep 2026", "6.15 USD", "26,550.00 USD", "4,300 pcs", "Created 1 Sep 2026", "3 Sep 2026"]) assert.ok(pane.includes(s), `order: ${s}`);
    // No browser-locale date and no bare decimals.
    assert.doesNotMatch(table + pane, /\d{1,2}\/\d{1,2}\/\d{4}|26,550 USD|26550/);
  });

  it("milestone kinds read in the buyer's words", () => {
    assert.equal(milestoneKindLabel("po_issued"), "PO issued");
    assert.equal(milestoneKindLabel("qc_passed"), "QC passed");
    assert.equal(milestoneKindLabel("some_new_kind"), "Some new kind");
    const tl = render(createElement(MilestoneTimeline, { milestones: DOC.milestones }));
    assert.match(tl, />PO issued</);
    assert.doesNotMatch(tl, /Po issued/);
  });

  it("the facts sit in three groups with their counts, only what is on file, notes last", () => {
    assert.match(pane, /Commercial<span[^>]*>5<\/span>/);
    assert.match(pane, /Route<span[^>]*>4<\/span>/);
    assert.match(pane, /Dates<span[^>]*>1<\/span>/);
    assert.ok(pane.includes("Tracking number") && pane.includes("MSKU1234567"));
    assert.doesNotMatch(pane, /Tracking #|>Carrier<|Destination port|Target delivery/, "a fact not on file is drawn");
    assert.ok(pane.lastIndexOf("Pack in sixes.") > pane.indexOf("Target ship"), "notes are not last");
  });

  it("every status but draft carries a glyph, and delivered alone is positive", () => {
    for (const s of ["draft", "in_production", "shipped", "in_transit", "delivered", "cancelled"] as const) {
      const out = render(createElement(OrderStatusBadge, { status: s }));
      assert.equal(/<svg/.test(out), ORDER_STATUS_ICON[s] !== undefined, s);
      assert.match(out, s === "delivered" ? /bg-positive-tint/ : /bg-surface-sunken/, s);
    }
    assert.deepEqual(
      { ...ORDER_STATUS_ICON },
      { draft: undefined, in_production: "clock", shipped: "box", in_transit: "box", delivered: "check-c", cancelled: "x" },
    );
  });

  it("at rest the order has no primary: the forms are shut behind secondary buttons", () => {
    assert.equal((pane.match(PRIMARY) ?? []).length, 0);
    assert.match(pane, /Log milestone/);
    assert.match(pane, /Edit order/);
    assert.doesNotMatch(pane, /<form/);
    // Pane mode is one column; the page's three columns start at `xl`.
    assert.doesNotMatch(pane, /grid-cols-\[/);
    const page = render(createElement(OrderDetail, { order: DOC, threadId: null, mode: "page" }));
    assert.match(page, /xl:grid-cols-\[22rem_minmax\(0,1fr\)_20rem\]/);
  });

  it("ordersHref keeps the tab and drops the open order for Close", () => {
    assert.equal(ordersHref("all"), "/app/orders");
    assert.equal(ordersHref("delivered", "o1"), "/app/orders?status=delivered&open=o1");
  });
});

// ---- the forms, invoked ----

const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};
function stub(name: string, value: unknown) {
  if (!(name in saved)) saved[name] = g[name];
  g[name] = value;
}
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) g[k] = v;
  for (const k of Object.keys(saved)) delete saved[k];
});

const contexts = (r: { refresh(): void }) => new Map<unknown, unknown>([[AppRouterContext, r]]);
const buttonNamed = (tree: unknown, label: string) => {
  const found = findAll(tree as never, (el) => el.type === Button && textOf(el.props.children as never).trim() === label);
  assert.equal(found.length, 1, `expected one "${label}" button, found ${found.length}`);
  return found[0]!;
};
const INITIAL = {
  status: "in_production" as const,
  incoterm: "FOB",
  origin_port: null,
  destination_port: null,
  ship_to_country: null,
  target_ship_date: null,
  target_delivery_date: null,
  actual_ship_date: null,
  actual_delivery_date: null,
  carrier_name: null,
  tracking_number: null,
  po_number: null,
  notes: null,
};

describe("the order's forms open on demand", () => {
  it("Log milestone is a secondary that opens the form; the form's Save is the primary", () => {
    // Hook order: state 0 open.
    const shut = callWithHooks(OrderMilestoneForm, { orderId: ORDER_ID, kinds: MILESTONE_KINDS }, { contexts: contexts(router) });
    const log = buttonNamed(shut.out, "Log milestone");
    assert.equal(log.props.variant, undefined, "Log milestone is not the secondary tier");
    (log.props.onClick as () => void)();
    assert.deepEqual(shut.sets, [{ hook: 0, value: true }]);
    const open = callWithHooks(OrderMilestoneForm, { orderId: ORDER_ID, kinds: MILESTONE_KINDS }, { contexts: contexts(router), state: [true] });
    assert.equal(buttonNamed(open.out, "Add milestone").props.variant, "primary");
    assert.equal(buttonNamed(open.out, "Discard").props.variant, "ghost");
  });

  it("Edit order opens the editor, whose Save is the primary; Tracking number says so", () => {
    const shut = callWithHooks(OrderStatusEditor, { orderId: ORDER_ID, initial: INITIAL }, { contexts: contexts(router) });
    const edit = buttonNamed(shut.out, "Edit order");
    assert.equal(edit.props.variant, undefined);
    (edit.props.onClick as () => void)();
    assert.deepEqual(shut.sets, [{ hook: 0, value: true }]);
    const form = callWithHooks(OrderEditForm, { orderId: ORDER_ID, initial: INITIAL, onClose() {}, onSaved() {} });
    assert.equal(buttonNamed(form.out, "Save changes").props.variant, "primary");
    const html = renderToStaticMarkup(form.out as ReactElement);
    assert.match(html, />Tracking number</);
    assert.doesNotMatch(html, /Tracking #/);
  });

  it("Cancel order asks inline, and only the confirm row's Cancel order posts", async () => {
    const posts: unknown[] = [];
    let refreshes = 0;
    let confirms = 0;
    stub("window", {
      confirm: () => {
        confirms += 1;
        return true;
      },
    });
    stub("fetch", async (url: string, init: { body: string }) => {
      posts.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    const r = { refresh: () => (refreshes += 1) };
    // Hook order: state 0 open, 1 confirming.
    const shut = callWithHooks(OrderStatusEditor, { orderId: ORDER_ID, initial: INITIAL }, { contexts: contexts(r) });
    const ask = buttonNamed(shut.out, "Cancel order");
    assert.equal(ask.props.variant, "ghost");
    (ask.props.onClick as () => void)();
    assert.deepEqual(shut.sets, [{ hook: 1, value: true }]);
    assert.equal(posts.length, 0, "the first Cancel order posted");

    const asking = callWithHooks(OrderStatusEditor, { orderId: ORDER_ID, initial: INITIAL }, { contexts: contexts(r), state: [false, true] });
    const html = renderToStaticMarkup(asking.out as ReactElement);
    assert.ok(html.includes("Cancel this order? Its details and milestones stay on file."));
    // With a PO, the confirmation names it (OR-02).
    const withPo = callWithHooks(OrderStatusEditor, { orderId: ORDER_ID, initial: { ...INITIAL, po_number: "PO-4471" } }, { contexts: contexts(r), state: [false, true] });
    assert.ok(renderToStaticMarkup(withPo.out as ReactElement).includes("Cancel order PO-4471? Its details and milestones stay on file."));
    assert.equal(cancelOrderQuestion("  "), cancelOrderQuestion(null));
    assert.equal(buttonNamed(asking.out, "Keep").props.variant, "ghost");
    const yes = buttonNamed(asking.out, "Cancel order");
    assert.equal(yes.props.variant, "danger");
    await (yes.props.onClick as () => Promise<void>)();
    assert.deepEqual(posts, [{ url: "/api/v1/orders", body: { action: "cancel", order_id: ORDER_ID } }]);
    assert.equal(refreshes, 1);
    assert.equal(confirms, 0, "window.confirm is back");
  });

  it("a shipped, in-transit or delivered order offers no Cancel order (OR-02)", () => {
    for (const status of ["shipped", "in_transit", "delivered"] as const) {
      const out = callWithHooks(OrderStatusEditor, { orderId: ORDER_ID, initial: { ...INITIAL, status } }, { contexts: contexts({ refresh() {} }) });
      const html = renderToStaticMarkup(out.out as ReactElement);
      assert.doesNotMatch(html, /Cancel order/, status);
      assert.match(html, /Edit order/, status);
    }
  });
});
