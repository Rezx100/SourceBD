// Contact sales: every branch of the check and of the send. No table is written; the founder gets one email whose
// reply-to is the visitor, a filled honeypot sends nothing, and a failed send says where else to write.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CONTACT_TO, SENT_FAILED, checkContact, readContact, submitContact, type ContactDeps } from "@/lib/contact";

const form = (o: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};
const OK = { name: "Ana Reyes", email: "Ana@Brand.example", company: "Brand Ltd", role: "Sourcing or buying", markets: ["UK", "EU"], pieces: "1–10 million", message: "Knit tops, HS 6109." };

const spy = (result: boolean | "throw" = true) => {
  const sent: Parameters<ContactDeps["send"]>[0][] = [];
  const deps: ContactDeps = {
    send: async (m) => {
      sent.push(m);
      if (result === "throw") throw new Error("boom");
      return result;
    },
  };
  return { sent, deps };
};

describe("contact sales", () => {
  it("emails the founder once, with the visitor as the reply-to, and stores nothing else", async () => {
    const { sent, deps } = spy();
    const r = await submitContact(form(OK), deps);
    assert.deepEqual(r, { sent: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, CONTACT_TO);
    assert.equal(sent[0]!.replyTo, "ana@brand.example");
    assert.equal(sent[0]!.subject, "Contact sales: Ana Reyes, Brand Ltd");
    assert.deepEqual(sent[0]!.values.markets, ["UK", "EU"]);
  });

  it("a filled honeypot is told it worked and sends nothing", async () => {
    const { sent, deps } = spy();
    assert.deepEqual(await submitContact(form({ ...OK, website: "http://spam.example" }), deps), { sent: true });
    assert.equal(sent.length, 0);
  });

  it("each missing or wrong field is refused under its own name, and nothing is sent", async () => {
    const cases: [Record<string, string | string[]>, string][] = [
      [{ ...OK, name: "  " }, "name"],
      [{ ...OK, email: "not-an-email" }, "email"],
      [{ ...OK, company: "" }, "company"],
      [{ ...OK, role: "Astronaut" }, "role"],
      [{ ...OK, markets: [] }, "markets"],
      [{ ...OK, markets: ["Mars"] }, "markets"],
      [{ ...OK, pieces: "a lot" }, "pieces"],
    ];
    for (const [data, field] of cases) {
      const { sent, deps } = spy();
      const r = await submitContact(form(data), deps);
      assert.equal(r.field, field, field);
      assert.ok(r.fields?.[r.field!], field);
      assert.equal(r.values?.company ?? "", data.company === undefined ? "" : String(data.company).trim());
      assert.equal(sent.length, 0, field);
    }
  });

  it("a send that fails or throws says where else to write, and keeps what was typed", async () => {
    for (const result of [false, "throw"] as const) {
      const { deps } = spy(result);
      const r = await submitContact(form(OK), deps);
      assert.equal(r.error, SENT_FAILED);
      assert.equal(r.sent, undefined);
      assert.equal(r.values?.company, "Brand Ltd");
    }
    assert.match(SENT_FAILED, /sales@sourcebd\.net/);
  });

  it("cuts a long field, drops control characters, and cannot put a line break in the subject", async () => {
    const { sent, deps } = spy();
    await submitContact(form({ ...OK, name: "Ana\r\nBcc: x@y.z", company: "B".repeat(500), message: "m".repeat(5000) }), deps);
    assert.doesNotMatch(sent[0]!.subject, /[\r\n]/);
    assert.equal(sent[0]!.values.company.length, 160);
    assert.equal(sent[0]!.values.message.length, 2000);
    assert.equal(readContact(form({ name: "a\u0000b" })).name, "ab");
  });

  it("checkContact passes the good form", () => {
    assert.equal(checkContact(readContact(form(OK))), null);
  });
});
