// RFC 3161 at the bytes (moderation plan 1e): the request we send reads back as the five fields it should
// be, a granted response gives up its token, its time and the hash it covers, a rejection has no token,
// and anything that is not a response is refused.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PKI_STATUS, buildTimeStampRequest, buildTimeStampResponse, derChildren, derOidText, derRead, parseGeneralizedTime, parseTimeStampResponse } from "./tsa";

const HASH = "ab".repeat(32);

describe("the request", () => {
  it("is version 1, a sha256 imprint of the hash, the nonce and certReq true", () => {
    const req = buildTimeStampRequest(HASH, 123456789n);
    const seq = derRead(req, 0);
    assert.equal(seq.tag, 0x30);
    const [version, imprint, nonce, certReq] = derChildren(req, seq);
    assert.equal(version?.tag, 0x02);
    assert.deepEqual([...req.subarray(version!.start, version!.end)], [1]);
    const [algorithm, hashed] = derChildren(req, imprint!);
    assert.equal(derOidText(req, derChildren(req, algorithm!)[0]!), "2.16.840.1.101.3.4.2.1");
    assert.equal(req.subarray(hashed!.start, hashed!.end).toString("hex"), HASH);
    assert.equal(nonce?.tag, 0x02);
    assert.equal(certReq?.tag, 0x01);
    assert.equal(req[certReq!.start], 0xff);
  });

  it("refuses anything but a sha256", () => {
    assert.throws(() => buildTimeStampRequest("abc", 1n), /64 hex/);
  });
});

describe("the response", () => {
  it("granted: the status, the whole token, the authority's time and the hash it covers", () => {
    const at = new Date("2026-10-06T15:00:00Z");
    const resp = buildTimeStampResponse(HASH, at);
    const read = parseTimeStampResponse(resp);
    assert.equal(read.status, 0);
    assert.equal(PKI_STATUS[read.status], "granted");
    assert.ok(read.token && read.token.length > 0);
    assert.equal(read.token![0], 0x30, "the token is the whole ContentInfo, tag first");
    assert.equal(read.genTime?.toISOString(), at.toISOString());
    assert.equal(read.imprintHex, HASH);
    // The token is a self-contained DER value: it reads back as exactly its own length.
    assert.equal(derRead(read.token!, 0).end, read.token!.length);
  });

  it("a rejection has a status and no token", () => {
    const read = parseTimeStampResponse(buildTimeStampResponse(HASH, new Date(), 2));
    assert.equal(read.status, 2);
    assert.equal(PKI_STATUS[read.status], "rejected");
    assert.equal(read.token, null);
    assert.equal(read.genTime, null);
  });

  it("bytes that are not a response are refused", () => {
    assert.throws(() => parseTimeStampResponse(Buffer.from("<html>no</html>")), /TimeStampResp|DER/);
    assert.throws(() => parseTimeStampResponse(Buffer.from([0x30, 0x80])), /DER/);
  });

  it("GeneralizedTime with and without fractions, and a form that is not one", () => {
    assert.equal(parseGeneralizedTime("20261006150000Z")?.toISOString(), "2026-10-06T15:00:00.000Z");
    assert.equal(parseGeneralizedTime("20261006150000.25Z")?.toISOString(), "2026-10-06T15:00:00.250Z");
    assert.equal(parseGeneralizedTime("2026-10-06"), null);
  });
});
