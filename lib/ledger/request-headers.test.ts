// The two headers the server forwards for the activity record (moderation plan 1b): which address wins,
// that nothing is sent when nothing is known, and that a header can never smuggle a second line.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FORWARDED_IP_HEADER, FORWARDED_UA_HEADER, forwardedRequestHeaders, visitorIp } from "./request-headers";

describe("the visitor's address", () => {
  it("Cloudflare's header wins, then x-real-ip, then the leftmost x-forwarded-for", () => {
    assert.equal(visitorIp(new Headers({ "cf-connecting-ip": "203.0.113.9", "x-real-ip": "10.0.0.2", "x-forwarded-for": "198.51.100.7, 10.0.0.1" })), "203.0.113.9");
    assert.equal(visitorIp(new Headers({ "x-real-ip": "10.0.0.2", "x-forwarded-for": "198.51.100.7, 10.0.0.1" })), "10.0.0.2");
    assert.equal(visitorIp(new Headers({ "x-forwarded-for": " 198.51.100.7 , 10.0.0.1" })), "198.51.100.7");
  });

  it("no header, no address: never 0.0.0.0", () => {
    assert.equal(visitorIp(new Headers()), null);
    assert.equal(visitorIp(null), null);
    assert.deepEqual(forwardedRequestHeaders(new Headers()), {});
    assert.deepEqual(forwardedRequestHeaders(undefined), {});
  });
});

describe("the forwarded headers", () => {
  it("carry the address and the browser under the names the database reads", () => {
    const out = forwardedRequestHeaders(new Headers({ "x-forwarded-for": "198.51.100.7", "user-agent": "Mozilla/5.0 (CI)" }));
    assert.deepEqual(out, { [FORWARDED_IP_HEADER]: "198.51.100.7", [FORWARDED_UA_HEADER]: "Mozilla/5.0 (CI)" });
    assert.equal(FORWARDED_IP_HEADER, "x-sourcebd-ip");
    assert.equal(FORWARDED_UA_HEADER, "x-sourcebd-ua");
  });

  it("a browser string is bounded and cannot carry a second line", () => {
    const h = new Headers();
    h.set("user-agent", "A".repeat(500));
    assert.equal(forwardedRequestHeaders(h)[FORWARDED_UA_HEADER]?.length, 300);
    // Headers refuses a raw newline; a control character that slips through is dropped.
    const ua = `Evil\u0001Agent\u007f`;
    h.set("user-agent", ua);
    assert.equal(forwardedRequestHeaders(h)[FORWARDED_UA_HEADER], "EvilAgent");
  });

  it("an address is bounded too, so a long forged header cannot grow the record", () => {
    const h = new Headers({ "x-forwarded-for": "1".repeat(200) });
    assert.equal(visitorIp(h)?.length, 64);
  });
});
