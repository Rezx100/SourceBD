// RFC 3161 time-stamping, the small part of it we need (moderation plan 1e, decision 2): build a
// TimeStampReq over a sha256, and read a TimeStampResp back for its status, its token and the time the
// authority signed. Hand-rolled DER, because the request is five fields and the response is read, never
// trusted: the token is kept whole and verified later with the checking script (openssl ts -verify).
// No dependency: the no-new-tools rule.

const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_TST_INFO = "1.2.840.113549.1.9.16.1.4";

// ------------------------------------------------------------------ encode

function derLength(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** One TLV: `tag`, the length, the content. */
export function derNode(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

export function derOid(oid: string): Buffer {
  const parts = oid.split(".").map(Number);
  const first = parts[0]! * 40 + parts[1]!;
  const body: number[] = [first];
  for (const p of parts.slice(2)) {
    const chunk: number[] = [p & 0x7f];
    let v = p >> 7;
    while (v > 0) {
      chunk.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    body.push(...chunk);
  }
  return derNode(0x06, Buffer.from(body));
}

export function derInteger(n: bigint): Buffer {
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let bytes = Buffer.from(hex, "hex");
  if (bytes.length === 0) bytes = Buffer.from([0]);
  if (bytes[0]! & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return derNode(0x02, bytes);
}

/** The request: version 1, the sha256 imprint, a nonce, and "please include your certificate". */
export function buildTimeStampRequest(sha256Hex: string, nonce: bigint): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(sha256Hex)) throw new Error("a TimeStampReq needs a sha256 as 64 hex characters");
  const algorithm = derNode(0x30, Buffer.concat([derOid(OID_SHA256), derNode(0x05, Buffer.alloc(0))]));
  const imprint = derNode(0x30, Buffer.concat([algorithm, derNode(0x04, Buffer.from(sha256Hex, "hex"))]));
  return derNode(0x30, Buffer.concat([derInteger(1n), imprint, derInteger(nonce), derNode(0x01, Buffer.from([0xff]))]));
}

// ------------------------------------------------------------------ decode

/** One TLV: its tag, where it begins (the tag byte), where its content starts and where it ends. */
export type DerNode = { tag: number; offset: number; start: number; end: number };

export function derRead(buf: Buffer, offset: number): DerNode {
  if (offset + 2 > buf.length) throw new Error("DER: truncated");
  const tag = buf[offset]!;
  let len = buf[offset + 1]!;
  let p = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || p + n > buf.length) throw new Error("DER: bad length");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[p + i]!;
    p += n;
  }
  if (p + len > buf.length) throw new Error("DER: content past the end");
  return { tag, offset, start: p, end: p + len };
}

/** The children of a constructed node, in order. */
export function derChildren(buf: Buffer, node: DerNode): DerNode[] {
  const out: DerNode[] = [];
  let p = node.start;
  while (p < node.end) {
    const child = derRead(buf, p);
    out.push(child);
    p = child.end;
  }
  return out;
}

export function derOidText(buf: Buffer, node: DerNode): string {
  const b = buf.subarray(node.start, node.end);
  const parts: number[] = [Math.floor(b[0]! / 40), b[0]! % 40];
  let v = 0;
  for (let i = 1; i < b.length; i++) {
    v = (v << 7) | (b[i]! & 0x7f);
    if (!(b[i]! & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

function derIntegerValue(buf: Buffer, node: DerNode): number {
  let v = 0;
  for (let i = node.start; i < node.end; i++) v = (v << 8) | buf[i]!;
  return v;
}

/** GeneralizedTime "YYYYMMDDHHMMSS[.fff]Z" as a Date. */
export function parseGeneralizedTime(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3})\d*)?Z$/.exec(s);
  if (!m) return null;
  const ms = m[7] ? Number(m[7].padEnd(3, "0")) : 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), ms));
}

export type TimeStampResponse = {
  /** PKIStatus: 0 granted, 1 granted with modifications, 2 rejection, 3 waiting, 4 revocation warning, 5 revoked. */
  status: number;
  /** The whole TimeStampToken (a CMS ContentInfo) as the authority sent it; null when none. */
  token: Buffer | null;
  /** The authority's time from TSTInfo.genTime; null when it could not be read. */
  genTime: Date | null;
  /** The sha256 the token covers, as hex; null when it could not be read. */
  imprintHex: string | null;
};

export const PKI_STATUS: Record<number, string> = {
  0: "granted",
  1: "granted with modifications",
  2: "rejected",
  3: "waiting",
  4: "revocation warning",
  5: "revoked",
};

/** Reads a TimeStampResp. Throws on bytes that are not one; a token it cannot read inside is kept whole with no time. */
export function parseTimeStampResponse(buf: Buffer): TimeStampResponse {
  const resp = derRead(buf, 0);
  if (resp.tag !== 0x30) throw new Error("TimeStampResp: not a SEQUENCE");
  const [statusInfo, tokenNode] = derChildren(buf, resp);
  if (!statusInfo || statusInfo.tag !== 0x30) throw new Error("TimeStampResp: no status");
  const statusInt = derChildren(buf, statusInfo)[0];
  if (!statusInt || statusInt.tag !== 0x02) throw new Error("TimeStampResp: no status integer");
  const status = derIntegerValue(buf, statusInt);
  if (!tokenNode) return { status, token: null, genTime: null, imprintHex: null };

  const token = Buffer.from(buf.subarray(tokenNode.offset, tokenNode.end));
  let genTime: Date | null = null;
  let imprintHex: string | null = null;
  try {
    const [contentType, explicit] = derChildren(buf, tokenNode);
    if (contentType && derOidText(buf, contentType) === OID_SIGNED_DATA && explicit) {
      const signedData = derChildren(buf, explicit)[0];
      if (signedData) {
        // version, digestAlgorithms, encapContentInfo, ...
        const encap = derChildren(buf, signedData)[2];
        if (encap) {
          const [eType, eContent] = derChildren(buf, encap);
          if (eType && derOidText(buf, eType) === OID_TST_INFO && eContent) {
            const octet = derChildren(buf, eContent)[0];
            if (octet && octet.tag === 0x04) {
              const tst = Buffer.from(buf.subarray(octet.start, octet.end));
              // TSTInfo: version, policy, messageImprint, serialNumber, genTime, ...
              const fields = derChildren(tst, derRead(tst, 0));
              const imprint = fields[2];
              if (imprint) {
                const hashed = derChildren(tst, imprint)[1];
                if (hashed && hashed.tag === 0x04) imprintHex = tst.subarray(hashed.start, hashed.end).toString("hex");
              }
              const time = fields[4];
              if (time && time.tag === 0x18) genTime = parseGeneralizedTime(tst.subarray(time.start, time.end).toString("ascii"));
            }
          }
        }
      }
    }
  } catch {
    // Kept whole for the checking script; the time is simply unknown.
  }
  return { status, token, genTime, imprintHex };
}

/** A TimeStampResp for tests and the checking script's fixtures: granted, with a TSTInfo over `sha256Hex` at `genTime`. */
export function buildTimeStampResponse(sha256Hex: string, genTime: Date, status = 0): Buffer {
  const algorithm = derNode(0x30, Buffer.concat([derOid(OID_SHA256), derNode(0x05, Buffer.alloc(0))]));
  const imprint = derNode(0x30, Buffer.concat([algorithm, derNode(0x04, Buffer.from(sha256Hex, "hex"))]));
  const time = genTime.toISOString().replace(/[-:T]/g, "").replace(/\.\d{3}Z$/, "Z");
  const tstInfo = derNode(0x30, Buffer.concat([derInteger(1n), derOid("1.3.6.1.4.1.13762.3"), imprint, derInteger(7n), derNode(0x18, Buffer.from(time, "ascii"))]));
  const encap = derNode(0x30, Buffer.concat([derOid(OID_TST_INFO), derNode(0xa0, derNode(0x04, tstInfo))]));
  const signedData = derNode(0x30, Buffer.concat([derInteger(3n), derNode(0x31, Buffer.alloc(0)), encap, derNode(0x31, Buffer.alloc(0))]));
  const token = derNode(0x30, Buffer.concat([derOid(OID_SIGNED_DATA), derNode(0xa0, signedData)]));
  const statusInfo = derNode(0x30, derInteger(BigInt(status)));
  return derNode(0x30, status <= 1 ? Buffer.concat([statusInfo, token]) : statusInfo);
}
