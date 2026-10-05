// Sign-up, sign-in and the account states (B8a) at the boundaries a person meets: the words, each page
// as it is drawn (signed out, with and without the address cookie, a session that ended), the server
// actions (what they send to Supabase, where they redirect, what they refuse and under which field),
// the email-link callback, and the redirect the middleware builds. Supabase, the mail sender and the
// request's cookies are fakes installed before the modules load.

import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NextRequest } from "next/server";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerenderToNodeStream } from "react-dom/static";

import { AUTH_EMAIL_COOKIE, AUTH_NEXT_COOKIE, MAIL_LINKS, clock, emailRefusal, isPersonalEmail, passwordRefusal, personalProvider, safeNext, signInRefusal, signUpRefusal } from "@/components/auth/words";
import { loginRedirectSearch } from "@/lib/login-redirect";
import { classifyRoute } from "@/lib/rate-limit/limits";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type Answer = { data?: unknown; error?: { message: string } | null };
let jar = new Map<string, string>();
let sets: { name: string; value: string; opts: Record<string, unknown> }[] = [];
let deleted: string[] = [];
let calls: { fn: string; args: unknown[] }[] = [];
let answers: Record<string, Answer> = {};
let user: { id: string; email: string } | null = null;
let claims: { claims: { amr: unknown } } | null = null;
let exchange: Answer = { error: null };

const answer = (fn: string, fallback: Answer = { data: {}, error: null }) => answers[fn] ?? fallback;
const record = (fn: string) => async (...args: unknown[]) => (calls.push({ fn, args }), answer(fn));

{
  const nextHeaders = require.resolve("next/headers");
  require.cache[nextHeaders] = {
    id: nextHeaders,
    filename: nextHeaders,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      cookies: async () => ({
        get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
        set: (name: string, value: string, opts: Record<string, unknown>) => {
          jar.set(name, value);
          sets.push({ name, value, opts });
        },
        delete: (name: string) => {
          jar.delete(name);
          deleted.push(name);
        },
      }),
      headers: async () => new Headers({ host: "sourcebd.test" }),
    },
  } as unknown as NodeJS.Module;

  const server = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    auth: {
      signUp: record("signUp"),
      signInWithPassword: record("signInWithPassword"),
      signInWithOtp: record("signInWithOtp"),
      resend: record("resend"),
      resetPasswordForEmail: record("resetPasswordForEmail"),
      updateUser: record("updateUser"),
      exchangeCodeForSession: async (code: string) => (calls.push({ fn: "exchangeCodeForSession", args: [code] }), exchange),
      getUser: async () => ({ data: { user } }),
      getClaims: async () => ({ data: claims }),
    },
  };
  require.cache[server] = { id: server, filename: server, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;

  const mail = require.resolve(path.join(OUT, "lib/email/send.js"));
  require.cache[mail] = {
    id: mail,
    filename: mail,
    loaded: true,
    exports: { sendEmail: async (m: unknown) => void calls.push({ fn: "sendEmail", args: [m] }), EmailError: class EmailError extends Error {} },
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fakes above must be in place before these load.
const mod = (p: string) => require(path.join(OUT, p));
const actions = () => mod("app/(auth)/actions.js") as typeof import("./actions");
const page = (p: string) => mod(p).default as (props?: unknown) => Promise<ReactElement> | ReactElement;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
// Some pages are async server components (the split page reads the published count), which a static
// render cannot wait for; the prerender can. React's hydration comments are dropped.
async function drawAsync(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return plain(out.replace(/<!--[\s\S]*?-->/g, ""));
}
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const render = async (p: string, props?: unknown) => drawAsync(await page(p)(props));
const q = (o: Record<string, string>) => ({ searchParams: Promise.resolve(o) });

/** Where a redirect() threw to, or null when the call returned. */
async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const digest = String((e as { digest?: string }).digest ?? "");
    if (!digest.startsWith("NEXT_REDIRECT")) throw e;
    return decodeURIComponent(digest.split(";")[2] ?? "");
  }
}

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const call = (fn: string) => calls.find((c) => c.fn === fn)?.args[0] as Record<string, unknown> | undefined;

beforeEach(() => {
  jar = new Map();
  sets = [];
  deleted = [];
  calls = [];
  answers = {};
  user = null;
  claims = null;
  exchange = { error: null };
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe("the words", () => {
  it("a personal address is allowed and named; a work address is not", () => {
    assert.equal(isPersonalEmail("alex.morgan@gmail.com"), true);
    assert.equal(personalProvider("alex.morgan@gmail.com"), "Gmail");
    assert.equal(personalProvider("a@outlook.com"), "Outlook");
    assert.equal(isPersonalEmail("alex.morgan@example.com"), false);
    assert.equal(personalProvider("alex.morgan@example.com"), null);
    assert.equal(isPersonalEmail("no-at-sign"), false);
  });

  it("refuses what the server would, in Paper's words", () => {
    assert.equal(passwordRefusal("12345"), "Use at least 8 characters. This one has 5.");
    assert.equal(passwordRefusal("12345678"), null);
    assert.match(emailRefusal("nope") ?? "", /valid email/);
    assert.equal(emailRefusal(" alex@example.com "), null);
  });

  it("tells Supabase's refusals apart and never shows its own sentence", () => {
    assert.deepEqual(signUpRefusal("User already registered"), { field: "email", error: "An account already uses this email." });
    assert.equal(signUpRefusal("Password should be at least 8 characters").field, "password");
    assert.equal(signUpRefusal("email rate limit exceeded").field, null);
    assert.doesNotMatch(signUpRefusal("database error saving new user").error, /database/);
    assert.equal(signInRefusal("Email not confirmed"), "unconfirmed");
    assert.equal(signInRefusal("Invalid login credentials"), "wrong");
    assert.equal(signInRefusal("For security purposes, you can only request this after 20 seconds"), "rate");
  });

  it("only a same-origin path is a way back", () => {
    assert.equal(safeNext("/app/saved?x=1"), "/app/saved?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "evil", "/\\evil.com", "", null, undefined]) assert.equal(safeNext(bad as string), "/app", String(bad));
    assert.equal(safeNext("//evil.com", "/supplier"), "/supplier");
  });

  it("the timer reads 0:42, and the mail buttons go to the two inboxes", () => {
    assert.equal(clock(42), "0:42");
    assert.equal(clock(60), "1:00");
    assert.equal(clock(-3), "0:00");
    assert.deepEqual(MAIL_LINKS.map((m) => m.label), ["Open Gmail", "Open Outlook"]);
  });

  it("every page that resends or asks again is in the auth rate-limit bucket", () => {
    for (const p of ["/login", "/signup", "/signup/verify", "/login/sent", "/forgot-password", "/forgot-password/sent", "/reset-password", "/link-expired"]) {
      assert.equal(classifyRoute(p, "POST"), "auth", p);
    }
  });

  it("the middleware says the session ended only when a session cookie was there", () => {
    assert.equal(loginRedirectSearch("/app/saved", "?sort=name", ["theme"]), "?next=%2Fapp%2Fsaved%3Fsort%3Dname");
    assert.equal(loginRedirectSearch("/app/saved", "", ["sb-abc-auth-token.0"]), "?next=%2Fapp%2Fsaved&reason=session");
    assert.equal(loginRedirectSearch("/app", "", []), "?next=%2Fapp");
    assert.equal(loginRedirectSearch("/app/saved", "", ["sb-abc-auth-token.0", "sb-abc-auth-token.1"]), "?next=%2Fapp%2Fsaved&reason=session", "a chunked session cookie counts");
    // Asking for an email link leaves this on someone who was never signed in.
    assert.equal(loginRedirectSearch("/app", "", ["sb-abc-auth-token-code-verifier"]), "?next=%2Fapp");
  });
});

// ---------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------

describe("sign in", () => {
  it("is the form: email, password, the link instead, and the way to sign up that keeps where they were going", async () => {
    const out = await render("app/(auth)/login/page.js", q({ next: "/invite/abc" }));
    assert.match(out, /<h1[^>]*>Sign in<\/h1>/);
    assert.match(out, /name="email"/);
    assert.match(out, /name="password"/);
    assert.match(out, /name="next" value="\/invite\/abc"/);
    assert.match(text(out), /Email me a sign-in link instead/);
    assert.match(out, /href="\/signup\?next=%2Finvite%2Fabc"/);
    assert.match(out, /href="\/forgot-password"/);
    assert.match(out, /autoComplete="current-password"|autocomplete="current-password"/i);
    assert.doesNotMatch(out, /Google|Microsoft/);
  });

  it("an unsafe way back is dropped at the page, before the form carries it", async () => {
    const out = await render("app/(auth)/login/page.js", q({ next: "//evil.com" }));
    assert.match(out, /name="next" value="\/app"/);
    assert.doesNotMatch(out, /evil/);
  });

  it("a session that ended says so and offers the way back to the same page", async () => {
    const out = await render("app/(auth)/login/page.js", q({ reason: "session", next: "/app/saved" }));
    assert.match(out, /<h1[^>]*>You were signed out<\/h1>/);
    assert.match(out, /href="\/login\?next=%2Fapp%2Fsaved"/);
    assert.match(out, /href="\/login\?method=link&amp;next=%2Fapp%2Fsaved"|href="\/login\?method=link&next=%2Fapp%2Fsaved"/);
    assert.match(text(out), /Saved suppliers and RFQ drafts are kept/);
    assert.doesNotMatch(out, /name="password"/);
  });

  it("?method=link is the email alone and a link to the password", async () => {
    const out = await render("app/(auth)/login/page.js", q({ method: "link" }));
    assert.match(out, /<h1[^>]*>Get a sign-in link<\/h1>/);
    assert.doesNotMatch(out, /name="password"/);
    assert.match(out, /Sign in with a password/);
  });

  it("a page for one person carries no sample: no 0 and no invented count when the published count is unread", async () => {
    const out = await render("app/(auth)/login/page.js", q({}));
    assert.doesNotMatch(text(out), /\b0 suppliers\b/);
    assert.match(text(out), /We never score or rate a supplier/);
  });
});

describe("sign up", () => {
  it("is Paper's form: work email, password with Show, the link instead, the terms in words (no ticked box)", async () => {
    const out = await render("app/(auth)/signup/page.js", q({}));
    assert.match(out, /<h1[^>]*>Create your account<\/h1>/);
    assert.match(out, /name="role" value="buyer"/);
    assert.match(out, /name="next" value="\/app"/);
    assert.match(text(out), /Show/);
    assert.match(text(out), /Email me a sign-in link instead/);
    assert.match(text(out), /By creating an account you agree to the Terms and the Privacy notice/);
    assert.doesNotMatch(out, /type="checkbox"/);
  });

  it("a supplier signs up with a password only, and comes home to the portal", async () => {
    const out = await render("app/(auth)/signup/page.js", q({ role: "supplier" }));
    assert.match(out, /name="role" value="supplier"/);
    assert.match(out, /name="next" value="\/supplier"/);
    assert.doesNotMatch(text(out), /Email me a sign-in link instead/);
  });

  it("an invite link's way back goes through the form and to Sign in", async () => {
    const out = await render("app/(auth)/signup/page.js", q({ next: "/invite/abc" }));
    assert.match(out, /name="next" value="\/invite\/abc"/);
    assert.match(out, /href="\/login\?next=%2Finvite%2Fabc"/);
  });
});

describe("check your email", () => {
  it("names the address the sign-up kept, offers both inboxes, a resend with a timer, and a way to change it", async () => {
    jar.set(AUTH_EMAIL_COOKIE, "alex.morgan@example.com");
    const out = await render("app/(auth)/signup/verify/page.js");
    assert.match(out, /<h1[^>]*>Check your email<\/h1>/);
    assert.match(text(out), /We sent a link to alex\.morgan@example\.com/);
    assert.match(out, /href="https:\/\/mail\.google\.com\//);
    assert.match(out, /href="https:\/\/outlook\.live\.com\//);
    assert.match(out, /rel="noopener noreferrer"/);
    assert.match(text(out), /resend in 1:00/);
    assert.match(text(out), /Wrong email\?\s*Change it/);
  });

  it("with no address kept there is nothing to verify: back to the form", async () => {
    assert.equal(await redirectOf(async () => page("app/(auth)/signup/verify/page.js")()), "/signup");
    assert.equal(await redirectOf(async () => page("app/(auth)/login/sent/page.js")()), "/login");
    assert.equal(await redirectOf(async () => page("app/(auth)/forgot-password/sent/page.js")()), "/forgot-password");
  });

  it("the sign-in link page says one hour and the reset page does not say whether the address has an account", async () => {
    jar.set(AUTH_EMAIL_COOKIE, "alex.morgan@example.com");
    const sent = text(await render("app/(auth)/login/sent/page.js"));
    assert.match(sent, /We sent a sign-in link to alex\.morgan@example\.com\. It works for one hour\./);
    const reset = text(await render("app/(auth)/forgot-password/sent/page.js"));
    assert.match(reset, /If alex\.morgan@example\.com has an account, we sent a reset link/);
  });
});

describe("the states", () => {
  it("an expired link offers a new one and the password, keeping the way back", async () => {
    const out = await render("app/(auth)/link-expired/page.js", q({ next: "/invite/abc" }));
    assert.match(out, /<h1[^>]*>This link has expired<\/h1>/);
    assert.match(out, /href="\/login\?method=link&amp;next=%2Finvite%2Fabc"|href="\/login\?method=link&next=%2Finvite%2Fabc"/);
    assert.match(out, /href="\/login\?next=%2Finvite%2Fabc"/);
  });

  it("the reset page with no session is the expired state, not a form that would fail on save", async () => {
    const out = await render("app/(auth)/reset-password/page.js");
    assert.match(out, /<h1[^>]*>This link has expired<\/h1>/);
    assert.doesNotMatch(out, /name="password"/);
  });

  it("the reset page with a session names the account and asks for the new password", async () => {
    user = { id: "u1", email: "alex.morgan@example.com" };
    const out = await render("app/(auth)/reset-password/page.js");
    assert.match(out, /<h1[^>]*>Choose a new password<\/h1>/);
    assert.match(text(out), /For alex\.morgan@example\.com\./);
    assert.match(out, /name="password"/);
    assert.match(text(out), /Save and sign in/);
  });

  it("suspended says what is paused, offers support and Sign out as a POST, and gives no reason", async () => {
    const out = await render("app/suspended/page.js");
    assert.match(out, /<h1[^>]*>This account is suspended<\/h1>/);
    assert.match(out, /action="\/auth\/sign-out" method="post"/);
    assert.match(out, /href="mailto:support@sourcebd\.net/);
    assert.doesNotMatch(text(out), /administrator|violat|because/i);
  });

  it("not found is one message with a way on and a way back, and says 404", async () => {
    const out = await render("app/not-found.js");
    assert.match(out, /<h1[^>]*>We can&#x27;t find that page<\/h1>|We can't find that page/);
    assert.match(text(out), /Error 404/);
    assert.match(out, /href="\/app"/);
  });

  it("the error page keeps the person's work safe in its words and shows the reference, never the error's message", async () => {
    const Err = mod("app/error.js").default as (p: { error: Error & { digest?: string }; reset: () => void }) => ReactElement;
    const out = draw(Err({ error: Object.assign(new Error("secret internals: select * from suppliers"), { digest: "abc123" }), reset() {} }));
    assert.match(text(out), /Your searches and saved suppliers are safe/);
    assert.match(text(out), /reference abc123/);
    assert.doesNotMatch(out, /secret internals|select \*/);
    assert.match(text(out), /Try again/);
  });
});

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

describe("signUp", () => {
  const ok = { email: "alex.morgan@example.com", password: "long-enough-1" };

  it("refuses a bad address or a short password under its own field before asking Supabase", async () => {
    const a = actions();
    assert.deepEqual(await a.signUp({}, form({ ...ok, email: "nope" })), { error: "Enter a valid email address, such as you@company.com.", field: "email" });
    assert.deepEqual(await a.signUp({}, form({ ...ok, password: "12345" })), { error: "Use at least 8 characters. This one has 5.", field: "password" });
    assert.equal(calls.length, 0);
  });

  it("an address that already has an account is said under the email, with Sign in and Reset password to follow", async () => {
    answers.signUp = { data: { user: { identities: [] }, session: null }, error: null };
    assert.deepEqual(await actions().signUp({}, form(ok)), { error: "An account already uses this email.", field: "email", kind: "exists" });
    answers.signUp = { data: null, error: { message: "User already registered" } };
    assert.equal((await actions().signUp({}, form(ok))).kind, "exists");
    assert.equal(jar.size, 0, "nothing is remembered for an address that was refused");
  });

  it("with email confirmation on it keeps the address in an httpOnly cookie, sends the link back to where they were going, and shows the verify page", async () => {
    answers.signUp = { data: { user: { identities: [{}] }, session: null }, error: null };
    const to = await redirectOf(() => actions().signUp({}, form({ ...ok, next: "/invite/abc" })));
    assert.equal(to, "/signup/verify");
    const sent = call("signUp") as { email: string; options: { emailRedirectTo: string; data: { role: string } } };
    assert.equal(sent.email, "alex.morgan@example.com");
    assert.equal(sent.options.emailRedirectTo, "http://sourcebd.test/auth/callback?next=%2Finvite%2Fabc");
    assert.equal(sent.options.data.role, "buyer");
    const kept = sets.find((s) => s.name === AUTH_EMAIL_COOKIE);
    assert.equal(kept?.value, "alex.morgan@example.com");
    assert.equal(kept?.opts.httpOnly, true);
    assert.equal(kept?.opts.maxAge, 3600);
    assert.equal(sets.find((s) => s.name === AUTH_NEXT_COOKIE)?.value, "/invite/abc");
  });

  it("a way back that is not a same-origin path is replaced by the person's own home", async () => {
    answers.signUp = { data: { user: { identities: [{}] }, session: null }, error: null };
    await redirectOf(() => actions().signUp({}, form({ ...ok, next: "//evil.com" })));
    assert.equal((call("signUp") as { options: { emailRedirectTo: string } }).options.emailRedirectTo, "http://sourcebd.test/auth/callback?next=%2Fapp");
    calls = [];
    await redirectOf(() => actions().signUp({}, form({ ...ok, role: "supplier", next: "https://evil.com" })));
    assert.equal((call("signUp") as { options: { emailRedirectTo: string } }).options.emailRedirectTo, "http://sourcebd.test/auth/callback?next=%2Fsupplier");
  });

  it("with a session already (confirmation off) it goes straight to where they were going", async () => {
    answers.signUp = { data: { user: { identities: [{}] }, session: { access_token: "t" } }, error: null };
    assert.equal(await redirectOf(() => actions().signUp({}, form({ ...ok, next: "/app/saved" }))), "/app/saved");
    assert.equal(jar.size, 0);
  });

  it("a welcome email that fails never fails the sign-up", async () => {
    answers.signUp = { data: { user: { identities: [{}] }, session: null }, error: null };
    assert.equal(await redirectOf(() => actions().signUp({}, form(ok))), "/signup/verify");
    assert.equal(calls.filter((c) => c.fn === "sendEmail").length, 1);
  });
});

describe("signInWithPassword", () => {
  const ok = { email: "Alex.Morgan@Example.com", password: "long-enough-1" };

  it("a pair that does not match is a banner with the way forward, and says nothing of which half was wrong", async () => {
    answers.signInWithPassword = { data: null, error: { message: "Invalid login credentials" } };
    const s = await actions().signInWithPassword({}, form(ok));
    assert.deepEqual(s, { error: "That email and password don't match.", kind: "wrong", info: "Try again, reset your password, or get a sign-in link." });
    assert.equal(s.field, undefined);
  });

  it("an address not yet confirmed goes to the verify page with the address kept, not to a wrong-password message", async () => {
    answers.signInWithPassword = { data: null, error: { message: "Email not confirmed" } };
    assert.equal(await redirectOf(() => actions().signInWithPassword({}, form(ok))), "/signup/verify");
    assert.equal(jar.get(AUTH_EMAIL_COOKIE), "alex.morgan@example.com");
  });

  it("signs in with the address in lower case and goes to a safe way back, else to the app", async () => {
    assert.equal(await redirectOf(() => actions().signInWithPassword({}, form({ ...ok, next: "/app/saved" }))), "/app/saved");
    assert.equal((call("signInWithPassword") as { email: string }).email, "alex.morgan@example.com");
    assert.equal(await redirectOf(() => actions().signInWithPassword({}, form({ ...ok, next: "//evil.com" }))), "/app");
  });

  it("asks for what is missing under its own field, without calling Supabase", async () => {
    assert.equal((await actions().signInWithPassword({}, form({ email: "", password: "x" }))).field, "email");
    assert.deepEqual(await actions().signInWithPassword({}, form({ email: "a@example.com", password: "" })), { error: "Enter your password.", field: "password" });
    assert.equal(calls.length, 0);
  });

  it("a rate limit says to wait, not that the password is wrong", async () => {
    answers.signInWithPassword = { data: null, error: { message: "For security purposes, you can only request this after 20 seconds" } };
    assert.match((await actions().signInWithPassword({}, form(ok))).error ?? "", /Wait a minute/);
  });
});

describe("the link by email", () => {
  it("sends the link back to where they were going and shows the sent page with the address kept", async () => {
    const to = await redirectOf(() => actions().signInWithMagicLink({}, form({ email: "Alex@Example.com", next: "/app/rfqs" })));
    assert.equal(to, "/login/sent");
    const sent = call("signInWithOtp") as { email: string; options: { emailRedirectTo: string } };
    assert.equal(sent.email, "alex@example.com");
    assert.equal(sent.options.emailRedirectTo, "http://sourcebd.test/auth/callback?next=%2Fapp%2Frfqs");
    assert.equal(jar.get(AUTH_EMAIL_COOKIE), "alex@example.com");
  });

  it("an address Supabase refuses is a sentence under the email, never Supabase's own words", async () => {
    answers.signInWithOtp = { data: null, error: { message: "Unable to validate email address: invalid format" } };
    const s = await actions().signInWithMagicLink({}, form({ email: "alex@example.com" }));
    assert.equal(s.field, "email");
    assert.doesNotMatch(s.error ?? "", /Unable to validate/);
    assert.equal(jar.size, 0);
  });
});

describe("resend and change", () => {
  it("resends to the address the cookie holds, never one from the form, with the way back kept", async () => {
    jar.set(AUTH_EMAIL_COOKIE, "alex@example.com");
    jar.set(AUTH_NEXT_COOKIE, "/invite/abc");
    const s = await actions().resendSignupEmail();
    assert.match(s.info ?? "", /new link is on its way/);
    const sent = call("resend") as { type: string; email: string; options: { emailRedirectTo: string } };
    assert.equal(sent.type, "signup");
    assert.equal(sent.email, "alex@example.com");
    assert.equal(sent.options.emailRedirectTo, "http://sourcebd.test/auth/callback?next=%2Finvite%2Fabc");
  });

  it("with no cookie it asks for the address again and sends nothing", async () => {
    const s = await actions().resendSignupEmail();
    assert.match(s.error ?? "", /timed out/);
    assert.equal(calls.length, 0);
  });

  it("a rate limit says to wait", async () => {
    jar.set(AUTH_EMAIL_COOKIE, "alex@example.com");
    answers.resend = { data: null, error: { message: "email rate limit exceeded" } };
    assert.match((await actions().resendSignupEmail()).error ?? "", /Wait a minute/);
  });

  it("Change it forgets the address and goes back to the form", async () => {
    jar.set(AUTH_EMAIL_COOKIE, "alex@example.com");
    jar.set(AUTH_NEXT_COOKIE, "/invite/abc");
    assert.equal(await redirectOf(() => actions().changeSignupEmail()), "/signup");
    assert.deepEqual(deleted.sort(), [AUTH_EMAIL_COOKIE, AUTH_NEXT_COOKIE].sort());
  });
});

describe("the password reset", () => {
  it("shows the same page whether or not the address has an account", async () => {
    for (const a of [{ data: {}, error: null }, { data: null, error: { message: "User not found" } }]) {
      jar = new Map();
      answers.resetPasswordForEmail = a;
      assert.equal(await redirectOf(() => actions().requestPasswordReset({}, form({ email: "who@example.com" }))), "/forgot-password/sent");
    }
    assert.equal((call("resetPasswordForEmail") as unknown as string), "who@example.com");
  });

  it("a rate limit is the one thing it says out loud", async () => {
    answers.resetPasswordForEmail = { data: null, error: { message: "For security purposes, you can only request this after 20 seconds" } };
    assert.match((await actions().requestPasswordReset({}, form({ email: "who@example.com" }))).error ?? "", /Wait a minute/);
  });

  it("the new password is refused short, without a session, and past the window; accepted straight after the link", async () => {
    const a = actions();
    assert.deepEqual(await a.updatePassword({}, form({ password: "12345" })), { error: "Use at least 8 characters. This one has 5.", field: "password" });
    assert.match((await a.updatePassword({}, form({ password: "long-enough-1" }))).error ?? "", /Session expired/);
    user = { id: "u1", email: "alex@example.com" };
    claims = { claims: { amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - 3600 }] } };
    assert.match((await a.updatePassword({}, form({ password: "long-enough-1" }))).error ?? "", /reset link has expired/);
    assert.equal(calls.filter((c) => c.fn === "updateUser").length, 0, "a stale session does not change the password");
    claims = { claims: { amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - 30 }] } };
    assert.equal(await redirectOf(() => a.updatePassword({}, form({ password: "long-enough-1" }))), "/app");
    assert.deepEqual(call("updateUser"), { password: "long-enough-1" });
  });
});

// ---------------------------------------------------------------------------
// The email-link callback
// ---------------------------------------------------------------------------

describe("/auth/callback", () => {
  const get = async (search: string) => {
    const res = await (mod("app/auth/callback/route.js") as typeof import("../auth/callback/route")).GET(new NextRequest(`http://sourcebd.test/auth/callback${search}`));
    return { status: res.status, to: res.headers.get("location") };
  };

  it("a good code makes the session and goes to where they were going", async () => {
    const r = await get("?code=abc&next=/app/saved");
    assert.deepEqual([r.status, r.to], [307, "http://sourcebd.test/app/saved"]);
    assert.deepEqual(calls[0], { fn: "exchangeCodeForSession", args: ["abc"] });
  });

  it("a way back that is not a same-origin path goes to /app", async () => {
    assert.equal((await get("?code=abc&next=//evil.com")).to, "http://sourcebd.test/app");
    assert.equal((await get("?code=abc&next=https://evil.com")).to, "http://sourcebd.test/app");
  });

  it("a used-up or expired code is the expired page, keeping the way back, with no raw message in the address", async () => {
    exchange = { error: { message: "invalid flow state, no valid flow state found" } };
    const r = await get("?code=abc&next=/invite/abc");
    assert.equal(r.to, "http://sourcebd.test/link-expired?next=%2Finvite%2Fabc");
    assert.doesNotMatch(r.to ?? "", /flow/);
    assert.equal((await get("?code=abc")).to, "http://sourcebd.test/link-expired");
  });

  it("a refusal Supabase put in the query (otp_expired) is the expired page and nothing is exchanged", async () => {
    const r = await get("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    assert.equal(r.to, "http://sourcebd.test/link-expired");
    assert.equal(calls.length, 0);
  });
});
