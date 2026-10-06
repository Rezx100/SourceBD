// The record's two jobs (moderation plan 1e) over a fake client: the hourly run copies Auth's log then
// seals and reports both; the daily run seals, stamps the newest seal with the authority over its hash,
// stores the token bytes and time, verifies the chain, mails the seal with the token attached and notes the
// mailing; an already stamped seal is not stamped again; an authority that is down still gets the seal
// mailed (without a token, and nothing noted as mailed); no mailbox is said.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runLedgerSealJob, runLedgerStampJob, type JobAnswer, type LatestSeal, type StampMail } from "./jobs";

type Call = { fn: string; args?: Record<string, unknown> };
function client(answers: Record<string, JobAnswer | ((args?: Record<string, unknown>) => JobAnswer)>) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      const a = answers[fn];
      if (!a) return { data: null, error: { message: `no function ${fn}` } };
      return typeof a === "function" ? a(args) : a;
    },
  };
}

const LATEST: LatestSeal = { id: 9, period_start: "2026-10-06T13:00:00Z", period_end: "2026-10-06T14:00:00Z", entry_count: 12, seal_hash: "ab".repeat(32), stamped: false, tsa_url: null, tsa_time: null, mailed: false };
const TOKEN = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]);
const AT = new Date("2026-10-06T14:05:00Z");

describe("the hourly job", () => {
  it("copies Auth's log, then seals, and reports both", async () => {
    const c = client({
      ledger_copy_auth_log: { data: { copied: 3, skipped: 1 }, error: null },
      ledger_seal: { data: { sealed: 2, sealed_through: "2026-10-06T14:00:00Z", latest_seal_id: 9 }, error: null },
    });
    const run = await runLedgerSealJob(c);
    assert.deepEqual(c.calls.map((x) => x.fn), ["ledger_copy_auth_log", "ledger_seal"]);
    assert.deepEqual(run, { copied: 3, copy_error: null, sealed: 2, sealed_through: "2026-10-06T14:00:00Z", latest_seal_id: 9, error: null });
  });

  it("a failed copy does not stop the seal, and a failed seal is the run's error", async () => {
    const c = client({ ledger_copy_auth_log: { data: null, error: { message: "0132 not applied" } }, ledger_seal: { data: { sealed: 0 }, error: null } });
    const run = await runLedgerSealJob(c);
    assert.equal(run.copy_error, "0132 not applied");
    assert.equal(run.sealed, 0);
    assert.equal(run.error, null);
    const d = client({ ledger_copy_auth_log: { data: { copied: 0 }, error: null }, ledger_seal: { data: null, error: { message: "down" } } });
    assert.equal((await runLedgerSealJob(d)).error, "down");
  });
});

describe("the daily job", () => {
  const base = () => ({
    ledger_copy_auth_log: { data: { copied: 0 }, error: null } as JobAnswer,
    ledger_seal: { data: { sealed: 1, sealed_through: LATEST.period_end, latest_seal_id: 9 }, error: null } as JobAnswer,
    ledger_latest_seal: { data: { ...LATEST }, error: null } as JobAnswer,
    ledger_seal_stamp: { data: true, error: null } as JobAnswer,
    ledger_verify: { data: { ok: true, seals_checked: 9, first_broken_seal: null, why: null, unsealed_entries: 4 }, error: null } as JobAnswer,
    ledger_seal_mailed: { data: true, error: null } as JobAnswer,
  });

  it("stamps the newest seal over its hash, stores the token and the time, verifies, mails with the token attached, notes the mailing", async () => {
    const c = client(base());
    const stamped: string[] = [];
    const mails: { to: string; mail: StampMail }[] = [];
    const run = await runLedgerStampJob(c, {
      tsaUrl: "https://tsa.example/tsr",
      mailbox: "keeper@example.invalid",
      stamp: async (hash, url) => (stamped.push(`${url} ${hash}`), { token: TOKEN, genTime: AT, status: 0, tsaUrl: url }),
      send: async (to, mail) => (mails.push({ to, mail }), true),
    });
    assert.deepEqual(stamped, [`https://tsa.example/tsr ${LATEST.seal_hash}`]);
    const stored = c.calls.find((x) => x.fn === "ledger_seal_stamp")!;
    assert.deepEqual(stored.args, { p_seal_id: 9, p_tsa_url: "https://tsa.example/tsr", p_token: "\\x" + TOKEN.toString("hex"), p_tsa_time: AT.toISOString() });
    assert.equal(run.stamped, true);
    assert.equal(run.verdict?.ok, true);
    assert.equal(mails.length, 1);
    assert.equal(mails[0]?.to, "keeper@example.invalid");
    assert.equal(mails[0]?.mail.seal.id, 9);
    assert.equal(mails[0]?.mail.stamp?.tsaTime, AT.toISOString());
    assert.equal(mails[0]?.mail.attachment?.filename, "sourcebd-seal-9.tsr");
    assert.ok(mails[0]?.mail.attachment?.content.equals(TOKEN));
    assert.deepEqual(c.calls.find((x) => x.fn === "ledger_seal_mailed")?.args, { p_seal_id: 9, p_mailbox: "keeper@example.invalid" });
    assert.equal(run.mailed, true);
    assert.equal(run.error, null);
  });

  it("a seal stamped already is not stamped again, but the mail still goes with its stamp named", async () => {
    const a = base();
    a.ledger_latest_seal = { data: { ...LATEST, stamped: true, tsa_url: "https://tsa.example/tsr", tsa_time: AT.toISOString() }, error: null };
    const c = client(a);
    let asked = 0;
    const mails: StampMail[] = [];
    const run = await runLedgerStampJob(c, { tsaUrl: "https://tsa.example/tsr", mailbox: "k@example.invalid", stamp: async () => (asked++, { token: TOKEN, genTime: AT, status: 0, tsaUrl: "x" }), send: async (_to, mail) => (mails.push(mail), true) });
    assert.equal(asked, 0);
    assert.equal(c.calls.some((x) => x.fn === "ledger_seal_stamp"), false);
    assert.equal(run.stamped, true);
    assert.equal(mails[0]?.stamp?.tsaUrl, "https://tsa.example/tsr");
    assert.equal(mails[0]?.attachment, null, "no token in hand, nothing attached");
    assert.equal(c.calls.some((x) => x.fn === "ledger_seal_mailed"), false, "nothing new to note as mailed");
  });

  it("an authority that is down: the seal is still mailed, with the failure and no token, and not noted as mailed", async () => {
    const c = client(base());
    const mails: StampMail[] = [];
    const run = await runLedgerStampJob(c, {
      tsaUrl: "https://tsa.example/tsr",
      mailbox: "k@example.invalid",
      stamp: async () => {
        throw new Error("the timestamp authority answered HTTP 503");
      },
      send: async (_to, mail) => (mails.push(mail), true),
    });
    assert.equal(run.stamped, false);
    assert.match(run.stamp_error ?? "", /503/);
    assert.equal(mails.length, 1);
    assert.equal(mails[0]?.stamp, null);
    assert.match(mails[0]?.stampError ?? "", /503/);
    assert.equal(mails[0]?.seal.seal_hash, LATEST.seal_hash, "the hash still reaches the outside mailbox");
    assert.equal(run.mailed, true);
    assert.equal(c.calls.some((x) => x.fn === "ledger_seal_mailed"), false);
  });

  it("no mailbox is said; no seal is said", async () => {
    const c = client(base());
    const run = await runLedgerStampJob(c, { tsaUrl: "u", mailbox: null, stamp: async () => ({ token: TOKEN, genTime: AT, status: 0, tsaUrl: "u" }), send: async () => true });
    assert.equal(run.mail_error, "LEDGER_STAMP_MAILBOX is not set");
    const a = base();
    a.ledger_latest_seal = { data: null, error: null };
    const run2 = await runLedgerStampJob(client(a), { tsaUrl: "u", mailbox: "k", stamp: async () => ({ token: TOKEN, genTime: AT, status: 0, tsaUrl: "u" }), send: async () => true });
    assert.equal(run2.error, "no seal yet");
  });
});
