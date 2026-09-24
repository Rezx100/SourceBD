import "server-only";

// One loader for one supplier record (REZ-C, handoff §3.3–§3.4). The record
// sheet, the full record page, the line sheet and the /dev/ds gallery all read
// the same three RPCs, so they read them through this file: two callers
// building a `RecordInput` two ways is two sheets that disagree about the same
// company.
//
// `supplier_contact_counts` (0105) is the fourth call, and it is the only one
// the gallery does not need. It returns counts, never values — see the
// migration's header for why the counts do not live on `buyer_supplier_profile`.

import { fetchDisplayWorkersBatch } from "@/lib/enrich-discover-workers";
import { hscodesFromRpc } from "@/lib/epb-hscodes";
import { buildProductSheet, buildSheet, type ProfilePayload, type RecordInput } from "./build-models";
import { formatCount, formatDay } from "./facts";
import { heading4 } from "./hs-photos";
import type { ContactCounts, ProductSheetModel, RecordRfqRow, SupplierSheetModel } from "./models";

/** The narrow slice of the Supabase client these loaders use. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generated client type is not in scope here; gallery-data.ts uses the same shape.
export type RecordRpc = { rpc: (fn: string, args: Record<string, unknown>) => any };

export type LoadedRecord = { slug: string; input: RecordInput };

/**
 * A record's profile and export lines. The worker figure is filled in
 * afterwards by `fillRecordWorkers`, in one batch call for every record on the
 * page.
 *
 * Returns null when the slug is not a published record: a caller renders its
 * own not-found, and an unreadable profile is never rendered as an empty one.
 */
export async function loadRecordInput(
  supabase: RecordRpc,
  slug: string,
  today: Date,
  sanctionSample = false,
): Promise<LoadedRecord | null> {
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

/** One `production_workers_display_batch` call for every record given. */
export async function fillRecordWorkers(supabase: RecordRpc, records: LoadedRecord[]): Promise<void> {
  if (records.length === 0) return;
  const byId = await fetchDisplayWorkersBatch(
    supabase,
    records.map((r) => r.input.profile.supplier.id),
  );
  for (const r of records) {
    const w = byId[r.input.profile.supplier.id];
    r.input.workers = w ? { value: w.value, source: w.source, fetched_at: w.fetched_at } : null;
  }
}

/** The same call, with the batch's failure absorbed: every record keeps the figure its own payload carries. */
export async function fillRecordWorkersSafely(supabase: RecordRpc, records: LoadedRecord[]): Promise<void> {
  try {
    await fillRecordWorkers(supabase, records);
  } catch {
    // Every record keeps the workers figure its own payload carries.
  }
}

/**
 * How much contact detail the record holds — never a value (0105).
 *
 * A failed or absent read returns null, and the locked card then says only
 * that details are hidden. It must not fall back to zeros: "no phone number on
 * file" is a claim about the record, and a failed count does not support it.
 */
export async function fetchContactCounts(supabase: RecordRpc, slug: string): Promise<ContactCounts | null> {
  try {
    const { data, error } = await supabase.rpc("supplier_contact_counts", { p_slug: slug });
    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    const count = (key: string): number | null => (typeof row[key] === "number" && Number.isFinite(row[key]) ? (row[key] as number) : null);
    const emails = count("emails");
    const phones = count("phones");
    const representatives = count("representatives");
    if (emails === null || phones === null || representatives === null) return null;
    return { emails, phones, representatives, website: row.website === true };
  } catch {
    return null;
  }
}

/**
 * The calling buyer's own RFQs that name this supplier, for the record's RFQs
 * section.
 *
 * No migration and no security-definer wrapper: `rfqs` already carries the
 * owner-scoped policy `pol_rfqs_select_buyer (buyer_id = auth.uid())`, so this
 * read returns the caller's rows and nobody else's. A failed read returns
 * `count: null` and `error: true` — an unread list has no count, and 0 is a
 * claim about the buyer's own history.
 */
export async function fetchRecordRfqs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as RecordRpc: the generated client type is not in scope here.
  supabase: any,
  supplierId: string,
): Promise<{ count: number | null; rows: RecordRfqRow[]; error?: boolean }> {
  try {
    const { data, error } = await supabase
      .from("rfqs")
      .select("id, product_title, quantity, quantity_unit, ship_by, status, created_at")
      .contains("target_supplier_ids", [supplierId])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return { count: null, rows: [], error: true };
    const rows: RecordRfqRow[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: typeof r.product_title === "string" && r.product_title.trim() ? r.product_title : "Untitled RFQ",
      quantity:
        typeof r.quantity === "number" && typeof r.quantity_unit === "string"
          ? `${formatCount(r.quantity)} ${r.quantity_unit}`
          : null,
      status: rfqStatusWords(typeof r.status === "string" ? r.status : null),
      sent: formatDay(typeof r.created_at === "string" ? r.created_at : null),
      shipBy: formatDay(typeof r.ship_by === "string" ? r.ship_by : null),
      href: `/app/rfqs/${String(r.id)}`,
    }));
    return { count: rows.length, rows };
  } catch {
    return { count: null, rows: [], error: true };
  }
}

/**
 * The RFQ's own enum in words. Quotes are not read here, so this never says
 * "awaiting reply" — a claim that nothing has come back, which this read
 * cannot support (the same lesson `buildRfqRow` carries).
 */
function rfqStatusWords(status: string | null): RecordRfqRow["status"] {
  switch (status) {
    case "accepted":
      return { tone: "positive", label: "Quote accepted" };
    case "closed":
      return { tone: "type", label: "Closed" };
    case "cancelled":
      return { tone: "type", label: "Cancelled" };
    default:
      return { tone: "type", label: "Open" };
  }
}

/** Whether this record is on the caller's saved list. A failed read is "not saved", never a crash. */
export async function fetchRecordSaved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as RecordRpc, see above.
  supabase: any,
  supplierId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase.from("saved_suppliers").select("id").eq("supplier_id", supplierId).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export type SheetView = {
  /** Where an overlay's Close returns to; absent on the full page. */
  closeHref?: string | null;
  /** The record's own page — what Share offers and where an overlay's "Open full page" goes. */
  fullHref?: string;
  /** The viewer's plan name, when one exists. */
  plan?: string | null;
};

/**
 * Everything one record sheet needs, in one place: the profile, the export
 * lines, the worker figure, the contact COUNTS, whether the caller saved it,
 * and the caller's own RFQs naming it.
 *
 * Returns null when the slug is not a published record — the caller renders
 * its own not-found rather than an empty sheet.
 */
export async function loadRecordSheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client; RecordRpc covers only the rpc half and these readers also use `from`.
  supabase: any,
  slug: string,
  today: Date,
  view: SheetView = {},
): Promise<SupplierSheetModel | null> {
  const record = await loadRecordInput(supabase, slug, today);
  if (!record) return null;
  await fillRecordWorkersSafely(supabase, [record]);
  const supplierId = record.input.profile.supplier.id;
  const [contactCounts, saved, rfqs] = await Promise.all([
    fetchContactCounts(supabase, slug),
    fetchRecordSaved(supabase, supplierId),
    fetchRecordRfqs(supabase, supplierId),
  ]);
  return buildSheet(record.input, {
    plan: view.plan ?? null,
    contactCounts,
    saved,
    supplierId,
    rfqs,
    // A sanctioned record's Send RFQ is disabled and `rfq_create` refuses it;
    // the href is still built so the disabled/enabled split is the model's
    // `sanctioned` flag alone, in one place.
    rfqHref: `/app/rfqs/new?supplier=${supplierId}`,
    fullHref: view.fullHref ?? `/app/suppliers/${slug}`,
    closeHref: view.closeHref ?? null,
  });
}

/** The same record, read once, for the line sheet at `/app/suppliers/[slug]/lines/[hs]`. */
export async function loadRecordLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as loadRecordSheet.
  supabase: any,
  slug: string,
  hs: string,
  today: Date,
  view: { backHref?: string | null; closeHref?: string | null } = {},
): Promise<ProductSheetModel | null> {
  const record = await loadRecordInput(supabase, slug, today);
  if (!record) return null;
  await fillRecordWorkersSafely(supabase, [record]);
  const supplierId = record.input.profile.supplier.id;
  return buildProductSheet(record.input, hs, {
    backHref: view.backHref ?? `/app/suppliers/${slug}`,
    closeHref: view.closeHref ?? null,
    rfqHref: `/app/rfqs/new?supplier=${supplierId}&hs=${heading4(hs)}`,
  });
}
