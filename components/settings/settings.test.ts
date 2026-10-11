// Settings (B7b-1: the frame, Company details, Profile) at the boundary: the words, the pure parts of
// the forms, the saves with an injected `fetch`, and the routes run over a fake Supabase client: the
// navigation, the company form filled and empty, the phone's list, and a failed read that is an error
// and never an empty form a save could blank the company from.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { COMPANY_LABELS, bandLabel, bandOptions, changedFields, typeOptions, valuesOf, workspacePayload } from "./company";
import { COMPANY_TYPES, companyTypeWord, inquiryOf, planLabel, workspaceOf, type SettingsDoc } from "./doc";
import { EMAIL_ROWS, turnedWords } from "./emails";
import { loadPreviewSuppliers } from "./templates-load";
import { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE, FILL_INS, MAX_QUESTIONS, gapWords, inquiryPayload, insertAt, moveItem, previewOf, startOf } from "./templates";
import { EMAIL_SENT, emailRefusal, initialsOf, passwordBody, passwordFailureField, passwordRefusal, pictureRefusal } from "./profile";
import { deleteAvatar, postAvatar, postSettings, routeSentence, type Fetch } from "./transport";
import { SETTINGS_GROUPS, itemOf, planWords, rowCaution, rowLine, settingsSubline } from "./words";
import { unsavedWords } from "./form";
import { monthSoFar } from "./plan";

const DOC: SettingsDoc = {
  email: "alex.morgan@example.com",
  display_name: "Alex Morgan",
  avatar_url: null,
  role: "buyer",
  plan_tier: "starter",
  created_at: "2026-09-01T00:00:00Z",
  notifications: { digest: true, rfq_replies: true, saved_alerts: false },
  workspace: { company_name: "Example Apparel Ltd", company_type: "retailer", business_description: "Menswear basics", website: "https://example.com", customer_base: "UK retail", employee_count: "201-1000", company_logo_url: null },
};

describe("the words", () => {
  it("the navigation is Paper's two groups, and only pages that exist", () => {
    assert.deepEqual(SETTINGS_GROUPS.map((g) => g.title), ["Your account", "Your company"]);
    assert.deepEqual(SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label)), ["Profile", "Security", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
    assert.equal(itemOf("company").href, "/app/settings");
    const all = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label)).join(" ");
    assert.match(all, /Security/, "Security is built (row 6)");
    assert.doesNotMatch(all, /Audit/, "a page that is design only is not in the navigation");
  });

  it("the line under the email names the plan as the rail does", () => {
    assert.equal(settingsSubline(DOC), "alex.morgan@example.com · Free plan (beta)");
    assert.equal(settingsSubline({ ...DOC, email: null }), null);
    assert.equal(settingsSubline(null), null);
    assert.equal(planWords(DOC), "Free during the beta");
    assert.equal(planWords({ ...DOC, plan_tier: "growth" }), "Growth plan");
  });

  it("a phone row says what is in it, and says when the company is empty", () => {
    assert.equal(rowLine("company", DOC), "Example Apparel Ltd · Retailer");
    assert.equal(rowLine("company", { ...DOC, workspace: null }), "Not filled in yet");
    assert.equal(rowLine("plan", DOC), "Free in the beta");
    assert.equal(rowLine("team", DOC), "People, roles and invites");
  });

  it("the phone list's Security and Team rows say what the reads found, and never guess when a read failed", () => {
    assert.equal(rowLine("security", DOC, { factors: null }), "Two-step sign-in, devices");
    assert.equal(rowCaution("security", { factors: null }), false);
    assert.equal(rowLine("security", DOC, { factors: [] }), "Two-step sign-in is off");
    assert.equal(rowCaution("security", { factors: [] }), true);
    assert.equal(rowLine("security", DOC, { factors: [{ id: "f", verified: true, createdAt: null }] }), "Two-step sign-in is on");
    assert.equal(rowCaution("security", { factors: [{ id: "f", verified: true, createdAt: null }] }), false);
    const team = { ownerId: "o", myRole: "owner" as const, members: [{ userId: "o", name: "A", email: "a@x.co", role: "owner" as const, lastActiveAt: null, isYou: true }], invites: [] };
    assert.equal(rowLine("team", DOC, { team }), "1 person");
    assert.equal(rowLine("team", DOC, { team: null }), "People, roles and invites");
  });
});

describe("company details, the pure parts", () => {
  it("the type is kept as the database and the API hold it (lower case) and shown as a word", () => {
    // 0106's check and the settings route accept exactly these; a capitalised value is a 400 and a failed save.
    assert.deepEqual([...COMPANY_TYPES], ["brand", "retailer", "importer", "agent", "other"]);
    assert.equal(companyTypeWord("retailer"), "Retailer");
    assert.equal(workspaceOf({ workspace: { company_type: "Retailer" } } as SettingsDoc).company_type, "retailer", "a value stored with a capital is read as the list's own");
    assert.equal(valuesOf(workspaceOf(DOC)).company_type, "retailer");
  });

  it("reads the workspace, nulls where the reply has none", () => {
    assert.equal(workspaceOf(DOC).company_name, "Example Apparel Ltd");
    assert.deepEqual(workspaceOf({} as SettingsDoc), { company_name: null, company_type: null, business_description: null, website: null, customer_base: null, employee_count: null, company_logo_url: null });
  });

  it("names the fields that differ, in the page's order; a trailing space is not a change", () => {
    const saved = valuesOf(workspaceOf(DOC));
    assert.deepEqual(changedFields(saved, saved), []);
    assert.deepEqual(changedFields(saved, { ...saved, website: "https://new.example", company_name: "Example Apparel Ltd " }), ["website"]);
    assert.deepEqual(changedFields(saved, { ...saved, employee_count: "11-50", company_name: "Other" }), ["company_name", "employee_count"]);
    assert.equal(COMPANY_LABELS.business_description, "What you sell");
  });

  it("posts exactly the API's keys, trimmed, an empty one as null", () => {
    assert.deepEqual(workspacePayload({ company_name: "  Northwind  ", company_type: "agent", business_description: "", website: " https://n.example ", customer_base: "", employee_count: "1000+" }), {
      action: "update_workspace",
      company_name: "Northwind",
      company_type: "agent",
      business_description: null,
      website: "https://n.example",
      customer_base: null,
      employee_count: "1000+",
    });
  });

  it("reads a band as Paper does, and keeps a saved value outside today's lists selectable", () => {
    assert.equal(bandLabel("201-1000"), "201–1,000");
    assert.equal(bandLabel("1000+"), "1,000+");
    assert.equal(bandLabel("1-10"), "1–10");
    assert.ok(typeOptions("Distributor").includes("Distributor"));
    assert.ok(!typeOptions("brand").includes("Distributor"));
    assert.ok(bandOptions("5000+").includes("5000+"));
    assert.equal(typeOptions("").length, 5);
  });
});

describe("profile, the pure parts", () => {
  it("the picture's tile takes two letters from the name, else from the email", () => {
    assert.equal(initialsOf("Alex Morgan", null), "AM");
    assert.equal(initialsOf("Alex", null), "AL");
    assert.equal(initialsOf("", "zed@example.com"), "ZE");
    assert.equal(initialsOf(null, null), "?");
  });

  it("refuses what the server would, before asking it", () => {
    assert.match(pictureRefusal({ size: 10, type: "application/pdf" }) ?? "", /PNG, JPEG, WebP or GIF/);
    assert.match(pictureRefusal({ size: 6 * 1024 * 1024, type: "image/png" }) ?? "", /5 MB/);
    assert.equal(pictureRefusal({ size: 100, type: "image/webp" }), null);
    assert.equal(emailRefusal("you@company.com"), null);
    assert.match(emailRefusal("not an email") ?? "", /valid email/);
    assert.deepEqual(passwordRefusal("", "longenough", "longenough"), { field: "current", message: "Enter your current password." });
    assert.deepEqual(passwordRefusal("old-pass", "short", "short")?.field, "new");
    assert.match(passwordRefusal("old-pass", "short", "short")?.message ?? "", /at least 8/);
    assert.equal(passwordRefusal("longenough", "longenough", "longenough")?.field, "new");
    assert.deepEqual(passwordRefusal("old-pass", "longenough", "different"), { field: "confirm", message: "The two passwords do not match." });
    assert.equal(passwordRefusal("old-pass", "longenough", "longenough"), null);
    assert.ok(EMAIL_SENT.length > 0);
  });

  it("sends the current password with the new one, and puts a wrong current one under its own field", async () => {
    assert.deepEqual(passwordBody("old-pass", "new-pass-1"), { action: "change_password", current_password: "old-pass", new_password: "new-pass-1" });
    assert.equal(passwordFailureField(403), "current");
    assert.equal(passwordFailureField(400), "confirm");
    assert.equal(passwordFailureField(503), "confirm");
    const refusal: Fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: "That is not your current password." }) });
    const r = await postSettings(passwordBody("guess", "new-pass-1"), "x", { fetch: refusal });
    assert.deepEqual([r.ok, r.status, r.message], [false, 403, "That is not your current password."]);
    assert.equal(passwordFailureField(r.status), "current");
  });
});

describe("the saves", () => {
  type Call = { url: string; init?: { method: string; headers?: Record<string, string>; body?: string | FormData } };
  const answering = (ok: boolean, json: unknown, calls: Call[] = []): Fetch => async (url, init) => (calls.push({ url, init }), { ok, status: ok ? 200 : 400, json: async () => json });

  it("posts the body as JSON to the settings route", async () => {
    const calls: Call[] = [];
    const r = await postSettings({ action: "update_profile", display_name: "A" }, "x", { fetch: answering(true, { ok: true }, calls) });
    assert.equal(r.ok, true);
    assert.equal(calls[0]!.url, "/api/v1/settings");
    assert.equal(calls[0]!.init?.method, "POST");
    assert.deepEqual(JSON.parse(calls[0]!.init!.body as string), { action: "update_profile", display_name: "A" });
  });

  it("says the route's own sentence; never its key", async () => {
    assert.equal(routeSentence({ error: "Website must start with http:// or https://." }), "Website must start with http:// or https://.");
    assert.equal(routeSentence({ error: "change_email failed", detail: "rate limit" }), null);
    assert.equal(routeSentence({ error: "new_email must be a valid email address" }), null);
    const r1 = await postSettings({}, "Could not save.", { fetch: answering(false, { error: "Website must start with http:// or https://." }) });
    assert.deepEqual([r1.ok, r1.message], [false, "Website must start with http:// or https://."]);
    const r2 = await postSettings({}, "Could not save.", { fetch: answering(false, { error: "change_email failed", detail: "x" }) });
    assert.equal(r2.message, "Could not save.");
  });

  it("says the info the route sent with a success, and that nothing changed when it cannot be reached", async () => {
    const r = await postSettings({}, "x", { fetch: answering(true, { info: "Confirmation sent." }) });
    assert.equal(r.info, "Confirmation sent.");
    const down = await postSettings({}, "x", {
      fetch: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(down.ok, false);
    assert.match(down.message ?? "", /Nothing was changed/);
  });

  it("the picture goes up as a file and comes down with a DELETE", async () => {
    const calls: Call[] = [];
    const r = await postAvatar(new Blob(["x"], { type: "image/png" }), { fetch: answering(true, { avatar_url: "https://x.test/a.png" }, calls) });
    assert.equal(r.json?.avatar_url, "https://x.test/a.png");
    assert.equal(calls[0]!.url, "/api/v1/settings/avatar");
    assert.ok(calls[0]!.init?.body instanceof FormData);
    await deleteAvatar({ fetch: answering(true, { ok: true }, calls) });
    assert.equal(calls[1]!.init?.method, "DELETE");
  });
});

// ---------------------------------------------------------------------------
// The routes, over a fake `@/lib/supabase/server` installed before they load.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
let answer: Rpc = { data: DOC, error: null };
let saved: Rpc = { data: [], error: null };
let calls: string[] = [];
let packs: { count: number | null; error: unknown } = { count: null, error: { message: "no table evidence_pack_downloads" } };
let packAsked: unknown[][] = [];
let mfa: { data: unknown; error: unknown } = { data: null, error: { message: "no auth" } };
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    rpc: async (fn: string) => (calls.push(fn), fn === "buyer_saved_list" ? saved : answer),
    auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } } }), mfa: { listFactors: async () => mfa } },
    // The evidence packs downloaded this month: a count under the buyer's own rows since the 1st.
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (...a: unknown[]) => (packAsked.push([table, ...a]), chain),
        gte: (...a: unknown[]) => (packAsked.push([table, ...a]), Promise.resolve({ data: null, ...packs })),
      };
      return chain;
    },
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as () => Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const page = async (file: string) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, await route(file)())));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const navOf = (out: string) => [...(out.match(/<nav aria-label="Settings"[\s\S]*?<\/nav>/)?.[0] ?? "").matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

const COMPANY = "app/(app)/app/settings/page.js";
const WORKSPACE = "app/(app)/app/settings/workspace/page.js";
const PROFILE = "app/(app)/app/settings/profile/page.js";

describe("/app/settings and /app/settings/workspace", () => {
  for (const file of [COMPANY, WORKSPACE]) {
    it(`${file.replace(/^app\/\(app\)|\/page\.js$/g, "")}: Paper's seven links, Company details current, the plan as the rail reads it`, async () => {
      answer = { data: DOC, error: null };
      calls = [];
      const out = await page(file);
      assert.deepEqual(calls, file === COMPANY ? ["settings_get", "workspace_team"] : ["settings_get"], "read once (the phone list also reads the team)");
      assert.deepEqual(navOf(out), ["Profile", "Security", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
      assert.match(out, /aria-current="page"[^>]*>Company details</);
      assert.equal(out.match(/aria-current="page"/g)?.length, 1);
      assert.match(text(out), /alex\.morgan@example\.com · Free plan \(beta\)/);
      assert.match(out, /<h1[^>]*>Company details<\/h1>/);
      assert.match(text(out), /Suppliers see your company name and website on every RFQ\./);
    });
  }

  it("draws the company as saved, and no bar until something changes", async () => {
    answer = { data: DOC, error: null };
    const out = await page(WORKSPACE);
    assert.match(out, /<form[^>]*aria-label="Company details"/);
    assert.match(out, /value="Example Apparel Ltd"/);
    assert.match(out, /value="https:\/\/example\.com"/);
    assert.match(out, /value="UK retail"/);
    assert.match(out, />Menswear basics<\/textarea>/);
    assert.match(out, /value="retailer"[^>]*checked|checked[^>]*value="retailer"/);
    assert.match(text(out), /201–1,000/);
    assert.doesNotMatch(text(out), /Unsaved changes/);
  });

  it("an account with no company yet draws the form empty, not an error", async () => {
    answer = { data: { ...DOC, workspace: undefined }, error: null };
    const out = await page(WORKSPACE);
    assert.match(out, /<form[^>]*aria-label="Company details"/);
    assert.doesNotMatch(out, /role="alert"/);
    assert.match(text(out), /Not set/, "an empty Employees says so, and a chosen one can be put back to it");
    assert.doesNotMatch(text(out), /Clear/, "nothing to clear while no company type is chosen");
  });

  it("a chosen company type can be cleared", async () => {
    answer = { data: DOC, error: null };
    assert.match(text(await page(WORKSPACE)), /Clear/);
  });

  it("on a phone /app/settings is the list: every page, with what is in it, and Company details at its own address", async () => {
    answer = { data: DOC, error: null };
    const out = await page(COMPANY);
    const t = text(out);
    for (const row of ["Profile", "Security", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]) assert.ok(t.includes(row), row);
    assert.match(t, /Example Apparel Ltd · Retailer/);
    assert.match(t, /Free in the beta/);
    assert.match(t, /Signed in as alex\.morgan@example\.com/);
    assert.match(t, /RFQ template Opening message and questions/, "Paper's phone row is singular");
    assert.match(t, /Two-step sign-in, devices/, "a failed factors read says what is in the page, never that it is off");
    assert.doesNotMatch(out, /data-detail/, "the list keeps the frame's bar and tab bar");
    assert.ok(out.includes('href="/app/settings/workspace"'), "the list's Company details goes to its own page");
    assert.doesNotMatch(t, /Audit log/);
  });

  it("the phone list says when two-step sign-in is off, in caution, and what the team holds", async () => {
    answer = { data: DOC, error: null };
    mfa = { data: { all: [] }, error: null };
    const off = await page(COMPANY);
    assert.match(off, /text-caution[^"]*">Two-step sign-in is off</);
    mfa = { data: { all: [{ id: "f1", factor_type: "totp", status: "verified" }] }, error: null };
    assert.match(text(await page(COMPANY)), /Two-step sign-in is on/);
    mfa = { data: null, error: { message: "no auth" } };
  });

  it("a phone page opens with its own head: back to the list, its name and what it holds, and hides the frame's bar", async () => {
    answer = { data: DOC, error: null };
    const out = await page(WORKSPACE);
    assert.match(out, /data-detail=""/);
    assert.match(out, /<a[^>]*href="\/app\/settings"[^>]*aria-label="Back to Settings"|<a[^>]*aria-label="Back to Settings"[^>]*href="\/app\/settings"/);
    assert.match(text(out), /Suppliers see the name and website on every RFQ/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
  });

  it("a failed read is an error and draws no form and no list", async () => {
    for (const bad of [{ data: null, error: { message: "boom" } }, { data: null, error: null }] as Rpc[]) {
      answer = bad;
      for (const file of [COMPANY, WORKSPACE]) {
        const out = await page(file);
        assert.match(out, /role="alert"/);
        assert.match(text(out), /We couldn't load your settings\./);
        assert.match(text(out), /Your settings are safe/);
        assert.doesNotMatch(out, /<form/);
        assert.doesNotMatch(text(out), /Not filled in yet/);
      }
    }
  });
});

describe("/app/settings/profile", () => {
  it("draws the name, the email, the password and Sign out, with Profile current", async () => {
    answer = { data: DOC, error: null };
    const out = await page(PROFILE);
    assert.match(out, /<h1[^>]*>Profile<\/h1>/);
    assert.match(out, /aria-current="page"[^>]*>Profile</);
    assert.match(out, /value="Alex Morgan"/);
    assert.match(out, /Current: <\/span>/);
    assert.match(text(out), /Now alex\.morgan@example\.com/, "Paper's phone words for the address in use");
    assert.match(text(out), /Sign out of this device/);
    assert.match(out, /data-detail=""/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /type="password"/);
    assert.match(out, /action="\/auth\/sign-out" method="post"/);
    assert.match(text(out), /Upload picture/);
    assert.match(text(out), /Current password/, "the route checks the current password (ST-03), so the form asks for it");
    assert.match(out, /autoComplete="current-password"|autocomplete="current-password"/i);
    assert.match(out, /href="\/forgot-password"/);
  });

  it("a failed read says so where the name was, and leaves the email and the password usable", async () => {
    answer = { data: null, error: { message: "boom" } };
    const out = await page(PROFILE);
    assert.match(text(out), /We couldn't load your profile\./);
    assert.doesNotMatch(out, /value="Alex Morgan"/);
    assert.match(text(out), /Your current address could not be read\./);
    assert.doesNotMatch(text(out), /Current: /);
    assert.match(out, /aria-label="Change email"/);
    assert.match(out, /aria-label="Change password"/);
  });
});

describe("RFQ templates, the pure parts", () => {
  it("shows the composer's own defaults until the buyer has saved their own", () => {
    assert.equal(inquiryOf({} as SettingsDoc), null);
    assert.deepEqual(startOf(null), { questions: [...DEFAULT_QUESTIONS], template: DEFAULT_TEMPLATE });
    assert.deepEqual(startOf({ questions: [], email_template: null }).questions, [...DEFAULT_QUESTIONS]);
    assert.deepEqual(startOf({ questions: ["MOQ per colour?"], email_template: "Hi {{supplier}}" }), { questions: ["MOQ per colour?"], template: "Hi {{supplier}}" });
    assert.deepEqual(FILL_INS.map((f) => f.token), ["{{supplier}}", "{{product}}", "{{user}}", "{{company}}", "{{website}}"]);
  });

  it("posts trimmed questions, at most 20 of at most 200 characters, and an empty template as null", () => {
    const many = Array.from({ length: 25 }, (_, i) => ` Q${i} `);
    const body = inquiryPayload([...many, "", "x".repeat(250)], "   ");
    assert.equal(body.action, "update_inquiry");
    assert.equal(body.questions.length, MAX_QUESTIONS);
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

  it("puts a fill-in where the caret is, over a selection, and clamps a caret past the end", () => {
    assert.deepEqual(insertAt("Dear ,", 5, 5, "{{supplier}}"), { text: "Dear {{supplier}},", caret: 17 });
    assert.deepEqual(insertAt("Dear X,", 5, 6, "{{supplier}}"), { text: "Dear {{supplier}},", caret: 17 });
    assert.equal(insertAt("Hi", 99, 99, "{{user}}").text, "Hi{{user}}");
  });

  it("the preview fills in what is known and leaves the rest in brackets, so the gap is seen first", () => {
    const full = previewOf(DEFAULT_TEMPLATE, { supplier: "Aboni Knitwear Ltd.", user: "Alex Morgan", company: "Example Apparel Ltd", website: "https://example.com" });
    assert.deepEqual(full.gaps, []);
    assert.ok(full.pieces.some((p) => !p.gap && p.text.includes("Dear Aboni Knitwear Ltd.")));
    assert.ok(full.pieces.some((p) => p.gap && p.text === "[Product line from the RFQ]"), "the product line is the RFQ's");
    const gappy = previewOf(DEFAULT_TEMPLATE, { supplier: null, user: "Alex Morgan", company: "Example Apparel Ltd", website: null });
    assert.deepEqual(gappy.gaps, ["website"]);
    assert.ok(gappy.pieces.some((p) => p.gap && p.text === "[Supplier name]"));
    assert.ok(gappy.pieces.some((p) => p.gap && p.text === "[website]"));
    assert.match(gapWords(gappy.gaps), /1 gap to fill: your website in Company details\. The product line comes from each RFQ\./);
    assert.match(gapWords([]), /Nothing of yours is missing\./);
    assert.match(gapWords(["your name", "website"]), /2 gaps to fill: your name in Profile and your website in Company details\./);
  });
});

describe("emails and the plan, the words", () => {
  it("the three switches are Paper's, and a switch says what it turned", () => {
    assert.deepEqual(EMAIL_ROWS.map((r) => [r.key, r.title]), [["rfq_replies", "Quotes"], ["saved_alerts", "Saved suppliers"], ["digest", "Weekly summary"]]);
    assert.equal(turnedWords("rfq_replies", true), "Quotes turned on");
    assert.equal(turnedWords("digest", false), "Weekly summary turned off");
    assert.ok(!EMAIL_ROWS.some((r) => /always on/i.test(r.line)), "no row promises an email nothing sends");
  });

  it("the plan has one name, the rail's: Free, never Starter", () => {
    assert.equal(planLabel("starter"), "Free");
    assert.equal(planLabel(null), "Free");
    assert.equal(planLabel("growth"), "Growth");
  });
});

describe("the other three pages (Team and roles is `components/team/team.test.ts`)", () => {
  const EMAILS = "app/(app)/app/settings/notifications/page.js";
  const TEMPLATES = "app/(app)/app/settings/inquiry/page.js";
  const PLAN = "app/(app)/app/settings/subscription/page.js";

  for (const [file, current] of [
    [EMAILS, "Emails"],
    [TEMPLATES, "RFQ templates"],
    [PLAN, "Plan and usage"],
  ] as const) {
    it(`${current}: Paper's seven links with it current, and one h1`, async () => {
      answer = { data: DOC, error: null };
      const out = await page(file);
      assert.deepEqual(navOf(out), ["Profile", "Security", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
      assert.match(out, new RegExp(`aria-current="page"[^>]*>${current}<`));
      assert.equal(out.match(/aria-current="page"/g)?.length, 1);
      assert.equal(out.match(/<h1\b/g)?.length, 1);
      assert.match(out, new RegExp(`<h1[^>]*>${current}</h1>`));
    });

    it(`${current}: a failed read is an error, and nothing claims what the account holds`, async () => {
      answer = { data: null, error: { message: "boom" } };
      const out = await page(file);
      assert.match(out, /role="alert"/);
      assert.match(text(out), /We couldn't load your settings\./);
      assert.doesNotMatch(out, /<form|role="switch"|Owner|Free during the beta/);
    });
  }

  it("Emails draws the three switches as saved, each named", async () => {
    answer = { data: DOC, error: null };
    const out = await page(EMAILS);
    assert.equal(out.match(/role="switch"/g)?.length, 3);
    const tag = (key: string) => out.match(new RegExp(`<input[^>]*aria-labelledby="email-${key}"[^>]*>`))?.[0] ?? "";
    assert.match(tag("rfq_replies"), /checked=""/);
    assert.doesNotMatch(tag("saved_alerts"), /checked=""/, "saved alerts is off in the document");
    assert.match(text(out), /Sending starts later in the beta/);
    assert.doesNotMatch(text(out), /Slack|Always on/);
    assert.match(text(out), /Sending starts later in the beta\. Your choices are saved now\./, "the phone's note");
    assert.match(text(out), /Saved as you switch · to alex\.morgan@example\.com/);
    assert.match(text(out), /What we email you about/);
  });

  it("Plan and usage on a phone: the plan as a card, this month so far, and support", async () => {
    answer = { data: DOC, error: null };
    packs = { count: 2, error: null };
    const t = text(await page(PLAN));
    assert.match(t, /Your plan Free in the beta Includes Search, saved suppliers, RFQs, messages, orders and the compliance hub Billing Not set up\. Nothing is charged\./);
    assert.match(t, /This month 1( to \d+)? \w{3} Evidence packs 2/);
    assert.match(t, /Contact support about your plan/);
    assert.doesNotMatch(t, /RFQs sent|up to 50 a day/, "no read gives either");
    packs = { count: null, error: { message: "no table" } };
    assert.equal(monthSoFar(new Date("2026-10-11T08:00:00Z")), "1 to 11 Oct");
    assert.equal(monthSoFar(new Date("2026-10-01T08:00:00Z")), "1 Oct");
  });

  it("RFQ templates on a phone: the opening message, Insert fill-in and Save as pills, and the questions counted", async () => {
    answer = { data: DOC, error: null };
    const out = await page(TEMPLATES);
    const t = text(out);
    assert.match(t, /Opening message/);
    assert.match(t, /How every new RFQ starts/);
    assert.match(t, new RegExp(`Questions ${DEFAULT_QUESTIONS.length} Up to 20, in this order`));
    assert.equal(out.match(/>Save message</g)?.length, 2, "the phone pill and the desktop button");
    // One arrow a row on a phone: down on every row but the last, up on the last. Both stay from 768.
    const arrow = (n: number, way: string) => out.match(new RegExp(`<button[^>]*aria-label="Move question ${n} ${way}"[^>]*>`))?.[0] ?? "";
    const last = DEFAULT_QUESTIONS.length;
    assert.match(arrow(1, "up"), /max-md:hidden/);
    assert.doesNotMatch(arrow(1, "down"), /max-md:hidden/);
    assert.match(arrow(last, "down"), /max-md:hidden/);
    assert.doesNotMatch(arrow(last, "up"), /max-md:hidden/);
  });

  it("from 768 a page's first block keeps its hairline: nothing wraps the plan's sections", async () => {
    answer = { data: DOC, error: null };
    const out = await page(PLAN);
    assert.match(out, /<\/div><section aria-label="Your plan" class="[^"]*border-t[^"]*max-md:hidden[^"]*">/, "a sibling of the phone page, not the first child of a wrapper");
    assert.match(out, /<section aria-label="Enterprise · talk to us" class="[^"]*max-md:hidden/);
    // On a phone the first block of a page sits under the compact head without one.
    assert.match(await page(PROFILE), /<section aria-label="Your name" class="[^"]*max-md:first-of-type:border-t-0/);
  });

  it("Company details on a phone: the type as pills, and one bar at the foot that names what changed", async () => {
    answer = { data: DOC, error: null };
    const out = await page(WORKSPACE);
    assert.match(out, /<div role="radiogroup" aria-label="Company type"[^>]*md:hidden/);
    assert.match(out, /<input[^>]*type="radio"[^>]*name="company_type_phone"[^>]*checked=""[^>]*value="retailer"|<input[^>]*type="radio"[^>]*name="company_type_phone"[^>]*value="retailer"[^>]*checked=""/, "the saved type is the one chosen");
    assert.equal(unsavedWords(["Website"]), "Unsaved change: website");
    assert.equal(unsavedWords(["Company name", "Website"]), "Unsaved changes: company name, website");
  });

  it("RFQ templates shows the composer's defaults until the buyer has questions of their own, then theirs", async () => {
    answer = { data: DOC, error: null };
    const defaults = await page(TEMPLATES);
    for (const q of DEFAULT_QUESTIONS) assert.ok(defaults.includes(`value="${q}"`), `default question missing: ${q}`);
    assert.match(defaults, />Dear \{\{supplier\}\},/);
    answer = { data: { ...DOC, inquiry: { questions: ["Lead time for 5,000 pcs?"], email_template: "Hello {{supplier}}" } }, error: null };
    const own = await page(TEMPLATES);
    assert.match(own, /value="Lead time for 5,000 pcs\?"/);
    assert.ok(!own.includes(`value="${DEFAULT_QUESTIONS[0]}"`));
    assert.match(own, />Hello \{\{supplier\}\}<\/textarea>/);
  });

  it("RFQ templates previews the message with the buyer's own facts and the gaps in brackets", async () => {
    answer = { data: { ...DOC, workspace: { ...DOC.workspace, website: null } }, error: null };
    const t = text(await page(TEMPLATES));
    assert.match(t, /Preview/);
    assert.match(t, /Alex Morgan/);
    assert.match(t, /Example Apparel Ltd/);
    assert.match(t, /\[website\]/);
    assert.match(t, /1 gap to fill: your website in Company details\./);
  });

  it("RFQ templates is written to the supplier saved most recently, by name; a failed read of it is only 'Preview'", async () => {
    answer = { data: DOC, error: null };
    saved = { data: [{ company_name: "ABONI KNITWEAR LTD." }], error: null };
    assert.match(text(await page(TEMPLATES)), /Preview with Aboni Knitwear Ltd/);
    saved = { data: null, error: { message: "boom" } };
    const out = await page(TEMPLATES);
    assert.match(text(out), /Preview/);
    assert.doesNotMatch(text(out), /Preview with/);
    assert.doesNotMatch(out, /role="alert"/, "the preview's read is not the page's");
    saved = { data: [], error: null };
  });

  it("with several saved suppliers the preview has a 'Preview with' picker that starts on the most recent; with one it is only a heading", async () => {
    answer = { data: DOC, error: null };
    saved = { data: [{ company_name: "ABONI KNITWEAR LTD." }, { company_name: "TEX TOWN LTD" }], error: null };
    const many = await page(TEMPLATES);
    assert.match(many, /aria-label="Preview with"/);
    assert.match(text(many), /Preview with Aboni Knitwear Ltd/, "the field shows the most recent supplier");
    assert.match(text(many), /Hello Aboni Knitwear Ltd|Aboni Knitwear Ltd/, "and the message is written to it");
    saved = { data: [{ company_name: "ABONI KNITWEAR LTD." }], error: null };
    const one = await page(TEMPLATES);
    assert.doesNotMatch(one, /aria-label="Preview with"/);
    assert.match(text(one), /Preview with Aboni Knitwear Ltd/);
    saved = { data: [], error: null };
  });

  it("the preview's suppliers: the twelve most recent by name, newest first; a failed read is none", async () => {
    const asked: unknown[] = [];
    const ok = { rpc: async (_fn: string, args: unknown) => (asked.push(args), { data: [{ company_name: "ABONI KNITWEAR LTD." }, { company_name: "  " }, { company_name: "TEX TOWN LTD" }], error: null }) };
    assert.deepEqual(await loadPreviewSuppliers(ok), ["Aboni Knitwear Ltd", "Tex Town Ltd"]);
    assert.deepEqual(asked, [{ p_sort: "recent", p_limit: 12, p_offset: 0 }]);
    assert.deepEqual(await loadPreviewSuppliers({ rpc: async () => ({ data: null, error: { message: "x" } }) }), []);
    assert.deepEqual(await loadPreviewSuppliers({ rpc: async () => { throw new Error("down"); } }), []);
  });

  it("Plan and usage says Free during the beta, that billing is not set up, and sells no contact reveal", async () => {
    answer = { data: DOC, error: null };
    const out = await page(PLAN);
    const t = text(out);
    assert.match(t, /Free during the beta/);
    assert.match(t, /Billing isn't set up yet\./);
    assert.match(t, /Enterprise · talk to us/);
    assert.match(t, /Team seats with roles/);
    assert.doesNotMatch(t, /Single sign-on|Audit log|Evidence packs for auditors/, "the Enterprise list names only what exists");
    assert.match(out, /href="mailto:support@sourcebd\.net/);
    assert.doesNotMatch(t, /[Cc]ontact reveal|reveal/);
    assert.doesNotMatch(t, /This month|Starter/, "Paper's usage counts are design only, and a count that could not be read is not drawn");
  });

  it("Plan and usage counts the evidence packs downloaded since the 1st of the month, the buyer's own, and never prints 0 for a failed count", async () => {
    answer = { data: DOC, error: null };
    packs = { count: 3, error: null };
    packAsked = [];
    const t = text(await page("app/(app)/app/settings/subscription/page.js"));
    assert.match(t, /This month Evidence packs downloaded 3/);
    const month = new Date();
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString();
    assert.deepEqual(packAsked, [["evidence_pack_downloads", "owner_id", "buyer-1"], ["evidence_pack_downloads", "created_at", first]]);
    packs = { count: 0, error: null };
    assert.match(text(await page("app/(app)/app/settings/subscription/page.js")), /Evidence packs downloaded 0/, "a read that worked and found none is 0");
    packs = { count: null, error: { message: "no table" } };
    assert.doesNotMatch(text(await page("app/(app)/app/settings/subscription/page.js")), /This month|Evidence packs downloaded/);
  });
});

describe("the loading states", () => {
  it("Settings and Profile have their own skeleton, in the content region", () => {
    for (const f of ["settings/loading.tsx", "settings/profile/loading.tsx", "settings/notifications/loading.tsx"]) assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", ...f.split("/"))), f);
  });
});
