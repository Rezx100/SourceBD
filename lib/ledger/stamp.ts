// Asking the outside timestamp authority to stamp a seal (moderation plan 1e, decision 2). One POST of a
// TimeStampReq, one TimeStampResp back. The authority's answer is kept whole; what we read out of it (the
// time, the hash it covers) is for the record's own display, and the checking script verifies the signature.

import { randomBytes } from "node:crypto";

import { PKI_STATUS, buildTimeStampRequest, parseTimeStampResponse } from "./tsa";

/** The default authority: a free, long-running RFC 3161 service. The founder may name another in LEDGER_TSA_URL. */
export const DEFAULT_TSA_URL = "https://freetsa.org/tsr";

export type Stamp = { token: Buffer; genTime: Date | null; status: number; tsaUrl: string };

export async function requestTimestamp(opts: { tsaUrl: string; sha256Hex: string; fetchImpl?: typeof fetch; nonce?: bigint }): Promise<Stamp> {
  const nonce = opts.nonce ?? BigInt("0x" + randomBytes(8).toString("hex"));
  const body = buildTimeStampRequest(opts.sha256Hex, nonce);
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(opts.tsaUrl, {
    method: "POST",
    headers: { "content-type": "application/timestamp-query", accept: "application/timestamp-reply" },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`the timestamp authority answered HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const read = parseTimeStampResponse(bytes);
  if (read.status > 1 || !read.token) {
    throw new Error(`the timestamp authority refused: ${PKI_STATUS[read.status] ?? `status ${read.status}`}`);
  }
  if (read.imprintHex && read.imprintHex.toLowerCase() !== opts.sha256Hex.toLowerCase()) {
    throw new Error("the timestamp authority's token covers a different hash");
  }
  return { token: read.token, genTime: read.genTime, status: read.status, tsaUrl: opts.tsaUrl };
}
