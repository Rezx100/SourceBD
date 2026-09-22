// `BUYER_SECTIONS` is what every non-kit `/app` page renders as its rail, and
// nothing tested it — the file was not even in `tsconfig.npm-test.json`, so
// `pnpm test` never compiled it. That mattered the moment `/app/searches` was
// added: `render.test.ts` covers the dashboard kit's own `NAV`, so deleting the
// entry here would have made the saved-search list unreachable again from every
// other page in the app with the suite green, which a reviewer demonstrated.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BUYER_SECTIONS } from "./sidebar";
import { NAV } from "@/components/dashboard/app-shell";

const slots = BUYER_SECTIONS.flatMap((s) => s.slots);

describe("the buyer's two rails agree on where the buyer can go", () => {
  it("both link the saved-search list", () => {
    // A buyer who saved a search had no way back to it: it was linked from
    // nowhere in the product, and the only reference was the redirect that puts
    // you there once, straight after saving.
    assert.ok(
      slots.some((s) => s.href === "/app/searches"),
      "the app sidebar does not link /app/searches",
    );
    assert.ok(
      NAV.some((n) => n.href === "/app/searches"),
      "the dashboard kit's rail does not link /app/searches",
    );
  });

  it("the destinations the kit rail carries are the ones the app rail carries", () => {
    // WCAG 3.2.3: the shared items must appear in the same relative order in
    // both, because the kit shell REPLACES the app shell on its routes. An
    // earlier pass had them in different orders and dropped three entirely.
    const appHrefs = slots.map((s) => s.href);
    const shared = NAV.map((n) => n.href).filter((h) => appHrefs.includes(h));
    const unique = [...new Set(shared)];
    const appOrder = unique.map((h) => appHrefs.indexOf(h));
    assert.deepEqual(
      appOrder,
      [...appOrder].sort((a, b) => a - b),
      `the kit rail orders shared destinations differently from the app rail: ${unique.join(", ")}`,
    );
  });

  it("no rail entry points at a route with no page", () => {
    for (const href of [...slots.map((s) => s.href), ...NAV.map((n) => n.href)]) {
      assert.match(href, /^\/app\/[a-z-]+$/, `${href} is not an /app route`);
    }
  });
});
