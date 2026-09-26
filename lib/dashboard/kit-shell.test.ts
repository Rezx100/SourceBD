// Every /app page draws exactly one shell. A page that renders the kit's
// `AppShell` must be skipped by the app layout's own shell (or the page gets two
// sidebars, two skip links and a `<main>` inside a `<main>`); every other page
// must not be (or it gets none). Cycle 4 found /app/suppliers/<slug> and its
// /lines/<hs> page drawing both, because the layout's list was not widened when
// they moved to `AppShell`. This walks the real page files, so a new kit page
// that is not added to `drawsKitShell` fails here.
//
// What this does NOT prove, and where that is proved: that every branch of a
// kit page draws `AppShell` (a file can mention it once and return bare
// elsewhere — the record's slow-read state did, cycle 5) is asserted per
// branch in `app/(app)/app/record-routes.test.ts`; that the layout uses this
// on every navigation, not only the first load, is `ShellSwitch`'s test in
// `components/dashboard/record-controls.test.ts`.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { drawsKitShell } from "./kit-shell";

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

describe("drawsKitShell — one shell per /app page", () => {
  const all = pages(ROOT);

  it("finds the kit's pages, including the record and line pages", () => {
    const kit = all.filter((f) => /<AppShell\b/.test(readFileSync(f, "utf8"))).map(routeOf);
    for (const route of ["/app/discover", "/app/suppliers/x", "/app/suppliers/x/lines/x"]) {
      assert.ok(kit.includes(route), `${route} renders AppShell: ${kit.join(", ")}`);
    }
  });

  for (const file of all) {
    const route = routeOf(file);
    const ownShell = /<AppShell\b/.test(readFileSync(file, "utf8"));
    it(`${route} — ${ownShell ? "draws AppShell, so the layout draws none" : "draws no shell, so the layout draws its own"}`, () => {
      assert.equal(drawsKitShell(route), ownShell);
    });
  }
});
