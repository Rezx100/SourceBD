// Pure selection math for the Discover results bulk bar (REZ-B, handoff
// §7.5 / spec §3.1 "Selection"). Kept out of the client component so it can
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
  const allOn = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  if (allOn) {
    const next = new Set(selected);
    for (const id of pageIds) next.delete(id);
    return next;
  }
  return new Set([...selected, ...pageIds]);
}

export function allOnPageSelected(selected: ReadonlySet<string>, pageIds: readonly string[]): boolean {
  return pageIds.length > 0 && pageIds.every((id) => selected.has(id));
}

export function selectionCaption(count: number): string {
  return `${count} ${count === 1 ? "supplier" : "suppliers"} selected`;
}
