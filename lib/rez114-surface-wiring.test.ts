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
  it("the public profile resolves selected workers into the header", () => {
    const t = src("app/(public)/suppliers/[slug]/page.tsx");
    assert.match(t, /resolveProfileWorkers/);
    assert.match(t, /workers=\{workersHeadline\}/);
    assert.match(t, /hasCapacityData\(s,\s*workersHeadline\)/);
  });

  it("the buyer record page still reaches production_workers_display_batch", () => {
    // REZ-C replaced that page with the dashboard kit's `SupplierSheet`, so it
    // no longer calls `resolveProfileWorkers` by name. The honesty rule is the
    // same and the wire is one step longer: the page calls `loadRecordSheet`,
    // which fills the figure from `production_workers_display_batch` before
    // `buildSheet` turns it into the Workers row and its coverage words.
    // `components/dashboard/record-sheet.test.ts` asserts the FIGURE in the
    // rendered HTML — this only catches the wire being cut.
    assert.match(src("app/(app)/app/suppliers/[slug]/page.tsx"), /loadRecordSheet/);
    const loader = src("lib/dashboard/load-record.ts");
    assert.match(loader, /fetchDisplayWorkersBatch/);
    assert.match(loader, /fillRecordWorkersSafely/);
    assert.match(src("lib/enrich-discover-workers.ts"), /production_workers_display_batch/);
  });

  it("discover / saved / public discover enrich list card workers", () => {
    const discover = src("app/(app)/app/discover/page.tsx");
    assert.match(discover, /fetchDiscoverV32|enrichDiscoverWorkers/);
    assert.match(src("lib/discover-v32-rpc.ts"), /enrichDiscoverWorkers/);
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
