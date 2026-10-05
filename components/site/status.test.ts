// System status (B9f): figures are the read's own, a date's age is said in words, a missing date says so, and a failed
// read says what to do without printing the database's message.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const S = require("@/components/site/status") as typeof import("@/components/site/status");

const NOW = Date.parse("2026-10-05T12:00:00Z");
const DOC: import("@/components/site/status").StatusDoc = {
  published_suppliers: 10268,
  last_source_refresh: "2026-10-02T05:48:07Z",
  last_compliance_mirror: "2026-06-01T00:00:00Z",
  last_sanctions_screen: null,
  last_etl_success: "2026-09-20T00:00:00Z",
  etl_recent: [{ scraper_code: "rsc_weekly", finished_at: "2026-10-02T05:00:00Z", status: "ok" }],
  generated_at: "2026-10-05T11:59:00Z",
};
const view = (doc: typeof DOC | null, error: string | null) => draw(createElement(S.StatusView, { doc, error, now: NOW }));

describe("the status page", () => {
  it("prints the read's figures and dates in words", () => {
    const t = text(view(DOC, null));
    assert.match(t, /10,268 published suppliers/);
    assert.match(t, /2 Oct 2026 latest register read/);
    assert.match(t, /rsc_weekly/);
    assert.match(t, /as of 5 Oct 2026/);
  });

  it("says how old a date is in words, and says so when there is no date", () => {
    const t = text(view(DOC, null));
    assert.match(t, /1 Jun 2026 · over 90 days ago/);
    assert.match(t, /20 Sep 2026 · over 7 days ago/);
    assert.match(t, /No date on file/);
    assert.doesNotMatch(t, /2 Oct 2026 · over/);
  });

  it("age() has the four bands", () => {
    assert.equal(S.age("2026-10-04T00:00:00Z", NOW), null);
    assert.equal(S.age("2026-09-20T00:00:00Z", NOW), "over 7 days ago");
    assert.equal(S.age("2026-08-20T00:00:00Z", NOW), "over 30 days ago");
    assert.equal(S.age("2026-05-01T00:00:00Z", NOW), "over 90 days ago");
    assert.equal(S.age(null, NOW), null);
  });

  it("a failed read says what to do and never prints the database's message", () => {
    const t = text(view(null, "relation public_status does not exist"));
    assert.match(t, /We could not load the status just now/);
    assert.match(t, /support@sourcebd\.net/);
    assert.doesNotMatch(t, /relation|public_status/);
  });

  it("carries no score, uptime percentage or invented figure", () => {
    assert.doesNotMatch(text(view(DOC, null)), /\d+(\.\d+)?\s?%|uptime|score/i);
  });
});
