import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pushRecent } from "./record-recent-search";

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
});
