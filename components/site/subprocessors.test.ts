// The Security page and the Privacy notice name the same sub-processors, from one list. A company added to one and
// not the other, or one Privacy still names by hand, fails here.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NO_FACTS } from "@/lib/site-facts";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const L = require("@/components/site/subprocessors") as typeof import("@/components/site/subprocessors");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const T = require("@/components/site/trust") as typeof import("@/components/site/trust");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the test build exists.
const Privacy = (require("@/app/(marketing)/legal/privacy/page") as { default: () => ReactElement }).default;

/** Section 5 of the notice, as plain text. */
const sharing = () => {
  const t = text(draw(createElement(Privacy)));
  const m = t.match(/5\. Sharing (.*?) 6\. International transfers/);
  assert.ok(m, "section 5 not found");
  return m[1]!;
};

describe("sub-processors: one list", () => {
  it("the Privacy notice's section 5 names exactly the companies the list holds, with what each does", () => {
    const s = sharing();
    for (const [n, w] of L.SUBPROCESSORS) assert.ok(s.includes(`${n} (${w})`), `${n} (${w}) is missing from section 5: ${s}`);
    assert.ok(s.includes(L.subprocessorSentence()));
  });

  it("the Security page prints the same names, in the same order", () => {
    const t = text(draw(createElement(T.Security, { facts: NO_FACTS })));
    let at = 0;
    for (const [n, w] of L.SUBPROCESSORS) {
      const i = t.indexOf(`${n} · ${w}`, at);
      assert.ok(i >= at, `${n} · ${w} is missing or out of order on the Security page`);
      at = i;
    }
    assert.ok(t.includes(`${L.subprocessorCount()}, each named below`));
  });

  it("no company is named by hand on either page, and Stripe is not claimed while nothing is billed", () => {
    for (const f of ["components/site/trust.tsx", "app/(marketing)/legal/privacy/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      for (const [n] of L.SUBPROCESSORS) assert.ok(!src.includes(`"${n}"`) && !new RegExp(`\\b${n}\\s*\\(`).test(src), `${f} types ${n} by hand`);
    }
    assert.doesNotMatch(sharing(), /Stripe|our hosting providers/);
  });
});
