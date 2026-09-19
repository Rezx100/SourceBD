import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aboniInput, arFashionInput, TODAY } from "./fixtures";
import { discoverArgs, loadGalleryData, SORT_MOST_SOURCES } from "./gallery-data";

type Call = { fn: string; args: Record<string, unknown> };

/** A stub that answers the gallery's RPCs from the fixtures and records every call. */
function stubClient(options: { discoverError?: boolean; hscodesError?: boolean } = {}) {
  const calls: Call[] = [];
  const records: Record<string, ReturnType<typeof aboniInput>> = { "aboni-knitwear": aboniInput(), "ar-fashion": arFashionInput() };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (fn === "buyer_supplier_profile") {
      const r = records[String(args.p_slug)];
      return r ? { data: r.profile, error: null } : { data: null, error: { message: "not found" } };
    }
    if (fn === "supplier_epb_hscodes") {
      if (options.hscodesError) return { data: null, error: { message: "statement timeout" } };
      const r = records[String(args.p_slug)];
      return { data: r ? r.hscodes : [], error: null };
    }
    if (fn === "production_workers_display_batch") {
      const ids = args.p_supplier_ids as string[];
      const out: Record<string, unknown> = {};
      for (const r of Object.values(records)) if (r.workers && ids.includes(r.profile.supplier.id)) out[r.profile.supplier.id] = { value: r.workers.value, source: r.workers.source, fetched_at: null };
      return { data: out, error: null };
    }
    if (fn === "discover_suppliers") {
      if (options.discoverError) return { data: null, error: { message: "canceling statement due to statement timeout" } };
      if (args.p_q === null) return { data: [{ slug: "x", total_count: 10266 }], error: null };
      return { data: [{ slug: "aboni-knitwear", total_count: 42 }, { slug: "ar-fashion", total_count: 42 }], error: null };
    }
    if (fn === "rfq_list") return { data: [], error: null };
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  };
  return { client: { rpc }, calls };
}

describe("loadGalleryData (the /dev/ds loader, stubbed RPCs)", () => {
  it("asks discover_suppliers for a sort it knows, with every argument the RPC takes", async () => {
    const { client, calls } = stubClient();
    await loadGalleryData(client, TODAY);
    const discover = calls.filter((c) => c.fn === "discover_suppliers");
    assert.ok(discover.length >= 2);
    for (const c of discover) {
      assert.equal(c.args.p_sort, "receipts");
      assert.deepEqual(Object.keys(c.args).sort(), Object.keys(discoverArgs({ limit: 1 })).sort());
    }
    assert.equal(SORT_MOST_SOURCES, "receipts");
  });

  it("makes one worker batch call for every record on the page, not one per record", async () => {
    const { client, calls } = stubClient();
    const data = await loadGalleryData(client, TODAY);
    const batches = calls.filter((c) => c.fn === "production_workers_display_batch");
    assert.equal(batches.length, 1);
    assert.equal((batches[0]!.args.p_supplier_ids as string[]).length, 2);
    assert.equal(data.cards.find((c) => c.slug === "aboni-knitwear")?.meta.find((f) => /workers/.test(f.text))?.text, "3,166 workers");
  });

  it("a record that cannot be read is left out, never invented; the sanctioned sample flag is only on Zaheen", async () => {
    const { client } = stubClient();
    const data = await loadGalleryData(client, TODAY);
    assert.equal(data.records.sm, null);
    assert.equal(data.records.zaheen, null);
    assert.deepEqual(data.cards.map((c) => c.slug), ["aboni-knitwear", "ar-fashion"]);
    assert.ok(data.cards.every((c) => !c.sanctioned && !c.sanctionSample));
    assert.equal(data.records.aboni?.input.sanctionSample, false);
    assert.equal(data.total, 42);
    assert.equal(data.published, 10266);
    assert.equal(data.plan, null);
  });

  it("a failed discover read is unknown (null), never '0 suppliers'", async () => {
    const { client } = stubClient({ discoverError: true });
    const data = await loadGalleryData(client, TODAY);
    assert.equal(data.discoverError, true);
    assert.equal(data.total, null);
    assert.equal(data.published, null);
  });

  it("a failed lines read is carried as unknown, never as 'not on the EPB list'", async () => {
    const { client } = stubClient({ hscodesError: true });
    const data = await loadGalleryData(client, TODAY);
    const aboni = data.cards.find((c) => c.slug === "aboni-knitwear")!;
    assert.equal(aboni.linesUnknown, true);
    assert.ok(aboni.chips.some((c) => c.label === "EPB lines could not be read"));
    assert.ok(!aboni.chips.some((c) => /Not on the EPB/.test(c.label)));
  });
});
