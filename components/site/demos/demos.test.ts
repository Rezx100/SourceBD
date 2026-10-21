// The marketing demos (M2, handoff-mercury-m2-m3.md): every company a demo names is in the snapshot's own rows, every
// demo dates what it shows, every stage draws its pause button and its last step on the server, and the snapshot
// carries no contact field.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { displayName } from "@/lib/dashboard/facts";
import { PII_KEYS } from "@/lib/discover-v32-rpc";
import { CAPTION, READ_AT, SANCTIONED_SAMPLE, SNAPSHOT, snapshotNames } from "@/lib/marketing/demo-snapshot";

/* eslint-disable @typescript-eslint/no-require-imports -- loaded after the test build exists. */
const search = require("@/components/site/demos/search") as typeof import("@/components/site/demos/search");
const record = require("@/components/site/demos/record") as typeof import("@/components/site/demos/record");
const rfq = require("@/components/site/demos/rfq") as typeof import("@/components/site/demos/rfq");
const compliance = require("@/components/site/demos/compliance") as typeof import("@/components/site/demos/compliance");
const claim = require("@/components/site/demos/claim") as typeof import("@/components/site/demos/claim");
const vignettes = require("@/components/site/demos/vignettes") as typeof import("@/components/site/demos/vignettes");
const thread = require("@/components/site/demos/thread") as typeof import("@/components/site/demos/thread");
const filters = require("@/components/site/demos/filters") as typeof import("@/components/site/demos/filters");
const statement = require("@/components/site/demos/statement") as typeof import("@/components/site/demos/statement");
/* eslint-enable @typescript-eslint/no-require-imports */

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (C: ComponentType<{ className?: string }>) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(C))));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

/** Watch played as one of its parts (critique 22 Oct). */
const watchAs = (view: import("@/components/site/demos/compliance").ComplianceView): ComponentType<{ className?: string }> =>
  function WatchAs(p) {
    return createElement(compliance.DemoCompliance, { ...p, view });
  };

/** Check opened at another of the record's sections (M4). */
const checkAt = (tab: import("@/components/site/demos/record").RecordTab): ComponentType<{ className?: string }> =>
  function CheckAt(p) {
    return createElement(record.DemoRecord, { ...p, tab });
  };

const DEMOS: { name: string; C: ComponentType<{ className?: string }>; names: readonly string[] }[] = [
  { name: "Find", C: search.DemoSearch, names: search.NAMES },
  { name: "Check", C: record.DemoRecord, names: record.NAMES },
  { name: "Check at Sources", C: checkAt("sources"), names: record.NAMES },
  { name: "Check at Contact", C: checkAt("contact"), names: record.NAMES },
  { name: "Check at Safety", C: checkAt("safety"), names: record.NAMES },
  { name: "Quotes", C: rfq.DemoQuotes, names: rfq.NAMES },
  { name: "Review", C: rfq.DemoReview, names: [...search.NAMES, SANCTIONED_SAMPLE] },
  { name: "Thread", C: thread.DemoThread, names: thread.NAMES },
  { name: "Watch: the checks", C: watchAs("uflpa"), names: compliance.NAMES },
  { name: "Watch: the expiry list", C: watchAs("expiry"), names: compliance.NAMES },
  { name: "Watch: screening", C: watchAs("screen"), names: [...compliance.NAMES, SANCTIONED_SAMPLE] },
  { name: "Ask", C: rfq.DemoRfq, names: rfq.NAMES },
  { name: "Watch", C: compliance.DemoCompliance, names: compliance.NAMES },
  { name: "Claim", C: claim.DemoClaim, names: claim.NAMES },
  ...vignettes.VIGNETTES.map((v) => ({ name: `vignette ${v.key}`, C: v.Demo as ComponentType<{ className?: string }>, names: v.names })),
  { name: "vignette search", C: vignettes.VignetteSearch, names: vignettes.SEARCH_NAMES },
  { name: "vignette receipts", C: vignettes.VignetteReceipts, names: vignettes.RECEIPT_NAMES },
];

describe("the demo snapshot", () => {
  it("was read on a day, holds rows and records, and carries no contact field", () => {
    assert.match(SNAPSHOT.readAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(READ_AT, /^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    assert.ok(SNAPSHOT.search.rows.length >= 5);
    assert.ok(SNAPSHOT.saved.length >= 5);
    assert.ok(SNAPSHOT.check.certs.length >= 1);
    const body = readFileSync(join(process.cwd(), "lib/marketing/demo-snapshot.json"), "utf8");
    for (const k of PII_KEYS) assert.ok(!body.includes(`"${k}"`), k);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(body), "no email address");
  });
});

describe("the demos", () => {
  const allowed = new Set([...snapshotNames(), SANCTIONED_SAMPLE]);

  for (const d of DEMOS) {
    it(`${d.name}: names only companies the snapshot holds, dates what it shows, and plays with a pause button from its last step`, () => {
      assert.ok(d.names.length > 0, "a demo names at least one company");
      for (const n of d.names) assert.ok(allowed.has(n), `${n} is not in the snapshot`);
      const out = draw(d.C);
      const t = text(out);
      assert.ok(d.names.some((n) => t.includes(n)), "a named company is drawn on the last step");
      // The sanctioned example is captioned as an example, never as a real record (critique 22 Oct).
      const caption = d.name === "vignette sanction" ? vignettes.SAMPLE_CAPTION : CAPTION;
      assert.ok(t.includes(caption), `the caption "${caption}"`);
      assert.match(out, /<button type="button" aria-label="Pause demo" aria-pressed="false"/);
      assert.match(out, /<figcaption class="sr-only">[^<]{20,}<\/figcaption>/, "one sentence for a screen reader");
      assert.match(out, /data-ground="day"/, "the product stays light on any ground");
      assert.match(out, /border-line-strong/, "the window has a real edge on paper (critique 22 Oct, S4)");
      assert.doesNotMatch(t, /undefined|NaN|\[object/);
    });
  }

  it("Find ends on the rows the search found, with the hovered record among them", () => {
    // Rows the search has not reached yet stand under a fade (critique 22 Oct, S5); on the last step it has reached them all.
    assert.doesNotMatch(draw(search.DemoSearch), /<tr[^>]*opacity-40/);
    const t = text(draw(search.DemoSearch));
    for (const r of SNAPSHOT.search.rows) assert.ok(t.includes(displayName(r.name).split(" ")[0]!), r.name);
    assert.match(t, /knit GOTS/);
  });

  it("Check ends on the Certificates section with every certificate's register and read day", () => {
    const t = text(draw(record.DemoRecord));
    assert.match(t, /Certificate State Valid until/);
    assert.match(t, /read \d{1,2} [A-Z][a-z]{2} \d{4}/);
    if (SNAPSHOT.check.certs.some((c) => c.expiresOn && c.expiresOn < SNAPSHOT.readAt)) assert.match(t, /No longer current · not counted above/);
  });

  it("Check at Sources lists every source in trust order with its full name and read day; at Contact the card is locked and no value is drawn (M4)", () => {
    const sources = text(draw(checkAt("sources")));
    assert.match(sources, /Source · highest trust first Last read/);
    assert.match(sources, /Tier 1 · government and RSC/);
    for (const code of SNAPSHOT.check.sources) if (/^BRAND_/.test(code)) assert.match(sources, /supplier list/);
    assert.match(sources, /Export Promotion Bureau|Bangladesh Garment Manufacturers/);
    assert.match(sources, /\d{1,2} [A-Z][a-z]{2} \d{4}/);
    const contact = text(draw(checkAt("contact")));
    assert.match(contact, /Contact details are locked/);
    assert.match(contact, /Send an RFQ and the supplier replies in Messages\./);
    assert.doesNotMatch(contact, /@|\+880|on file/);
    // The caption can be left to the page (a demo on a textile stage draws it under the cloth), never dropped.
    const bare = text(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(record.DemoRecord, { caption: false }))));
    assert.ok(!bare.includes(CAPTION));
  });

  it("the search vignette ends on the first three rows of the search; the receipts vignette on three facts, each from a register with a read day (M4)", () => {
    const found = text(draw(vignettes.VignetteSearch));
    assert.match(found, /knit GOTS/);
    for (const n of vignettes.SEARCH_NAMES) assert.ok(found.includes(n), n);
    assert.equal(vignettes.SEARCH_NAMES.length, 3);
    const receipts = text(draw(vignettes.VignetteReceipts));
    assert.match(receipts, /3 of 3 facts, each with its receipt/);
    assert.equal((receipts.match(/From [A-Za-z -]+ · read \d{1,2} [A-Z][a-z]{2} \d{4}/g) ?? []).length, 3);
    if (SNAPSHOT.check.bgmea) assert.match(receipts, new RegExp(`BGMEA member no\\. ${SNAPSHOT.check.bgmea} From BGMEA · read`));
  });

  it("Ask labels the RFQ and every quote as examples; Watch says the UFLPA list's own entry count", () => {
    const ask = text(draw(rfq.DemoRfq));
    assert.match(ask, /Example quotes/);
    assert.match(ask, /every figure is an example/);
    const watch = text(draw(compliance.DemoCompliance));
    assert.match(watch, /Expired · \d+ certificates?|Expires within 30 days · \d+ certificates?|Expires in 31–90 days/);
  });

  it("the parts that replaced the 3 Oct screenshots say what is real and what is an example (critique 22 Oct)", () => {
    // The filter pane counts the snapshot's own search; the statement's answers are examples; nothing names a company it should not.
    const pane = text(draw(filters.DemoFilters));
    assert.match(pane, new RegExp(`Show ${(SNAPSHOT.search.total ?? 0).toLocaleString("en-GB")} suppliers`));
    assert.match(pane, /Certificate status Any Valid Expiring Expired/);
    assert.ok(pane.includes(CAPTION));
    const draft = text(draw(statement.DemoStatement));
    assert.match(draft, /Example answers/);
    assert.match(draft, /Download statement/);
    assert.ok(draft.includes(CAPTION));
    for (const C of [filters.DemoFilters, statement.DemoStatement]) assert.match(draw(C), /<button type="button" aria-label="Pause demo"/);
    // The review ends with the sanctioned example removed: the RFQ goes to the search's suppliers only.
    const review = text(draw(rfq.DemoReview));
    assert.match(review, new RegExp(`Sends to ${SNAPSHOT.search.rows.length} suppliers\\.`));
    assert.match(review, /you can add up to 50/);
    assert.doesNotMatch(review, /RFQs cannot be sent to a sanctioned supplier/);
    // The thread's RFQ and messages are labelled; its supplier is the snapshot's.
    assert.match(text(draw(thread.DemoThread)), /Example messages/);
    // Screening names the sanctioned example only as an example, and its caption says so.
    const screen = text(draw(watchAs("screen")));
    assert.match(screen, /On the UFLPA Entity List/);
    assert.match(screen, /Example Apparel Ltd is an example company, not a real supplier/);
    for (const n of snapshotNames()) assert.ok(!new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} On the UFLPA`).test(screen), `${n} is never shown on the list`);
    // Safety reads the record's own RSC rows.
    const safety = text(draw(checkAt("safety")));
    if ((SNAPSHOT.check.rsc ?? []).length) assert.match(safety, /Building · RSC Issues fixed Training/);
  });

  it("one source count everywhere: the record and the marks say the product's registers and certifiers, brand lists apart (critique 22 Oct)", () => {
    const registers = SNAPSHOT.check.registers ?? SNAPSHOT.check.sources.filter((s) => !s.startsWith("BRAND_")).length;
    assert.match(text(draw(record.DemoRecord)), new RegExp(`${registers} sources`));
    assert.match(text(draw(vignettes.VignetteMarks)), new RegExp(`${registers} registers & certifiers`));
    const row = SNAPSHOT.search.rows.find((r) => r.slug === SNAPSHOT.check.slug);
    if (row) assert.equal(row.sources, registers, "the search row and the record count the same sources");
    // A brand list is named in a chip, never drawn as a placeholder glyph.
    assert.doesNotMatch(draw(vignettes.VignetteMarks), /BRAND_/);
  });

  it("Claim says how a claim is approved, offers no product editing, and ends on Claimed", () => {
    const t = text(draw(claim.DemoClaim));
    assert.ok(t.includes(claim.APPROVAL));
    assert.doesNotMatch(t, /add products|an admin checks/i);
    assert.match(t, /Claimed/);
  });

  it("the sanctioned vignette names the placeholder only, and the last step is the refusal", () => {
    const t = text(draw(vignettes.VignetteSanction));
    assert.match(t, /Example Apparel Ltd/);
    assert.ok(t.includes(vignettes.SAMPLE_CAPTION) && !t.includes(CAPTION), "captioned as an example, never as a real record");
    assert.doesNotMatch(t, /placeholder/);
    assert.match(t, /You can't send this supplier an RFQ\./);
    for (const n of snapshotNames()) assert.ok(!t.includes(n), `${n} is never shown sanctioned`);
  });
});
