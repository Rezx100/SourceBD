import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  LIST_LIMIT,
  MAX_SAVED_SEARCH_CHARS,
  runSavedSearchesDelete,
  runSavedSearchesGet,
  runSavedSearchesPost,
  savedCountLabel,
} from "./saved-searches";

/**
 * A stub that actually applies the filters it is given.
 *
 * The previous version defined `eq: () => api`, discarding both arguments and
 * returning every seeded row regardless. Under it, deleting `.eq("owner_id",
 * ownerId)` from both the GET and the DELETE path in `saved-searches.ts` left
 * all seven tests green — so nothing here guarded owner isolation at all, which
 * is the single most important property of this endpoint. Recording the filters
 * and applying them makes that property falsifiable: `matchedRows` and
 * `deleteFilters` below are what the assertions read.
 */
function clientOver(over: {
  userId?: string | null;
  rows?: Record<string, unknown>[];
  insertError?: string | null;
  /** SQLSTATE on the insert error, as PostgREST reports it. */
  insertCode?: string;
  inserted?: unknown[];
  /** Filters seen on the delete chain, in call order. */
  deleteFilters?: [string, unknown][];
} = {}) {
  const rows = over.rows ?? [];
  const inserted = over.inserted;
  return {
    rpc: async () => ({ data: [{ total_count: 12 }], error: null }),
    from() {
      const filters: [string, unknown][] = [];
      let deleting = false;
      const matched = () =>
        rows.filter((r) => filters.every(([col, val]) => r[col] === val));
      const api = {
        select: () => api,
        insert: async (row: unknown) => {
          inserted?.push(row);
          return { data: { id: "n" }, error: over.insertError ? { message: over.insertError, code: over.insertCode } : null };
        },
        update: () => api,
        delete: () => {
          deleting = true;
          return api;
        },
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          if (deleting) over.deleteFilters?.push([col, val]);
          return api;
        },
        // `.limit()` was added to the production query after this stub was
        // written, and `order` resolving instead of returning the chain turned
        // the owner-isolation tests — the whole point of this stub — into a
        // TypeError. The chain must stay a chain; only `then` resolves.
        order: () => api,
        limit: () => api,
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: matched(), error: null }),
      };
      return api;
    },
    auth: {
      getUser: async () => ({ data: { user: over.userId === null ? null : { id: over.userId ?? "user-1" } } }),
    },
  };
}

const OWNER = "user-1";
const STRANGER = "user-2";
const ROW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function savedRow(ownerId: string, id = ROW_ID): Record<string, unknown> {
  return {
    id,
    owner_id: ownerId,
    name: "Knit",
    query_state: { search: "q=knit&hs=6105" },
    created_at: "2026-09-21T00:00:00Z",
    last_count: 12,
    last_counted_at: new Date().toISOString(),
  };
}

describe("saved-searches API boundary", () => {
  it("GET 401 when the caller is not a buyer", async () => {
    const res = await runSavedSearchesGet({ role: null, supabase: clientOver() });
    assert.equal(res.status, 401);
  });

  it("POST 401 when the caller is not a buyer", async () => {
    const res = await runSavedSearchesPost({
      role: "supplier",
      supabase: clientOver(),
      raw: { name: "Knit", search: "q=knit" },
    });
    assert.equal(res.status, 401);
  });

  it("POST 400 on a missing name", async () => {
    const res = await runSavedSearchesPost({
      role: "buyer",
      supabase: clientOver(),
      raw: { search: "q=knit" },
    });
    assert.equal(res.status, 400);
  });

  it("POST 200 stores the query string", async () => {
    const inserted: unknown[] = [];
    const res = await runSavedSearchesPost({
      role: "buyer",
      supabase: clientOver({ inserted }),
      raw: { name: "Knitted shirts", search: "q=knit&hs=6105" },
    });
    assert.equal(res.status, 200);
    const row = inserted[0] as { owner_id: string; name: string; query_state: { search: string } };
    assert.equal(row.owner_id, "user-1");
    assert.equal(row.name, "Knitted shirts");
    assert.match(row.query_state.search, /q=knit/);
    assert.match(row.query_state.search, /hs=6105/);
  });

  it("the database's refusals come back as reasons, never a 500 carrying Postgres's text", async () => {
    const at = (insertCode: string) =>
      runSavedSearchesPost({
        role: "buyer",
        supabase: clientOver({ insertError: 'new row violates "saved_searches_x"', insertCode }),
        raw: { name: "Knit", search: "q=knit" },
      });
    const cap = await at("54000");
    assert.equal(cap.status, 409);
    assert.equal((cap.body as { error?: string }).error, "saved search limit reached");
    const size = await at("23514");
    assert.equal(size.status, 400);
    const other = await at("XX000");
    assert.equal(other.status, 500);
    for (const r of [cap, size, other]) assert.doesNotMatch(JSON.stringify(r.body), /violates|saved_searches_x/);
  });

  it("the longest search a URL can carry saves, and the app's cap stays under 0104's 8 KB state bound", async () => {
    // The keyword is capped at parse (Q_MAX), so the longest search the page
    // will run is full district and city lists: 30 values of 80 characters
    // each (LIST_MAX, LIST_VALUE_MAX). It must save — a 4,000-character cap
    // once refused a search the buyer had just run — and the cap plus the
    // JSON wrapper must stay under the database's bound, or an over-cap
    // search is a bare 500 carrying Postgres's text instead of a reason.
    const list = (p: string) => Array.from({ length: 30 }, (_, i) => `${p}${i}`.padEnd(80, "x")).join(",");
    const inserted: { query_state?: { search?: string } }[] = [];
    const res = await runSavedSearchesPost({
      role: "buyer",
      supabase: clientOver({ inserted }),
      raw: { name: "Long", search: `district=${list("d")}&city=${list("c")}` },
    });
    assert.equal(res.status, 200, `the longest search a URL can carry was refused — over the app's cap (${MAX_SAVED_SEARCH_CHARS})? ${JSON.stringify(res.body)}`);
    assert.equal(inserted.length, 1);
    const stored = inserted[0]?.query_state?.search ?? "";
    assert.ok(stored.length > 4000, `the longest search serialises to ${stored.length} characters; the fixture no longer exercises the cap`);
    assert.ok(stored.length <= MAX_SAVED_SEARCH_CHARS, `the longest search a URL can carry (${stored.length}) is over the app's cap (${MAX_SAVED_SEARCH_CHARS}), so it cannot be saved`);
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8");
    const bound = Number(sql.match(/octet_length\(query_state::text\) <= (\d+)/)?.[1]);
    assert.ok(bound > 0, "0104 no longer bounds query_state");
    const atCap = Buffer.byteLength(JSON.stringify({ search: "x".repeat(MAX_SAVED_SEARCH_CHARS) }));
    assert.ok(atCap <= bound, `a search at the app's cap is ${atCap} bytes stored, over 0104's 8 KB state bound (${bound})`);
  });

  it("0104's per-owner row cap is the list's own limit, so no saved search is out of reach", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8")
      .split("\n")
      .map((l) => (l.includes("--") ? l.slice(0, l.indexOf("--")) : l))
      .join("\n");
    const fn = sql.slice(sql.indexOf("function public.saved_searches_owner_cap()"));
    const m = fn.match(/\)\s*>=\s*(\d+)\s+then/);
    assert.ok(m, "no cap found in saved_searches_owner_cap");
    assert.equal(Number(m[1]), LIST_LIMIT);
    assert.match(fn.slice(0, 400), /security invoker/i, "a definer count leaks another owner's row count");
  });

  it("GET 200 returns the stored href", async () => {
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: clientOver({ rows: [savedRow(OWNER)] }),
    });
    assert.equal(res.status, 200);
    const body = res.body as { searches: { name: string; href: string; last_count: number }[] };
    assert.equal(body.searches[0]?.name, "Knit");
    assert.equal(body.searches[0]?.href, "/app/discover?q=knit&hs=6105");
    assert.equal(body.searches[0]?.last_count, 12);
  });

  it("GET never returns another buyer's saved search", async () => {
    // Goes red if `.eq("owner_id", ownerId)` is dropped from the GET path:
    // the stranger's row is the only row seeded, so without the filter it
    // comes back and the caller reads someone else's saved query.
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: clientOver({ userId: OWNER, rows: [savedRow(STRANGER, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")] }),
    });
    assert.equal(res.status, 200);
    const body = res.body as { searches: unknown[] };
    assert.deepEqual(body.searches, [], "a row owned by another user must not be returned");
  });

  it("DELETE is scoped to the caller, not just to the row id", async () => {
    // Goes red if `.eq("owner_id", ownerId)` is dropped from the DELETE path.
    // Asserting the status alone cannot catch that — an unscoped delete also
    // returns 200, while having removed a stranger's row.
    const deleteFilters: [string, unknown][] = [];
    const res = await runSavedSearchesDelete({
      role: "buyer",
      supabase: clientOver({ userId: OWNER, rows: [savedRow(OWNER)], deleteFilters }),
      id: ROW_ID,
    });
    assert.equal(res.status, 200);
    assert.ok(
      deleteFilters.some(([col, val]) => col === "owner_id" && val === OWNER),
      `delete must filter on owner_id; saw ${JSON.stringify(deleteFilters)}`,
    );
    assert.ok(
      deleteFilters.some(([col, val]) => col === "id" && val === ROW_ID),
      `delete must filter on id; saw ${JSON.stringify(deleteFilters)}`,
    );
  });

  it("DELETE 400 on a non-uuid id", async () => {
    const res = await runSavedSearchesDelete({
      role: "admin",
      supabase: clientOver(),
      id: "not-a-uuid",
    });
    assert.equal(res.status, 400);
  });

  it("DELETE 200 on a uuid for the signed-in owner", async () => {
    const res = await runSavedSearchesDelete({
      role: "admin",
      supabase: clientOver(),
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(res.status, 200);
  });
});

/**
 * Only `MAX_REFRESH_PER_CALL` stale counts refresh per call. That ceiling is
 * deliberate — without it one GET became a full `discover_suppliers` scan per
 * saved search — but it turns most of what the list returns into a remembered
 * number, and nothing in the response or the page said which. Two properties
 * follow, and neither existed: the response has to carry when each count was
 * taken, and the budget has to reach every row eventually rather than being
 * spent on the same newest ten forever.
 */
describe("saved-search counts say how old they are", () => {
  const MINUTE = 60_000;
  const NOW = new Date("2026-09-22T12:00:00.000Z");

  /** Records which row ids the refresh actually wrote back to. */
  function agingClient(rows: Record<string, unknown>[], refreshedIds: string[]) {
    return {
      rpc: async () => ({ data: [{ total_count: 99 }], error: null }),
      from() {
        let updating = false;
        const api = {
          select: () => api,
          insert: async () => ({ data: null, error: null }),
          update: () => {
            updating = true;
            return api;
          },
          delete: () => api,
          eq: (col: string, val: unknown) => {
            if (updating && col === "id") refreshedIds.push(String(val));
            return api;
          },
          order: () => api,
          limit: () => api,
          then: (resolve: (v: { data: unknown; error: null }) => void) =>
            resolve({ data: rows, error: null }),
        };
        return api;
      },
      auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
    };
  }

  /** `n` rows, each staler than the last: row i was counted i hours ago. */
  function staleRows(n: number): Record<string, unknown>[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      owner_id: OWNER,
      name: `S${i}`,
      query_state: { search: `q=s${i}` },
      created_at: "2026-09-21T00:00:00Z",
      last_count: 5,
      last_counted_at: new Date(NOW.getTime() - (i + 1) * 60 * MINUTE).toISOString(),
    }));
  }

  it("a count refresh never pays for the saved search's expensive sort", async () => {
    // hs_lines / cert_expiry cost a full-corpus pass per call (0104), and a
    // count does not depend on order — so up to ten refreshes per GET must
    // not each run one.
    const sorts: unknown[] = [];
    const client = agingClient(
      staleRows(3).map((r) => ({ ...r, query_state: { search: "q=knit&sort=hs_lines" } })),
      [],
    );
    client.rpc = async (_fn?: string, args?: Record<string, unknown>) => {
      sorts.push(args?.p_sort);
      return { data: [{ total_count: 99 }], error: null };
    };
    const res = await runSavedSearchesGet({ role: "buyer", supabase: client, now: NOW });
    assert.equal(res.status, 200);
    assert.ok(sorts.length > 0, "no refresh ran, so the assertion below is vacuous");
    for (const s of sorts.filter((x) => x !== undefined)) assert.equal(s, "receipts");
  });

  it("spends the refresh budget on the stalest rows, not the first ten listed", async () => {
    // The list arrives newest-first, so the freshest counts are at the top.
    // Refreshing in list order meant ids 0–9 were refreshed on every call and
    // id-19 — three hours stale and getting worse — never was.
    const refreshed: string[] = [];
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: agingClient(staleRows(20), refreshed),
      now: NOW,
    });
    assert.equal(res.status, 200);
    assert.equal(refreshed.length, 10, `refreshed ${refreshed.length}, expected the 10-per-call ceiling`);
    assert.deepEqual(
      refreshed.slice().sort(),
      ["id-10", "id-11", "id-12", "id-13", "id-14", "id-15", "id-16", "id-17", "id-18", "id-19"].sort(),
      "the budget went to the newest rows, so the oldest counts never refresh",
    );
  });

  it("marks every count with when it was taken", async () => {
    const res = await runSavedSearchesGet({
      role: "buyer",
      supabase: agingClient(staleRows(20), []),
      now: NOW,
    });
    const searches = (res.body as { searches: { id: string; last_counted_at: string | null }[] }).searches;
    assert.equal(searches.length, 20);
    for (const s of searches) {
      assert.ok(s.last_counted_at, `${s.id} carries no last_counted_at, so the page cannot say how old it is`);
    }
    // The refreshed ones are stamped now; the rest keep their own older stamp.
    const refreshedStamp = searches.filter((s) => s.last_counted_at === NOW.toISOString());
    assert.equal(refreshedStamp.length, 10);
  });

  it("never prints a remembered count as if it were live", () => {
    assert.equal(savedCountLabel(null, null, NOW), "not counted yet");
    assert.equal(savedCountLabel(3481, NOW.toISOString(), NOW), "3,481 suppliers, just now");
    assert.equal(
      savedCountLabel(3481, new Date(NOW.getTime() - 5 * MINUTE).toISOString(), NOW),
      "3,481 suppliers, as of 5 min ago",
    );
    assert.equal(
      savedCountLabel(3481, new Date(NOW.getTime() - 3 * 24 * 60 * MINUTE).toISOString(), NOW),
      "3,481 suppliers, as of 3 d ago",
    );
    // A count with no timestamp is still not a live one.
    assert.equal(savedCountLabel(12, null, NOW), "12 suppliers, when last counted");
  });
});

describe("the saved-search list does not overstate itself", () => {
  const NOW = new Date("2026-09-22T12:00:00.000Z");
  function rows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      owner_id: OWNER,
      name: `S${i}`,
      query_state: { search: `q=s${i}` },
      created_at: "2026-09-21T00:00:00Z",
      last_count: 5,
      last_counted_at: NOW.toISOString(),
    }));
  }
  function client(rs: Record<string, unknown>[]) {
    return {
      rpc: async () => ({ data: [{ total_count: 1 }], error: null }),
      from() {
        const api = {
          select: () => api,
          insert: async () => ({ data: null, error: null }),
          update: () => api,
          delete: () => api,
          eq: () => api,
          order: () => api,
          limit: () => api,
          then: (r: (v: { data: unknown; error: null }) => void) => r({ data: rs, error: null }),
        };
        return api;
      },
      auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
    };
  }

  it("says when it has returned only the most recent, and not before", async () => {
    // The query caps at 200 with no pagination behind it, so a buyer with 240
    // saved searches read "200 saved" and the other 40 were unreachable with
    // nothing saying so. The first fix then over-corrected: `>= LIST_LIMIT`
    // claimed more existed at exactly 200, where nothing is hidden. The list
    // fetches one past the cap so it observes the overflow instead.
    const over = await runSavedSearchesGet({ role: "buyer", supabase: client(rows(201)), now: NOW });
    assert.equal((over.body as { capped: boolean }).capped, true);
    assert.equal((over.body as { searches: unknown[] }).searches.length, 200, "the extra probe row must not be served");

    const exactly = await runSavedSearchesGet({ role: "buyer", supabase: client(rows(200)), now: NOW });
    assert.equal((exactly.body as { capped: boolean }).capped, false, "nothing is hidden at exactly the cap");
    assert.equal((exactly.body as { searches: unknown[] }).searches.length, 200);

    const under = await runSavedSearchesGet({ role: "buyer", supabase: client(rows(3)), now: NOW });
    assert.equal((under.body as { capped: boolean }).capped, false);
  });
});

describe("savedCountLabel across the whole age range", () => {
  const NOW = new Date("2026-09-22T12:00:00.000Z");
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  it("has a distinct reading for minutes, hours and days", () => {
    // The hours branch had no case at all: deleting it left everything from
    // 1 h to 48 h falling through to "0 d ago" with the suite green.
    assert.equal(savedCountLabel(5, at(90 * 60_000), NOW), "5 suppliers, as of 2 h ago");
    assert.equal(savedCountLabel(5, at(40 * 60 * 60_000), NOW), "5 suppliers, as of 40 h ago");
    // …and the boundaries either side of it read as their own unit.
    assert.match(savedCountLabel(5, at(59 * 60_000), NOW), /59 min ago$/);
    assert.match(savedCountLabel(5, at(72 * 60 * 60_000), NOW), /3 d ago$/);
  });
});
