// /api/v1/settings — the workspace and inquiry actions (0106), at the route.
//
// Every refusal is asserted with no RPC call behind it: the route answers a
// bad value with a 400 and a plain sentence before the database sees it.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { called, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { GET, POST } = require("./route") as typeof import("./route");

const post = (body: unknown) =>
  POST(
    new Request("https://sourcebd.net/api/v1/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

async function refused(body: unknown, pattern: RegExp): Promise<void> {
  const res = await post(body);
  assert.equal(res.status, 400, JSON.stringify(body));
  const json = (await res.json()) as { error: string };
  assert.match(json.error, pattern);
  assert.match(json.error, /\.$/, `not a sentence: ${json.error}`);
  assert.equal(fake.rpcCalls.length, 0, "a refused value still reached the database");
}

beforeEach(resetFake);

describe("/api/v1/settings without a session", () => {
  it("answers 401 to GET and to both new actions, and calls nothing", async () => {
    fake.userId = null;
    assert.equal((await GET()).status, 401);
    assert.equal((await post({ action: "update_workspace", company_name: "Acme" })).status, 401);
    assert.equal((await post({ action: "update_inquiry", questions: ["MOQ?"] })).status, 401);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("GET /api/v1/settings", () => {
  it("passes settings_get's workspace and inquiry through", async () => {
    const settings = {
      email: "buyer@example.com",
      workspace: { company_name: "Acme", company_type: "brand" },
      inquiry: { questions: ["What is your MOQ?"], email_template: "Hello" },
    };
    fake.answers.settings_get = { data: settings, error: null };
    const res = await GET();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { settings });
  });
});

describe("POST update_workspace", () => {
  it("sends only the keys it was given, trimmed, and a blank one as null", async () => {
    const res = await post({
      action: "update_workspace",
      company_name: "  Acme Apparel  ",
      website: "",
      company_type: "retailer",
      employee_count: "51-200",
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.deepEqual(called("settings_update_workspace")[0]?.args, {
      p_input: { company_name: "Acme Apparel", website: null, company_type: "retailer", employee_count: "51-200" },
    });
  });

  it("accepts every field at its limit", async () => {
    const res = await post({
      action: "update_workspace",
      company_name: "a".repeat(200),
      business_description: "b".repeat(2000),
      website: "https://acme.example",
      customer_base: "c".repeat(300),
      company_logo_url: "https://cdn.example/logo.png",
    });
    assert.equal(res.status, 200);
  });

  it("refuses each bad value with a sentence", async () => {
    const w = (extra: Record<string, unknown>) => ({ action: "update_workspace", ...extra });
    await refused(w({ company_name: 42 }), /company name must be text/i);
    await refused(w({ company_name: "a".repeat(201) }), /200 characters/);
    await refused(w({ company_type: "wholesaler" }), /brand, retailer, importer, agent, other/);
    await refused(w({ business_description: "b".repeat(2001) }), /2000 characters/);
    await refused(w({ website: "acme.example" }), /http:\/\/ or https:\/\//);
    await refused(w({ website: "https://" + "x".repeat(300) }), /300 characters/);
    await refused(w({ customer_base: "c".repeat(301) }), /300 characters/);
    await refused(w({ employee_count: "5000" }), /1-10, 11-50/);
    await refused(w({ company_logo_url: "javascript:alert(1)" }), /http:\/\/ or https:\/\//);
    await refused(w({}), /nothing to save/i);
  });

  it("does not answer 200 when the RPC refuses", async () => {
    fake.answers.settings_update_workspace = { data: null, error: { message: "website must start with http:// or https://" } };
    const res = await post({ action: "update_workspace", website: "https://acme.example" });
    assert.equal(res.status, 400);
  });
});

describe("POST update_inquiry", () => {
  it("sends the questions trimmed with blanks dropped, and the template", async () => {
    const res = await post({
      action: "update_inquiry",
      questions: ["  What is your MOQ?  ", "", "   ", "Lead time?"],
      email_template: "  Dear {supplier},  ",
    });
    assert.equal(res.status, 200);
    assert.deepEqual(called("settings_update_inquiry")[0]?.args, {
      p_input: { questions: ["What is your MOQ?", "Lead time?"], email_template: "Dear {supplier}," },
    });
  });

  it("clears the template with null and leaves the questions alone when not sent", async () => {
    assert.equal((await post({ action: "update_inquiry", email_template: null })).status, 200);
    assert.deepEqual(called("settings_update_inquiry")[0]?.args, { p_input: { email_template: null } });
  });

  it("refuses each bad value with a sentence", async () => {
    const q = (extra: Record<string, unknown>) => ({ action: "update_inquiry", ...extra });
    await refused(q({ questions: "What is your MOQ?" }), /list of text/);
    await refused(q({ questions: ["ok", 7] }), /list of text/);
    await refused(q({ questions: Array.from({ length: 21 }, (_, i) => `Question ${i}`) }), /up to 20 questions/);
    await refused(q({ questions: ["x".repeat(201)] }), /200 characters/);
    await refused(q({ email_template: 12 }), /must be text/);
    await refused(q({ email_template: "t".repeat(4001) }), /4000 characters/);
    await refused(q({}), /nothing to save/i);
  });
});
