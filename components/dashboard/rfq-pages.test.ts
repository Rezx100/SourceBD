// The RFQ pages at the boundary a buyer sees (closed-loop §14): the HTML the
// list and the detail render for an empty, failed and filled `rfq_list`, and
// for an accepted RFQ. The routes only read the RPCs and hand the rows here.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { missingFields } from "./rfq-composer";
import {
  RFQ_EMPTY_BODY,
  RFQ_EMPTY_TITLE,
  RfqDetailBody,
  RfqListBody,
  parseRfqTab,
  rfqTabOf,
  type RfqDoc,
  type RfqRow,
  RFQ_ERROR_COPY,
  type RfqTab,
} from "./rfq-pages";

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

const list = (rows: RfqRow[] | null, tab: RfqTab = "all") =>
  renderToStaticMarkup(createElement(RfqListBody, { rows, tab, today: TODAY }));

describe("RFQ list", () => {
  it("an empty list teaches: §3.7's copy and a way to start one", () => {
    const out = list([]);
    assert.ok(out.includes(RFQ_EMPTY_TITLE) && out.includes(RFQ_EMPTY_BODY));
    assert.ok(out.includes('href="/app/discover"'), "no way to start an RFQ");
    assert.ok(out.includes("0 sent · 0 quotes"));
    assert.ok(!out.includes('aria-label="RFQ status"'), "status tabs over nothing");
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

  it("maps status to the badge: quoted and accepted positive, open and cancelled neutral", () => {
    const out = list(ROWS);
    // The class of the badge whose own text is `label` (an icon svg may precede it).
    const badge = (label: string) =>
      new RegExp(`<span class="([^"]*)">(?:<svg(?:(?!</svg>).)*</svg>)?${label}</span>`).exec(out)?.[1] ?? "";
    assert.match(badge("Quoted · 2"), /bg-positive-tint/);
    assert.match(badge("Quote accepted"), /bg-positive-tint/);
    assert.match(badge("Open · no quote yet"), /bg-surface-sunken/);
    assert.match(badge("Cancelled"), /bg-surface-sunken/);
    assert.ok(!out.includes("bg-sanction"), "the sanction red is for sanctions only");
  });

  it("a tab shows only its rows, marks itself current, and every row opens its RFQ", () => {
    const out = list(ROWS, "quoted");
    assert.ok(out.includes('href="/app/rfqs/b"'));
    assert.ok(!out.includes('href="/app/rfqs/a"'));
    assert.match(out, /<a aria-current="page"[^>]*href="\/app\/rfqs\?status=quoted"/);
    assert.ok(out.includes("1–1 of 1"));
  });

  it("prints a fractional quantity as entered, not rounded", () => {
    assert.ok(list([row("f", { quantity: 12.5, quantity_unit: "kg" })]).includes("12.5 kg"));
  });

  it("names an RFQ the viewer received as a supplier", () => {
    assert.ok(list([row("s", { viewer_role: "supplier" })]).includes("As supplier"));
  });

  it("derives tabs from status and quote count, and ignores an unknown ?status=", () => {
    assert.equal(rfqTabOf({ status: "open", quote_count: 0 }), "open");
    assert.equal(rfqTabOf({ status: "open", quote_count: 1 }), "quoted");
    assert.equal(rfqTabOf({ status: "closed", quote_count: 4 }), "closed");
    assert.equal(parseRfqTab("drafts"), "all");
    assert.equal(parseRfqTab(["open"]), "all");
  });
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
  quotes: [
    {
      id: "q1",
      supplier_id: "s1",
      supplier_slug: "aboni-knitwear",
      supplier_name: "Aboni Knitwear Ltd",
      supplier_entity_type: "factory",
      unit_price: 2.35,
      currency: "USD",
      lead_time_days: 45,
      moq: 5000,
      valid_until: "2026-10-31",
      notes: null,
      status: "accepted",
      created_at: "2026-09-10T10:00:00Z",
      updated_at: "2026-09-20T10:00:00Z",
    },
  ],
  thread_id: "t1",
};

describe("RFQ detail", () => {
  const out = renderToStaticMarkup(createElement(RfqDetailBody, { rfq: DOC, list: [] }));

  it("shows the facts, the quote as a comparison row and the accepted quote's order link", () => {
    for (const s of ["12,000 pcs", "United Kingdom", "1 Dec 2026", "2.35 USD", "45 days", "5,000", "31 Oct 2026"]) {
      assert.ok(out.includes(s), `missing ${s}`);
    }
    assert.ok(out.includes('href="/app/orders/new?from_quote=q1"'));
    assert.ok(!out.includes(">Accept<"), "Accept on an RFQ that is already accepted");
  });

  it("keeps the thread and supplier links", () => {
    assert.ok(out.includes('href="/app/messages/t1"'));
    assert.ok(out.includes('href="/app/suppliers/aboni-knitwear"'));
    assert.ok(out.includes('href="/app/rfqs"'));
  });

  it("an RFQ with no quotes says what comes next", () => {
    const empty = renderToStaticMarkup(createElement(RfqDetailBody, { rfq: { ...DOC, status: "open", quotes: [], thread_id: null }, list: [] }));
    assert.ok(empty.includes("No quotes yet"));
    assert.ok(empty.includes("No message thread yet."));
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
