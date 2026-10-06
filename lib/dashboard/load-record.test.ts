// `lib/dashboard/load-record.ts`, exercised rather than grepped.
//
// Every "a failed read claims nothing" rule in REZ-C lives in this file, and
// until now two tests mentioned it — one reading it as a STRING and matching a
// regex, one naming its functions in a comment — while none of them ran a line
// of it. A guard that reads source text goes green over any behaviour at all.
//
// The rule these all turn on: a read that failed is a fact about the read, not
// about the supplier. "No phone number on file" and "you have sent no RFQs" are
// claims about a company and about a buyer's own history; a timeout supports
// neither.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProfileReadTimeout,
  fetchContactCounts,
  fetchRecordRfqs,
  fetchRecordSaved,
  fetchSanctionsRead,
  loadRecordInput,
  loadRecordSheet,
  callerId,
} from "./load-record";
import { aboniInput, TODAY } from "./fixtures";

type Rpc = { data: unknown; error: unknown };

/** A client that answers each RPC from a map and records what it was asked. */
function client(answers: Record<string, Rpc>, calls: string[] = []) {
  return {
    calls,
    rpc: async (fn: string) => {
      calls.push(fn);
      return answers[fn] ?? { data: null, error: null };
    },
  };
}

const ABONI = aboniInput();
const PROFILE: Rpc = { data: ABONI.profile, error: null };

describe("loadRecordInput", () => {
  it("returns the record when both reads answer", async () => {
    const got = await loadRecordInput(
      client({ buyer_supplier_profile: PROFILE, supplier_epb_hscodes: { data: [{ code: "6105", description: null, source_url: null }], error: null } }),
      "aboni-knitwear",
      TODAY,
    );
    assert.ok(got);
    assert.equal(got.input.profile.supplier.slug, "aboni-knitwear");
    assert.equal(got.input.hscodesError, false);
    assert.equal(got.input.hscodes.length, 1);
  });

  it("a failed HS read is 'unknown', never 'no lines'", async () => {
    // The distinction the Products section is built on: "not on the EPB list"
    // is a claim about the company; a failed read is a claim about us.
    const got = await loadRecordInput(
      client({ buyer_supplier_profile: PROFILE, supplier_epb_hscodes: { data: null, error: { message: "boom" } } }),
      "aboni-knitwear",
      TODAY,
    );
    assert.ok(got);
    assert.equal(got.input.hscodesError, true);
    assert.deepEqual(got.input.hscodes, []);
  });

  for (const [label, profile] of [
    ["an error", { data: null, error: { message: "boom" } }],
    ["no data", { data: null, error: null }],
    ["a non-object", { data: "nope", error: null }],
    ["an object with no supplier", { data: { t13_source_count: 0 }, error: null }],
  ] as const) {
    it(`returns null on ${label}`, async () => {
      const got = await loadRecordInput(client({ buyer_supplier_profile: profile }), "x", TODAY);
      assert.equal(got, null);
    });
  }

  it("a statement timeout throws rather than reading as 'no such record'", async () => {
    // Returning null here made the route fall through to its not-found path,
    // so a busy database answered 404 for a published company.
    await assert.rejects(
      () =>
        loadRecordInput(
          client({ buyer_supplier_profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } } }),
          "aboni-knitwear",
          TODAY,
        ),
      (err: unknown) => err instanceof ProfileReadTimeout,
    );
  });

  it("a timeout shaped as DATA rather than an error throws too", async () => {
    // `buyer_supplier_profile` can return the timeout as its payload.
    await assert.rejects(
      () => loadRecordInput(client({ buyer_supplier_profile: { data: { code: "57014", message: "canceling statement due to statement timeout" }, error: null } }), "x", TODAY),
      (err: unknown) => err instanceof ProfileReadTimeout,
    );
  });

  it("a thrown client is absorbed, but a timeout still escapes", async () => {
    const boom = { rpc: async () => { throw new Error("network"); } };
    assert.equal(await loadRecordInput(boom, "x", TODAY), null);
  });
});

describe("fetchContactCounts", () => {
  const counts = (data: unknown, error: unknown = null) =>
    fetchContactCounts({ rpc: async () => ({ data, error }) }, "x");

  it("reads the four counts", async () => {
    assert.deepEqual(await counts({ emails: 1, phones: 6, website: true, representatives: 2 }), {
      emails: 1,
      phones: 6,
      representatives: 2,
      website: true,
    });
  });

  it("a record holding nothing is zeros, which is a real answer", async () => {
    assert.deepEqual(await counts({ emails: 0, phones: 0, website: false, representatives: 0 }), {
      emails: 0,
      phones: 0,
      representatives: 0,
      website: false,
    });
  });

  for (const [label, data, error] of [
    ["an error", null, { message: "boom" }],
    ["a null payload", null, null],
    ["an unpublished or unknown slug (the function returns null)", null, null],
    ["a non-object", 7, null],
    ["a missing key", { emails: 1, phones: 6, website: true }, null],
    ["a non-numeric count", { emails: "1", phones: 6, website: true, representatives: 1 }, null],
  ] as const) {
    it(`returns null on ${label} — never a count of zero`, async () => {
      // Zeros would print "No contact detail on this record yet" over a record
      // that may hold six phone numbers.
      assert.equal(await counts(data, error), null);
    });
  }

  it("absorbs a thrown client", async () => {
    assert.equal(await fetchContactCounts({ rpc: async () => { throw new Error("network"); } }, "x"), null);
  });
});

describe("loadRecordSheet: the reads a row's id starts early", () => {
  // Founder's video, 29 Sep 2026: a record opened from a row starts its
  // id-keyed reads beside the profile. The profile's own id still decides
  // whose they are: a row pointing at another supplier must not lend this
  // record that supplier's saved state or RFQs.
  const OWN = String(ABONI.profile.supplier.id);
  function sheetClient(savedFor: string) {
    const asked = { saved: [] as unknown[], rfqs: [] as unknown[], workers: [] as unknown[] };
    const chain = (table: string) => {
      const c = {
        select: () => c,
        eq: (col: string, v: unknown) => (table === "saved_suppliers" && col === "supplier_id" && asked.saved.push(v), c),
        contains: (_col: string, v: unknown[]) => (asked.rfqs.push(v[0]), c),
        order: () => c,
        limit: () => Promise.resolve({ data: [], error: null, count: 0 }),
        maybeSingle: () => Promise.resolve({ data: asked.saved.at(-1) === savedFor ? { id: "s1" } : null }),
      };
      return c;
    };
    return {
      asked,
      auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } } }) },
      from: chain,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === "production_workers_display_batch") asked.workers.push(...(args.p_supplier_ids as unknown[]));
        return fn === "buyer_supplier_profile" ? PROFILE : { data: null, error: null };
      },
    };
  }

  it("with the record's own id, each read runs once, for that id", async () => {
    const c = sheetClient(OWN);
    const sheet = await loadRecordSheet(c, "aboni-knitwear", TODAY, { supplierId: OWN });
    assert.equal(sheet?.saved, true);
    assert.deepEqual(c.asked, { saved: [OWN], rfqs: [OWN], workers: [OWN] });
  });

  it("a row pointing at another supplier lends this record nothing", async () => {
    const c = sheetClient("someone-else");
    const sheet = await loadRecordSheet(c, "aboni-knitwear", TODAY, { supplierId: "someone-else" });
    assert.equal(sheet?.saved, false, "the other supplier's saved state reached this record");
    assert.equal(c.asked.saved.at(-1), OWN, "saved was not read again for the record's own id");
    assert.ok(c.asked.rfqs.includes(OWN) && c.asked.workers.includes(OWN), "the record's own RFQs or workers were not read");
  });

  it("reads the geocode cache only for the Sites tab, and a cache that cannot be read is no map, never 'not pinned'", async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const other = await loadRecordSheet(sheetClient(OWN), "aboni-knitwear", TODAY, {});
      assert.ok(other && other.locations.length > 0, "guard: the fixture has sites");
      assert.ok(other.locations.every((l) => l.pin === undefined), "a tab that draws no pin read the cache");
      // No service key: the cache cannot be read, so no site claims to have no pin.
      const sites = await loadRecordSheet(sheetClient(OWN), "aboni-knitwear", TODAY, { pins: true });
      assert.ok(sites?.locations.every((l) => l.pin === undefined), "an unreadable cache was reported as sites with no pin");
      assert.equal(sites?.locations.length, other.locations.length, "pins changed the number of sites");
    } finally {
      if (key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    }
  });
});

describe("fetchRecordRfqs", () => {
  /** Records the filters, so the buyer scoping is asserted where it is applied. */
  function rfqClient(result: { data: unknown; error: unknown; count: number | null }) {
    const filters: { op: string; args: unknown[] }[] = [];
    const chain = {
      select: (_c: string, _o?: unknown) => chain,
      eq: (...args: unknown[]) => (filters.push({ op: "eq", args }), chain),
      contains: (...args: unknown[]) => (filters.push({ op: "contains", args }), chain),
      order: () => chain,
      limit: () => Promise.resolve(result),
    };
    return { filters, from: () => chain };
  }

  it("filters on the caller's buyer_id as well as the supplier", async () => {
    // `public.rfqs` carries a second permissive SELECT policy, for a caller who
    // has CLAIMED the supplier. RLS alone would hand that caller every buyer's
    // RFQ to it, under a caption reading "from your account".
    const c = rfqClient({ data: [], error: null, count: 0 });
    await fetchRecordRfqs(c, "supplier-1", "buyer-42");
    assert.ok(
      c.filters.some((f) => f.op === "eq" && f.args[0] === "buyer_id" && f.args[1] === "buyer-42"),
      `not scoped to the caller: ${JSON.stringify(c.filters)}`,
    );
    assert.ok(c.filters.some((f) => f.op === "contains" && f.args[0] === "target_supplier_ids"));
  });

  it("the count is the exact total, not the page that was fetched", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`,
      product_title: `RFQ ${i}`,
      quantity: 10,
      quantity_unit: "pcs",
      ship_by: null,
      status: "open",
      created_at: TODAY.toISOString(),
    }));
    const got = await fetchRecordRfqs(rfqClient({ data: rows, error: null, count: 37 }), "s", "b");
    assert.equal(got.count, 37, "a page size is being reported as a total");
    assert.equal(got.rows.length, 20);
  });

  it("no caller id is an unread list, not an empty one", async () => {
    const got = await fetchRecordRfqs(rfqClient({ data: [], error: null, count: 0 }), "s", null);
    assert.deepEqual(got, { count: null, rows: [], error: true });
  });

  for (const [label, result] of [
    ["an error", { data: null, error: { message: "boom" }, count: null }],
    ["a non-array payload", { data: {}, error: null, count: null }],
  ] as const) {
    it(`returns no count on ${label}`, async () => {
      // 0 is a claim about the buyer's own history.
      const got = await fetchRecordRfqs(rfqClient(result), "s", "b");
      assert.equal(got.count, null);
      assert.equal(got.error, true);
    });
  }

  it("maps each status to words that do not claim a reply was awaited", async () => {
    const row = (status: string) => ({
      id: status,
      product_title: "t",
      quantity: 1,
      quantity_unit: "pcs",
      ship_by: null,
      status,
      created_at: TODAY.toISOString(),
    });
    const got = await fetchRecordRfqs(
      rfqClient({ data: ["accepted", "closed", "cancelled", "open", "weird"].map(row), error: null, count: 5 }),
      "s",
      "b",
    );
    assert.deepEqual(
      got.rows.map((r) => r.status.label),
      ["Quote accepted", "Closed", "Cancelled", "Open", "Open"],
    );
    // This read carries no thread and no reply, so it may not say one is due.
    for (const r of got.rows) assert.doesNotMatch(r.status.label, /awaiting|overdue/i);
  });

  it("an untitled RFQ is named, not blank", async () => {
    const got = await fetchRecordRfqs(
      rfqClient({ data: [{ id: "a", product_title: "   ", quantity: null, quantity_unit: null, ship_by: null, status: "open", created_at: null }], error: null, count: 1 }),
      "s",
      "b",
    );
    assert.equal(got.rows[0]!.title, "Untitled RFQ");
    assert.equal(got.rows[0]!.quantity, null);
    assert.equal(got.rows[0]!.sent, null);
    assert.equal(got.rows[0]!.href, "/app/rfqs/a");
  });

  it("absorbs a thrown client", async () => {
    const got = await fetchRecordRfqs({ from: () => { throw new Error("network"); } }, "s", "b");
    assert.deepEqual(got, { count: null, rows: [], error: true });
  });
});

describe("fetchRecordSaved and callerId", () => {
  it("saved is true only when a row comes back", async () => {
    const withRow = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "1" } }) }) }) }) };
    const without = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
    assert.equal(await fetchRecordSaved(withRow, "s"), true);
    assert.equal(await fetchRecordSaved(without, "s"), false);
  });

  it("a failed saved read is 'not saved', never a crash", async () => {
    assert.equal(await fetchRecordSaved({ from: () => { throw new Error("network"); } }, "s"), false);
  });

  it("callerId is null with no session, and never a non-string", async () => {
    assert.equal(await callerId({ auth: { getUser: async () => ({ data: { user: null } }) } }), null);
    assert.equal(await callerId({ auth: { getUser: async () => ({ data: {} }) } }), null);
    assert.equal(await callerId({ auth: { getUser: async () => ({ data: { user: { id: "" } } }) } }), null);
    assert.equal(await callerId({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }), "u1");
    assert.equal(await callerId({ auth: { getUser: async () => { throw new Error("no session"); } } }), null);
  });
});

describe("fetchSanctionsRead", () => {
  const read = (data: unknown, error: unknown = null) => fetchSanctionsRead({ rpc: async () => ({ data, error }) });
  const row = (list: string, last_read: string | null) => ({ list, entries_listed: 1, last_read });
  const ALL = [
    row("ofac_sdn", "2026-10-06T02:10:00Z"),
    row("uk_ofsi", "2026-10-06T02:20:00Z"),
    row("eu_sanctions", "2026-10-05T02:30:00Z"),
    row("uflpa", "2026-10-06T02:40:00Z"),
    // Neither dates the line: a 2024 snapshot and a weekly list.
    row("us_wro", "2024-12-30T00:00:00Z"),
    row("ilab_tvpra", "2026-06-26T00:00:00Z"),
  ];

  it("names the day the stalest daily list was read", async () => {
    assert.equal(await read(ALL), "2026-10-05T02:30:00Z");
  });

  it("claims no date while any daily list has never been read", async () => {
    assert.equal(await read(ALL.filter((r) => r.list !== "uflpa")), null);
    assert.equal(await read([...ALL.filter((r) => r.list !== "uflpa"), row("uflpa", null)]), null);
  });

  it("a failed read, a missing function or a thrown client claims no date", async () => {
    assert.equal(await read(null, { code: "PGRST202" }), null);
    assert.equal(await fetchSanctionsRead({ rpc: async () => { throw new Error("down"); } }), null);
  });
});
