// The supplier portal (B10d) on the v4 kit, drawn over a fake Supabase client: the dashboard, the
// company profile, RFQs received, the inbox and a thread, partners and documents. What a person
// needs is pinned: the headings and figures render, an unreadable read is an error panel and not an
// empty list, a page that is not the caller's stays a 404 (or a redirect), and the server-side
// filters (`claimed_by`) are still on the reads. No old-kit class is left in the files ported.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { TERMS_VERSION } from "@/lib/onboarding";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

type Reply = { data?: unknown; error?: { message: string } | null };
type Filter = { table: string; op: string; args: unknown[] };
let tables: Record<string, Reply> = {};
let rpcs: Record<string, Reply> = {};
let filters: Filter[] = [];
let user: { id: string } | null = { id: "u-supplier" };

{
  const chain = (table: string): unknown => {
    const q: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "order"]) {
      q[op] = (...args: unknown[]) => {
        filters.push({ table, op, args });
        return q;
      };
    }
    q.then = (res: (v: Reply) => unknown) => res(tables[table] ?? { data: [], error: null });
    // `.maybeSingle()` answers the first row of the table's reply, or null (the profile's terms read).
    q.maybeSingle = async () => {
      const reply = tables[table];
      const rows = Array.isArray(reply?.data) ? (reply.data as unknown[]) : [];
      return { data: rows[0] ?? null, error: reply?.error ?? null };
    };
    return q;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => chain(table),
    rpc: async (fn: string) => rpcs[fn] ?? { data: null, error: null },
  };
  const server = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[server] = { id: server, filename: server, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake above must be in place before the pages load.
const page = (p: string) => require(path.join(OUT, "app/(app)/(old-shell)/supplier", p)).default as (props?: unknown) => Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
async function draw(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return plain(out.replace(/<!--[\s\S]*?-->/g, ""));
}
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const render = async (p: string, props?: unknown) => draw(await page(p)(props));
const digestOf = async (p: string, props?: unknown) => {
  try {
    await page(p)(props);
  } catch (e) {
    return String((e as { digest?: string }).digest ?? e);
  }
  return null;
};

const UUID = "6b6b6b6b-0000-4000-8000-00000000f001";
const SUPPLIER = { id: "s-1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Gazipur", district: "Dhaka", supplier_attested_at: null };
const RFQ = {
  id: UUID, product_title: "Men's cotton trousers", product_description: "Twill, 260 gsm", quantity: 4500, quantity_unit: "pcs", target_unit_price: 3.2, currency: "USD",
  ship_to_country: "UK", ship_by: "2026-12-01T00:00:00Z", status: "open", accepted_quote_id: null, target_supplier_count: 1, quote_count: 0, viewer_role: "supplier",
  message: "Hello, please quote.", questions: ["Unit price FOB Chattogram"], created_at: "2026-09-10T10:00:00Z", updated_at: "2026-09-10T10:00:00Z",
  targets: [{ id: "s-1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Gazipur", district: null }], quotes: [], thread_id: UUID,
};
const THREAD = { id: UUID, buyer_id: "b-1", supplier_id: "s-1", supplier_slug: "aboni-knitwear", supplier_name: "Aboni Knitwear Ltd.", supplier_entity_type: "factory", buyer_email: "buyer@example.com", buyer_display_name: "Priya Shah", viewer_role: "supplier", rfq_id: null, subject: "Trousers", last_message_at: "2026-09-10T10:00:00Z", updated_at: "2026-09-10T10:00:00Z", created_at: "2026-09-10T10:00:00Z", message_count: 2 };

beforeEach(() => {
  tables = {};
  rpcs = {};
  filters = [];
  user = { id: "u-supplier" };
});

describe("/supplier (the dashboard)", () => {
  it("draws the heading, the claimed company with its edit link and the counts, and reads only this caller's companies", async () => {
    tables = { suppliers: { data: [SUPPLIER], error: null } };
    rpcs = {
      claim_list_mine: { data: { results: [{ id: "c-1", status: "pending_email", method: "domain_email", proof_email: "me@aboni.example", supplier: { company_name: "Rahim Textiles", city: null, district: null } }] }, error: null },
      rfq_list: { data: [{ id: "r-1", status: "open", viewer_role: "supplier" }, { id: "r-2", status: "open", viewer_role: "buyer" }], error: null },
      supplier_relationship_list: { data: [{ id: "x", status: "pending", viewer_role: "factory", initiated_side: "buying_house" }], error: null },
    };
    const out = await render("page.js");
    const t = text(out);
    assert.match(out, /<h1[^>]*>Portal<\/h1>/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    for (const s of ["Claimed companies", "1 owned", "Aboni Knitwear Ltd.", "Rahim Textiles", "Awaiting email", "1 total · 1 open", "1 open RFQ is awaiting your quote.", "0 accepted · 1 awaiting you", "1 partnership request is awaiting your decision."]) assert.ok(t.includes(s), s);
    assert.match(out, /href="\/supplier\/profile\/s-1"/);
    assert.ok(filters.some((f) => f.table === "suppliers" && f.op === "eq" && f.args[0] === "claimed_by" && f.args[1] === "u-supplier"), "the companies read is not scoped to the caller");
  });

  it("with nothing claimed it says so and offers the claim", async () => {
    const out = await render("page.js");
    assert.match(text(out), /You haven't claimed any companies yet\./);
    assert.match(out, /href="\/supplier\/claim"/);
    assert.match(text(out), /No claims awaiting verification or admin review\./);
  });

  it("asks a supplier who has not accepted the current terms to, names the old version when there was one, and leaves one who has alone (0134)", async () => {
    tables = { profiles: { data: [{ terms_version: null }], error: null } };
    let out = await render("page.js");
    assert.match(text(out), /Please accept the Terms of Service to use the supplier portal\./);
    assert.match(out, /href="\/legal\/terms"/);
    assert.match(out, /<button[^>]*>I accept the terms<\/button>/);
    tables = { profiles: { data: [{ terms_version: "2026-01-01" }], error: null } };
    out = await render("page.js");
    assert.match(text(out), /Our Terms of Service changed/);
    assert.match(text(out), /You accepted version 2026-01-01\./);
    tables = { profiles: { data: [{ terms_version: TERMS_VERSION }], error: null } };
    assert.doesNotMatch(text(await render("page.js")), /accept the terms/i);
    // A read that fails (0109 not applied) is unknown, and unknown is not a nag.
    tables = { profiles: { data: null, error: { message: "column terms_version does not exist" } } };
    assert.doesNotMatch(text(await render("page.js")), /accept the terms/i);
  });
});

describe("/supplier/profile and /supplier/profile/[id]", () => {
  it("lists the caller's companies with Edit profile", async () => {
    tables = { suppliers: { data: [SUPPLIER], error: null } };
    const out = await render("profile/page.js");
    assert.match(out, /<h1[^>]*>Company profile<\/h1>/);
    assert.match(text(out), /Aboni Knitwear Ltd\. Not yet edited/);
    assert.match(out, /href="\/supplier\/profile\/s-1"/);
    assert.ok(filters.some((f) => f.op === "eq" && f.args[0] === "claimed_by" && f.args[1] === "u-supplier"));
  });

  it("is a 404 when the company is not the caller's, and the editor otherwise", async () => {
    rpcs = { supplier_profile_get: { data: null, error: null } };
    assert.match((await digestOf("profile/[id]/page.js", { params: Promise.resolve({ id: "s-9" }) })) ?? "", /404|NOT_FOUND/);
    rpcs = { supplier_profile_get: { data: null, error: { message: "boom" } } };
    assert.match((await digestOf("profile/[id]/page.js", { params: Promise.resolve({ id: "s-9" }) })) ?? "", /404|NOT_FOUND/);

    rpcs = {
      supplier_profile_get: {
        data: {
          supplier: { id: "s-1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", country: "BD", city: "Gazipur", district: "Dhaka", address_raw: "Plot 4, Gazipur" },
          register: { email_primary: "info@aboni.example", phones: ["+880 1"], contact_name: null, contact_role: null, website: null },
          editable: { tagline: "Knitwear", about: null, moq: 500, lead_time_days: 60, capabilities: ["Knit"], contact_name: null, contact_role: null, contact_email: null, contact_phone: null },
          attested_at: null,
          attested_by: null,
        },
        error: null,
      },
    };
    const out = await render("profile/[id]/page.js", { params: Promise.resolve({ id: "s-1" }) });
    assert.match(out, /<h1[^>]*>Aboni Knitwear Ltd\.<\/h1>/);
    const t = text(out);
    for (const s of ["Register record (read-only)", "Plot 4, Gazipur", "info@aboni.example", "Supplier-attested details", "Last edited: never"]) assert.ok(t.includes(s), s);
    assert.match(out, /<label[^>]*>Tagline<\/label>/);
    assert.match(out, /value="Knitwear"/);
    assert.match(out, /aria-label="Remove Knit"/);
    assert.match(t, /Save profile/);
  });
});

describe("/supplier/rfqs", () => {
  it("lists only the RFQs addressed to the caller, with status, quantity and quotes", async () => {
    rpcs = { rfq_list: { data: [RFQ, { ...RFQ, id: "r-buyer", product_title: "Buyer's own RFQ", viewer_role: "buyer" }], error: null } };
    const out = await render("rfqs/page.js");
    const t = text(out);
    assert.match(out, /<h1[^>]*>RFQs received<\/h1>/);
    assert.ok(t.includes("Men's cotton trousers"));
    assert.ok(!t.includes("Buyer's own RFQ"), "a buyer's own RFQ is on the supplier's list");
    assert.match(t, /Open/);
    assert.match(t, /4,500 pcs/);
    assert.match(out, /href="\/supplier\/rfqs\/6b6b6b6b-0000-4000-8000-00000000f001"/);
  });

  it("an unreadable list is an error, not 'No RFQs yet'; an empty one says how RFQs arrive", async () => {
    rpcs = { rfq_list: { data: null, error: { message: "down" } } };
    let t = text(await render("rfqs/page.js"));
    assert.ok(t.includes("Could not load RFQs."));
    assert.ok(!t.includes("No RFQs yet."));
    rpcs = { rfq_list: { data: [], error: null } };
    t = text(await render("rfqs/page.js"));
    assert.ok(t.includes("No RFQs yet."));
    assert.match(t, /addresses an RFQ to one of your claimed companies/);
  });

  it("the detail is a 404 for an RFQ the caller cannot see, a redirect for a buyer, and shows the quote form while open", async () => {
    const props = { params: Promise.resolve({ id: UUID }) };
    rpcs = { rfq_get: { data: null, error: null } };
    assert.match((await digestOf("rfqs/[id]/page.js", props)) ?? "", /404|NOT_FOUND/);
    rpcs = { rfq_get: { data: { ...RFQ, viewer_role: "buyer" }, error: null } };
    assert.match((await digestOf("rfqs/[id]/page.js", props)) ?? "", /NEXT_REDIRECT.*\/app\/rfqs\//);

    rpcs = { rfq_get: { data: RFQ, error: null }, rfq_list: { data: [RFQ], error: null } };
    const out = await render("rfqs/[id]/page.js", props);
    const t = text(out);
    assert.match(out, /<h1[^>]*>Men's cotton trousers<\/h1>/);
    for (const s of ["Specification", "Buyer target price", "Message from the buyer", "Addressed to", "Your quote", "Not submitted", "Submit quote"]) assert.ok(t.includes(s), s);
    assert.match(out, /<li>Unit price FOB Chattogram<\/li>/);
  });

  it("a closed RFQ locks the quote the supplier sent", async () => {
    const quote = { id: "q-1", supplier_id: "s-1", supplier_slug: "aboni-knitwear", supplier_name: "Aboni", supplier_entity_type: "factory", unit_price: 2.85, currency: "USD", lead_time_days: 45, moq: 500, valid_until: null, notes: null, status: "submitted", created_at: "2026-09-11T10:00:00Z", updated_at: "2026-09-11T10:00:00Z" };
    rpcs = { rfq_get: { data: { ...RFQ, status: "closed", quotes: [quote] }, error: null }, rfq_list: { data: [], error: null } };
    const t = text(await render("rfqs/[id]/page.js", { params: Promise.resolve({ id: UUID }) }));
    assert.match(t, /2\.85 USD \/ pcs/);
    assert.match(t, /RFQ is no longer open; your submitted quote is locked\./);
    assert.ok(!t.includes("Submit quote") && !t.includes("Update quote"));
  });
});

describe("/supplier/messages", () => {
  it("lists the buyer threads only, by the buyer's name", async () => {
    rpcs = { thread_list: { data: [THREAD, { ...THREAD, id: "t-2", viewer_role: "buyer", buyer_display_name: "Not shown" }], error: null } };
    const out = await render("messages/page.js");
    const t = text(out);
    assert.match(out, /<h1[^>]*>Messages<\/h1>/);
    assert.ok(t.includes("Priya Shah") && t.includes("Trousers") && t.includes("2 messages"));
    assert.ok(!t.includes("Not shown"));
  });

  it("an unreadable inbox is an error; an empty one is the empty state", async () => {
    rpcs = { thread_list: { data: null, error: { message: "down" } } };
    let t = text(await render("messages/page.js"));
    assert.ok(t.includes("Could not load your inbox.") && !t.includes("No buyer inquiries yet."));
    rpcs = { thread_list: { data: [], error: null } };
    t = text(await render("messages/page.js"));
    assert.ok(t.includes("No buyer inquiries yet."));
  });

  it("a thread: a 404 for a bad id, a thread that is not the supplier's, or a non-participant; else the conversation and the composer", async () => {
    const props = (id: string) => ({ params: Promise.resolve({ thread: id }) });
    assert.match((await digestOf("messages/[thread]/page.js", props("nope"))) ?? "", /404|NOT_FOUND/);

    rpcs = { thread_list: { data: [{ ...THREAD, viewer_role: "buyer" }], error: null }, thread_messages: { data: [], error: null } };
    assert.match((await digestOf("messages/[thread]/page.js", props(UUID))) ?? "", /404|NOT_FOUND/);

    rpcs = { thread_list: { data: [THREAD], error: null }, thread_messages: { data: null, error: { message: "not a participant" } } };
    assert.match((await digestOf("messages/[thread]/page.js", props(UUID))) ?? "", /404|NOT_FOUND/);

    rpcs = {
      thread_list: { data: [THREAD], error: null },
      thread_messages: {
        data: [
          { id: "m-1", thread_id: UUID, sender_id: "b-1", created_at: "2026-09-10T10:00:00Z", body: "Can you do 4,500 pieces?", is_self: false },
          { id: "m-2", thread_id: UUID, sender_id: "u-supplier", created_at: "2026-09-10T10:05:00Z", body: "Yes, in 60 days.", is_self: true },
        ],
        error: null,
      },
    };
    const out = await render("messages/[thread]/page.js", props(UUID));
    const t = text(out);
    assert.match(out, /<h1[^>]*>Priya Shah<\/h1>/);
    assert.ok(t.includes("Can you do 4,500 pieces?") && t.includes("Yes, in 60 days."));
    assert.match(t, /Buyer · 10:00/);
    assert.match(t, /You · 10:05/);
    assert.match(out, /<textarea[^>]*id="thread-composer"/);
    assert.match(t, /Send/);
  });
});

describe("/supplier/partners and /supplier/documents", () => {
  const rel = (over: Record<string, unknown>) => ({
    id: "rel-1", status: "pending", viewer_role: "factory", initiated_side: "buying_house", initiated_by_me: false, can_decide: true, can_revoke: false, note: "Let us work together", decided_at: null,
    created_at: "2026-09-10T10:00:00Z", updated_at: "2026-09-10T10:00:00Z",
    buying_house: { id: "bh", slug: "global-sourcing", company_name: "Global Sourcing Ltd.", city: null, district: null },
    factory: { id: "s-1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", city: null, district: null },
    ...over,
  });

  it("groups the relationships, with Accept and Reject on an incoming request, for a caller who owns a factory", async () => {
    tables = { suppliers: { data: [{ id: "s-1", slug: "aboni-knitwear", company_name: "Aboni Knitwear Ltd.", entity_type: "factory" }], error: null } };
    rpcs = { supplier_relationship_list: { data: [rel({}), rel({ id: "rel-2", status: "accepted", can_decide: false, can_revoke: true })], error: null } };
    const out = await render("partners/page.js");
    const t = text(out);
    assert.match(out, /<h1[^>]*>Partners<\/h1>/);
    for (const s of ["Request a partnership", "Incoming requests", "1 awaiting your decision", "Active partnerships", "1 accepted", "Global Sourcing Ltd.", "Let us work together", "Accept", "Reject", "Revoke", "No outgoing requests."]) assert.ok(t.includes(s), s);
    assert.ok(filters.some((f) => f.op === "eq" && f.args[0] === "claimed_by" && f.args[1] === "u-supplier"));
  });

  it("a caller with no buying house or factory is told to claim one", async () => {
    const out = await render("partners/page.js");
    assert.match(text(out), /Claim a buying house or factory to manage partnerships\./);
    assert.match(out, /href="\/supplier\/claim"/);
  });

  it("documents is a static page with one heading and a way to the review team", async () => {
    const out = await render("documents/page.js");
    assert.match(out, /<h1[^>]*>Documents<\/h1>/);
    assert.match(text(out), /You haven't uploaded any document yet\./);
    assert.match(out, /href="\/supplier\/messages"/);
  });
});

describe("the ported files carry no old-kit class or import", () => {
  const files = [
    "app/(app)/(old-shell)/supplier/page.tsx",
    "app/(app)/(old-shell)/supplier/loading.tsx",
    "app/(app)/(old-shell)/supplier/profile/page.tsx",
    "app/(app)/(old-shell)/supplier/profile/[id]/page.tsx",
    "app/(app)/(old-shell)/supplier/profile/[id]/loading.tsx",
    "app/(app)/(old-shell)/supplier/rfqs/page.tsx",
    "app/(app)/(old-shell)/supplier/rfqs/[id]/page.tsx",
    "app/(app)/(old-shell)/supplier/rfqs/[id]/loading.tsx",
    "app/(app)/(old-shell)/supplier/messages/page.tsx",
    "app/(app)/(old-shell)/supplier/messages/[thread]/page.tsx",
    "app/(app)/(old-shell)/supplier/messages/[thread]/loading.tsx",
    "app/(app)/(old-shell)/supplier/messages/[thread]/thread-realtime.tsx",
    "app/(app)/(old-shell)/supplier/partners/page.tsx",
    "app/(app)/(old-shell)/supplier/documents/page.tsx",
    "components/supplier-profile-form.tsx",
    "components/supplier-quote-form.tsx",
    "components/supplier-partner-actions.tsx",
    "components/supplier-partner-request-form.tsx",
  ];
  const OLD = /proto-card|btn-proto|text-ink-(?:primary|secondary|tertiary)|bg-bg-l|brand-forest|sem-(?:green|amber|red)|neutral-\d|font-display|hairline|surface-l1|accent-indigo|rounded-(?:card|input|pill)|components\/ui\/|components\/dashboard\/|components\/shell\/|skeletons|#[0-9a-fA-F]{3,6}\b/;
  it("none of them does", () => {
    for (const f of files) {
      const src = readFileSync(path.join(process.cwd(), f), "utf8");
      const hit = OLD.exec(src);
      assert.equal(hit, null, `${f} still uses the old kit: ${hit?.[0]}`);
    }
  });
});
