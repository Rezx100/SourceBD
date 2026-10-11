// The common searches' counts never hold a page past their cap (11 Oct 2026: the home page awaited all nine
// uncapped, 4-5 s before its first byte).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_STATE } from "@/lib/discover-v32-state";
import { readTemplateCounts } from "@/lib/dashboard/search-cache";

const templates = ["a", "b", "c", "d"].map((key) => ({ key, state: { ...EMPTY_STATE, q: key } }));

describe("readTemplateCounts", () => {
  it("answers with every count read in time", async () => {
    assert.deepEqual(await readTemplateCounts(templates, 1000, async (s) => s.q.length), { a: 1, b: 1, c: 1, d: 1 });
  });

  it("answers at the cap without the counts when a read hangs", async () => {
    const started = Date.now();
    const out = await readTemplateCounts(templates, 50, () => new Promise<number | null>(() => {}));
    assert.deepEqual(out, {});
    assert.ok(Date.now() - started < 1000, "waited past the cap");
  });

  it("keeps the counts read by the cap and drops only the late ones", async () => {
    const out = await readTemplateCounts(templates, 100, (s) => (s.q === "d" ? new Promise<number | null>(() => {}) : Promise.resolve(7)));
    assert.deepEqual(out, { a: 7, b: 7, c: 7 });
  });
});
