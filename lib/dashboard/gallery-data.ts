import "server-only";

// The /dev/ds gallery's data for the six dashboard screens (REZ-A, handoff
// §7.1 "rendered from real data"). Everything comes from production through
// the same RPCs the buyer app calls — `buyer_supplier_profile`,
// `supplier_epb_hscodes`, `production_workers_display_batch`,
// `discover_suppliers`, `rfq_list` — for the named test records of the
// rebuild spec §3: the 11-source record (Aboni), the six-certificate record
// (S M Knitwears), the 100-character name (Zaheen, rendered as the labelled
// sanctioned SAMPLE — it is not sanctioned in production) and the almost-empty
// record (A.R. Fashion). A record that cannot be read is left out, never
// invented.

import { fetchDisplayWorkersBatch } from "@/lib/enrich-discover-workers";
import { hscodesFromRpc } from "@/lib/epb-hscodes";
import { buildCard, buildRfqRow, buildSheet, buildTableRow, buildProductSheet, type ProfilePayload, type RecordInput, type RfqListRow } from "./build-models";

import { formatCount, formatDay } from "./facts";
import { topTier } from "./source-tiers";
import type { RfqListModel, SupplierCardModel, SupplierSheetModel, TableRowModel, ProductSheetModel } from "./models";

/** The sort the RPC knows for "most sources" (`discover_suppliers` p_sort: receipts | name | completeness). */
export const SORT_MOST_SOURCES = "receipts";

/** The argument list `discover_suppliers` takes, every key present, in one place. */
export function discoverArgs(over: { q?: string | null; certKinds?: string[] | null; limit: number }): Record<string, unknown> {
  return {
    p_q: over.q ?? null,
    p_entity_types: null,
    p_min_sources: null,
    p_cert_kinds: over.certKinds ?? null,
    p_rsc_min: null,
    p_city: null,
    p_district: null,
    p_category: null,
    p_sort: SORT_MOST_SOURCES,
    p_limit: over.limit,
    p_offset: 0,
    p_registries: null,
    p_factory_types: null,
    p_brand_codes: null,
    p_completeness_min: null,
    p_workers_min: null,
  };
}

export const GALLERY_SLUGS = {
  aboni: "aboni-knitwear",
  sm: "sm-knitwear",
  zaheen: "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump",
  ar: "ar-fashion",
} as const;

/** The query the screens show: knitted shirts with a GOTS certificate (the RPC's text + cert filter). */
export const GALLERY_QUERY = { q: "knitted shirts", certKinds: ["gots"], title: "Knitted shirts · GOTS valid" } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => any };

export type GalleryRecord = { slug: string; input: RecordInput };

/** A record's profile and lines; the worker figure is filled in by one batch call afterwards. */
async function loadRecord(supabase: Rpc, slug: string, today: Date, sanctionSample = false): Promise<GalleryRecord | null> {
  try {
    const [profileResult, hsResult] = await Promise.all([
      supabase.rpc("buyer_supplier_profile", { p_slug: slug }),
      supabase.rpc("supplier_epb_hscodes", { p_slug: slug }),
    ]);
    const data = profileResult?.data;
    if (profileResult?.error || !data || typeof data !== "object" || !("supplier" in data)) return null;
    const profile = data as ProfilePayload;
    // A failed lines read is carried as "unknown", never rendered as "no lines".
    const { hscodes, loadError } = hscodesFromRpc({ data: hsResult?.data, error: hsResult?.error });
    return { slug, input: { profile, hscodes, hscodesError: loadError, workers: null, today, sanctionSample } };
  } catch {
    return null;
  }
}

/** One `production_workers_display_batch` call for every record on the page. */
async function fillWorkersSafely(supabase: Rpc, records: GalleryRecord[]): Promise<void> {
  try {
    await fillWorkers(supabase, records);
  } catch {
    // Every record keeps the workers figure its own payload carries.
  }
}

async function fillWorkers(supabase: Rpc, records: GalleryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const byId = await fetchDisplayWorkersBatch(supabase, records.map((r) => r.input.profile.supplier.id));
  for (const r of records) {
    const w = byId[r.input.profile.supplier.id];
    r.input.workers = w ? { value: w.value, source: w.source, fetched_at: w.fetched_at } : null;
  }
}

export type GalleryData = {
  today: Date;
  /** The viewer's plan name from settings; null until billing exists (the contact card then says only "Contact details"). */
  plan: string | null;
  /** True when `discover_suppliers` failed — the header count is then unknown, not 0. */
  discoverError: boolean;
  /** True when `rfq_list` failed — the list is unread, not empty. */
  rfqError: boolean;
  records: Record<keyof typeof GALLERY_SLUGS, GalleryRecord | null>;
  cards: SupplierCardModel[];
  rows: TableRowModel[];
  sheet: SupplierSheetModel | null;
  productSheet: ProductSheetModel | null;
  total: number | null;
  published: number | null;
  recordsReadOn: string | null;
  rfqs: RfqListModel;
};

/**
 * A count the RPC returned, or null when what came back is not one. `Number()`
 * of a malformed `total_count` is NaN, and NaN reached the panel header as
 * "null suppliers" with `discoverError` still false.
 */
function countOf(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // `Number("")` and `Number("  ")` are 0, so a blank `total_count` reached
  // the panel header as "0 suppliers" with `discoverError` still false — a
  // read that returned no count, printed as a count of none.
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function loadGalleryData(
  supabase: Rpc,
  today = new Date(),
  /**
   * The supplier each RFQ targets, keyed by RFQ id, where the caller can
   * resolve it (REZ-D's join). The **source codes** are carried, not a rank:
   * the rank is computed here with the same `topTier` every other surface
   * uses, so a caller cannot draw a supplier more trusted than its receipts.
   */
  targets?: Record<string, { name: string; codes: readonly string[] }>,
): Promise<GalleryData> {
  const [aboni, sm, zaheen, ar] = await Promise.all([
    loadRecord(supabase, GALLERY_SLUGS.aboni, today),
    loadRecord(supabase, GALLERY_SLUGS.sm, today),
    loadRecord(supabase, GALLERY_SLUGS.zaheen, today, true),
    loadRecord(supabase, GALLERY_SLUGS.ar, today),
  ]);
  const records = { aboni, sm, zaheen, ar };
  const named = [aboni, sm, zaheen, ar].filter((r): r is GalleryRecord => r !== null);

  // The live count behind the query, and the top rows for the table beyond the named four.
  let total: number | null = null;
  let discoverError = false;
  let extraSlugs: string[] = [];
  try {
    const { data, error } = await supabase.rpc("discover_suppliers", discoverArgs({ q: GALLERY_QUERY.q, certKinds: [...GALLERY_QUERY.certKinds], limit: 8 }));
    if (error) discoverError = true;
    else {
      const rows = (Array.isArray(data) ? data : []) as { slug: string; total_count: unknown }[];
      // No rows is a real "0 matches"; a row whose count will not parse is unknown.
      total = rows[0] ? countOf(rows[0].total_count) : 0;
      if (rows[0] && total === null) discoverError = true;
      const namedSlugs = new Set(named.map((r) => r.slug));
      extraSlugs = rows.map((r) => r.slug).filter((s) => !namedSlugs.has(s)).slice(0, 4);
    }
  } catch {
    discoverError = true;
  }
  const extra = (await Promise.all(extraSlugs.map((s) => loadRecord(supabase, s, today)))).filter(
    (r): r is GalleryRecord => r !== null,
  );
  // The only read that was outside a try: `fetchDisplayWorkersBatch` swallows
  // an `{error}` result, but a rejected promise took the whole page down
  // rather than rendering the workers the payload already carries.
  await fillWorkersSafely(supabase, [...named, ...extra]);

  const cards = [aboni, sm, zaheen, ar].filter((r): r is GalleryRecord => r !== null).map((r) => buildCard(r.input));
  if (cards[0]) cards[0].selected = true;
  const rowRecords = [aboni, sm, ...extra, zaheen, ar].filter((r): r is GalleryRecord => r !== null);
  const rows = rowRecords.map((r) => buildTableRow(r.input));
  if (rows[0]) rows[0].selected = true;

  // Published count and latest read date for the topbar caption.
  let published: number | null = null;
  let recordsReadOn: string | null = null;
  try {
    // An unfiltered page of one: its `total_count` is the published-supplier count.
    const { data, error } = await supabase.rpc("discover_suppliers", discoverArgs({ limit: 1 }));
    const first = !error && Array.isArray(data) ? (data[0] as { total_count?: unknown } | undefined) : undefined;
    published = first ? countOf(first.total_count) : null;
  } catch {
    published = null;
  }
  const latest = named
    .flatMap((r) => (r.input.profile.provenance ?? []).map((p) => (p.last_seen_at ? Date.parse(p.last_seen_at) : NaN)))
    .filter((t) => !Number.isNaN(t))
    .reduce<number>((m, t) => Math.max(m, t), -1);
  recordsReadOn = latest < 0 ? null : formatDay(new Date(latest).toISOString());

  // RFQs of the viewer (admin in the gallery), as `rfq_list` returns them.
  // A failed read is carried as unknown: the empty state states a fact about
  // the account ("your first RFQ lands here") that an unread list cannot.
  let rfqRows: RfqListRow[] = [];
  let rfqError = false;
  try {
    const { data, error } = await supabase.rpc("rfq_list", { p_status: null });
    if (error || !Array.isArray(data)) rfqError = true;
    else rfqRows = data as RfqListRow[];
  } catch {
    rfqError = true;
  }
  // `rfq_list` returns `target_supplier_count`, not the suppliers. REZ-D's join
  // will resolve them; until it does, a row names its target only where the
  // caller supplies it, and otherwise says "N suppliers" and nothing more.
  const rfqModels = rfqRows.map((r) => {
    const t = targets?.[r.id];
    return buildRfqRow(r, t ? { name: t.name, tier: topTier(t.codes) } : null, today);
  });
  // Every figure below is derived from rows that were read. When the read
  // failed there are no rows, so there is no count either — not zero.
  const count = (pred: (r: (typeof rfqModels)[number]) => boolean) => (rfqError ? null : rfqModels.filter(pred).length);
  const rfqs: RfqListModel = {
    sent: rfqError ? null : rfqRows.filter((r) => r.status !== "cancelled").length,
    quotes: rfqError ? null : rfqRows.reduce((n, r) => n + (r.quote_count ?? 0), 0),
    chips: [
      { label: "All", count: rfqError ? null : rfqModels.length, on: true },
      { label: "Awaiting reply", count: count((r) => r.status.label.startsWith("Sent")) },
      { label: "Quoted", count: count((r) => r.status.label.startsWith("Quoted") || r.status.label === "Quote accepted") },
      // "Reply overdue" and "Draft" need reply-by dates, threads and rfq_drafts (REZ-D); no chip until then.
      { label: "Closed", count: count((r) => r.status.label === "Closed" || r.status.label === "Cancelled") },
    ],
    rows: rfqModels,
    error: rfqError,
    footer: rfqError
      ? "The RFQ list could not be read"
      : rfqModels.length > 0
        ? `1–${rfqModels.length} of ${rfqModels.length}`
        : "No RFQs for this account yet",
    toast: null,
  };

  return {
    today,
    plan: null,
    discoverError,
    rfqError,
    records,
    cards,
    rows,
    sheet: aboni ? buildSheet(aboni.input, { plan: null }) : null,
    productSheet: aboni ? buildProductSheet(aboni.input, "6105") : null,
    total,
    published,
    recordsReadOn,
    rfqs,
  };
}

/**
 * "10,266 published suppliers · records on this page read 18 Sep 2026".
 *
 * The two halves come from different populations and the caption used to hide
 * that: `published` is `discover_suppliers`' `total_count` over the whole
 * corpus, while the date is `max(last_seen_at)` over the four records the page
 * draws. Of the 10,266, 1,677 (16.3 %) were last read on 18 Sep 2026; the
 * median is 24 Jul 2026 and 5,780 were last read before 1 Aug (SQL, 20 Sep
 * 2026). Printed bare beside the corpus count it read as a corpus freshness
 * claim, so the words now name the population the date is true of.
 */
export function topbarCaption(d: Pick<GalleryData, "published" | "recordsReadOn">): string {
  const parts: string[] = [];
  if (d.published !== null) parts.push(`${formatCount(d.published)} published suppliers`);
  if (d.recordsReadOn) parts.push(`records on this page read ${d.recordsReadOn}`);
  return parts.join(" · ") || "Live records";
}
