// The admin and supplier frame (B10a): its own menu by URL, the current item marked, counts that are words and never
// a guess, no search box, and the skip link, sign-out and page body every portal page relies on.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let currentPath = "/admin";
{
  // The client hooks need a mounted App Router; only they are replaced.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = {
    id: navId,
    filename: navId,
    loaded: true,
    children: [],
    paths: [],
    exports: { ...realNav, useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }), usePathname: () => currentPath },
  } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PortalFrame } = require("@/components/frame/portal") as typeof import("@/components/frame/portal");

const account = { initial: "AK", name: "Ana Karim", email: "ana@example.invalid" };
const frame = (at: string, badges: object = {}, acct: typeof account | null = account) => {
  currentPath = at;
  return renderToStaticMarkup(createElement(PortalFrame, { account: acct, badges } as Parameters<typeof PortalFrame>[0], createElement("p", null, "PAGE-BODY")));
};
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the portal frame", () => {
  it("draws the admin menu under /admin, with the current page marked and the body inside", () => {
    const m = frame("/admin/queue");
    assert.match(m, /PAGE-BODY/);
    for (const label of ["Overview", "Review queue", "Supplier claim review", "Sanctions screening", "Audit log", "Users and access"]) assert.match(text(m), new RegExp(label), label);
    assert.match(m, /href="\/admin\/queue"[^>]*>|aria-current="page"[^>]*href="\/admin\/queue"/);
    assert.equal((m.match(/aria-current="page"/g) ?? []).length >= 1, true);
    assert.doesNotMatch(text(m), /RFQs received/);
  });

  it("draws the supplier menu under /supplier, and no Settings entry that would redirect away", () => {
    const m = frame("/supplier/rfqs/7");
    for (const label of ["Dashboard", "Company profile", "Messages", "RFQs received", "Partners", "Documents"]) assert.match(text(m), new RegExp(label), label);
    assert.doesNotMatch(m, /href="\/app\/settings"/);
    assert.doesNotMatch(text(m), /Review queue/);
  });

  it("counts are shown as words to a screen reader and as nothing when they were not read", () => {
    const m = frame("/admin", { adminQueue: 12, adminClaims: 0, adminCerts: null });
    assert.match(m, /12 waiting/);
    assert.doesNotMatch(m, /0 waiting|null waiting/);
  });

  it("has no search box, a skip link, a sign-out form and the account's name", () => {
    const m = frame("/admin");
    assert.doesNotMatch(m, /type="search"|role="search"/);
    assert.match(m, /href="#main-content"/);
    assert.match(m, /action="\/auth\/sign-out"/);
    assert.match(m, /aria-label="Account: Ana Karim"/);
    assert.match(m, /id="main-content"/);
  });

  it("an unread sign-in still draws the frame", () => {
    const m = frame("/supplier", {}, null);
    assert.match(m, /PAGE-BODY/);
    assert.match(m, /aria-label="Account: Your account"/);
  });
});
