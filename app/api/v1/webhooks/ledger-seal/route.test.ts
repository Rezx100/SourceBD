// POST /api/v1/webhooks/ledger-seal and /ledger-stamp (moderation plan 1e): who may call them (only a caller
// holding JOB_SECRET), and what they answer. The jobs themselves are tested in lib/ledger/jobs.test.ts;
// here they are replaced, so no network or database is touched.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { installModule } from "../../route-test-fake";

let seals = 0;
let stamps = 0;
let sealResult: Record<string, unknown> = { copied: 1, copy_error: null, sealed: 1, sealed_through: "2026-10-06T14:00:00Z", latest_seal_id: 9, error: null };
let stampResult: Record<string, unknown> = { seal: sealResult, latest: { id: 9 }, stamped: true, stamp_error: null, verdict: { ok: true }, mailed: true, mail_error: null, error: null };
installModule("lib/ledger/jobs-runner.js", {
  runHourlySeal: async () => {
    seals += 1;
    return sealResult;
  },
  runDailyStamp: async () => {
    stamps += 1;
    return stampResult;
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the jobs must be replaced before the routes load.
const seal = require("./route") as typeof import("./route");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- same.
const stamp = require("../ledger-stamp/route") as typeof import("../ledger-stamp/route");

const SECRET = "test-job-secret";
const call = (route: { POST: (r: NextRequest) => Promise<Response> }, path: string, secret: string | null) =>
  route.POST(new NextRequest(`https://sourcebd.net/api/v1/webhooks/${path}`, { method: "POST", headers: secret === null ? {} : { "x-sourcebd-job-secret": secret } }));

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.JOB_SECRET;
  process.env.JOB_SECRET = SECRET;
  seals = 0;
  stamps = 0;
  sealResult = { copied: 1, copy_error: null, sealed: 1, sealed_through: "2026-10-06T14:00:00Z", latest_seal_id: 9, error: null };
  stampResult = { seal: sealResult, latest: { id: 9 }, stamped: true, stamp_error: null, verdict: { ok: true }, mailed: true, mail_error: null, error: null };
});
afterEach(() => {
  if (saved === undefined) delete process.env.JOB_SECRET;
  else process.env.JOB_SECRET = saved;
});

describe("the two record routes", () => {
  it("are a 404 when no secret is configured, and a 401 with no secret or the wrong one, running nothing", async () => {
    delete process.env.JOB_SECRET;
    assert.equal((await call(seal, "ledger-seal", SECRET)).status, 404);
    assert.equal((await call(stamp, "ledger-stamp", SECRET)).status, 404);
    process.env.JOB_SECRET = SECRET;
    assert.equal((await call(seal, "ledger-seal", null)).status, 401);
    assert.equal((await call(seal, "ledger-seal", "nope")).status, 401);
    assert.equal((await call(stamp, "ledger-stamp", "nope")).status, 401);
    assert.equal(seals + stamps, 0);
  });

  it("the hourly route runs the seal and answers its report; a failed seal is a 502", async () => {
    const res = await call(seal, "ledger-seal", SECRET);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), sealResult);
    assert.equal(seals, 1);
    sealResult = { ...sealResult, error: "0135 not applied" };
    assert.equal((await call(seal, "ledger-seal", SECRET)).status, 502);
  });

  it("the daily route runs the stamp; a broken chain is a 500, no seal a 502, a failed mail still a 200 with the reason in the body", async () => {
    const res = await call(stamp, "ledger-stamp", SECRET);
    assert.equal(res.status, 200);
    assert.equal(stamps, 1);
    stampResult = { ...stampResult, verdict: { ok: false, why: "seal 3 does not chain" } };
    assert.equal((await call(stamp, "ledger-stamp", SECRET)).status, 500);
    stampResult = { ...stampResult, verdict: { ok: true }, error: "no seal yet" };
    assert.equal((await call(stamp, "ledger-stamp", SECRET)).status, 502);
    stampResult = { ...stampResult, error: null, mailed: false, mail_error: "LEDGER_STAMP_MAILBOX is not set" };
    const res2 = await call(stamp, "ledger-stamp", SECRET);
    assert.equal(res2.status, 200);
    assert.equal(((await res2.json()) as { mail_error: string }).mail_error, "LEDGER_STAMP_MAILBOX is not set");
  });
});
