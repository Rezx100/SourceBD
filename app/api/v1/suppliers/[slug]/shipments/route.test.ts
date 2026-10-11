// POST /api/v1/suppliers/:slug/shipments at the route, with Volza mocked (global fetch) and the database's
// answers faked: signed out is 401 and Starter or suspended 403 with no Volza call; a non-exact match is 404;
// a saved copy is served with no Volza call; a fetch asks Volza once for 25 by the exact Volza spelling,
// newest first, saves through the service role with its cost and credit, and answers what the read returns;
// two clicks while one fetch runs make one call; the cap and off switch make no call; a Volza error, 429 or
// timeout saves nothing, uses no allowance and answers "try again shortly"; the key never appears in an answer.
// What the database does with these calls (15 vs 25, allowance, lock, cap, expiry) is supabase/ci/assert-0141.sql.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { classifyRoute, RATE_LIMITS } from "@/lib/rate-limit/limits";
import { revealTiming, VOLZA_EXPORTS_URL } from "@/lib/volza/shipments";
import { called, fake, installModule, resetFake, type Answer } from "../../../route-test-fake";

const serviceCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
let finishAnswer: Answer = { data: true, error: null };
installModule("lib/supabase/service.js", {
  createSupabaseServiceClient: async () => ({
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      serviceCalls.push({ fn, args });
      return fn === "volza_reveal_finish" ? finishAnswer : { data: null, error: null };
    },
  }),
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fakes must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const KEY = "volza-test-key-0141";
const FETCH = { status: "fetch", claim: "11111111-1111-4111-8111-111111111111", name: "Hamza Clothing Ltd.", window_start: "2024-09-01", window_end: "2026-08-31" };
const REVEAL = { fetched_at: "2026-10-11T10:00:00Z", limit: 15, records: [{ date: "2026-08-31", buyer: "Action" }] };
const RECORDS = Array.from({ length: 25 }, (_, i) => ({ shipment_date: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00`, buyer_name: `B${i}` }));

const volzaCalls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
let volza: () => Promise<Response> = async () => Response.json({ api_records: RECORDS }, { headers: { "X-Credit-Remaining": "2900.50" } });
const realFetch = globalThis.fetch;

/** Answer volza_reveal_begin from a queue, the last answer repeating. */
function beginAnswers(...answers: unknown[]) {
  const queue = [...answers];
  Object.defineProperty(fake.answers, "volza_reveal_begin", {
    enumerable: true,
    configurable: true,
    get: () => ({ data: queue.length > 1 ? queue.shift() : queue[0], error: null }),
  });
}

const send = (slug = "hamza-clothing") =>
  POST(new Request(`https://sourcebd.net/api/v1/suppliers/${slug}/shipments`, { method: "POST" }) as never, {
    params: Promise.resolve({ slug }),
  });

beforeEach(() => {
  resetFake();
  serviceCalls.length = 0;
  volzaCalls.length = 0;
  finishAnswer = { data: true, error: null };
  revealTiming.busyWaitMs = 1;
  process.env.VOLZA_API_KEY = KEY;
  volza = async () => Response.json({ api_records: RECORDS }, { headers: { "X-Credit-Remaining": "2900.50" } });
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    volzaCalls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    return volza();
  }) as typeof fetch;
  fake.answers.supplier_shipment_reveal = { data: REVEAL, error: null };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("/api/v1/suppliers/:slug/shipments", () => {
  it("is in its own rate-limit bucket, per user", () => {
    assert.equal(classifyRoute("/api/v1/suppliers/hamza-clothing/shipments", "POST"), "api_reveal");
    assert.equal(RATE_LIMITS.api_reveal.identifier, "user");
  });

  it("answers 401 signed out, before the database or Volza", async () => {
    fake.userId = null;
    const res = await send();
    assert.equal(res.status, 401);
    assert.equal(fake.rpcCalls.length, 0);
    assert.equal(volzaCalls.length, 0);
  });

  it("answers 403 to Starter and suspended accounts (the database says forbidden), with no data and no Volza call", async () => {
    beginAnswers({ status: "forbidden" });
    const res = await send();
    assert.equal(res.status, 403);
    assert.equal("reveal" in ((await res.json()) as object), false);
    assert.equal(volzaCalls.length, 0);
    assert.equal(called("supplier_shipment_reveal").length, 0);
  });

  it("answers 404 for a supplier without an exact match, and for a malformed slug before the database", async () => {
    beginAnswers({ status: "unavailable" });
    assert.equal((await send()).status, 404);
    assert.equal((await send("../etc")).status, 404);
    assert.equal(called("volza_reveal_begin").length, 1);
    assert.equal(volzaCalls.length, 0);
  });

  it("serves a saved copy as the database cut it, with no Volza call", async () => {
    beginAnswers({ status: "ready", reveal: REVEAL });
    const res = await send();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { reveal: REVEAL });
    assert.equal(volzaCalls.length, 0);
    assert.equal(serviceCalls.length, 0);
  });

  it("fetches once: 25 latest by the exact Volza spelling, saves with cost and credit, answers the read", async () => {
    beginAnswers(FETCH);
    const res = await send();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { reveal: REVEAL });
    assert.equal(volzaCalls.length, 1);
    const call = volzaCalls[0]!;
    assert.equal(call.url, VOLZA_EXPORTS_URL);
    assert.equal(call.auth, `Bearer ${KEY}`);
    assert.deepEqual(call.body, {
      hsn_code: ["61", "62"], start_date: "2024-09-01", end_date: "2026-08-31", max_count_per_page: 25,
      sort_by: "date", sort_order: "DESC", supplier_name: ["Hamza Clothing Ltd."], supplier_name_search_type: "exact",
      remove_duplicate_shipments: true,
    });
    assert.deepEqual(serviceCalls, [{ fn: "volza_reveal_finish", args: { p_claim: FETCH.claim, p_records: RECORDS, p_cost_usd: 1.35, p_credit_remaining_usd: 2900.5 } }]);
    assert.deepEqual(called("supplier_shipment_reveal").map((c) => c.args), [{ p_slug: "hamza-clothing" }]);
  });

  it("saves an empty answer too, at the search price", async () => {
    beginAnswers(FETCH);
    volza = async () => Response.json({ api_records: [] });
    assert.equal((await send()).status, 200);
    assert.deepEqual(serviceCalls[0]?.args, { p_claim: FETCH.claim, p_records: [], p_cost_usd: 0.1, p_credit_remaining_usd: null });
  });

  it("waits while another buyer's fetch runs, then serves it: two clicks, no second call", async () => {
    beginAnswers({ status: "busy" }, { status: "busy" }, { status: "ready", reveal: REVEAL });
    const res = await send();
    assert.equal(res.status, 200);
    assert.equal(called("volza_reveal_begin").length, 3);
    assert.equal(volzaCalls.length, 0);
  });

  it("gives up with 503 when the other fetch never finishes", async () => {
    beginAnswers({ status: "busy" });
    assert.equal((await send()).status, 503);
    assert.equal(volzaCalls.length, 0);
  });

  it("makes no call when the off switch or the monthly cap is hit", async () => {
    for (const status of ["paused", "budget"]) {
      beginAnswers({ status });
      const res = await send();
      assert.equal(res.status, 503);
      assert.match(String(((await res.json()) as { error: string }).error), /Try again shortly/);
    }
    assert.equal(volzaCalls.length, 0);
    assert.equal(serviceCalls.length, 0);
  });

  it("answers 429 with the limit when the month's or day's allowance is used", async () => {
    beginAnswers({ status: "allowance_used", limit: 30 });
    let res = await send();
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: "You've used this month's shipment reveals.", limit: 30 });
    beginAnswers({ status: "daily_limit", limit: 20 });
    res = await send();
    assert.equal(res.status, 429);
    assert.equal(volzaCalls.length, 0);
  });

  it("a Volza 429, 500, timeout or bad answer saves nothing, uses no allowance, logs what it may have cost", async () => {
    const cases: [() => Promise<Response>, number][] = [
      [async () => new Response("slow down", { status: 429 }), 0],
      [async () => new Response("oops", { status: 500 }), 1.35],
      [async () => { throw new DOMException("timed out", "TimeoutError"); }, 1.35],
      [async () => Response.json({ api_records: Array(26).fill({}) }), 1.35],
    ];
    for (const [answer, cost] of cases) {
      serviceCalls.length = 0;
      beginAnswers(FETCH);
      volza = answer;
      const res = await send();
      assert.equal(res.status, 503);
      assert.deepEqual(serviceCalls, [{ fn: "volza_reveal_abort", args: { p_claim: FETCH.claim, p_cost_usd: cost } }]);
      assert.equal(JSON.stringify(await res.json()).includes(KEY), false);
    }
    assert.equal(called("supplier_shipment_reveal").length, 0);
  });

  it("without a Volza key, releases the claim at no cost and calls nobody", async () => {
    delete process.env.VOLZA_API_KEY;
    beginAnswers(FETCH);
    assert.equal((await send()).status, 503);
    assert.equal(volzaCalls.length, 0);
    assert.deepEqual(serviceCalls, [{ fn: "volza_reveal_abort", args: { p_claim: FETCH.claim, p_cost_usd: 0 } }]);
  });

  it("when saving fails after Volza answered, logs the spend and answers 503", async () => {
    beginAnswers(FETCH);
    finishAnswer = { data: null, error: { message: "boom" } };
    assert.equal((await send()).status, 503);
    assert.deepEqual(serviceCalls.map((c) => c.fn), ["volza_reveal_finish", "volza_reveal_abort"]);
    assert.equal(serviceCalls[1]?.args?.p_cost_usd, 1.35);
  });
});
