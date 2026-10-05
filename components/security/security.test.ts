// Security (row 6) at the boundary: reading the two replies it rests on, naming a browser, what each action
// asks Auth and the database for and refuses, and the page as it is drawn (off, on, a failed read, a database
// without 0115). Supabase is a fake installed before the modules load.

import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { codeRefusal, deviceLabel, deviceLine, deviceName, parseDevices, parseFactors } from "./model";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

type Reply = { data?: unknown; error?: { message: string } | null };
let calls: { fn: string; args: unknown }[] = [];
let replies: Record<string, Reply | "throw"> = {};
let user: { id: string } | null = { id: "u1" };

const reply = (key: string): Reply => {
  const r = replies[key];
  if (r === "throw") throw new Error("down");
  return r ?? { data: null, error: null };
};
const call = (key: string, args?: unknown) => (calls.push({ fn: key, args }), Promise.resolve().then(() => reply(key)));

{
  const server = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    auth: {
      getUser: async () => ({ data: { user } }),
      signOut: (a: unknown) => call("signOut", a),
      mfa: {
        listFactors: () => call("listFactors"),
        enroll: (a: unknown) => call("enroll", a),
        challengeAndVerify: (a: unknown) => call("challengeAndVerify", a),
        unenroll: (a: unknown) => call("unenroll", a),
      },
    },
    rpc: (fn: string, args?: unknown) => call(fn, args),
  };
  require.cache[server] = { id: server, filename: server, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
  const cache = require.resolve("next/cache");
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the real module is kept; only revalidation is recorded.
  const realCache = require("next/cache");
  require.cache[cache] = { id: cache, filename: cache, loaded: true, children: [], paths: [], exports: { ...realCache, revalidatePath: (p: string) => void calls.push({ fn: "revalidate", args: p }) } } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake above must be in place before these load.
const mod = (p: string) => require(path.join(OUT, p));
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
async function draw(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return plain(out.replace(/<!--[\s\S]*?-->/g, ""));
}
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const FIREFOX = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

beforeEach(() => {
  calls = [];
  user = { id: "u1" };
  replies = {
    listFactors: { data: { all: [], totp: [] }, error: null },
    account_sessions: {
      data: [
        { id: "s2", created_at: "2026-09-01T10:00:00Z", last_active_at: "2026-10-02T09:00:00Z", user_agent: SAFARI_IPHONE, is_current: false },
        { id: "s1", created_at: "2026-10-05T08:00:00Z", last_active_at: "2026-10-05T11:00:00Z", user_agent: CHROME, is_current: true },
        { id: "s3", created_at: "2026-08-01T10:00:00Z", last_active_at: "2026-09-18T09:00:00Z", user_agent: EDGE, is_current: false },
      ],
      error: null,
    },
  };
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe("naming a device", () => {
  it("from the browser's own agent: browser and system, as Paper writes them", () => {
    assert.equal(deviceName(CHROME), "Chrome on Windows");
    assert.equal(deviceName(SAFARI_IPHONE), "Safari on iPhone");
    assert.equal(deviceName(EDGE), "Edge on Windows");
    assert.equal(deviceName(FIREFOX), "Firefox on Linux");
  });

  it("a server's agent or none is not a device: the row says what it knows instead", () => {
    assert.equal(deviceName("node"), null);
    assert.equal(deviceName(""), null);
    assert.equal(deviceName(null), null);
    const d = { id: "s", startedAt: "2026-09-01T00:00:00Z", lastActiveAt: null, agent: "node", current: false };
    assert.equal(deviceLabel(d), "A browser session");
    assert.equal(deviceLine(d), "last active 1 Sep 2026");
  });

  it("this one is 'active now'; the others say when they were last active", () => {
    const base = { id: "s", startedAt: "2026-09-01T00:00:00Z", lastActiveAt: "2026-10-02T09:00:00Z", agent: CHROME };
    assert.equal(deviceLine({ ...base, current: true }), "active now");
    assert.equal(deviceLine({ ...base, current: false }), "last active 2 Oct 2026");
  });

  it("the code is six digits, spaces allowed", () => {
    assert.equal(codeRefusal("123456"), null);
    assert.equal(codeRefusal("123 456"), null);
    for (const bad of ["", "12345", "1234567", "abcdef"]) assert.match(codeRefusal(bad) ?? "", /6-digit/);
  });
});

describe("reading the replies", () => {
  it("factors: only authenticator-app ones, verified or not; a reply that is not a list is null", () => {
    assert.deepEqual(parseFactors([{ id: "f1", factor_type: "totp", status: "verified", created_at: "2026-10-01T00:00:00Z" }, { id: "f2", factor_type: "totp", status: "unverified" }, { id: "f3", factor_type: "phone", status: "verified" }]), [
      { id: "f1", verified: true, createdAt: "2026-10-01T00:00:00Z" },
      { id: "f2", verified: false, createdAt: null },
    ]);
    assert.equal(parseFactors(null), null);
    assert.equal(parseFactors("x"), null);
  });

  it("devices: this one first, then the most recently active; a row that is not the shape makes the whole read null", () => {
    const d = parseDevices(replies.account_sessions && (replies.account_sessions as Reply).data)!;
    assert.deepEqual(d.map((x) => x.id), ["s1", "s2", "s3"]);
    assert.equal(d[0]!.current, true);
    assert.equal(parseDevices([{ id: 5 }]), null);
    assert.equal(parseDevices({}), null);
    assert.deepEqual(parseDevices([]), []);
  });

  it("the address is never read: a row that carries one has it dropped", () => {
    const d = parseDevices([{ id: "s", user_agent: CHROME, is_current: true, ip: "203.0.113.5" }])!;
    assert.equal(JSON.stringify(d).includes("203.0.113"), false);
  });
});

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

const act = () => mod("components/security/actions.js") as typeof import("./actions");
const names = () => calls.map((c) => c.fn);

describe("turning two-step on", () => {
  it("removes an unfinished factor first, enrols a new one and returns its QR code and key", async () => {
    replies.listFactors = { data: { all: [{ id: "old", factor_type: "totp", status: "unverified" }, { id: "keep", factor_type: "totp", status: "verified" }] }, error: null };
    replies.enroll = { data: { id: "f9", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF" } }, error: null };
    const s = await act().startTwoStep();
    assert.deepEqual(s, { factorId: "f9", qr: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF", error: null });
    const unenrolled = calls.filter((c) => c.fn === "unenroll").map((c) => (c.args as { factorId: string }).factorId);
    assert.deepEqual(unenrolled, ["old"], "a working factor is never removed by starting again");
  });

  it("an outage is a sentence, and a signed-out caller changes nothing", async () => {
    replies.enroll = { data: null, error: { message: "boom" } };
    assert.match(((await act().startTwoStep()) as { error: string }).error, /could not do that/);
    calls = [];
    user = null;
    assert.match(((await act().startTwoStep()) as { error: string }).error, /session ended/);
    assert.deepEqual(calls, []);
  });

  it("the code proves it: a wrong one is a sentence under the field, the right one turns it on and refreshes the page", async () => {
    assert.deepEqual(await act().finishTwoStep("f9", "12345"), { ok: false, error: "Enter the 6-digit code from your app." });
    assert.deepEqual(names(), [], "a malformed code is refused before Auth is asked");
    replies.challengeAndVerify = { data: null, error: { message: "Invalid TOTP code entered" } };
    assert.deepEqual(await act().finishTwoStep("f9", "123456"), { ok: false, error: "That code doesn't match. Use the code showing in your app now." });
    replies.challengeAndVerify = { data: {}, error: null };
    assert.deepEqual(await act().finishTwoStep("f9", "123 456"), { ok: true, error: null });
    assert.deepEqual(calls.filter((c) => c.fn === "challengeAndVerify").pop()?.args, { factorId: "f9", code: "123456" });
    assert.ok(names().includes("revalidate"));
  });

  it("a rate limit says to wait, never 'wrong code'", async () => {
    replies.challengeAndVerify = { data: null, error: { message: "For security purposes, you can only request this after 20 seconds" } };
    assert.match(((await act().finishTwoStep("f9", "123456")) as { error: string }).error, /Wait a minute/);
  });

  it("closing before the code removes the unfinished factor and never a working one", async () => {
    replies.listFactors = { data: { all: [{ id: "f9", status: "unverified" }, { id: "w", status: "verified" }] }, error: null };
    await act().cancelTwoStep("f9");
    await act().cancelTwoStep("w");
    assert.deepEqual(calls.filter((c) => c.fn === "unenroll").map((c) => (c.args as { factorId: string }).factorId), ["f9"]);
  });
});

describe("turning two-step off", () => {
  it("asks for a current code before it removes the factor", async () => {
    replies.listFactors = { data: { all: [{ id: "f1", factor_type: "totp", status: "verified" }], totp: [{ id: "f1" }] }, error: null };
    replies.challengeAndVerify = { data: null, error: { message: "Invalid TOTP code entered" } };
    assert.match(((await act().turnOffTwoStep("123456")) as { error: string }).error, /doesn't match/);
    assert.equal(names().includes("unenroll"), false, "a wrong code leaves the protection on");
    replies.challengeAndVerify = { data: {}, error: null };
    assert.deepEqual(await act().turnOffTwoStep("123456"), { ok: true, error: null });
    assert.deepEqual(calls.filter((c) => c.fn === "unenroll").pop()?.args, { factorId: "f1" });
  });

  it("a malformed code, no factor or no session changes nothing", async () => {
    assert.equal((await act().turnOffTwoStep("1")).ok, false);
    assert.equal((await act().turnOffTwoStep("123456")).ok, false, "no verified factor to turn off");
    user = null;
    assert.match(((await act().turnOffTwoStep("123456")) as { error: string }).error, /session ended/);
    assert.equal(names().includes("unenroll"), false);
  });
});

describe("ending devices", () => {
  it("ends one other device by id through the database, and refreshes the page", async () => {
    assert.deepEqual(await act().endDevice("11111111-2222-4333-8444-555555555555"), { ok: true, error: null });
    assert.deepEqual(calls.find((c) => c.fn === "account_session_end")?.args, { p_session_id: "11111111-2222-4333-8444-555555555555" });
    assert.ok(names().includes("revalidate"));
  });

  it("an id that is not one is refused before the database is asked; an error is a sentence", async () => {
    assert.equal((await act().endDevice("'; drop table x;--")).ok, false);
    assert.equal(names().includes("account_session_end"), false);
    replies.account_session_end = { data: null, error: { message: "boom" } };
    assert.match(((await act().endDevice("11111111-2222-4333-8444-555555555555")) as { error: string }).error, /could not do that/);
  });

  it("'Sign out everywhere else' is Auth's others scope, and nothing without a session", async () => {
    assert.deepEqual(await act().signOutOtherDevices(), { ok: true, error: null });
    assert.deepEqual(calls.find((c) => c.fn === "signOut")?.args, { scope: "others" });
    calls = [];
    user = null;
    assert.equal((await act().signOutOtherDevices()).ok, false);
    assert.deepEqual(calls, []);
  });
});

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const page = async () => draw(await mod("app/(app)/app/settings/security/page.js").default());

describe("/app/settings/security", () => {
  it("off: Paper's cards, this device first, Sign out on the others, 'Sign out everywhere else'", async () => {
    replies.settings_get = { data: { email: "alex.morgan@example.com", plan_tier: "free" }, error: null };
    const out = await page();
    const t = text(out);
    assert.match(out, /<h1[^>]*>Security<\/h1>/);
    assert.match(t, /Two-step sign-in Off/);
    assert.match(t, /Ask for a code from an authenticator app when you sign in\./);
    assert.match(t, />?Turn on/);
    assert.match(t, /Where you.re signed in 3 devices/);
    assert.ok(t.indexOf("Chrome on Windows") < t.indexOf("Safari on iPhone") && t.indexOf("Safari on iPhone") < t.indexOf("Edge on Windows"), "this device first, then by recent use");
    assert.match(t, /This browser · active now/);
    assert.match(t, /last active 2 Oct 2026/);
    assert.equal((out.match(/aria-label="Sign out (Safari|Edge)/g) ?? []).length, 2, "the other two have Sign out; this one does not");
    assert.match(t, /Sign out everywhere else/);
    assert.match(t, /Change it on your Profile/);
    assert.match(t, /Single sign-on \(SAML\) comes with Enterprise\./);
    assert.match(out, /aria-current="page"[^>]*>Security</, "Security is the current item in Settings");
    assert.doesNotMatch(t, /\b\d{1,3}(\.\d{1,3}){3}\b/, "no address anywhere");
  });

  it("on: says so, offers Turn off, and keeps the lost-phone line", async () => {
    replies.listFactors = { data: { all: [{ id: "f1", factor_type: "totp", status: "verified" }], totp: [{ id: "f1" }] }, error: null };
    const t = text(await page());
    assert.match(t, /Two-step sign-in On/);
    assert.match(t, /Turn off/);
    assert.match(t, /If you lose your phone, contact support/);
  });

  it("a failed factors read is not 'off', and a failed device list is not 'no other devices'", async () => {
    replies.listFactors = { data: null, error: { message: "boom" } };
    replies.account_sessions = { data: null, error: { message: "function does not exist" } };
    const out = await page();
    const t = text(out);
    assert.match(t, /couldn.t load this setting/);
    assert.doesNotMatch(t, /Two-step sign-in (On|Off)/);
    assert.match(t, /couldn.t load your devices/);
    assert.doesNotMatch(t, /1 device|0 devices|Sign out everywhere else/);
  });

  it("one device only: no 'Sign out everywhere else'", async () => {
    replies.account_sessions = { data: [{ id: "s1", created_at: "2026-10-05T08:00:00Z", last_active_at: "2026-10-05T11:00:00Z", user_agent: CHROME, is_current: true }], error: null };
    const t = text(await page());
    assert.match(t, /1 device/);
    assert.doesNotMatch(t, /Sign out everywhere else/);
  });
});
