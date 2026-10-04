// The v4 Compliance pages (B6c): the words (what needs a look, the three expiry groups and their
// tabs, the UFLPA counts and each supplier's result), the one count behind the heading and the sidebar
// badge, what the three routes put in the HTML for a filled, an empty and a failed read, and the
// layout's badge loader. Word tests use 4 Oct 2026; the routes use the real clock, so their dates are
// built from it.
//
// The routes run over a fake Supabase client installed into the module cache before they load
// (the pattern in `components/orders/orders.test.ts`).

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { loadComplianceBadge } from "@/lib/dashboard/compliance-badge";
import { ExpiryHead, ExpiryList, ExpiryNone } from "./expiry";
import { AttentionCard, AttentionError, ComplianceSkeleton, ExpiryCard, HubEmpty, MsaCard, PartialNote, UflpaCard } from "./hub";
import { loadCompliance } from "./load";
import { UflpaError, UflpaStats, UflpaTable } from "./uflpa";
import {
  attention,
  comingUp,
  complianceBadge,
  expiredHeading,
  expiryCounts,
  expiryGroups,
  expiryHref,
  expirySubline,
  expiryTabs,
  hubCaption,
  parseShow,
  uflpaCounts,
  uflpaEvidence,
  uflpaNote,
  uflpaPlace,
  within30Heading,
  type CertList,
  type CertRead,
  type UflpaPayload,
  type UflpaRow,
} from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
let rpcs: Record<string, Answer | (() => Promise<Answer>)> = {};
let rpcCalls: string[] = [];
const client = {
  rpc: async (fn: string) => {
    rpcCalls.push(fn);
    const h = rpcs[fn];
    if (h === undefined) return { data: null, error: { code: "PGRST202", message: `no function ${fn}` } };
    return typeof h === "function" ? h() : h;
  },
};
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const html = (el: ReactElement) => plain(render(el));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const given = (a: typeof rpcs) => {
  rpcs = a;
  rpcCalls = [];
};

const NOW = new Date("2026-10-04T12:00:00Z");
const S = (n: number) => `0f1e2d3c-0000-4000-8000-00000000000${n}`;
const cert = (sid: string, name: string, kind: string, no: string, expires_on: string, over: Partial<CertRead["supplier"]> = {}): CertRead => ({
  kind,
  certificate_no: no,
  issuer: kind.toUpperCase(),
  expires_on,
  supplier: { id: sid, slug: `slug-${sid.slice(-1)}`, company_name: name, entity_type: "factory", city: "Dhaka", district: "Dhaka", ...over },
});
const list = (rows: CertRead[], total = rows.length): CertList => ({ total, rows });

const EXPIRED = list([cert(S(1), "ABONI KNITWEAR LTD", "wrap", "7865", "2026-09-29"), cert(S(2), "SQ Celsius Limited", "wrap", "131732", "2026-09-19")]);
const EXPIRING = list([cert(S(3), "Mondol Intimates Ltd.", "gots", "GOTS-26992", "2026-10-08"), cert(S(4), "Tex Town Ltd.", "gots", "GOTS-27401", "2026-11-19")]);

describe("the one count", () => {
  it("expired first, then the ones lapsing; the total is both lists' totals, not only the rows shown", () => {
    const a = attention(EXPIRED, EXPIRING, NOW)!;
    assert.equal(a.total, 4);
    assert.deepEqual(a.rows.map((r) => r.state), ["expired", "expired", "expiring", "expiring"]);
    assert.equal(a.rows[0]!.what, "WRAP 7865 expired 29 Sep 2026.");
    assert.equal(a.rows[0]!.note, "No renewal on file.");
    assert.equal(a.rows[0]!.askLabel, "Ask for the new certificate");
    assert.equal(a.rows[2]!.askLabel, "Ask for the renewal");
    assert.equal(a.rows[0]!.askHref, `/app/rfqs/new?supplier=${S(1)}`);
    assert.equal(attention(list([], 9), list([], 0), NOW)!.total, 9, "the rows may be fewer than the total");
  });

  it("one read failing leaves the other and its total; both failing is null, never zero", () => {
    assert.equal(attention(null, EXPIRING, NOW)!.total, 2);
    assert.equal(attention(EXPIRED, null, NOW)!.total, 2);
    assert.equal(attention(null, null, NOW), null);
  });

  it("the badge is the same total in words: '4 to check', nothing for none or unread, never '0 to check'", () => {
    assert.deepEqual(complianceBadge(attention(EXPIRED, EXPIRING, NOW)), { text: "4 to check", tone: "danger" });
    assert.equal(complianceBadge(attention(list([]), list([]), NOW)), null);
    assert.equal(complianceBadge(null), null);
    assert.deepEqual(complianceBadge({ total: 1234 }), { text: "1,234 to check", tone: "danger" });
  });

  it("the hub's caption names how many are saved, or says 'your saved suppliers' when that was not read", () => {
    assert.equal(hubCaption(11), "Certificates, forced-labour checks and your modern slavery statement for 11 saved suppliers.");
    assert.equal(hubCaption(1), "Certificates, forced-labour checks and your modern slavery statement for 1 saved supplier.");
    assert.equal(hubCaption(null), "Certificates, forced-labour checks and your modern slavery statement for your saved suppliers.");
  });
});

describe("the expiry list", () => {
  const g = () => expiryGroups(EXPIRED, EXPIRING, NOW);

  it("three groups: expired, within 30 days, 31 to 90; each item says when, in words, and where to ask", () => {
    const { expired, within30, within90 } = g();
    assert.deepEqual(expired.map((i) => i.number), ["7865", "131732"]);
    assert.deepEqual(within30.map((i) => i.number), ["GOTS-26992"]);
    assert.deepEqual(within90.map((i) => i.number), ["GOTS-27401"]);
    assert.equal(expired[0]!.when, "Expired 29 Sep 2026");
    assert.equal(expired[0]!.relative, null);
    assert.equal(within30[0]!.when, "Expires 8 Oct 2026");
    assert.equal(within30[0]!.relative, "in 4 days");
    assert.equal(expired[0]!.supplier, "Aboni Knitwear Ltd", "an all-capitals name is cased");
    assert.equal(expired[0]!.place, "Dhaka", "a city and district alike are said once");
    assert.equal(expired[0]!.certHref, "/app/suppliers/slug-1#cert-wrap-7865", "the certificate's own row on the record");
    assert.equal(expired[0]!.askLabel, "Ask for the new certificate");
  });

  it("the tabs count the groups; the headings say how many", () => {
    const c = expiryCounts(g());
    assert.deepEqual(c, { all: 4, expired: 2, within30: 1, within90: 1 });
    assert.deepEqual(expiryTabs(c).map((t) => t.label), ["All · 4", "Expired · 2", "Within 30 days · 1", "31–90 days · 1"]);
    assert.equal(expiredHeading(7), "Expired · 7 certificates · most recent first");
    assert.equal(expiredHeading(1), "Expired · 1 certificate · most recent first");
    assert.equal(within30Heading(2), "Expires within 30 days · 2 certificates");
    assert.equal(expirySubline(14, 11), "14 dated certificates on 11 saved suppliers");
    assert.equal(expirySubline(14, null), "14 dated certificates on your saved suppliers");
  });

  it("?show= is read from the address and kept in every tab's link", () => {
    assert.equal(parseShow("expired"), "expired");
    assert.equal(parseShow(["30"]), "30");
    assert.equal(parseShow("bogus"), "all");
    assert.equal(expiryHref("all"), "/app/compliance/expiry");
    assert.equal(expiryHref("90"), "/app/compliance/expiry?show=90");
  });

  it("the hub's expiry card says how many lapse and the first; unread is said, and none is a sentence", () => {
    const c = comingUp(EXPIRING, NOW);
    assert.match(c.words, /^2 certificates lapse in the next 90 days, the first on 8 Oct 2026 \(Mondol Intimates Ltd\. GOTS-26992\)\.$/);
    assert.equal(comingUp(list([]), NOW).words, "No certificate on your saved suppliers expires in the next 90 days.");
    assert.equal(comingUp(null, NOW).words, "The expiry dates did not load.");
  });

  it("the list draws each group under its own bar with one ask each; a filter draws only its group", () => {
    const all = html(createElement(ExpiryList, { groups: g(), show: "all" }));
    assert.match(text(all), /Expired · 2 certificates · most recent first/);
    assert.match(text(all), /Expires within 30 days · 1 certificate/);
    assert.match(text(all), /Expires in 31–90 days · 1 certificate/);
    assert.ok(all.indexOf("Expired · 2") < all.indexOf("Expires within 30"), "expired comes first");
    assert.equal(all.match(/>Ask for the new certificate</g)?.length, 2);
    assert.match(all, new RegExp(`href="/app/rfqs/new\\?supplier=${S(3)}"[^>]*>Ask for the renewal`));
    assert.match(all, /href="\/app\/suppliers\/slug-1#cert-wrap-7865"/);
    const only = html(createElement(ExpiryList, { groups: g(), show: "30" }));
    assert.doesNotMatch(only, /Expired · 2/);
    assert.match(text(only), /GOTS-26992/);
  });

  it("the head has the tabs and the way back; a phone says how many dated certificates on how many suppliers", () => {
    const out = html(createElement(ExpiryHead, { groups: g(), saved: 11, show: "expired" }));
    assert.match(out, /href="\/app\/compliance"[^>]*>[\s\S]*Compliance/);
    assert.match(out, /href="\/app\/compliance\/expiry\?show=expired"[^>]*aria-current="true"|aria-current="true"[^>]*href="\/app\/compliance\/expiry\?show=expired"/);
    assert.match(text(out), /All · 4 Expired · 2 Within 30 days · 1 31–90 days · 1/);
    assert.match(text(out), /4 dated certificates on 11 saved suppliers/);
  });

  it("nothing at all is a sentence, nothing in a group points back to every certificate, an unread list is not 'nothing'", () => {
    assert.match(text(html(createElement(ExpiryNone, { show: "all", anyRead: true }))), /Nothing needs a look/);
    const unread = html(createElement(ExpiryNone, { show: "all", anyRead: false }));
    assert.match(text(unread), /The certificate dates did not load No certificate dates could be read\./);
    assert.match(unread, /href="\/app\/compliance\/expiry"[^>]*>Try again/);
    assert.doesNotMatch(unread, /expires in the next 90 days|Nothing needs a look/);
    assert.match(html(createElement(ExpiryNone, { show: "30", anyRead: true })), /href="\/app\/compliance\/expiry"[^>]*>Show every certificate/);
  });
});

describe("UFLPA", () => {
  const row = (over: Partial<UflpaRow> = {}): UflpaRow => ({ supplier_id: "a", supplier_slug: "aboni", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Savar", district: "Dhaka", country: "Bangladesh", parent_group_name: null, uflpa_hits: [], status: "clear", ...over });
  const payload = (rows: UflpaRow[], over: Partial<UflpaPayload> = {}): UflpaPayload => ({ total: rows.length, hits: 0, flags: 0, clear: rows.length, rows, ...over });

  it("the three counts in Paper's order and words, the place, the evidence and the phone's one line", () => {
    assert.deepEqual(uflpaCounts({ hits: 1, flags: 2, clear: 8 }), [
      { status: "hit", count: 1 },
      { status: "region_flag", count: 2 },
      { status: "clear", count: 8 },
    ]);
    assert.equal(uflpaPlace(row()), "Dhaka");
    assert.equal(uflpaPlace(row({ country: "China", district: null, city: "Suzhou" })), "Suzhou, China");
    assert.equal(uflpaPlace(row({ city: null, district: null })), null);
    assert.deepEqual(uflpaEvidence(row({ status: "hit", uflpa_hits: [{ matched_name: "Acme Textile", list_entry_ref: "UFLPA-12", source_url: null, entity_name: null }] })), ["Acme Textile [UFLPA-12]"]);
    assert.deepEqual(uflpaEvidence(row({ status: "region_flag" })), ["Xinjiang-linked text in the record"]);
    assert.deepEqual(uflpaEvidence(row()), []);
    assert.equal(uflpaNote(payload([row()]), 11), "No link found on the UFLPA Entity List for your 11 saved suppliers. Not a clearance.");
    assert.match(uflpaNote(payload([row()], { hits: 1, clear: 0 }), 11) ?? "", /^1 supplier on the UFLPA Entity List among your 11 saved\. You can't send them an RFQ\.$/);
    assert.equal(uflpaNote(null, 11), null);
  });

  it("the stats and the table: counts, a hit's row tinted and its entry named, a clear result never a clearance", () => {
    const p = payload([row({ supplier_id: "h", status: "hit", company_name: "Listed Ltd.", uflpa_hits: [{ matched_name: "Listed", list_entry_ref: "R-1", source_url: null, entity_name: null }] }), row()], { hits: 1, clear: 1 });
    const stats = html(createElement(UflpaStats, { uflpa: p }));
    assert.match(text(stats), /1 On the UFLPA Entity List 0 Possible Xinjiang link 1 No link found/);
    assert.match(text(stats), /You can't send them an RFQ/);
    assert.match(text(stats), /Not a clearance; keep your due diligence/);
    const table = html(createElement(UflpaTable, { rows: p.rows }));
    assert.match(table, /bg-sanction-tint/);
    assert.match(text(table), /Listed Ltd\. Dhaka On the UFLPA Entity List Listed \[R-1\]/);
    assert.match(table, /href="\/app\/suppliers\/aboni"/);
  });

  it("a failed read is an error with Try again, not an empty table", () => {
    const out = html(createElement(UflpaError, { retryHref: "/app/compliance/uflpa" }));
    assert.match(out, /role="alert"/);
    assert.match(text(out), /We couldn't load the UFLPA checks\./);
    assert.match(out, /href="\/app\/compliance\/uflpa"[^>]*>Try again/);
  });
});

describe("the hub's cards", () => {
  it("the UFLPA card has the counts and the DHS note; unread says so and never '0 suppliers'", () => {
    const ok = html(createElement(UflpaCard, { uflpa: { total: 11, hits: 0, flags: 0, clear: 11, rows: [] } }));
    assert.match(text(ok), /Forced labour: UFLPA checks Open On the UFLPA Entity List 0 suppliers Possible Xinjiang link 0 suppliers No link found 11 suppliers/);
    assert.match(ok, /href="\/app\/compliance\/uflpa"[^>]*>Open/);
    const bad = html(createElement(UflpaCard, { uflpa: null }));
    assert.match(bad, /role="alert"/);
    assert.doesNotMatch(bad, /0 suppliers/);
  });

  it("the statement card is a way in and promises no draft in progress", () => {
    const out = html(createElement(MsaCard, { msa: { total_saved: 3, total_published: 3, rsc_covered: 1, expiring_certs_90d: 0 } }));
    assert.match(text(out), /Modern slavery statement UK Modern Slavery Act 2015, section 54\. Draft it from your saved suppliers\. Nothing leaves your browser\./);
    assert.match(out, /href="\/app\/compliance\/msa"[^>]*>Draft the statement/);
    assert.doesNotMatch(out, /claims to confirm|Continue the draft/);
  });

  it("the certificate card lists one ask each and says how many in all; the states say what failed", () => {
    const a = attention(EXPIRED, EXPIRING, NOW)!;
    const out = html(createElement(AttentionCard, { attention: a }));
    assert.match(text(out), /Needs attention · 4 certificates/);
    assert.match(text(out), /Aboni Knitwear Ltd|ABONI KNITWEAR LTD/);
    assert.equal(out.match(/>Ask for the new certificate</g)?.length, 2);
    assert.match(text(html(createElement(AttentionError, { retryHref: "/app/compliance" }))), /We couldn't load your compliance checks\. The certificate list did not answer\./);
    assert.match(text(html(createElement(PartialNote, { missing: "expired" }))), /The expired certificates did not load/);
    assert.match(text(html(createElement(PartialNote, { missing: "expiring" }))), /The certificates that lapse soon did not load/);
    assert.match(text(html(createElement(HubEmpty))), /No saved suppliers yet\./);
    assert.match(html(createElement(ComplianceSkeleton)), /role="status" aria-busy="true"/);
    assert.match(text(html(createElement(ExpiryCard, { expiring: EXPIRING, today: NOW }))), /See every expiry date/);
  });
});

describe("the reads and the layout's badge", () => {
  it("each read stands on its own; a malformed answer is a failed read, not an empty list", async () => {
    given({
      compliance_expired_certs: { data: EXPIRED, error: null },
      compliance_expiring_certs: { data: { not: "a list" }, error: null },
      compliance_uflpa_tracker: { data: null, error: { message: "down" } },
    });
    const d = await loadCompliance(client, { certs: true, uflpa: true });
    assert.equal(d.expired?.total, 2);
    assert.equal(d.expiring, null);
    assert.equal(d.uflpa, null);
    assert.ok(!rpcCalls.includes("compliance_msa_inputs"), "a read the page did not want was made");
  });

  it("the badge is the hub's count from the same two reads", async () => {
    given({ compliance_expired_certs: { data: EXPIRED, error: null }, compliance_expiring_certs: { data: EXPIRING, error: null } });
    assert.deepEqual(await loadComplianceBadge(client, NOW), { text: "4 to check", tone: "danger" });
    assert.equal(attention(EXPIRED, EXPIRING, NOW)!.total, 4, "the hub's heading reads the same total");
  });

  it("no badge for nothing to check, a failed read, or a read too slow to hold the frame", async () => {
    given({ compliance_expired_certs: { data: list([]), error: null }, compliance_expiring_certs: { data: list([]), error: null } });
    assert.equal(await loadComplianceBadge(client, NOW), null);
    given({ compliance_expired_certs: { data: null, error: { message: "x" } }, compliance_expiring_certs: { data: null, error: { message: "x" } } });
    assert.equal(await loadComplianceBadge(client, NOW), null);
    const never = () => new Promise<Answer>(() => {});
    given({ compliance_expired_certs: never, compliance_expiring_certs: never });
    const t0 = Date.now();
    assert.equal(await loadComplianceBadge(client, NOW, 30), null);
    assert.ok(Date.now() - t0 < 1000, "the frame waited on a slow list");
  });
});

const ROWS = { compliance_expired_certs: { data: EXPIRED, error: null } as Answer, compliance_expiring_certs: { data: EXPIRING, error: null } as Answer };
const MSA: Answer = { data: { total_saved: 11, total_published: 10, rsc_covered: 4, expiring_certs_90d: 2 }, error: null };
const UFL: Answer = { data: { total: 10, hits: 0, flags: 0, clear: 10, rows: [] }, error: null };
const page = async (file: string, props?: unknown) => plain(render(await route(file)(props)));

describe("/app/compliance", () => {
  const hub = () => page("app/(app)/app/compliance/page.js");

  it("lists every certificate that needs a look with one ask each, and the three cards; the heading and the badge say the same number", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const out = await hub();
    assert.match(text(out), /Compliance Certificates, forced-labour checks and your modern slavery statement for 11 saved suppliers\./);
    assert.match(text(out), /Needs attention · 4 certificates/);
    assert.equal(out.match(/>Ask for the new certificate</g)?.length, 2);
    assert.match(text(out), /Forced labour: UFLPA checks/);
    assert.match(text(out), /Modern slavery statement/);
    assert.match(text(out), /See every expiry date/);
    assert.deepEqual(await loadComplianceBadge(client), { text: `${attention(EXPIRED, EXPIRING, new Date())!.total} to check`, tone: "danger" });
    assert.doesNotMatch(out, /Download evidence|sanctions lists|Continue the draft/);
  });

  it("one certificate read failing says so and still lists the other; both failing is an error, never 'Nothing needs attention'", async () => {
    given({ compliance_expired_certs: { data: null, error: { message: "no function" } }, compliance_expiring_certs: ROWS.compliance_expiring_certs, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const partial = await hub();
    assert.match(text(partial), /The expired certificates did not load/);
    assert.match(text(partial), /Needs attention · 2 certificates/);
    given({ compliance_expired_certs: { data: null, error: { message: "x" } }, compliance_expiring_certs: { data: null, error: { message: "x" } }, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const none = await hub();
    assert.match(none, /role="alert"/);
    assert.match(text(none), /We couldn't load your compliance checks\./);
    assert.doesNotMatch(none, /Nothing needs attention/);
  });

  it("nothing lapsing is the pattern's own sentence; no saved suppliers is the teaching state", async () => {
    given({ compliance_expired_certs: { data: list([]), error: null }, compliance_expiring_certs: { data: list([]), error: null }, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    assert.match(text(await hub()), /Nothing needs attention/);
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: { data: { total_saved: 0, total_published: 0, rsc_covered: 0, expiring_certs_90d: 0 }, error: null } });
    const empty = await hub();
    assert.match(text(empty), /No saved suppliers yet\./);
    assert.doesNotMatch(empty, /Needs attention/);
  });

  it("an unread UFLPA check says so in its card and the certificates still list", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: { data: null, error: { message: "down" } }, compliance_msa_inputs: MSA });
    const out = await hub();
    assert.match(text(out), /We couldn't read the UFLPA checks\./);
    assert.match(text(out), /Needs attention · 4 certificates/);
  });
});

describe("/app/compliance/expiry", () => {
  const expiry = (sp: Record<string, string> = {}) => page("app/(app)/app/compliance/expiry/page.js", { searchParams: Promise.resolve(sp) });

  it("the three groups, expired first, with the tabs and the filter applied from the address", async () => {
    given({ ...ROWS, compliance_msa_inputs: MSA });
    const all = await expiry();
    assert.match(text(all), /Certificate expiry Ask suppliers for renewals before certificates expire\./);
    assert.match(text(all), /All · 4 Expired · 2 Within 30 days · 1 31–90 days · 1/);
    assert.match(text(all), /Expired · 2 certificates · most recent first/);
    const expired = await expiry({ show: "expired" });
    assert.match(text(expired), /Expired · 2 certificates/);
    assert.doesNotMatch(text(expired), /Expires within 30 days · 1/);
    assert.ok(rpcCalls.includes("compliance_expired_certs") && rpcCalls.includes("compliance_expiring_certs"));
  });

  it("a group with nothing says so; an unread list is not 'nothing needs a look'", async () => {
    given({ compliance_expired_certs: { data: list([]), error: null }, compliance_expiring_certs: { data: list([]), error: null }, compliance_msa_inputs: MSA });
    assert.match(text(await expiry()), /Nothing needs a look/);
    given({ compliance_expired_certs: { data: null, error: { message: "x" } }, compliance_expiring_certs: { data: null, error: { message: "x" } }, compliance_msa_inputs: MSA });
    const failed = await expiry();
    assert.match(text(failed), /The certificate dates did not load/);
    assert.doesNotMatch(failed, /Nothing needs a look/);
  });

  it("one list failing is said and the other still lists", async () => {
    given({ compliance_expired_certs: { data: null, error: { message: "x" } }, compliance_expiring_certs: ROWS.compliance_expiring_certs, compliance_msa_inputs: MSA });
    const out = await expiry();
    assert.match(text(out), /The expired certificates did not load/);
    assert.match(text(out), /GOTS-26992/);
  });
});

describe("/app/compliance/uflpa", () => {
  const uflpa = () => page("app/(app)/app/compliance/uflpa/page.js");
  const U: UflpaPayload = {
    total: 2,
    hits: 1,
    flags: 0,
    clear: 1,
    rows: [
      { supplier_id: "h", supplier_slug: "listed", company_name: "Listed Ltd.", entity_type: "factory", city: "Dhaka", district: "Dhaka", country: "Bangladesh", parent_group_name: null, uflpa_hits: [{ matched_name: "Listed", list_entry_ref: "R-1", source_url: null, entity_name: null }], status: "hit" },
      { supplier_id: "c", supplier_slug: "aboni", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Savar", district: "Dhaka", country: "Bangladesh", parent_group_name: null, uflpa_hits: [], status: "clear" },
    ],
  };

  it("the counts and one row per supplier with its result, under the way back and the DHS list", async () => {
    given({ compliance_uflpa_tracker: { data: U, error: null }, compliance_msa_inputs: MSA });
    const out = await uflpa();
    assert.match(text(out), /UFLPA checks Your saved suppliers, checked against the UFLPA Entity List \(US DHS\)\./);
    assert.match(out, /href="https:\/\/www\.dhs\.gov\/uflpa-entity-list"[^>]*rel="noopener noreferrer"/);
    assert.match(text(out), /1 On the UFLPA Entity List 0 Possible Xinjiang link 1 No link found/);
    assert.match(text(out), /Listed Ltd\. Dhaka On the UFLPA Entity List Listed \[R-1\]/);
    assert.match(out, /href="\/app\/compliance"/);
  });

  it("a failed read is an error and an empty list teaches; neither is a clearance", async () => {
    given({ compliance_uflpa_tracker: { data: null, error: { message: "down" } }, compliance_msa_inputs: MSA });
    const failed = await uflpa();
    assert.match(text(failed), /We couldn't load the UFLPA checks\./);
    assert.doesNotMatch(failed, /No link found/);
    given({ compliance_uflpa_tracker: { data: { total: 0, hits: 0, flags: 0, clear: 0, rows: [] }, error: null }, compliance_msa_inputs: MSA });
    assert.match(text(await uflpa()), /No saved suppliers yet\./);
  });
});
