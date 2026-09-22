import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pushRecent, readRecentSearches } from "./record-recent-search";

describe("recent searches", () => {
  it("keeps three, newest first, and does not duplicate an href", () => {
    const a = { label: "Knit", href: "/app/discover?q=knit", count: 10 };
    const b = { label: "Woven", href: "/app/discover?q=woven", count: 4 };
    const c = { label: "HS 6105", href: "/app/discover?hs=6105", count: 20 };
    const d = { label: "Knit again", href: "/app/discover?q=knit", count: 11 };
    const once = pushRecent([], a);
    const two = pushRecent(once, b);
    const three = pushRecent(two, c);
    const again = pushRecent(three, d);
    assert.equal(three.length, 3);
    assert.equal(again.length, 3);
    assert.equal(again[0]?.href, a.href);
    assert.equal(again[0]?.count, 11);
    assert.equal(again.some((r) => r.href === b.href), true);
    assert.equal(again.filter((r) => r.href === a.href).length, 1);
  });

  it("an href out of storage that is not a path on this site is dropped", () => {
    // Whatever is under this key is rendered straight into an `<a href>`, and
    // the filter accepted any string. Same-origin storage, so writing it takes
    // an XSS, an extension or the machine — but `javascript:…` parked here then
    // becomes a one-click script execution in the buyer's own session every
    // time they open the sidebar, which turns a foothold somebody already had
    // into a durable one.
    const stored = [
      { label: "Knit", href: "/app/discover?q=knit", count: 1 },
      { label: "Bad", href: "javascript:alert(document.cookie)", count: 1 },
      { label: "Also bad", href: "JavaScript:alert(1)", count: 1 },
      { label: "Offsite", href: "https://evil.example/steal", count: 1 },
      { label: "Protocol relative", href: "//evil.example/steal", count: 1 },
      { label: "Data", href: "data:text/html,<script>alert(1)</script>", count: 1 },
      { label: "Not a string", href: 42, count: 1 },
    ];
    const g = globalThis as { window?: unknown };
    const had = "window" in g;
    const before = g.window;
    g.window = { localStorage: { getItem: () => JSON.stringify(stored) } };
    try {
      const out = readRecentSearches();
      assert.deepEqual(
        out.map((r) => r.href),
        ["/app/discover?q=knit"],
        `a stored href that is not a path on this site survived: ${JSON.stringify(out.map((r) => r.href))}`,
      );
    } finally {
      if (had) g.window = before;
      else delete g.window;
    }
  });

  it("unreadable storage is no recent searches, not a crash", () => {
    const g = globalThis as { window?: unknown };
    const had = "window" in g;
    const before = g.window;
    try {
      g.window = { localStorage: { getItem: () => "{not json" } };
      assert.deepEqual(readRecentSearches(), []);
      g.window = {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
        },
      };
      assert.deepEqual(readRecentSearches(), [], "a browser that blocks site data breaks the sidebar");
    } finally {
      if (had) g.window = before;
      else delete g.window;
    }
  });
});
