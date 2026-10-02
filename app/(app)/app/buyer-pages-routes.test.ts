// The buyer pages rebuilt in the enterprise pass (27 Sep 2026), at the ROUTE
// boundary: Messages with the record beside the conversation, Saved with the
// record beside the list, the HS headings page, Settings, and the old plan
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

const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const THREADS: Rpc = {
  data: [
    {
      id: THREAD_ID,
      supplier_id: ABONI.profile.supplier.id,
      supplier_slug: "aboni-knitwear",
      supplier_name: "Aboni Knitwear Limited",
      supplier_entity_type: "factory",
      rfq_id: "22222222-2222-4222-8222-222222222222",
      subject: "Knitted polo shirts",
      last_message_at: "2026-09-13T08:00:00Z",
      created_at: "2026-09-12T10:00:00Z",
      message_count: 2,
    },
  ],
  error: null,
};
const MESSAGES: Rpc = {
  data: [
    { id: "m1", thread_id: THREAD_ID, sender_id: "s", created_at: "2026-09-12T14:30:00Z", body: "Our price is 3.20 USD FOB.", is_self: false },
    { id: "m2", thread_id: THREAD_ID, sender_id: "b", created_at: "2026-09-13T08:00:00Z", body: "Thank you, sending samples.", is_self: true },
  ],
  error: null,
};

describe("/app/messages/[thread] — the conversation, and the record beside it", () => {
  const Thread = () => route("app/(app)/app/messages/[thread]/page.js").default;

  it("with no ?record= the conversation stands beside the thread list and no record is read", async () => {
    given({ thread_list: THREADS, thread_messages: MESSAGES, ...RECORD });
    const out = await render(() => Thread()({ params: Promise.resolve({ thread: THREAD_ID }), searchParams: Promise.resolve({}) }));
    assert.match(out, /Our price is 3\.20 USD FOB\./);
    assert.doesNotMatch(out, /data-record-pane/);
    assert.ok(!rpcCalls.some((c) => c.fn === "buyer_supplier_profile"), "a record was read with nothing open");
    assert.match(out, /<nav aria-label="Conversations" class="[^"]*hidden lg:block/);
  });

  it("?record= opens the record in the pane beside the conversation; the list steps aside; Close returns to the thread", async () => {
    given({ thread_list: THREADS, thread_messages: MESSAGES, ...RECORD });
    const out = await render(() =>
      Thread()({ params: Promise.resolve({ thread: THREAD_ID }), searchParams: Promise.resolve({ record: "aboni-knitwear" }) }),
    );
    assert.match(out, /data-record-pane=""[^>]*aria-label="Supplier record"|aria-label="Supplier record"[^>]*data-record-pane/);
    assert.match(out, /Aboni Knitwear Ltd/, "the record's name");
    assert.match(out, /Our price is 3\.20 USD FOB\./, "the conversation is still on the page");
    assert.ok(out.indexOf("Our price is") < out.indexOf("data-record-pane"), "the record sits after (to the right of) the conversation");
    const nav = out.match(/<nav aria-label="Conversations" class="([^"]*)"/)?.[1] ?? "";
    assert.ok(nav.split(" ").includes("hidden") && !nav.includes("lg:block"), `the thread list still shows: ${nav}`);
    assert.match(out, /aria-label="Close" href="\/app\/messages\/11111111-1111-4111-8111-111111111111"|href="\/app\/messages\/11111111-1111-4111-8111-111111111111"[^>]*aria-label="Close"/);
    assert.equal(rpcCalls.find((c) => c.fn === "buyer_supplier_profile")?.args?.p_slug, "aboni-knitwear");
    for (const key of ["email_primary", "contact_name", "contact_role"]) assert.ok(!out.includes(key), `${key} reached the HTML`);
  });

  it("a record that cannot be found says so in the pane, beside a conversation that still works", async () => {
    given({ thread_list: THREADS, thread_messages: MESSAGES });
    const out = await render(() =>
      Thread()({ params: Promise.resolve({ thread: THREAD_ID }), searchParams: Promise.resolve({ record: "no-such-company" }) }),
    );
    assert.match(out, /No record for that link/);
    assert.match(out, /Thank you, sending samples\./);
  });

  it("the conversation shows a separator per day and each message's sent time", async () => {
    given({ thread_list: THREADS, thread_messages: MESSAGES });
    const out = await render(() => Thread()({ params: Promise.resolve({ thread: THREAD_ID }), searchParams: Promise.resolve({}) }));
    assert.deepEqual([...out.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]), ["12 Sep 2026", "13 Sep 2026"]);
    assert.match(out, />12 Sep 2026, 14:30</);
  });
});

// ---------------------------------------------------------------------------

const SAVED_ROW = {
  id: ABONI.profile.supplier.id,
  slug: "aboni-knitwear",
  company_name: "ABONI KNITWEAR LTD.",
  entity_type: "factory",
  city: "Dhaka",
  district: "Dhaka",
  source_tags: ["BGMEA"],
  t13_source_count: 1,
  completeness_pct: 50,
  employees_total: 3166,
  established_date: null,
  principal_products: [],
  factory_types: [],
  rsc_progress_pct: null,
  parent_group_name: null,
  saved_at: "2026-09-20T10:00:00Z",
  total_count: 1,
};

describe("/app/saved?open= — the record beside the saved list", () => {
  const Saved = () => route("app/(app)/app/saved/page.js").default;

  it("with nothing open the list stands alone and no row is marked", async () => {
    given({ buyer_saved_list: { data: [SAVED_ROW], error: null }, ...RECORD });
    const out = await render(() => Saved()({ searchParams: Promise.resolve({}) }));
    assert.doesNotMatch(out, /data-record-pane/);
    assert.doesNotMatch(out, /aria-current="true"/);
    assert.match(out, /href="\/app\/saved\?open=aboni-knitwear"/, "the name opens the record beside the list");
    assert.doesNotMatch(out, />Open</, "the pointer button is gone");
  });

  it("?open= draws the record in the pane, marks its row, and Close keeps the sort", async () => {
    given({ buyer_saved_list: { data: [SAVED_ROW], error: null }, ...RECORD });
    const out = await render(() => Saved()({ searchParams: Promise.resolve({ open: "aboni-knitwear", sort: "name" }) }));
    assert.match(out, /data-record-pane/);
    const row = out.match(/<tr class="([^"]*)"><th scope="row"/)?.[1] ?? "";
    assert.match(row, /bg-accent-tint/, `the open row is not marked: ${row}`);
    assert.match(out, /href="\/app\/saved\?sort=name&amp;open=aboni-knitwear"[^>]*aria-current="true"|aria-current="true"[^>]*href="\/app\/saved\?sort=name&amp;open=aboni-knitwear"/);
    assert.match(out, /aria-label="Close" href="\/app\/saved\?sort=name"|href="\/app\/saved\?sort=name"[^>]*aria-label="Close"/);
    assert.match(out, /class="[^"]*hidden lg:flex[^"]*"/, "below lg the list waits behind the record");
  });
});

// ---------------------------------------------------------------------------

describe("/app/headings — the HS catalogue at its new address", () => {
  const Headings = () => route("app/(app)/app/headings/page.js").default;

  it("never prints the code twice: a heading without a buyer label takes the catalogue's heading, else the code alone", async () => {
    given({
      hs_catalogue: {
        data: [
          { hs: "6109", heading: null, exporter_count: 1763 },
          { hs: "6302", heading: null, exporter_count: 54 },
          { hs: "9999", heading: null, exporter_count: 2 },
        ],
        error: null,
      },
    });
    const out = await render(() => Headings()({ searchParams: Promise.resolve({}) }));
    const seen = text(out);
    assert.match(out, /<h1[^>]*>HS headings<\/h1>/);
    assert.match(seen, /6109 T-shirts/);
    assert.match(seen, /6302 Bed linen, table linen, toilet linen and kitchen linen/);
    assert.doesNotMatch(seen, /HS 6302|HS 9999|9999 HS/);
    assert.match(out, /href="\/app\/discover\?hs=6302"/);
    assert.match(out, /placeholder="Search headings"/);
    assert.match(out, /action="\/app\/headings"/);
    assert.match(seen, /exporter counts leave out sanctioned suppliers/);
    assert.match(out, /role="region" aria-label="HS headings"/, "the kit table");
  });

  it("a failed read says so and draws no empty table", async () => {
    given({ hs_catalogue: { data: null, error: { message: "boom" } } });
    const out = await render(() => Headings()({ searchParams: Promise.resolve({}) }));
    assert.match(out, /Exporter counts could not be read/);
    assert.match(out, /role="alert"/);
    assert.doesNotMatch(out, /<table/);
  });
});

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

// 3 Oct 2026: `compliance_expiring_certs` reads `expires_on >= current_date`,
// so the day a saved supplier's certificate lapsed it left the hub built to
// warn about it. The hub now reads `compliance_expired_certs` (0108) beside it
// and draws what it returns first, in danger ink, linked to the row.
const LAPSED_ROW = {
  kind: "wrap",
  certificate_no: "7865",
  issuer: "WRAP",
  expires_on: "2026-09-29",
  document_url: "https://wrapcompliance.org/certified-facility/7865/",
  days_remaining: -4,
  supplier: { id: ABONI.profile.supplier.id, slug: "aboni-knitwear", company_name: "ABONI KNITWEAR LTD", entity_type: "factory", city: "Savar", district: "Dhaka" },
};
const NOTHING_UPCOMING: Rpc = { data: { window_days: 90, bucket_30: 0, bucket_60: 0, bucket_90: 0, total: 0, rows: [] }, error: null };
const HUB_REST: Answers = {
  compliance_uflpa_tracker: { data: { total: 1, hits: 0, flags: 0, clear: 1, rows: [] }, error: null },
  compliance_msa_inputs: { data: { total_saved: 1, total_published: 1, rsc_covered: 1, expiring_certs_90d: 0, sanctions_hits: 0 }, error: null },
};

describe("/app/compliance — a saved supplier's expired certificate stays on the hub", () => {
  const Hub = () => route("app/(app)/app/compliance/page.js").default;

  it("lists it first, with the date, the issuer and danger ink, linked to the certificate's row on the record", async () => {
    given({ compliance_expiring_certs: NOTHING_UPCOMING, compliance_expired_certs: { data: { total: 1, rows: [LAPSED_ROW] }, error: null }, ...HUB_REST });
    const out = await render(() => Hub()());
    assert.ok(rpcCalls.some((c) => c.fn === "compliance_expired_certs"), "the hub never read the expired list");
    assert.match(out, /aria-label="Certificates expired"/);
    assert.match(out, /title="ABONI KNITWEAR LTD"/, "the supplier is named");
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear#cert-wrap-7865"[^>]*>WRAP<\/a>/, "the certificate links to its row on the record");
    assert.match(text(out), /Issued by WRAP/);
    assert.match(out, /29 Sep 2026<\/span> <span class="[^"]*text-danger-ink[^"]*">4 days ago<\/span>/);
    assert.match(out, /text-danger-ink[^"]*">1<\/span><span[^>]*>expired<\/span>/, "the expired count leads the stats");
    assert.ok(
      out.indexOf("Certificates expired") < out.indexOf("No certificates on your saved suppliers expire in the next 90 days"),
      "the expired bucket comes before the next 90 days",
    );
    assert.doesNotMatch(out, /Expired certificates did not load/);
  });

  it("an unread expired list says so and claims no '0 expired'", async () => {
    given({ compliance_expiring_certs: NOTHING_UPCOMING, compliance_expired_certs: { data: null, error: { message: "function does not exist" } }, ...HUB_REST });
    const out = await render(() => Hub()());
    assert.match(out, /Expired certificates did not load/);
    assert.doesNotMatch(out, />expired<\/span>/);
    assert.match(out, /role="alert"/);
  });

  it("the full expiry page lists it under Expired, before the next 90 days", async () => {
    given({ compliance_expiring_certs: NOTHING_UPCOMING, compliance_expired_certs: { data: { total: 1, rows: [LAPSED_ROW] }, error: null } });
    const out = await render(() => route("app/(app)/app/compliance/expiry/page.js").default());
    assert.match(out, /<h2[^>]*>Expired<\/h2>/);
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear#cert-wrap-7865"/);
    assert.match(out, /7865/, "the number column");
    assert.ok(out.indexOf(">Expired</h2>") < out.indexOf("Nothing expires in the next 90 days"));
  });

  it("the row the link names exists on the record", async () => {
    given({ ...RECORD });
    const out = await render(() =>
      route("app/(app)/app/suppliers/[slug]/page.js").default({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) }),
    );
    assert.match(out, /<li id="cert-wrap-7865" class="[^"]*target:bg-accent-tint/);
  });
});
