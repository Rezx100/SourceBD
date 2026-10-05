// The admin data pages on the v4 kit (B10c): suppliers (list, record, bulk import), users (list, record),
// audit log (list, entry), sources, citation health and feedback. Each page is drawn over a fake Supabase
// client installed into the module cache before the pages load (the pattern in `components/team/team.test.ts`).
// What is checked is what an operator needs: the heading and the key figures, that an unreadable read is an
// error and not an empty list, that a missing record is a real 404, that the filters still post to the same
// address with the same field names, that the two actions with a confirmation keep it, and that no old-kit
// class is left in the files that were ported.

import assert from "node:assert/strict";
import fs from "node:fs";
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
    auth: { getUser: async () => ({ data: { user: { id: "u-admin" } } }) },
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return answers[fn] ?? { data: null, error: { message: `no answer for ${fn}` } };
    },
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
const ADMIN = "app/(app)/(old-shell)/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the page modules load.
const load = (p: string) => require(path.join(OUT, ADMIN, p, "page.js")).default as (props?: unknown) => Promise<ReactElement> | ReactElement;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });
const page = async (p: string, props?: unknown) => draw(await load(p)(props));
const reset = (a: Record<string, Rpc> = {}) => {
  answers = a;
  calls = [];
};
const notFound = async (p: string, props: unknown) => {
  try {
    await load(p)(props);
    return false;
  } catch (e) {
    return /NEXT_(HTTP_ERROR_FALLBACK;404|NOT_FOUND)/.test(String((e as { digest?: string }).digest ?? ""));
  }
};

const SUP = { id: "s-1", slug: "aboni-knitwear", company_name: "ABONI KNITWEAR LTD", name_display: "Aboni Knitwear Ltd.", entity_type: "factory", published: false, claimed_by: null, sanctioned_flag: false, city: "Gazipur", district: "Dhaka", tier_coverage: 2, sbi_total: 71, updated_at: "2026-10-01T10:00:00Z", has_pending_rescore: true };

describe("/admin/suppliers", () => {
  it("draws the list: one h1, the count, each column's figure, the filters posting to the same address", async () => {
    reset({ admin_supplier_list: { data: { total: 120, rows: [SUP, { ...SUP, id: "s-2", slug: "x", name_display: null, company_name: "X Ltd", published: true, sanctioned_flag: true, claimed_by: "u-9", has_pending_rescore: false, sbi_total: null }] }, error: null } });
    const out = await page("suppliers", sp({ published: "false", page: "2" }));
    const t = text(out);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /<h1[^>]*>Suppliers<\/h1>/);
    assert.match(t, /120 suppliers in scope/);
    assert.match(t, /Page 2 of 3 · 2 shown · 120 total/);
    assert.match(out, /<form[^>]*action="\/admin\/suppliers"/);
    assert.match(out, /<form[^>]*method="get"/);
    for (const name of ["q", "entity", "published", "claimed", "sanctioned", "tier_min"]) assert.match(out, new RegExp(`name="${name}"`), name);
    assert.match(out, /href="\/admin\/suppliers\/s-1"[^>]*>Aboni Knitwear Ltd\.</);
    assert.match(out, /href="\/admin\/suppliers\/s-2"[^>]*>X Ltd</, "no display name: the register name");
    assert.match(t, /Not visible/);
    assert.match(t, /Flagged/);
    assert.match(t, /Queued/);
    assert.match(t, /71/, "the internal score stays on this admin-only page");
    assert.match(out, /href="\/admin\/suppliers\?published=false"[^>]*>[^]*?Previous/, "Previous keeps the filter");
    assert.match(out, /href="\/admin\/suppliers\?published=false&page=3"/, "Next keeps the filter");
    assert.match(out, /Showing 51–52 of 120 suppliers/);
    assert.deepEqual(calls[0]!.args, { p_search: null, p_entity_type: null, p_published: false, p_claimed: null, p_sanctioned: null, p_tier_min: null, p_limit: 50, p_offset: 50 });
  });

  it("an unreadable list is an error, not an empty list", async () => {
    for (const bad of [{ data: null, error: { message: "permission denied" } }, { data: null, error: null }]) {
      reset({ admin_supplier_list: bad });
      const out = await page("suppliers", sp());
      assert.match(out, /role="alert"/);
      assert.match(text(out), /Could not load suppliers/);
      assert.doesNotMatch(out, /<table|No suppliers match/);
      assert.match(out, /<h1[^>]*>Suppliers<\/h1>/);
    }
  });

  it("no match is said in words with a way back", async () => {
    reset({ admin_supplier_list: { data: { total: 0, rows: [] }, error: null } });
    const out = await page("suppliers", sp({ q: "zzz" }));
    assert.match(text(out), /No suppliers match these filters/);
    assert.match(out, /href="\/admin\/suppliers"[^>]*>Reset filters</);
  });
});

const DETAIL = {
  supplier: { id: "s-1", slug: "aboni-knitwear", company_name: "ABONI KNITWEAR LTD", name_display: "Aboni Knitwear Ltd.", description: "Knitwear", entity_type: "factory", published: false, claimed_by: null, sanctioned_flag: false, sanctioned_reason: null, notes_admin: null, city: "Gazipur", district: "Dhaka", country: "Bangladesh", address_raw: "Plot 4", website: "https://aboni.example", parent_group_name: null, source_tags: ["bgmea"], completeness_pct: 70, sbi_total: 71, created_at: null, updated_at: null },
  source_records: [{ id: "r-1", source_code: "bgmea", source_tier: "tier2_industry", source_ref: null, fetched_at: "2026-09-01T00:00:00Z", status: "active" }],
  certifications: [{ id: "c-1", kind: "oeko_tex", certificate_no: "123", issuer: null, issued_on: null, expires_on: "2027-05-12", scope: null, document_url: null }],
  verification_queue: [{ id: "q-1", queue_type: "dup_check", confidence: 0.91, admin_action: null, reviewed_at: null, created_at: "2026-09-02T00:00:00Z" }],
  recent_audit: [{ id: "a-1", action: "supplier_update", patch: { published: true }, metadata: null, created_at: "2026-09-03T08:00:00Z", actor_id: "u-admin" }],
  pending_rescore_count: 1,
};

describe("/admin/suppliers/[id]", () => {
  it("draws the record: name, readiness, the editor, evidence, audit", async () => {
    reset({ admin_supplier_get: { data: DETAIL, error: null } });
    const out = await page("suppliers/[id]", { params: Promise.resolve({ id: "s-1" }) });
    const t = text(out);
    assert.deepEqual(calls, [{ fn: "admin_supplier_get", args: { p_id: "s-1" } }]);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /<h1[^>]*>Aboni Knitwear Ltd\.<\/h1>/);
    assert.match(t, /1 active Tier 1-3 source\b/);
    assert.match(t, /Meets the database publish requirement\./);
    assert.match(t, /Public profile hidden/, "an unpublished supplier has no public link");
    assert.doesNotMatch(out, /href="\/suppliers\/aboni-knitwear"/);
    assert.match(t, /Editable buyer profile/);
    assert.match(out, /role="switch"/);
    assert.match(t, /Save changes|No changes/);
    assert.match(t, /Queue SBI rescore/);
    assert.match(t, /Internal SBI total/);
    assert.match(t, /Oeko-Tex|OEKO-TEX/i);
    assert.match(out, /"published": true/);
    assert.match(out, /href="\/admin\/queue\?type=dup_check"/);
  });

  it("without a Tier 1-3 source it says publishing is blocked", async () => {
    reset({ admin_supplier_get: { data: { ...DETAIL, source_records: [] }, error: null } });
    const t = text(await page("suppliers/[id]", { params: Promise.resolve({ id: "s-1" }) }));
    assert.match(t, /Publishing is blocked until active Tier 1-3 evidence exists\./);
  });

  it("a supplier that is not there is a real 404; a failed read is an error, not a 404", async () => {
    reset({ admin_supplier_get: { data: null, error: null } });
    assert.equal(await notFound("suppliers/[id]", { params: Promise.resolve({ id: "nope" }) }), true);
    reset({ admin_supplier_get: { data: null, error: { message: "boom" } } });
    const out = await page("suppliers/[id]", { params: Promise.resolve({ id: "s-1" }) });
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load supplier: boom/);
  });
});

describe("/admin/suppliers/import", () => {
  it("states the CSV format and offers the upload; the dry-run and commit are the route's, not the page's", async () => {
    const out = draw(await load("suppliers/import")());
    const t = text(out);
    assert.match(out, /<h1[^>]*>Bulk import<\/h1>/);
    assert.match(t, /Required column: slug/);
    assert.match(t, /Limits: ≤ 2 MB, ≤ 2000 data rows per upload\./);
    assert.match(out, /type="file"/);
    assert.match(t, /Upload CSV/);
  });
});

const USER = { user_id: "u-1", email: "sam@example.com", display_name: "Sam Lee", role: "supplier", is_suspended: true, suspended_at: "2026-09-10T00:00:00Z", suspended_by: "u-admin", suspended_by_email: "root@example.com", suspended_reason: "spam", plan_tier: "growth", created_at: "2026-08-01T00:00:00Z", last_sign_in_at: null, claimed_supplier: { id: "s-1", slug: "aboni", company_name: "Aboni Knitwear Ltd.", entity_type: "factory" }, audit_count: 4 };

describe("/admin/users", () => {
  it("draws the roster and keeps the filter field names", async () => {
    reset({ admin_user_list: { data: { total: 1, rows: [USER] }, error: null } });
    const out = await page("users", sp({ role: "supplier", status: "suspended" }));
    const t = text(out);
    assert.match(out, /<h1[^>]*>Users &amp; access<\/h1>|<h1[^>]*>Users & access<\/h1>/);
    assert.match(t, /1 accounts\./);
    for (const name of ["q", "role", "status"]) assert.match(out, new RegExp(`name="${name}"`), name);
    assert.match(out, /href="\/admin\/users\/u-1"[^>]*>Sam Lee</);
    assert.match(t, /sam@example\.com/);
    assert.match(t, /suspended/);
    assert.match(t, /created 2026-08-01 · never · 4 audit/);
    assert.match(t, /Aboni Knitwear Ltd\./);
    assert.match(t, />?Manage/);
    assert.deepEqual(calls[0]!.args, { p_search: null, p_role: "supplier", p_status: "suspended", p_limit: 50, p_offset: 0 });
  });

  it("an unreadable roster is an error", async () => {
    reset({ admin_user_list: { data: null, error: { message: "denied" } } });
    const out = await page("users", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load users: denied\./);
    assert.doesNotMatch(out, /<table/);
  });
});

describe("/admin/users/[id]", () => {
  const ARGS = { params: Promise.resolve({ id: "u-1" }) };
  it("draws the account, Manage with its confirmation words kept in the island, and the audit history", async () => {
    reset({
      admin_user_get: { data: USER, error: null },
      admin_user_audit: { data: { total: 1, rows: [{ id: "x", created_at: "2026-09-10T00:00:00Z", actor_id: "u-admin", actor_email: "root@example.com", action: "user_suspend", target_table: "profiles", target_id: "u-1", patch: { is_suspended: true }, metadata: null, direction: "target" }] }, error: null },
    });
    const out = await page("users/[id]", ARGS);
    const t = text(out);
    assert.match(out, /<h1[^>]*>Sam Lee<\/h1>/);
    assert.match(t, /Suspended 2026-09-10 00:00:00 by root@example\.com/);
    assert.match(t, /Reason: spam/);
    assert.match(t, /Never signed in/);
    assert.match(t, /Un-suspend/);
    assert.match(t, /Save changes|No changes/);
    assert.match(t, /by root@example\.com/);
    assert.match(out, /"is_suspended": true/);
    assert.deepEqual(calls.map((c) => c.fn).sort(), ["admin_user_audit", "admin_user_get"]);
  });

  it("an admin looking at their own record cannot change or suspend it", async () => {
    reset({ admin_user_get: { data: { ...USER, user_id: "u-admin", is_suspended: false }, error: null }, admin_user_audit: { data: { total: 0, rows: [] }, error: null } });
    const out = await page("users/[id]", ARGS);
    assert.match(text(out), /You can't change your own role/);
    assert.match(text(out), /You can't suspend your own account\./);
  });

  it("a user that is not there is a real 404; any other failure is an error", async () => {
    reset({ admin_user_get: { data: null, error: { message: "user not found" } } });
    assert.equal(await notFound("users/[id]", ARGS), true);
    reset({ admin_user_get: { data: null, error: { message: "boom" } } });
    const out = await page("users/[id]", ARGS);
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load user: boom\./);
  });
});

const ENTRY = { id: "e-1", created_at: "2026-09-10T08:30:00Z", action: "supplier_update", target_table: "suppliers", target_id: "s-1", target_label: "Aboni Knitwear Ltd.", patch: { published: true }, metadata: { via: "api" }, actor: { id: "u-admin", email: "root@example.com", role: "admin" } };

describe("/admin/audit-log", () => {
  it("draws the entries with filters from the facets, and each entry opens its own page", async () => {
    reset({ admin_audit_log_list: { data: { total: 1, rows: [ENTRY], facets: { actions: ["supplier_update"], target_tables: ["suppliers"] } }, error: null } });
    const out = await page("audit-log", sp({ action: "supplier_update" }));
    const t = text(out);
    assert.match(out, /<h1[^>]*>Audit log<\/h1>/);
    assert.match(t, /1 rows\./);
    for (const name of ["action", "target", "actor", "since", "until"]) assert.match(out, new RegExp(`name="${name}"`), name);
    assert.match(out, /<option value="supplier_update" selected="">Supplier Update<\/option>/);
    assert.match(out, /href="\/admin\/audit-log\/e-1"[^>]*>Aboni Knitwear Ltd\.</);
    assert.match(t, /2026-09-10 08:30:00/);
    assert.match(t, /root@example\.com · Admin/);
  });

  it("an unreadable log is an error", async () => {
    reset({ admin_audit_log_list: { data: null, error: { message: "denied" } } });
    const out = await page("audit-log", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load audit log: denied\./);
  });
});

describe("/admin/audit-log/[id]", () => {
  const ARGS = { params: Promise.resolve({ id: "e-1" }) };
  it("draws actor, a link to the target, the patch and the metadata", async () => {
    reset({ admin_audit_log_get: { data: ENTRY, error: null } });
    const out = await page("audit-log/[id]", ARGS);
    assert.match(out, /<h1[^>]*>Supplier Update<\/h1>/);
    assert.match(out, /href="\/admin\/suppliers\/s-1"[^>]*>Aboni Knitwear Ltd\.</);
    assert.match(out, /"published": true/);
    assert.match(out, /"via": "api"/);
  });

  it("an entry that is not there is a real 404; any other failure is an error", async () => {
    reset({ admin_audit_log_get: { data: null, error: { message: "audit row not found" } } });
    assert.equal(await notFound("audit-log/[id]", ARGS), true);
    reset({ admin_audit_log_get: { data: null, error: { message: "boom" } } });
    assert.match(text(await page("audit-log/[id]", ARGS)), /Could not load audit row: boom\./);
  });
});

const CLAIM = (over: Record<string, unknown> = {}) => ({
  claim_id: "cl-1", status: "orphaned", field_key: "bkmea_employees_total", field_value: "1200", locator: null, excerpt: null, subject_table: "suppliers", subject_id: "s-1", source_tier: 2,
  first_seen_at: "2026-08-01T00:00:00Z", last_confirmed_at: null, reviewed_at: null, review_note: null,
  supplier: { id: "s-1", slug: "aboni", company_name: "Aboni Knitwear Ltd." },
  evidence: { id: "ev-1", scraper_code: "bkmea_members", url: "https://bkmea.example/x", final_url: null, http_status: 200, fetch_status: "ok", verify_status: "live", last_verified_at: null, fetched_at: "2026-08-01T00:00:00Z", raw_html_mirror_url: null, screenshot_mirror_url: null, file_mirror_url: null, verify_detail: null },
  ...over,
});
const SUMMARY = { documents: { total: 10, live: 7, changed: 1, dead: 2, unverified: 0, oldest_unverified_at: null, verified_last_7d: 8 }, claims: { total: 50, active: 40, stale: 3, superseded: 0, contradicted: 1, orphaned: 4, needs_review: 8, confirmed_last_7d: 30 }, credits: { last_24h: 0, last_30d: 0, month_to_date: 0, all_time: 0 }, monitors: { total: 2, enabled: 2, erroring: 0, last_check_at: "2026-10-01T00:00:00Z", pending_webhook_events: 0 }, generated_at: "2026-10-05T00:00:00Z" };

describe("/admin/evidence", () => {
  it("draws the health strip and the unreviewed claims by company, each with Resolve", async () => {
    reset({
      admin_evidence_problem_claims: { data: { total: 2, limit: 50, offset: 0, generated_at: "x", rows: [CLAIM(), CLAIM({ claim_id: "cl-2", reviewed_at: "2026-09-30T00:00:00Z" })] }, error: null },
      admin_evidence_summary: { data: SUMMARY, error: null },
    });
    const out = await page("evidence", sp({ status: "orphaned" }));
    const t = text(out);
    assert.match(out, /<h1[^>]*>Citation health<\/h1>/);
    assert.match(t, /8 unreviewed\./);
    assert.match(t, /Confirmed claims 40 of 50 total/);
    assert.match(t, /Needs review 8/);
    assert.match(t, /Checked and no longer supported \(1 company, 1 field\)/);
    assert.match(out, /href="\/admin\/suppliers\/s-1"[^>]*>Aboni Knitwear Ltd\.</);
    assert.match(t, /Employees \(total\)/);
    assert.equal(out.match(/>Resolve</g)?.length, 1, "a reviewed claim is not on the worklist");
    assert.match(out, /name="status"/);
    assert.deepEqual(calls.find((c) => c.fn === "admin_evidence_problem_claims")!.args, { p_status: "orphaned", p_limit: 50, p_offset: 0 });
  });

  it("with nothing unreviewed it says so, and an unreadable worklist is an error, not that", async () => {
    reset({ admin_evidence_problem_claims: { data: { total: 0, limit: 50, offset: 0, generated_at: "x", rows: [] }, error: null }, admin_evidence_summary: { data: null, error: { message: "x" } } });
    const out = await page("evidence", sp());
    assert.match(text(out), /Nothing to review/);
    assert.doesNotMatch(out, /Confirmed claims/, "a failed summary hides only the strip");
    reset({ admin_evidence_problem_claims: { data: null, error: { message: "denied" } }, admin_evidence_summary: { data: SUMMARY, error: null } });
    const bad = await page("evidence", sp());
    assert.match(bad, /role="alert"/);
    assert.match(text(bad), /Could not load the evidence worklist: denied\./);
    assert.doesNotMatch(text(bad), /Nothing to review/);
  });
});

describe("/admin/feedback", () => {
  const ROW = { id: "f-1", user_id: "u-1", page_path: "/app/search", message: "The filter forgets my last choice.", status: "open", created_at: "2026-10-04T09:00:00Z", user_email: "sam@example.com" };
  it("draws the queue with its tabs, the note, and Mark triaged posting to the same route", async () => {
    reset({ feedback_admin_list: { data: { total: 1, rows: [ROW] }, error: null } });
    const out = await page("feedback", sp());
    assert.match(out, /<h1[^>]*>User feedback<\/h1>/);
    assert.match(out, /aria-current="page"[^>]*>open</);
    assert.match(out, /href="\/admin\/feedback\?status=closed"/);
    assert.match(text(out), /The filter forgets my last choice\./);
    assert.match(out, /<form action="\/api\/v1\/admin\/feedback\/f-1" method="post"/);
    assert.match(out, /<input type="hidden" name="status" value="triaged"\/>/);
    assert.match(text(out), /Mark triaged/);
    assert.deepEqual(calls[0]!.args, { p_status: "open", p_limit: 50, p_offset: 0 });
  });

  it("a triaged note has no button, an empty queue says so, and an unreadable one is an error", async () => {
    reset({ feedback_admin_list: { data: { total: 1, rows: [{ ...ROW, status: "triaged" }] }, error: null } });
    assert.doesNotMatch(await page("feedback", sp({ status: "triaged" })), /Mark triaged/);
    reset({ feedback_admin_list: { data: { total: 0, rows: [] }, error: null } });
    assert.match(text(await page("feedback", sp({ status: "closed" }))), /No feedback in this queue There are no closed reports right now\./);
    reset({ feedback_admin_list: { data: null, error: { message: "denied" } } });
    const out = await page("feedback", sp());
    assert.match(out, /role="alert"/);
    assert.match(text(out), /Could not load feedback: denied/);
  });
});

describe("/admin/sources", () => {
  const DOC = {
    summary: { last_success_at: "2026-10-04T00:00:00Z", running_jobs: 0, pending_jobs: 1, failed_jobs: 2, enabled_schedules: 3, next_scheduled_at: null },
    scrapers: [], recent_runs: [], recent_jobs: [], generated_at: "2026-10-05T00:00:00Z",
  };
  it("draws the console: the figures, evidence health, a card per source with Run now", async () => {
    reset({ admin_etl_dashboard: { data: DOC, error: null }, admin_evidence_summary: { data: SUMMARY, error: null }, admin_evidence_by_scraper: { data: null, error: null } });
    const out = await page("sources");
    const t = text(out);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /<h1[^>]*>Sources &amp; ingestion<\/h1>|<h1[^>]*>Sources & ingestion<\/h1>/);
    assert.match(t, /Failed needs attention 2 Retry after checking the error/);
    assert.match(t, /Evidence health/);
    assert.match(t, /Review 8 claims/);
    assert.match(t, /No scraper is running right now\./);
    assert.match(t, /Run now/);
    assert.match(t, /Save timer/);
    assert.match(t, /No scraper jobs have been queued yet\./);
  });

  it("a failed dashboard is an error; a failed evidence read hides only the evidence", async () => {
    reset({ admin_etl_dashboard: { data: null, error: { message: "denied" } }, admin_evidence_summary: { data: null, error: null }, admin_evidence_by_scraper: { data: null, error: null } });
    const bad = await page("sources");
    assert.match(bad, /role="alert"/);
    assert.match(text(bad), /Could not load scraper operations: denied\./);
    reset({ admin_etl_dashboard: { data: DOC, error: null }, admin_evidence_summary: { data: null, error: { message: "x" } }, admin_evidence_by_scraper: { data: null, error: { message: "x" } } });
    const t = text(await page("sources"));
    assert.doesNotMatch(t, /Evidence health/);
    assert.match(t, /Run now/);
  });
});

describe("the ported files carry no old-kit class or import", () => {
  const files = [
    "components/admin/data-ui.tsx",
    "components/admin/evidence-claims-list.tsx",
    "components/admin-supplier-editor-form.tsx",
    "components/admin-supplier-import-form.tsx",
    "components/admin-supplier-rescore-button.tsx",
    "components/admin-user-edit-form.tsx",
    "components/admin-evidence-decide-button.tsx",
    "components/admin-scraper-monitor.tsx",
    "components/admin-scraper-actions.tsx",
    ...["suppliers", "suppliers/[id]", "suppliers/import", "users", "users/[id]", "audit-log", "audit-log/[id]", "sources", "evidence", "feedback"].map((p) => `${ADMIN}/${p}/page.tsx`),
    ...["suppliers/[id]", "users/[id]", "audit-log/[id]"].map((p) => `${ADMIN}/${p}/loading.tsx`),
  ];
  it("no proto-card, ink-primary, bg-l0, brand-forest, sem-, neutral-, @/components/ui or admin-ui", () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      assert.doesNotMatch(src, /proto-card|btn-proto|text-ink-(primary|secondary|tertiary)|bg-bg-l|brand-forest|\bsem-|\bneutral-\d|font-display|hairline|accent-indigo|@\/components\/ui\/|admin\/admin-ui|skeletons"/, f);
    }
  });

  it("every loading file uses the kit's skeleton", () => {
    for (const p of ["suppliers/[id]", "users/[id]", "audit-log/[id]"]) {
      assert.match(fs.readFileSync(path.join(process.cwd(), ADMIN, p, "loading.tsx"), "utf8"), /PaneSkeleton[^;]*@\/components\/kit/);
    }
  });
});
