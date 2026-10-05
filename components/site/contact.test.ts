// The Contact sales page: what we can cover, the form's fields, a honeypot a person never reaches, and no promise of a reply time.

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
const { Contact } = require("@/components/site/contact") as typeof import("@/components/site/contact");

describe("the Contact sales page", () => {
  const html = draw(createElement(Contact));
  const t = text(html);

  it("says what we can cover and where the message goes", () => {
    assert.match(t, /Talk to us\./);
    assert.match(t, /Your message goes to the founder by email/);
    for (const s of ["A walk through search and records", "Your compliance checks", "Enterprise terms"]) assert.match(t, new RegExp(s));
    assert.match(t, /Write to sales@sourcebd\.net/);
  });

  it("has the fields Paper draws, each named for the form", () => {
    for (const n of ["name", "email", "company", "role", "markets", "pieces", "message"]) assert.match(html, new RegExp(`name="${n}"`), n);
    assert.equal((html.match(/name="markets"/g) ?? []).length, 5);
    assert.match(t, /Send to the founder/);
  });

  it("the honeypot is out of the tab order and hidden from a screen reader", () => {
    const at = html.indexOf('name="website"');
    assert.ok(at > 0, "no honeypot field");
    const around = html.slice(Math.max(0, at - 300), at + 120);
    assert.match(around, /aria-hidden="true"/, around);
    assert.match(around, /tabindex="-1"/, around);
  });

  it("promises no reply time and no table of leads", () => {
    assert.doesNotMatch(t, /within \d+|24 hours|same day|CRM/i);
  });
});
