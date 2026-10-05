// POST /api/v1/webhooks/saved-search-alerts: cron's door to the Monday email (gap 14). Who may call it
// (only a caller holding JOB_SECRET), and what it answers. The job itself is tested in
// lib/saved-search-alerts.test.ts; here it is replaced, so no network or database is touched.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { installModule } from "../../route-test-fake";

let runs = 0;
let result: Record<string, unknown> = { due: 2, baselined: 1, emailed: 1, unchanged: 0, failed: 0, error: null };
installModule("lib/email/jobs/saved-search-alerts.js", {
  runSavedSearchAlertsJob: async () => {
    runs += 1;
    return result;
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the job must be replaced before the route loads.
const { POST } = require("./route") as typeof import("./route");

const SECRET = "test-job-secret";
const call = (secret: string | null) =>
  POST(new NextRequest("https://sourcebd.net/api/v1/webhooks/saved-search-alerts", { method: "POST", headers: secret === null ? {} : { "x-sourcebd-job-secret": secret } }));

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.JOB_SECRET;
  process.env.JOB_SECRET = SECRET;
  runs = 0;
  result = { due: 2, baselined: 1, emailed: 1, unchanged: 0, failed: 0, error: null };
});
afterEach(() => {
  if (saved === undefined) delete process.env.JOB_SECRET;
  else process.env.JOB_SECRET = saved;
});

describe("POST /api/v1/webhooks/saved-search-alerts", () => {
  it("is a 404 when no secret is configured, so an unscheduled deployment looks like no route", async () => {
    delete process.env.JOB_SECRET;
    assert.equal((await call(SECRET)).status, 404);
    assert.equal((await call(null)).status, 404);
    assert.equal(runs, 0);
  });

  it("is a 401 with no secret or the wrong one, and runs nothing", async () => {
    assert.equal((await call(null)).status, 401);
    assert.equal((await call("nope")).status, 401);
    assert.equal((await call(SECRET + "x")).status, 401);
    assert.equal((await call("")).status, 401);
    assert.equal(runs, 0);
  });

  it("runs the job once for the right secret and answers its counts", async () => {
    const res = await call(SECRET);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), result);
    assert.equal(runs, 1);
  });

  it("is a 502 when the job could not read what is due, so cron's log shows a failure", async () => {
    result = { due: 0, baselined: 0, emailed: 0, unchanged: 0, failed: 0, error: "saved_search_alerts_due failed" };
    const res = await call(SECRET);
    assert.equal(res.status, 502);
    assert.equal(((await res.json()) as { error: string }).error, "saved_search_alerts_due failed");
  });
});
