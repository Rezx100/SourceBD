// Pricing (B9d): no price, two plans, the data-location answer is the real one, and Enterprise lists only what exists.

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
const { Pricing, pricingMetadata } = require("@/components/site/pricing") as typeof import("@/components/site/pricing");

const page = (facts = parseFacts({ suppliers_indexed: 10268 }, null)) => draw(createElement(Pricing, { facts }));

describe("the pricing page", () => {
  it("says it is free, shows no price, and has two plans", () => {
    const t = text(page());
    assert.match(t, /Free during beta\./);
    assert.match(t, /No prices yet/);
    // One action in the hero (critique 22 Oct, S8) and no date of its own (S12).
    assert.doesNotMatch(page(), /<form[^>]*action="\/discover"/);
    assert.doesNotMatch(t, /updated \d{1,2} [A-Z][a-z]{2} \d{4}/);
    assert.doesNotMatch(t, /[$£€]\s?\d|per month|\/mo\b/i);
    assert.equal((page().match(/<article/g) ?? []).length, 2);
    // The plans follow the hero at once, on the product window's surface (critique 22 Oct).
    assert.match(page(), /<section [^>]*class="pt-10 md:pt-24 pb-10 md:pb-16"/, "the hero's own padding gives way to the page's");
    assert.match(page(), /<section aria-labelledby="plans">/, "no band of its own: the compare's padding is the one gap");
    assert.equal((page().match(/<article class="[^"]*border-line-strong[^"]*shadow-sm/g) ?? []).length, 2);
  });

  it("says where the data is stored as it is: AWS us-west-1, never Singapore", () => {
    const t = text(page());
    assert.match(t, /AWS region us-west-1, in the United States/);
    assert.doesNotMatch(t, /Singapore/i);
  });

  it("lists only what exists: no SSO or audit log; the shipped statement and evidence pack are listed", () => {
    assert.doesNotMatch(text(page()), /\bSSO\b|single sign-on|audit log/i);
    assert.match(text(page()), /Modern slavery statement draft/);
    assert.match(text(page()), /Evidence pack/);
  });

  it("the count is printed when read and left out when not", () => {
    assert.match(text(page()), /Search 10,268 suppliers with filters/);
    const none = text(page(NO_FACTS));
    assert.doesNotMatch(none, /\d,\d{3} suppliers/);
    assert.match(none, /Search suppliers with filters/);
  });

  it("is indexable with a canonical address", () => {
    const m = pricingMetadata();
    assert.deepEqual(m.robots, { index: true, follow: true });
    assert.match(String(m.alternates?.canonical), /\/pricing$/);
  });
});
