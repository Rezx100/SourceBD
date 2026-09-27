// Boundary tests for the rebuilt Compliance hub and Settings pages: the HTML a
// buyer's browser receives for the states they see — a certificate's days-left
// badge, a UFLPA status (the only place the sanction tone may appear), the
// settings sub-navigation's current page, and a failed save.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { type CertRow, expiryBadge, ExpiryTable, TableFooter, type UflpaRow, UflpaStatusBadge, UflpaTable } from "./compliance";
import { FormActions, FormError, SettingsFrame } from "./settings";

const LONG_NAME = "Zaheen Knitwears Limited (Unit 2, Extension Building) and Associated Composite Knitting Mills";

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

function uflpa(status: UflpaRow["status"], id: string): UflpaRow {
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
  };
}

describe("certificate expiry", () => {
  it("days left: caution inside 30 days, a plain fact after, 'Expires today' at zero", () => {
    assert.deepEqual(expiryBadge(0), { tone: "caution", text: "Expires today" });
    assert.deepEqual(expiryBadge(1), { tone: "caution", text: "1 day" });
    assert.deepEqual(expiryBadge(29), { tone: "caution", text: "29 days" });
    assert.deepEqual(expiryBadge(30), { tone: "type", text: "30 days" });
    assert.deepEqual(expiryBadge(89), { tone: "type", text: "89 days" });
  });

  it("the table draws each row in the order given, with the certificate, its number, the date and the badge", () => {
    const html = renderToStaticMarkup(createElement(ExpiryTable, { rows: [cert(3), cert(45, { certificate_no: null, document_url: null })] }));
    assert.ok(html.indexOf("/app/suppliers/sup-3") < html.indexOf("/app/suppliers/sup-45"), "soonest first");
    assert.match(html, /OEKO-TEX/);
    assert.match(html, /32597-100/);
    assert.match(html, /5 Oct 2026/, "the date is the certificate's own day, read in UTC");
    assert.match(html, /bg-caution-tint[^>]*>3 days</);
    assert.match(html, /bg-surface-sunken text-ink-muted[^>]*>45 days</);
    assert.match(html, /No document/);
    assert.match(html, /Open document/);
    assert.doesNotMatch(html, /bg-sanction/, "an expiring certificate is not a sanction");
  });

  it("a long company name wraps and is never truncated", () => {
    const html = renderToStaticMarkup(createElement(ExpiryTable, { rows: [cert(10)] }));
    assert.match(html, new RegExp(`\\[overflow-wrap:anywhere\\][^>]*>${LONG_NAME.replace(/[()]/g, "\\$&")}<`));
    assert.doesNotMatch(html, /truncate|text-ellipsis/);
  });

  it("the footer counts the rows", () => {
    assert.match(renderToStaticMarkup(createElement(TableFooter, { shown: 3, total: 3 })), />1–3 of 3</);
    assert.match(renderToStaticMarkup(createElement(TableFooter, { shown: 5, total: 12 })), />1–5 of 12</);
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
    assert.match(html, /Xinjiang-linked text in supplier fields/);
    assert.match(html, /No active UFLPA matches/);
    assert.match(html, />Buying house</);
  });
});

describe("settings", () => {
  it("the sub-navigation marks exactly the current page", () => {
    const html = renderToStaticMarkup(createElement(SettingsFrame, { current: "plan" } as Parameters<typeof SettingsFrame>[0], "BODY"));
    assert.match(html, /<nav aria-label="Settings"/);
    assert.equal(html.match(/aria-current="page"/g)?.length, 1);
    const current = html.match(/<a\b[^>]*aria-current="page"[^>]*>([^<]*)</);
    assert.ok(current, "no current link");
    assert.match(current[0], /href="\/app\/settings\/plan"/);
    assert.equal(current[1], "Plan");
    for (const href of ["/app/settings", "/app/settings/profile", "/app/settings/notifications"]) {
      assert.match(html, new RegExp(`href="${href}"`));
    }
    assert.match(html, /BODY/);
  });

  it("a failed save is announced; no error draws nothing", () => {
    assert.match(renderToStaticMarkup(createElement(FormError, {} as Parameters<typeof FormError>[0], "Passwords do not match.")), /role="alert"[\s\S]*Passwords do not match\./);
    assert.equal(renderToStaticMarkup(createElement(FormError, {} as Parameters<typeof FormError>[0], null)), "");
  });

  it("saving disables the button and says so; saved shows the toast", () => {
    const saving = renderToStaticMarkup(createElement(FormActions, { pending: true, label: "Save", flash: null }));
    assert.match(saving, /disabled=""[^>]*>Saving…</);
    assert.doesNotMatch(saving, /role="status"/);
    const saved = renderToStaticMarkup(createElement(FormActions, { pending: false, label: "Save", flash: "Display name saved" }));
    assert.match(saved, /role="status"[\s\S]*Display name saved/);
    assert.match(saved, />Save</);
  });
});
