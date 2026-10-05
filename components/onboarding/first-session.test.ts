// The first session (B8c): the getting-started card (what makes each step done, what is read, what the card
// draws and when it draws nothing), the three small writes, and the coach mark's gate. Supabase is a fake
// installed before the modules load; the page that carries the coach and the layout's reads are pinned in
// `app/(app)/app/record-routes.test.ts`.

import assert from "node:assert/strict";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerenderToNodeStream } from "react-dom/static";

import { checklistOf, progressLine, type Facts } from "@/lib/checklist";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");

type Reply = { data?: unknown; error?: unknown; count?: number | null };
let calls: string[] = [];
let rpcCalls: { fn: string; args: unknown }[] = [];
let replies: Record<string, Reply | "throw"> = {};
let user: { id: string } | null = { id: "u1" };

const reply = (key: string): Reply => {
  const r = replies[key];
  if (r === "throw") throw new Error("down");
  return r ?? { data: null, error: null, count: 0 };
};

{
  const server = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      calls.push(`from ${table}`);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => reply(`${table}.maybeSingle`),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(reply(`${table}.count`)).then(ok, bad);
          } catch (e) {
            return Promise.reject(e).then(ok, bad);
          }
        },
      };
      return chain;
    },
    rpc: async (fn: string, args?: unknown) => {
      calls.push(`rpc ${fn}`);
      rpcCalls.push({ fn, args });
      return reply(fn);
    },
  };
  require.cache[server] = { id: server, filename: server, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
  const cache = require.resolve("next/cache");
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the real module is kept; only the revalidation is recorded.
  const realCache = require("next/cache");
  require.cache[cache] = { id: cache, filename: cache, loaded: true, children: [], paths: [], exports: { ...realCache, revalidatePath: (p: string, t?: string) => void calls.push(`revalidate ${p} ${t ?? ""}`.trim()) } } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake above must be in place before these load.
const mod = (p: string) => require(path.join(OUT, p));
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const draw = (el: ReactElement) => plain(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el)));
async function drawAsync(el: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(AppRouterContext.Provider, { value: router as never }, el));
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  return plain(out.replace(/<!--[\s\S]*?-->/g, ""));
}
const text = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

beforeEach(() => {
  calls = [];
  rpcCalls = [];
  user = { id: "u1" };
  replies = {
    "profiles.maybeSingle": { data: { onboarding_state: { buyer_flow_done_at: "2026-10-05T09:00:00Z" } }, error: null },
    "saved_suppliers.count": { count: 1, error: null },
    "rfqs.count": { count: 0, error: null },
    settings_get: { data: { notifications: { saved_alerts: true }, inquiry: { email_template: null } }, error: null },
    workspace_team: { data: { members: [{ user_id: "u1" }], invites: [] }, error: null },
  };
});

// ---------------------------------------------------------------------------
// What makes a step done
// ---------------------------------------------------------------------------

const FACTS: Facts = { saved: 1, sourceChecked: true, rfqs: 0, alertsOn: false, template: false, invited: 0, dismissed: false, started: true };

describe("the checklist's rules", () => {
  it("six steps in Paper's order, each done only on a fact that was read", () => {
    const c = checklistOf(FACTS)!;
    assert.deepEqual(c.steps.map((s) => s.label), ["Save 3 suppliers", "Check a source", "Send your first RFQ", "Turn on certificate alerts", "Set your RFQ template", "Invite a colleague"]);
    assert.deepEqual(c.steps.map((s) => s.done), [false, true, false, false, false, false]);
    assert.equal(progressLine(c), "1 of 6 done");
  });

  it("'Save 3 suppliers' says how many are saved, until three are", () => {
    assert.equal(checklistOf(FACTS)!.steps[0]!.detail, "1 saved");
    assert.equal(checklistOf({ ...FACTS, saved: 0 })!.steps[0]!.detail, null);
    const three = checklistOf({ ...FACTS, saved: 3 })!.steps[0]!;
    assert.deepEqual([three.done, three.detail], [true, null]);
  });

  it("a fact that could not be read is not a tick and not a count", () => {
    const c = checklistOf({ saved: null, sourceChecked: null, rfqs: null, alertsOn: null, template: null, invited: null, dismissed: false, started: true })!;
    assert.equal(c.done, 0);
    assert.equal(c.steps[0]!.detail, null);
  });

  it("each step is done by its own fact", () => {
    const all = checklistOf({ saved: 3, sourceChecked: true, rfqs: 1, alertsOn: true, template: true, invited: 1, dismissed: false, started: true });
    assert.equal(all, null, "every step done: the card is not drawn");
    for (const [over, i] of [[{ rfqs: 2 }, 2], [{ alertsOn: true }, 3], [{ template: true }, 4], [{ invited: 2 }, 5]] as const) {
      assert.equal(checklistOf({ ...FACTS, ...over })!.steps[i]!.done, true, JSON.stringify(over));
    }
  });

  it("a hidden card is not drawn", () => {
    assert.equal(checklistOf({ ...FACTS, dismissed: true }), null);
  });
});

// ---------------------------------------------------------------------------
// What is read
// ---------------------------------------------------------------------------

describe("the loader", () => {
  const load = async () => mod("components/onboarding/checklist-load.js").loadChecklist(await mod("lib/supabase/server.js").createSupabaseServerClient(), "u1") as Promise<ReturnType<typeof checklistOf>>;

  it("reads the saved count, the RFQs, the alerts, the template and the team, and builds the card", async () => {
    replies["saved_suppliers.count"] = { count: 2, error: null };
    replies["rfqs.count"] = { count: 1, error: null };
    replies["workspace_team"] = { data: { members: [{}, {}], invites: [{}] }, error: null };
    replies.settings_get = { data: { notifications: { saved_alerts: true }, inquiry: { email_template: "Hello [supplier]" } }, error: null };
    replies["profiles.maybeSingle"] = { data: { onboarding_state: { buyer_flow_done_at: "2026-10-05T09:00:00Z", source_checked_at: "2026-10-05T10:00:00Z" } }, error: null };
    const c = (await load())!;
    assert.deepEqual(c.steps.map((s) => s.done), [false, true, true, true, true, true]);
    assert.equal(c.steps[0]!.detail, "2 saved");
  });

  it("a hidden card costs one read: nothing else is asked", async () => {
    replies["profiles.maybeSingle"] = { data: { onboarding_state: { buyer_flow_done_at: "2026-10-05T09:00:00Z", checklist_dismissed_at: "2026-10-05T10:00:00Z" } }, error: null };
    assert.equal(await load(), null);
    assert.deepEqual(calls, ["from profiles"]);
  });

  it("a buyer who never went through the first-run steps was here before the card: no card, one read", async () => {
    replies["profiles.maybeSingle"] = { data: { onboarding_state: { tour_completed_at: "2026-08-01T00:00:00Z" } }, error: null };
    assert.equal(await load(), null);
    assert.deepEqual(calls, ["from profiles"]);
  });

  it("a failed profile read draws nothing: neither whether it was hidden nor whether a source was opened is known", async () => {
    replies["profiles.maybeSingle"] = { data: null, error: { message: "boom" } };
    assert.equal(await load(), null);
  });

  it("each of the other reads stands alone: one that fails or throws leaves its step undone, never a 0 or a tick", async () => {
    replies["saved_suppliers.count"] = "throw";
    replies["rfqs.count"] = { count: null, error: { message: "boom" } };
    replies.settings_get = { data: null, error: { message: "boom" } };
    replies.workspace_team = "throw";
    const c = (await load())!;
    assert.equal(c.done, 0);
    assert.equal(c.steps[0]!.detail, null, "no '0 saved' from a failed count");
  });

  it("with nobody signed in there is nothing to read", async () => {
    const sb = await mod("lib/supabase/server.js").createSupabaseServerClient();
    assert.equal(await mod("components/onboarding/checklist-load.js").loadChecklist(sb, null), null);
    assert.deepEqual(calls, []);
  });
});

// ---------------------------------------------------------------------------
// What is drawn
// ---------------------------------------------------------------------------

describe("the card", () => {
  const card = (variant: "sidebar" | "phone", over: Partial<Facts> = {}) => draw(createElement(mod("components/onboarding/checklist.js").ChecklistCard, { checklist: checklistOf({ ...FACTS, ...over })!, variant }));

  it("the sidebar card: the heading, the progress, six links, the ticked one struck through, and a form to hide it", () => {
    const out = card("sidebar");
    assert.match(text(out), /Getting started 1 of 6 done/);
    assert.match(text(out), /Save 3 suppliers · 1 saved/);
    for (const href of ["/app", "/app/discover", "/app/rfqs/new", "/app/settings/notifications", "/app/settings/inquiry", "/app/settings/members"]) assert.match(out, new RegExp(`href="${href.replace(/\//g, "\\/")}"`));
    assert.match(out, /line-through[^"]*"[^>]*>(?:<span[^>]*>.*?<\/span>)*<span[^>]*>Check a source/s, "the done step is struck through");
    assert.match(out, /<button type="submit" aria-label="Hide getting started"/);
    assert.match(out, /hidden[^"]*2xl:flex/, "from 1440 only: under it the sidebar is a rail");
  });

  it("the phone card: 44 tall rows with a caret, a 44 hide button, and gone from 768", () => {
    const out = card("phone");
    assert.match(out, /md:hidden/);
    assert.match(out, /min-h-11/);
    assert.match(out, /size-11/);
    assert.match(text(out), /Getting started 1 of 6 done/);
  });

  it("the slot draws nothing when there is nothing to show, and the card when there is", async () => {
    const Slot = mod("components/onboarding/checklist.js").ChecklistSlot as (p: { supabase: unknown; userId: string | null; variant: "sidebar" }) => Promise<ReactElement | null>;
    const sb = await mod("lib/supabase/server.js").createSupabaseServerClient();
    assert.match(await drawAsync((await Slot({ supabase: sb, userId: "u1", variant: "sidebar" }))!), /Getting started/);
    replies["profiles.maybeSingle"] = { data: { onboarding_state: { buyer_flow_done_at: "x", checklist_dismissed_at: "x" } }, error: null };
    assert.equal(await Slot({ supabase: sb, userId: "u1", variant: "sidebar" }), null);
  });
});

// ---------------------------------------------------------------------------
// The writes and the coach
// ---------------------------------------------------------------------------

describe("the small writes", () => {
  const act = () => mod("components/onboarding/actions.js") as typeof import("./actions");
  const set = () => rpcCalls.find((c) => c.fn === "profile_onboarding_set")?.args as { p_key: string; p_value: unknown } | undefined;

  it("hiding the card writes its key and asks the layout to read again", async () => {
    await act().dismissChecklist();
    assert.equal(set()?.p_key, "checklist_dismissed_at");
    assert.match(String(set()?.p_value), /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(calls.includes("revalidate /app layout"));
  });

  it("'Got it' and 'a source was opened' write their own keys", async () => {
    assert.equal(await act().dismissCoach(), true);
    assert.deepEqual(set(), { p_key: "coach_source_seen", p_value: true });
    rpcCalls = [];
    assert.equal(await act().markSourceChecked(), true);
    assert.equal(set()?.p_key, "source_checked_at");
  });

  it("a failed or thrown write is false and never an error: the card or the note just shows again", async () => {
    replies.profile_onboarding_set = { data: null, error: { message: "boom" } };
    assert.equal(await act().dismissCoach(), false);
    await act().dismissChecklist();
    assert.equal(calls.some((c) => c.startsWith("revalidate")), false, "a hide that did not save does not pretend to");
    replies.profile_onboarding_set = "throw";
    assert.equal(await act().markSourceChecked(), false);
  });
});

describe("the first-results coach", () => {
  const coach = async (closeHref = "/app/discover?hs=6109") => {
    const FirstResultsCoach = mod("components/onboarding/coach.js").FirstResultsCoach as (p: { supabase: unknown; closeHref: string }) => Promise<ReactElement | null>;
    const sb = await mod("lib/supabase/server.js").createSupabaseServerClient();
    const el = await FirstResultsCoach({ supabase: sb, closeHref });
    return el ? draw(el) : null;
  };

  it("says where facts come from, once, with Got it", async () => {
    const out = (await coach())!;
    assert.match(text(out), /Every fact shows where it came from\./);
    assert.match(text(out), /Open a supplier to see each source, with the date we checked it\./);
    assert.match(text(out), /Got it/);
    assert.match(out, /role="note"/);
  });

  it("is not shown to a buyer who has seen it, signed out, or when the profile could not be read", async () => {
    replies["profiles.maybeSingle"] = { data: { onboarding_state: { coach_source_seen: true } }, error: null };
    assert.equal(await coach(), null);
    replies["profiles.maybeSingle"] = { data: null, error: { message: "boom" } };
    assert.equal(await coach(), null);
    replies["profiles.maybeSingle"] = { data: { onboarding_state: {} }, error: null };
    user = null;
    assert.equal(await coach(), null);
  });
});
