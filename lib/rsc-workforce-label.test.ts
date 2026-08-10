import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  rscDetailBlockVisible,
  rscWorkforceLabel,
} from "./rsc-workforce-label";

describe("rscWorkforceLabel", () => {
  it("renders unknown when workers_count is null (never 0)", () => {
    assert.equal(rscWorkforceLabel(null), "unknown");
    assert.equal(rscWorkforceLabel(undefined), "unknown");
  });

  it("formats known counts including a real zero", () => {
    assert.equal(rscWorkforceLabel(0), "0 workers");
    assert.equal(rscWorkforceLabel(1381), "1,381 workers");
  });
});

describe("rscDetailBlockVisible", () => {
  it("shows the workforce row when progress exists even if workers_count is null", () => {
    assert.equal(
      rscDetailBlockVisible({
        progress_pct: 86,
        workers_count: null,
        remediation_status: null,
        training_status: null,
      }),
      true,
    );
  });

  it("hides the block when there is nothing to show", () => {
    assert.equal(
      rscDetailBlockVisible({
        progress_pct: null,
        workers_count: null,
        remediation_status: null,
        training_status: null,
      }),
      false,
    );
  });
});
