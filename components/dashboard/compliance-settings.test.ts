// Boundary tests for the rebuilt Compliance hub and Settings pages: the HTML a
// buyer's browser receives for the states they see — a certificate's days
// left (one way, on the hub and on Home), the expiry buckets as stats, a UFLPA
// status (the only place the sanction tone may appear) and the evidence behind
// a region flag. Settings is tested in `components/settings/settings.test.ts`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import {
  type CertRow,
  expiryBadge,
  ExpiryBadge,
  ExpiryStats,
  ExpiryTable,
  regionFlagField,
  TableFooter,
  type UflpaRow,
  UflpaStatusBadge,
  UflpaTable,
} from "./compliance";

const LONG_NAME = "Zaheen Knitwears Limited (Unit 2, Extension Building) and Associated Composite Knitting Mills";
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function cert(days: number, over: Partial<CertRow> = {}): CertRow {
  return {
    kind: "oeko_tex",
    certificate_no: "32597-100",
    issuer: "OEKO-TEX",
    expires_on: "2026-10-05",
    document_url: "https://www.oeko-tex.com/doc.pdf",
    days_remaining: days,
    supplier: { id: `s${days}`, slug: `sup-${days}`, company_name: LONG_NAME, entity_type: "factory", city: "Gazipur", district: "Dhaka" },
    ...over,
  };
}

function uflpa(status: UflpaRow["status"], id: string, over: Partial<UflpaRow> = {}): UflpaRow {
  return {
    supplier_id: id,
    supplier_slug: id,
    company_name: `Supplier ${id}`,
    entity_type: "buying_house",
    city: "Dhaka",
    district: null,
    country: "Bangladesh",
    parent_group_name: null,
    saved_at: "2026-09-01",
    uflpa_hits:
      status === "hit"
        ? [{ matched_name: "Example Co", list_entry_ref: "UFLPA-12", screened_at: null, source_url: "https://www.dhs.gov/uflpa-entity-list", listed_date: null, entity_name: null, aliases: null }]
        : [],
    status,
    ...over,
  };
}

describe("certificate expiry", () => {
  it("days left, in words: caution inside 30 days, a plain fact after, 'today' at zero", () => {
    assert.deepEqual(expiryBadge(0), { tone: "caution", text: "today" });
    assert.deepEqual(expiryBadge(1), { tone: "caution", text: "in 1 day" });
    assert.deepEqual(expiryBadge(29), { tone: "caution", text: "in 29 days" });
    assert.deepEqual(expiryBadge(30), { tone: "quiet", text: "in 30 days" });
    assert.deepEqual(expiryBadge(89), { tone: "quiet", text: "in 89 days" });
    assert.match(renderToStaticMarkup(createElement(ExpiryBadge, { days: 11 })), /^<span class="[^"]*text-caution-ink[^"]*">in 11 days<\/span>$/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(ExpiryBadge, { days: 11 })), /bg-caution-tint/, "a badge that repeats the sentence beside it");
  });

  it("the table draws each row in the order given, with the certificate, its number, and the date followed by the days left", () => {
    const html = renderToStaticMarkup(createElement(ExpiryTable, { rows: [cert(3), cert(45, { certificate_no: null, document_url: null })] }));
    assert.ok(html.indexOf("/app/suppliers/sup-3") < html.indexOf("/app/suppliers/sup-45"), "soonest first");
    assert.match(html, /OEKO-TEX/);
    assert.match(html, /32597-100/);
    assert.match(html, /5 Oct 2026<\/span> <span class="[^"]*text-caution-ink[^"]*">in 3 days</, "the date, then the days left");
    assert.match(html, /<span class="[^"]*text-ink-muted[^"]*">in 45 days</);
    assert.match(html, /No document/);
    assert.match(html, /Open document/);
    assert.doesNotMatch(html, /bg-sanction/, "an expiring certificate is not a sanction");
    assert.match(html, /<tr class="[^"]*hover:bg-surface-sunken/, "rows lit on hover");
  });

  it("the buckets are three inline stats", () => {
    const html = renderToStaticMarkup(createElement(ExpiryStats, { payload: { bucket_30: 3, bucket_60: 5, bucket_90: 1200 } }));
    assert.equal(html.match(/<li/g)?.length, 3);
    assert.match(text(html), /3 within 30 days 5 in 30–60 days 1,200 in 60–90 days/);
    assert.match(html, /text-caution-ink[^"]*">3</, "renewals inside 30 days are the caution figure");
  });

  it("a long company name is one line, cut at the end, whole in the page and in its title", () => {
    // The One-Line Name Rule (founder, 29 Sep 2026) replaced "wraps, never truncated".
    const html = renderToStaticMarkup(createElement(ExpiryTable, { rows: [cert(10)] }));
    const name = LONG_NAME.replace(/[()]/g, "\\$&");
    assert.match(html, new RegExp(`<span data-name="" title="${name}" class="[^"]*\\btruncate\\b[^"]*">${name}<`));
    // Only the name is cut: nothing else on the page carries a truncating class.
    assert.equal((html.match(/truncate|text-ellipsis/g) ?? []).length, 1);
  });

  it("the footer counts the rows", () => {
    assert.match(renderToStaticMarkup(createElement(TableFooter, { shown: 3, total: 3 })), />1–3 of 3</);
    assert.match(renderToStaticMarkup(createElement(TableFooter, { shown: 5, total: 1200 })), />1–5 of 1,200</);
  });
});

describe("UFLPA tracker", () => {
  it("a hit takes the reserved sanction tone; a region flag is caution; clear is positive", () => {
    const hit = renderToStaticMarkup(createElement(UflpaStatusBadge, { status: "hit" }));
    const flag = renderToStaticMarkup(createElement(UflpaStatusBadge, { status: "region_flag" }));
    const clear = renderToStaticMarkup(createElement(UflpaStatusBadge, { status: "clear" }));
    assert.match(hit, /bg-sanction[^>]*>Entity List hit</);
    assert.match(flag, /bg-caution-tint[^>]*>Region flag</);
    assert.match(clear, /bg-positive-tint[^>]*>Clear</);
  });

  it("the table uses the sanction tone once per hit and nowhere else, with the DHS entry linked", () => {
    const html = renderToStaticMarkup(createElement(UflpaTable, { rows: [uflpa("hit", "a"), uflpa("region_flag", "b"), uflpa("clear", "c")] }));
    assert.equal(html.match(/bg-sanction/g)?.length, 1);
    assert.match(html, /UFLPA-12/);
    assert.match(html, /href="https:\/\/www\.dhs\.gov\/uflpa-entity-list"[^>]*>DHS entry</);
    assert.match(html, /No active UFLPA matches/);
    assert.match(html, />Buying house</);
  });

  it("a region flag names the field that carried the term when the row has it, and says 'the record' otherwise — never a snippet", () => {
    assert.equal(regionFlagField({ parent_group_name: "Xinjiang Textile Holdings", city: "Dhaka", district: null }), "the parent group");
    assert.equal(regionFlagField({ parent_group_name: null, city: "Urumqi (XUAR)", district: null }), "the city");
    assert.equal(regionFlagField({ parent_group_name: null, city: "Dhaka", district: "uyghur district" }), "the district");
    assert.equal(regionFlagField({ parent_group_name: null, city: "Dhaka", district: null }), null);
    const html = renderToStaticMarkup(
      createElement(UflpaTable, {
        rows: [uflpa("region_flag", "p", { parent_group_name: "Xinjiang Textile Holdings" }), uflpa("region_flag", "q")],
      }),
    );
    assert.match(html, />Xinjiang-linked term in the parent group</);
    assert.match(html, />Xinjiang-linked text in the record</);
    assert.doesNotMatch(html, /supplier fields/);
  });
});
