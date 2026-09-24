import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  COMPOSER_HIDDEN_OMIT,
  EMPTY_STATE,
  FILTER_HIDDEN_OMIT,
  LIST_MAX,
  LIST_VALUE_MAX,
  certKinds,
  certState,
  discoverChips,
  discoverHiddenParams,
  discoverHref,
  discoverRpcArgs,
  filterCount,
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

  it("is the exact set the zero-result page depends on", () => {
    // `>= 10` was slack, not a backstop: there are 12, so two whole "Drop this
    // filter" suggestions could be deleted from the SQL — the only help a
    // buyer gets on an empty city search — with this green. Pin the set. A
    // dimension added to the migration fails here until it is handled below,
    // and one removed fails here until somebody says removing it was meant.
    assert.deepEqual(
      [...new Set(dimensions)].sort(),
      ["brand", "cert", "city", "district", "est", "hs", "min_sources", "q", "registry", "rsc", "type", "workers"].sort(),
      `discover_suppliers_explain emits a different set of dimensions: ${JSON.stringify(dimensions)}`,
    );
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

describe("a number outside its range is clamped, never silently dropped", () => {
  // Dropping it returned the unfiltered corpus under a URL that says it is
  // filtered: "Min sources" is a free-text box with no bound shown, so typing
  // 8 gave ?min_sources=8 -> null -> no chip, no message, every published
  // supplier, and the field redisplayed empty. Same shape as the `cert`
  // defect already fixed, which this module's own comment describes.
  it("keeps the filter on for an out-of-range value", () => {
    const high = parseDiscoverState(new URLSearchParams("min_sources=8"));
    assert.equal(high.minSources, 5, "min_sources=8 fell out of the state entirely");
    const low = parseDiscoverState(new URLSearchParams("min_sources=0"));
    assert.equal(low.minSources, 1);
    assert.equal(parseDiscoverState(new URLSearchParams("workers_min=0")).workersMin, 1);
    assert.equal(parseDiscoverState(new URLSearchParams("est_from=1899")).estFrom, 1900);
    assert.equal(parseDiscoverState(new URLSearchParams("est_to=3000")).estTo, 2100);
  });

  it("still renders a chip for every clamped filter, so the buyer sees what ran", () => {
    for (const raw of ["min_sources=8", "workers_min=0", "est_from=1899", "est_to=3000"]) {
      const state = parseDiscoverState(new URLSearchParams(raw));
      assert.ok(
        filterCount(state) > 0,
        `${raw} produced an unfiltered state, which the page would present as filtered`,
      );
      assert.ok(discoverChips(state).length > 0, `${raw} produced no chip`);
    }
  });

  it("text that is not a number at all is still dropped, and counts as no filter", () => {
    const state = parseDiscoverState(new URLSearchParams("min_sources=lots"));
    assert.equal(state.minSources, null);
    assert.equal(filterCount(state), 0);
  });
});

describe("chip keys are unique even when two families share a value", () => {
  it("a city and a district of the same name do not collide", () => {
    // Dhaka, Gazipur, Narayanganj and Chittagong are each both. Keyed on the
    // label, these were two chips with the same React key, and reconciliation
    // can hand one chip the other's remove link.
    const chips = discoverChips(parseDiscoverState(new URLSearchParams("city=Dhaka&district=Dhaka")));
    const labels = chips.map((c) => c.label);
    const keys = chips.map((c) => c.key);
    assert.ok(labels.length >= 2, JSON.stringify(labels));
    assert.equal(new Set(keys).size, keys.length, `duplicate chip keys: ${JSON.stringify(keys)}`);
  });

  it("every chip on a fully loaded search has its own key", () => {
    const raw =
      "q=knit&hs=6105,6110&cert=gots:valid&reg=BGMEA&brand=hm&district=Dhaka&city=Dhaka&type=factory&min_sources=3&rsc=active&est_from=2000&est_to=2020&workers_min=100&workers_max=5000";
    const keys = discoverChips(parseDiscoverState(new URLSearchParams(raw))).map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, `duplicate chip keys: ${JSON.stringify(keys)}`);
  });
});

describe("list parameters are bounded before they reach the database", () => {
  // Every supplier row is tested against every value (districts and cities
  // by ilike), so a URL with thousands of values chose the cost of every
  // search, count and export call made for it.
  it("caps each list's length and each value's length, and drops duplicates", () => {
    const junk = Array.from({ length: 4000 }, (_, i) => `d${i}`).join(",");
    const long = "x".repeat(LIST_VALUE_MAX + 1);
    const state = parseDiscoverState(new URLSearchParams({ district: junk, city: `${long},Dhaka,Dhaka`, hs: junk }));
    assert.equal(state.district.length, LIST_MAX);
    assert.deepEqual(state.city, ["Dhaka"], "an over-long value or a duplicate got through");
    const args = discoverRpcArgs(state) as Record<string, unknown>;
    for (const [k, v] of Object.entries(args)) {
      if (Array.isArray(v)) assert.ok(v.length <= LIST_MAX, `${k} sends ${v.length} values`);
    }
  });

  it("stays under 0104's own refusal, so a buyer never meets it", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8");
    const cap = Number(sql.match(/\)\s*>\s*(\d+)\s*\n\s*or exists/)?.[1]);
    const len = Number(sql.match(/where length\(x\) > (\d+)/)?.[1]);
    assert.ok(cap > 0 && LIST_MAX <= cap, `the app sends up to ${LIST_MAX}, the database refuses over ${cap}`);
    assert.ok(len > 0 && LIST_VALUE_MAX <= len, `the app allows ${LIST_VALUE_MAX} characters, the database ${len}`);
    // And both functions anon or a buyer can call check it first (CI runs
    // the refusal for real, as anon, in assert-0104.sql).
    const code = sql.replace(/--[^\n]*/g, "");
    for (const fn of ["discover_suppliers", "discover_suppliers_explain"]) {
      const start = code.indexOf(`create or replace function public.${fn}(`);
      const body = code.slice(start, code.indexOf("$fn$;", start));
      assert.match(body, /begin\s*perform public\.discover_v32_assert_bounded\(/, `${fn} does not check its lists first`);
    }
  });
});
