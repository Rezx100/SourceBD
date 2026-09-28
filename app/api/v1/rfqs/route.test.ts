// /api/v1/rfqs — the message, questions and product on create, and drafts
// (0106), at the route. The existing create/quote behaviour is unchanged;
// the create cases here pin what 0106 added and that a plain create still
// sends exactly what it did.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { called, CONTACT_KEY_RE, fake, installModule, resetFake } from "../route-test-fake";

// The rfq_received fan-out reads the service-role key and sends mail; the
// route does not wait for it, and it is not what these tests are about.
const notified: unknown[] = [];
installModule("lib/email/triggers/rfq-received.js", {
  notifyRfqTargets: async (input: unknown) => {
    notified.push(input);
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fakes must be installed before the route loads.
const { GET, POST } = require("./route") as typeof import("./route");

const SUPPLIER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const DRAFT = "33333333-3333-4333-8333-333333333333";
const RFQ = "44444444-4444-4444-8444-444444444444";
const ENDPOINT = "https://sourcebd.net/api/v1/rfqs";

const get = (query: string) => GET(new Request(`${ENDPOINT}${query}`));
const post = (body: unknown) =>
  POST(
    new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const CREATE = {
  action: "create",
  product_title: "Crew neck tee",
  quantity: 5000,
  quantity_unit: "pcs",
  target_supplier_ids: [SUPPLIER],
};

async function refused(body: Record<string, unknown>, pattern: RegExp): Promise<void> {
  const res = await post(body);
  assert.equal(res.status, 400, JSON.stringify(body).slice(0, 200));
  const json = (await res.json()) as { error: string };
  assert.match(json.error, pattern);
  assert.equal(fake.rpcCalls.length, 0, "a refused request still reached the database");
}

beforeEach(() => {
  resetFake();
  notified.length = 0;
  delete process.env.DEV_ADMIN_BYPASS;
});

describe("/api/v1/rfqs without a session", () => {
  it("answers 401 to the drafts list and every new action, and calls nothing", async () => {
    fake.userId = null;
    assert.equal((await get("?drafts=1")).status, 401);
    assert.equal((await post({ ...CREATE, message: "Hello" })).status, 401);
    assert.equal((await post({ action: "save_draft", payload: {} })).status, 401);
    assert.equal((await post({ action: "delete_draft", draft_id: DRAFT })).status, 401);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("POST create — message, questions, product", () => {
  it("a plain create sends exactly what it sent before 0106", async () => {
    fake.answers.rfq_create = { data: RFQ, error: null };
    const res = await post(CREATE);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { rfq_id: RFQ });
    assert.deepEqual(called("rfq_create")[0]?.args, {
      p_input: {
        product_title: "Crew neck tee",
        product_description: null,
        quantity: 5000,
        quantity_unit: "pcs",
        target_supplier_ids: [SUPPLIER],
      },
    });
    assert.equal(called("rfq_draft_delete").length, 0);
    assert.equal(notified.length, 1);
  });

  it("passes the message, the questions (trimmed, blanks dropped) and the product through", async () => {
    fake.answers.rfq_create = { data: RFQ, error: null };
    const res = await post({
      ...CREATE,
      message: "  Please quote FOB Chittagong.  ",
      questions: ["  What is your MOQ?  ", "", "Lead time?"],
      product_id: PRODUCT,
    });
    assert.equal(res.status, 200);
    const sent = called("rfq_create")[0]?.args?.p_input as Record<string, unknown>;
    assert.equal(sent.message, "Please quote FOB Chittagong.");
    assert.deepEqual(sent.questions, ["What is your MOQ?", "Lead time?"]);
    assert.equal(sent.product_id, PRODUCT);
  });

  it("deletes the draft it was composed from, after the RFQ exists", async () => {
    fake.answers.rfq_create = { data: RFQ, error: null };
    const res = await post({ ...CREATE, draft_id: DRAFT });
    assert.equal(res.status, 200);
    assert.deepEqual(
      fake.rpcCalls.map((c) => c.fn),
      ["rfq_create", "rfq_draft_delete"],
    );
    assert.deepEqual(called("rfq_draft_delete")[0]?.args, { p_id: DRAFT });
  });

  it("keeps the draft when the RFQ is refused", async () => {
    fake.answers.rfq_create = { data: null, error: { message: "one or more target suppliers are not published" } };
    const res = await post({ ...CREATE, draft_id: DRAFT });
    assert.equal(res.status, 400);
    assert.equal(called("rfq_draft_delete").length, 0);
  });

  it("answers 200 even when the spent draft is already gone", async () => {
    fake.answers.rfq_create = { data: RFQ, error: null };
    fake.answers.rfq_draft_delete = { data: null, error: { message: "draft not found" } };
    const res = await post({ ...CREATE, draft_id: DRAFT });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { rfq_id: RFQ });
  });

  it("refuses each bad new field with a 400 before the database", async () => {
    await refused({ ...CREATE, message: 42 }, /message must be text/);
    await refused({ ...CREATE, message: "m".repeat(8001) }, /8000 characters/);
    await refused({ ...CREATE, questions: "MOQ?" }, /list of text/);
    await refused({ ...CREATE, questions: ["MOQ?", 3] }, /list of text/);
    await refused({ ...CREATE, questions: Array.from({ length: 21 }, (_, i) => `Q${i}`) }, /up to 20 questions/);
    await refused({ ...CREATE, questions: ["q".repeat(201)] }, /200 characters/);
    await refused({ ...CREATE, product_id: "not-a-uuid" }, /product id/);
    await refused({ ...CREATE, draft_id: 7 }, /draft id/);
  });

  it("still refuses 51 targets, as before", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`);
    await refused({ ...CREATE, target_supplier_ids: ids }, /exceeds 50/);
  });
});

describe("drafts", () => {
  it("saves a new draft, lifting nothing the route has not checked", async () => {
    fake.answers.rfq_draft_save = { data: DRAFT, error: null };
    const payload = { product_title: "Tee", target_supplier_ids: [SUPPLIER], product_id: PRODUCT };
    const res = await post({ action: "save_draft", payload });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { draft_id: DRAFT });
    assert.deepEqual(called("rfq_draft_save")[0]?.args, { p_id: null, p_payload: payload });
  });

  it("updates an existing draft by id, and answers 404 for someone else's", async () => {
    fake.answers.rfq_draft_save = { data: DRAFT, error: null };
    assert.equal((await post({ action: "save_draft", draft_id: DRAFT, payload: { note: "x" } })).status, 200);
    assert.equal(called("rfq_draft_save")[0]?.args?.p_id, DRAFT);

    fake.answers.rfq_draft_save = { data: null, error: { message: "draft not found" } };
    assert.equal((await post({ action: "save_draft", draft_id: DRAFT, payload: {} })).status, 404);
  });

  it("refuses each bad draft with a 400 before the database", async () => {
    const d = (extra: Record<string, unknown>) => ({ action: "save_draft", ...extra });
    await refused(d({}), /Send the draft/);
    await refused(d({ payload: [] }), /Send the draft/);
    await refused(d({ payload: "x" }), /Send the draft/);
    await refused(d({ payload: { note: "n".repeat(33 * 1024) } }), /32 KB/);
    await refused(d({ payload: { target_supplier_ids: "all" } }), /up to 50 suppliers/);
    await refused(d({ payload: { target_supplier_ids: ["nope"] } }), /up to 50 suppliers/);
    await refused(
      d({ payload: { target_supplier_ids: Array.from({ length: 51 }, () => SUPPLIER) } }),
      /up to 50 suppliers/,
    );
    await refused(d({ payload: { product_id: "p" } }), /product id/);
    await refused(d({ draft_id: "d", payload: {} }), /draft id/);
  });

  it("is for buyers: a supplier gets 403", async () => {
    fake.role = "supplier";
    assert.equal((await post({ action: "save_draft", payload: {} })).status, 403);
    assert.equal((await post({ action: "delete_draft", draft_id: DRAFT })).status, 403);
    assert.equal(fake.rpcCalls.length, 0);
  });

  it("deletes a draft, refuses a bad id, and answers 404 for someone else's", async () => {
    assert.equal((await post({ action: "delete_draft", draft_id: DRAFT })).status, 200);
    assert.deepEqual(called("rfq_draft_delete")[0]?.args, { p_id: DRAFT });

    fake.rpcCalls = [];
    assert.equal((await post({ action: "delete_draft", draft_id: "x" })).status, 400);
    assert.equal((await post({ action: "delete_draft" })).status, 400);
    assert.equal(fake.rpcCalls.length, 0);

    fake.answers.rfq_draft_delete = { data: null, error: { message: "draft not found" } };
    assert.equal((await post({ action: "delete_draft", draft_id: DRAFT })).status, 404);
  });

  it("lists drafts, and never lets a contact field name out", async () => {
    fake.answers.rfq_draft_list = {
      data: [
        {
          id: DRAFT,
          payload: {
            product_title: "Crew neck tee",
            targets: [{ id: SUPPLIER, company_name: "Aboni Knitwear", email_primary: "a@b.example", phones: ["+880"] }],
            contact_name: "Mr. Leak",
          },
          target_supplier_ids: [SUPPLIER],
          product_id: null,
          contact_role: "Director",
          updated_at: "2026-09-27T10:00:00Z",
        },
      ],
      error: null,
    };
    const res = await get("?drafts=1");
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.doesNotMatch(text, CONTACT_KEY_RE);
    assert.match(text, /Aboni Knitwear/);
    assert.deepEqual(called("rfq_draft_list").length, 1);
  });

  it("tells a failed drafts read apart from an empty one", async () => {
    fake.answers.rfq_draft_list = { data: null, error: { message: "permission denied for function rfq_draft_list" } };
    const res = await get("?drafts=1");
    assert.notEqual(res.status, 200);
    assert.equal(((await res.json()) as { drafts?: unknown }).drafts, undefined);
  });
});
