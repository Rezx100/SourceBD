// The screenshot harness is what produces the evidence in the bundle, so what
// it answers the RPCs with is part of the claim "the six screens are rendered
// from real data" (handoff §7 item 1).
//
// It used to answer `rfq_list` with a hard-coded `[]`, and the RFQ screen then
// stated "0 sent · 0 quotes" and "No RFQs for this account yet" about an
// account that does not exist. Nothing tested the harness, so nothing noticed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadGalleryData } from "@/lib/dashboard/gallery-data";
import { RFQ_ROWS, RFQ_TARGETS, TODAY } from "@/lib/dashboard/fixtures";
import { fixtureRpc, records } from "./render-gallery-fixtures";

describe("the screenshot harness answers every RPC from a production payload", () => {
  it("rfq_list returns the rows production holds, not an empty literal", async () => {
    const { data } = await fixtureRpc.rpc("rfq_list", {});
    assert.deepEqual(data, RFQ_ROWS);
    assert.ok(Array.isArray(data) && data.length === 7, "the seven rows rfq_list returns for the buyer who owns them");
  });

  it("the screens it renders carry those rows, with their suppliers named", async () => {
    const d = await loadGalleryData(fixtureRpc as never, TODAY, RFQ_TARGETS);
    assert.equal(d.rfqError, false);
    assert.equal(d.rfqs.rows.length, 7);
    assert.equal(d.rfqs.sent, 7);
    assert.equal(d.rfqs.quotes, 0);
    assert.notEqual(d.rfqs.footer, "No RFQs for this account yet");
    assert.ok(d.rfqs.rows.every((r) => r.supplierName), "every row's target is resolved");
  });

  it("every other RPC is answered from a fixture, and an unknown slug is refused rather than invented", async () => {
    const { data: profile } = await fixtureRpc.rpc("buyer_supplier_profile", { p_slug: "aboni-knitwear" });
    assert.ok(profile && typeof profile === "object");
    const { data: missing, error } = await fixtureRpc.rpc("buyer_supplier_profile", { p_slug: "not-a-record" });
    assert.equal(missing, null);
    assert.ok(error);
    const { data: lines } = await fixtureRpc.rpc("supplier_epb_hscodes", { p_slug: "sm-knitwear" });
    assert.equal((lines as unknown[]).length, 24);
    // The four records the six screens render; a fifth would be a record the
    // bundle shows without reconciling.
    assert.deepEqual(Object.keys(records).sort(), [
      "aboni-knitwear",
      "ar-fashion",
      "sm-knitwear",
      "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump",
    ]);
  });

  it("the two counts it replays are the ones the queries beside them returned", async () => {
    const { data: filtered } = await fixtureRpc.rpc("discover_suppliers", { p_q: "knitted shirts" });
    assert.equal((filtered as { total_count: number }[])[0]!.total_count, 42);
    const { data: all } = await fixtureRpc.rpc("discover_suppliers", { p_q: null });
    assert.equal((all as { total_count: number }[])[0]!.total_count, 10266);
  });
});
