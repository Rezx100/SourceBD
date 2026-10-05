// The buyer's first-run steps (B8b) at the boundaries a person meets: the pure words and refusals, what
// the loader decides (sign in, where a supplier goes, a finished flow, which step is next, an unreadable
// answer), each action's refusals and database calls and where it redirects, and the three pages with
// what was already answered. Supabase is a fake installed before the modules load.

import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { DraftProvider } from "@/components/onboarding/draft";
import {
  TERMS_VERSION,
  aboutRefusal,
  certWords,
  companyRefusal,
  firstResultsHref,
  firstStep,
  headingsOf,
  parseAnswers,
  sourceRefusal,
  startPath,
  stepLine,
  stepOf,
  type BuyerAnswers,
} from "@/lib/onboarding";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

type Answer = { data?: unknown; error?: { message: string } | null };
let user: { id: string; email: string } | null = { id: "u1", email: "alex.morgan@example.com" };
let profile: Record<string, unknown> | null = { role: "buyer", display_name: null, onboarding_state: {} };
let calls: { fn: string; args: unknown }[] = [];
let answers: Record<string, Answer> = {};

const BLANK = { job_role: null, terms_version: null, terms_accepted_at: null, company_country: null, sourcing_hs_headings: null, required_cert_kinds: null, sell_markets: null };
const CATALOGUE = [
  { hs: "6109", heading: "T-shirts and vests", exporter_count: 1763 },
  { hs: "6105", heading: "Men's shirts, knitted", exporter_count: 1634 },
  { hs: "6110", heading: "Jumpers, sweatshirts and cardigans", exporter_count: 1777 },
  { hs: "6104", heading: "Women's suits, dresses and skirts, knitted", exporter_count: 1797 },
  { hs: "6205", heading: "Men's shirts, woven", exporter_count: 1339 },
  { hs: "6203", heading: "Men's suits and trousers, woven", exporter_count: 1711 },
  { hs: "6302", heading: "Bed linen and table linen", exporter_count: 1200 },
];

{
  const server = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      if ((answers[fn] as { throws?: boolean } | undefined)?.throws) throw new Error("network");
      return answers[fn] ?? { data: null, error: null };
    },
  };
  require.cache[server] = { id: server, filename: server, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
  // The search count the panel reads is a signed-in action over the public search; the pages never call it here.
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake above must be in place before these load.
const mod = (p: string) => require(path.join(OUT, p));
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
async function draw(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return plain(out.replace(/<!--[\s\S]*?-->/g, ""));
}
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
/** The `<input>` with this name and value, whichever order React wrote its attributes in. */
const input = (out: string, name: string, value: string): string => [...out.matchAll(/<input[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`name="${name}"`) && t.includes(`value="${value}"`)) ?? "";

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const digest = String((e as { digest?: string }).digest ?? "");
    if (!digest.startsWith("NEXT_REDIRECT")) throw e;
    return decodeURIComponent(digest.split(";")[2] ?? "");
  }
}
const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const rpc = (fn: string) => calls.find((c) => c.fn === fn)?.args as Record<string, unknown> | undefined;

beforeEach(() => {
  user = { id: "u1", email: "alex.morgan@example.com" };
  profile = { role: "buyer", display_name: null, onboarding_state: {} };
  calls = [];
  answers = { onboarding_get_buyer: { data: BLANK, error: null }, settings_get: { data: { display_name: null, workspace: {} }, error: null }, hs_catalogue: { data: CATALOGUE, error: null } };
});

// ---------------------------------------------------------------------------
// The pure parts
// ---------------------------------------------------------------------------

const ANSWERED: BuyerAnswers = { jobRole: "sourcing", termsVersion: TERMS_VERSION, country: "GB", hs: ["6109"], certs: ["gots"], markets: ["UK"] };

describe("the steps and what they refuse", () => {
  it("three steps, named as Paper names them", () => {
    assert.equal(stepOf("about"), "about");
    assert.equal(stepOf("nope"), null);
    assert.equal(stepLine("company"), "Step 2 of 3");
  });

  it("About you needs a name and one of Paper's five roles", () => {
    assert.deepEqual(aboutRefusal({ name: " ", role: "sourcing" }), { field: "name", message: "Enter your name." });
    assert.equal(aboutRefusal({ name: "Alex", role: "boss" })?.field, "role");
    assert.equal(aboutRefusal({ name: "Alex", role: "compliance" }), null);
    assert.equal(aboutRefusal({ name: "x".repeat(121), role: "other" })?.field, "name");
  });

  it("Your company needs a name, a type the database knows, a country on the list and a size band", () => {
    const ok = { company: "Example Apparel Ltd", type: "retailer", country: "GB", people: "51-200" };
    assert.equal(companyRefusal(ok), null);
    assert.equal(companyRefusal({ ...ok, company: "" })?.field, "company");
    assert.equal(companyRefusal({ ...ok, type: "Retailer" })?.field, "type", "the stored value is lower case");
    assert.equal(companyRefusal({ ...ok, country: "ZZ" })?.field, "country");
    assert.equal(companyRefusal({ ...ok, people: "300" })?.field, "people");
  });

  it("What you source needs at least one four-digit heading, known certificates and markets", () => {
    assert.equal(sourceRefusal({ hs: [], certs: [], markets: [] })?.field, "hs");
    assert.equal(sourceRefusal({ hs: ["61"], certs: [], markets: [] })?.field, "hs");
    assert.equal(sourceRefusal({ hs: ["6109"], certs: ["fsc"], markets: [] })?.field, "certs");
    assert.equal(sourceRefusal({ hs: ["6109"], certs: ["gots"], markets: ["MARS"] })?.field, "markets");
    assert.equal(sourceRefusal({ hs: ["6109"], certs: ["gots", "wrap"], markets: ["UK", "US"] }), null);
  });

  it("the headings come out of the form once each, four digits only", () => {
    assert.deepEqual(headingsOf(["6109", " 6105 ", "6109", "61", "abcd", ""]), ["6109", "6105"]);
  });

  it("compliance people start on Compliance, everyone else on Search", () => {
    assert.equal(startPath("compliance"), "/app/compliance");
    assert.equal(startPath("sourcing"), "/app");
    assert.equal(startPath(null), "/app");
  });

  it("the first results open the search the answers describe, with the welcome note", () => {
    const href = firstResultsHref(["6109", "6105"], ["gots"]);
    assert.match(href, /^\/app\/discover\?/);
    const q = new URLSearchParams(href.split("?")[1]);
    assert.equal(q.get("hs"), "6109,6105");
    assert.match(q.get("cert") ?? "", /gots/);
    assert.equal(q.get("welcome"), "1");
  });

  it("certificates are named the way Paper does", () => {
    assert.equal(certWords(["gots"]), "GOTS");
    assert.equal(certWords(["wrap", "gots"]), "GOTS or WRAP");
    assert.equal(certWords(["sa8000", "gots", "wrap"]), "GOTS, WRAP or SA8000");
  });

  it("the step is the first with an answer missing; none when all three are in", () => {
    const full = { name: "Alex Morgan", company: "Example Apparel Ltd", companyType: "retailer", people: "51-200" };
    assert.equal(firstStep({ ...ANSWERED, jobRole: null }, full), "about");
    assert.equal(firstStep(ANSWERED, { ...full, name: null }), "about");
    assert.equal(firstStep(ANSWERED, { ...full, people: null }), "company");
    assert.equal(firstStep({ ...ANSWERED, country: null }, full), "company");
    assert.equal(firstStep({ ...ANSWERED, hs: [] }, full), "source");
    assert.equal(firstStep(ANSWERED, full), null);
  });

  it("an answer that is not the shape is null, never 'nothing chosen'", () => {
    assert.equal(parseAnswers(null), null);
    assert.equal(parseAnswers([]), null);
    assert.equal(parseAnswers("x"), null);
    assert.deepEqual(parseAnswers({ job_role: "boss", sourcing_hs_headings: ["6109", 7], required_cert_kinds: ["gots", "fsc"], sell_markets: ["UK", "MARS"] }), {
      jobRole: null,
      termsVersion: null,
      country: null,
      hs: ["6109"],
      certs: ["gots"],
      markets: ["UK"],
    });
  });
});

// ---------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------

describe("the loader", () => {
  const load = async (at = "/onboarding/about") => {
    const sb = await (mod("lib/supabase/server.js").createSupabaseServerClient as () => Promise<unknown>)();
    return (mod("app/(auth)/onboarding/load.js").loadOnboarding as (c: unknown, at: string) => Promise<{ kind: string; to?: string; step?: string | null; answers?: unknown; email?: string }>)(sb, at);
  };

  it("signed out goes to sign in and comes back to the same step", async () => {
    user = null;
    assert.deepEqual(await load("/onboarding/company"), { kind: "redirect", to: "/login?next=%2Fonboarding%2Fcompany" });
  });

  it("a supplier goes to the portal and an admin to the app, never into the buyer's questions", async () => {
    profile = { role: "supplier" };
    assert.equal((await load()).to, "/supplier");
    profile = { role: "admin" };
    assert.equal((await load()).to, "/app");
  });

  it("a finished flow goes to where the person starts, by their work", async () => {
    profile = { role: "buyer", display_name: "Alex", onboarding_state: { buyer_flow_done_at: "2026-10-05T10:00:00Z" } };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "compliance" }, error: null };
    assert.equal((await load()).to, "/app/compliance");
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing" }, error: null };
    assert.equal((await load()).to, "/app");
  });

  it("a new buyer is on About you; with name and role it is Your company; with the company it is What you source", async () => {
    assert.equal((await load()).step, "about");
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing" }, error: null };
    assert.equal((await load()).step, "company");
    answers.settings_get = { data: { workspace: { company_name: "Example Apparel Ltd", company_type: "Retailer", employee_count: "51-200" } }, error: null };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing", company_country: "GB" }, error: null };
    assert.equal((await load()).step, "source");
  });

  it("answers that cannot be read are null, not an empty form to write over", async () => {
    answers.onboarding_get_buyer = { data: null, error: { message: "boom" } };
    const l = await load();
    assert.equal(l.kind, "ready");
    assert.equal(l.answers, null);
  });
});

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

describe("saveAbout", () => {
  const act = () => mod("app/(auth)/onboarding/actions.js").saveAbout as (p: unknown, f: FormData) => Promise<{ error?: string; field?: string }>;

  it("refuses a missing name or role under its field without touching the database", async () => {
    assert.deepEqual(await act()({}, form({ name: "", role: "sourcing" })), { error: "Enter your name.", field: "name" });
    assert.equal((await act()({}, form({ name: "Alex", role: "" }))).field, "role");
    assert.equal(calls.length, 0);
  });

  it("saves the name and the work, sends the terms version, and goes to Your company", async () => {
    assert.equal(await redirectOf(() => act()({}, form({ name: " Alex Morgan ", role: "compliance" }))), "/onboarding/company");
    assert.deepEqual(rpc("settings_update_profile"), { p_display_name: "Alex Morgan" });
    assert.deepEqual(rpc("onboarding_save_buyer"), { p_input: { job_role: "compliance", terms_version: TERMS_VERSION } });
  });

  it("a failed write says so and does not move on", async () => {
    answers.onboarding_save_buyer = { data: null, error: { message: "boom" } };
    const s = await act()({}, form({ name: "Alex", role: "sourcing" }));
    assert.match(s.error ?? "", /could not save/);
  });

  it("with no session it says so and writes nothing", async () => {
    user = null;
    assert.match((await act()({}, form({ name: "Alex", role: "sourcing" }))).error ?? "", /session ended/);
    assert.equal(calls.length, 0);
  });
});

describe("saveCompany", () => {
  const act = () => mod("app/(auth)/onboarding/actions.js").saveCompany as (p: unknown, f: FormData) => Promise<{ error?: string; field?: string }>;
  const ok = { company: " Example Apparel Ltd ", type: "retailer", country: "GB", people: "51-200" };

  it("saves the company to Settings and the country beside it, then goes to What you source", async () => {
    assert.equal(await redirectOf(() => act()({}, form(ok))), "/onboarding/source");
    assert.deepEqual(rpc("settings_update_workspace"), { p_input: { company_name: "Example Apparel Ltd", company_type: "retailer", employee_count: "51-200" } });
    assert.deepEqual(rpc("onboarding_save_buyer"), { p_input: { company_country: "GB" } });
  });

  it("refuses each missing answer under its own field", async () => {
    for (const [k, field] of [["company", "company"], ["type", "type"], ["country", "country"], ["people", "people"]] as const) {
      calls = [];
      const s = await act()({}, form({ ...ok, [k]: "" }));
      assert.equal(s.field, field);
      assert.equal(calls.length, 0);
    }
  });
});

describe("saveSource", () => {
  const act = () => mod("app/(auth)/onboarding/actions.js").saveSource as (p: unknown, f: FormData) => Promise<{ error?: string; field?: string }>;

  it("saves the answers, closes the flow, and opens the first results with the search they described", async () => {
    const to = await redirectOf(() => act()({}, form({ hs: ["6109", "6105", "6109"], cert: ["gots"], market: ["UK", "US"] })));
    assert.match(to ?? "", /^\/app\/discover\?/);
    const q = new URLSearchParams((to ?? "").split("?")[1]);
    assert.equal(q.get("hs"), "6109,6105");
    assert.equal(q.get("welcome"), "1");
    assert.deepEqual(rpc("onboarding_save_buyer"), { p_input: { sourcing_hs_headings: ["6109", "6105"], required_cert_kinds: ["gots"], sell_markets: ["UK", "US"] } });
    const done = rpc("profile_onboarding_set") as { p_key: string; p_value: string };
    assert.equal(done.p_key, "buyer_flow_done_at");
    assert.match(done.p_value, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("needs a product; a non-heading, an unknown certificate or an unknown market is refused with nothing written", async () => {
    assert.equal((await act()({}, form({ cert: ["gots"] }))).field, "hs");
    assert.equal((await act()({}, form({ hs: "6109", cert: "fsc" }))).field, "certs");
    assert.equal((await act()({}, form({ hs: "6109", market: "MARS" }))).field, "markets");
    assert.equal(calls.length, 0);
  });

  it("a failed save does not close the flow", async () => {
    answers.onboarding_save_buyer = { data: null, error: { message: "boom" } };
    assert.match((await act()({}, form({ hs: "6109" }))).error ?? "", /could not save/);
    assert.equal(calls.some((c) => c.fn === "profile_onboarding_set"), false);
  });

  it("a flow that cannot be marked done, by an error or a throw, still lands on the results: the answers are in", async () => {
    answers.profile_onboarding_set = { data: null, error: { message: "boom" } };
    assert.match((await redirectOf(() => act()({}, form({ hs: "6109" })))) ?? "", /^\/app\/discover/);
    answers.profile_onboarding_set = { data: null, error: null, throws: true } as never;
    assert.match((await redirectOf(() => act()({}, form({ hs: "6109" })))) ?? "", /^\/app\/discover/);
  });
});

// ---------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------

const step = async (s: string) => draw(await mod("app/(auth)/onboarding/[step]/page.js").default({ params: Promise.resolve({ step: s }) }));

describe("/onboarding", () => {
  it("sends a new buyer to About you, and one with everything answered to the last step to finish", async () => {
    assert.equal(await redirectOf(async () => mod("app/(auth)/onboarding/page.js").default()), "/onboarding/about");
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing", company_country: "GB", sourcing_hs_headings: ["6109"] }, error: null };
    answers.settings_get = { data: { workspace: { company_name: "Example Apparel Ltd", company_type: "retailer", employee_count: "51-200" } }, error: null };
    assert.equal(await redirectOf(async () => mod("app/(auth)/onboarding/page.js").default()), "/onboarding/source");
  });

  it("signed out it asks for sign-in and comes back", async () => {
    user = null;
    assert.equal(await redirectOf(async () => mod("app/(auth)/onboarding/page.js").default()), "/login?next=/onboarding");
  });
});

describe("About you", () => {
  it("is Paper's step: the step line, the name, the five works, Where you'll start", async () => {
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "compliance" }, error: null };
    const out = await step("about");
    assert.match(text(out), /Step 1 of 3/);
    assert.match(out, /<h1[^>]*>About you<\/h1>/);
    assert.ok(input(out, "name", "Alex Morgan"), "the saved name is filled in");
    for (const w of ["Sourcing", "Compliance", "Merchandising", "Founder or owner", "Other"]) assert.match(text(out), new RegExp(w));
    assert.ok(input(out, "role", "compliance").includes('checked=""'), "what they answered is kept");
    assert.ok(!input(out, "role", "sourcing").includes('checked=""'));
    assert.match(text(out), /Where you.ll start/);
    assert.match(text(out), /Compliance people start on Compliance\. Everyone else starts on Search\./);
    assert.match(text(out), /alex\.morgan@example\.com/);
    assert.match(out, /action="\/auth\/sign-out" method="post"/);
  });

  it("answers that could not be read are an error with a retry, never a blank form", async () => {
    answers.onboarding_get_buyer = { data: null, error: { message: "boom" } };
    const out = await step("about");
    assert.match(text(out), /couldn.t load your answers/);
    assert.match(out, /href="\/onboarding\/about"/);
    assert.doesNotMatch(out, /name="role"/);
  });

  it("an unknown step is a real 404", async () => {
    await assert.rejects(() => step("nope"), (e: { digest?: string }) => String(e.digest).startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || String(e.digest) === "NEXT_NOT_FOUND");
  });
});

describe("Your company", () => {
  it("carries Back, the saved company, and the panel that says where it is saved", async () => {
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing", company_country: "GB" }, error: null };
    answers.settings_get = { data: { workspace: { company_name: "Example Apparel Ltd", company_type: "retailer", employee_count: "51-200" } }, error: null };
    const out = await step("company");
    assert.match(text(out), /Step 2 of 3/);
    assert.match(out, /value="Example Apparel Ltd"/);
    assert.ok(input(out, "type", "retailer").includes('checked=""'));
    assert.match(text(out), /Saved to Settings . Company details/);
    assert.match(text(out), /Example Apparel Ltd/);
    assert.match(text(out), /United Kingdom/);
    assert.match(out, /href="\/onboarding\/about"/);
    assert.match(text(out), /This fills your Settings, so we won.t ask again\./);
  });
});

describe("What you source", () => {
  it("lists the chosen headings first, then the five biggest clothing ones, each with its supplier count", async () => {
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing", company_country: "GB", sourcing_hs_headings: ["6302"], required_cert_kinds: ["gots"], sell_markets: ["UK"] }, error: null };
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.settings_get = { data: { workspace: { company_name: "Example Apparel Ltd", company_type: "retailer", employee_count: "51-200" } }, error: null };
    const out = await step("source");
    assert.match(text(out), /Step 3 of 3/);
    const t = text(out);
    assert.ok(t.indexOf("Bed linen and table linen") < t.indexOf("Women's suits, dresses and skirts, knitted"), "a chosen heading is listed first");
    for (const w of ["T-shirts and vests", "Jumpers, sweatshirts and cardigans", "Men's shirts, knitted", "Men's suits and trousers, woven"]) assert.match(t, new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(t, /1,797 suppliers/);
    assert.match(out, /type="hidden" name="hs" value="6302"/);
    for (const c of ["GOTS", "OEKO-TEX", "WRAP", "SA8000"]) assert.match(t, new RegExp(c));
    assert.ok(input(out, "cert", "gots").includes('checked=""'));
    assert.ok(!input(out, "cert", "wrap").includes('checked=""'));
    assert.match(t, /We show suppliers whose certificate hasn.t expired\./);
    for (const m of ["UK", "EU", "US", "Canada"]) assert.match(t, new RegExp(m));
    assert.match(t, /Supplier counts from EPB export records/);
    assert.match(t, /Your search so far/);
  });

  it("a catalogue that could not be read is an error with a retry, and no form", async () => {
    answers.onboarding_get_buyer = { data: { ...BLANK, job_role: "sourcing", company_country: "GB" }, error: null };
    profile = { role: "buyer", display_name: "Alex Morgan", onboarding_state: {} };
    answers.settings_get = { data: { workspace: { company_name: "Example Apparel Ltd", company_type: "retailer", employee_count: "51-200" } }, error: null };
    answers.hs_catalogue = { data: null, error: { message: "boom" } };
    const out = await step("source");
    assert.match(text(out), /couldn.t load the products/);
    assert.doesNotMatch(out, /name="cert"/);
  });
});

describe("the panels", () => {
  const panels = () => mod("components/onboarding/steps.js") as typeof import("@/components/onboarding/steps");
  const withDraft = (initial: Record<string, unknown>, el: ReactElement) => // eslint-disable-next-line react/no-children-prop -- the provider's children are a required prop.
    draw(createElement(DraftProvider, { initial, children: el }));

  it("the company panel shows what is typed, and 'Not chosen yet' for what is not", async () => {
    const out = text(await withDraft({ company: "Northwind", type: "agent", country: "", people: "1000+" }, createElement(panels().CompanyPanel)));
    assert.match(out, /Northwind/);
    assert.match(out, /Sourcing agent/);
    assert.match(out, /1,000\+/);
    assert.match(out, /Country Not chosen yet/);
  });

  it("the source panel asks for a product first, and names the markets' own tools", async () => {
    const none = text(await withDraft({ hs: [], certs: [], markets: [] }, createElement(panels().SourcePanel)));
    assert.match(none, /Choose a product to see how many suppliers match\./);
    const uk = text(await withDraft({ hs: [], certs: [], markets: ["UK", "US"] }, createElement(panels().SourcePanel)));
    assert.match(uk, /Modern slavery statement draft . UK/);
    assert.match(uk, /UFLPA Entity List checks . US/);
  });

  it("the headings offered: the chosen first; a search matches words and code starts, biggest first, at most eight", () => {
    const all = CATALOGUE.map((r) => ({ hs: r.hs, label: r.heading, n: r.exporter_count }));
    const v = panels().visibleHeadings;
    assert.deepEqual(v(all, ["6302"], ["6109", "6105"], "").map((o) => o.hs), ["6302", "6109", "6105"]);
    assert.deepEqual(v(all, [], [], "shirts").map((o) => o.hs), ["6110", "6109", "6105", "6205"], "any word that contains it, the one with most exporters first");
    assert.deepEqual(v(all, [], [], "62").map((o) => o.hs), ["6203", "6205"], "a code prefix, the one with more exporters first");
    assert.deepEqual(v(all, ["6302"], [], "shirts").map((o) => o.hs), ["6110", "6109", "6105", "6205"], "a chosen heading that does not match is not listed under a search");
  });
});
