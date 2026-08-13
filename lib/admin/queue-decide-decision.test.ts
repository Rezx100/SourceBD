import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseQueueDecideDecision,
  queueDecideFromRequest,
  queueDecideRequestError,
} from "./queue-decide-decision";

const QUEUE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function post(body: unknown): Request {
  return new Request("https://sourcebd.net/api/v1/admin/queue/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/admin/queue/decide", () => {
  it("rejects approve with HTTP 400 and does not call admin_queue_decide", async () => {
    const calls: unknown[] = [];
    const res = await queueDecideFromRequest(
      post({ queue_id: QUEUE_ID, decision: "approve" }),
      "admin",
      async (args) => {
        calls.push(args);
        return { data: { ok: true }, error: null };
      },
    );
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "decision must be release|reject|escalate",
    });
    assert.equal(calls.length, 0);
    assert.equal(parseQueueDecideDecision("approve"), null);
    assert.equal(queueDecideRequestError(QUEUE_ID, "approve")?.status, 400);
  });

  it("forwards release to admin_queue_decide", async () => {
    const calls: unknown[] = [];
    const res = await queueDecideFromRequest(
      post({ queue_id: QUEUE_ID, decision: "release", note: "ok" }),
      "admin",
      async (args) => {
        calls.push(args);
        return { data: { action: "keep_separate" }, error: null };
      },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [
      { p_queue_id: QUEUE_ID, p_decision: "release", p_note: "ok" },
    ]);
  });

  it("forwards reject and escalate to admin_queue_decide", async () => {
    for (const decision of ["reject", "escalate"] as const) {
      const calls: unknown[] = [];
      const res = await queueDecideFromRequest(
        post({ queue_id: QUEUE_ID, decision }),
        "admin",
        async (args) => {
          calls.push(args);
          return { data: { ok: true }, error: null };
        },
      );
      assert.equal(res.status, 200);
      assert.deepEqual(calls, [
        { p_queue_id: QUEUE_ID, p_decision: decision, p_note: null },
      ]);
    }
  });

  it("maps needs_human RPC errors to HTTP 400", async () => {
    const res = await queueDecideFromRequest(
      post({ queue_id: QUEUE_ID, decision: "release" }),
      "admin",
      async () => ({
        data: null,
        error: { message: "queue row needs a human destination: hold" },
      }),
    );
    assert.equal(res.status, 400);
    assert.equal(
      ((await res.json()) as { error: string }).error,
      "admin_queue_decide failed",
    );
  });
});
