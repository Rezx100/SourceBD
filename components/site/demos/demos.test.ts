// The marketing demos (M2, handoff-mercury-m2-m3.md): every company a demo names is in the snapshot's own rows, every
// demo dates what it shows, every stage draws its pause button and its last step on the server, and the snapshot
// carries no contact field.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { displayName } from "@/lib/dashboard/facts";
import { PII_KEYS } from "@/lib/discover-v32-rpc";
import { CAPTION, READ_AT, SANCTIONED_SAMPLE, SNAPSHOT, snapshotNames } from "@/lib/marketing/demo-snapshot";

/* eslint-disable @typescript-eslint/no-require-imports -- loaded after the test build exists. */
const search = require("@/components/site/demos/search") as typeof import("@/components/site/demos/search");
const record = require("@/components/site/demos/record") as typeof import("@/components/site/demos/record");
const rfq = require("@/components/site/demos/rfq") as typeof import("@/components/site/demos/rfq");
const compliance = require("@/components/site/demos/compliance") as typeof import("@/components/site/demos/compliance");
const claim = require("@/components/site/demos/claim") as typeof import("@/components/site/demos/claim");
const vignettes = require("@/components/site/demos/vignettes") as typeof import("@/components/site/demos/vignettes");
/* eslint-enable @typescript-eslint/no-require-imports */

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (C: ComponentType<{ className?: string }>) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(C))));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const DEMOS: { name: string; C: ComponentType<{ className?: string }>; names: readonly string[] }[] = [
  { name: "Find", C: search.DemoSearch, names: search.NAMES },
  { name: "Check", C: record.DemoRecord, names: record.NAMES },
  { name: "Ask", C: rfq.DemoRfq, names: rfq.NAMES },
  { name: "Watch", C: compliance.DemoCompliance, names: compliance.NAMES },
  { name: "Claim", C: claim.DemoClaim, names: claim.NAMES },
  ...vignettes.VIGNETTES.map((v) => ({ name: `vignette ${v.key}`, C: v.Demo as ComponentType<{ className?: string }>, names: v.names })),
];

describe("the demo snapshot", () => {
  it("was read on a day, holds rows and records, and carries no contact field", () => {
    assert.match(SNAPSHOT.readAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(READ_AT, /^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    assert.ok(SNAPSHOT.search.rows.length >= 5);
    assert.ok(SNAPSHOT.saved.length >= 5);
    assert.ok(SNAPSHOT.check.certs.length >= 1);
    const body = readFileSync(join(process.cwd(), "lib/marketing/demo-snapshot.json"), "utf8");
    for (const k of PII_KEYS) assert.ok(!body.includes(`"${k}"`), k);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(body), "no email address");
  });
});

describe("the demos", () => {
  const allowed = new Set([...snapshotNames(), SANCTIONED_SAMPLE]);

  for (const d of DEMOS) {
    it(`${d.name}: names only companies the snapshot holds, dates what it shows, and plays with a pause button from its last step`, () => {
      assert.ok(d.names.length > 0, "a demo names at least one company");
      for (const n of d.names) assert.ok(allowed.has(n), `${n} is not in the snapshot`);
      const out = draw(d.C);
      const t = text(out);
      assert.ok(d.names.some((n) => t.includes(n)), "a named company is drawn on the last step");
      assert.ok(t.includes(CAPTION), `the caption "${CAPTION}"`);
      assert.match(out, /<button type="button" aria-label="Pause demo" aria-pressed="false"/);
      assert.match(out, /<figcaption class="sr-only">[^<]{20,}<\/figcaption>/, "one sentence for a screen reader");
      assert.match(out, /data-ground="day"/, "the product stays light on any ground");
      assert.doesNotMatch(t, /undefined|NaN|\[object/);
    });
  }

  it("Find ends on the rows the search found, with the hovered record among them", () => {
    const t = text(draw(search.DemoSearch));
    for (const r of SNAPSHOT.search.rows) assert.ok(t.includes(displayName(r.name).split(" ")[0]!), r.name);
    assert.match(t, /knit GOTS/);
  });

  it("Check ends on the Certificates section with every certificate's register and read day", () => {
    const t = text(draw(record.DemoRecord));
    assert.match(t, /Certificate State Valid until/);
    assert.match(t, /read \d{1,2} [A-Z][a-z]{2} \d{4}/);
    if (SNAPSHOT.check.certs.some((c) => c.expiresOn && c.expiresOn < SNAPSHOT.readAt)) assert.match(t, /No longer current · not counted above/);
  });

  it("Ask labels the RFQ and every quote as examples; Watch says the UFLPA list's own entry count", () => {
    const ask = text(draw(rfq.DemoRfq));
    assert.match(ask, /Example quotes/);
    assert.match(ask, /every figure is an example/);
    const watch = text(draw(compliance.DemoCompliance));
    assert.match(watch, /Expired · \d+ certificates?|Expires within 30 days · \d+ certificates?|Expires in 31–90 days/);
  });

  it("Claim says how a claim is approved, offers no product editing, and ends on Claimed", () => {
    const t = text(draw(claim.DemoClaim));
    assert.ok(t.includes(claim.APPROVAL));
    assert.doesNotMatch(t, /add products|an admin checks/i);
    assert.match(t, /Claimed/);
  });

  it("the sanctioned vignette names the placeholder only, and the last step is the refusal", () => {
    const t = text(draw(vignettes.VignetteSanction));
    assert.match(t, /Example Apparel Ltd/);
    assert.match(t, /You can't send this supplier an RFQ\./);
    for (const n of snapshotNames()) assert.ok(!t.includes(n), `${n} is never shown sanctioned`);
  });
});
