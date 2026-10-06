// Reads written to the activity record (moderation plan 1d): what `ledger_note` is sent, that an id that is
// not one is dropped rather than refused by the database, and that a note never throws or rejects whatever
// the client does.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NOTE_KINDS, noteActivity, noteArgs } from "./note";

const RFQ = "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b";

describe("noteArgs", () => {
  it("names the kind and the parameters the SQL declares, with {} for no content", () => {
    assert.deepEqual(noteArgs("rfq.viewed", { targetTable: "rfqs", targetId: RFQ, rfqId: RFQ, content: { via: "page" } }), {
      p_kind: "rfq.viewed",
      p_target_table: "rfqs",
      p_target_id: RFQ,
      p_content: { via: "page" },
      p_supplier: null,
      p_thread: null,
      p_rfq: RFQ,
      p_order: null,
    });
    assert.deepEqual(noteArgs("search.run").p_content, {});
  });

  it("an id that is not a uuid is dropped, never sent for the database to refuse", () => {
    assert.equal(noteArgs("supplier.viewed", { supplierId: "s-1" }).p_supplier, null);
    assert.equal(noteArgs("supplier.viewed", { targetId: "" }).p_target_id, null);
  });

  it("the kinds are the ones ledger_note takes", () => {
    assert.deepEqual([...NOTE_KINDS], ["search.run", "supplier.viewed", "supplier.line_viewed", "contact.revealed", "export.downloaded", "file.downloaded", "rfq.viewed", "order.viewed"]);
  });
});

describe("noteActivity", () => {
  it("calls ledger_note once with the arguments", async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    await noteActivity({ rpc: (fn, args) => (calls.push({ fn, args }), Promise.resolve({ data: 1, error: null })) }, "order.viewed", { orderId: RFQ });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.fn, "ledger_note");
    assert.equal(calls[0]?.args.p_order, RFQ);
  });

  it("never throws or rejects: a refusing database, a rejecting client, a throwing client, no client", async () => {
    await noteActivity({ rpc: () => Promise.resolve({ data: null, error: { message: "function ledger_note does not exist" } }) }, "search.run");
    await noteActivity({ rpc: () => Promise.reject(new Error("network")) }, "search.run");
    await noteActivity(
      {
        rpc: () => {
          throw new Error("sync");
        },
      },
      "search.run",
    );
    await noteActivity(null, "search.run");
    await noteActivity(undefined, "search.run");
  });
});
