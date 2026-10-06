// Needs attention (Paper `03 Patterns` · 11, and the search landing's top block): the
// certificates on the buyer's saved suppliers that have lapsed with no renewal on file, then
// those that lapse inside 90 days. ONE function builds the rows and the total, so the
// landing, the Compliance page and the sidebar badge cannot say 2, 8 and 9 for the same thing
// (hand-off section 6). Pure; `loadNeedsAttention` does the two reads.

import { certScheme, daysUntil, formatCount, formatDay } from "@/lib/dashboard/facts";

/** The row both compliance RPCs return (`compliance_expired_certs`, `compliance_expiring_certs`). */
export type AttentionCertRow = {
  kind: string;
  certificate_no: string | null;
  expires_on: string;
  supplier: { id: string; slug: string; company_name: string };
};

export type AttentionRow = {
  state: "expired" | "expiring";
  /** Days until it lapses; negative once it has. The hub splits its list on this. */
  days: number;
  supplier: string;
  slug: string;
  supplierId: string;
  /** "WRAP 7865 expired 29 Sep 2026." */
  what: string;
  /** "No renewal on file." on a lapsed certificate. */
  note?: string;
  /** The ask goes through the one channel a supplier answers on: an RFQ. */
  askHref: string;
  askLabel: string;
};

export type Attention = {
  /** Every certificate to check, not only the ones listed. */
  total: number;
  rows: AttentionRow[];
};

/** "WRAP 7865", or "GOTS-26992" when the number already carries its scheme. */
export function certName(kind: string, number: string | null): string {
  const scheme = certScheme(kind);
  if (!number) return scheme;
  return number.toUpperCase().startsWith(scheme.toUpperCase()) ? number : `${scheme} ${number}`;
}

function rowOf(r: AttentionCertRow, today: Date): AttentionRow | null {
  const day = formatDay(r.expires_on);
  const days = daysUntil(r.expires_on, today);
  if (!day || days === null || !r.supplier) return null;
  const name = certName(r.kind, r.certificate_no);
  const base = { supplier: r.supplier.company_name, slug: r.supplier.slug, supplierId: r.supplier.id, askHref: `/app/rfqs/new?supplier=${encodeURIComponent(r.supplier.id)}` };
  if (days < 0) return { ...base, days, state: "expired", what: `${name} expired ${day}.`, note: "No renewal on file.", askLabel: "Ask for the new certificate" };
  const when = days === 0 ? "expires today" : `expires in ${days} ${days === 1 ? "day" : "days"}`;
  return { ...base, days, state: "expiring", what: `${name} ${when}, ${day}.`, askLabel: "Ask for the renewal" };
}

/**
 * The rows to show and the total. A failed read is `null`, never zero: "nothing needs
 * attention" is a claim an unread list cannot make. When only one of the two reads
 * failed, the other still lists, and the total is that one's.
 */
export function attentionOf(
  expired: { total: number; rows: AttentionCertRow[] } | null,
  expiring: { total: number; rows: AttentionCertRow[] } | null,
  today: Date,
  limit = 3,
): Attention | null {
  if (expired === null && expiring === null) return null;
  const rows = [...(expired?.rows ?? []), ...(expiring?.rows ?? [])]
    .map((r) => rowOf(r, today))
    .filter((r): r is AttentionRow => r !== null)
    .slice(0, limit);
  return { total: (expired?.total ?? 0) + (expiring?.total ?? 0), rows };
}

/** "Needs attention · 8 certificates" and the link under it, from the one total. */
export function attentionWords(total: number): { heading: string; seeAll: string } {
  const noun = total === 1 ? "certificate" : "certificates";
  return { heading: `Needs attention · ${formatCount(total)}`, seeAll: `See all ${formatCount(total)} ${noun}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the record loaders take it.
export async function loadNeedsAttention(supabase: any, today: Date, limit = 3): Promise<Attention | null> {
  const read = async (fn: string, args?: Record<string, unknown>) => {
    try {
      const r = await supabase.rpc(fn, args);
      return r.error ? null : ((r.data ?? null) as { total: number; rows: AttentionCertRow[] } | null);
    } catch {
      return null;
    }
  };
  const [expired, expiring] = await Promise.all([read("compliance_expired_certs"), read("compliance_expiring_certs", { p_window_days: 90 })]);
  return attentionOf(expired, expiring, today, limit);
}
