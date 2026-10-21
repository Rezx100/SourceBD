// The marketing demos' data (handoff-mercury-m2-m3.md, M2): a committed snapshot of real records read from
// production through the anon RPCs by `ops/marketing_demo_snapshot.mjs`, typed here so the demos under
// `components/site/demos` draw only what was read. `readAt` is the day of the read and the demos' "today": every
// certificate state and caption is worked out against it, so a demo says the same thing on any day it is opened and
// its caption ("Real records as read 14 Oct 2026") is true of what it shows. No contact field is in the file (the
// script refuses to write one), and no company is invented: the one placeholder, "Example Apparel Ltd", is the
// sanctioned sample the whole site uses.

import { certScheme, displayName, formatDay } from "@/lib/dashboard/facts";
import type { CertInput } from "@/components/patterns/words";
import raw from "./demo-snapshot.json";

export type SnapshotCert = { kind: string; number: string | null; issuer: string | null; expiresOn: string | null };
export type SnapshotRow = { slug: string; name: string; type: string; place: string | null; workers: number | null; sources: number; products: string[]; certs: { kind: string; expiresOn: string | null }[] };
/** One RSC row of a record: the mother's (no building name) or a building's, as `buyer_supplier_profile` files it; the report names the register published. */
export type SnapshotRsc = { building: string | null; status: string | null; progress: number | null; training: string | null; readOn: string | null; workers: number | null; reports: string[] };
export type SnapshotRecord = {
  slug: string;
  name: string;
  type: string;
  place: string | null;
  workers: number | null;
  /** Every source that files the record, brand lists included. */
  sources: string[];
  /** The registers and certifiers that hold it (tiers 1 to 3): the count the product prints as "N sources". */
  registers: number | null;
  read: Record<string, string>;
  bgmea: string | null;
  certs: SnapshotCert[];
  /** The Check record only: its RSC rows. */
  rsc?: SnapshotRsc[];
};
export type DemoSnapshot = {
  readAt: string;
  /** `total` is the search with GOTS held; `qTotal` the words alone. */
  search: { q: string; chips: string[]; total: number | null; qTotal?: number | null; rows: SnapshotRow[] };
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

/** How many registers and certifiers hold a record, as the product counts its sources (tiers 1 to 3, brand lists apart). */
export function registerCount(r: Pick<SnapshotRecord, "sources" | "registers">): number {
  return r.registers ?? r.sources.filter((s) => !s.startsWith("BRAND_")).length;
}

/** How many brand supplier lists name a record. */
export const brandCount = (r: Pick<SnapshotRecord, "sources">): number => r.sources.filter((s) => s.startsWith("BRAND_")).length;

/** The product's caption for a record's sources (lib/dashboard/build-discover-row.ts): "8 registers & certifiers · 3 brand lists". */
export function sourcesCaption(r: Pick<SnapshotRecord, "sources" | "registers">): string {
  const n = registerCount(r);
  const b = brandCount(r);
  return [n === 0 ? "No register or certifier" : `${n} ${n === 1 ? "register or certifier" : "registers & certifiers"}`, b ? `${b} brand ${b === 1 ? "list" : "lists"}` : null].filter(Boolean).join(" · ");
}

/** A brand supplier list's short name as the results row writes it (lib/dashboard/build-discover-row.ts); a register's code is its own name. */
export const BRAND_LIST: Record<string, string> = { BRAND_HM: "H&M", BRAND_ASOS: "ASOS", BRAND_NEXT: "NEXT", BRAND_MS: "M&S", BRAND_INDITEX: "Inditex", BRAND_PRIMARK: "Primark" };

/**
 * The register a certificate scheme is read from (the home page's names, lib/home-records.ts): the mark's code for
 * `SourceMark`, the code the record's read day is filed under (and the receipt is written with), and the register's name.
 */
export const CERT_REGISTER: Record<string, { mark: string; code: string; name: string }> = {
  gots: { mark: "GOTS", code: "GOTS", name: "GOTS database" },
  wrap: { mark: "WRAP", code: "WRAP", name: "WRAP register" },
  oeko_tex: { mark: "OEKO_TEX", code: "OEKO-TEX", name: "OEKO-TEX buying guide" },
};

/** A snapshot certificate as the results table builds it (`resultRow`, components/search/model.ts): the scheme's short name, its date, its code. */
export function certInput(c: { kind: string; expiresOn: string | null }): CertInput {
  return { scheme: certScheme(c.kind), expiresOn: c.expiresOn, markCode: c.kind };
}

/** Every company name the snapshot holds, as the product writes it. */
export function snapshotNames(): string[] {
  return [...new Set([...SNAPSHOT.search.rows.map((r) => r.name), SNAPSHOT.check.name, ...SNAPSHOT.saved.map((r) => r.name)].map(displayName))];
}
