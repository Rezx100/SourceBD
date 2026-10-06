// The words of SourceBD v4's patterns (`03 Patterns`), in one place so a certificate
// chip, a table cell and an alert cannot say the same thing three ways. Pure.

import { certState, daysUntil, formatDay, formatMonth } from "@/lib/dashboard/facts";
import type { CertState } from "@/components/kit";

/**
 * A certificate's chip: its state and its words. Within 30 days it counts down in words
 * with the date ("Expires in 5 days · 8 Oct 2026"); from 31 to 90 days it shows the date
 * only ("Expires 19 Nov 2026"); further out "Valid until"; no date is not a pass and not a
 * problem ("No expiry date published").
 */
export function certWords(expiresOn: string | null | undefined, today: Date, delistedOn?: string | null): { state: CertState; label: string } {
  // A certificate its body stopped listing (spec-etl-freshness S2) is a problem whatever its date says.
  if (delistedOn) return { state: "expired", label: `No longer listed since ${formatDay(delistedOn) ?? "the last read"}` };
  const day = formatDay(expiresOn);
  const days = daysUntil(expiresOn, today);
  const s = certState(expiresOn, today);
  if (s === "no-expiry" || day === null || days === null) return { state: "none", label: "No expiry date published" };
  if (s === "expired") return { state: "expired", label: `Expired ${day}` };
  if (s === "valid") return { state: "valid", label: `Valid until ${day}` };
  if (days === 0) return { state: "expiring", label: `Expires today · ${day}` };
  if (days <= 30) return { state: "expiring", label: `Expires in ${days} ${days === 1 ? "day" : "days"} · ${day}` };
  return { state: "expiring", label: `Expires ${day}` };
}

/** Problems sort first: expired, expiring, valid, then no expiry on file. */
export const CERT_ORDER: Record<CertState, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

/** "Certificates · 4 · 2 expired": the count with its noun, and the problems in words. */
export function certHeading(states: CertState[]): string {
  const expired = states.filter((s) => s === "expired").length;
  return `Certificates · ${states.length}${expired ? ` · ${expired} expired` : ""}`;
}

/** US dollars as the quote tables write them: US$6.15, US$61,500. */
export function usd(n: number): string {
  return `US$${new Intl.NumberFormat("en-GB", { minimumFractionDigits: n < 1000 || n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n)}`;
}

/** A quote against the buyer's target: "US$0.35 under", "US$0.40 over", "On target". */
export function vsTarget(price: number, target: number): string {
  const d = Math.round((price - target) * 100) / 100;
  if (d === 0) return "On target";
  return `${usd(Math.abs(d))} ${d < 0 ? "under" : "over"}`;
}

/** An MOQ against the quantity wanted: null when it fits, else the words that warn. */
export function moqWarning(moq: number, wanted: number): string | null {
  return moq > wanted ? `${moq.toLocaleString("en-GB")} pieces · above your ${wanted.toLocaleString("en-GB")}` : null;
}

/** How a site is described, in words (the legend is never needed to read the page). */
export type SiteKind = "factory-exact" | "factory-approx" | "office";
export const SITE_WORDS: Record<SiteKind, string> = {
  "factory-exact": "Factory · pinned to the address",
  "factory-approx": "Factory · approximate location",
  office: "Office · registered and mailing address",
};

/** The one definition of "approximate": a geocode below 70 confidence (DESIGN-v4 section 5). */
export function isApproximate(confidence: number | null | undefined): boolean {
  return confidence === null || confidence === undefined || confidence < 70;
}

/** "3 days late" for a planned date that has passed; null while it has not. */
export function lateWords(plannedOn: string, today: Date): string | null {
  const d = daysUntil(plannedOn, today);
  if (d === null || d >= 0) return null;
  return `${-d} ${d === -1 ? "day" : "days"} late`;
}

/** The first certificate problem in a list row: "WRAP expired 29 Sep 2026" and how many more certificates follow. */
export type CertLine = { state: "expired" | "expiring" | "valid" | "none"; text: string; more: number };

/**
 * The one line a list row or table cell says about certificates: the worst one first
 * (expired, then expiring, then valid, then none dated), its scheme and the chip's own
 * words in lower case after it, and "· 3 more certificates" for the rest. `null` when the
 * supplier has no certificate at all, so the row says "None found" itself.
 */
export function certLine(certs: readonly CertInput[], today: Date): CertLine | null {
  if (certs.length === 0) return null;
  const ranked = rankCerts(certs, today);
  return { state: ranked[0]!.w.state, text: lineWords(ranked[0]!), more: ranked.length - 1 };
}

type CertInput = { scheme: string; expiresOn: string | null; delistedOn?: string | null; markCode?: string };
type Ranked = { c: CertInput; w: { state: CertLine["state"]; label: string }; t: number };

/** Worst first: expired (the latest lapse leading), expiring (the soonest), valid, then none dated. */
function rankCerts(certs: readonly CertInput[], today: Date): Ranked[] {
  return certs
    .map((c) => ({ c, w: certWords(c.expiresOn, today, c.delistedOn), t: c.expiresOn ? Date.parse(c.expiresOn) : 0 }))
    .sort((a, b) => CERT_ORDER[a.w.state] - CERT_ORDER[b.w.state] || (a.w.state === "expired" ? b.t - a.t : a.t - b.t) || a.c.scheme.localeCompare(b.c.scheme));
}

/** "WRAP expired 29 Sep 2026": the scheme, then the chip's own words in lower case. */
const lineWords = ({ c, w }: Ranked) => `${c.scheme} ${w.label.charAt(0).toLowerCase()}${w.label.slice(1)}`;

/**
 * A certificate body in a table cell: the code its mark is filed under, its scheme in words, and
 * the whole sentence about its worst certificate, which is the mark's name on hover and to a
 * screen reader (`context/logos.lock.md` section 1: a mark never stands without its name).
 */
export type CertBody = { code: string; scheme: string; words: string };

/**
 * The certificates of a row as a compact table cell (founder, 6 Oct 2026: "it must be compacted
 * and the entity logos must be visible"): the worst certificate's body and its state in a few
 * words, every other body once (worst first), how many certificates there are, and the line the
 * narrow list says, for the cell's title.
 */
export type CertSummary = { state: CertLine["state"]; short: string; first: CertBody; others: CertBody[]; total: number; words: string };

export function certSummary(certs: readonly CertInput[], today: Date): CertSummary | null {
  if (certs.length === 0) return null;
  const ranked = rankCerts(certs, today);
  // Ranked worst first, so the first certificate met of a body is that body's worst.
  const bodies = new Map<string, CertBody>();
  for (const r of ranked) {
    const code = (r.c.markCode ?? r.c.scheme).toUpperCase();
    if (!bodies.has(code)) bodies.set(code, { code, scheme: r.c.scheme, words: lineWords(r) });
  }
  const [first, ...others] = [...bodies.values()];
  const more = ranked.length - 1;
  return {
    state: ranked[0]!.w.state,
    short: certShort(ranked[0]!.c.expiresOn, today, ranked[0]!.c.delistedOn),
    first: first!,
    others,
    total: ranked.length,
    words: `${first!.words}${more ? ` · ${more} more ${more === 1 ? "certificate" : "certificates"}` : ""}`,
  };
}

/**
 * A certificate's state in the fewest words that are still a fact (Paper's compact certificate
 * rows: "Expired 29 Sep", "Valid to May 2027", "No expiry given"). The exact date stays in
 * `certWords`, which the cell's title and the record carry.
 */
export function certShort(expiresOn: string | null | undefined, today: Date, delistedOn?: string | null): string {
  if (delistedOn) return "No longer listed";
  const { state } = certWords(expiresOn, today);
  const day = formatDay(expiresOn);
  const month = formatMonth(expiresOn);
  const days = daysUntil(expiresOn, today);
  if (state === "none" || day === null || month === null || days === null) return "No expiry given";
  if (state === "valid") return `Valid to ${month}`;
  const dayMonth = day.slice(0, day.lastIndexOf(" "));
  // This year the day and month are the date; an older lapse is its month and year.
  if (state === "expired") return day.endsWith(` ${today.getUTCFullYear()}`) ? `Expired ${dayMonth}` : `Expired ${month}`;
  if (days === 0) return "Expires today";
  return days <= 30 ? `Expires in ${days} ${days === 1 ? "day" : "days"}` : `Expires ${dayMonth}`;
}