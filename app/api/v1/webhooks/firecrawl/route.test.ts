// Route-level tests for the Firecrawl monitor webhook.
//
// The real envelope is `{success, type: "monitor.page", id, data: [...]}` with
// `data` an ARRAY of page entries. The pre-REZ-34 route treated `data` as an
// object and read `monitorId` at the root, so every real delivery would have
// been recorded with NULL monitor/page columns and the requeue path would never
// fire. These tests pin the real contract: one row per page entry, columns
// from that entry, dedupe key `fc:{envelope id}:{index}`.
//
// The supabase client is intercepted at `globalThis.fetch`, which postgrest-js
// resolves per request — so no module mocking is needed and no network call
// leaves the process.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { POST } from "./route";

const SECRET = "test-webhook-secret";
const SUPABASE_URL = "https://supabase.invalid";
const ENV_KEYS = [
  "FIRECRAWL_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined> = {};
let rpcCalls: RpcCall[] = [];
let rpcResults: boolean[] = [];

function stubFetch(): void {
  rpcCalls = [];
  rpcResults = [];
  globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    const match = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (!match) return new Response("not found", { status: 404 });
    const params = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    rpcCalls.push({ fn: match[1]!, params });
    const result = rpcResults.length > 0 ? (rpcResults.shift() as boolean) : true;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function delivery(body: unknown, secret: string | null = SECRET): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-sourcebd-webhook-secret"] = secret;
  return new NextRequest("https://sourcebd.net/api/v1/webhooks/firecrawl", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.FIRECRAWL_WEBHOOK_SECRET = SECRET;
  process.env.SUPABASE_URL = SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
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

describe("firecrawl webhook route", () => {
  it("records one row from a real monitor.page envelope, columns from data[0]", async () => {
    const envelope = {
      success: true,
      type: "monitor.page",
      id: "evt_1",
      data: [{ monitorId: "mon_1", url: "https://www.bgmea.com.bd/page/member-list", status: "changed" }],
    };
    const res = await POST(delivery(envelope));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true, recorded: 1, duplicates: 0 });

    assert.equal(rpcCalls.length, 1);
    const call = rpcCalls[0]!;
    assert.equal(call.fn, "firecrawl_webhook_record");
    assert.equal(call.params.p_dedupe_key, "fc:evt_1:0");
    assert.equal(call.params.p_event_type, "monitor.page");
    assert.equal(call.params.p_monitor_id, "mon_1");
    assert.equal(call.params.p_page_url, "https://www.bgmea.com.bd/page/member-list");
    // The full payload is stored so the worker can classify on data[i].status.
    const stored = call.params.p_payload as { data: unknown };
    assert.ok(Array.isArray(stored.data));
  });

  it("writes one row per page entry when data carries many", async () => {
    const envelope = {
      success: true,
      type: "monitor.page",
      id: "evt_9",
      data: [
        { monitorId: "mon_1", url: "https://x/a", status: "same" },
        { monitorId: "mon_1", url: "https://x/b", status: "changed" },
        { monitorId: "mon_2", url: "https://x/c", status: "removed" },
      ],
    };
    const res = await POST(delivery(envelope));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true, recorded: 3, duplicates: 0 });

    assert.deepEqual(
      rpcCalls.map((call) => call.params.p_dedupe_key),
      ["fc:evt_9:0", "fc:evt_9:1", "fc:evt_9:2"],
    );
    assert.deepEqual(
      rpcCalls.map((call) => call.params.p_page_url),
      ["https://x/a", "https://x/b", "https://x/c"],
    );
    assert.deepEqual(
      rpcCalls.map((call) => call.params.p_monitor_id),
      ["mon_1", "mon_1", "mon_2"],
    );
  });

  it("falls back to a body-hash dedupe key when the envelope has no id", async () => {
    const res = await POST(
      delivery({ type: "monitor.page", data: [{ monitorId: "m", url: "https://x/a", status: "same" }] }),
    );
    assert.equal(res.status, 200);
    assert.equal(rpcCalls.length, 1);
    const key = String(rpcCalls[0]!.params.p_dedupe_key);
    assert.match(key, /^fc:sha256:[0-9a-f]{64}:0$/);
  });

  it("marks a re-delivery as duplicate without failing", async () => {
    rpcResults.push(false);
    const res = await POST(
      delivery({ type: "monitor.page", id: "evt_dup", data: [{ monitorId: "m", url: "https://x/a", status: "same" }] }),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true, recorded: 0, duplicates: 1 });
  });

  it("rejects a wrong secret with 401 and records nothing", async () => {
    const res = await POST(
      delivery({ type: "monitor.page", id: "evt_1", data: [] }, "not-the-secret"),
    );
    assert.equal(res.status, 401);
    assert.equal(rpcCalls.length, 0);
  });

  it("answers 404 when the route is unconfigured", async () => {
    delete process.env.FIRECRAWL_WEBHOOK_SECRET;
    const res = await POST(delivery({ type: "monitor.page", id: "evt_1", data: [] }));
    assert.equal(res.status, 404);
    assert.equal(rpcCalls.length, 0);
  });

  it("still records one root-extracted row when data is absent", async () => {
    const res = await POST(
      delivery({ type: "monitor.check.completed", id: "evt_7", monitorId: "mon_1" }),
    );
    assert.equal(res.status, 200);
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0]!.params.p_dedupe_key, "fc:evt_7:0");
    assert.equal(rpcCalls[0]!.params.p_monitor_id, "mon_1");
    assert.equal(rpcCalls[0]!.params.p_page_url, null);
  });
});
