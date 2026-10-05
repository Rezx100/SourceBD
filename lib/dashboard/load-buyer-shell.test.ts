// `load-buyer-shell.ts` is what the buyer layout calls on every /app page: who is
// signed in (the frame's account menu and PostHog) and the published-supplier
// count the search landing and the sign-in frame print.
//
// Its whole job is to fail soft without inventing a number or a name, which is
// the class of defect this file guards: a count that could not be read printed
// as `0`, and an unread sign-in drawn as someone.
//
// The three counts the old rail drew (saved, RFQs, published) are not read by
// `loadBuyerShell` any more: the v4 frame shows none of them, so a test below
// pins that the layout makes exactly the two reads it needs.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadBuyerShell, readPublished, recordsCaption } from "./load-buyer-shell";

type Stub = Parameters<typeof loadBuyerShell>[0];

function stub(over: {
  settings?: { display_name?: unknown; avatar_url?: unknown } | null;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  throwOn?: "rpc" | "auth" | "all";
  calls?: string[];
}): Stub {
  const bang = (which: "rpc" | "auth") => {
    if (over.throwOn === "all" || over.throwOn === which) throw new Error("boom");
  };
  return {
    rpc: (fn: string) => {
      over.calls?.push(`rpc:${fn}`);
      bang("rpc");
      return Promise.resolve({ data: over.settings ?? null, error: null });
    },
    auth: {
      getUser: async () => {
        over.calls?.push("auth");
        bang("auth");
        return { data: { user: over.user ?? null } };
      },
    },
  } as unknown as Stub;
}

describe("the buyer shell names who is signed in, or says it could not", () => {
  it("the initial is two letters of a name, and the profile's own name and photo win", async () => {
    const { account } = await loadBuyerShell(stub({ user: { email: "r@example.invalid", user_metadata: { full_name: "Rezaul Karim" } } }));
    assert.deepEqual(account, { initial: "RK", name: "Rezaul Karim", email: "r@example.invalid", avatarUrl: null });
    const set = await loadBuyerShell(
      stub({ user: { email: "r@example.invalid", user_metadata: { full_name: "Rezaul Karim" } }, settings: { display_name: "Zahir Uddin", avatar_url: "https://img.example.invalid/z.png" } }),
    );
    assert.equal(set.account?.name, "Zahir Uddin");
    assert.equal(set.account?.initial, "ZU");
    assert.equal(set.account?.avatarUrl, "https://img.example.invalid/z.png");
  });

  it("a photo that is not an https address is not drawn", async () => {
    const { account } = await loadBuyerShell(stub({ user: { email: "r@example.invalid" }, settings: { avatar_url: "javascript:alert(1)" } }));
    assert.equal(account?.avatarUrl, null);
  });

  it("the initial falls back to the email when there is no name", async () => {
    const { account } = await loadBuyerShell(stub({ user: { email: "zahir@example.invalid" } }));
    // Not "ZI": `initials` is a company-name helper and read ".invalid" as a
    // second word, so the avatar showed a letter of the buyer's TLD.
    assert.equal(account?.initial, "Z");
    const anon = await loadBuyerShell(stub({ user: {} }));
    assert.equal(anon.account?.initial, null, "no email and no name is an empty avatar, not a stray letter");
  });

  it("names the signed-in buyer for analytics from the same read, and no one when it failed", async () => {
    assert.equal((await loadBuyerShell(stub({ user: { id: "buyer-7", email: "b@example.invalid" } }))).userId, "buyer-7");
    const failed = await loadBuyerShell(stub({ throwOn: "auth" }));
    assert.equal(failed.userId, null);
    assert.equal(failed.account, null, "an unread sign-in draws no account, not a made-up one");
    assert.deepEqual(await loadBuyerShell(stub({ throwOn: "all" })), { account: null, userId: null });
  });

  it("a failed settings read keeps the session's name", async () => {
    const { account } = await loadBuyerShell(stub({ user: { email: "r@example.invalid", user_metadata: { full_name: "Rezaul Karim" } }, throwOn: "rpc" }));
    assert.equal(account?.name, "Rezaul Karim");
  });

  it("reads who is signed in and the settings, and nothing else", async () => {
    // The old rail's saved count, RFQ count and published count were three more
    // round trips on every click, ahead of the page's own reads, for numbers the
    // v4 frame does not draw.
    const calls: string[] = [];
    await loadBuyerShell(stub({ user: { email: "a@b.invalid" }, calls }));
    assert.deepEqual([...calls].sort(), ["auth", "rpc:settings_get"]);
  });
});

describe("the published count is a count, or it is unread", () => {
  const ROW = (total: number | string) => ({ slug: "aboni-knitwear-ltd", total_count: total });
  const rpc = (r: { data?: unknown; error?: unknown }) => ({ rpc: () => Promise.resolve(r) });

  it("a good read is the number, a bigint sent as a string included", async () => {
    assert.equal(await readPublished(rpc({ data: [ROW(10266)], error: null })), 10266);
    assert.equal(await readPublished(rpc({ data: [ROW("10266")], error: null })), 10266);
  });

  it("a real zero stays a zero", async () => {
    assert.equal(await readPublished(rpc({ data: [], error: null })), 0, "an empty result set genuinely matched nothing");
  });

  it("rows that arrive and do not parse are an unread count, not a zero", async () => {
    // `parseTotalCount([])` is 0, which is right for a search that genuinely
    // matched nothing and wrong for rows that came back and failed the shape
    // check: the page then read "0 published suppliers" over a successful RPC.
    await assert.rejects(readPublished(rpc({ data: [{ not: "a row" }, { also: "not" }], error: null })), /published count not read|not parsed/);
  });

  it("an RPC error is a count that could not be read, never a zero", async () => {
    await assert.rejects(readPublished(rpc({ data: null, error: { message: "nope" } })), /published count not read/);
  });
});

describe("the records caption counts what is on the page", () => {
  it("singular, plural, and a read range when there is one", () => {
    assert.equal(recordsCaption(1, null, null), "1 record on this page");
    assert.equal(recordsCaption(4, null, null), "4 records on this page");
    assert.equal(recordsCaption(0, null, null), "0 records on this page");
    assert.match(recordsCaption(4, "2026-05-18", "2026-09-18"), /^4 records on this page, read .+/);
  });
});
