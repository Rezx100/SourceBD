// The Monday "new matches" job (gap 14), over a fake service-role client: what it reads, what it asks the
// database is new, who gets an email, and above all what it records. A search is recorded only after its
// email went out; a baseline emails nothing; sanctioned suppliers are never searched for.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { BATCH, NAMES_IN_EMAIL, runSavedSearchAlerts } from "./saved-search-alerts";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const supplier = (n: number, name = `Supplier ${String(n).padStart(3, "0")}`) => ({ id: uid(n), slug: `s-${n}`, company_name: name });

type Err = { message: string; code?: string } | null;
let calls: { fn: string; args: Record<string, unknown> }[] = [];
let due: unknown = [];
let dueError: Err = null;
/** What today's search finds, in the order the database returns it. */
let matches: ReturnType<typeof supplier>[] = [];
let discoverError: Err = null;
let freshAnswer: { data: unknown; error: Err } = { data: null, error: null };
let recordError: Err = null;
let sent: { to: string; data: Parameters<Parameters<typeof runSavedSearchAlerts>[0]["send"]>[1]; refId: string }[] = [];
let sendResult = true;

const supabase = {
  rpc: async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    if (fn === "saved_search_alerts_due") return { data: dueError ? null : due, error: dueError };
    if (fn === "discover_suppliers") {
      if (discoverError) return { data: null, error: discoverError };
      const off = Number(args.p_offset);
      const lim = Number(args.p_limit);
      return { data: matches.slice(off, off + lim).map((m) => ({ ...m, total_count: matches.length })), error: null };
    }
    if (fn === "saved_search_alert_new") return freshAnswer;
    if (fn === "saved_search_alert_record") return { data: null, error: recordError };
    return { data: {}, error: null }; // production_workers_display_batch
  },
};

const row = (id: string, over: Record<string, unknown> = {}) => ({ search_id: id, owner_id: "owner", email: "buyer@example.com", name: "Knit, Gazipur", query_state: { search: "q=knit&district=Gazipur" }, ...over });
const run = () =>
  runSavedSearchAlerts({
    supabase,
    appUrl: "https://sourcebd.test",
    send: async (to, data, refId) => {
      sent.push({ to, data, refId });
      return sendResult;
    },
  });
const of = (fn: string) => calls.filter((c) => c.fn === fn);

beforeEach(() => {
  calls = [];
  due = [row(S1)];
  dueError = null;
  matches = [supplier(1), supplier(2), supplier(3)];
  discoverError = null;
  freshAnswer = { data: null, error: null };
  recordError = null;
  sent = [];
  sendResult = true;
});

describe("saved search alerts job", () => {
  it("asks for the searches that are due, at most one batch", async () => {
    await run();
    assert.deepEqual(of("saved_search_alerts_due")[0]!.args, { p_limit: BATCH });
  });

  it("the first check is a baseline: it remembers what matches and emails nothing", async () => {
    freshAnswer = { data: null, error: null };
    const r = await run();
    assert.deepEqual(r, { due: 1, baselined: 1, emailed: 0, unchanged: 0, failed: 0, error: null });
    assert.equal(sent.length, 0);
    assert.deepEqual(of("saved_search_alert_record")[0]!.args, { p_search_id: S1, p_ids: [uid(1), uid(2), uid(3)], p_sent: false });
  });

  it("nothing new: records the check, sends nothing", async () => {
    freshAnswer = { data: [], error: null };
    const r = await run();
    assert.equal(r.unchanged, 1);
    assert.equal(sent.length, 0);
    assert.equal(of("saved_search_alert_record")[0]!.args.p_sent, false);
  });

  it("new matches: one email with the count, up to five names, the run link and the way off; then records ALL of today's matches as seen, sent", async () => {
    matches = Array.from({ length: 12 }, (_, i) => supplier(i + 1));
    freshAnswer = { data: Array.from({ length: 8 }, (_, i) => uid(i + 5)), error: null };
    const r = await run();
    assert.equal(r.emailed, 1);
    assert.equal(sent.length, 1);
    const mail = sent[0]!;
    assert.equal(mail.to, "buyer@example.com");
    assert.equal(mail.refId, S1);
    assert.equal(mail.data.newCount, 8);
    assert.equal(mail.data.names.length, NAMES_IN_EMAIL);
    assert.deepEqual(mail.data.names, ["Supplier 005", "Supplier 006", "Supplier 007", "Supplier 008", "Supplier 009"]);
    assert.equal(mail.data.searchName, "Knit, Gazipur");
    assert.match(mail.data.runUrl, /^https:\/\/sourcebd\.test\/app\/discover\?.*q=knit/);
    assert.equal(mail.data.manageUrl, "https://sourcebd.test/app/searches");
    const rec = of("saved_search_alert_record")[0]!.args;
    assert.equal(rec.p_sent, true);
    assert.equal((rec.p_ids as string[]).length, 12, "everything that matches today is now seen, not just the new ones");
    assert.deepEqual(of("saved_search_alert_new")[0]!.args, { p_search_id: S1, p_ids: (rec.p_ids as string[]) });
  });

  it("a failed send records nothing, so the new matches are told next run, not lost", async () => {
    freshAnswer = { data: [uid(2)], error: null };
    sendResult = false;
    const r = await run();
    assert.equal(r.failed, 1);
    assert.equal(r.emailed, 0);
    assert.equal(of("saved_search_alert_record").length, 0);
  });

  it("an email that went out but could not be recorded is counted failed, not emailed", async () => {
    freshAnswer = { data: [uid(2)], error: null };
    recordError = { message: "down" };
    const r = await run();
    assert.deepEqual([r.emailed, r.failed], [0, 1]);
  });

  it("the search is run for matches only: sanctioned suppliers are always hidden, even if the saved search lifted that, in name order", async () => {
    due = [row(S1, { query_state: { search: "q=knit&sanctioned=1" } })];
    await run();
    const call = of("discover_suppliers")[0]!.args;
    assert.equal(call.p_exclude_sanctioned, true);
    assert.equal(call.p_sort, "name");
    assert.equal(call.p_limit, 100);
    assert.equal(call.p_offset, 0);
  });

  it("reads every page of a long result: 250 matches are three calls and 250 ids", async () => {
    matches = Array.from({ length: 250 }, (_, i) => supplier(i + 1));
    freshAnswer = { data: [], error: null };
    await run();
    assert.deepEqual(of("discover_suppliers").map((c) => c.args.p_offset), [0, 100, 200]);
    assert.equal((of("saved_search_alert_record")[0]!.args.p_ids as string[]).length, 250);
  });

  it("stops at the ceiling instead of paging a huge result for ever", async () => {
    matches = Array.from({ length: 1500 }, (_, i) => supplier(i + 1));
    freshAnswer = { data: [], error: null };
    await run();
    assert.equal(of("discover_suppliers").length, 10);
    assert.equal((of("saved_search_alert_record")[0]!.args.p_ids as string[]).length, 1000);
  });

  it("a search that cannot be run is left alone (no check, no record) and the next one still goes", async () => {
    due = [row(S1), row(S2)];
    let first = true;
    const realRpc = supabase.rpc;
    supabase.rpc = async (fn, args) => {
      if (fn === "discover_suppliers" && first) {
        first = false;
        return { data: null, error: { message: "57014 statement timeout", code: "57014" } };
      }
      return realRpc(fn, args);
    };
    try {
      freshAnswer = { data: null, error: null };
      const r = await run();
      assert.deepEqual([r.failed, r.baselined], [1, 1]);
      assert.deepEqual(of("saved_search_alert_record").map((c) => c.args.p_search_id), [S2]);
      assert.equal(of("saved_search_alert_new").length, 1);
    } finally {
      supabase.rpc = realRpc;
    }
  });

  it("when the database cannot say what is new, nothing is recorded", async () => {
    freshAnswer = { data: null, error: { message: "boom" } };
    const r = await run();
    assert.equal(r.failed, 1);
    assert.equal(of("saved_search_alert_record").length, 0);
  });

  it("when the due list cannot be read (0113 not applied) it says so and does nothing else", async () => {
    dueError = { message: "Could not find the function public.saved_search_alerts_due", code: "PGRST202" };
    const r = await run();
    assert.match(r.error ?? "", /saved_search_alerts_due/);
    assert.equal(r.due, 0);
    assert.equal(calls.length, 1);
  });

  it("ignores a due row with no usable address or id rather than mailing nobody", async () => {
    due = [row(S1, { email: "" }), row(S2, { email: "no-at-sign" }), { search_id: null, email: "a@b.c" }, null];
    const r = await run();
    assert.equal(r.due, 0);
    assert.equal(of("discover_suppliers").length, 0);
  });

  it("an empty list of due searches is a quiet run", async () => {
    due = [];
    assert.deepEqual(await run(), { due: 0, baselined: 0, emailed: 0, unchanged: 0, failed: 0, error: null });
  });
});
