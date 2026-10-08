// The words of Compliance (B6c, Paper `10 · Compliance`, `· certificate expiry`, `· UFLPA checks`,
// `11 · Alerts`): the certificates that need a look, the expiry list in its three groups, the UFLPA
// counts and each supplier's result, and the sidebar badge. ONE function decides how many
// certificates need a look (`attentionOf` in `lib/dashboard/needs-attention.ts`); the hub's heading,
// the landing's block and the sidebar badge all read its `total`, so they cannot say 2, 8 and 9 for
// the same thing. Everything is worked out from what the four compliance reads return. Pure.

import { attentionOf, certName, type Attention, type AttentionCertRow, type AttentionRow } from "@/lib/dashboard/needs-attention";
import { certRowId, daysUntil, displayName, formatCount, formatDay } from "@/lib/dashboard/facts";

/** A certificate as the two compliance reads return it (`compliance_expiring_certs`, `compliance_expired_certs`). */
export type CertRead = AttentionCertRow & {
  issuer?: string | null;
  document_url?: string | null;
  days_remaining?: number;
  /** 0122: "no_longer_listed" when the body stopped listing it, and the day it did. */
  listing_status?: string;
  delisted_on?: string | null;
  supplier: AttentionCertRow["supplier"] & { entity_type?: string; city?: string | null; district?: string | null };
};

export type CertList = { total: number; rows: CertRead[] };

export type UflpaStatus = "hit" | "region_flag" | "clear";
export type UflpaHit = { matched_name: string | null; list_entry_ref: string | null; source_url: string | null; entity_name: string | null; listed_date?: string | null };
export type UflpaRow = {
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  country: string | null;
  parent_group_name: string | null;
  uflpa_hits: UflpaHit[];
  status: UflpaStatus;
};
export type UflpaPayload = { total: number; hits: number; flags: number; clear: number; rows: UflpaRow[] };

/** What `compliance_msa_inputs` says about the footprint the statement is drawn from. */
export type MsaSummary = { total_saved: number; total_published: number; rsc_covered: number; expiring_certs_90d: number };

export const DHS_LIST_URL = "https://www.dhs.gov/uflpa-entity-list";
export const COMPLIANCE_HREF = "/app/compliance";
export const EXPIRY_HREF = "/app/compliance/expiry";
export const UFLPA_HREF = "/app/compliance/uflpa";
export const MSA_HREF = "/app/compliance/msa";

const noun = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ the one count */

/** The certificates that need a look: every expired one with no renewal on file, then every one lapsing inside 90 days. Null when neither read worked. */
export function attention(expired: CertList | null, expiring: CertList | null, today: Date): Attention | null {
  return attentionOf(expired, expiring, today, Number.MAX_SAFE_INTEGER);
}

export type AttentionGroup = "expired" | "within30" | "within90";

/** Which of the hub's three lines a row sits under. Only a heading: the count above is still the one `attentionOf` total. */
export const attentionGroup = (r: Pick<AttentionRow, "state" | "days">): AttentionGroup => (r.state === "expired" ? "expired" : r.days <= 30 ? "within30" : "within90");

/** "Expired · 3", "Expires within 30 days · 2", "Coming up in 31 to 90 days · 3": the line over each group's rows. */
export function attentionGroupLines(rows: readonly Pick<AttentionRow, "state" | "days">[]): Record<AttentionGroup, string> & { counts: Record<AttentionGroup, number> } {
  const counts: Record<AttentionGroup, number> = { expired: 0, within30: 0, within90: 0 };
  for (const r of rows) counts[attentionGroup(r)] += 1;
  return {
    expired: `Expired · ${counts.expired}`,
    within30: `Expires within 30 days · ${counts.within30}`,
    within90: `Coming up in 31 to 90 days · ${counts.within90}`,
    counts,
  };
}

/** The sidebar's Compliance badge: "8 to check" in caution ink (dates that passed, not a failure), nothing when none or unread, never a 0. */
export function complianceBadge(a: Pick<Attention, "total"> | null): { text: string; tone: "caution" } | null {
  return a && a.total > 0 ? { text: `${formatCount(a.total)} to check`, tone: "caution" } : null;
}

/** The hub's caption: "... for 11 saved suppliers". */
export function hubCaption(savedTotal: number | null): string {
  const base = "Certificates, forced-labour checks and your modern slavery statement";
  return savedTotal === null ? `${base} for your saved suppliers.` : `${base} for ${noun(savedTotal, "saved supplier")}.`;
}

/* ------------------------------------------------------------------ expiry */

export type ExpiryShow = "all" | "expired" | "30" | "90";

/** `?show=` as the page reads it: anything but one of the three groups is the whole list. */
export function parseShow(raw: string | string[] | undefined): ExpiryShow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "expired" || v === "30" || v === "90" ? v : "all";
}

/** Download CSV on Compliance and Certificate expiry: the certificates a `?show=` filter draws (`/api/v1/export`). */
export const certExportHref = (show: ExpiryShow = "all") => `/api/v1/export?kind=certificates${show === "all" ? "" : `&show=${show}`}`;

export const expiryHref = (show: ExpiryShow) => (show === "all" ? EXPIRY_HREF : `${EXPIRY_HREF}?show=${show}`);

export type CertItem = {
  key: string;
  state: "expired" | "expiring";
  /** "Expired 29 Sep 2026" or "Expires 8 Oct 2026". */
  when: string;
  /** "in 5 days" for a certificate that is yet to lapse. */
  relative: string | null;
  scheme: string;
  number: string | null;
  /** "WRAP 7865", or "GOTS-26992" when the number already carries its scheme: for a sentence. */
  label: string;
  supplier: string;
  slug: string;
  /** "Dhaka": the supplier's place, when it has one. */
  place: string | null;
  issuer: string | null;
  /** The ask goes through the one channel a supplier answers on: an RFQ. */
  askHref: string;
  askLabel: string;
  /** The certificate's own row on the supplier's record. */
  certHref: string;
  days: number;
  /** "2026-10-08": the day it lapses, for the CSV. */
  expiresOn: string;
};

export type ExpiryGroups = { expired: CertItem[]; within30: CertItem[]; within90: CertItem[] };

const schemeOf = (kind: string) => certName(kind, null);

function itemOf(r: CertRead, today: Date): CertItem | null {
  const days = daysUntil(r.expires_on, today);
  const day = formatDay(r.expires_on);
  // A certificate its body no longer lists (spec-etl-freshness S2) needs the same look as an expired
  // one, whatever its date says, and OEKO-TEX labels carry no date at all.
  const delisted = r.listing_status === "no_longer_listed";
  if (!r.supplier || (!delisted && (days === null || !day))) return null;
  const expired = delisted || (days ?? 0) < 0;
  const place = [r.supplier.city, r.supplier.district].filter((x, i, a) => x && a.indexOf(x) === i).join(", ") || null;
  return {
    key: `${r.supplier.id}-${r.kind}-${r.certificate_no ?? r.expires_on}`,
    state: expired ? "expired" : "expiring",
    when: delisted
      ? `No longer listed by ${schemeOf(r.kind)} since ${formatDay(r.delisted_on) ?? "the last read"}`
      : `${expired ? "Expired" : "Expires"} ${day}`,
    relative: expired ? null : days === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`,
    scheme: schemeOf(r.kind),
    number: r.certificate_no,
    label: certName(r.kind, r.certificate_no),
    supplier: displayName(r.supplier.company_name),
    slug: r.supplier.slug,
    place,
    issuer: r.issuer ?? null,
    askHref: `/app/rfqs/new?supplier=${encodeURIComponent(r.supplier.id)}`,
    askLabel: expired ? "Ask for the new certificate" : "Ask for the renewal",
    // The certificate's own row on the record: the Overview's "Needs a look" and the Certificates tab both carry it.
    certHref: `/app/suppliers/${r.supplier.slug}#${certRowId(r.kind, r.certificate_no, r.expires_on)}`,
    days: days ?? 0,
    expiresOn: (r.expires_on ?? "").slice(0, 10),
  };
}

/** The three groups in the RPCs' own orders: expired most recent first, then soonest first. */
export function expiryGroups(expired: CertList | null, expiring: CertList | null, today: Date): ExpiryGroups {
  const lapsed = (expired?.rows ?? []).map((r) => itemOf(r, today)).filter((x): x is CertItem => x !== null);
  // A delisted certificate can also be inside the expiring window: it is listed once, as a problem.
  const lapsedKeys = new Set(lapsed.map((c) => c.key));
  const coming = (expiring?.rows ?? []).map((r) => itemOf(r, today)).filter((x): x is CertItem => x !== null && !lapsedKeys.has(x.key));
  return { expired: lapsed, within30: coming.filter((c) => c.days <= 30), within90: coming.filter((c) => c.days > 30) };
}

/** The certificates a `?show=` filter draws, in the page's order: what Download CSV writes. */
export function expiryItems(g: ExpiryGroups, show: ExpiryShow): CertItem[] {
  return show === "expired" ? g.expired : show === "30" ? g.within30 : show === "90" ? g.within90 : [...g.expired, ...g.within30, ...g.within90];
}

export type ExpiryCounts = { all: number; expired: number; within30: number; within90: number };

export function expiryCounts(g: ExpiryGroups): ExpiryCounts {
  return { all: g.expired.length + g.within30.length + g.within90.length, expired: g.expired.length, within30: g.within30.length, within90: g.within90.length };
}

/** The tabs: "All · 14", "Expired · 7", "Within 30 days · 2", "31–90 days · 5". */
export function expiryTabs(c: ExpiryCounts): { show: ExpiryShow; label: string }[] {
  return [
    { show: "all", label: `All · ${formatCount(c.all)}` },
    { show: "expired", label: `Expired · ${formatCount(c.expired)}` },
    { show: "30", label: `Within 30 days · ${formatCount(c.within30)}` },
    { show: "90", label: `31–90 days · ${formatCount(c.within90)}` },
  ];
}

/** The expired group's own line over its rows: "Expired · 7 certificates · most recent first". */
export const expiredHeading = (n: number) => `Expired · ${noun(n, "certificate")} · most recent first`;
export const within30Heading = (n: number) => `Expires within 30 days · ${noun(n, "certificate")}`;
export const within90Heading = (n: number) => `Expires in 31–90 days · ${noun(n, "certificate")}`;

/** "14 dated certificates on 11 saved suppliers": the phone's line under the title. */
export function expirySubline(certificates: number, saved: number | null): string {
  const certs = noun(certificates, "dated certificate");
  return saved === null ? `${certs} on your saved suppliers` : `${certs} on ${noun(saved, "saved supplier")}`;
}

/** The hub's last card: how many lapse in the next 90 days and the first of them. */
export function comingUp(expiring: CertList | null, today: Date): { words: string; first: CertItem | null } {
  if (expiring === null) return { words: "The expiry dates did not load.", first: null };
  const groups = expiryGroups(null, expiring, today);
  const first = [...groups.within30, ...groups.within90][0] ?? null;
  if (!first) return { words: "No certificate on your saved suppliers expires in the next 90 days.", first: null };
  const n = expiring.total;
  return { words: `${noun(n, "certificate")} lapse${n === 1 ? "s" : ""} in the next 90 days, the first on ${first.when.replace("Expires ", "")} (${first.supplier} ${first.label}).`, first };
}

/* ------------------------------------------------------------------ UFLPA */

export const UFLPA_WORDS: Record<UflpaStatus, { label: string; sub: string }> = {
  hit: { label: "On the UFLPA Entity List", sub: "You can't send them an RFQ" },
  region_flag: { label: "Possible Xinjiang link", sub: "Record mentions Xinjiang, XUAR or Uyghur" },
  clear: { label: "No link found", sub: "Not a clearance; keep your due diligence" },
};

export function uflpaCounts(p: Pick<UflpaPayload, "hits" | "flags" | "clear">): { status: UflpaStatus; count: number }[] {
  return [
    { status: "hit", count: p.hits },
    { status: "region_flag", count: p.flags },
    { status: "clear", count: p.clear },
  ];
}

/** "Dhaka" or "Gazipur, Bangladesh": where the supplier is, never a blank. */
export function uflpaPlace(r: Pick<UflpaRow, "city" | "district" | "country">): string | null {
  return [r.district ?? r.city, r.country && r.country !== "Bangladesh" ? r.country : null].filter(Boolean).join(", ") || null;
}

/** One line a hit or a flag adds under the result: the entries it matches, or where the term was found. */
export function uflpaEvidence(r: UflpaRow): string[] {
  if (r.uflpa_hits.length > 0) return r.uflpa_hits.map((h) => [h.matched_name ?? h.entity_name ?? "A listed entity", h.list_entry_ref ? `[${h.list_entry_ref}]` : null].filter(Boolean).join(" "));
  return r.status === "region_flag" ? ["Xinjiang-linked text in the record"] : [];
}

/** The phone's one line over the page: what none found means, in words. */
export function uflpaNote(p: UflpaPayload | null, saved: number | null): string | null {
  if (p === null) return null;
  // The tracker checks published suppliers only, so what it says is about `p.total`, not about every saved supplier.
  if (p.total === 0) return "None of your saved suppliers is published yet, so there is nothing to check.";
  const of = saved !== null && saved > p.total ? `${formatCount(p.total)} published of your ${formatCount(saved)} saved suppliers` : `your ${noun(p.total, "saved supplier")}`;
  if (p.hits > 0) return `${noun(p.hits, "supplier")} on the UFLPA Entity List among ${of}. You can't send them an RFQ.`;
  if (p.flags > 0) return `${noun(p.flags, "supplier")} with a possible Xinjiang link among ${of}.`;
  return `No link found on the UFLPA Entity List for ${of}. Not a clearance.`;
}

/** The phone's line under the UFLPA title: how many suppliers the check read. */
export function uflpaSubline(checked: number | null): string {
  return checked === null ? "Your saved suppliers against the UFLPA Entity List (US DHS)" : `${noun(checked, "saved supplier")} against the UFLPA Entity List (US DHS)`;
}
