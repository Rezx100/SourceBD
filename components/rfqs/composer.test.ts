// The RFQ composer (B5b): the sentences a buyer reads while writing (what is still missing,
// what Send says, who the RFQ goes to), the body it posts, and what it draws for one supplier,
// fifty, none and a sanctioned one. The routes that host it are tested in
// `app/(app)/app/record-routes.test.ts`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { readFileSync } from "node:fs";
import path from "node:path";
import { ReviewBody, RfqComposer } from "./composer";
import {
  DEFAULT_QUESTIONS,
  afterPick,
  buildPayload,
  fieldNote,
  fillTemplate,
  footerStatus,
  fromYouSaves,
  needsFromYou,
  leftoverPlaceholders,
  listAnd,
  missingFields,
  neededWords,
  refusalWords,
  confirmFirst,
  reviewWords,
  sendDecision,
  sendWords,
  shownNumber,
  targetSummary,
  typeCounts,
  type ComposerTarget,
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
    assert.deepEqual(missingFields({ title: "x", quantity: "5", unit: "pcs", targets: 1, targetPrice: "8,5" }), ["target price"], "a price that is not a number is named");
    assert.deepEqual(missingFields({ title: "x", quantity: "5", unit: "pcs", targets: 1, targetPrice: "-3" }), ["target price"]);
    assert.deepEqual(missingFields({ title: "x", quantity: "5", unit: "pcs", targets: 1, targetPrice: "" }), []);
    assert.equal(neededWords(["target price"]), "Add a target price as a number to send.");
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
    // Nothing scolds before a send is tried: the footer says where it goes, in ink.
    assert.ok(out.includes("Sends to 1 supplier: Aboni Knitwear Ltd."));
    assert.ok(!out.includes("Add a quantity"));
    assert.ok(out.includes("Each supplier gets its own copy. No supplier sees who else you asked."));
    // The preview is a card on the preview column's ground, not a card inside a card (critique of 8 Oct 2026, item 7).
    assert.match(out, /<div class="flex flex-col gap-3 rounded-lg bg-surface p-4">/);
    assert.doesNotMatch(out, /rounded-lg border border-line bg-surface p-4/);
    assert.ok(out.includes(`Questions · ${DEFAULT_QUESTIONS.length}`));
    // Critique of 8 Oct 2026, item 1: a mouse user with a field empty saw a grey Send and no reason.
    assert.doesNotMatch(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/, "Send is withheld for an empty quantity");
    assert.ok(out.includes("Ctrl ↵") && !out.includes("Ctrl+Enter"), "the hint in the buyer's own keys, as DESIGN.md writes it");
  });

  it("a workspace missing its website gets From you's three fields in place, prefilled from the account, with Settings as the other way; Send waits", () => {
    const out = draw([target(1)], { prefill: { title: "Hoodies", quantity: "10000" } });
    assert.match(out, /<section aria-label="From you"/);
    for (const label of ["Your name", "Company", "Website"]) assert.match(out, new RegExp(`<label for="[^"]+" class="[^"]*">${label}</label>`), label);
    assert.match(out, /value="Rezaul Karim"/, "the name the account knows is prefilled");
    assert.match(out, /value="Karim Trading"/);
    assert.ok(out.includes('href="/app/settings/workspace"'), "Settings stays a way, not the only one");
    assert.ok(!out.includes("so it shows in [brackets]"), "no caution note before a send is tried");
    assert.doesNotMatch(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/, "the message still holds [website], which the click names");
    const full = draw([target(1)], { prefill: { title: "Hoodies", quantity: "10000" }, workspace: { ...WORKSPACE, website: "karim.example" } });
    assert.doesNotMatch(full, /<section aria-label="From you"/, "a complete workspace is not asked again");
    assert.ok(full.includes("Sends to 1 supplier: Aboni Knitwear Ltd."));
    assert.doesNotMatch(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(full)?.[0] ?? "", /\sdisabled=""/);
    assert.equal(needsFromYou(WORKSPACE), true);
    assert.equal(needsFromYou({ ...WORKSPACE, website: "https://karim.example" }), false);
    assert.equal(needsFromYou(null), true);
  });

  // Critique of 7 Oct 2026, item 3: the composer went red before a send was tried whenever the
  // workspace was incomplete, and a screen reader heard "Add a quantity to send." on arrival.
  it("the footer is ink and silent on first paint whatever is empty, caution only after a send is tried, and announces only after an action", () => {
    const words = { sends: "Sends to 1 supplier: Aboni Knitwear Ltd.", send: "Send RFQ" };
    const base = { error: null, sanctioned: 0, missing: ["quantity", "website in the message"], attempted: false, draftSavedAt: null, words };
    assert.deepEqual(footerStatus(base), { text: words.sends, tone: "ink", live: false });
    assert.deepEqual(footerStatus({ ...base, attempted: true }), { text: "Add a quantity and your website to send.", tone: "caution", live: true });
    assert.deepEqual(footerStatus({ ...base, attempted: true, missing: [] }), { text: words.sends, tone: "ink", live: false });
    assert.deepEqual(footerStatus({ ...base, draftSavedAt: "8 Oct 2026, 10:00 UTC" }), { text: `Draft saved 8 Oct 2026, 10:00 UTC. ${words.sends}`, tone: "ink", live: true });
    assert.deepEqual(footerStatus({ ...base, error: "Could not send." }), { text: "Could not send.", tone: "danger", live: true });
    assert.equal(footerStatus({ ...base, sanctioned: 1 }).live, false, "the banner already announces a sanction");
    assert.equal(fieldNote(false, ["quantity"], "quantity", "Add a quantity"), null);
    assert.equal(fieldNote(true, ["quantity"], "quantity", "Add a quantity"), "Add a quantity");
    assert.equal(fieldNote(true, [], "quantity", "Add a quantity"), null);
    // Drawn: the words in ink, no inline message, and the live region present but empty.
    const out = draw([target(1)], { prefill: { title: "", quantity: "" } });
    assert.match(out, /<p class="text-ink">Sends to 1 supplier: Aboni Knitwear Ltd\.<\/p>/);
    assert.match(out, /<p role="status" aria-live="polite" class="text-ink sr-only"><\/p>/, "the live region speaks on mount");
    assert.doesNotMatch(out, /text-danger|Add a product|Add a quantity/);
  });

  it("Ship by is the app's own date field in the 15 Nov 2026 form, never the browser's date box; Ship to is a list with another country typed", () => {
    const out = draw([target(1)], { prefill: { shipBy: "2026-10-15", shipTo: "United Kingdom" } });
    assert.doesNotMatch(out, /type="date"/);
    assert.match(out, /placeholder="15 Nov 2026"/);
    assert.match(out, /<input [^>]*value="15 Oct 2026"/);
    // Radix draws only the chosen row on the server; the list itself opens live.
    assert.ok(out.includes("United Kingdom"));
    assert.doesNotMatch(out, /<datalist/);
    // A country off the list is shown typed.
    const other = draw([target(1)], { prefill: { shipTo: "Norway" } });
    assert.match(other, /<input [^>]*aria-label="Country"[^>]*value="Norway"/);
    // No spinners on the number fields: the one stylesheet turns them off.
    assert.match(readFileSync(path.join(process.cwd(), "app", "ds.css"), "utf8"), /input\[type="number"\] \{\s*-moz-appearance: textfield;\s*appearance: textfield;/);
  });

  it("what was typed under From you is saved to the workspace on send, only what changed, the website with its scheme", () => {
    const ws = { ...WORKSPACE, website: null };
    assert.deepEqual(fromYouSaves({ name: "Rezaul Karim", company: "Karim Trading", website: "" }, ws), [], "nothing changed, nothing saved");
    assert.deepEqual(fromYouSaves({ name: "Rezaul Karim", company: "Karim Trading", website: "karim.example" }, ws), [{ action: "update_workspace", website: "https://karim.example" }]);
    assert.deepEqual(fromYouSaves({ name: "R. Karim", company: "Karim Trading Ltd", website: "https://karim.example" }, ws), [
      { action: "update_workspace", company_name: "Karim Trading Ltd", website: "https://karim.example" },
      { action: "update_profile", display_name: "R. Karim" },
    ]);
    assert.deepEqual(fromYouSaves({ name: "", company: "", website: "" }, null), [], "an empty field never blanks the workspace");
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
    assert.doesNotMatch(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(none)?.[0] ?? "", /\sdisabled=""/, "the click says to add a supplier");
  });

  it("a sanctioned supplier is a solid banner, a Remove, no live Send, and the reason in the footer", () => {
    const out = draw([target(1, { sanctioned: true, name: "Sanctioned Knit Ltd." })], { prefill: { title: "x", quantity: "5" }, workspace: { ...WORKSPACE, website: "w.example" } });
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.ok(out.includes("RFQs cannot be sent to a sanctioned supplier"));
    assert.ok(out.includes('aria-label="Remove Sanctioned Knit Ltd."'));
    assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/);
    assert.match(out, /<span id="[^"]+-send-hint" class="sr-only">Remove the sanctioned supplier to send\./, "the disabled Send's description says why");
  });

  // Critique of 8 Oct 2026, item 1: Send is never disabled for an empty field; a click marks the
  // attempt, posts nothing, and the footer turns caution with the inline notes.
  it("a click with a field empty marks the attempt and posts nothing; a complete form posts; a sanction blocks", () => {
    assert.equal(sendDecision({ blocked: false, missing: ["quantity"] }), "wait");
    assert.equal(sendDecision({ blocked: false, missing: [] }), "post");
    assert.equal(sendDecision({ blocked: true, missing: [] }), "blocked");
    const words = { sends: "Sends to 1 supplier: Aboni Knitwear Ltd.", send: "Send RFQ" };
    assert.deepEqual(footerStatus({ error: null, sanctioned: 0, missing: ["quantity"], attempted: true, draftSavedAt: null, words }), { text: "Add a quantity to send.", tone: "caution", live: true });
  });

  it("a quantity and a target price read as figures once the field is left, and as typed while in it", () => {
    assert.equal(shownNumber("10000", false, "count"), "10,000");
    assert.equal(shownNumber("1250.5", false, "count"), "1,250.5");
    assert.equal(shownNumber("10000", true, "count"), "10000");
    assert.equal(shownNumber("8.9", false, "money"), "8.90");
    assert.equal(shownNumber("", false, "money"), "");
    assert.equal(shownNumber("abc", false, "count"), "abc");
    const out = draw([target(1)], { prefill: { title: "Hoodies", quantity: "10000", targetPrice: "8.9" } });
    assert.match(out, /value="10,000"/);
    assert.match(out, /value="8\.90"/);
    assert.doesNotMatch(out, /value="10000"/);
    assert.match(out, /<form [^>]*noValidate=""/, "the browser's own bubble would stop a click on Send before the composer names the gap");
    assert.match(draw([]), /data-add-suppliers=""/, "a send tried with nobody listed moves focus to Add suppliers");
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

  it("on the page the preview's edge is the shared divider, so the message can be given more room; in the pane there is none", () => {
    // Founder, 6 Oct 2026: "so that the message section can be resized. Reuse the same for the
    // divider." The preview is 344 until dragged, never under 320, and the form keeps 480.
    const page = draw([target(1)]);
    const m = /<div role="separator"([^>]*)>[\s\S]*?<\/div><aside id="([^"]+)" aria-label="Preview" style="--pane-w:344px" class="([^"]*)"/.exec(page);
    assert.ok(m, "no divider right before the preview");
    const [sep, id, cls] = [m[1] ?? "", m[2] ?? "", m[3] ?? ""];
    for (const a of [`aria-controls="${id}"`, 'aria-label="Resize the preview"', 'aria-orientation="vertical"', 'aria-valuenow="344"', 'aria-valuemin="320"', 'tabindex="0"']) assert.ok(sep.includes(a), `the divider lacks ${a}: ${sep}`);
    // The width is a variable read only from 1280: under that the preview is a row under the form.
    for (const c of ["xl:w-[var(--pane-w)]", "xl:min-w-[320px]", "xl:max-w-[calc(100%-480px)]"]) assert.ok(cls.split(" ").includes(c), `the preview lacks ${c}`);
    assert.ok(!cls.split(" ").some((c) => /^w-|^xl:border-l$/.test(c)), "a width under 1280, or a second line beside the divider's");
    const pane = draw([target(1)], { mode: "pane", closeHref: "/app/discover?q=knit" });
    assert.ok(!pane.includes('role="separator"') && !pane.includes("--pane-w"), "a divider in the pane, which the list's own divider already resizes");
  });

  it("a saved draft's own message and questions win over the template and the defaults", () => {
    const out = draw([target(1)], { prefill: { title: "x", quantity: "5", message: "My own words", questions: ["Only this?"] } });
    assert.ok(out.includes("My own words") && out.includes("edited here"));
    assert.ok(out.includes("Questions · 1") && out.includes("Only this?"));
    assert.ok(!out.includes(DEFAULT_QUESTIONS[0]));
  });
});

describe("fifty recipients: one confirmation, and the sentence that matters in ink (critique of 8 Oct 2026, round 3, item 3)", () => {
  it("above five a send opens the review dialog first; five or fewer post at once; a confirmed send posts", () => {
    assert.equal(confirmFirst(5), false);
    assert.equal(confirmFirst(6), true);
    assert.equal(sendDecision({ blocked: false, missing: [], targets: 50 }), "review");
    assert.equal(sendDecision({ blocked: false, missing: [], targets: 5 }), "post");
    assert.equal(sendDecision({ blocked: false, missing: [], targets: 50, confirmed: true }), "post");
    // An empty field is named before any confirmation, and a sanction still blocks.
    assert.equal(sendDecision({ blocked: false, missing: ["quantity"], targets: 50 }), "wait");
    assert.equal(sendDecision({ blocked: true, missing: [], targets: 50 }), "blocked");
  });

  it("the dialog's primary is the send itself while confirming, Done while reviewing", () => {
    assert.deepEqual(reviewWords(50, true), { title: "Send this RFQ to 50 suppliers?", primary: "Send to 50 suppliers" });
    assert.deepEqual(reviewWords(50, false), { title: "50 suppliers get this RFQ", primary: "Done" });
  });

  it("the list sorts by name on request, and the footer sentence is ink at 14", () => {
    const named = (n: string) => target(1, { slug: n, name: n });
    const out = renderToStaticMarkup(createElement(ReviewBody, { targets: [named("Zeta Knit"), named("Alpha Knit")], onRemove() {}, byName: true, onSort() {} }));
    assert.ok(out.indexOf("Alpha Knit") < out.indexOf("Zeta Knit"), "not sorted by name");
    assert.match(out, /aria-pressed="true"[^>]*>Sorted A to Z</);
    const src = readFileSync(path.join(process.cwd(), "components", "rfqs", "composer.tsx"), "utf8");
    assert.match(src, /const TONE = \{ ink: "text-ink",/);
    assert.match(src, /<div className="min-w-0 text-base">/);
  });

  it("Send and Save draft are busy, never disabled, while a draft saves, so focus does not drop to the page", () => {
    const src = readFileSync(path.join(process.cwd(), "components", "rfqs", "composer.tsx"), "utf8");
    assert.doesNotMatch(src, /disabled=\{busy !== null\}/, "Save draft is disabled while busy");
    assert.match(src, /const blocked = sanctioned\.length > 0;/, "Send is disabled while a draft saves");
    assert.equal((src.match(/aria-busy=\{busy !== null \|\| undefined\}/g) ?? []).length, 2);
    assert.match(src, /if \(decision === "review"\) return setReviewing\("confirm"\);/, "Ctrl Enter and the click skip the confirmation");
  });
});
