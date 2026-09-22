import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  COMPOSER_HIDDEN_OMIT,
  EMPTY_STATE,
  FILTER_HIDDEN_OMIT,
  certKinds,
  certState,
  discoverChips,
  discoverHiddenParams,
  discoverHref,
  discoverRpcArgs,
  filterFamilyLabel,
  parseDiscoverState,
  queryTitle,
  serializeDiscoverState,
  sortRpc,
  withoutFilterFamily,
} from "./discover-v32-state";

describe("discover URL state", () => {
  it("round-trips the spec's example query string", () => {
    const raw =
      "q=knitted+shirts&hs=6105,6110&cert=gots:valid,wrap:any&reg=BGMEA&brand=hm&district=Dhaka&type=factory&min_sources=3&rsc=active&est_from=2000&est_to=2020&workers_min=100&workers_max=5000&sort=workers&page=2&per=50&view=table";
    const parsed = parseDiscoverState(new URLSearchParams(raw));
    const again = parseDiscoverState(serializeDiscoverState(parsed));
    assert.deepEqual(again, parsed);
    assert.equal(parsed.q, "knitted shirts");
    assert.deepEqual(parsed.hs, ["6105", "6110"]);
    assert.equal(parsed.cert[0]?.kind, "gots");
    assert.equal(parsed.cert[0]?.state, "valid");
    assert.equal(parsed.brand[0], "BRAND_HM");
    assert.equal(parsed.view, "table");
    assert.equal(sortRpc(parsed.sort), "workers");
    assert.deepEqual(certKinds(parsed), ["gots", "wrap"]);
    assert.equal(certState(parsed), "any");
  });

  it("empty search serialises to no query string", () => {
    assert.equal(serializeDiscoverState(EMPTY_STATE).toString(), "");
    assert.equal(discoverHref(EMPTY_STATE), "/app/discover");
  });

  it("maps sort=sources to the RPC's receipts", () => {
    const parsed = parseDiscoverState(new URLSearchParams("sort=sources"));
    assert.equal(parsed.sort, "sources");
    assert.equal(discoverRpcArgs(parsed).p_sort, "receipts");
    assert.equal(discoverRpcArgs(parsed).p_exclude_sanctioned, true);
  });

  it("drops unknown cert kinds and short HS codes", () => {
    const parsed = parseDiscoverState(new URLSearchParams("hs=61,61051,abc&cert=nope:valid,gots:bogus"));
    assert.deepEqual(parsed.hs, ["6105"]);
    assert.deepEqual(parsed.cert, []);
  });

  it("a composer submit that omits q still keeps city, workers and established", () => {
    const parsed = parseDiscoverState(
      new URLSearchParams("q=knit&city=Gazipur&workers_min=100&est_from=2000&page=3"),
    );
    const hidden = Object.fromEntries(discoverHiddenParams(parsed, COMPOSER_HIDDEN_OMIT));
    assert.equal(hidden.q, undefined);
    assert.equal(hidden.page, undefined);
    assert.equal(hidden.city, "Gazipur");
    assert.equal(hidden.workers_min, "100");
    assert.equal(hidden.est_from, "2000");
  });

  it("the filter form keeps the query and drops the fields it shows", () => {
    const parsed = parseDiscoverState(new URLSearchParams("q=knit&city=Gazipur&hs=6105"));
    const hidden = Object.fromEntries(discoverHiddenParams(parsed, FILTER_HIDDEN_OMIT));
    assert.equal(hidden.q, "knit");
    assert.equal(hidden.city, undefined);
    assert.equal(hidden.hs, undefined);
  });
});

describe("the sanctioned exclusion is disclosed, never silent", () => {
  // Goes red if `p_exclude_sanctioned` is hardcoded back to `true`, if the
  // chip is removed, or if the title reverts to the unqualified claim. The
  // defect this guards: sanctioned suppliers were withheld from every search
  // with no chip, no control and no mention, under a heading reading "All
  // published suppliers" — so a buyer searching a factory SourceBD had
  // flagged read "no match" and concluded there was no record of it.

  it("defaults to excluding, and says so in the title", () => {
    const state = parseDiscoverState(new URLSearchParams(""));
    assert.equal(state.sanctioned, false);
    assert.equal(discoverRpcArgs(state).p_exclude_sanctioned, true);
    assert.equal(queryTitle(state), "All published suppliers except sanctioned");
    assert.notEqual(
      queryTitle(state),
      "All published suppliers",
      "the unqualified title claims a set we are not returning",
    );
  });

  it("shows a removable chip whenever it is withholding records", () => {
    const state = parseDiscoverState(new URLSearchParams(""));
    const chip = discoverChips(state).find((c) => c.key === "sanctioned");
    assert.ok(chip, "no chip disclosed the sanctioned exclusion");
    assert.equal(chip.without.sanctioned, true, "the chip must be removable");
  });

  it("lifting it reaches the RPC, round-trips, and drops the chip", () => {
    const state = parseDiscoverState(new URLSearchParams("sanctioned=1"));
    assert.equal(state.sanctioned, true);
    assert.equal(discoverRpcArgs(state).p_exclude_sanctioned, false);
    assert.deepEqual(parseDiscoverState(serializeDiscoverState(state)), state);
    assert.equal(discoverChips(state).find((c) => c.key === "sanctioned"), undefined);
    assert.equal(queryTitle(state), "All published suppliers");
  });
});

describe("a certificate chip states what the query actually applies", () => {
  // The RPC takes one `p_cert_state` for every kind, so two different states
  // collapse to "any". The chips went on claiming the per-kind state the user
  // asked for, putting "Certificate · GOTS, valid" above a supplier whose only
  // GOTS certificate expired. Goes red if the chip label stops reading the
  // effective state back.

  it("says so when two states collapse to any", () => {
    const state = parseDiscoverState(new URLSearchParams("cert=gots:valid,wrap:expired"));
    assert.equal(certState(state), "any", "precondition: the states collapse");
    const labels = discoverChips(state)
      .filter((c) => c.key.startsWith("cert-"))
      .map((c) => c.label);
    for (const label of labels) {
      assert.doesNotMatch(
        label,
        /,\s*(valid|expired|expiring)$/,
        `"${label}" promises a state the query does not apply`,
      );
    }
    assert.ok(labels.some((l) => /any state/.test(l)), `expected the collapse to be named: ${JSON.stringify(labels)}`);
  });

  it("keeps the exact state when there is only one", () => {
    const state = parseDiscoverState(new URLSearchParams("cert=gots:valid,wrap:valid"));
    assert.equal(certState(state), "valid");
    const labels = discoverChips(state)
      .filter((c) => c.key.startsWith("cert-"))
      .map((c) => c.label);
    assert.ok(labels.every((l) => /,\s*valid$/.test(l)), JSON.stringify(labels));
  });
});

// The "Drop <this filter> · N remain" suggestions are the only thing a buyer
// gets on a zero-result search, and each one is keyed by a string literal that
// `discover_suppliers_explain` chooses in SQL and this module has to recognise
// in TypeScript. Nothing connected the two: the SQL emitted 'min_sources' and
// the switch handled "sources", so that suggestion silently rendered nothing.
// Read the literals out of the migration and hold every one of them to a real
// branch. Renaming one on either side, or adding a dimension to the SQL and
// forgetting the TypeScript, turns this red.
describe("the explain dimensions the migration emits", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8");
  const explain = sql.slice(sql.indexOf("create or replace function public.discover_suppliers_explain"));
  assert.ok(explain.length > 0, "0104 defines no discover_suppliers_explain");
  const dimensions = [...explain.matchAll(/select\s+'([a-z_]+)'::text\s*,\s*[a-z]+\.total_count/gi)].map((m) => m[1]!);

  it("is a list this test actually found", () => {
    // A regex that matches nothing would make every case below vacuous.
    assert.ok(dimensions.length >= 10, `found only ${dimensions.length}: ${JSON.stringify(dimensions)}`);
  });

  for (const dropped of [...new Set(dimensions)]) {
    it(`'${dropped}' drops a real filter family and has a buyer-facing name`, () => {
      const without = withoutFilterFamily(EMPTY_STATE, dropped);
      assert.ok(without, `withoutFilterFamily("${dropped}") is null, so its suggestion never renders`);
      const label = filterFamilyLabel(dropped);
      assert.notEqual(label, dropped, `filterFamilyLabel("${dropped}") falls through to the raw key`);
    });
  }
});
