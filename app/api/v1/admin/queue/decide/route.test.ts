// Route-level tests for POST /api/v1/admin/queue/decide.
// Approve must be HTTP 400 from the exported POST handler, with no RPC.
// Release must call admin_queue_decide and keep the RPC status.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { POST } from "./route";

const QUEUE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ENV_KEYS = [
  "DEV_ADMIN_BYPASS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

interface RpcCall {
  fn: string;
}

const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined> = {};
let rpcCalls: RpcCall[] = [];
let rpcStatus = 200;
let rpcBody: unknown = { action: "keep_separate" };

function stubFetch(): void {
  rpcCalls = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    const match = /\/rpc\/(\w+)/.exec(url);
    if (match) rpcCalls.push({ fn: match[1]! });
    return new Response(JSON.stringify(rpcBody), {
      status: rpcStatus,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function post(body: unknown): Request {
  return new Request("https://sourcebd.net/api/v1/admin/queue/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.DEV_ADMIN_BYPASS = "1";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  rpcStatus = 200;
  rpcBody = { action: "keep_separate" };
  stubFetch();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = realFetch;
});

describe("POST /api/v1/admin/queue/decide", () => {
  it("rejects approve with HTTP 400 and does not call admin_queue_decide", async () => {
    const res = await POST(post({ queue_id: QUEUE_ID, decision: "approve" }));
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "decision must be release|reject|escalate",
    });
    assert.equal(rpcCalls.length, 0);
  });

  it("forwards release to admin_queue_decide and keeps HTTP 200", async () => {
    const res = await POST(
      post({ queue_id: QUEUE_ID, decision: "release", note: "ok" }),
    );
    assert.equal(res.status, 200);
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]?.fn, "admin_queue_decide");
    assert.deepEqual(await res.json(), { action: "keep_separate" });
  });

  it("does not collapse a failed release RPC to HTTP 200", async () => {
    rpcStatus = 400;
    rpcBody = { message: "queue row needs a human destination: hold" };
    const res = await POST(post({ queue_id: QUEUE_ID, decision: "release" }));
    assert.equal(res.status, 400);
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]?.fn, "admin_queue_decide");
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "admin_queue_decide failed");
  });
});
