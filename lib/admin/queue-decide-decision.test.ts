import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseQueueDecideDecision,
  queueDecideRequestError,
} from "./queue-decide-decision";

describe("POST /api/v1/admin/queue/decide body", () => {
  it("rejects approve with HTTP 400", () => {
    const err = queueDecideRequestError(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      "approve",
    );
    assert.equal(err?.status, 400);
    assert.equal(err?.error, "decision must be release|reject|escalate");
    assert.equal(parseQueueDecideDecision("approve"), null);
  });

  it("accepts release, reject, escalate", () => {
    assert.equal(parseQueueDecideDecision("release"), "release");
    assert.equal(parseQueueDecideDecision("reject"), "reject");
    assert.equal(parseQueueDecideDecision("escalate"), "escalate");
    assert.equal(
      queueDecideRequestError(
        "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        "release",
      ),
      null,
    );
  });
});
