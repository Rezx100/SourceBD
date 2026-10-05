// The words of SourceBD v4's patterns (`03 Patterns`), in one place so a certificate
// chip, a table cell and an alert cannot say the same thing three ways. Pure.

import { certState, daysUntil, formatDay } from "@/lib/dashboard/facts";
import type { CertState } from "@/components/kit";

/**
 * A certificate's chip: its state and its words. Within 30 days it counts down in words
 * with the date ("Expires in 5 days · 8 Oct 2026"); from 31 to 90 days it shows the date
 * only ("Expires 19 Nov 2026"); further out "Valid until"; no date is not a pass and not a
 * problem ("No expiry date published").
 */
export function certWords(expiresOn: string | null | undefined, today: Date): { state: CertState; label: string } {
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
export function certLine(certs: readonly { scheme: string; expiresOn: string | null }[], today: Date): CertLine | null {
  if (certs.length === 0) return null;
  const ranked = certs
    .map((c) => ({ c, w: certWords(c.expiresOn, today), t: c.expiresOn ? Date.parse(c.expiresOn) : 0 }))
    .sort((a, b) => CERT_ORDER[a.w.state] - CERT_ORDER[b.w.state] || (a.w.state === "expired" ? b.t - a.t : a.t - b.t) || a.c.scheme.localeCompare(b.c.scheme));
  const first = ranked[0]!;
  return { state: first.w.state, text: `${first.c.scheme} ${first.w.label.charAt(0).toLowerCase()}${first.w.label.slice(1)}`, more: ranked.length - 1 };
}
