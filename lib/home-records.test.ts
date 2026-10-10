// The home page's record facts (lib/home-records.ts) against answers shaped like production's anon
// `buyer_supplier_profile` read of 10 Oct 2026: each fact carries its source and read date, a fact the record does not
// hold is left out, a failed read draws nothing, and no contact field ever reaches the page.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const R = require("@/lib/home-records") as typeof import("@/lib/home-records");

const TODAY = new Date("2026-10-10T12:00:00Z");

/** Aboni Knitwear Ltd as the anon read returned it on 10 Oct 2026 (trimmed to what the page reads), plus contact fields a careless read might carry. */
const ABONI = {
  supplier: { company_name: "ABONI KNITWEAR LTD.", entity_type: "factory", district: "Dhaka", employees_total: 3314, email_primary: "md@aboni.example", phones: ["+8801700000000"], contact_name: "A Person", contact_role: "MD" },
  t13_source_count: 8,
  provenance: [
    { source_code: "EPB", last_seen_at: "2026-08-14T21:58:33Z" },
    { source_code: "RSC", last_seen_at: "2026-10-02T05:17:35Z" },
    { source_code: "BGAPMEA", last_seen_at: "2026-06-26T23:24:31Z" },
    { source_code: "BGMEA", last_seen_at: "2026-10-09T00:10:16Z" },
    { source_code: "BKMEA", last_seen_at: "2026-08-02T04:24:53Z" },
    { source_code: "GOTS", last_seen_at: "2026-06-26T22:57:00Z" },
    { source_code: "GOTS", last_seen_at: "2026-06-26T22:56:55Z" },
    { source_code: "OEKO_TEX", last_seen_at: "2026-10-08T04:36:35Z" },
    { source_code: "WRAP", last_seen_at: "2026-10-08T04:36:43Z" },
    { source_code: "BRAND_ASOS", last_seen_at: "2026-10-06T11:38:43Z" },
  ],
  certifications: [
    { kind: "gots", certificate_no: "GOTS-31587", expires_on: "2027-05-12", issuer: "TÜV Rheinland (China) Ltd." },
    { kind: "gots", certificate_no: "GOTS-27605", expires_on: "2026-04-04", issuer: "GSCS International Ltd." },
    { kind: "oeko_tex", certificate_no: "32597-100", expires_on: null, issuer: "OEKO-TEX" },
    { kind: "wrap", certificate_no: "7865", expires_on: "2027-08-25", issuer: "WRAP" },
  ],
  rsc_remediation: [
    { fetched_at: "2026-07-30T22:13:36Z", progress_pct: 100, workers_count: 2662 },
    { fetched_at: "2026-07-30T22:13:40Z", progress_pct: 100, workers_count: 504 },
  ],
  pills: [
    { label: "BGMEA General member #", value: "3498", source_code: "BGMEA" },
    { label: "EPB Reg #", value: "BD04293", source_code: "EPB" },
  ],
};

describe("the home page's record facts", () => {
  it("draws a card with its name as the app shows it, the meta line, the marks it may draw and two dated facts", () => {
    const card = R.recordFrom(ABONI, "aboni-knitwear", [{ kind: "cert", cert: "wrap" }, { kind: "member", source: "BGMEA" }], TODAY)!;
    assert.equal(card.name, "Aboni Knitwear Ltd");
    assert.equal(card.meta, "Factory · Dhaka · 3,314 workers filed · 8 sources");
    assert.deepEqual(card.marks, ["EPB", "RSC", "BGMEA", "BKMEA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"]);
    assert.deepEqual(card.facts, [
      { icon: "rosette", title: "WRAP 7865 · valid to 25 Aug 2027", sub: "WRAP register · read 8 Oct 2026" },
      { icon: "ledger", title: "BGMEA general member 3498", sub: "BGMEA member register · read 9 Oct 2026" },
    ]);
  });

  it("the callouts: the lapsed certificate in caution, the valid GOTS, the WRAP, each with issuer and read date", () => {
    const facts = R.recordFrom(ABONI, "aboni-knitwear", R.CALLOUTS, TODAY)!.facts;
    assert.deepEqual(
      facts.map((f) => [f.title, f.sub, f.tone ?? ""]),
      [
        ["GOTS-27605 · expired 4 Apr 2026", "GSCS International Ltd. · GOTS database · read 26 Jun 2026", "caution"],
        ["GOTS-31587 · valid to 12 May 2027", "TÜV Rheinland (China) Ltd. · GOTS database · read 26 Jun 2026", ""],
        ["WRAP 7865 · valid to 25 Aug 2027", "WRAP register · read 8 Oct 2026", ""],
      ],
    );
  });

  it("RSC is the building with the most workers, with its progress and the day it was read", () => {
    const f = R.factFrom({ ...ABONI, rsc_remediation: [{ fetched_at: "2026-09-18T05:32:56Z", progress_pct: 73, workers_count: 235, building_name: "LIBERTY KNITWEAR LTD. (Extension)" }, { fetched_at: "2026-09-11T05:34:10Z", progress_pct: "100.00", workers_count: 10748, building_name: "Liberty Knitwear Ltd. Unit-2" }] }, { kind: "rsc" }, TODAY);
    assert.deepEqual(f, { icon: "shield", title: "RSC · 100% of findings fixed", sub: "Liberty Knitwear Ltd. Unit-2 · RMG Sustainability Council · read 11 Sep 2026" });
  });

  it("a fact the record does not hold with a source and a date is left out, never filled", () => {
    const bare = { ...ABONI, provenance: [], rsc_remediation: [], pills: [] };
    assert.deepEqual(R.recordFrom(bare, "aboni-knitwear", R.CALLOUTS, TODAY)!.facts, []);
    assert.equal(R.factFrom(ABONI, { kind: "epb" }, TODAY)?.title, "EPB exporter BD04293");
    assert.equal(R.factFrom({ ...ABONI, certifications: [] }, { kind: "cert", cert: "gots" }, TODAY), null);
    // A certificate that lapses tomorrow is still valid today; one that lapsed yesterday is not.
    const edge = { ...ABONI, certifications: [{ kind: "wrap", certificate_no: "1", expires_on: "2026-10-10", issuer: "WRAP" }] };
    assert.match(R.factFrom(edge, { kind: "cert", cert: "wrap" }, TODAY)!.title, /valid to 10 Oct 2026/);
    assert.equal(R.factFrom(edge, { kind: "cert", cert: "wrap" }, new Date("2026-10-11T00:00:00Z")), null);
  });

  it("a failed or empty read is no card at all", () => {
    for (const raw of [null, undefined, {}, { supplier: {} }, "error"]) assert.equal(R.recordFrom(raw, "x", [{ kind: "epb" }], TODAY), null);
  });

  it("no contact field reaches the page, even when the read carries one", () => {
    const out = JSON.stringify([R.recordFrom(ABONI, "aboni-knitwear", [...R.CALLOUTS, { kind: "rsc" }, { kind: "epb" }, { kind: "member", source: "BGMEA" }], TODAY)]);
    assert.doesNotMatch(out, /aboni\.example|\+880|A Person|"MD"|email|phone|contact/i);
  });

  it("the three cards are the boards' three records", () => {
    assert.deepEqual(R.CARDS.map((c) => c.slug), ["mondol-fabrics", "aboni-knitwear", "liberty-knitwear"]);
    assert.equal(R.CALLOUT_SLUG, "aboni-knitwear");
  });
});
