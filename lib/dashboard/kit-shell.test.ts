// Every /app page draws exactly one shell, and since 27 Sep 2026 the buyer
// layout draws it: `app/(app)/app/layout.tsx` renders `AppShell` once around
// every /app page, and no page file renders it again (or the page gets two
// sidebars, two skip links and a `<main>` inside a `<main>`). The older
// shell's layout wraps only the supplier portal and admin
// (`app/(app)/(old-shell)`), so it draws nothing around these. This walks the
// real page files, so a page that grows an `AppShell` of its own fails here.
//
// What this does NOT prove, and where that is proved: that a page fills the
// content region the layout hands it, and that no layout above an /app page
// draws or reads for the older shell, are asserted by rendering in
// `app/(app)/app/record-routes.test.ts`.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.join(process.cwd(), "app", "(app)", "app");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

/** `app/(app)/app/suppliers/[slug]/page.tsx` → `/app/suppliers/x`. */
function routeOf(file: string): string {
  const segments = path
    .relative(ROOT, path.dirname(file))
    .split(path.sep)
    .filter((s) => s !== "" && !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? "x" : s));
  return ["/app", ...segments].join("/");
}

describe("one shell per /app page, drawn by the buyer layout", () => {
  const all = pages(ROOT);

  it("the buyer layout draws the shell, once", () => {
    const layout = readFileSync(path.join(ROOT, "layout.tsx"), "utf8");
    assert.equal((layout.match(/<AppShell\b/g) ?? []).length, 1, "the layout draws the shell exactly once");
  });

  it("finds the buyer pages, including the search, the record and the line page", () => {
    const routes = all.map(routeOf);
    for (const route of ["/app/discover", "/app/suppliers/x", "/app/suppliers/x/lines/x"]) {
      assert.ok(routes.includes(route), `${route} is a page: ${routes.join(", ")}`);
    }
    assert.ok(all.length >= 20, "the /app pages were not found");
  });

  for (const file of all) {
    const route = routeOf(file);
    it(`${route} — draws no shell of its own`, () => {
      assert.doesNotMatch(readFileSync(file, "utf8"), /<AppShell\b/, "a second shell inside the layout's");
    });
  }
});
