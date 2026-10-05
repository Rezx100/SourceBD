// /api/v1/messages for gap row 9 (migration 0112), at the route: marking a conversation read,
// sending files, and opening a file. Who may, which paths are refused before the database is
// asked, what each database error becomes, and that the file link signs only for the caller.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { called, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const messages = require("./route") as typeof import("./route");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- same.
const file = require("./file/route") as typeof import("./file/route");

const THREAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ME = "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b";
const PATH = `${THREAD}/${ME}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/Tech pack.pdf`;

const post = (body: unknown) =>
  messages.POST(new Request("https://sourcebd.net/api/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const open = (thread: string, p: string) => file.GET(new Request(`https://sourcebd.net/api/v1/messages/file?thread_id=${thread}&path=${encodeURIComponent(p)}`));

beforeEach(resetFake);

describe("POST /api/v1/messages, action read", () => {
  it("marks the conversation read for the caller", async () => {
    const res = await post({ action: "read", thread_id: THREAD });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.deepEqual(called("thread_mark_read").map((c) => c.args), [{ p_thread_id: THREAD }]);
  });

  it("is 401 with no session, 400 for a bad id and 403 for a conversation that is not the caller's", async () => {
    fake.userId = null;
    fake.role = null;
    assert.equal((await post({ action: "read", thread_id: THREAD })).status, 401);
    resetFake();
    assert.equal((await post({ action: "read", thread_id: "nope" })).status, 400);
    assert.equal((await post({ action: "read" })).status, 400);
    assert.equal(called("thread_mark_read").length, 0);
    fake.answers.thread_mark_read = { data: null, error: { message: "not a participant of this thread", code: "42501" } };
    assert.equal((await post({ action: "read", thread_id: OTHER })).status, 403);
  });
});

describe("POST /api/v1/messages, action send with files", () => {
  it("sends text and files through thread_send_message_files, body trimmed", async () => {
    fake.answers.thread_send_message_files = { data: "msg-1", error: null };
    const res = await post({ action: "send", thread_id: THREAD, body: "  Tech pack attached  ", paths: [PATH] });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message_id: "msg-1" });
    assert.deepEqual(called("thread_send_message_files").map((c) => c.args), [{ p_thread_id: THREAD, p_body: "Tech pack attached", p_paths: [PATH] }]);
    assert.equal(called("thread_send_message").length, 0, "the old call is not also made");
  });

  it("sends files alone, with no body at all", async () => {
    fake.answers.thread_send_message_files = { data: "msg-2", error: null };
    assert.equal((await post({ action: "send", thread_id: THREAD, paths: [PATH] })).status, 200);
    assert.equal(called("thread_send_message_files")[0]!.args?.p_body, "");
  });

  it("refuses a path outside the conversation, too many files, a non-list and nothing to send, before the database is asked", async () => {
    const stranger = `${OTHER}/${ME}/x/a.pdf`;
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "x", paths: [stranger] })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "x", paths: Array.from({ length: 11 }, (_, i) => `${THREAD}/${ME}/r${i}/a.pdf`) })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "x", paths: PATH })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "x", paths: [7] })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "  ", paths: [] })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "x".repeat(8001), paths: [PATH] })).status, 400);
    assert.equal(called("thread_send_message_files").length, 0);
  });

  it("turns the database's codes into statuses: 403 not yours, 400 a file that was never uploaded, 401 signed out", async () => {
    for (const [code, status] of [["42501", 403], ["P0002", 400], ["22023", 400], ["28000", 401]] as const) {
      fake.answers.thread_send_message_files = { data: null, error: { message: "refused", code } };
      assert.equal((await post({ action: "send", thread_id: THREAD, body: "x", paths: [PATH] })).status, status, code);
    }
  });

  it("a plain text send is unchanged: still thread_send_message, and still 400 when empty", async () => {
    fake.answers.thread_send_message = { data: "msg-3", error: null };
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "Hello" })).status, 200);
    assert.equal(called("thread_send_message").length, 1);
    assert.equal((await post({ action: "send", thread_id: THREAD, body: "   " })).status, 400);
    assert.equal((await post({ action: "send", thread_id: THREAD })).status, 400);
  });
});

describe("GET /api/v1/messages/file", () => {
  it("signs a one-minute link under the caller's session and redirects to it, uncached", async () => {
    const res = await open(THREAD, PATH);
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") ?? "", /\/object\/sign\/message-files\/.*\?token=t$/);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    assert.deepEqual(fake.signed, [{ bucket: "message-files", path: PATH, seconds: 60 }]);
  });

  it("is 401 with no session and 400 for a bad id or a path from another conversation or with dots, and signs nothing", async () => {
    assert.equal((await open("nope", PATH)).status, 400);
    assert.equal((await open(THREAD, `${OTHER}/${ME}/x/a.pdf`)).status, 400);
    assert.equal((await open(THREAD, `${THREAD}/../${OTHER}/x/a.pdf`)).status, 400);
    assert.equal((await open(THREAD, "")).status, 400);
    fake.userId = null;
    fake.role = null;
    assert.equal((await open(THREAD, PATH)).status, 401);
    assert.deepEqual(fake.signed, []);
  });

  it("answers 404 when the bucket will not sign it for this person, and gives away nothing else", async () => {
    fake.signError = { message: "Object not found" };
    const res = await open(THREAD, PATH);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "not found" });
    assert.equal(res.headers.get("location"), null);
  });
});
