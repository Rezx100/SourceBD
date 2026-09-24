import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aboniInput, arFashionInput, smKnitwearInput, TODAY } from "./fixtures";
import type { RfqListRow } from "./build-models";
import { discoverArgs, loadGalleryData, SORT_MOST_SOURCES } from "./gallery-data";

type Call = { fn: string; args: Record<string, unknown> };

/** A stub that answers the gallery's RPCs from the fixtures and records every call. */
function stubClient(
  options: {
    discoverError?: boolean;
    hscodesError?: boolean;
    badCount?: boolean;
    count?: unknown;
    rfqError?: boolean;
    rfqRows?: RfqListRow[];
    /** Adds a third `discover_suppliers` row outside the two named slugs below — a real "extra" table row. */
    extraSlug?: boolean;
    /**
     * Same slug and row as `extraSlug`, but the extra record's own
     * provenance is a single row dated well outside the two named records'
     * range (2025, against their 18 May – 18 Sep 2026), instead of
     * `smKnitwearInput`'s own dates, which happen to fall inside it. Without
     * this, nothing in the suite can tell `tableSpan.on` (the table's own,
     * wider span) apart from `namedSpan.on` (the named-only span) by
     * observation — guard-adequacy, cycle 19.
     */
    extraSlugOutOfRange?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  const outOfRangeExtra = {
    ...smKnitwearInput(),
    profile: {
      ...smKnitwearInput().profile,
      provenance: [{ source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "1", source_url: null, last_seen_at: "2025-01-01T00:00:00.000000+00:00" }],
    },
  };
  const records: Record<string, ReturnType<typeof aboniInput>> = {
    "aboni-knitwear": aboniInput(),
    "ar-fashion": arFashionInput(),
    ...(options.extraSlug ? { "extra-factory": smKnitwearInput() } : {}),
    ...(options.extraSlugOutOfRange ? { "extra-factory": outOfRangeExtra } : {}),
  };
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
      if (options.badCount) return { data: [{ slug: "aboni-knitwear", total_count: "not-a-count" }], error: null };
      if ("count" in options) return { data: [{ slug: "aboni-knitwear", total_count: options.count }], error: null };
      if (args.p_q === null) return { data: [{ slug: "x", total_count: 10266 }], error: null };
      return {
        data: [
          { slug: "aboni-knitwear", total_count: 42 },
          { slug: "ar-fashion", total_count: 42 },
          ...(options.extraSlug || options.extraSlugOutOfRange ? [{ slug: "extra-factory", total_count: 42 }] : []),
        ],
        error: null,
      };
    }
    if (fn === "rfq_list") {
      if (options.rfqError) return { data: null, error: { message: "permission denied" } };
      return { data: options.rfqRows ?? [], error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  };
  return { client: { rpc }, calls };
}

describe("loadGalleryData (the /dev/ds loader, stubbed RPCs)", () => {
  // The argument names are the RPC's, so they are pinned as literals. Comparing
  // `discoverArgs()` against `discoverArgs()` — which is what this test used to
  // do — cannot fail: the cycle-5 adequacy critic renamed `p_min_sources` and
  // `p_completeness_min` to nonsense and the suite stayed green.
  const DISCOVER_ARGS = [
    "p_brand_codes",
    "p_category",
    "p_cert_kinds",
    "p_cert_state",
    "p_cities",
    "p_city",
    "p_completeness_min",
    "p_district",
    "p_districts",
    "p_entity_types",
    "p_est_from",
    "p_est_to",
    "p_exclude_sanctioned",
    "p_factory_types",
    "p_hs_codes",
    "p_limit",
    "p_min_sources",
    "p_offset",
    "p_q",
    "p_registries",
    "p_rsc_min",
    "p_rsc_state",
    "p_sort",
    "p_workers_max",
    "p_workers_min",
  ];

  it("asks discover_suppliers for a sort it knows, with every argument the RPC takes, by name", async () => {
    assert.deepEqual(Object.keys(discoverArgs({ limit: 1 })).sort(), DISCOVER_ARGS);
    const { client, calls } = stubClient();
    await loadGalleryData(client, TODAY);
    const discover = calls.filter((c) => c.fn === "discover_suppliers");
    assert.ok(discover.length >= 2);
    for (const c of discover) {
      assert.equal(c.args.p_sort, "receipts");
      assert.deepEqual(Object.keys(c.args).sort(), DISCOVER_ARGS);
      assert.equal(c.args.p_offset, 0);
    }
    assert.equal(SORT_MOST_SOURCES, "receipts", "the RPC knows receipts | name | completeness; 'sources' silently falls back to score order");
  });

  // Cycle 5, finding 16: `Number("not-a-count")` is NaN, and NaN reached the
  // panel header as "null suppliers" with `discoverError` still false.
  it("a count the RPC returns in a shape that will not parse is unknown, not NaN", async () => {
    const { client } = stubClient({ badCount: true });
    const data = await loadGalleryData(client, TODAY);
    assert.equal(data.total, null);
    assert.equal(data.published, null);
    assert.equal(data.discoverError, true);
    assert.ok(!Number.isNaN(data.total as unknown as number));
  });

  // Cycle 10. `Number("")` and `Number("  ")` are 0, so the empty-string half
  // of finding 16 was left open: a blank `total_count` printed "0 suppliers"
  // in the panel header and "0 published suppliers" in the topbar, over a
  // read that had returned no count at all, with `discoverError` false.
  // Numbers too: `f16-count-nan` survived its own revert because every case
  // here was a non-number, so dropping the `Number.isFinite` check on the
  // numeric branch let NaN reach the page unguarded.
  for (const count of ["", "   ", "\n", null, undefined, [], {}, Number.NaN, Number.POSITIVE_INFINITY, -Number.POSITIVE_INFINITY] as const) {
    it(`a total_count of ${JSON.stringify(count)} is unknown, never zero`, async () => {
      const { client } = stubClient({ count });
      const data = await loadGalleryData(client, TODAY);
      assert.equal(data.total, null, "a count that is not a count must not render as none");
      assert.equal(data.published, null);
      assert.equal(data.discoverError, true);
    });
  }

  it("the read date is the range the records span, never the newest one", async () => {
    // "records on this page read 18 Sep 2026" was `Math.max` over the four
    // named records. A.R. Fashion's only source was last read 30 Jul 2026 —
    // 4 of the page's 32 source reads were on 18 Sep and the oldest was 18
    // May — so the caption asserted a freshness none of those records had.
    const { client } = stubClient();
    const data = await loadGalleryData(client, TODAY);
    assert.ok(data.recordsReadOn, "the page still carries a read date");
    assert.match(data.recordsReadOn!, / – /, "a population's read date is a range, not its maximum");
    const [oldest, newest] = data.recordsReadOn!.split(" – ");
    assert.notEqual(oldest, newest);
    assert.ok(Date.parse(oldest!.includes("20") ? oldest! : `${oldest} ${newest!.slice(-4)}`) < Date.parse(newest!), "oldest first");
  });

  // Cycle 17, correctness critic's finding. `discover_suppliers`'s own top 8
  // rows for the gallery's query return six slugs outside the four named
  // records (SQL, 20 Sep 2026) — `extra` is not a theoretical population,
  // it fills on a real read. Only the table screen draws `extra`; every
  // other screen draws the four named records alone, and must not inherit a
  // count or a date that is true only of the wider, table-only population.
  it("the table's own record span covers the extra rows; the named span does not", async () => {
    const named = await loadGalleryData(stubClient().client, TODAY);
    const withExtra = await loadGalleryData(stubClient({ extraSlug: true }).client, TODAY);
    // Absolute counts, not only counts compared against each other. The
    // guard-adequacy critic against cycle 18's candidate found that every
    // assertion here was relative — `readSpan`'s own count could be off by
    // any amount, in either direction, with every relative comparison below
    // still holding, because the oracle for "did it move" came from the same
    // computation being checked. This stub always resolves exactly two named
    // records (aboni, ar — sm and zaheen are not in `stubClient`'s slug map),
    // both with dated provenance.
    assert.equal(named.recordsRead, 2, "readSpan's own count over the two loadable named records");
    assert.equal(named.tableRecordsRead, 2, "with no extra row, the table span is the named span");
    assert.equal(withExtra.tableRecordsRead, 3, "readSpan's own count once the one extra record joins the table's population");
    // The extra slug changes nothing about the named-only span: the same two
    // records (aboni, ar) produce the same count and the same range either way.
    assert.equal(withExtra.recordsRead, named.recordsRead, "adding a table-only row must not move the named span's count");
    assert.equal(withExtra.recordsReadOn, named.recordsReadOn, "adding a table-only row must not move the named span's date");
    // The table's own span, though, must widen: one more record with its own
    // provenance joins the population the table screen actually draws.
    assert.notEqual(withExtra.tableRecordsRead, withExtra.recordsRead, "the table span must differ from the named span once extra rows exist");
    assert.equal(withExtra.tableRecordsRead, (withExtra.recordsRead ?? 0) + 1, "exactly one extra record was added");
  });

  // Same critic, second finding: `tableRecordsReadOn` — the date half of the
  // same cycle-18 fix — had no assertion anywhere, absolute or relative. A
  // revert to `tableRecordsReadOn = null`, or one that quietly fell back to
  // the named span's date, passed the whole suite.
  it("tableRecordsReadOn is read, formatted as a range, and is never the named span's date by coincidence of being unset", async () => {
    const named = await loadGalleryData(stubClient().client, TODAY);
    const withExtra = await loadGalleryData(stubClient({ extraSlug: true }).client, TODAY);
    for (const on of [named.tableRecordsReadOn, withExtra.tableRecordsReadOn]) {
      assert.ok(on, "tableRecordsReadOn must be read, not dropped");
      assert.match(on!, / – /, "a population's read date is a range, not a single day");
    }
    assert.equal(named.tableRecordsReadOn, "18 May – 18 Sep 2026", "the exact range this stub's two named records span");
    assert.equal(withExtra.tableRecordsReadOn, "18 May – 18 Sep 2026", "the extra record's own provenance falls inside the named range in this stub, so the range is unchanged — its count moving (above) is what proves the extra record was actually read");
  });

  // Guard-adequacy, cycle 19: the test above can only prove
  // `tableRecordsReadOn` was read at all — its one extra record's provenance
  // happens to fall inside the named range, so `tableSpan.on` and
  // `namedSpan.on` are observationally identical there. A revert of
  // `tableRecordsReadOn` to `namedSpan.on` (instead of `tableSpan.on`) passed
  // every assertion in the suite, including that one. `extraSlugOutOfRange`
  // gives the extra record a provenance date well outside the named span, so
  // only a genuine read of the wider population can produce the widened
  // range asserted here.
  it("tableRecordsReadOn is the table's own wider span, not the named span's date reused", async () => {
    const named = await loadGalleryData(stubClient().client, TODAY);
    const withExtra = await loadGalleryData(stubClient({ extraSlugOutOfRange: true }).client, TODAY);
    assert.notEqual(withExtra.tableRecordsReadOn, named.recordsReadOn, "the table's span must not be the named span's date reused");
    assert.equal(withExtra.tableRecordsReadOn, "1 Jan 2025 – 18 Sep 2026", "the table's own span widens to cover the out-of-range extra record");
    // The named span itself must be untouched by a table-only row, whatever its date.
    assert.equal(withExtra.recordsReadOn, named.recordsReadOn, "adding an out-of-range table-only row must not move the named span's date");
  });

  it("a count the RPC returns as a numeric string is still a count", async () => {
    const { client } = stubClient({ count: "42" });
    const data = await loadGalleryData(client, TODAY);
    assert.equal(data.total, 42);
    assert.equal(data.discoverError, false);
  });

  // Cycle 5, finding 4.
  it("a failed rfq_list read is unread, never 'no RFQs for this account'", async () => {
    const { client } = stubClient({ rfqError: true });
    const data = await loadGalleryData(client, TODAY);
    assert.equal(data.rfqError, true);
    assert.equal(data.rfqs.error, true);
    assert.equal(data.rfqs.footer, "The RFQ list could not be read");
    const ok = await loadGalleryData(stubClient().client, TODAY);
    assert.equal(ok.rfqError, false);
    assert.equal(ok.rfqs.error, false);
  });

  it("makes one worker batch call for every record on the page, not one per record", async () => {
    const { client, calls } = stubClient();
    const data = await loadGalleryData(client, TODAY);
    const batches = calls.filter((c) => c.fn === "production_workers_display_batch");
    assert.equal(batches.length, 1);
    assert.equal((batches[0]!.args.p_supplier_ids as string[]).length, 2);
    // The batch figure is the group's: 2,662 (the mother) + 504 (the New Shed).
    assert.equal(data.cards.find((c) => c.slug === "aboni-knitwear")?.meta.find((f) => /workers/.test(f.text))?.text, "3,166 workers across 2 sites");
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

  // Cycle 6: every RFQ figure was only ever exercised over an empty list, where
  // a count of 0, a sum of 0 and a filter that matches nothing all agree. The
  // aggregation was free to be wrong in any way as long as it returned zero.
  it("the counts, the sum and the chips are computed over the rows that were read", async () => {
    const base = { product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, created_at: "2026-09-09T10:00:00Z" };
    const rfqRows: RfqListRow[] = [
      { ...base, id: "a", status: "open", quote_count: 0 },
      { ...base, id: "b", status: "open", quote_count: 2 },
      { ...base, id: "c", status: "accepted", quote_count: 1 },
      { ...base, id: "d", status: "closed", quote_count: 0 },
      { ...base, id: "e", status: "cancelled", quote_count: 0 },
    ];
    const data = await loadGalleryData(stubClient({ rfqRows }).client, TODAY);
    assert.equal(data.rfqError, false);
    assert.equal(data.rfqs.rows.length, 5);
    // "Sent" counts every RFQ that was not cancelled, so 4 of the 5.
    assert.equal(data.rfqs.sent, 4);
    // Quotes is the sum over the rows, not the number of rows carrying one.
    assert.equal(data.rfqs.quotes, 3);
    assert.deepEqual(
      data.rfqs.chips.map((c) => [c.label, c.count]),
      [
        ["All", 5],
        ["Open", 1],
        ["Quoted", 2],
        ["Closed", 2],
      ],
    );
    assert.equal(data.rfqs.footer, "1–5 of 5");
    // Every row a chip counts is a row the list will render.
    const chipTotal = data.rfqs.chips.filter((c) => c.label !== "All").reduce((n, c) => n + (c.count ?? 0), 0);
    assert.equal(chipTotal, data.rfqs.rows.length, "a row is in no chip, or in two");
  });

  // Cycle 8: the cycle-6 fixture gave "Open" and "Quoted" one row
  // each, so swapping the two predicates left every count unchanged — a
  // 1-vs-1 collision where the empty list had been a 0-vs-0 one. Each chip
  // now counts a different number of rows, and no two chips agree.
  it("each status chip counts its own rows, and no two chips can be swapped without the counts moving", async () => {
    const base = { product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", target_supplier_count: 1, created_at: "2026-09-09T10:00:00Z" };
    const rfqRows: RfqListRow[] = [
      { ...base, id: "a", status: "open", quote_count: 0 },
      { ...base, id: "b", status: "open", quote_count: 0 },
      { ...base, id: "c", status: "open", quote_count: 0 },
      { ...base, id: "d", status: "open", quote_count: 2 },
      { ...base, id: "e", status: "accepted", quote_count: 1 },
      { ...base, id: "f", status: "closed", quote_count: 0 },
    ];
    const data = await loadGalleryData(stubClient({ rfqRows }).client, TODAY);
    const counts = data.rfqs.chips.map((c) => [c.label, c.count] as const);
    assert.deepEqual(counts, [
      ["All", 6],
      ["Open", 3],
      ["Quoted", 2],
      ["Closed", 1],
    ]);
    const numbers = counts.filter(([l]) => l !== "All").map(([, n]) => n);
    assert.equal(new Set(numbers).size, numbers.length, "two chips count the same number, so their predicates can be swapped unnoticed");
    assert.equal(numbers.reduce<number>((a, b) => a + (b ?? 0), 0), data.rfqs.rows.length, "a row is in no chip, or in two");
  });

  // Cycle 6: the sidebar reads its numbers off the same model, and a failed
  // read must leave them unknown rather than reporting a quiet, wrong zero.
  it("when the read fails, every sidebar figure is unknown — not zero", async () => {
    const data = await loadGalleryData(stubClient({ rfqError: true }).client, TODAY);
    assert.equal(data.rfqs.sent, null);
    assert.equal(data.rfqs.quotes, null);
    for (const chip of data.rfqs.chips) assert.equal(chip.count, null, `the "${chip.label}" chip reports a count over a list that was never read`);
    assert.deepEqual(data.rfqs.rows, []);
    // And the success path still produces real numbers, so `null` is the
    // failure signal rather than the only thing this loader ever returns.
    const ok = await loadGalleryData(stubClient({ rfqRows: [{ id: "a", product_title: "T", quantity: 1, quantity_unit: "pcs", ship_by: null, status: "open", target_supplier_count: 1, quote_count: 4, created_at: "2026-09-09T10:00:00Z" }] }).client, TODAY);
    assert.equal(ok.rfqs.sent, 1);
    assert.equal(ok.rfqs.quotes, 4);
    assert.equal(ok.rfqs.chips.find((c) => c.label === "All")?.count, 1);
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
