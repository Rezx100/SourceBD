// The supplier claim track at the boundary: the landing (history, the form, an unreadable history), one
// claim's status page (each status, a claim that is not yours is a 404), and the page the email link opens
// (no token, a refusal, approved, waiting for a person). Drawn over a fake Supabase client and a fake
// `fetch`, both installed before the pages load.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

const SUPPLIER = { id: "s-1", slug: "square-apparels", company_name: "Square Apparels Ltd", entity_type: "factory", city: "Gazipur", district: "Dhaka" };
const claim = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  status: "pending_email",
  method: "domain_email",
  proof_email: "mona@square.example",
  created_at: "2026-10-01T10:00:00Z",
  email_verified_at: null,
  token_expires_at: "2026-10-02T10:00:00Z",
  decided_at: null,
  decision_note: null,
  note: null,
  supplier: SUPPLIER,
  ...over,
});

type Rpc = { data: unknown; error: { message: string } | null };
let mine: Rpc = { data: { results: [claim()] }, error: null };
let supplierRow: Record<string, unknown> | null = null;
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    rpc: async () => mine,
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: supplierRow, error: null }) };
      return q;
    },
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
{
  const id = require.resolve("next/headers");
  require.cache[id] = { id, filename: id, loaded: true, exports: { headers: async () => new Headers({ host: "localhost:3000" }) }, children: [], paths: [] } as unknown as NodeJS.Module;
}

type Api = { status: number; json: unknown } | "down";
let api = { status: 200, json: { ok: true } } as Api;
let posted: { url: string; body: unknown }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  posted.push({ url, body: init?.body ? JSON.parse(init.body) : null });
  const a = api;
  if (a === "down") throw new Error("connect refused");
  return { ok: a.status < 400, status: a.status, json: async () => a.json };
}) as unknown as typeof fetch;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stubs must be installed before the page modules load.
const load = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const LANDING = "app/(app)/(old-shell)/supplier/claim/page.js";
const DETAIL = "app/(app)/(old-shell)/supplier/claim/[id]/page.js";
const VERIFY = "app/(app)/(old-shell)/supplier/claim/verify/page.js";
const landing = async (supplier?: string) => draw(await load(LANDING)({ searchParams: Promise.resolve(supplier ? { supplier } : {}) }));
const detail = async (id: string) => draw(await load(DETAIL)({ params: Promise.resolve({ id }) }));
const verify = async (token?: string) => draw(await load(VERIFY)({ searchParams: Promise.resolve(token ? { token } : {}) }));
const reset = () => {
  mine = { data: { results: [claim()] }, error: null };
  supplierRow = null;
  api = { status: 200, json: { ok: true } };
  posted = [];
};

describe("/supplier/claim", () => {
  it("draws one h1, the three steps, the form and the history with its status words", async () => {
    reset();
    mine = { data: { results: [claim(), claim({ id: "c-2", status: "email_verified", method: "manual_review" }), claim({ id: "c-3", status: "approved" }), claim({ id: "c-4", status: "rejected" })] }, error: null };
    const out = await landing();
    const t = text(out);
    assert.match(out, /<h1[^>]*>Claim your company<\/h1>/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /aria-current="step"/);
    for (const s of ["Find company", "Verify ownership", "Confirm", "Find your company", "Search company name", "Your claims", "4 total", "Square Apparels Ltd", "Gazipur, Dhaka", "mona@square.example", "Domain proof", "Manual review", "Pending email", "Awaiting admin", "Approved", "Rejected"]) assert.ok(t.includes(s), s);
    assert.match(out, /href="\/supplier\/claim\/c-2"/);
  });

  it("with no claims it says so, and with an unreadable history it is an error and not an empty list", async () => {
    reset();
    mine = { data: { results: [] }, error: null };
    let out = await landing();
    assert.match(text(out), /No claim requests yet\./);
    assert.doesNotMatch(out, /role="alert"/);
    mine = { data: null, error: { message: "boom" } };
    out = await landing();
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load your claims/);
    assert.doesNotMatch(text(out), /No claim requests yet|0 total/);
  });

  it("a company named in the address that is open to claim is selected, one that is not is not", async () => {
    reset();
    supplierRow = { ...SUPPLIER, is_published: true, is_sanctioned: false, claimed_by: null };
    let out = await landing("square-apparels");
    assert.match(text(out), /Square Apparels Ltd Selected/);
    assert.match(text(out), /Proof email \(must be at your company\)/);
    assert.match(text(out), /Send verification email/);
    supplierRow = { ...SUPPLIER, is_published: true, is_sanctioned: true, claimed_by: null };
    out = await landing("square-apparels");
    assert.doesNotMatch(text(out), /Send verification email/);
    supplierRow = { ...SUPPLIER, is_published: true, is_sanctioned: false, claimed_by: "u-2" };
    out = await landing("square-apparels");
    assert.doesNotMatch(text(out), /Send verification email/);
  });
});

describe("/supplier/claim/[id]", () => {
  it("draws the company, the proof email, when the link expires, and Cancel while it can be cancelled", async () => {
    reset();
    const out = await detail("c-1");
    const t = text(out);
    assert.match(out, /<h1[^>]*>Square Apparels Ltd<\/h1>/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    for (const s of ["Awaiting email verification", "Proof email", "mona@square.example", "Initiated", "Link expires", "Links expire after 24 hours", "Cancel claim", "All claims"]) assert.ok(t.includes(s), s);
    assert.match(out, /aria-current="step"/);
  });

  it("an approved claim says it is yours and cannot be cancelled; a rejected one shows the note", async () => {
    reset();
    mine = { data: { results: [claim({ status: "approved", decided_at: "2026-10-02T09:00:00Z", email_verified_at: "2026-10-01T11:00:00Z" })] }, error: null };
    let t = text(await detail("c-1"));
    assert.match(t, /You now own this profile/);
    assert.match(t, /Decided/);
    assert.doesNotMatch(t, /Cancel claim/);
    mine = { data: { results: [claim({ status: "rejected", decision_note: "Domain does not match." })] }, error: null };
    t = text(await detail("c-1"));
    assert.match(t, /Domain does not match\./);
    assert.doesNotMatch(t, /Cancel claim/);
  });

  it("a claim that is not in your list is a 404, as before", async () => {
    reset();
    await assert.rejects(detail("c-someone-else"), (e: unknown) => {
      const d = e as { digest?: string; message?: string };
      return /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/.test(`${d.digest ?? ""}${d.message ?? ""}`);
    });
  });
});

describe("/supplier/claim/verify", () => {
  it("no token is the malformed-link panel", async () => {
    reset();
    const out = await verify();
    assert.match(out, /<h1[^>]*>Missing token<\/h1>/);
    assert.match(text(out), /The verification link is malformed/);
    assert.match(out, /role="alert"/);
    assert.match(out, /href="\/supplier\/claim"/);
    assert.equal(posted.length, 0, "nothing is sent without a token");
  });

  it("posts the token once, and says approved when the domain matched", async () => {
    reset();
    api = { status: 200, json: { ok: true, claim_id: "c-1", outcome: "approved" } };
    const out = await verify("tok-1");
    assert.deepEqual(posted.map((p) => [p.url, p.body]), [["http://localhost:3000/api/v1/claims", { action: "verify", token: "tok-1" }]]);
    assert.match(out, /<h1[^>]*>Email verified<\/h1>/);
    assert.match(text(out), /Claim approved/);
    assert.match(text(out), /You now own this profile\./);
    assert.match(out, /href="\/supplier\/claim\/c-1"[^>]*>View claim</);
  });

  it("says a person will review it when the domain did not match", async () => {
    reset();
    api = { status: 200, json: { ok: true, claim_id: "c-1", outcome: "pending_admin" } };
    const t = text(await verify("tok-1"));
    assert.match(t, /Awaiting admin review/);
    assert.match(t, /An admin will review your request/);
  });

  it("a refusal and an unreachable route are panels with the reason", async () => {
    reset();
    api = { status: 400, json: { ok: false, detail: "This link has expired." } };
    let out = await verify("tok-1");
    assert.match(out, /<h1[^>]*>Verification failed<\/h1>/);
    assert.match(text(out), /This link has expired\./);
    api = "down";
    out = await verify("tok-1");
    assert.match(out, /<h1[^>]*>Could not verify<\/h1>/);
    assert.match(text(out), /connect refused/);
  });
});

describe("the ported files carry no old kit", () => {
  const ROOT = process.cwd();
  const FILES = [
    "app/(app)/(old-shell)/supplier/claim/page.tsx",
    "app/(app)/(old-shell)/supplier/claim/[id]/page.tsx",
    "app/(app)/(old-shell)/supplier/claim/[id]/loading.tsx",
    "app/(app)/(old-shell)/supplier/claim/verify/page.tsx",
    "components/claim-search-form.tsx",
    "components/claim-cancel-button.tsx",
    "components/claim/parts.tsx",
  ];
  it("no old class, token or import is left", () => {
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      assert.doesNotMatch(src, /proto-card|text-ink-primary|ink-tertiary|ink-secondary|bg-bg-l|brand-forest|sem-(green|amber|red)|neutral-\d|font-display|btn-proto|hairline|surface-l1|@\/components\/ui\/|@\/components\/dashboard\/|@\/components\/shell\/|skeletons/, f);
    }
  });
});
