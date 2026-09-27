// The RFQ pages at the boundary a buyer sees (closed-loop §14): the HTML the
// list and the RFQ render for an empty, failed and filled `rfq_list`, the
// drafts, an accepted RFQ and an open one; the list as a workbench —
// `/app/rfqs?open=<id>` draws the RFQ beside it and marks its row, a bad id is
// a notice and never a 404 — and an Accept that posts only after its confirm.
//
// The routes run over a fake Supabase client installed into the module cache
// before they load (the pattern in `app/(app)/app/record-routes.test.ts`).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ACCEPT_CLOSES_COPY, AcceptQuoteRows } from "@/components/accept-quote-button";
import { Button } from "./controls";
import { callWithHooks, findAll, textOf } from "./hook-harness";
import { missingFields } from "./rfq-composer";
import {
  RFQ_EMPTY_BODY,
  RFQ_EMPTY_TITLE,
  RfqDetailBody,
  RfqListBody,
  parseRfqTab,
  rfqTabOf,
  rfqsHref,
  type RfqDoc,
  type RfqDraft,
  type RfqRow,
  RFQ_ERROR_COPY,
  type RfqView,
} from "./rfq-pages";

// ---- a fake `@/lib/supabase/server`, before any route loads ----

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: unknown };
let answers: Record<string, Rpc> = {};
const client = { rpc: async (fn: string) => answers[fn] ?? { data: null, error: { code: "PGRST202", message: `no function ${fn}` } } };
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props: unknown) => Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
/** The pane's focus handling reads the app router; a static render has none, so give it one. */
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));

async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: render(await run()) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

const PRIMARY = /bg-brand text-brand-on/g;
const TODAY = new Date("2026-09-27T00:00:00Z");

const row = (id: string, over: Partial<RfqRow>): RfqRow => ({
  id,
  product_title: `Product ${id}`,
  quantity: 12000,
  quantity_unit: "pcs",
  ship_by: null,
  status: "open",
  target_supplier_count: 1,
  quote_count: 0,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  viewer_role: "buyer",
  ...over,
});

const ROWS: RfqRow[] = [
  row("a", {}),
  row("b", { quote_count: 2, target_supplier_count: 3 }),
  row("c", { status: "accepted", quote_count: 1 }),
  row("d", { status: "cancelled" }),
];

const DRAFTS: RfqDraft[] = [
  { id: "d1", payload: { product_title: "Fleece hoodies" }, target_supplier_ids: ["s1", "s2"], updated_at: "2026-09-12T08:00:00Z" },
  { id: "d2", payload: {}, target_supplier_ids: null, updated_at: "2026-09-13T08:00:00Z" },
];

const list = (rows: RfqRow[] | null, tab: RfqView = "all", extra: { drafts?: RfqDraft[]; openId?: string | null } = {}) =>
  renderToStaticMarkup(createElement(RfqListBody, { rows, tab, today: TODAY, ...extra }));

describe("RFQ list", () => {
  it("an empty list teaches where an RFQ starts, with a way there", () => {
    const out = list([]);
    assert.ok(out.includes(RFQ_EMPTY_TITLE) && out.includes(RFQ_EMPTY_BODY));
    assert.match(RFQ_EMPTY_BODY, /record/);
    assert.match(RFQ_EMPTY_BODY, /tick/);
    assert.ok(out.includes('href="/app/discover"'), "no way to start an RFQ");
    assert.ok(out.includes("0 sent · 0 quotes"));
    assert.ok(!out.includes('aria-label="RFQ status"'), "status tabs over nothing");
  });

  it("the header's way to start is Find suppliers, a secondary — not a primary New RFQ", () => {
    const out = list(ROWS);
    assert.match(out, /Find suppliers/);
    assert.doesNotMatch(out, /New RFQ/);
    assert.equal((out.match(PRIMARY) ?? []).length, 0);
  });

  it("a failed read says so, with no counts and no empty state standing in", () => {
    const out = list(null);
    assert.ok(out.includes(RFQ_ERROR_COPY));
    assert.ok(out.includes('role="alert"'));
    assert.ok(!out.includes(RFQ_EMPTY_TITLE));
    assert.ok(!/\d+ sent/.test(out));
  });

  it("the heading counts sent RFQs and quotes; each tab counts its rows", () => {
    const out = list(ROWS);
    assert.ok(out.includes("4 sent · 3 quotes"));
    for (const [label, n] of [["All", 4], ["Open", 1], ["Quoted", 1], ["Accepted", 1], ["Closed", 1]] as const) {
      assert.match(out, new RegExp(`${label}<span[^>]*>${n}</span>`), `${label} tab count`);
    }
  });

  it("positive is for an accepted quote only: quoted, open and cancelled are neutral", () => {
    const out = list(ROWS);
    // The class of the badge whose own text is `label` (an icon svg may precede it).
    const badge = (label: string) =>
      new RegExp(`<span class="([^"]*)">(?:<svg(?:(?!</svg>).)*</svg>)?${label}</span>`).exec(out)?.[1] ?? "";
    assert.match(badge("Quoted · 2"), /bg-surface-sunken/);
    assert.match(badge("Quote accepted"), /bg-positive-tint/);
    assert.match(badge("Open · no quote yet"), /bg-surface-sunken/);
    assert.match(badge("Cancelled"), /bg-surface-sunken/);
    assert.ok(!out.includes("bg-sanction"), "the sanction red is for sanctions only");
  });

  it("a tab shows only its rows, marks itself current, and every row opens its RFQ beside the list", () => {
    const out = list(ROWS, "quoted");
    assert.ok(out.includes('href="/app/rfqs?status=quoted&amp;open=b"'));
    assert.ok(!out.includes("open=a"));
    assert.doesNotMatch(out, /href="\/app\/rfqs\/b"/, "a row still jumps to the page");
    assert.match(out, /<a aria-current="page"[^>]*href="\/app\/rfqs\?status=quoted"/);
    assert.ok(out.includes("1–1 of 1"));
  });

  it("the stretched row link is the only way in: no per-row Open button", () => {
    const out = list(ROWS);
    const body = out.slice(out.indexOf("<tbody>"));
    assert.equal((body.match(/<a /g) ?? []).length, ROWS.length, "a row carries a second link");
    assert.doesNotMatch(out, /tabindex="-1"/);
  });

  it("the open RFQ's row is marked and the table narrows beside it", () => {
    const out = list(ROWS, "all", { openId: "b" });
    assert.match(out, /<tr aria-current="true" class="[^"]*bg-brand-tint[^"]*"><td[^>]*><span[^>]*><a [^>]*href="\/app\/rfqs\?open=b"/);
    assert.equal((out.match(/aria-current="true"/g) ?? []).length, 1);
    assert.doesNotMatch(out, />Suppliers<|>Quantity</, "the narrow table kept its wide columns");
    assert.match(list(ROWS), />Suppliers</);
  });

  it("prints a fractional quantity as entered, not rounded", () => {
    assert.ok(list([row("f", { quantity: 12.5, quantity_unit: "kg" })]).includes("12.5 kg"));
  });

  it("names an RFQ the viewer received as a supplier", () => {
    assert.ok(list([row("s", { viewer_role: "supplier" })]).includes("As supplier"));
  });

  it("derives tabs from status and quote count, reads the drafts view, and ignores an unknown ?status=", () => {
    assert.equal(rfqTabOf({ status: "open", quote_count: 0 }), "open");
    assert.equal(rfqTabOf({ status: "open", quote_count: 1 }), "quoted");
    assert.equal(rfqTabOf({ status: "closed", quote_count: 4 }), "closed");
    assert.equal(parseRfqTab("drafts"), "drafts");
    assert.equal(parseRfqTab("bogus"), "all");
    assert.equal(parseRfqTab(["open"]), "all");
    assert.equal(rfqsHref("all"), "/app/rfqs");
    assert.equal(rfqsHref("open", "x"), "/app/rfqs?status=open&open=x");
  });
});

describe("RFQ drafts", () => {
  it("a Drafts chip joins the status row only when a draft exists", () => {
    assert.match(list(ROWS, "all", { drafts: DRAFTS }), /href="\/app\/rfqs\?status=drafts"[^>]*><span[^>]*>Drafts<span[^>]*>2<\/span>/);
    assert.doesNotMatch(list(ROWS), /Drafts/);
    // With no RFQ sent yet, the drafts are still reachable.
    assert.match(list([], "all", { drafts: DRAFTS }), /status=drafts/);
  });

  it("the Drafts table names each draft, counts its suppliers, and reopens it in the composer", () => {
    const out = list(ROWS, "drafts", { drafts: DRAFTS });
    assert.ok(out.includes('href="/app/rfqs/new?draft=d1"'));
    assert.ok(out.includes("Fleece hoodies"));
    assert.ok(out.includes("2 suppliers") && out.includes("0 suppliers"));
    assert.ok(out.includes("Untitled draft"), "a draft with no title lost its row name");
    assert.ok(out.includes("12 Sep 2026"));
    assert.match(out, /<a aria-current="page"[^>]*href="\/app\/rfqs\?status=drafts"/);
    assert.doesNotMatch(out, /Product a/, "the RFQ table is drawn under the drafts");
  });
});

const QUOTE = (id: string, over: Partial<RfqDoc["quotes"][number]> = {}): RfqDoc["quotes"][number] => ({
  id,
  supplier_id: "s1",
  supplier_slug: "aboni-knitwear",
  supplier_name: "Aboni Knitwear Ltd",
  supplier_entity_type: "factory",
  unit_price: 6.15,
  currency: "USD",
  lead_time_days: 45,
  moq: 5000,
  valid_until: "2026-10-31",
  notes: null,
  status: "submitted",
  created_at: "2026-09-10T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  ...over,
});

const DOC: RfqDoc = {
  id: "0f1e2d3c-0000-4000-8000-000000000001",
  product_title: "Cotton jersey t-shirts",
  product_description: "180gsm, sizes S–XL",
  quantity: 12000,
  quantity_unit: "pcs",
  target_unit_price: 2.4,
  currency: "USD",
  ship_to_country: "United Kingdom",
  ship_by: "2026-12-01",
  status: "accepted",
  accepted_quote_id: "q1",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  viewer_role: "buyer",
  targets: [{ id: "s1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd", entity_type: "factory", city: "Gazipur", district: null }],
  quotes: [QUOTE("q1", { unit_price: 2.35, status: "accepted" })],
  thread_id: "t1",
};

const OPEN_DOC: RfqDoc = {
  ...DOC,
  status: "open",
  accepted_quote_id: null,
  quotes: [QUOTE("q1", { notes: "Price holds for 30 days." }), QUOTE("q2", { supplier_name: "S M Knitwears Limited", unit_price: 5.9 })],
};

const detail = (rfq: RfqDoc, mode: "page" | "pane" = "page") =>
  renderToStaticMarkup(createElement(RfqDetailBody, { rfq, list: [], mode, closeHref: "/app/rfqs?status=open" }));

describe("RFQ detail", () => {
  const out = detail(DOC);

  it("shows the facts, the quote as a comparison row and the accepted quote's order link", () => {
    for (const s of ["12,000 pcs", "United Kingdom", "1 Dec 2026", "2.35 USD", "2.40 USD", "45 days", "5,000", "31 Oct 2026"]) {
      assert.ok(out.includes(s), `missing ${s}`);
    }
    assert.ok(out.includes('href="/app/orders/new?from_quote=q1"'));
    assert.ok(!out.includes(">Accept<"), "Accept on an RFQ that is already accepted");
  });

  it("the product is the reference: no RFQ id, and the caption says when it was updated", () => {
    assert.doesNotMatch(out, /RFQ 0f1e2d3c/);
    assert.match(out, /Updated 20 Sep 2026/);
  });

  it("money reads 6.15 USD, two decimals and the code after", () => {
    const open = detail(OPEN_DOC);
    assert.ok(open.includes("6.15 USD") && open.includes("5.90 USD"));
    assert.doesNotMatch(open, /\$|5\.9 USD/);
  });

  it("keeps the thread and supplier links", () => {
    assert.ok(out.includes('href="/app/messages/t1"'));
    assert.ok(out.includes('href="/app/suppliers/aboni-knitwear"'));
    assert.ok(out.includes('href="/app/rfqs"'));
  });

  it("an RFQ with no quotes says what comes next", () => {
    const empty = detail({ ...DOC, status: "open", quotes: [], thread_id: null });
    assert.ok(empty.includes("No quotes yet"));
    assert.ok(empty.includes("No message thread yet."));
  });

  it("one primary per screen: none while quotes wait, one to create the order once accepted", () => {
    const open = detail(OPEN_DOC);
    assert.equal((open.match(PRIMARY) ?? []).length, 0, "an open RFQ's Accepts are primaries again");
    assert.equal((open.match(/>Accept</g) ?? []).length, 2);
    assert.equal((out.match(PRIMARY) ?? []).length, 1);
    assert.match(out, /Create order/);
  });

  it("the quotes table: fixed columns, headers that do not wrap, Valid until right-aligned, notes as a second row", () => {
    const open = detail(OPEN_DOC);
    assert.match(open, /\[&amp;_table\]:table-fixed|\[&_table\]:table-fixed/);
    for (const h of ["Unit price", "Lead time", "MOQ", "Valid until"]) {
      assert.match(open, new RegExp(`<th scope="col" class="[^"]*text-right[^"]*whitespace-nowrap[^"]*">${h}</th>`), h);
    }
    assert.match(open, /<td colspan="7"[^>]*><p[^>]*>Price holds for 30 days\.<\/p><\/td>/i);
  });

  it("three columns from xl on the page; one column in the pane, with its Close", () => {
    assert.match(out, /xl:grid-cols-\[20rem_minmax\(0,1fr\)_17rem\]/);
    assert.doesNotMatch(out, /2xl:/);
    const pane = detail(DOC, "pane");
    assert.doesNotMatch(pane, /grid-cols-\[/);
    assert.match(pane, /data-record-pane=""/);
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(pane)?.[0] ?? "", /href="\/app\/rfqs\?status=open"/);
    assert.match(pane, /href="\/app\/rfqs\/0f1e2d3c-0000-4000-8000-000000000001"/, "no way to the full page");
    assert.doesNotMatch(pane, /Other RFQs/);
  });
});

// ---- Accept, invoked ----

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

const buttonsNamed = (tree: unknown, label: string) =>
  findAll(tree as never, (el) => el.type === Button && textOf(el.props.children as never).trim() === label);

describe("Accept asks first", () => {
  const props = {
    quoteId: "q2",
    question: "Accept 6.15 USD/pcs from Aboni Knitwear Ltd?",
    colSpan: 7,
    cells: null,
  };

  it("the row's Accept is a secondary that opens the confirm row and posts nothing", () => {
    const posts: unknown[] = [];
    stub("fetch", async (...a: unknown[]) => {
      posts.push(a);
      return { ok: true, status: 200, json: async () => ({}) };
    });
    // Hook order: state 0 confirming, 1 busy, 2 error.
    const run = callWithHooks(AcceptQuoteRows, props, { contexts: new Map([[AppRouterContext, router]]) });
    const accepts = buttonsNamed(run.out, "Accept");
    assert.equal(accepts.length, 1);
    assert.equal(accepts[0]!.props.variant, undefined, "the row's Accept is not the secondary tier");
    (accepts[0]!.props.onClick as () => void)();
    assert.deepEqual(run.sets, [{ hook: 0, value: true }]);
    assert.equal(posts.length, 0, "Accept posted before the confirm");
    assert.ok(!renderToStaticMarkup(createElement("table", null, createElement("tbody", null, run.out))).includes(ACCEPT_CLOSES_COPY));
  });

  it("the confirm row names the price and supplier, and only its Accept — the one primary — posts", async () => {
    const posts: unknown[] = [];
    let refreshes = 0;
    stub("fetch", async (url: string, init: { body: string }) => {
      posts.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    const r = { ...router, refresh: () => (refreshes += 1) };
    const run = callWithHooks(AcceptQuoteRows, props, { contexts: new Map([[AppRouterContext, r]]), state: [true] });
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, run.out)));
    assert.ok(html.includes("Accept 6.15 USD/pcs from Aboni Knitwear Ltd? This closes the RFQ to other quotes."));
    assert.equal((html.match(PRIMARY) ?? []).length, 1);
    assert.equal(buttonsNamed(run.out, "Keep looking")[0]?.props.variant, "ghost");
    const confirm = buttonsNamed(run.out, "Accept").find((b) => b.props.variant === "primary");
    assert.ok(confirm, "no primary Accept in the confirm row");
    await (confirm.props.onClick as () => Promise<void>)();
    assert.deepEqual(posts, [{ url: "/api/v1/rfqs", body: { action: "accept_quote", quote_id: "q2" } }]);
    assert.equal(refreshes, 1);
  });

  it("the RFQ hands each open quote its own question: price per unit and supplier", () => {
    // `RfqDetailBody` is a plain server function; calling it gives the tree the client rows receive.
    const rows = findAll(RfqDetailBody({ rfq: OPEN_DOC, list: [] }) as never, (el) => el.type === AcceptQuoteRows);
    assert.deepEqual(
      rows.map((r) => r.props.question),
      ["Accept 6.15 USD/pcs from Aboni Knitwear Ltd?", "Accept 5.90 USD/pcs from S M Knitwears Limited?"],
    );
    assert.deepEqual(detail({ ...OPEN_DOC, viewer_role: "supplier" }).match(/>Accept</g), null, "a supplier can accept");
  });
});

// ---- the routes ----

describe("/app/rfqs — the RFQ opens beside the list", () => {
  const LIST = "app/(app)/app/rfqs/(list)/page.js";

  it("?open= draws the RFQ in a pane with its Close, and marks its row", async () => {
    answers = { rfq_list: { data: ROWS, error: null }, rfq_get: { data: OPEN_DOC, error: null }, rfq_draft_list: { data: DRAFTS, error: null } };
    const out = render(await route(LIST)({ searchParams: Promise.resolve({ open: "b" }) }));
    assert.match(out, /data-record-pane=""/);
    assert.match(out, /aria-label="RFQ: Cotton jersey t-shirts"/);
    assert.match(/<a [^>]*aria-label="Close"[^>]*>/.exec(out)?.[0] ?? "", /href="\/app\/rfqs"/);
    assert.match(out, /<tr aria-current="true"[^>]*>(?:(?!<\/tr>).)*href="\/app\/rfqs\?open=b"/);
    assert.match(out, /Drafts<span[^>]*>2<\/span>/);
  });

  it("an id that cannot be read is a notice in the pane, never a 404 on the list", async () => {
    answers = { rfq_list: { data: ROWS, error: null }, rfq_get: { data: null, error: { message: "not found" } } };
    const r = await outcome(() => route(LIST)({ searchParams: Promise.resolve({ open: "nope" }) }));
    assert.ok("html" in r, `the list threw ${"threw" in r ? r.threw : ""}`);
    assert.match(r.html, /This RFQ could not be opened/);
    assert.match(r.html, /Product a/, "the list itself is gone");
  });

  it("without rfq_draft_list (not yet migrated) the list shows no drafts and does not fail", async () => {
    answers = { rfq_list: { data: ROWS, error: null } };
    const out = render(await route(LIST)({ searchParams: Promise.resolve({}) }));
    assert.doesNotMatch(out, /Drafts|data-record-pane|role="alert"/);
    assert.match(out, /Product a/);
  });
});

describe("/app/rfqs/[id] — the full page for deep links", () => {
  const PAGE = "app/(app)/app/rfqs/[id]/page.js";

  it("an RFQ the caller cannot read is a 404, and no loading state sits above it", async () => {
    answers = { rfq_get: { data: null, error: { message: "not found" } } };
    const r = await outcome(() => route(PAGE)({ params: Promise.resolve({ id: "nope" }) }));
    assert.ok("threw" in r, "the page rendered an RFQ it could not read");
    assert.match(r.threw, /NOT_FOUND|404/);
    const dir = path.join(process.cwd(), "app", "(app)", "app", "rfqs");
    for (const f of ["loading.tsx", "[id]/loading.tsx"]) assert.ok(!existsSync(path.join(dir, f)), `rfqs/${f} wraps a route that answers 404`);
    assert.ok(existsSync(path.join(dir, "(list)", "loading.tsx")), "the list lost its table skeleton");
  });

  it("draws the same RFQ as a page", async () => {
    answers = { rfq_get: { data: DOC, error: null }, rfq_list: { data: [], error: null } };
    const out = render(await route(PAGE)({ params: Promise.resolve({ id: DOC.id }) }));
    assert.match(out, /<h1[^>]*>Cotton jersey t-shirts<\/h1>/);
    assert.doesNotMatch(out, /data-record-pane/);
  });
});

describe("RFQ composer", () => {
  it("names the required fields still missing, in the buyer's words", () => {
    assert.deepEqual(missingFields({ title: "", quantity: "", unit: "pcs", targets: 1 }), ["product title", "quantity"]);
    assert.deepEqual(missingFields({ title: " ", quantity: "0", unit: "", targets: 0 }), ["product title", "quantity", "unit", "a supplier"]);
    assert.deepEqual(missingFields({ title: "Tees", quantity: "500", unit: "pcs", targets: 2 }), []);
  });
});

describe("the As supplier label", () => {
  it("shows on every row the viewer did not send only as a buyer", () => {
    // `viewer_role` "both" (a buyer whose own claimed supplier is a target)
    // lost the label when the check became `=== "supplier"`.
    for (const role of ["supplier", "both"] as const) {
      assert.match(list([row("x", { viewer_role: role })]), /As supplier/, role);
    }
    assert.doesNotMatch(list([row("y", {})]), /As supplier/);
  });
});
