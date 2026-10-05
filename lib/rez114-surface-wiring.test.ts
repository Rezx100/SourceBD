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
  it("the public profile builds the buyer record's own model, which selects the workers figure", () => {
    // B9g: the public page no longer calls `resolveProfileWorkers`; it draws the same `buildSheet` model as the
    // buyer's record, and `workersFact` (RSC-preferred, with its coverage words) is what turns the payload's
    // figures into the Workers row. `components/record/public-record.test.ts` asserts the figure in the HTML.
    const t = src("app/(public)/suppliers/[slug]/page.tsx");
    assert.match(t, /buildSheet\(/);
    assert.match(t, /<PublicRecord model=\{model\}/);
    assert.match(t, /facilities:\s*\{\s*panel:\s*facilitiesPanel\s*\}/);
    const model = src("lib/dashboard/build-models.ts");
    assert.match(model, /export function workersFact\(/);
    assert.match(model, /workersFact\(/);
  });

  it("the buyer record page still reaches production_workers_display_batch", () => {
    // REZ-C replaced that page with the dashboard kit's `SupplierSheet`, so it
    // no longer calls `resolveProfileWorkers` by name. The honesty rule is the
    // same and the wire is one step longer: the page calls `loadRecordSheet`,
    // which fills the figure from `production_workers_display_batch` before
    // `buildSheet` turns it into the Workers row and its coverage words.
    // The record's rendering test asserts the FIGURE in the rendered HTML
    // (`components/record/record.test.ts`) — this only catches the wire being cut.
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
    assert.match(src("components/saved/load.ts"), /enrichDiscoverWorkers/);
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
