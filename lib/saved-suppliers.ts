// POST /api/v1/saved — save one supplier (`supplier_id`) or a selection
// (`supplier_ids`) in ONE request. The bulk bar used to send one POST per
// selected id; each counted against the buyer's 30-per-minute write bucket,
// so "select all" on a 100-row page saved 30, 429'd the rest, and locked the
// buyer out of sending an RFQ or a message for the rest of the minute.
//
// Thin gate, as before: buyer/admin only, the owner is `auth.uid()` and never
// read from the body, and RLS (`pol_saved_suppliers_*_self`) enforces it again.

import { PER_PAGE } from "@/lib/discover-v32-state";

export type SavedSupplierClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: { getUser: () => Promise<any> };
};

export type SavedPostResult = { status: number; body: Record<string, unknown> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** A selection is one page of results at most. */
export const MAX_BULK_SAVE = Math.max(...PER_PAGE);

/** The ids a save body names, or null when it names none validly. */
export function parseSaveTargets(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const list = rec.supplier_ids !== undefined ? rec.supplier_ids : [rec.supplier_id];
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_BULK_SAVE) return null;
  if (!list.every((id) => typeof id === "string" && UUID_RE.test(id))) return null;
  return [...new Set((list as string[]).map((id) => id.toLowerCase()))];
}

export async function runSavedSupplierPost(input: {
  role: string | null;
  supabase: SavedSupplierClient;
  raw: unknown;
}): Promise<SavedPostResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return { status: 401, body: { error: "unauthorised" } };
  }
  const ids = parseSaveTargets(input.raw);
  if (!ids) return { status: 400, body: { error: "invalid supplier_id" } };

  const { data: user } = await input.supabase.auth.getUser();
  const ownerId = user?.user?.id;
  if (!ownerId) return { status: 401, body: { error: "unauthorised" } };

  // One upsert is all-or-nothing: `on conflict` absorbs duplicates but not a
  // foreign-key violation, so a single supplier DELETED since the page
  // rendered would sink the whole selection — every retry failing the same
  // way. Keep only ids that are still listed first: the buyer's own RLS read
  // of `suppliers` is published-only, so this also drops unpublished ones
  // (which the FK alone would not).
  const { data: live, error: readError } = await input.supabase.from("suppliers").select("id").in("id", ids);
  if (readError) return { status: 500, body: { error: "save failed" } };
  const listed = new Set(((live ?? []) as { id: string }[]).map((r) => String(r.id).toLowerCase()));
  const keep = ids.filter((id) => listed.has(id));
  const skipped = ids.length - keep.length;
  // Nothing left to save is NOT a success: a single-row Save answered 200
  // here and its button said "Saved" over a supplier that was never stored.
  if (keep.length === 0) {
    return { status: 404, body: { error: "This supplier is no longer listed.", count: 0, skipped } };
  }

  const { error } = await input.supabase
    .from("saved_suppliers")
    .upsert(
      keep.map((supplier_id) => ({ owner_id: ownerId, supplier_id })),
      { onConflict: "owner_id,supplier_id", ignoreDuplicates: true },
    );
  if (error) {
    // Removed between the listed-check and the write: the check excludes it
    // next time, so this one IS worth retrying, and the buyer is told so.
    if ((error as { code?: string }).code === "23503") {
      return { status: 409, body: { error: "A supplier was removed while saving. Save again." } };
    }
    return { status: 500, body: { error: "save failed" } };
  }
  return { status: 200, body: { ok: true, saved: true, count: keep.length, skipped, ids: keep } };
}
