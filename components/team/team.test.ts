// Team and roles (gap 4) at the boundary: the words, the saves with an injected `fetch`, the members page
// drawn over a fake Supabase client (owner, member, empty, failed read), and the invite link's page
// (signed out, accepted, each refusal, and a token that is not one). The route is tested beside itself in
// `app/api/v1/team/route.test.ts`.

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { INVITE_NOTE, REFUSALS, ROLES, addEmails, countsLine, initialsOf, inviteExpiryWords, inviteSentWords, inviteSummary, joinedWords, lastActiveWords, parseTeam, refusalOf, removeTitle, resultsOf, sendLabel, splitEmails, type TeamDoc } from "./model";
import { cancelInvite, inviteEmails, removeMember, resendInvite, setRole, type Fetch } from "./transport";

const NOW = new Date("2026-10-05T12:00:00Z");
const OWNER = { user_id: "u-owner", name: "Alex Morgan", email: "alex.morgan@example.com", role: "owner", joined_at: null, last_active_at: new Date(Date.now() - 60_000).toISOString(), is_you: true };
const PRIYA = { user_id: "u-priya", name: "Priya Shah", email: "priya.shah@example.com", role: "approver", joined_at: "2026-09-20T00:00:00Z", last_active_at: "2026-10-02T09:00:00Z", is_you: false };
const TOM = { user_id: "u-tom", name: null, email: "tom.reid@example.com", role: "editor", joined_at: "2026-09-21T00:00:00Z", last_active_at: null, is_you: false };
const SAM = { id: "inv-sam", email: "sam.lee@example.com", role: "viewer", sent_at: "2026-10-01T10:00:00Z", expires_at: "2026-10-08T10:00:00Z", expired: false, can_resend: true };
const RAW = { owner_id: "u-owner", my_role: "owner", members: [OWNER, PRIYA, TOM], invites: [SAM] };

const team = (over: Partial<Record<string, unknown>> = {}): TeamDoc => parseTeam({ ...RAW, ...over })!;

describe("reading workspace_team()", () => {
  it("reads the owner first, the members, the invites, and who is you", () => {
    const t = team();
    assert.equal(t.myRole, "owner");
    assert.deepEqual(t.members.map((m) => [m.email, m.role, m.isYou]), [["alex.morgan@example.com", "owner", true], ["priya.shah@example.com", "approver", false], ["tom.reid@example.com", "editor", false]]);
    assert.deepEqual(t.invites.map((i) => [i.email, i.role, i.canResend]), [["sam.lee@example.com", "viewer", true]]);
  });

  it("a reply that is not the shape is null, never a half-drawn team", () => {
    for (const bad of [null, undefined, "x", {}, { ...RAW, my_role: "admin" }, { ...RAW, members: "no" }, { ...RAW, members: [{ ...PRIYA, role: "boss" }] }, { ...RAW, members: [{ ...PRIYA, email: null }] }, { ...RAW, invites: [{ ...SAM, role: "owner" }] }, { ...RAW, invites: [{ ...SAM, id: null }] }]) {
      assert.equal(parseTeam(bad), null, JSON.stringify(bad));
    }
  });
});

describe("the words", () => {
  it("counts people and the invites waiting, as Paper does", () => {
    assert.equal(countsLine(team()), "3 people · 1 invite waiting");
    assert.equal(countsLine(team({ invites: [] })), "3 people");
    assert.equal(countsLine(team({ members: [OWNER], invites: [SAM, { ...SAM, id: "i2", email: "b@example.com" }] })), "1 person · 2 invites waiting");
  });

  it("Last active: now inside ten minutes, else the day, else not yet", () => {
    assert.equal(lastActiveWords("2026-10-05T11:55:00Z", NOW), "Active now");
    assert.equal(lastActiveWords("2026-10-05T11:49:00Z", NOW), "5 Oct 2026");
    assert.equal(lastActiveWords("2026-10-02T09:00:00Z", NOW), "2 Oct 2026");
    assert.equal(lastActiveWords(null, NOW), "Not yet");
    assert.equal(lastActiveWords("garbage", NOW), "Not yet");
  });

  it("an invite says when it was sent and when it expires, or that it did", () => {
    assert.equal(inviteSentWords({ sentAt: SAM.sent_at }), "Invite sent 1 Oct 2026");
    assert.equal(inviteExpiryWords({ expiresAt: SAM.expires_at, expired: false }), "expires 8 Oct 2026");
    assert.equal(inviteExpiryWords({ expiresAt: SAM.expires_at, expired: true }), "expired 8 Oct 2026");
  });

  it("the roles are Paper's four, in its order", () => {
    assert.deepEqual(ROLES.map((r) => r.label), ["Owner", "Approver", "Editor", "Viewer"]);
    assert.equal(ROLES[3]!.line, "Reads records and downloads evidence. Can't send RFQs.");
  });

  it("the phone tile takes two letters from the name, else from the email", () => {
    assert.equal(initialsOf("Priya Shah", "p@x.co"), "PS");
    assert.equal(initialsOf("Priya", "p@x.co"), "PR");
    assert.equal(initialsOf(null, "tom.reid@example.com"), "TO");
  });

  it("the joined note names the owner and the role, and only a member sees it", () => {
    assert.equal(joinedWords(team({ my_role: "editor", members: [{ ...OWNER, is_you: false }, { ...TOM, is_you: true }] })), "You joined Alex Morgan's team as Editor.");
    assert.equal(joinedWords(team()), null);
  });
});

describe("Invite people, the pure parts", () => {
  it("splits on commas, semicolons and spaces, lower case, and drops <> around an address", () => {
    assert.deepEqual(splitEmails("A@x.co, <B@x.co>; c@x.co\nd@x.co"), ["a@x.co", "b@x.co", "c@x.co", "d@x.co"]);
    assert.deepEqual(splitEmails("   "), []);
  });

  it("a valid new address joins, a repeat does not, anything else is returned as bad", () => {
    assert.deepEqual(addEmails(["a@x.co"], "a@x.co b@x.co nope c@x"), { list: ["a@x.co", "b@x.co"], bad: ["nope", "c@x"] });
  });

  it("the button counts what it will send", () => {
    assert.equal(sendLabel(0), "Send invites");
    assert.equal(sendLabel(1), "Send 1 invite");
    assert.equal(sendLabel(3), "Send 3 invites");
    assert.match(INVITE_NOTE, /expires in 7 days/);
  });

  it("says how many went out and names each address that did not, with why", () => {
    const s = inviteSummary(resultsOf({ results: [{ email: "a@x.co", status: "sent" }, { email: "b@x.co", status: "already_member" }, { email: "c@x.co", status: "recently_sent" }, { email: "d@x.co", status: "not_emailed" }, { email: "e@x.co", status: "you" }, { email: "f@x.co", status: "weird" }] }));
    assert.equal(s.sent, 1);
    assert.equal(s.sentWords, "1 invite sent.");
    assert.deepEqual(s.problems.map((p) => p.email), ["b@x.co", "c@x.co", "d@x.co", "e@x.co"], "a status the page does not know is dropped, not guessed");
    assert.match(s.problems[0]!.words, /^b@x\.co is already on your team\.$/);
    assert.match(s.problems[2]!.words, /email could not be sent/);
    assert.deepEqual(resultsOf(null), []);
    assert.equal(inviteSummary([]).sentWords, null);
  });

  it("the remove question names the person", () => {
    assert.equal(removeTitle("Priya Shah"), "Remove Priya Shah from your team?");
  });
});

describe("the saves", () => {
  type Call = { url: string; init?: { method: string; headers?: Record<string, string>; body?: string | FormData } };
  const answering = (ok: boolean, json: unknown, calls: Call[] = []): Fetch => async (url, init) => (calls.push({ url, init }), { ok, status: ok ? 200 : 400, json: async () => json });
  const bodyOf = (c: Call) => JSON.parse(c.init!.body as string);

  it("each change is one POST to the team route with its action", async () => {
    const calls: Call[] = [];
    const deps = { fetch: answering(true, { ok: true }, calls) };
    await inviteEmails(["a@x.co"], "editor", deps);
    await resendInvite("inv-1", deps);
    await cancelInvite("inv-1", deps);
    await setRole("u-1", "viewer", deps);
    await removeMember("u-1", false, deps);
    assert.ok(calls.every((c) => c.url === "/api/v1/team" && c.init?.method === "POST"));
    assert.deepEqual(calls.map(bodyOf), [
      { action: "invite", emails: ["a@x.co"], role: "editor" },
      { action: "resend", id: "inv-1" },
      { action: "cancel", id: "inv-1" },
      { action: "set_role", member: "u-1", role: "viewer" },
      { action: "remove", member: "u-1" },
    ]);
  });

  it("says the route's own sentence, else the action's, and that nothing changed when it cannot be reached", async () => {
    const own = await inviteEmails(["a@x.co"], "editor", { fetch: answering(false, { error: "A team holds at most 50 people, invites included." }) });
    assert.deepEqual([own.ok, own.message], [false, "A team holds at most 50 people, invites included."]);
    const key = await setRole("u", "viewer", { fetch: answering(false, { error: "team call failed", detail: "42883" }) });
    assert.equal(key.message, "Could not change the role. Nothing was changed.");
    const leave = await removeMember("u", true, { fetch: answering(false, null) });
    assert.equal(leave.message, "Could not leave the team. Nothing was changed.");
    const down = await cancelInvite("i", {
      fetch: async () => {
        throw new Error("offline");
      },
    });
    assert.match(down.message ?? "", /Nothing was changed/);
  });
});

// ---------------------------------------------------------------------------
// The pages, over a fake `@/lib/supabase/server` installed before they load.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Rpc = { data: unknown; error: { message: string } | null };
const DOC = { email: "alex.morgan@example.com", display_name: "Alex Morgan", avatar_url: null, role: "buyer", plan_tier: "starter", created_at: "2026-09-01T00:00:00Z", notifications: { digest: true, rfq_replies: true, saved_alerts: false }, workspace: { company_name: "Example Apparel Ltd" } };
let teamAnswer: Rpc = { data: RAW, error: null };
let settingsAnswer: Rpc = { data: DOC, error: null };
let acceptAnswer: Rpc = { data: { owner_id: "u-owner", role: "editor" }, error: null };
let signedIn: { id: string; email: string } | null = { id: "u-1", email: "sam.lee@example.com" };
let calls: { fn: string; args?: Record<string, unknown> }[] = [];
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn } }) },
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return fn === "workspace_team" ? teamAnswer : fn === "workspace_invite_accept" ? acceptAnswer : settingsAnswer;
    },
  };
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the page modules load.
const load = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => Promise<ReactElement>;
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const MEMBERS = "app/(app)/app/settings/members/page.js";
const INVITE = "app/invite/[token]/page.js";
const members = async (joined?: string) => draw(await load(MEMBERS)({ searchParams: Promise.resolve(joined ? { joined } : {}) }));
const reset = () => {
  teamAnswer = { data: RAW, error: null };
  settingsAnswer = { data: DOC, error: null };
  acceptAnswer = { data: { owner_id: "u-owner", role: "editor" }, error: null };
  signedIn = { id: "u-1", email: "sam.lee@example.com" };
  calls = [];
};

describe("/app/settings/members as the owner", () => {
  it("draws the people, the invite waiting and Invite people, on Paper's frame with Team and roles current", async () => {
    reset();
    const out = await members();
    const t = text(out);
    assert.deepEqual(calls.map((c) => c.fn), ["settings_get", "workspace_team"], "one read of each");
    assert.match(out, /<h1[^>]*>Team and roles<\/h1>/);
    assert.equal(out.match(/<h1\b/g)?.length, 1);
    assert.match(out, /aria-current="page"[^>]*>Team and roles</);
    assert.match(t, /3 people · 1 invite waiting/);
    assert.match(t, />?Invite people/);
    for (const s of ["Alex Morgan", "alex.morgan@example.com", "Priya Shah", "priya.shah@example.com", "tom.reid@example.com", "sam.lee@example.com"]) assert.ok(t.includes(s), s);
    assert.match(t, /Alex Morgan you/);
    assert.match(t, /Active now/);
    assert.match(t, /2 Oct 2026/);
    assert.match(t, /Not yet/, "Tom has never been active");
    assert.match(t, /Invite sent 1 Oct 2026 expires 8 Oct 2026/);
  });

  it("gives each other person a role chooser and a menu, and the owner neither", async () => {
    reset();
    const out = await members();
    assert.match(out, /aria-label="Role of Priya Shah"/);
    assert.match(out, /aria-label="Role of tom\.reid@example\.com"/, "a person with no name is named by their email");
    assert.doesNotMatch(out, /aria-label="Role of Alex Morgan"/);
    assert.match(out, /aria-label="More actions for Priya Shah"/);
    assert.doesNotMatch(out, /aria-label="More actions for Alex Morgan"/);
    assert.doesNotMatch(out, /Leave team/);
  });

  it("an invite has Resend and Cancel; Resend is left out after five sends; an expired one says so", async () => {
    reset();
    let t = text(await members());
    assert.match(t, /Resend invite to sam\.lee@example\.com/);
    assert.match(t, /Cancel invite to sam\.lee@example\.com/);
    teamAnswer = { data: { ...RAW, invites: [{ ...SAM, can_resend: false, expired: true }] }, error: null };
    t = text(await members());
    assert.doesNotMatch(t, /Resend/);
    assert.match(t, /Cancel invite to sam\.lee/);
    assert.match(t, /expired 8 Oct 2026/);
  });

  it("with no invites it says only the people, and shows the roles as Paper words them", async () => {
    reset();
    teamAnswer = { data: { ...RAW, invites: [] }, error: null };
    const t = text(await members());
    assert.match(t, /3 people(?! ·)/);
    assert.doesNotMatch(t, /invite[s]? waiting/);
    assert.match(t, /What each role can do/);
    assert.match(t, /Everything, plus the plan and the team\./);
    assert.match(t, /Signs off quotes and the modern slavery statement\./);
    assert.match(t, /Each person still works in their own account/, "the page does not promise more than roles do today");
  });

  it("draws the phone's list too: a row each, with the invite as an envelope row", async () => {
    reset();
    const out = await members();
    assert.match(out, /<ul aria-label="People"[^>]*md:hidden/);
    assert.match(text(out), /Alex Morgan \(you\)/);
    assert.match(out, /aria-label="More actions for the invite to sam\.lee@example\.com"/);
  });

  it("is not the old one-person page: no contact-support fallback, no Enterprise line", async () => {
    reset();
    const t = text(await members());
    assert.doesNotMatch(t, /Contact support|Enterprise|One person today/);
  });
});

describe("/app/settings/members as a member", () => {
  const AS_EDITOR = { ...RAW, my_role: "editor", members: [{ ...OWNER, is_you: false }, { ...TOM, is_you: true }], invites: [] };

  it("sees the team, can leave it, and can change nothing", async () => {
    reset();
    teamAnswer = { data: AS_EDITOR, error: null };
    const out = await members();
    const t = text(out);
    assert.match(t, /Leave team/);
    assert.doesNotMatch(out, /Invite people|role="combobox"|aria-label="Role of|More actions for/);
    assert.match(t, /Alex Morgan/);
    assert.match(t, /tom\.reid@example\.com/);
  });

  it("never draws invites, even if the reply carried some", async () => {
    reset();
    teamAnswer = { data: { ...AS_EDITOR, invites: [SAM] }, error: null };
    const t = text(await members());
    assert.doesNotMatch(t, /sam\.lee|Resend|Cancel invite/);
  });

  it("says once, after joining, whose team it is and the role", async () => {
    reset();
    teamAnswer = { data: AS_EDITOR, error: null };
    assert.match(text(await members("1")), /You joined Alex Morgan's team as Editor\./);
    assert.doesNotMatch(text(await members()), /You joined/);
    teamAnswer = { data: RAW, error: null };
    assert.doesNotMatch(text(await members("1")), /You joined/, "the owner has nothing to be told");
  });
});

describe("/app/settings/members when it cannot be read", () => {
  it("a failed or malformed read is an error: no team, no Invite, no count", async () => {
    for (const bad of [{ data: null, error: { message: "function workspace_team() does not exist" } }, { data: null, error: null }, { data: { owner_id: "x" }, error: null }] as Rpc[]) {
      reset();
      teamAnswer = bad;
      const out = await members();
      assert.match(out, /role="alert"/);
      assert.match(text(out), /We couldn't load your team\./);
      assert.match(text(out), /Nothing on your team has changed/);
      assert.doesNotMatch(out, /Invite people|<table|Leave team/);
      assert.doesNotMatch(text(out), /\d+ (people|person)/);
      assert.match(out, /<h1[^>]*>Team and roles<\/h1>/, "the page is still the page");
    }
  });

  it("a failed settings read does not take the team with it", async () => {
    reset();
    settingsAnswer = { data: null, error: { message: "boom" } };
    const t = text(await members());
    assert.match(t, /3 people · 1 invite waiting/);
    assert.match(t, /Priya Shah/);
  });
});

// ---------------------------------------------------------------------------
// /invite/<token>
// ---------------------------------------------------------------------------

const TOKEN = "ab".repeat(32);
const invite = (token: string) => load(INVITE)({ params: Promise.resolve({ token }) });
const redirected = async (token: string): Promise<string | null> => {
  try {
    await invite(token);
    return null;
  } catch (e) {
    const digest = String((e as { digest?: string }).digest ?? "");
    return digest.startsWith("NEXT_REDIRECT") ? decodeURIComponent(digest.split(";")[2] ?? "") : null;
  }
};

describe("/invite/<token>", () => {
  it("signed out, it sends the person to sign in and brings them back to this link", async () => {
    reset();
    signedIn = null;
    assert.equal(await redirected(TOKEN), `/login?next=/invite/${TOKEN}`);
    assert.equal(calls.length, 0, "nothing is asked of the database for a stranger");
  });

  it("signed in, it joins them and opens Team and roles with the note", async () => {
    reset();
    assert.equal(await redirected(TOKEN), "/app/settings/members?joined=1");
    assert.deepEqual(calls, [{ fn: "workspace_invite_accept", args: { p_token: TOKEN } }]);
  });

  it("a token that is not the shape of one is refused without asking the database, signed in or not", async () => {
    for (const bad of ["short", "zz".repeat(32), `${TOKEN}0`, TOKEN.toUpperCase()]) {
      reset();
      const out = draw(await invite(bad));
      assert.match(text(out), new RegExp(REFUSALS.not_found.title.replace(/[.']/g, ".")));
      assert.equal(calls.length, 0, bad);
    }
  });

  for (const word of ["not_found", "expired", "wrong_email", "has_team"] as const) {
    it(`${word}: its own plain sentence, and never the token`, async () => {
      reset();
      acceptAnswer = { data: null, error: { message: word } };
      const out = draw(await invite(TOKEN));
      const t = text(out);
      assert.ok(t.includes(REFUSALS[word].title), t);
      assert.ok(t.includes(REFUSALS[word].body), t);
      assert.ok(!out.includes(TOKEN), "the token was printed");
      assert.match(out, /<h1\b/);
      assert.match(out, /href="\/app"/);
    });
  }

  it("a different address offers to sign out, and says which address you are signed in as", async () => {
    reset();
    acceptAnswer = { data: null, error: { message: "wrong_email" } };
    const out = draw(await invite(TOKEN));
    assert.match(out, /action="\/auth\/sign-out" method="post"/);
    assert.match(text(out), /You are signed in as sam\.lee@example\.com\./);
    acceptAnswer = { data: null, error: { message: "expired" } };
    assert.doesNotMatch(draw(await invite(TOKEN)), /sign-out/);
  });

  it("any other failure says nothing changed and does not guess a reason", async () => {
    reset();
    acceptAnswer = { data: null, error: { message: "function workspace_invite_accept does not exist" } };
    const t = text(draw(await invite(TOKEN)));
    assert.ok(t.includes(REFUSALS.failed.title));
    assert.ok(t.includes("Nothing was changed"));
    assert.equal(refusalOf("anything else"), "failed");
    assert.equal(refusalOf(null), "failed");
  });
});
