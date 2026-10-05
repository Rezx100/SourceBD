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
import { inquiryOf, planLabel, workspaceOf, type SettingsDoc } from "./doc";
import { EMAIL_ROWS, turnedWords } from "./emails";
import { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE, FILL_INS, MAX_QUESTIONS, gapWords, inquiryPayload, insertAt, moveItem, previewOf, startOf } from "./templates";
import { EMAIL_SENT, emailRefusal, initialsOf, passwordRefusal, pictureRefusal } from "./profile";
import { deleteAvatar, postAvatar, postSettings, routeSentence, type Fetch } from "./transport";
import { SETTINGS_GROUPS, itemOf, planWords, rowLine, settingsSubline } from "./words";

const DOC: SettingsDoc = {
  email: "alex.morgan@example.com",
  display_name: "Alex Morgan",
  avatar_url: null,
  role: "buyer",
  plan_tier: "starter",
  created_at: "2026-09-01T00:00:00Z",
  notifications: { digest: true, rfq_replies: true, saved_alerts: false },
  workspace: { company_name: "Example Apparel Ltd", company_type: "Retailer", business_description: "Menswear basics", website: "https://example.com", customer_base: "UK retail", employee_count: "201-1000", company_logo_url: null },
};

describe("the words", () => {
  it("the navigation is Paper's two groups, and only pages that exist", () => {
    assert.deepEqual(SETTINGS_GROUPS.map((g) => g.title), ["Your account", "Your company"]);
    assert.deepEqual(SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label)), ["Profile", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
    assert.equal(itemOf("company").href, "/app/settings");
    const all = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label)).join(" ");
    assert.doesNotMatch(all, /Security|Audit/, "a page that is design only is not in the navigation");
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
    assert.equal(rowLine("plan", DOC), "Free during the beta");
    assert.equal(rowLine("team", DOC), "People, roles and invites");
  });
});

describe("company details, the pure parts", () => {
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
    assert.deepEqual(workspacePayload({ company_name: "  Northwind  ", company_type: "Agent", business_description: "", website: " https://n.example ", customer_base: "", employee_count: "1000+" }), {
      action: "update_workspace",
      company_name: "Northwind",
      company_type: "Agent",
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
    assert.ok(!typeOptions("Brand").includes("Distributor"));
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
    assert.match(passwordRefusal("short", "short") ?? "", /at least 8/);
    assert.match(passwordRefusal("longenough", "different") ?? "", /do not match/);
    assert.equal(passwordRefusal("longenough", "longenough"), null);
    assert.ok(EMAIL_SENT.length > 0);
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
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = { rpc: async (fn: string) => (calls.push(fn), fn === "buyer_saved_list" ? saved : answer) };
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
    it(`${file.replace(/^app\/\(app\)|\/page\.js$/g, "")}: Paper's six links, Company details current, the plan as the rail reads it`, async () => {
      answer = { data: DOC, error: null };
      calls = [];
      const out = await page(file);
      assert.deepEqual(calls, ["settings_get"], "read once");
      assert.deepEqual(navOf(out), ["Profile", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
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
    assert.match(out, /value="Retailer"[^>]*checked|checked[^>]*value="Retailer"/);
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
    for (const row of ["Profile", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]) assert.ok(t.includes(row), row);
    assert.match(t, /Example Apparel Ltd · Retailer/);
    assert.match(t, /Free during the beta/);
    assert.ok(out.includes('href="/app/settings/workspace"'), "the list's Company details goes to its own page");
    assert.doesNotMatch(t, /Security|Audit log/);
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
    assert.match(text(out), /Current: alex\.morgan@example\.com/);
    assert.match(out, /type="password"/);
    assert.match(out, /action="\/auth\/sign-out" method="post"/);
    assert.match(text(out), /Upload picture/);
    assert.doesNotMatch(text(out), /Current password/, "the API takes no current password, so no field claims to check one");
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
    it(`${current}: Paper's six links with it current, and one h1`, async () => {
      answer = { data: DOC, error: null };
      const out = await page(file);
      assert.deepEqual(navOf(out), ["Profile", "Emails", "Company details", "Team and roles", "RFQ templates", "Plan and usage"]);
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

  it("Plan and usage says Free during the beta, that billing is not set up, and sells no contact reveal", async () => {
    answer = { data: DOC, error: null };
    const out = await page(PLAN);
    const t = text(out);
    assert.match(t, /Free during the beta/);
    assert.match(t, /Billing isn't set up yet\./);
    assert.match(t, /Enterprise · talk to us/);
    assert.match(out, /href="mailto:support@sourcebd\.net/);
    assert.doesNotMatch(t, /[Cc]ontact reveal|reveal/);
    assert.doesNotMatch(t, /This month|Starter/, "Paper's usage counts are design only");
  });
});

describe("the loading states", () => {
  it("Settings and Profile have their own skeleton, in the content region", () => {
    for (const f of ["settings/loading.tsx", "settings/profile/loading.tsx", "settings/notifications/loading.tsx"]) assert.ok(existsSync(path.join(process.cwd(), "app", "(app)", "app", ...f.split("/"))), f);
  });
});
