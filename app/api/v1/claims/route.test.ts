// /api/v1/claims at the route (0129): the verification email goes through the journaled sender with the
// claim id as its reference, on initiate and on an admin's resend; the raw token is in that one email's
// link and in no answer in production; a refused id never reaches the database; the database's refusals
// keep their meaning as statuses.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { called, fake, installModule, resetFake } from "../route-test-fake";

type Sent = { to: string; template: string; data: Record<string, unknown>; refId?: string | null };
const sent: Sent[] = [];
let sendFails = false;
let devOnly = false;
class StubEmailError extends Error {
  code = "send_failed";
}
installModule("lib/email/send.js", {
  EmailError: StubEmailError,
  sendEmail: async (input: Sent) => {
    if (sendFails) throw new StubEmailError("resend said no");
    sent.push(input);
    return devOnly ? { id: "dev:1", dev: true } : { id: "re_1" };
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fakes must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const CLAIM_ID = "1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c";
const SUPPLIER_ID = "2d2d2d2d-2d2d-4d2d-8d2d-2d2d2d2d2d2d";
const TOKEN = "ab".repeat(32);
const PAYLOAD = {
  claim_id: CLAIM_ID,
  verification_token: TOKEN,
  method: "manual_review",
  expires_at: "2026-10-07T10:00:00Z",
  proof_email: "mona@square.example",
  supplier: { id: SUPPLIER_ID, company_name: "Square Apparels Ltd" },
};

const post = (body: unknown) =>
  POST(new Request("https://sourcebd.net/api/v1/claims", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const say = async (res: Response) => (await res.json()) as Record<string, unknown>;

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL;
const ENV = process.env as Record<string, string | undefined>;
const NODE_ENV = ENV.NODE_ENV;
beforeEach(() => {
  resetFake();
  sent.length = 0;
  sendFails = false;
  devOnly = false;
  process.env.NEXT_PUBLIC_APP_URL = "https://sourcebd.net";
  fake.role = "admin";
});
afterEach(() => {
  if (ORIGIN === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  if (NODE_ENV === undefined) delete ENV.NODE_ENV;
  else ENV.NODE_ENV = NODE_ENV;
});

describe("initiate", () => {
  it("emails the link through the journaled sender, referenced by the claim id, and says the email went", async () => {
    fake.role = "supplier";
    fake.answers.claim_initiate = { data: PAYLOAD, error: null };
    const res = await post({ action: "initiate", supplier_id: SUPPLIER_ID, proof_email: "Mona@Square.example", note: "Owner" });
    assert.equal(res.status, 200);
    const json = await say(res);
    assert.equal(json.ok, true);
    assert.equal(json.email_sent, true);
    assert.equal(json.claim_id, CLAIM_ID);
    assert.equal(called("claim_initiate")[0]?.args?.p_proof_email, "mona@square.example");
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.template, "claim_verify");
    assert.equal(sent[0]?.to, "mona@square.example");
    assert.equal(sent[0]?.refId, CLAIM_ID, "the journal row must point at the claim");
    assert.equal(sent[0]?.data.link, `https://sourcebd.net/supplier/claim/verify?token=${TOKEN}`);
    assert.equal(sent[0]?.data.companyName, "Square Apparels Ltd");
    assert.equal(sent[0]?.data.autoApprove, false);
    assert.equal(json.dev_verification_url, `https://sourcebd.net/supplier/claim/verify?token=${TOKEN}`, "outside production the link is handed back for local flows");
  });

  it("with no API key the journal has the failed row and the answer says the email did not go", async () => {
    fake.answers.claim_initiate = { data: PAYLOAD, error: null };
    devOnly = true;
    const json = await say(await post({ action: "initiate", supplier_id: SUPPLIER_ID, proof_email: "mona@square.example" }));
    assert.equal(json.ok, true);
    assert.equal(json.email_sent, false);
  });

  it("in production a failed send is a 502 and the token is in no answer", async () => {
    ENV.NODE_ENV = "production";
    fake.answers.claim_initiate = { data: PAYLOAD, error: null };
    sendFails = true;
    const res = await post({ action: "initiate", supplier_id: SUPPLIER_ID, proof_email: "mona@square.example" });
    assert.equal(res.status, 502);
    const body = JSON.stringify(await say(res));
    assert.doesNotMatch(body, new RegExp(TOKEN));
    assert.equal(called("claim_initiate").length, 1, "the claim exists; only the email failed");
  });
});

describe("admin_resend", () => {
  it("asks the database for a fresh link, emails it with the claim id as reference, and says so", async () => {
    fake.answers.claim_admin_resend = { data: { ...PAYLOAD, method: "domain_email" }, error: null };
    const res = await post({ action: "admin_resend", id: CLAIM_ID });
    assert.equal(res.status, 200);
    const json = await say(res);
    assert.deepEqual(called("claim_admin_resend")[0]?.args, { p_claim_id: CLAIM_ID });
    assert.equal(json.resent, true);
    assert.equal(json.email_sent, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.refId, CLAIM_ID);
    assert.equal(sent[0]?.data.autoApprove, true);
    assert.equal(sent[0]?.data.link, `https://sourcebd.net/supplier/claim/verify?token=${TOKEN}`);
  });

  it("a bad id never reaches the database", async () => {
    const res = await post({ action: "admin_resend", id: "nope" });
    assert.equal(res.status, 400);
    assert.equal(fake.rpcCalls.length, 0);
    assert.equal(sent.length, 0);
  });

  it("keeps the database's refusals as statuses: not an admin 403, not waiting 409, not found 404", async () => {
    for (const [message, status] of [
      ["caller is not an admin", 403],
      ["claim is not waiting for its email", 409],
      ["claim not found", 404],
    ] as const) {
      sent.length = 0;
      fake.answers.claim_admin_resend = { data: null, error: { message } };
      const res = await post({ action: "admin_resend", id: CLAIM_ID });
      assert.equal(res.status, status, message);
      assert.equal(sent.length, 0, "no email after a refusal");
    }
  });

  it("without a session it is 401 and nothing is called", async () => {
    fake.userId = null;
    const res = await post({ action: "admin_resend", id: CLAIM_ID });
    assert.equal(res.status, 401);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("admin_decide", () => {
  it("forwards approve/reject with the note, and a reason refusal is 422", async () => {
    fake.answers.claim_admin_decide = { data: { claim_id: CLAIM_ID, status: "rejected" }, error: null };
    const res = await post({ action: "admin_decide", id: CLAIM_ID, approve: false, note: "Not their domain" });
    assert.equal(res.status, 200);
    assert.deepEqual(called("claim_admin_decide")[0]?.args, { p_claim_id: CLAIM_ID, p_approve: false, p_note: "Not their domain" });
    fake.answers.claim_admin_decide = { data: null, error: { message: "a reason is required to reject" } };
    assert.equal((await post({ action: "admin_decide", id: CLAIM_ID, approve: false })).status, 422);
    fake.answers.claim_admin_decide = { data: null, error: { message: "claim is not open for a decision" } };
    assert.equal((await post({ action: "admin_decide", id: CLAIM_ID, approve: true })).status, 409);
  });
});
