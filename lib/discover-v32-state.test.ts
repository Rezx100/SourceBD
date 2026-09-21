import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPOSER_HIDDEN_OMIT,
  EMPTY_STATE,
  FILTER_HIDDEN_OMIT,
  certKinds,
  certState,
  discoverHiddenParams,
  discoverHref,
  discoverRpcArgs,
  parseDiscoverState,
  serializeDiscoverState,
  sortRpc,
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
