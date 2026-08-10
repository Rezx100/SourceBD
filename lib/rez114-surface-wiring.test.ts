/**
 * REZ-114 — surfaces that show workers must call the selection helpers.
 * Catches a deleted enrichDiscoverWorkers / resolveProfileWorkers wire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function src(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("REZ-114 surface wiring (observable call sites)", () => {
  it("buyer + public profiles resolve selected workers into the header", () => {
    for (const p of [
      "app/(app)/app/suppliers/[slug]/page.tsx",
      "app/(public)/suppliers/[slug]/page.tsx",
    ]) {
      const t = src(p);
      assert.match(t, /resolveProfileWorkers/);
      assert.match(t, /workers=\{workersHeadline\}/);
      assert.match(t, /hasCapacityData\(s,\s*workersHeadline\)/);
    }
  });

  it("discover / saved / public discover enrich list card workers", () => {
    assert.match(src("app/(app)/app/discover/page.tsx"), /enrichDiscoverWorkers/);
    assert.match(src("app/(app)/app/saved/page.tsx"), /enrichDiscoverWorkers/);
    assert.match(src("lib/discover-suppliers.ts"), /enrichDiscoverWorkers/);
  });

  it("smart match API enriches results via runSmartMatch / enrichDiscoverWorkers", () => {
    const route = src("app/api/v1/match/route.ts");
    assert.match(route, /runSmartMatch|enrichDiscoverWorkers/);
    assert.match(src("lib/smart-match-response.ts"), /enrichDiscoverWorkers/);
    assert.match(
      src("lib/smart-match-response.ts"),
      /production_workers_display_batch|enrichDiscoverWorkers/,
    );
  });
});
