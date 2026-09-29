// Boundary tests for the rebuilt Compliance hub and Settings pages: the HTML a
// buyer's browser receives for the states they see — a certificate's days
// left (one way, on the hub and on Home), the expiry buckets as stats, a UFLPA
// status (the only place the sanction tone may appear) and the evidence behind
// a region flag, the six-item settings navigation, the plan's one name, the
// workspace and inquiry forms against the settings API's contract, and a
// failed save. Route-level cases are in `app/(app)/app/buyer-pages-routes.test.ts`.

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
import { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE } from "./rfq-composer";
import {
  FormActions,
  FormError,
  inquiryOf,
  PLAN_NOTE,
  planLabel,
  SETTINGS_NAV,
  SettingsFrame,
  SettingsHeader,
  workspaceOf,
  type SettingsDoc,
} from "./settings";
import { SettingsInquiryForm, TEMPLATE_VARIABLES, inquiryPayload, moveItem } from "@/components/settings-inquiry-form";
import { SettingsWorkspaceForm, workspacePayload } from "@/components/settings-workspace-form";

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

describe("settings — navigation and plan", () => {
  it("six items, in order, and exactly the current one marked", () => {
    assert.deepEqual(
      SETTINGS_NAV.map((n) => n.label),
      ["Workspace", "Subscription", "Members", "Inquiry", "Profile", "Notifications"],
    );
    const html = renderToStaticMarkup(createElement(SettingsFrame, { current: "subscription" } as Parameters<typeof SettingsFrame>[0], "BODY"));
    assert.match(html, /<nav aria-label="Settings"/);
    assert.equal(html.match(/aria-current="page"/g)?.length, 1);
    const current = html.match(/<a\b[^>]*aria-current="page"[^>]*>([^<]*)</);
    assert.ok(current, "no current link");
    assert.match(current[0], /href="\/app\/settings\/subscription"/);
    assert.equal(current[1], "Subscription");
    for (const href of ["/app/settings", "/app/settings/members", "/app/settings/inquiry", "/app/settings/profile", "/app/settings/notifications"]) {
      assert.match(html, new RegExp(`href="${href}"`));
    }
    assert.doesNotMatch(html, /\/app\/settings\/plan"/);
    assert.match(html, /BODY/);
  });

  it("the plan has one name, the rail's: 'Free · public beta', never 'Starter'", () => {
    assert.equal(planLabel("starter"), "Free");
    assert.equal(planLabel(null), "Free");
    assert.equal(planLabel("growth"), "Growth");
    assert.equal(PLAN_NOTE, "public beta");
    const doc = { email: "a@b.invalid", plan_tier: "starter" } as SettingsDoc;
    assert.match(text(renderToStaticMarkup(createElement(SettingsHeader, { settings: doc }))), /Free plan · public beta/);
  });
});

describe("settings — the workspace form and its contract", () => {
  const W = {
    company_name: "Northwind Apparel",
    company_type: "Importer",
    business_description: "Knitwear for UK retail",
    website: "https://northwind.example",
    customer_base: "UK high street",
    employee_count: "11-50",
    company_logo_url: null,
  };

  it("reads the workspace fields, nulls when the reply has none", () => {
    assert.deepEqual(workspaceOf({ workspace: W } as unknown as SettingsDoc), W);
    assert.deepEqual(workspaceOf({} as SettingsDoc), {
      company_name: null,
      company_type: null,
      business_description: null,
      website: null,
      customer_base: null,
      employee_count: null,
      company_logo_url: null,
    });
  });

  it("draws every field with its saved value and posts exactly the API's keys", () => {
    const html = renderToStaticMarkup(createElement(SettingsWorkspaceForm, { initial: W }));
    assert.match(html, /<h2[^>]*>Company info<\/h2>/);
    assert.match(html, /value="Northwind Apparel"/);
    assert.match(html, /<option value="Importer" selected="">/);
    assert.match(html, />Knitwear for UK retail<\/textarea>/);
    assert.match(html, /type="url"[^>]*value="https:\/\/northwind\.example"|value="https:\/\/northwind\.example"[^>]*type="url"/);
    assert.match(html, /value="UK high street"/);
    assert.match(html, /<option value="11-50" selected="">/);
    assert.match(html, /<button type="submit"[^>]*>Save company info<\/button>/);
    assert.doesNotMatch(html, /bg-brand text-brand-on/, "a section's save is the default tier, not the page's primary");
    assert.deepEqual(
      workspacePayload({ company_name: "  Northwind  ", company_type: "Agent", business_description: "", website: " https://n.example ", customer_base: "", employee_count: "1000+" }),
      {
        action: "update_workspace",
        company_name: "Northwind",
        company_type: "Agent",
        business_description: null,
        website: "https://n.example",
        customer_base: null,
        employee_count: "1000+",
      },
    );
  });
});

describe("settings — the inquiry form and its contract", () => {
  it("no inquiry in the reply shows the composer's own defaults", () => {
    assert.equal(inquiryOf({} as SettingsDoc), null);
    const html = renderToStaticMarkup(createElement(SettingsInquiryForm, { initial: null }));
    for (const q of DEFAULT_QUESTIONS) assert.ok(html.includes(`value="${q}"`), q);
    assert.ok(html.includes(DEFAULT_TEMPLATE.split("\n")[0]!), "the default template");
    for (const [name] of TEMPLATE_VARIABLES) assert.ok(text(html).includes(name), name);
    assert.deepEqual(
      TEMPLATE_VARIABLES.map(([n]) => n),
      ["{{supplier}}", "{{product}}", "{{user}}", "{{company}}", "{{website}}"],
    );
    assert.match(html, /aria-label="Move question 1 up"[^>]*disabled=""|disabled=""[^>]*aria-label="Move question 1 up"/, "the first cannot move up");
    assert.match(html, /aria-label="Remove question 5"/);
    assert.match(html, />Save questions</);
    assert.match(html, />Save template</);
  });

  it("saved questions and template are what the form shows", () => {
    const html = renderToStaticMarkup(createElement(SettingsInquiryForm, { initial: inquiryOf({ inquiry: { questions: ["MOQ per colour?"], email_template: "Hi {{supplier}}" } } as SettingsDoc) }));
    assert.match(html, /value="MOQ per colour\?"/);
    assert.ok(!html.includes(`value="${DEFAULT_QUESTIONS[1]}"`));
    assert.match(html, />Hi \{\{supplier\}\}<\/textarea>/);
  });

  it("posts trimmed questions, at most 20 of at most 200 characters, and an empty template as null", () => {
    const many = Array.from({ length: 25 }, (_, i) => ` Q${i} `);
    const body = inquiryPayload([...many, "", "x".repeat(250)], "   ");
    assert.equal(body.action, "update_inquiry");
    assert.equal(body.questions.length, 20);
    assert.equal(body.questions[0], "Q0");
    assert.equal(body.email_template, null);
    assert.equal(inquiryPayload(["x".repeat(250)], "Hi").questions[0]!.length, 200);
    assert.deepEqual(Object.keys(body).sort(), ["action", "email_template", "questions"]);
  });

  it("moves a question one place, and not past either end", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
  });
});

describe("settings — save feedback", () => {
  it("a failed save is announced; no error draws nothing", () => {
    assert.match(renderToStaticMarkup(createElement(FormError, {} as Parameters<typeof FormError>[0], "Passwords do not match.")), /role="alert"[\s\S]*Passwords do not match\./);
    assert.equal(renderToStaticMarkup(createElement(FormError, {} as Parameters<typeof FormError>[0], null)), "");
  });

  it("saving disables the default-tier button and says so; saved shows the toast", () => {
    const saving = renderToStaticMarkup(createElement(FormActions, { pending: true, label: "Save", flash: null }));
    assert.match(saving, /disabled=""[^>]*>Saving…</);
    assert.match(saving, /bg-surface-sunken/, "the default tier");
    assert.doesNotMatch(saving, /role="status"/);
    const saved = renderToStaticMarkup(createElement(FormActions, { pending: false, label: "Save", flash: "Display name saved" }));
    assert.match(saved, /role="status"[\s\S]*Display name saved/);
    assert.match(saved, />Save</);
  });
});
