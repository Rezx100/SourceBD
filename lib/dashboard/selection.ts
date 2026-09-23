// Pure selection math for the Discover results bulk bar (REZ-B, handoff
// §7.5 / spec §3.1 "Selection"). Kept out of the client components so it can
// run under `node --test` with no DOM.

/** `rfq_create`'s own cap (`app/api/v1/rfqs/route.ts` `MAX_TARGETS`). */
export const SEND_RFQ_MAX = 50;

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** All of `pageIds` selected → clear them; anything else → select every one. */
export function toggleAllOnPage(selected: ReadonlySet<string>, pageIds: readonly string[]): Set<string> {
  if (allOnPageSelected(selected, pageIds)) {
    const next = new Set(selected);
    for (const id of pageIds) next.delete(id);
    return next;
  }
  return new Set([...selected, ...pageIds]);
}

export function allOnPageSelected(selected: ReadonlySet<string>, pageIds: readonly string[]): boolean {
  return pageIds.length > 0 && pageIds.every((id) => selected.has(id));
}

/** The select-all box's `aria-checked`: "mixed" when some but not all of the
 * page is selected, as the ARIA tri-state checkbox pattern reads it. */
export function selectAllState(selected: ReadonlySet<string>, pageIds: readonly string[]): boolean | "mixed" {
  if (allOnPageSelected(selected, pageIds)) return true;
  return pageIds.some((id) => selected.has(id)) ? "mixed" : false;
}

/** The bar's Export link: the page's own export URL — same filters, sort,
 * page and per-page — scoped to the selection with `ids=`. Without `ids` the
 * route exports the whole filtered result set, so this must never drop it. */
export function bulkExportHref(exportHref: string, ids: readonly string[]): string {
  const sep = exportHref.includes("?") ? "&" : "?";
  return `${exportHref}${sep}ids=${ids.map(encodeURIComponent).join(",")}`;
}

/** What the bar says after one bulk save request came back with `status`. */
export function bulkSaveMessage(status: number | "network", count: number): string {
  const noun = count === 1 ? "supplier" : "suppliers";
  if (status === 200) return `Saved ${count} ${noun}`;
  if (status === 401) return "Sign in to save suppliers.";
  if (status === 429) return "Too many saves in the last minute. Wait a minute and save again.";
  if (status === "network") return "Could not save them — no connection. Try again.";
  return "Could not save them. Try again.";
}

/**
 * Bulk save → the per-row Save buttons. A row button keeps its own state and
 * only re-reads its `saved` prop when the prop CHANGES; a row unsaved by hand
 * and then bulk-saved comes back from the refresh with the same `saved={true}`
 * it started with, so the prop alone never tells it. The bar announces the
 * ids it saved instead, and each button listens for its own.
 */
export const BULK_SAVED_EVENT = "sourcebd:bulk-saved";

export function announceBulkSaved(target: EventTarget, ids: readonly string[]): void {
  target.dispatchEvent(new CustomEvent(BULK_SAVED_EVENT, { detail: [...ids] }));
}

export function onBulkSaved(target: EventTarget, id: string, saved: () => void): () => void {
  const want = id.toLowerCase();
  const handler = (e: Event) => {
    const ids = (e as CustomEvent<unknown>).detail;
    if (Array.isArray(ids) && ids.some((x) => typeof x === "string" && x.toLowerCase() === want)) saved();
  };
  target.addEventListener(BULK_SAVED_EVENT, handler);
  return () => target.removeEventListener(BULK_SAVED_EVENT, handler);
}
