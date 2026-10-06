// The admin decision queues on the v4 kit (B10b): the overview, beta analytics, review queue,
// claims, certifications and sanctions pages drawn over a fake Supabase client installed before
// they load. What an admin needs: the heading and the figures, the rows and their one action, an
// unreadable read as an error and never an empty list, the filters sent to the same RPC as
// before ("Any" is no filter), and no old-kit class left in the files that were ported.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
let answers: Record<string, Rpc> = {};
let calls: { fn: string; args?: Record<string, unknown> }[] = [];
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return answers[fn] ?? { data: null, error: { message: `no function ${fn}` } };
    },
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the page modules load.
const load = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const page = async (p: string, props?: unknown) => draw(await load(`app/(app)/(old-shell)/admin/${p}`)(props));
const given = (a: Record<string, Rpc>) => {
  answers = a;
  calls = [];
};
const ok = (data: unknown): Rpc => ({ data, error: null });
const failed = (message: string): Rpc => ({ data: null, error: { message } });
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });

const SUP = { id: "s-1", slug: "tex-town", company_name: "TEX TOWN LTD.", name_display: null, entity_type: "factory", city: "Dhaka", district: "Dhaka", published: true, tier_coverage: 3 };
const DASH = {
  users: { total: 1204, by_role: { admin: 2, buyer: 900, supplier: 302 }, signups_7d: 41, signups_30d: 160 },
  suppliers: { total: 4645, published: 4100, claimed: 310, sanctioned: 3, by_entity_type: { factory: 4000, buying_house: 645 }, tier_coverage: { has_tier1: 10, has_tier2: 20, has_tier3: 30, tier13_ge_1: 4000, tier13_ge_2: 3000, tier13_ge_3: 2000 } },
  rfqs: { open: 12, accepted_30d: 4, closed_30d: 9 },
  messages: { threads: 77, messages_7d: 321 },
  saved_suppliers: { total: 555 },
  queues: { claims_pending: 5, sanctions_active: 2, verification_queue_total: 9, verification_queue_by_type: { cert_doc_review: 6, sanctions_hit: 3 } },
  data_moat: { source_records_by_source: [{ code: "bgmea", count: 3000 }], certifications_by_kind: [{ kind: "gots", count: 40 }], compliance_documents: { count: 12, total_bytes: 5_242_880 } },
  generated_at: "2026-10-05T10:00:00Z",
};
const QUEUE_ROW = { queue_id: "q-1", queue_type: "fuzzy_match_review", supplier_b_name: null, confidence: "0.93", source_data: { source: "bgmea", reason: "same address" }, admin_action: null, reviewed_at: null, reviewed_by: null, created_at: "2026-10-01T00:00:00Z", release_action: null, buyer_destination: "Tex Town Ltd. profile", supplier: SUP };
const CERT_ROW = { queue_id: "q-2", queue_created_at: "2026-10-02T00:00:00Z", reviewed_at: null, admin_action: null, cert: { id: "c-1", kind: "oeko_tex", certificate_no: "OT-77", issuer: "Hohenstein", issued_on: null, expires_on: "2027-01-01", scope: "Knit fabrics", document_url: "https://cdn.example.com/c.pdf", verified: false, rejected_at: null, rejected_reason: null }, supplier: { id: "s-1", slug: "tex-town", company_name: "TEX TOWN LTD.", entity_type: "factory" }, uploaded_by_email: "owner@textown.example" };
const SANC_ROW = { queue_id: "q-3", queue_created_at: "2026-10-03T00:00:00Z", reviewed_at: null, admin_action: null, supplier: { id: "s-1", slug: "tex-town", company_name: "TEX TOWN LTD.", entity_type: "factory", sanctioned_flag: false, sanctioned_reason: null, sanctions_cleared: false }, hit: { list: "uflpa", matched_name: "Tex Town Group", match_score: 0.91, entry_id: "e1", entity_name: null, source_url: "https://dhs.example/uflpa", listed_date: "2024-01-01" } };
const CLAIM_ROW = { id: "cl-1", status: "email_verified", method: "manual_review", proof_email: "me@textown.example", note: "Owner here", created_at: "2026-10-01T00:00:00Z", email_verified_at: "2026-10-02T00:00:00Z", decided_at: null, decision_note: null, claimant_email: "me@textown.example", supplier: { id: "s-1", slug: "tex-town", company_name: "TEX TOWN LTD.", entity_type: "factory", city: "Dhaka", district: null, website: null } };

const h1s = (out: string) => out.match(/<h1\b/g)?.length;

describe("/admin overview", () => {
  it("draws one heading, the four figures, the queues with links, and the documents", async () => {
    given({ admin_dashboard: ok(DASH) });
    const out = await page("page.js");
    const t = text(out);
    assert.match(out, /<h1[^>]*>Overview<\/h1>/);
    assert.equal(h1s(out), 1);
    for (const s of ["Users", "1,204", "+41 last 7 days", "Suppliers published", "4,100", "Open RFQs", "Message threads", "Sanctioned: 3", "Certification document review", "5.0 MB", "bgmea", "gots"]) assert.ok(t.includes(s), s);
    assert.match(out, /href="\/admin\/claims"/);
    assert.match(out, /href="\/admin\/queue\?type=cert_doc_review"/);
  });

  it("an unreadable read is an error with its cause, never empty figures", async () => {
    given({ admin_dashboard: failed("insufficient_privilege") });
    const out = await page("page.js");
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load admin dashboard: insufficient_privilege\./);
    assert.doesNotMatch(out, /Users by role/);
  });
});

describe("/admin/beta", () => {
  it("draws the funnel and the top saved suppliers, and says when nobody saved", async () => {
    given({ admin_beta_dashboard: ok({ funnel: { signups_total: 80, signups_7d: 9, signups_30d: 30, with_saved_supplier: 40, with_rfq: 8, signup_to_saved_pct: 50, signup_to_rfq_pct: 10 }, top_saved_suppliers: [{ supplier_id: "s-1", company_name: "TEX TOWN LTD.", slug: "tex-town", save_count: 7 }], generated_at: "2026-10-05T10:00:00Z" }) });
    const out = await page("beta/page.js");
    assert.match(out, /<h1[^>]*>Founder analytics<\/h1>/);
    assert.match(text(out), /50% of signups/);
    assert.match(out, /href="\/admin\/suppliers\/s-1"/);
    assert.match(text(out), /7 saves/);
    given({ admin_beta_dashboard: ok({ funnel: { signups_total: 0, signups_7d: 0, signups_30d: 0, with_saved_supplier: 0, with_rfq: 0, signup_to_saved_pct: 0, signup_to_rfq_pct: 0 }, top_saved_suppliers: [], generated_at: "2026-10-05T10:00:00Z" }) });
    assert.match(text(await page("beta/page.js")), /No saves yet\./);
  });

  it("an unreadable read is an error", async () => {
    given({ admin_beta_dashboard: failed("boom") });
    const out = await page("beta/page.js");
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load beta dashboard: boom\./);
  });
});

describe("/admin/queue", () => {
  it("lists the rows with the release button and sends the filters it was given", async () => {
    given({ admin_queue_list: ok({ total: 1, by_type: { fuzzy_match_review: 1 }, rows: [QUEUE_ROW] }) });
    const out = await page("queue/page.js", sp({ type: "fuzzy_match_review", status: "reviewed" }));
    assert.deepEqual(calls[0], { fn: "admin_queue_list", args: { p_type: "fuzzy_match_review", p_status: "reviewed", p_limit: 50, p_offset: 0 } });
    assert.match(out, /<h1[^>]*>Review queue<\/h1>/);
    assert.equal(h1s(out), 1);
    const t = text(out);
    for (const s of ["Fuzzy supplier matches", "TEX TOWN LTD.", "confidence 0.93", "Buyer destination: Tex Town Ltd. profile", "Visible to buyers", "3 evidence sources", "source: bgmea · reason: same address"]) assert.ok(t.includes(s), s);
    assert.match(out, /<button[^>]*>Review<\/button>/);
    assert.match(out, /aria-current="page"[^>]*>Fuzzy supplier matches/);
    assert.match(out, /name="status"/);
  });

  it("sends cert and sanctions rows to their own queues, and an empty filter says so", async () => {
    given({ admin_queue_list: ok({ total: 2, by_type: {}, rows: [{ ...QUEUE_ROW, queue_id: "a", queue_type: "cert_doc_review" }, { ...QUEUE_ROW, queue_id: "b", queue_type: "sanctions_hit" }] }) });
    const out = await page("queue/page.js", sp());
    assert.match(out, /href="\/admin\/certifications"/);
    assert.match(out, /href="\/admin\/sanctions"/);
    given({ admin_queue_list: ok({ total: 0, by_type: {}, rows: [] }) });
    assert.match(text(await page("queue/page.js", sp())), /No review items match this filter/);
  });

  it("an unreadable read is an error and not an empty queue", async () => {
    given({ admin_queue_list: failed("permission denied") });
    const out = await page("queue/page.js", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load review queue: permission denied\./);
    assert.doesNotMatch(text(out), /No review items match/);
  });

  it("pages carry the filter in the address", async () => {
    given({ admin_queue_list: ok({ total: 120, by_type: {}, rows: [QUEUE_ROW] }) });
    const out = await page("queue/page.js", sp({ type: "cert_doc_review", page: "2" }));
    assert.equal(calls[0]!.args!.p_offset, 50);
    assert.match(out, /href="\/admin\/queue\?type=cert_doc_review"[^>]*>[^<]*(<svg[^>]*>.*?<\/svg>)?Previous/);
    assert.match(out, /href="\/admin\/queue\?type=cert_doc_review&amp;page=3"|href="\/admin\/queue\?type=cert_doc_review&page=3"/);
  });
});

describe("/admin/claims", () => {
  it("lists the claims with Decide on the ones waiting, for the status in the address", async () => {
    given({ claim_admin_list: ok({ results: [CLAIM_ROW, { ...CLAIM_ROW, id: "cl-2", status: "approved" }] }) });
    const out = await page("claims/page.js", sp({ status: "email_verified" }));
    assert.deepEqual(calls[0], { fn: "claim_admin_list", args: { p_status: "email_verified" } });
    assert.match(out, /<h1[^>]*>Supplier claims<\/h1>/);
    assert.equal(out.match(/<button[^>]*>Decide<\/button>/g)?.length, 1, "only the waiting claim can be decided");
    assert.match(text(out), /me@textown\.example/);
    assert.match(out, /aria-current="page"[^>]*>Email Verified/);
  });

  it("opens on every open claim, links the claimant to their user file, and says what became of the email (0129)", async () => {
    given({
      claim_admin_list: ok({
        results: [
          { ...CLAIM_ROW, id: "cl-stuck", status: "pending_email", claimant_user_id: "u-1", token_expires_at: "2026-10-02T00:00:00Z", link_expired: true, email: { status: "failed", error: "no_api_key", sent_at: "2026-10-01T00:00:01Z", template: "claim_verify" } },
          { ...CLAIM_ROW, id: "cl-sent", status: "pending_email", claimant_user_id: "u-2", token_expires_at: "2026-10-09T00:00:00Z", link_expired: false, email: { status: "sent", error: null, sent_at: "2026-10-08T09:00:00Z", template: "claim_verify" } },
          { ...CLAIM_ROW, id: "cl-old", status: "pending_email", email: null },
        ],
      }),
    });
    const out = await page("claims/page.js", sp());
    assert.deepEqual(calls[0], { fn: "claim_admin_list", args: { p_status: "open" } });
    const t = text(out);
    assert.match(out, /href="\/admin\/users\/u-1"[^>]*>me@textown\.example</);
    assert.match(t, /Failed 2026-10-01 00:00:01: no_api_key/);
    assert.match(t, /Link expired 2026-10-02 00:00:00/);
    assert.match(t, /Sent 2026-10-08 09:00:00/);
    assert.match(t, /Link expires 2026-10-09 00:00:00/);
    assert.match(t, /No record of the email \(sent before the journal, or never sent\)/);
    assert.equal(out.match(/>Resend link</g)?.length, 3, "every claim waiting for its email can be resent");
    assert.equal(out.match(/<button[^>]*>Decide<\/button>/g)?.length, 3, "a decision is open at the email step too");
    assert.match(out, /aria-current="page"[^>]*>Open/);
    assert.match(out, /href="\/admin\/claims\?status=pending_email"/);
  });

  it("a failed read shows its message", async () => {
    given({ claim_admin_list: failed("nope") });
    const out = await page("claims/page.js", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Failed to load: nope/);
  });
});

describe("/admin/certifications", () => {
  it("lists the uploads with Review, and Any is no kind filter", async () => {
    given({ admin_cert_queue_list: ok({ total: 1, rows: [CERT_ROW] }) });
    const out = await page("certifications/page.js", sp({ kind: "__any" }));
    assert.deepEqual(calls[0], { fn: "admin_cert_queue_list", args: { p_status: "open", p_kind: null, p_limit: 50, p_offset: 0 } });
    assert.match(out, /<h1[^>]*>Certification queue<\/h1>/);
    const t = text(out);
    for (const s of ["OT-77", "issuer Hohenstein", "expires 2027-01-01", "Knit fabrics", "owner@textown.example"]) assert.ok(t.includes(s), s);
    assert.match(out, /href="https:\/\/cdn\.example\.com\/c\.pdf"/);
    assert.match(out, /<button[^>]*>Review<\/button>/);
    given({ admin_cert_queue_list: ok({ total: 1, rows: [CERT_ROW] }) });
    await page("certifications/page.js", sp({ kind: "gots", status: "all" }));
    assert.equal(calls[0]!.args!.p_kind, "gots");
    assert.equal(calls[0]!.args!.p_status, "all");
  });

  it("a reviewed upload has no button, and a failed read is an error", async () => {
    given({ admin_cert_queue_list: ok({ total: 1, rows: [{ ...CERT_ROW, reviewed_at: "2026-10-04T00:00:00Z", cert: { ...CERT_ROW.cert, verified: true } }] }) });
    const out = await page("certifications/page.js", sp({ status: "reviewed" }));
    assert.doesNotMatch(out, /<button[^>]*>Review<\/button>/);
    assert.match(text(out), /verified/);
    given({ admin_cert_queue_list: failed("denied") });
    const bad = await page("certifications/page.js", sp());
    assert.match(bad, /role="alert"/);
    assert.match(text(bad), /Could not load queue: denied\./);
  });
});

describe("/admin/sanctions", () => {
  it("lists the hits with Decide, and Any is no list filter", async () => {
    given({ admin_sanctions_queue_list: ok({ total: 1, rows: [SANC_ROW] }) });
    const out = await page("sanctions/page.js", sp({ list: "__any" }));
    assert.deepEqual(calls[0], { fn: "admin_sanctions_queue_list", args: { p_status: "open", p_list: null, p_limit: 50, p_offset: 0 } });
    assert.match(out, /<h1[^>]*>Sanctions queue<\/h1>/);
    const t = text(out);
    for (const s of ["UFLPA", "Tex Town Group", "score 0.910", "listed 2024-01-01"]) assert.ok(t.includes(s), s);
    assert.match(out, /href="https:\/\/dhs\.example\/uflpa"/);
    assert.match(out, /<button[^>]*>Decide<\/button>/);
    given({ admin_sanctions_queue_list: ok({ total: 1, rows: [SANC_ROW] }) });
    await page("sanctions/page.js", sp({ list: "ofac_sdn" }));
    assert.equal(calls[0]!.args!.p_list, "ofac_sdn");
  });

  it("a failed read is an error and not an empty queue", async () => {
    given({ admin_sanctions_queue_list: failed("denied") });
    const out = await page("sanctions/page.js", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load queue: denied\./);
    assert.doesNotMatch(text(out), /No sanctions hits/);
  });
});

describe("the ported files keep clear of the old kit", () => {
  const files = [
    "app/(app)/(old-shell)/admin/page.tsx",
    "app/(app)/(old-shell)/admin/loading.tsx",
    "app/(app)/(old-shell)/admin/beta/page.tsx",
    "app/(app)/(old-shell)/admin/queue/page.tsx",
    "app/(app)/(old-shell)/admin/claims/page.tsx",
    "app/(app)/(old-shell)/admin/certifications/page.tsx",
    "app/(app)/(old-shell)/admin/sanctions/page.tsx",
    "components/admin/queue-parts.tsx",
    "components/admin-queue-decide-button.tsx",
    "components/admin-cert-decide-button.tsx",
    "components/admin-sanctions-decide-button.tsx",
    "components/claim-admin-decide-button.tsx",
  ];
  it("imports nothing from components/ui, dashboard or shell, and types no old class", () => {
    for (const f of files) {
      const src = readFileSync(path.join(process.cwd(), f), "utf8");
      assert.doesNotMatch(src, /@\/components\/(ui|dashboard|shell)\//, f);
      assert.doesNotMatch(src, /@\/components\/admin\/admin-ui/, f);
      assert.doesNotMatch(src, /proto-card|text-ink-primary|text-ink-secondary|ink-tertiary|bg-bg-l|brand-forest|sem-(green|amber|red)|neutral-\d|font-display/, f);
    }
  });
});
