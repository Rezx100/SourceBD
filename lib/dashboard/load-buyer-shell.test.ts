// `load-buyer-shell.ts` was in no tsconfig at all — not the app's test project
// and not `tsconfig.npm-test.json` — so nothing typechecked it and nothing ran
// it, while every one of the three kit routes calls it to build the sidebar
// counts and the topbar caption a buyer reads. Its whole job is to fail soft
// without inventing a number, which is exactly the class of defect this round
// has been finding: a count that could not be read printed as `0`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadBuyerShell, recordsCaption } from "./load-buyer-shell";

type Stub = Parameters<typeof loadBuyerShell>[0];

function stub(over: {
  dashboard?: unknown;
  discover?: { data?: unknown; error?: unknown };
  rfqCount?: number | null;
  user?: { email?: string; user_metadata?: Record<string, unknown> } | null;
  throwOn?: "rpc" | "from" | "auth" | "all";
}): Stub {
  const bang = (which: "rpc" | "from" | "auth") => {
    if (over.throwOn === "all" || over.throwOn === which) throw new Error("boom");
  };
  return {
    rpc: (fn: string) => {
      bang("rpc");
      if (fn === "buyer_dashboard") return Promise.resolve({ data: over.dashboard ?? null });
      return Promise.resolve(over.discover ?? { data: [], error: null });
    },
    from: () => {
      bang("from");
      return { select: () => Promise.resolve({ count: over.rfqCount ?? null }) };
    },
    auth: {
      getUser: async () => {
        bang("auth");
        return { data: { user: over.user ?? null } };
      },
    },
  } as unknown as Stub;
}

const ROW = (total: number) => ({ slug: "aboni-knitwear-ltd", total_count: total });

describe("the buyer shell reads its counts, or says it could not", () => {
  it("a good read puts the real numbers on the sidebar and the caption", async () => {
    const { sidebar, topbar } = await loadBuyerShell(
      stub({
        dashboard: { saved_count: 12 },
        discover: { data: [ROW(10266)], error: null },
        rfqCount: 7,
        user: { email: "r@example.invalid", user_metadata: { full_name: "Rezaul Karim" } },
      }),
      "/app/discover",
    );
    assert.deepEqual(sidebar.counts, { suppliers: 10266, rfqs: 7, saved: 12 });
    assert.equal(sidebar.active, "search");
    assert.match(topbar.caption, /10,266 published suppliers/);
    assert.equal(topbar.initial, "RK");
    assert.equal(topbar.searchAction, "/app/discover");
  });

  it("a real zero stays a zero", async () => {
    const { sidebar } = await loadBuyerShell(
      stub({ dashboard: { saved_count: 0 }, discover: { data: [], error: null }, rfqCount: 0 }),
      "/app/saved",
    );
    assert.equal(sidebar.counts.saved, 0, "an account with nothing saved has saved 0, not unknown");
    assert.equal(sidebar.counts.rfqs, 0);
    assert.equal(sidebar.counts.suppliers, 0, "an empty result set genuinely matched nothing");
  });

  it("an RPC error is a count that could not be read, never a zero", async () => {
    const { sidebar, topbar } = await loadBuyerShell(
      stub({ discover: { data: null, error: { message: "nope" } } }),
      "/app/discover",
    );
    assert.equal(sidebar.counts.suppliers, null, "a failed read is not 10,266 and it is not 0");
    assert.equal(sidebar.counts.saved, null, "buyer_dashboard returned nothing; saved is unknown");
    assert.equal(topbar.caption, "published count could not be read");
    assert.doesNotMatch(topbar.caption, /\b0 published\b/);
  });

  it("every read throwing still returns a renderable shell with no invented numbers", async () => {
    const { sidebar, topbar } = await loadBuyerShell(stub({ throwOn: "all" }), "/app/rfqs");
    assert.deepEqual(sidebar.counts, { suppliers: null, rfqs: null, saved: null });
    assert.equal(topbar.initial, null);
    assert.equal(topbar.caption, "published count could not be read");
    assert.equal(sidebar.plan.name, "Free");
  });

  it("a route no nav item points at carries no active key", async () => {
    // The two saved-search routes used to name the key themselves and both
    // named "search", whose href is /app/discover — so the rail told a screen
    // reader the buyer was on a page they were not on. The key is resolved
    // from the path now, and no nav item points at either of these.
    for (const path of ["/app/searches", "/app/searches/new", "/app/nothing-here"]) {
      const { sidebar } = await loadBuyerShell(stub({}), path);
      assert.equal(sidebar.active, null, `${path} marks a nav link as the current page`);
    }
    // And the routes that do have a nav item still resolve to it.
    for (const [path, key] of [["/app/discover", "search"], ["/app/products", "products"], ["/app/saved", "saved"]] as const) {
      const { sidebar } = await loadBuyerShell(stub({}), path);
      assert.equal(sidebar.active, key, `${path} does not light its own nav item`);
    }
    // A query string or a trailing slash is the same page.
    assert.equal((await loadBuyerShell(stub({}), "/app/products?q=knit")).sidebar.active, "products");
    assert.equal((await loadBuyerShell(stub({}), "/app/products/")).sidebar.active, "products");
  });

  it("the initial falls back to the email when there is no name", async () => {
    const { topbar } = await loadBuyerShell(stub({ user: { email: "zahir@example.invalid" } }), "/app/discover");
    // Not "ZI": `initials` is a company-name helper and read ".invalid" as a
    // second word, so the avatar showed a letter of the buyer's TLD.
    assert.equal(topbar.initial, "Z");
    const anon = await loadBuyerShell(stub({ user: {} }), "/app/discover");
    assert.equal(anon.topbar.initial, null, "no email and no name is an empty avatar, not a stray letter");
    // A real name still gets both letters.
    const named = await loadBuyerShell(stub({ user: { email: "x@y.invalid", user_metadata: { full_name: "Rezaul Karim" } } }), "/app/discover");
    assert.equal(named.topbar.initial, "RK");
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
