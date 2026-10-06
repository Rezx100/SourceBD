// POST /api/v1/admin/ledger/verify at the route (moderation plan 1e): admin only, forwards to ledger_verify
// and answers its verdict; a failed check is a 502, never a quiet success.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { called, fake, resetFake } from "../../../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

beforeEach(() => {
  resetFake();
  fake.role = "admin";
});

describe("POST /api/v1/admin/ledger/verify", () => {
  it("answers the verdict to an admin", async () => {
    fake.answers.ledger_verify = { data: { ok: true, seals_checked: 12, first_broken_seal: null, why: null, unsealed_entries: 3 }, error: null };
    const res = await POST();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, seals_checked: 12, first_broken_seal: null, why: null, unsealed_entries: 3 });
    assert.equal(called("ledger_verify").length, 1);
  });

  it("is a 403 for a buyer and for nobody, calling nothing", async () => {
    fake.role = "buyer";
    assert.equal((await POST()).status, 403);
    fake.userId = null;
    fake.role = null;
    assert.equal((await POST()).status, 403);
    assert.equal(called("ledger_verify").length, 0);
  });

  it("a failed check is a 502 with the reason", async () => {
    fake.answers.ledger_verify = { data: null, error: { message: "function ledger_verify does not exist" } };
    const res = await POST();
    assert.equal(res.status, 502);
    assert.match(((await res.json()) as { detail: string }).detail, /does not exist/);
  });
});
