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

/** What the bar says after one bulk save request came back with `status`.
 * `skipped` counts selected suppliers no longer listed (removed or unpublished
 * since the page rendered), which the server leaves out rather than failing. */
export function bulkSaveMessage(status: number | "network", count: number, skipped = 0): string {
  const noun = count === 1 ? "supplier" : "suppliers";
  if (status === 200) {
    const saved = `Saved ${count} ${noun}`;
    return skipped > 0 ? `${saved}. ${skipped} ${skipped === 1 ? "is" : "are"} no longer listed and ${skipped === 1 ? "was" : "were"} not saved.` : saved;
  }
  if (status === 401) return "Sign in to save suppliers.";
  if (status === 404) return "None of the selected suppliers are listed any more, so nothing was saved. Reload the page.";
  if (status === 409) return "A supplier was removed while saving. Save again.";
  if (status === 429) return "Too many saves in the last minute. Wait a minute and save again.";
  if (status === "network") return "Could not save them — no connection. Try again.";
  return "Could not save them. Try again.";
}

/** What an Export button says after the download request came back. The
 * route's refusals are JSON; this turns each into a sentence for the buyer. */
export function exportMessage(
  status: number | "network",
  info: { rows?: number; requested?: number; matched?: number; truncated?: boolean },
): string {
  if (status === 200) {
    const { rows, requested, matched, truncated } = info;
    if (requested != null && rows != null && Number.isFinite(rows) && rows < requested) {
      const gone = requested - rows;
      return `Exported ${rows} of ${requested}. ${gone} ${gone === 1 ? "is" : "are"} no longer on this page of results.`;
    }
    // The full export stops at its row cap. The filename says so, and so must
    // the sentence a screen-reader user hears.
    if (truncated && rows != null && Number.isFinite(rows)) {
      return matched != null && Number.isFinite(matched)
        ? `Exported the first ${rows} of ${matched} suppliers. The export stops at ${rows}; narrow the search to get the rest.`
        : `Exported the first ${rows} suppliers. The export stops there; narrow the search to get the rest.`;
    }
    return "Export downloaded.";
  }
  if (status === 429) return "Too many exports in the last minute. Wait a minute and export again.";
  if (status === 409) return "None of the selected suppliers are on this page of results any more. Reload the page and select again.";
  if (status === 401 || status === 403) return "Sign in with a buyer account to export.";
  if (status === "network") return "Could not export — no connection. Try again.";
  return "Could not export these results. Try again in a moment.";
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

/** The selection kept to this page's rows. Returns the SAME set when nothing
 * changes, so a state setter bails out instead of re-rendering. A refresh
 * (the bulk Save's) can drop a selected supplier off the page; left selected,
 * it made select-all read "4 selected" on a 3-row page and the page-scoped
 * Export refuse. */
export function pruneToPage(selected: ReadonlySet<string>, pageIds: readonly string[]): ReadonlySet<string> {
  const onPage = new Set(pageIds);
  for (const id of selected) {
    if (!onPage.has(id)) return new Set([...selected].filter((x) => onPage.has(x)));
  }
  return selected;
}

/** What the provider hands every card, row and the bar. */
export type SelectionContextValue = {
  /** False outside a `SelectionProvider` — the `/dev/ds` gallery renders
   * these same cards with no provider, and must keep the old inert checkbox
   * rather than a tabbable one that silently does nothing. */
  interactive: boolean;
  selected: ReadonlySet<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAllOnPage: () => void;
  allState: boolean | "mixed";
  clear: () => void;
};

type SetSelected = (next: (s: ReadonlySet<string>) => ReadonlySet<string>) => void;

/** The provider's value, out of React so it can be tested: `set` is the
 * provider's state setter. */
export function selectionValue(selected: ReadonlySet<string>, pageIds: readonly string[], set: SetSelected): SelectionContextValue {
  return {
    interactive: true,
    selected,
    isSelected: (id) => selected.has(id),
    toggle: (id) => set((s) => toggleId(s, id)),
    toggleAllOnPage: () => set((s) => toggleAllOnPage(s, pageIds)),
    allState: selectAllState(selected, pageIds),
    clear: () => set(() => new Set()),
  };
}

/** Clear from inside the bar: move focus to `target` FIRST. Clearing unmounts
 * the bar and the focused Clear button with it, and focus left on a removed
 * node falls to <body> — the next Tab restarts from the top of the page. */
export function clearKeepingFocus(target: { focus(): void } | null, clear: () => void): void {
  target?.focus();
  clear();
}

type Observer = { observe(target: unknown): void; disconnect(): void };

/**
 * WCAG 2.4.11 for a sticky bar at the bottom of the window. The browser
 * scrolls a newly focused element to the viewport's edge and ignores the bar,
 * so reserve the bar's height as `scroll-padding-bottom` (re-measured, since
 * it wraps on a phone), and re-scroll the element that has focus NOW — the
 * box ticked to make the bar appear, which the padding (future scrolls only)
 * does not move. Returns the cleanup that gives the padding back.
 */
export function reserveBarSpace(
  root: { style: { scrollPaddingBottom: string } },
  bar: { offsetHeight: number },
  active: { scrollIntoView?: (o: { block: "nearest" }) => void } | null,
  makeObserver: ((fit: () => void) => Observer) | null,
  /** Whether the bar is sticky NOW. On a short window it is in flow, covers
   * nothing, and reserving its height would only push content away. */
  isSticky: () => boolean = () => true,
): () => void {
  const before = root.style.scrollPaddingBottom;
  const fit = () => {
    root.style.scrollPaddingBottom = isSticky() ? `${bar.offsetHeight + 8}px` : before;
  };
  fit();
  if (isSticky()) active?.scrollIntoView?.({ block: "nearest" });
  const ro = makeObserver ? makeObserver(fit) : null;
  ro?.observe(bar);
  return () => {
    ro?.disconnect();
    root.style.scrollPaddingBottom = before;
  };
}

/**
 * The bar's Save: ONE request for the whole selection, one write against the
 * buyer's rate-limit bucket. `onSaved` runs only on success, with the ids the
 * server actually saved (it skips suppliers no longer listed). Resolves to
 * the sentence the bar shows.
 */
export async function runBulkSave(
  ids: readonly string[],
  deps: {
    fetch: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
    onSaved: (savedIds: string[]) => void;
  },
): Promise<string> {
  try {
    const res = await deps.fetch("/api/v1/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_ids: [...ids] }),
    });
    const body = ((await res.json().catch(() => ({}))) ?? {}) as { count?: number; skipped?: number; ids?: unknown };
    if (!res.ok) return bulkSaveMessage(res.status, ids.length);
    deps.onSaved(Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []);
    return bulkSaveMessage(200, body.count ?? ids.length, body.skipped ?? 0);
  } catch {
    return bulkSaveMessage("network", ids.length);
  }
}

type ExportResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  blob(): Promise<unknown>;
};

/**
 * An Export click, out of React: fetch the CSV, hand it to `save` under the
 * SERVER's filename (which carries "-selected-N-of-M" / "-first-1000-of-X"),
 * and resolve to the sentence the page shows. A refusal saves nothing — the
 * page stays, and the sentence says why.
 */
export async function runExport(
  href: string,
  requested: number | undefined,
  deps: { fetch: (url: string) => Promise<ExportResponse>; save: (blob: unknown, filename: string) => void },
): Promise<string> {
  try {
    const res = await deps.fetch(href);
    if (!res.ok) return exportMessage(res.status, {});
    const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "sourcebd-suppliers.csv";
    deps.save(await res.blob(), filename);
    const num = (name: string) => {
      const v = res.headers.get(name);
      return v == null ? undefined : Number(v);
    };
    return exportMessage(200, {
      rows: num("X-SourceBD-Rows"),
      requested,
      matched: num("X-SourceBD-Matched"),
      truncated: res.headers.get("X-SourceBD-Truncated") === "1",
    });
  } catch {
    return exportMessage("network", {});
  }
}

type SaveDoc = {
  createElement(tag: "a"): { href: string; download: string; click(): void; remove(): void };
  body: { appendChild(el: unknown): unknown };
};

/** Save a blob as a download without leaving the page. The object URL is
 * revoked LATER, not straight after click(): some browsers start reading it
 * only after the click handler returns. */
export function saveBlob(
  doc: SaveDoc,
  urls: { createObjectURL(blob: unknown): string; revokeObjectURL(url: string): void },
  later: (fn: () => void) => void,
  blob: unknown,
  filename: string,
): void {
  const url = urls.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  later(() => urls.revokeObjectURL(url));
}

/** A plain left click on an Export link is taken over (downloaded in place);
 * a modifier or middle click is left to the browser, which opens the href.
 * Returns true, having stopped the navigation, when the click is ours. */
export function interceptPlainClick(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  button: number;
  preventDefault(): void;
}): boolean {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return false;
  e.preventDefault();
  return true;
}
