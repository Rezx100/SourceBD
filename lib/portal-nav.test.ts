// The portals' menu (B10a): every item the old shell listed is still here (the supplier's broken Settings link
// excepted), every item points at a page that exists, and the URL decides the current item and the title.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { PORTAL_HOME, PORTAL_NAV, portalMatch, portalOf, portalTitle } from "@/lib/portal-nav";

/** The addresses the old shell's sidebar listed (deleted in B11a), kept here so the menu can never lose one by accident. */
const OLD_ADMIN = ["/admin", "/admin/beta", "/admin/queue", "/admin/suppliers", "/admin/feedback", "/admin/claims", "/admin/certifications", "/admin/sanctions", "/admin/sources", "/admin/evidence", "/admin/audit-log", "/admin/users"];
const OLD_SUPPLIER = ["/supplier", "/supplier/profile", "/supplier/messages", "/supplier/rfqs", "/supplier/partners", "/supplier/documents"];

const hrefs = (role: "admin" | "supplier") => PORTAL_NAV[role].flatMap((g) => g.items.map((i) => i.href));
const pageFor = (href: string) => join(process.cwd(), "app", "(app)", "(old-shell)", ...href.split("/").filter(Boolean), "page.tsx");

describe("the portal menu", () => {
  it("keeps every item the old admin sidebar listed", () => {
    assert.deepEqual(hrefs("admin").sort(), [...OLD_ADMIN].sort());
  });

  it("keeps every item the old supplier sidebar listed, except Settings, which a supplier is redirected away from", () => {
    assert.deepEqual(hrefs("supplier").sort(), [...OLD_SUPPLIER].sort());
  });

  it("every item points at a page that exists", () => {
    for (const role of ["admin", "supplier"] as const) for (const h of hrefs(role)) assert.ok(existsSync(pageFor(h)), h);
  });

  it("no item key or address repeats inside a portal", () => {
    for (const role of ["admin", "supplier"] as const) {
      const items = PORTAL_NAV[role].flatMap((g) => g.items);
      assert.equal(new Set(items.map((i) => i.key)).size, items.length);
      assert.equal(new Set(items.map((i) => i.href)).size, items.length);
    }
  });
});

describe("which item is current", () => {
  it("a path belongs to the portal it is under", () => {
    assert.equal(portalOf("/admin"), "admin");
    assert.equal(portalOf("/admin/users/1"), "admin");
    assert.equal(portalOf("/supplier/claim/abc"), "supplier");
    assert.equal(portalOf("/supplier"), "supplier");
  });

  it("the home pages match only themselves", () => {
    assert.deepEqual(portalMatch("admin", "/admin"), { key: "overview", exact: true });
    assert.deepEqual(portalMatch("admin", "/admin/queue"), { key: "queue", exact: true });
    assert.equal(portalMatch("admin", "/admin/nope").key, null);
    assert.deepEqual(portalMatch("supplier", PORTAL_HOME.supplier), { key: "home", exact: true });
  });

  it("a page under an item lights it as 'true', not 'page', and the longest address wins", () => {
    assert.deepEqual(portalMatch("admin", "/admin/users/7"), { key: "users", exact: false });
    assert.deepEqual(portalMatch("admin", "/admin/suppliers/import"), { key: "suppliers", exact: false });
    assert.deepEqual(portalMatch("supplier", "/supplier/messages/t1?x=1#y"), { key: "messages", exact: false });
    assert.deepEqual(portalMatch("supplier", "/supplier/profile/"), { key: "profile", exact: true });
  });

  it("the title is the item's name, and the claim pages say what they are", () => {
    assert.equal(portalTitle("admin", "/admin/audit-log/9"), "Audit log");
    assert.equal(portalTitle("supplier", "/supplier/rfqs"), "RFQs received");
    assert.equal(portalTitle("supplier", "/supplier/claim/verify"), "Claim your company");
    assert.equal(portalTitle("admin", "/admin/nope"), null);
  });
});
