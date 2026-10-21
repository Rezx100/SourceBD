// The trust pages (B9e): the security answers are the true ones, the source table is drawn with figures only when
// they were read and agrees with the 21 sources the database lists, and the claim and About pages say what is so.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NO_FACTS, parseFacts } from "@/lib/site-facts";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const T = require("@/components/site/trust") as typeof import("@/components/site/trust");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const S = require("@/components/site/sources") as typeof import("@/components/site/sources");

const NOW = Date.parse("2026-10-05T00:00:00Z");
const READ = parseFacts(
  { suppliers_indexed: 10268, last_refreshed_at: "2026-10-02T05:48:07Z" },
  {
    sources_listed: 21,
    sources_with_records: 14,
    sources: [
      { code: "RSC", tier: "tier1_gov", records: 1714, suppliers: 1714, latest: "2026-10-02" },
      { code: "BGMEA", tier: "tier2_industry", records: 5722, suppliers: 5722, latest: "2026-06-27" },
      { code: "BRAND_PRIMARK", tier: "tier4_brand", records: 0, suppliers: 0, latest: null },
    ],
  },
);
const FACTS = parseFacts({ suppliers_indexed: 10268 }, null);
const security = () => draw(createElement(T.Security));
const method = (f = FACTS) => draw(createElement(T.Methodology, { facts: f, now: NOW }));
const suppliers = (f = FACTS) => draw(createElement(T.ForSuppliers, { facts: f }));
const about = (f = FACTS) => draw(createElement(T.About, { facts: f }));

describe("the security page", () => {
  it("says where the data is as it is, and claims no certificate or feature that does not exist", () => {
    const t = text(security());
    assert.match(t, /AWS region us-west-1, United States/);
    assert.doesNotMatch(t, /Singapore/i);
    assert.match(t, /No SOC 2 or ISO 27001 report/);
    assert.doesNotMatch(t, /SOC 2 (certified|compliant|type)|ISO 27001 (certified|compliant)/i);
    assert.doesNotMatch(t, /on for all \d+ tables/i);
  });

  it("names seven sub-processors", () => {
    const t = text(security());
    for (const n of ["Supabase", "Cloudflare", "Resend", "Sentry", "PostHog", "Bunny CDN", "Barikoi"]) assert.match(t, new RegExp(`${n} · `), n);
  });
});

describe("the methodology page", () => {
  it("lists exactly the 21 sources the database lists, by tier (BEPZA, DIFE, RJSC and Inditex are not read)", () => {
    const codes = S.TIERS.flatMap((t) => t.sources.map((s) => s.code)).sort();
    assert.equal(codes.length, 21);
    assert.equal(new Set(codes).size, 21);
    assert.deepEqual(S.TIERS.map((t) => t.sources.length), [2, 4, 4, 5, 6]);
    for (const unread of ["BEPZA", "DIFE", "RJSC", "BRAND_INDITEX"]) assert.ok(!codes.includes(unread), unread);
  });

  it("draws no figure or date when the sources were not read", () => {
    const t = text(method());
    assert.doesNotMatch(t, /Suppliers with a record|Last read|Listed, no records yet/);
    assert.match(t, /21 sources listed\. Read in order of trust\. No scores\./);
  });

  it("draws the figures that were read, and says so for a source with no records and a stale date", () => {
    const t = text(method(READ));
    assert.match(t, /21 sources listed · 14 hold supplier records/);
    assert.match(t, /1,714/);
    assert.match(t, /5,722/);
    assert.match(t, /27 Jun 2026 · over 90 days ago/);
    assert.doesNotMatch(t, /2 Oct 2026 · over 90 days ago/);
    assert.match(t, /Listed, no records yet/);
    assert.match(t, /Not read yet/);
  });

  // Data audit, 13 Oct 2026: the table said "Not read yet" of six lists every company page says were read.
  it("draws a sanctions list's entries and last full read, and says so when it was only read in part", () => {
    const facts = parseFacts(
      { suppliers_indexed: 10025 },
      { sources_listed: 21, sources_with_records: 14, sources: [
        { code: "OFAC", tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null },
        { code: "UFLPA", tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null },
        { code: "ILAB", tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null },
        { code: "RSC", tier: "tier1_gov", records: 1714, suppliers: 1714, latest: "2026-10-02" },
      ] },
      [
        { list: "ofac_sdn", entries_listed: 9990, last_read: "2026-10-08T22:58:01.519901+00:00" },
        { list: "uflpa", entries_listed: 253, last_read: null },
        { list: "a_list_we_do_not_show", entries_listed: 5, last_read: null },
      ],
    );
    const of = (code: string) => facts.sources!.find((s) => s.code === code)!;
    assert.deepEqual([of("OFAC").records, of("OFAC").latest], [9990, "2026-10-08"]);
    assert.deepEqual([of("UFLPA").records, of("UFLPA").latest], [253, null]);
    // A list the read did not return, and a supplier source, keep what `marketing_facts()` said.
    assert.deepEqual([of("ILAB").records, of("ILAB").latest], [0, null]);
    assert.deepEqual([of("RSC").records, of("RSC").suppliers], [1714, 1714]);
    assert.equal(facts.sources!.length, 4);
    const row = (name: string) => new RegExp(`<th scope="row"[^>]*>${name}[^]*?</tr>`).exec(method(facts))?.[0] ?? "";
    assert.match(text(row("SDN list")), /9,990 8 Oct 2026/);
    assert.match(text(row("UFLPA Entity List")), /253 Read in part, no full read yet/);
    assert.match(text(row("Goods made with child or forced labour")), /Listed, no records yet Not read yet/);
    // No read of the lists at all leaves the table as `marketing_facts()` drew it.
    assert.deepEqual(parseFacts(null, { sources: [{ code: "OFAC", tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null }] }).sources, [
      { code: "OFAC", tier: "tier5_regulatory", records: 0, suppliers: 0, latest: null },
    ]);
  });

  it("keeps the anchors the footer links to, and never says a score", () => {
    const m = method();
    for (const id of ["sources", "tiers", "matching", "corrections"]) assert.match(m, new RegExp(`id="${id}"`), id);
    assert.doesNotMatch(text(m), /\b(score of|rated|stars? rating)\b/i);
  });
});

describe("the supplier page", () => {
  it("opens the supplier sign-up and promises nothing the product does not do", () => {
    const m = suppliers();
    assert.match(m, /href="\/signup\?role=supplier"/);
    assert.match(text(m), /Editing your own products: in design, not in the product yet/);
    assert.doesNotMatch(text(m), /boost|rank higher than|promote your/i);
  });
});

describe("the About page", () => {
  it("holds the district counts, dated, and no 48", () => {
    const t = text(about());
    // Re-read by ops/about_district_counts.sql and dated with the day of the read (critique 22 Oct, S12).
    assert.match(t, new RegExp(`counted ${T.DISTRICTS_READ}`));
    assert.doesNotMatch(t, /3 Oct 2026/);
    assert.match(t, /35 more districts/);
    assert.doesNotMatch(t, /\b48 districts\b/);
    assert.doesNotMatch(about(), /font-mono/, "a figure that is not code is set in the sans (S14)");
  });

  it("says how often the registers are read and how to report a wrong fact, in the methodology page's words", () => {
    const t = text(about(parseFacts({ suppliers_indexed: 10268 }, { latest_read: "2026-10-19" })));
    assert.match(t, /RSC is read every week\. Every day we re-open a batch of source pages to check the fact is still there\./);
    assert.match(t, /The latest register read was 19 Oct 2026\./);
    assert.match(t, /Write to data@sourcebd\.net ?\. We read the source again\. The source wins\./);
    assert.doesNotMatch(text(about(NO_FACTS)), /latest register read/);
  });

  it("prints no supplier count when none was read", () => {
    assert.doesNotMatch(text(about(NO_FACTS)), /\d,\d{3} suppliers by name/);
  });
});

describe("the metadata", () => {
  it("each page has a canonical address on its own path", () => {
    for (const [meta, path] of [[T.SECURITY_META, "/security"], [T.METHOD_META, "/methodology"], [T.SUPPLIERS_META, "/suppliers"], [T.ABOUT_META, "/about"]] as const) {
      const m = T.trustMetadata(meta.path, meta.title, meta.description);
      assert.match(String(m.alternates?.canonical), new RegExp(`${path}$`));
    }
  });
});
