// The marketing demos' data (handoff-mercury-m2-m3.md, M2): a committed snapshot of real records read from
// production through the anon RPCs by `ops/marketing_demo_snapshot.mjs`, typed here so the demos under
// `components/site/demos` draw only what was read. `readAt` is the day of the read and the demos' "today": every
// certificate state and caption is worked out against it, so a demo says the same thing on any day it is opened and
// its caption ("Real records as read 14 Oct 2026") is true of what it shows. No contact field is in the file (the
// script refuses to write one), and no company is invented: the one placeholder, "Example Apparel Ltd", is the
// sanctioned sample the whole site uses.

import { displayName, formatDay } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import type { CertInput } from "@/components/patterns/words";
import raw from "./demo-snapshot.json";

export type SnapshotCert = { kind: string; number: string | null; issuer: string | null; expiresOn: string | null };
export type SnapshotRow = { slug: string; name: string; type: string; place: string | null; workers: number | null; sources: number; products: string[]; certs: { kind: string; expiresOn: string | null }[] };
export type SnapshotRecord = { slug: string; name: string; type: string; place: string | null; workers: number | null; sources: string[]; read: Record<string, string>; bgmea: string | null; certs: SnapshotCert[] };
export type DemoSnapshot = {
  readAt: string;
  search: { q: string; chips: string[]; total: number | null; rows: SnapshotRow[] };
  check: SnapshotRecord;
  saved: SnapshotRecord[];
  uflpa: { entries: number | null; lastRead: string | null } | null;
};

// Through `unknown`: the JSON's inferred shape has optional keys where the type has an index signature.
export const SNAPSHOT = raw as unknown as DemoSnapshot;

/** The demos' "today": the day the snapshot was read. */
export const TODAY = new Date(`${SNAPSHOT.readAt}T00:00:00Z`);

/** "14 Oct 2026". */
export const READ_AT = formatDay(SNAPSHOT.readAt) ?? SNAPSHOT.readAt;

/** Every demo's caption. */
export const CAPTION = `Real records as read ${READ_AT}`;

/** The placeholder the sanctioned sample uses everywhere on the site; never a real company. */
export const SANCTIONED_SAMPLE = "Example Apparel Ltd";

/** A snapshot certificate as the patterns' words take it: the scheme in words, its mark code, its date. */
export function certInput(c: { kind: string; expiresOn: string | null }): CertInput {
  return { scheme: certName(c.kind, null), expiresOn: c.expiresOn, markCode: c.kind.toUpperCase() };
}

/** Every company name the snapshot holds, as the product writes it. */
export function snapshotNames(): string[] {
  return [...new Set([...SNAPSHOT.search.rows.map((r) => r.name), SNAPSHOT.check.name, ...SNAPSHOT.saved.map((r) => r.name)].map(displayName))];
}
