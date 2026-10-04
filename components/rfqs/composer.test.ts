// The RFQ composer (B5b): the sentences a buyer reads while writing (what is still missing,
// what Send says, who the RFQ goes to), the body it posts, and what it draws for one supplier,
// fifty, none and a sanctioned one. The routes that host it are tested in
// `app/(app)/app/record-routes.test.ts`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ComposerTarget } from "@/components/dashboard/rfq-composer";
import { RfqComposer } from "./composer";
import {
  DEFAULT_QUESTIONS,
  afterPick,
  buildPayload,
  fillTemplate,
  leftoverPlaceholders,
  listAnd,
  missingFields,
  neededWords,
  refusalWords,
  sendWords,
  targetSummary,
  typeCounts,
} from "./composer-model";

const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const target = (n: number, over: Partial<ComposerTarget> = {}): ComposerTarget => ({
  id: `id-${n}`,
  slug: `s-${n}`,
  name: n === 1 ? "Aboni Knitwear Ltd." : n === 2 ? "S M Knitwears Limited" : `Supplier ${n}`,
  initials: "AK",
  tier: 2,
  marks: [],
  place: n % 2 ? "Savar, Dhaka" : "Gazipur",
  type: n % 20 === 0 ? "Buying house" : "Factory",
  sanctioned: false,
  ...over,
});
const WORKSPACE = { companyName: "Karim Trading", userName: "Rezaul Karim", website: null, questions: [], emailTemplate: null };
const draw = (targets: ComposerTarget[], extra: Record<string, unknown> = {}) =>
  plain(
    renderToStaticMarkup(
      createElement(RfqComposer, { targets, workspace: WORKSPACE, closeHref: "/app/rfqs", mode: "page", backLabel: "Back to RFQs", ...extra } as never),
    ),
  );

describe("what the composer says", () => {
  it("names what is still missing as a sentence, in the order the form asks", () => {
    assert.deepEqual(missingFields({ title: "", quantity: "", unit: "pcs", targets: 1 }), ["product title", "quantity"]);
    assert.deepEqual(missingFields({ title: "x", quantity: "0", unit: "", targets: 0 }), ["quantity", "unit", "a supplier"]);
    assert.equal(neededWords(["quantity", "website in the message"]), "Add a quantity and your website to send.");
    assert.equal(neededWords(["product title", "quantity", "a supplier"]), "Add a product, a quantity and a supplier to send.");
  });

  it("a message that still has a bracket is not sent, and the template fills what it can", () => {
    const { text, missing } = fillTemplate("Dear {{supplier}}, {{product}} {{user}} {{company}} {{website}}", { supplier: "Aboni", product: "Hoodies", user: "Rezaul", company: "Karim Trading", website: null });
    assert.equal(text, "Dear Aboni, Hoodies Rezaul Karim Trading [website]");
    assert.deepEqual(missing, ["website"]);
    assert.deepEqual(leftoverPlaceholders(text), ["website"]);
    assert.deepEqual(leftoverPlaceholders("All filled in"), []);
  });

  it("Send and the line under the buttons say who it goes to", () => {
    assert.deepEqual(sendWords([]), { sends: "Add a supplier to send this RFQ.", send: "Send RFQ" });
    assert.deepEqual(sendWords([target(1)]), { sends: "Sends to 1 supplier: Aboni Knitwear Ltd.", send: "Send RFQ" });
    assert.deepEqual(sendWords(Array.from({ length: 50 }, (_, i) => target(i + 1))), { sends: "Sends to 50 suppliers.", send: "Send to 50 suppliers" });
  });

  it("fifty suppliers are summarised by two names and the rest, and by type", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => target(i + 1));
    assert.equal(targetSummary(fifty), "Aboni Knitwear Ltd., S M Knitwears Limited and 48 more");
    assert.equal(targetSummary([target(1), target(2)]), "Aboni Knitwear Ltd. and S M Knitwears Limited");
    assert.equal(typeCounts(fifty), "48 factories, 2 buying houses");
    assert.equal(typeCounts([target(1)]), "1 factory");
    assert.equal(listAnd(["Gazipur", "Narayanganj", "Dhaka"]), "Gazipur, Narayanganj and Dhaka");
  });

  it("a pick that failed, or left nobody, keeps the suppliers the buyer had", () => {
    const had = [target(1), target(2)];
    assert.deepEqual(afterPick(had, { targets: [target(3)], note: null }), { targets: [target(3)], note: null });
    assert.equal(afterPick(had, { targets: null, note: "no connection" }).targets, had);
    const none = afterPick(had, { targets: [], note: "2 suppliers are no longer listed and were left out." });
    assert.equal(none.targets, had);
    assert.match(none.note ?? "", /Your suppliers are unchanged\./);
  });

  it("a refused send is put in plain words, the server's own reason where it gave one", () => {
    assert.match(refusalWords(0, null), /no connection/);
    assert.match(refusalWords(401, null), /Sign in/);
    assert.match(refusalWords(429, null), /Too many RFQs/);
    assert.match(refusalWords(400, { detail: "supplier is not published" }), /Remove it and send again/);
    assert.equal(refusalWords(400, { detail: "quantity must be positive" }), "Could not send: quantity must be positive");
    assert.match(refusalWords(500, null), /Nothing was sent/);
  });

  it("the body posted is what the fields hold: trimmed, optional fields left out, a number a number", () => {
    const p = buildPayload({ title: " Hoodies ", description: "  ", quantity: "10000", unit: "pcs", targetPrice: "8.90", currency: "USD", shipTo: "", shipBy: "2026-10-15", message: "Dear", questions: ["Q1"], targetIds: ["a", "b"], productId: null });
    assert.deepEqual(p, { product_title: "Hoodies", product_description: undefined, quantity: 10000, quantity_unit: "pcs", currency: "USD", target_supplier_ids: ["a", "b"], message: "Dear", questions: ["Q1"], target_unit_price: 8.9, ship_by: "2026-10-15" });
    assert.ok(!("ship_to_country" in p) && !("product_id" in p));
    assert.equal(buildPayload({ title: "x", description: "", quantity: "1", unit: "pcs", targetPrice: "", currency: "EUR", shipTo: "Germany", shipBy: "", message: "", questions: [], targetIds: [], productId: "pid" }).product_id, "pid");
  });
});

describe("what the composer draws", () => {
  it("one supplier: listed by name with a way to add more, the facts in the fields, what the supplier gets, Send waiting for a quantity", () => {
    const out = draw([target(1)], { prefill: { title: "Men's heavyweight French terry hoodies, 420gsm", shipBy: "2026-10-15", shipTo: "United Kingdom", targetPrice: "8.9" } });
    assert.match(out, /^<section aria-label="New RFQ"/);
    assert.ok(out.includes("1 supplier · you can add up to 50"));
    assert.ok(out.includes("Aboni Knitwear Ltd.") && out.includes("contact details locked"));
    assert.ok(out.includes(">Add suppliers<"));
    assert.ok(out.includes('value="Men&#x27;s heavyweight') || out.includes("value=\"Men's heavyweight"));
    assert.ok(out.includes("What Aboni Knitwear Ltd. gets"));
    assert.ok(out.includes("US$8.90 per piece") && out.includes("15 Oct 2026") && out.includes("United Kingdom"));
    assert.ok(out.includes("Suppliers see your target price."), "the form must not promise a hidden target");
    assert.ok(!/Share target price|Attach a tech pack/.test(out), "a switch or an upload the product cannot keep");
    assert.ok(out.includes("Add a quantity and your website to send."));
    assert.ok(out.includes("Each supplier gets its own copy. No supplier sees who else you asked."));
    assert.ok(out.includes(`Questions · ${DEFAULT_QUESTIONS.length}`));
    assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/);
    assert.ok(out.includes("Ctrl+Enter"));
  });

  it("the workspace's missing website is said in words, with the way to add it, and keeps Send waiting", () => {
    const out = draw([target(1)], { prefill: { title: "Hoodies", quantity: "10000" } });
    assert.ok(out.includes("website is missing, so it shows in [brackets]"));
    assert.ok(out.includes('href="/app/settings/workspace"'));
    const full = draw([target(1)], { prefill: { title: "Hoodies", quantity: "10000" }, workspace: { ...WORKSPACE, website: "karim.example" } });
    assert.ok(!full.includes("is missing, so it shows"));
    assert.ok(full.includes("Sends to 1 supplier: Aboni Knitwear Ltd."));
    assert.doesNotMatch(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(full)?.[0] ?? "", /\sdisabled=""/);
  });

  it("fifty suppliers are a summary with Review all, not fifty rows; five or fewer are named", () => {
    const fifty = draw(Array.from({ length: 50 }, (_, i) => target(i + 1)));
    assert.ok(fifty.includes("Aboni Knitwear Ltd., S M Knitwears Limited and 48 more"));
    assert.ok(fifty.includes("Review all 50"));
    assert.ok(fifty.includes("50 suppliers · you can add up to 50"));
    assert.ok(fifty.includes("Send to 50 suppliers"));
    assert.ok(!fifty.includes("Supplier 30"));
    const five = draw(Array.from({ length: 5 }, (_, i) => target(i + 1)));
    assert.ok(five.includes("Supplier 5") && !five.includes("Review all"));
    assert.ok(five.includes('aria-label="Remove Supplier 5"'));
  });

  it("the only supplier has no Remove (an RFQ needs one); nobody means an empty state and no Send", () => {
    assert.ok(!draw([target(1)]).includes('aria-label="Remove Aboni Knitwear Ltd."'));
    const none = draw([]);
    assert.ok(none.includes("No supplier yet."));
    assert.ok(none.includes("Add a supplier to send this RFQ.") || none.includes("Add a product"));
    assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(none)?.[0] ?? "", /\sdisabled=""/);
  });

  it("a sanctioned supplier is a solid banner, a Remove, no live Send, and the reason in the footer", () => {
    const out = draw([target(1, { sanctioned: true, name: "Sanctioned Knit Ltd." })], { prefill: { title: "x", quantity: "5" }, workspace: { ...WORKSPACE, website: "w.example" } });
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.ok(out.includes("RFQs cannot be sent to a sanctioned supplier"));
    assert.ok(out.includes('aria-label="Remove Sanctioned Knit Ltd."'));
    assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/);
  });

  it("in the pane it is a labelled region with Close and a Record link; on the page, a back link and no Close", () => {
    const pane = draw([target(1)], { mode: "pane", closeHref: "/app/discover?q=knit", backHref: "/app/discover?q=knit&record=aboni" });
    assert.match(pane, /^<section data-record-pane="" aria-label="New RFQ"/);
    assert.ok(pane.includes('aria-label="Close"') && pane.includes(">Record<"));
    const page = draw([target(1)], { closeHref: "/app/suppliers/aboni-knitwear", backLabel: "Back to Aboni Knitwear Ltd." });
    assert.match(page, /href="\/app\/suppliers\/aboni-knitwear"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Back to Aboni Knitwear Ltd\./);
    assert.ok(!page.includes('aria-label="Close"'));
    assert.ok(page.includes('data-detail=""'));
  });

  it("a saved draft's own message and questions win over the template and the defaults", () => {
    const out = draw([target(1)], { prefill: { title: "x", quantity: "5", message: "My own words", questions: ["Only this?"] } });
    assert.ok(out.includes("My own words") && out.includes("edited here"));
    assert.ok(out.includes("Questions · 1") && out.includes("Only this?"));
    assert.ok(!out.includes(DEFAULT_QUESTIONS[0]));
  });
});
