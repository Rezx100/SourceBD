// The buyer pages rebuilt in the enterprise pass (27 Sep 2026), at the ROUTE
// boundary: the HS headings page, Settings, and the old plan
// address. Component tests cannot see what a route passes its components —
// which record it reads, which Close it wires, which row it marks — so these
// import the route modules, run them over a fake Supabase client, and assert
// the HTML a browser receives (AGENTS 16; the pattern is record-routes.test.ts).
//
// What it does NOT cover: the real database. The client is a stub, so these
// say what the routes do with a given payload, not that the RPCs return one.

import assert from "node:assert/strict";
import { type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { after, describe, it } from "node:test";
import path from "node:path";

import { aboniInput } from "@/lib/dashboard/fixtures";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
const resolved = (mod: string) => require.resolve(path.join(OUT, mod));

type Rpc = { data: unknown; error: unknown };
type Answers = Partial<Record<string, Rpc>>;

/** One stub, installed once, reading a mutable `answers` (a route captures its client module on first require). */
let answers: Answers = {};
let rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];

const ABONI = aboniInput();
const RECORD: Answers = {
  buyer_supplier_profile: { data: ABONI.profile, error: null },
  supplier_epb_hscodes: { data: ABONI.hscodes.map((h) => ({ code: h.code, description: h.description, source_url: h.source_url })), error: null },
  supplier_contact_counts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null },
};

function fakeClient() {
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return answers[fn] ?? { data: fn === "production_workers_display_batch" ? [] : null, error: null };
    },
    auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } } }) },
    from() {
      const result = () => Promise.resolve({ data: [], error: null, count: 0 });
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        contains: () => chain,
        order: () => chain,
        limit: () => result(),
        maybeSingle: () => Promise.resolve({ data: null }),
        then: (res: (v: unknown) => unknown) => result().then(res),
      };
      return chain;
    },
  };
}

{
  // `next/navigation`'s client hooks need a mounted App Router; the server
  // halves (`notFound`, `redirect`) keep their real behaviour.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must exist before any route loads.
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = {
    id: navId,
    filename: navId,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      ...realNav,
      useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
      useSearchParams: () => new URLSearchParams(),
      usePathname: () => "/app",
      useParams: () => ({}),
    },
  } as unknown as NodeJS.Module;
  const client = fakeClient();
  const id = resolved("lib/supabase/server.js");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { createSupabaseServerClient: async () => client },
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
}

after(() => {
  delete require.cache[resolved("lib/supabase/server.js")];
});

function given(a: Answers): void {
  rpcCalls = [];
  answers = a;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(resolved(p));

/**
 * The page as a browser receives it once every streamed part has arrived.
 * The search and Saved stream the record into its pane (28 Sep 2026), and
 * `renderToStaticMarkup` stops at a `Suspense` boundary's fallback; React's
 * static prerender waits for the content. Its hydration comments are dropped
 * so the markup reads as `renderToStaticMarkup`'s did. A `notFound()` or
 * `redirect()` thrown inside a boundary is rethrown, as it would be at the top.
 */
async function renderStreamed(el: ReactElement): Promise<string> {
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(el, { onError: (err: unknown) => void errors.push(err) });
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  const thrown = errors.find((e) => typeof (e as { digest?: unknown })?.digest === "string") ?? errors[0];
  if (thrown) throw thrown;
  return out.replace(/<!--[\s\S]*?-->/g, "");
}

async function render(run: () => Promise<ReactElement>): Promise<string> {
  return renderStreamed(await run());
}

/** What a reader sees: the markup with its tags removed. */
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// ---------------------------------------------------------------------------

const SETTINGS = {
  email: "buyer@example.invalid",
  display_name: "Jane Buyer",
  avatar_url: null,
  role: "buyer",
  plan_tier: "starter",
  created_at: "2026-09-01T00:00:00Z",
  notifications: { digest: true, rfq_replies: true, saved_alerts: false },
};

describe("Settings — six pages under one navigation", () => {
  const NAV = ["Workspace", "Subscription", "Members", "Inquiry", "Profile", "Notifications"];
  const navOf = (out: string) => [...(out.match(/<nav aria-label="Settings"[\s\S]*?<\/nav>/)?.[0] ?? "").matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

  for (const [file, current] of [
    ["app/(app)/app/settings/page.js", "Workspace"],
    ["app/(app)/app/settings/workspace/page.js", "Workspace"],
    ["app/(app)/app/settings/subscription/page.js", "Subscription"],
    ["app/(app)/app/settings/members/page.js", "Members"],
    ["app/(app)/app/settings/inquiry/page.js", "Inquiry"],
    ["app/(app)/app/settings/profile/page.js", "Profile"],
    ["app/(app)/app/settings/notifications/page.js", "Notifications"],
  ] as const) {
    it(`${file.replace(/^app\/\(app\)|\/page\.js$/g, "")} draws the six items and marks ${current}`, async () => {
      given({ settings_get: { data: SETTINGS, error: null } });
      const out = await render(() => route(file).default());
      assert.deepEqual(navOf(out), NAV);
      assert.match(out, new RegExp(`aria-current="page"[^>]*>${current}<`));
      assert.equal(out.match(/aria-current="page"/g)?.length, 1);
      assert.match(text(out), /Free plan · public beta/, "the plan reads as the rail reads it");
      assert.doesNotMatch(out, /Starter plan/);
    });
  }

  it("Workspace reads the company info from settings_get().workspace", async () => {
    given({
      settings_get: {
        data: {
          ...SETTINGS,
          workspace: {
            company_name: "Northwind Apparel",
            company_type: "Retailer",
            business_description: "Knitwear for UK high streets",
            website: "https://northwind.example",
            customer_base: "UK retail",
            employee_count: "51-200",
            company_logo_url: null,
          },
        },
        error: null,
      },
    });
    const out = await render(() => route("app/(app)/app/settings/page.js").default());
    assert.match(out, /value="Northwind Apparel"/);
    assert.match(out, /value="https:\/\/northwind\.example"/);
    assert.match(out, /value="UK retail"/);
    assert.match(out, />Knitwear for UK high streets<\/textarea>/);
    assert.match(out, /<option value="Retailer" selected="">Retailer<\/option>/);
    assert.match(out, /<option value="51-200" selected="">51-200<\/option>/);
    for (const t of ["Brand", "Retailer", "Importer", "Agent", "Other"]) assert.match(out, new RegExp(`<option value="${t}"`));
    for (const b of ["1-10", "11-50", "51-200", "201-1000", "1000\\+"]) assert.match(out, new RegExp(`<option value="${b}"`));
  });

  it("Workspace draws the form, empty, when the reply has no workspace yet; a failed read draws no form", async () => {
    given({ settings_get: { data: SETTINGS, error: null } });
    const empty = await render(() => route("app/(app)/app/settings/page.js").default());
    assert.match(empty, /<form[^>]*aria-label="Company info"/);
    assert.match(empty, /Save company info/);
    assert.doesNotMatch(empty, /role="alert"/);
    given({ settings_get: { data: null, error: { message: "boom" } } });
    const failed = await render(() => route("app/(app)/app/settings/page.js").default());
    assert.match(failed, /Could not load your company info/);
    assert.doesNotMatch(failed, /<form[^>]*aria-label="Company info"/);
  });

  it("Subscription sells no contact reveal, and says why Manage plan is off in words, not a tooltip", async () => {
    given({ settings_get: { data: SETTINGS, error: null } });
    const out = await render(() => route("app/(app)/app/settings/subscription/page.js").default());
    assert.doesNotMatch(out, /[Cc]ontact reveal|reveal/);
    assert.match(out, /disabled=""[^>]*>Manage plan<|<button[^>]*disabled=""[^>]*aria-describedby="manage-plan-note"/);
    assert.match(out, /id="manage-plan-note">Opens once billing is set up</);
    assert.doesNotMatch(out, /title="Available once billing/);
    assert.match(text(out), /Your plan Free Current public beta/);
    assert.match(text(out), /Other plans/);
    assert.match(text(out), /Growth/);
  });

  it("Members lists the signed-in buyer as the owner and offers no invite form", async () => {
    given({ settings_get: { data: SETTINGS, error: null } });
    const out = await render(() => route("app/(app)/app/settings/members/page.js").default());
    assert.match(text(out), /Jane Buyer buyer@example\.invalid Owner/);
    assert.match(out, /Team seats/);
    assert.match(out, /Enterprise plan/);
    assert.match(out, /href="mailto:support@sourcebd\.net/);
    assert.doesNotMatch(out, /type="email"|[Ii]nvite/);
  });

  it("Inquiry shows the composer's own defaults until the buyer saves questions, then theirs", async () => {
    // Required here, not imported at the top: the composer's module graph loads
    // `next/navigation`, and a module that captured it before the stub above
    // was installed would keep the real hooks.
    const { DEFAULT_QUESTIONS } = route("components/dashboard/rfq-composer.js") as { DEFAULT_QUESTIONS: readonly string[] };
    given({ settings_get: { data: SETTINGS, error: null } });
    const defaults = await render(() => route("app/(app)/app/settings/inquiry/page.js").default());
    for (const q of DEFAULT_QUESTIONS) assert.ok(defaults.includes(`value="${q}"`), `default question missing: ${q}`);
    assert.match(defaults, /Dear \{\{supplier\}\}/);
    for (const v of ["{{supplier}}", "{{product}}", "{{user}}", "{{company}}", "{{website}}"]) assert.ok(defaults.includes(v), v);
    given({ settings_get: { data: { ...SETTINGS, inquiry: { questions: ["Lead time for 5,000 pcs?"], email_template: "Hello {{supplier}}" } }, error: null } });
    const own = await render(() => route("app/(app)/app/settings/inquiry/page.js").default());
    assert.match(own, /value="Lead time for 5,000 pcs\?"/);
    assert.ok(!own.includes(`value="${DEFAULT_QUESTIONS[0]}"`));
    assert.match(own, />Hello \{\{supplier\}\}<\/textarea>/);
  });

  it("the old plan address answers a real 308 to Subscription", async () => {
    const res = route("app/(app)/app/settings/plan/route.js").GET() as Response;
    assert.equal(res.status, 308);
    assert.match(res.headers.get("location") ?? "", /\/app\/settings\/subscription$/);
  });
});

// ---------------------------------------------------------------------------

describe("/app/compliance — the certificate row a compliance link names", () => {
  it("the row the link names exists on the record", async () => {
    given({ ...RECORD });
    const out = await render(() =>
      route("app/(app)/app/suppliers/[slug]/page.js").default({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) }),
    );
    // On the Overview ("Needs a look" holds the expired and expiring ones the hub lists) and on the Certificates tab.
    assert.match(out, /<li [^>]*id="cert-wrap-7865"[^>]*class="[^"]*target:bg-brand-tint|<li id="cert-wrap-7865" class="[^"]*target:bg-brand-tint/);
  });
});
