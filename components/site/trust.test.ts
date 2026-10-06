// The trust pages (B9e): the security answers are the true ones, the source table is drawn with figures only when
// they were read and agrees with the 25 sources the database holds, and the claim and About pages say what is so.

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
    sources_listed: 25,
    sources_with_records: 14,
    sources: [
      { code: "RSC", tier: "tier1_gov", records: 1714, suppliers: 1714, latest: "2026-10-02" },
      { code: "BGMEA", tier: "tier2_industry", records: 5722, suppliers: 5722, latest: "2026-06-27" },
      { code: "BEPZA", tier: "tier1_gov", records: 0, suppliers: 0, latest: null },
    ],
  },
);
const FACTS = parseFacts({ suppliers_indexed: 10268 }, null);
const security = (f = FACTS) => draw(createElement(T.Security, { facts: f }));
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
  it("lists exactly the 25 sources the database holds, by tier", () => {
    const codes = S.TIERS.flatMap((t) => t.sources.map((s) => s.code)).sort();
    assert.equal(codes.length, 25);
    assert.equal(new Set(codes).size, 25);
    assert.deepEqual(S.TIERS.map((t) => t.sources.length), [5, 4, 4, 6, 6]);
  });

  it("draws no figure or date when the sources were not read", () => {
    const t = text(method());
    assert.doesNotMatch(t, /Suppliers with a record|Last read|Listed, no records yet/);
    assert.match(t, /25 sources listed\. Read in order of trust\. No scores\./);
  });

  it("draws the figures that were read, and says so for a source with no records and a stale date", () => {
    const t = text(method(READ));
    assert.match(t, /25 sources listed · 14 hold supplier records/);
    assert.match(t, /1,714/);
    assert.match(t, /5,722/);
    assert.match(t, /27 Jun 2026 · over 90 days ago/);
    assert.doesNotMatch(t, /2 Oct 2026 · over 90 days ago/);
    assert.match(t, /Listed, no records yet/);
    assert.match(t, /Not read yet/);
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
    assert.match(t, /counted 3 Oct 2026/);
    assert.match(t, /43 more districts/);
    assert.doesNotMatch(t, /\b48 districts\b/);
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
