// The v4 Compliance pages (B6c): the words (what needs a look, the three expiry groups and their
// tabs, the UFLPA counts and each supplier's result), the one count behind the heading and the sidebar
// badge, what the three routes put in the HTML for a filled, an empty and a failed read, and the
// layout's badge loader. Word tests use 4 Oct 2026; the routes use the real clock, so their dates are
// built from it.
//
// The routes run over a fake Supabase client installed into the module cache before they load
// (the pattern in `components/orders/orders.test.ts`).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it, mock } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { loadComplianceBadge } from "@/lib/dashboard/compliance-badge";
import { attentionOf } from "@/lib/dashboard/needs-attention";
import { ExpiryHead, ExpiryList, ExpiryNone, ExpiryPhone, phoneWhen } from "./expiry";
import { uflpaNotice, uflpaSheetNotice } from "./uflpa-read";
import { AttentionCard, AttentionError, ComplianceSkeleton, ExpiryCard, HubEmpty, MsaCard, PartialNote, UflpaCard } from "./hub";
import { loadCompliance } from "./load";
import { UflpaError, UflpaPhone, UflpaStats, UflpaTable } from "./uflpa";
import {
  attention,
  certExportHref,
  attentionGroup,
  attentionGroupLines,
  certLedger,
  comingUp,
  complianceBadge,
  expiredHeading,
  expiryCounts,
  expiryGroups,
  expiryHref,
  expiryItems,
  expirySubline,
  expiryTabs,
  hubCaption,
  hubLooks,
  parseShow,
  sanctionsLedger,
  shortDay,
  uflpaCounts,
  uflpaEvidence,
  uflpaLedger,
  uflpaMore,
  uflpaPlace,
  uflpaSourceLine,
  uflpaSubline,
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
// The pages read today's date; the certificates here are dated around NOW, so the pages run on NOW's clock too,
// or a certificate crosses from expiring to expired as the real days pass (CI went red on 9 Oct 2026 for that).
before(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
after(() => mock.timers.reset());
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

  it("day 30 is 'within 30 days' and day 31 is 'coming up in 31 to 90 days'; the total does not move", () => {
    const a = attention(EXPIRED, list([cert(S(3), "A", "gots", "G-3", "2026-11-03"), cert(S(4), "B", "gots", "G-4", "2026-11-04")]), NOW)!;
    assert.deepEqual(a.rows.map(attentionGroup), ["expired", "expired", "within30", "within90"]);
    assert.equal(a.total, 4);
    assert.deepEqual(attentionGroupLines(a.rows).counts, { expired: 2, within30: 1, within90: 1 });
  });

  it("one read failing leaves the other and its total; both failing is null, never zero", () => {
    assert.equal(attention(null, EXPIRING, NOW)!.total, 2);
    assert.equal(attention(EXPIRED, null, NOW)!.total, 2);
    assert.equal(attention(null, null, NOW), null);
  });

  it("the badge is the same total in words: '4 to check', nothing for none or unread, never '0 to check'", () => {
    assert.deepEqual(complianceBadge(attention(EXPIRED, EXPIRING, NOW)), { text: "4 to check", tone: "caution" });
    assert.equal(complianceBadge(attention(list([]), list([]), NOW)), null);
    assert.equal(complianceBadge(null), null);
    assert.deepEqual(complianceBadge({ total: 1234 }), { text: "1,234 to check", tone: "caution" });
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
    const out = html(createElement(ExpiryHead, { groups: g(), saved: 11, show: "expired", download: true }));
    assert.match(out, /href="\/app\/compliance"[^>]*>[\s\S]*Compliance/);
    assert.match(out, /href="\/app\/compliance\/expiry\?show=expired"[^>]*aria-current="true"|aria-current="true"[^>]*href="\/app\/compliance\/expiry\?show=expired"/);
    assert.match(text(out), /All · 4 Expired · 2 Within 30 days · 1 31–90 days · 1/);
    assert.match(text(out), /4 dated certificates on 11 saved suppliers/);
    assert.match(out, />Download CSV</);
    const unread = html(createElement(ExpiryHead, { groups: g(), saved: 11, show: "expired", download: false }));
    assert.doesNotMatch(unread, /Download CSV/, "a list that was not fully read has nothing to download");
    assert.doesNotMatch(html(createElement(ExpiryHead, { groups: expiryGroups(null, null, NOW), saved: null, show: "all", download: true })), /Download CSV/, "an empty list has nothing to download");
  });

  it("the CSV link follows the filter on the page", () => {
    assert.equal(certExportHref(), "/api/v1/export?kind=certificates");
    assert.equal(certExportHref("all"), "/api/v1/export?kind=certificates");
    assert.equal(certExportHref("expired"), "/api/v1/export?kind=certificates&show=expired");
    assert.equal(certExportHref("90"), "/api/v1/export?kind=certificates&show=90");
    assert.deepEqual(expiryItems(g(), "30").map((i) => i.expiresOn), ["2026-10-08"]);
    assert.equal(expiryItems(g(), "all").length, 4);
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
    assert.equal(uflpaSubline(10), "10 saved suppliers against the US forced-labour list");
    assert.equal(uflpaSubline(null), "Your saved suppliers against the US forced-labour list");
  });

  it("the stats and the table: counts, a hit's row tinted and its entry named, a clear result never a clearance", () => {
    const p = payload([row({ supplier_id: "h", status: "hit", company_name: "Listed Ltd.", uflpa_hits: [{ matched_name: "Listed", list_entry_ref: "R-1", source_url: null, entity_name: null }] }), row()], { hits: 1, clear: 1 });
    const stats = html(createElement(UflpaStats, { uflpa: p }));
    assert.match(text(stats), /1 On the UFLPA Entity List 0 Possible Xinjiang link 1 No link found/);
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
  it("the buyer layout starts the badges, does not await them, and hands the frame the promise (row 24)", () => {
    const layout = readFileSync(path.join(process.cwd(), "app/(app)/app/layout.tsx"), "utf8");
    assert.match(layout, /const badges = loadFrameBadges\(supabase\);/);
    assert.doesNotMatch(layout, /await loadFrameBadges|await badges/, "the frame must not wait on the badges");
    assert.match(layout, /badges=\{badges\}/);
    const loader = readFileSync(path.join(process.cwd(), "lib/dashboard/frame-badges.ts"), "utf8");
    assert.match(loader, /loadComplianceBadge\(supabase\)/, "the badge is the hub's own count (attentionOf), through the one loader");
  });

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
    assert.deepEqual(await loadComplianceBadge(client, NOW), { text: "4 to check", tone: "caution" });
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

  it("the list is split into expired, within 30 days and coming up in 31 to 90 days, under the one number the badge also says", async () => {
    const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    const expiring = list([cert(S(3), "Mondol Intimates Ltd.", "gots", "G-3", d(10)), cert(S(4), "Tex Town Ltd.", "gots", "G-4", d(45)), cert(S(5), "Aboni Spinning Ltd.", "gots", "G-5", d(80))]);
    given({ ...ROWS, compliance_expiring_certs: { data: expiring, error: null }, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const t = text(await hub());
    assert.match(t, /Needs attention · 5 certificates/, "the split is a heading, not a second count");
    assert.match(t, /Expired · 2/);
    assert.match(t, /Expires within 30 days · 1/);
    assert.match(t, /Coming up in 31 to 90 days · 2/);
    assert.ok(t.indexOf("Expired · 2") < t.indexOf("Expires within 30 days · 1") && t.indexOf("Expires within 30 days · 1") < t.indexOf("Coming up in 31 to 90 days · 2"));
    assert.deepEqual(await loadComplianceBadge(client), { text: "5 to check", tone: "caution" });
  });

  it("nothing lapses within 30 days: no empty '0' group is drawn", async () => {
    const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    given({ compliance_expired_certs: { data: list([]), error: null }, compliance_expiring_certs: { data: list([cert(S(4), "Tex Town Ltd.", "gots", "G-4", d(45))]), error: null }, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const t = text(await hub());
    assert.match(t, /Needs attention · 1 certificate/);
    assert.match(t, /Coming up in 31 to 90 days · 1/);
    assert.doesNotMatch(t, /Expired · 0|Expires within 30 days · 0/);
  });

  it("lists every certificate that needs a look with one ask each, and the three cards; the heading and the badge say the same number", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const out = await hub();
    assert.match(text(out), /Compliance Certificates, forced-labour checks and your modern slavery statement for 11 saved suppliers\./);
    assert.match(text(out), /Needs attention · 4 certificates/);
    assert.equal(out.match(/>Ask for the new certificate</g)?.length, 2);
    assert.match(text(out), /Forced labour: UFLPA checks/);
    assert.match(text(out), /Modern slavery statement/);
    assert.match(text(out), /See every expiry date/);
    assert.deepEqual(await loadComplianceBadge(client), { text: `${attention(EXPIRED, EXPIRING, new Date())!.total} to check`, tone: "caution" });
    assert.match(out, />Download CSV</);
    assert.doesNotMatch(out, /Download evidence|sanctions lists|Continue the draft/);
  });

  it("offers the evidence pack whenever the saved count was read (header on a desktop, over the cards on a phone), and not otherwise", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const out = await hub();
    assert.equal(out.match(/>Download an evidence pack</g)?.length, 2, "the header's and the phone's");
    assert.ok(out.indexOf(">Download an evidence pack<") < out.indexOf("Needs attention"), "above the list");
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: { data: null, error: { message: "down" } } });
    assert.doesNotMatch(await hub(), /evidence pack/i, "the pack covers the saved suppliers; without their count it is not offered");
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: { data: { total_saved: 0, total_published: 0, rsc_covered: 0, expiring_certs_90d: 0 }, error: null } });
    assert.doesNotMatch(await hub(), /evidence pack/i, "nothing saved, nothing to put in a pack");
  });

  it("one certificate read failing says so and still lists the other; both failing is an error, never 'Nothing needs attention'", async () => {
    given({ compliance_expired_certs: { data: null, error: { message: "no function" } }, compliance_expiring_certs: ROWS.compliance_expiring_certs, compliance_uflpa_tracker: UFL, compliance_msa_inputs: MSA });
    const partial = await hub();
    assert.match(text(partial), /The expired certificates did not load/);
    assert.match(text(partial), /Needs attention · 2 certificates/);
    assert.doesNotMatch(partial, /Download CSV/, "a file of half the list would look whole");
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

  it("a phone's Alerts opens on the UFLPA result, dated by the list's last full read; an unread check draws no claim", async () => {
    const year = new Date().getUTCFullYear();
    const LISTS: Answer = { data: [{ list: "uflpa", entries_listed: 253, last_read: `${year}-10-08T04:00:00Z` }, { list: "ofac_sdn", entries_listed: 9799, last_read: `${year}-10-11T04:00:00Z` }], error: null };
    given({ ...ROWS, compliance_msa_inputs: MSA, compliance_uflpa_tracker: UFL, sanctions_lists_read: LISTS });
    const out = text(await expiry());
    assert.match(out, /UFLPA Entity List No link found · not a clearance · read 8 Oct /);
    assert.doesNotMatch(out, /not read yet/i);
    given({ ...ROWS, compliance_msa_inputs: MSA, compliance_uflpa_tracker: UFL });
    assert.match(text(await expiry()), /No link found · not a clearance · read date not stored/, "no read date is said, never invented");
    given({ ...ROWS, compliance_msa_inputs: MSA, compliance_uflpa_tracker: { data: { ...(UFL.data as object), hits: 1, clear: 9 }, error: null }, sanctions_lists_read: LISTS });
    const hit = text(await expiry());
    assert.match(hit, /1 on the list · read 8 Oct/);
    assert.doesNotMatch(hit, /No link found/);
    given({ ...ROWS, compliance_msa_inputs: MSA, sanctions_lists_read: LISTS });
    assert.doesNotMatch(text(await expiry()), /UFLPA Entity List|No link found/, "an unread check says nothing about the list");
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

describe("the UFLPA line on a phone (Paper page 36, `alerts` and `filters`)", () => {
  const clear = { total: 10, hits: 0, flags: 0 };
  const READ = "2026-10-01T03:10:00Z";

  it("is the saved suppliers' own result, dated by the list's last full read; a hit is never 'no link found'", () => {
    assert.deepEqual(uflpaNotice(clear, READ, NOW), { line: "No link found · not a clearance · read 1 Oct", hit: false });
    assert.deepEqual(uflpaNotice({ ...clear, hits: 2 }, READ, NOW), { line: "2 on the list · read 1 Oct", hit: true });
    assert.deepEqual(uflpaNotice({ ...clear, flags: 1 }, READ, NOW), { line: "1 possible Xinjiang link · read 1 Oct", hit: true });
    assert.equal(uflpaNotice(clear, "2025-12-30T00:00:00Z", NOW)!.line, "No link found · not a clearance · read 30 Dec 2025", "another year's read keeps its year");
    assert.equal(uflpaNotice(clear, null, NOW)!.line, "No link found · not a clearance · read date not stored");
    assert.equal(uflpaNotice(null, READ, NOW), null, "an unread check claims nothing");
    assert.equal(uflpaNotice({ ...clear, total: 0 }, READ, NOW), null, "nothing published to check claims nothing");
  });

  it("in the filters sheet says whose result it is; with nothing saved, only that the list was read", () => {
    assert.deepEqual(uflpaSheetNotice(clear, READ, NOW), { line: "UFLPA list, your saved suppliers: No link found · not a clearance · read 1 Oct", hit: false });
    assert.deepEqual(uflpaSheetNotice({ ...clear, hits: 1 }, READ, NOW), { line: "UFLPA list, your saved suppliers: 1 on the list · read 1 Oct", hit: true });
    assert.deepEqual(uflpaSheetNotice(null, READ, NOW), { line: "UFLPA list read 1 Oct", hit: false });
    assert.deepEqual(uflpaSheetNotice({ ...clear, total: 0 }, READ, NOW), { line: "UFLPA list read 1 Oct", hit: false });
    assert.equal(uflpaSheetNotice(null, null, NOW), null, "neither read: nothing is said, never 'not read yet'");
  });

  it("Alerts' rows say the scheme, the day and how far off it is; with nothing to say the phone block is not drawn", () => {
    const g = expiryGroups(EXPIRED, EXPIRING, NOW);
    assert.equal(phoneWhen(g.expired[0]!, NOW), "WRAP expired 29 Sep · 5 days ago");
    assert.equal(phoneWhen(g.within30[0]!, NOW), "GOTS ends 8 Oct · in 4 days");
    const none = expiryGroups(list([]), list([]), NOW);
    assert.equal(render(createElement(ExpiryPhone, { groups: none, show: "all", uflpa: null, today: NOW })), "");
    const out = html(createElement(ExpiryPhone, { groups: g, show: "all", uflpa: uflpaNotice(clear, READ, NOW), today: NOW }));
    assert.match(out, /^<div class="[^"]*\bmd:hidden\b/, "a phone's block: nothing of it from 768");
    assert.match(text(out), /UFLPA Entity List No link found · not a clearance · read 1 Oct Certificates 4 Expired first Expired 2 of 4 /);
    assert.equal(out.match(/>Ask for it</g)?.length, 4, "one ask per certificate");
    assert.equal(out.match(/href="\/app\/rfqs\/new\?supplier=/g)?.length, 4, "each through the RFQ, the one channel a supplier answers on");
  });
});

describe("a certificate its body no longer lists (spec-etl-freshness S2)", () => {
  const delisted: CertRead = { ...cert(S(4), "Tex Town Ltd.", "gots", "GOTS-27401", "2026-11-19"), listing_status: "no_longer_listed", delisted_on: "2026-10-03" };
  const oeko: CertRead = { ...cert(S(6), "Label Co", "oeko_tex", "37940-100", ""), expires_on: null as unknown as string, listing_status: "no_longer_listed", delisted_on: "2026-10-03" };

  it("sits with the expired, says since when, and is not listed again as expiring", () => {
    const g = expiryGroups(list([delisted, oeko]), EXPIRING, NOW);
    assert.deepEqual(g.expired.map((c) => c.when), ["No longer listed by GOTS since 3 Oct 2026", "No longer listed by OEKO-TEX since 3 Oct 2026"]);
    assert.equal(g.expired[0]!.askLabel, "Ask for the new certificate");
    assert.ok(!g.within90.some((c) => c.number === "GOTS-27401"), "the same certificate is one problem, not two");
  });

  it("the one count counts it once and says it is no longer listed", () => {
    const a = attentionOf(list([delisted, oeko]), EXPIRING, NOW, 10)!;
    assert.equal(a.total, 3, "2 delisted + 2 expiring, one of them the same certificate");
    assert.equal(a.rows[0]!.what, "GOTS-27401 is no longer listed by GOTS since 3 Oct 2026.");
    assert.equal(a.rows[0]!.state, "expired");
    assert.equal(a.rows[1]!.what, "OEKO-TEX 37940-100 is no longer listed by OEKO-TEX since 3 Oct 2026.");
  });
});
describe("the phone (Paper page 36)", () => {
  // `sanctions_lists_read()` as 0120 returns it: the day each list was last read in full.
  const LISTS = [
    { list: "uflpa", entries_listed: 253, last_read: "2026-10-01T03:10:00+00:00" },
    { list: "ofac_sdn", entries_listed: 9799, last_read: "2026-09-30T02:00:00+00:00" },
    { list: "uk_ofsi", entries_listed: 4100, last_read: "2026-10-02T02:00:00+00:00" },
    { list: "eu_sanctions", entries_listed: 5200, last_read: "2026-10-03T02:00:00+00:00" },
  ];
  const UFLPA_READ = LISTS[0]!;
  const clear = { total: 10, hits: 0, flags: 0, clear: 10, rows: [] };
  const msa = { total_saved: 11, total_published: 10, rsc_covered: 4, expiring_certs_90d: 2, sanctions_hits: 0 };

  it("days drop this year's year; the UFLPA row's read date is the list's own, and none found is never a clearance", () => {
    assert.equal(shortDay("2026-10-08T03:00:00Z", NOW), "8 Oct");
    assert.equal(shortDay("2025-12-30", NOW), "30 Dec 2025");
    assert.deepEqual(uflpaLedger(clear, UFLPA_READ, NOW), { value: "No link found", sub: "Not a clearance · list read 1 Oct", tone: null });
    assert.deepEqual(uflpaLedger(clear, null, NOW), { value: "No link found", sub: "Not a clearance", tone: null }, "an unread date is left out, never guessed");
    assert.equal(uflpaLedger({ ...clear, hits: 1 }, UFLPA_READ, NOW).tone, "danger");
    assert.equal(uflpaLedger(null, UFLPA_READ, NOW).value, "Did not load");
    assert.equal(uflpaSourceLine(UFLPA_READ, NOW), "UFLPA Entity List, US DHS · 253 entries · read 1 Oct");
    assert.equal(uflpaMore([{ status: "clear" }, { status: "clear" }]), "2 more, all no link found");
    assert.equal(uflpaMore([{ status: "region_flag" }]), "1 more");
  });

  it("sanctions name the span of the three daily lists' reads; certificates say how many expired of how many", () => {
    assert.deepEqual(sanctionsLedger(msa, LISTS, NOW), { value: "None of 10 listed", sub: "UK, EU, US lists · read 30 Sep – 3 Oct", tone: null });
    assert.equal(sanctionsLedger(msa, LISTS.filter((l) => l.list !== "uk_ofsi"), NOW).sub, "UK, EU, US lists", "a list never read leaves no span");
    assert.equal(sanctionsLedger({ ...msa, sanctions_hits: 2 }, LISTS, NOW).value, "2 of 10 listed");
    assert.equal(sanctionsLedger({ ...msa, sanctions_hits: undefined }, LISTS, NOW).value, "Did not load");
    assert.deepEqual(certLedger(EXPIRED, EXPIRING, NOW), { value: "2 of 4 expired", sub: "2 more end, the first 8 Oct", tone: "danger" });
    assert.deepEqual(certLedger(list([]), EXPIRING, NOW), { value: "2 end within 90 days", sub: "Mondol Intimates Ltd. GOTS, 8 Oct", tone: "caution" });
    assert.equal(certLedger(null, null, NOW).value, "Did not load");
  });

  it("what needs a look: the newest expired certificate, the UFLPA read, the statement", () => {
    const looks = hubLooks({ expired: EXPIRED, expiring: EXPIRING, uflpa: clear, uflpaRead: UFLPA_READ, msa }, NOW);
    assert.deepEqual(looks.map((l) => l.key), ["certs", "uflpa", "msa"]);
    assert.equal(looks[0]!.title, "Ask Aboni Knitwear Ltd for its new WRAP certificate");
    assert.equal(looks[0]!.body, "Its WRAP ended 29 Sep. 3 more are on the certificate list.");
    assert.equal(looks[1]!.head, "UFLPA · read 1 Oct, 3 days ago");
    assert.equal(looks[1]!.title, "Entries added to the US list since 1 Oct are not checked yet");
    assert.equal(hubLooks({ expired: null, expiring: null, uflpa: { ...clear, hits: 1 }, uflpaRead: null, msa: null }, NOW)[0]!.title, "1 saved supplier is on the UFLPA Entity List");
  });

  it("/app/compliance on a phone: the four checks with their read dates, and the cards", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: { data: msa, error: null }, sanctions_lists_read: { data: LISTS, error: null } });
    const t = text(await page("app/(app)/app/compliance/page.js"));
    assert.match(t, /Your 11 saved suppliers, checked four ways\. Needs action · expired certificates/);
    assert.match(t, /Status 4 checks Certificates 2 of 4 expired 2 more end, the first 8 Oct UFLPA No link found Not a clearance · list read 1 Oct Sanctions None of 10 listed UK, EU, US lists · read 30 Sep – 3 Oct Statement Ready to draft Built from your 10 suppliers/);
    assert.match(t, /Needs a look 3 Certificates · newest expiry 29 Sep/);
    assert.doesNotMatch(t, /not read yet/i);
  });

  it("/app/compliance on a phone without the lists' dates says no date, never 'not read'", async () => {
    given({ ...ROWS, compliance_uflpa_tracker: UFL, compliance_msa_inputs: { data: msa, error: null } });
    const t = text(await page("app/(app)/app/compliance/page.js"));
    assert.match(t, /UFLPA No link found Not a clearance Sanctions None of 10 listed UK, EU, US lists Statement/);
    assert.doesNotMatch(t, /not read/i);
  });

  it("/app/compliance/uflpa on a phone: the way back, the list's read date and size, every supplier with its result", async () => {
    const rows = Array.from({ length: 6 }, (_, i): UflpaRow => ({ supplier_id: `s${i}`, supplier_slug: `slug-${i}`, company_name: `Supplier ${i} Ltd.`, entity_type: "factory", city: "Dhaka", district: "Dhaka", country: "Bangladesh", parent_group_name: null, uflpa_hits: [], status: "clear" }));
    given({ compliance_uflpa_tracker: { data: { total: 6, hits: 0, flags: 0, clear: 6, rows }, error: null }, sanctions_lists_read: { data: LISTS, error: null } });
    const out = await page("app/(app)/app/compliance/uflpa/page.js");
    assert.match(out, /data-detail=""/);
    assert.match(out, /href="\/app\/compliance"[^>]*aria-label="Back to Compliance"|aria-label="Back to Compliance"[^>]*href="\/app\/compliance"/);
    assert.match(text(out), /6 saved suppliers against the US forced-labour list/);
    assert.match(text(out), /Read 1 Oct\. Entries added since are not checked\./);
    assert.match(text(out), /Suppliers 6 A to Z/);
    // The order is said as the fact, never "worst" (founder, 13 Oct 2026; the home page's still shows this screen).
    assert.match(text(out), /Most serious first/);
    assert.doesNotMatch(text(out), /worst/i);
    assert.match(text(out), /2 more, all no link found/);
    assert.match(text(out), /UFLPA Entity List, US DHS · 253 entries · read 1 Oct/);
    assert.equal(out.match(/href="\/app\/suppliers\/slug-\d"/g)?.length, 12, "every supplier once on a phone and once from 768");
    const bare = html(createElement(UflpaPhone, { uflpa: null, read: null, today: NOW }));
    assert.match(text(bare), /Entries added since our last read are not checked\. .*We couldn't load the UFLPA checks\./);
  });

  it("/app/compliance/uflpa, the line a buyer reads: no link found is not a clearance, dated by the list's own read, never 'not read yet'", async () => {
    const rows = [{ supplier_id: "s0", supplier_slug: "aboni", company_name: "Aboni Knitwear Ltd.", entity_type: "factory", city: "Dhaka", district: "Dhaka", country: "Bangladesh", parent_group_name: null, uflpa_hits: [], status: "clear" }];
    const tracker = { data: { total: 1, hits: 0, flags: 0, clear: 1, rows }, error: null };
    // Production on 11 Oct 2026: the list read on 8 Oct, 253 entries, no saved supplier on it.
    given({ compliance_uflpa_tracker: tracker, sanctions_lists_read: { data: [{ list: "uflpa", entries_listed: 253, last_read: "2026-10-08T03:10:00+00:00" }], error: null } });
    const read = text(await page("app/(app)/app/compliance/uflpa/page.js"));
    assert.ok(rpcCalls.includes("sanctions_lists_read"), "the date is read, not written into the page");
    assert.match(read, /Read 8 Oct\. Entries added since are not checked\./);
    assert.match(read, /No link found Not a clearance; keep your due diligence 1 /);
    assert.match(read, /UFLPA Entity List, US DHS · 253 entries · read 8 Oct/);
    assert.doesNotMatch(read, /not read yet|is not read/i);
    // The read dates not answering leaves the date out; it never turns into "not read".
    given({ compliance_uflpa_tracker: tracker });
    const undated = text(await page("app/(app)/app/compliance/uflpa/page.js"));
    assert.match(undated, /Entries added since our last read are not checked\./);
    assert.match(undated, /No link found Not a clearance; keep your due diligence 1 /);
    assert.match(undated, /UFLPA Entity List, US DHS (?!·)/);
    assert.doesNotMatch(undated, /Read \d+ [A-Z][a-z]{2}\.|· read |not read yet|is not read/i);
  });
});
