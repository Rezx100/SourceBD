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
  loadRecordInput,
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
