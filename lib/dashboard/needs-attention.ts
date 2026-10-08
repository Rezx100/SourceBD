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
  /** 0122: "no_longer_listed" when its body stopped listing it, and the day it did. */
  listing_status?: string;
  delisted_on?: string | null;
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
  /** "No renewal on file." on a lapsed certificate; "asked 3 Oct 2026" once an RFQ went to the supplier. */
  note?: string;
  /** The ask goes through the one channel a supplier answers on: an RFQ. */
  askHref: string;
  askLabel: string;
  /** The day the buyer last sent this supplier an RFQ, when one row is one supplier; null when none was. */
  asked?: string | null;
  /** Other certificates of the same supplier folded into this row (one row per supplier). */
  more?: number;
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
  if (!r.supplier) return null;
  const name = certName(r.kind, r.certificate_no);
  const base = { supplier: r.supplier.company_name, slug: r.supplier.slug, supplierId: r.supplier.id, askHref: `/app/rfqs/new?supplier=${encodeURIComponent(r.supplier.id)}` };
  // Its body stopped listing it (spec-etl-freshness S2): a problem whatever its date, and an
  // OEKO-TEX label has no date at all.
  if (r.listing_status === "no_longer_listed") {
    const since = formatDay(r.delisted_on) ?? "the last read";
    return { ...base, days: Math.min(days ?? -1, -1), state: "expired", what: `${name} is no longer listed by ${certScheme(r.kind)} since ${since}.`, askLabel: "Ask for the new certificate" };
  }
  if (!day || days === null) return null;
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
  options: {
    /**
     * One row per supplier (the landing; the critique of 7 Oct 2026, item 6: one supplier got two
     * identical buttons): the worst certificate leads, the rest are "· 2 more certificates", one Ask.
     * The hub keeps one row per certificate under its three headings.
     */
    perSupplier?: boolean;
    /** The day the buyer last sent each supplier an RFQ: the row then reads "asked 3 Oct 2026". */
    asked?: ReadonlyMap<string, string>;
  } = {},
): Attention | null {
  if (expired === null && expiring === null) return null;
  // A delisted certificate (0122) can come back in both reads: it is one thing to check.
  const key = (r: AttentionCertRow) => `${r.supplier?.id}|${r.kind}|${r.certificate_no ?? r.expires_on}`;
  const lapsed = new Set((expired?.rows ?? []).map(key));
  const coming = (expiring?.rows ?? []).filter((r) => !lapsed.has(key(r)));
  const twice = (expiring?.rows.length ?? 0) - coming.length;
  let rows = [...(expired?.rows ?? []), ...coming].map((r) => rowOf(r, today)).filter((r): r is AttentionRow => r !== null);
  if (options.perSupplier) {
    const bySupplier = new Map<string, AttentionRow>();
    for (const r of rows) {
      const held = bySupplier.get(r.supplierId);
      if (held) held.more = (held.more ?? 0) + 1;
      else bySupplier.set(r.supplierId, { ...r, more: 0 });
    }
    rows = [...bySupplier.values()].map((r) => {
      const asked = options.asked?.get(r.supplierId) ?? null;
      const askedDay = asked ? formatDay(asked) : null;
      return {
        ...r,
        asked,
        what: r.more ? `${r.what} · ${r.more} more ${r.more === 1 ? "certificate" : "certificates"}` : r.what,
        // Once asked, the row says so in place of "No renewal on file."
        note: askedDay ? `asked ${askedDay}` : r.note,
      };
    });
  }
  return { total: (expired?.total ?? 0) + (expiring?.total ?? 0) - twice, rows: rows.slice(0, limit) };
}

/**
 * When the buyer last sent each of these suppliers an RFQ (the Ask button opens the composer, so the
 * RFQ is the record of the ask; nothing else needs to be stored). Drafts do not count. An unread list
 * says nothing: no supplier is then marked asked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the record loaders take it.
export async function askedDates(supabase: any, supplierIds: readonly string[]): Promise<Map<string, string>> {
  const asked = new Map<string, string>();
  if (supplierIds.length === 0) return asked;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return asked;
    const { data, error } = await supabase
      .from("rfqs")
      .select("created_at, target_supplier_ids")
      .eq("buyer_id", user.id)
      .neq("status", "draft")
      .overlaps("target_supplier_ids", [...supplierIds])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !Array.isArray(data)) return asked;
    for (const r of data as { created_at?: unknown; target_supplier_ids?: unknown }[]) {
      if (typeof r.created_at !== "string" || !Array.isArray(r.target_supplier_ids)) continue;
      for (const id of r.target_supplier_ids) if (typeof id === "string" && supplierIds.includes(id) && !asked.has(id)) asked.set(id, r.created_at);
    }
  } catch {
    // An unread list says nothing.
  }
  return asked;
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
  if (limit === 0) return attentionOf(expired, expiring, today, limit);
  // The landing: one row per supplier, each saying whether it was asked.
  const ids = [...new Set([...(expired?.rows ?? []), ...(expiring?.rows ?? [])].map((r) => r.supplier?.id).filter((id): id is string => Boolean(id)))];
  const asked = await askedDates(supabase, ids);
  return attentionOf(expired, expiring, today, limit, { perSupplier: true, asked });
}
