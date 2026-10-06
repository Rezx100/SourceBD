// /api/v1/team (gap 4, migration 0111) at the route: what it asks the database, what it emails, and what it
// answers. The raw invite token goes into one email's link and nowhere else; every refusal is a plain
// sentence (or, for a failure the page has its own words for, a key); a refused value never reaches the
// database; a missing link origin stops before any invite exists.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { called, fake, installModule, resetFake } from "../route-test-fake";

type Sent = { to: string; template: string; data: Record<string, unknown>; refId?: string | null };
const sent: Sent[] = [];
const failFor = new Set<string>();
class StubEmailError extends Error {
  code = "send_failed";
}
installModule("lib/email/send.js", {
  EmailError: StubEmailError,
  sendEmail: async (input: Sent) => {
    if (failFor.has(input.to)) throw new StubEmailError("resend said no");
    sent.push(input);
    return { id: "dev:1" };
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fakes must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const TOKEN_A = "ab".repeat(32);
const TOKEN_B = "cd".repeat(32);
const INVITE_ID = "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b";
const MEMBER_ID = "2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c";

const post = (body: unknown) =>
  POST(new Request("https://sourcebd.net/api/v1/team", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const say = async (res: Response) => (await res.json()) as Record<string, unknown>;

async function refused(body: unknown, status: number, pattern: RegExp): Promise<void> {
  const res = await post(body);
  assert.equal(res.status, status, JSON.stringify(body));
  const json = await say(res);
  assert.match(String(json.error), pattern);
  assert.equal(fake.rpcCalls.length, 0, "a refused value still reached the database");
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => {
  resetFake();
  sent.length = 0;
  failFor.clear();
  process.env.NEXT_PUBLIC_APP_URL = "https://sourcebd.net";
  fake.answers.settings_get = { data: { display_name: "Alex Morgan", email: "alex@example.com", workspace: { company_name: "Example Apparel Ltd" } }, error: null };
});
afterEach(() => {
  if (ORIGIN === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
});

describe("/api/v1/team without a session", () => {
  it("answers 401 to every action and calls nothing", async () => {
    fake.userId = null;
    for (const body of [
      { action: "invite", emails: ["a@b.co"], role: "editor" },
      { action: "resend", id: INVITE_ID },
      { action: "cancel", id: INVITE_ID },
      { action: "set_role", member: MEMBER_ID, role: "viewer" },
      { action: "remove", member: MEMBER_ID },
    ]) {
      assert.equal((await post(body)).status, 401, JSON.stringify(body));
    }
    assert.equal(fake.rpcCalls.length, 0);
    assert.equal(sent.length, 0);
  });
});

describe("POST invite", () => {
  it("invites the lower-cased, de-duplicated addresses with the role, and emails each new invite its own link", async () => {
    fake.answers.workspace_invite = {
      data: [
        { email: "sam@example.com", status: "sent", id: INVITE_ID, token: TOKEN_A },
        { email: "jo@example.com", status: "sent", id: MEMBER_ID, token: TOKEN_B },
      ],
      error: null,
    };
    const res = await post({ action: "invite", emails: [" Sam@Example.com ", "jo@example.com", "sam@example.com"], role: "editor" });
    assert.equal(res.status, 200);
    assert.deepEqual(called("workspace_invite")[0]?.args, { p_emails: ["sam@example.com", "jo@example.com"], p_role: "editor" });
    assert.deepEqual(sent.map((s) => [s.to, s.template, s.data.link]), [
      ["sam@example.com", "team_invite", `https://sourcebd.net/invite/${TOKEN_A}`],
      ["jo@example.com", "team_invite", `https://sourcebd.net/invite/${TOKEN_B}`],
    ]);
    assert.equal(sent[0]!.data.inviterName, "Alex Morgan");
    assert.equal(sent[0]!.data.companyName, "Example Apparel Ltd");
    assert.equal(sent[0]!.data.roleLabel, "Editor");
    const text = JSON.stringify(await say(res));
    assert.ok(!text.includes(TOKEN_A) && !text.includes(TOKEN_B), "a token left in the response");
    assert.deepEqual(JSON.parse(text), { ok: true, results: [{ email: "sam@example.com", status: "sent" }, { email: "jo@example.com", status: "sent" }] });
  });

  it("emails nobody for an address that was already a member, asked a moment ago, or the owner's own", async () => {
    fake.answers.workspace_invite = {
      data: [
        { email: "a@example.com", status: "already_member" },
        { email: "b@example.com", status: "recently_sent" },
        { email: "c@example.com", status: "you" },
      ],
      error: null,
    };
    const res = await post({ action: "invite", emails: ["a@example.com", "b@example.com", "c@example.com"], role: "viewer" });
    assert.deepEqual((await say(res)).results, [
      { email: "a@example.com", status: "already_member" },
      { email: "b@example.com", status: "recently_sent" },
      { email: "c@example.com", status: "you" },
    ]);
    assert.equal(sent.length, 0);
  });

  it("a failed email is 'not_emailed' for that address only; the others still go, and no token is returned", async () => {
    failFor.add("bad@example.com");
    fake.answers.workspace_invite = {
      data: [
        { email: "bad@example.com", status: "sent", id: INVITE_ID, token: TOKEN_A },
        { email: "ok@example.com", status: "sent", id: MEMBER_ID, token: TOKEN_B },
      ],
      error: null,
    };
    const res = await post({ action: "invite", emails: ["bad@example.com", "ok@example.com"], role: "approver" });
    assert.equal(res.status, 200);
    const text = JSON.stringify(await say(res));
    assert.deepEqual(JSON.parse(text).results, [{ email: "bad@example.com", status: "not_emailed" }, { email: "ok@example.com", status: "sent" }]);
    assert.ok(!text.includes(TOKEN_A), "the failed invite's token left in the response");
    assert.deepEqual(sent.map((s) => s.to), ["ok@example.com"]);
  });

  it("a sent row with no usable token is not emailed", async () => {
    fake.answers.workspace_invite = { data: [{ email: "a@example.com", status: "sent", id: INVITE_ID, token: "nope" }], error: null };
    assert.deepEqual((await say(await post({ action: "invite", emails: ["a@example.com"], role: "viewer" }))).results, [{ email: "a@example.com", status: "not_emailed" }]);
    assert.equal(sent.length, 0);
  });

  it("an email still goes when the sender's name cannot be read", async () => {
    fake.answers.settings_get = { data: null, error: { message: "boom" } };
    fake.answers.workspace_invite = { data: [{ email: "a@example.com", status: "sent", id: INVITE_ID, token: TOKEN_A }], error: null };
    await post({ action: "invite", emails: ["a@example.com"], role: "editor" });
    assert.equal(sent[0]!.data.inviterName, "A colleague");
    assert.equal(sent[0]!.data.companyName, null);
  });

  it("refuses a bad list or role with a sentence, before the database", async () => {
    await refused({ action: "invite", role: "editor" }, 400, /at least one email/i);
    await refused({ action: "invite", emails: [], role: "editor" }, 400, /at least one email/i);
    await refused({ action: "invite", emails: ["a@example.com", 5], role: "editor" }, 400, /at least one email/i);
    await refused({ action: "invite", emails: ["not an email"], role: "editor" }, 400, /not an email address\.$/);
    await refused({ action: "invite", emails: ["a@b.co"], role: "owner" }, 400, /Choose a role/);
    await refused({ action: "invite", emails: ["a@b.co"] }, 400, /Choose a role/);
    await refused({ action: "invite", emails: Array.from({ length: 21 }, (_, i) => `p${i}@example.com`), role: "viewer" }, 400, /up to 20 people/);
  });

  it("a link origin that cannot be built stops before any invite exists", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "not a url";
    const res = await post({ action: "invite", emails: ["a@example.com"], role: "editor" });
    assert.equal(res.status, 500);
    assert.equal(called("workspace_invite").length, 0, "an invite was made that nobody could be told of");
    assert.equal(sent.length, 0);
  });

  it("says the database's refusals in words: not the owner, a cap, bad input", async () => {
    const body = { action: "invite", emails: ["a@example.com"], role: "editor" };
    fake.answers.workspace_invite = { data: null, error: { message: "only the owner can change the team", code: "42501" } };
    const notOwner = await post(body);
    assert.equal(notOwner.status, 403);
    assert.equal((await say(notOwner)).error, "Only the account owner can change the team.");

    fake.answers.workspace_invite = { data: null, error: { message: "a team holds at most 50 people, invites included", code: "54000" } };
    const cap = await post(body);
    assert.equal(cap.status, 409);
    assert.equal((await say(cap)).error, "A team holds at most 50 people, invites included.");

    fake.answers.workspace_invite = { data: null, error: { message: "one of the emails is not an email address", code: "22023" } };
    const bad = await post(body);
    assert.equal(bad.status, 400);
    assert.equal((await say(bad)).error, "One of the emails is not an email address.");
    assert.equal(sent.length, 0);
  });

  it("any other failure is a key and a detail, never a sentence the page would print", async () => {
    fake.answers.workspace_invite = { data: null, error: { message: "function workspace_invite does not exist", code: "42883" } };
    const res = await post({ action: "invite", emails: ["a@example.com"], role: "editor" });
    assert.equal(res.status, 502);
    const json = await say(res);
    assert.equal(json.error, "team call failed");
    assert.equal(typeof json.detail, "string");
  });
});

describe("POST resend", () => {
  it("emails the new link, once, and returns no token", async () => {
    fake.answers.workspace_invite_resend = { data: { id: INVITE_ID, email: "sam@example.com", role: "viewer", token: TOKEN_A }, error: null };
    const res = await post({ action: "resend", id: INVITE_ID });
    assert.equal(res.status, 200);
    assert.deepEqual(called("workspace_invite_resend")[0]?.args, { p_id: INVITE_ID });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.data.link, `https://sourcebd.net/invite/${TOKEN_A}`);
    assert.equal(sent[0]!.data.roleLabel, "Viewer");
    const text = JSON.stringify(await say(res));
    assert.ok(!text.includes(TOKEN_A));
    assert.deepEqual(JSON.parse(text).results, [{ email: "sam@example.com", status: "sent" }]);
  });

  it("a failed email is said, not hidden", async () => {
    failFor.add("sam@example.com");
    fake.answers.workspace_invite_resend = { data: { id: INVITE_ID, email: "sam@example.com", role: "editor", token: TOKEN_A }, error: null };
    assert.deepEqual((await say(await post({ action: "resend", id: INVITE_ID }))).results, [{ email: "sam@example.com", status: "not_emailed" }]);
  });

  it("refuses an id that is not one, and says a resend too soon or too often in the database's words", async () => {
    await refused({ action: "resend", id: "nope" }, 400, /could not be found/);
    await refused({ action: "resend" }, 400, /could not be found/);
    fake.answers.workspace_invite_resend = { data: null, error: { message: "this invite was sent less than 10 minutes ago", code: "54000" } };
    const res = await post({ action: "resend", id: INVITE_ID });
    assert.equal(res.status, 409);
    assert.equal((await say(res)).error, "This invite was sent less than 10 minutes ago.");
    assert.equal(sent.length, 0);
  });
});

describe("POST cancel, set_role and remove", () => {
  it("cancel passes the invite's id", async () => {
    assert.equal((await post({ action: "cancel", id: INVITE_ID })).status, 200);
    assert.deepEqual(called("workspace_invite_cancel")[0]?.args, { p_id: INVITE_ID });
  });

  it("set_role passes the member and a team role, and nothing else", async () => {
    assert.equal((await post({ action: "set_role", member: MEMBER_ID, role: "approver" })).status, 200);
    assert.deepEqual(called("workspace_member_set_role")[0]?.args, { p_member: MEMBER_ID, p_role: "approver" });
    fake.rpcCalls.length = 0;
    await refused({ action: "set_role", member: MEMBER_ID, role: "owner" }, 400, /Approver, Editor or Viewer/);
    await refused({ action: "set_role", member: "nope", role: "viewer" }, 400, /could not be found/);
  });

  it("remove passes the member (the owner removes; a member leaves with their own id)", async () => {
    assert.equal((await post({ action: "remove", member: MEMBER_ID })).status, 200);
    assert.deepEqual(called("workspace_member_remove")[0]?.args, { p_member: MEMBER_ID });
    fake.rpcCalls.length = 0;
    await refused({ action: "remove", member: "nope" }, 400, /could not be found/);
  });

  it("a person or invite that is gone is a 404 with a sentence; a non-owner is a 403", async () => {
    fake.answers.workspace_member_remove = { data: null, error: { message: "no member with that id", code: "P0002" } };
    const gone = await post({ action: "remove", member: MEMBER_ID });
    assert.equal(gone.status, 404);
    assert.match(String((await say(gone)).error), /no longer there\./);
    fake.answers.workspace_member_set_role = { data: null, error: { message: "only the owner can change the team", code: "42501" } };
    assert.equal((await post({ action: "set_role", member: MEMBER_ID, role: "viewer" })).status, 403);
  });
});

describe("a bad request", () => {
  it("is a 400 for unreadable JSON and for an unknown action, and calls nothing", async () => {
    await refused("{not json", 400, /invalid json/);
    await refused({ action: "promote" }, 400, /unknown action/);
    await refused({}, 400, /unknown action/);
  });
});
