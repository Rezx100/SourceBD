// POST /api/v1/feedback at the route: signed out is 401 before anything is read, a note under 10 or over 4,000
// characters and a missing page are 400 with a sentence, a good note is stored through feedback_submit and
// answers 201 with its id, and a database failure is a plain 500 that does not repeat the database's words.
// The per-minute 429 is the middleware's `api_write` bucket: the last test pins that this route is in it.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { classifyRoute } from "@/lib/rate-limit/limits";
import { called, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const send = (body: unknown) =>
  POST(new Request("https://sourcebd.net/api/v1/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }) as never);
const GOOD = { page_path: "/app/saved", message: "  The saved list loses my filter when I go back.  " };
const sentence = async (res: Response) => String(((await res.json()) as { error?: unknown }).error);

beforeEach(() => resetFake());

describe("/api/v1/feedback", () => {
  it("answers 401 to a signed-out caller, with a good body or none, and stores nothing", async () => {
    fake.userId = null;
    for (const body of [GOOD, {}, "not json"]) {
      const res = await send(body);
      assert.equal(res.status, 401);
      assert.match(await sentence(res), /Sign in to send feedback\./);
    }
    assert.equal(called("feedback_submit").length, 0);
  });

  it("answers 400 to unreadable, short, long and page-less notes, each with a sentence, and stores nothing", async () => {
    const cases: [unknown, RegExp][] = [
      ["not json", /Could not read your note/],
      [null, /Could not read your note/],
      [{ page_path: "/app", message: "" }, /at least 10 characters/],
      [{ page_path: "/app", message: "too short" }, /at least 10 characters/],
      [{ page_path: "/app", message: "         x         " }, /at least 10 characters/],
      [{ page_path: "/app", message: "x".repeat(4001) }, /under 4,000 characters/],
      [{ page_path: "", message: "A long enough note." }, /which page/],
      [{ page_path: "/".repeat(501), message: "A long enough note." }, /which page/],
      [{ message: "A long enough note." }, /which page/],
      [{ page_path: "/app" }, /at least 10 characters/],
    ];
    for (const [body, pattern] of cases) {
      const res = await send(body);
      assert.equal(res.status, 400, JSON.stringify(body)?.slice(0, 60));
      assert.match(await sentence(res), pattern);
    }
    assert.equal(called("feedback_submit").length, 0, "a refused note still reached the database");
  });

  it("stores a good note, trimmed, with its page, and answers 201 with the row's id", async () => {
    fake.answers.feedback_submit = { data: "f0f0f0f0-0000-4000-8000-000000000001", error: null };
    const res = await send(GOOD);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { id: "f0f0f0f0-0000-4000-8000-000000000001" });
    assert.deepEqual(called("feedback_submit").map((c) => c.args), [{ p_page_path: "/app/saved", p_message: "The saved list loses my filter when I go back." }]);
  });

  it("accepts exactly 10 and exactly 4,000 characters", async () => {
    assert.equal((await send({ page_path: "/app", message: "0123456789" })).status, 201);
    assert.equal((await send({ page_path: "/app", message: "x".repeat(4000) })).status, 201);
  });

  it("answers a plain 500 when the database refuses, without repeating its words", async () => {
    fake.answers.feedback_submit = { data: null, error: { message: 'function public.feedback_submit(text, text) does not exist' } };
    const res = await send(GOOD);
    assert.equal(res.status, 500);
    const words = await sentence(res);
    assert.match(words, /Could not send your feedback/);
    assert.doesNotMatch(words, /feedback_submit|public\./);
  });

  it("sits in the middleware's api_write bucket, so a flood is answered 429 before it gets here", () => {
    assert.equal(classifyRoute("/api/v1/feedback", "POST"), "api_write");
  });
});
