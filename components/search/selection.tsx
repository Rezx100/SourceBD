"use client";

// Selection for the results (hand-off B4): which suppliers on THIS page are ticked. The page
// keys the provider on its whole search, so a new filter, sort or page starts empty: the
// bar's Download CSV re-runs only this page, and a selection that outlived it would export
// short without a word. The rules (toggle, select all on the page, prune after a refresh)
// are `lib/dashboard/selection.ts`; this is only the context around them.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { pruneToPage, selectionValue, type SelectionContextValue } from "@/lib/dashboard/selection";

export type { SelectionContextValue };

const NO_ROWS: readonly string[] = [];

const INERT: SelectionContextValue = {
  interactive: false,
  selected: new Set(),
  isSelected: () => false,
  toggle: () => {},
  toggleAllOnPage: () => {},
  allState: false,
  clear: () => {},
  edits: 0,
};

/** Exported for the render tests, which mount the bar over a given selection. */
export const SelectionContext = createContext<SelectionContextValue | null>(null);

/** `pageIds: null`: this render could not read the page (a search that failed under an open record). The selection is kept as it was. */
export function SelectionProvider({ pageIds, children }: { pageIds: readonly string[] | null; children?: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [edits, setEdits] = useState(0);
  const ids = pageIds ?? NO_ROWS;
  const value = useMemo(() => selectionValue(selected, ids, setSelected, edits, () => setEdits((n) => n + 1)), [selected, ids, edits]);
  const pageKey = pageIds === null ? null : pageIds.join(",");
  useEffect(() => {
    if (pageKey === null) return;
    setSelected((s) => pruneToPage(s, pageKey ? pageKey.split(",") : []));
  }, [pageKey]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  return useContext(SelectionContext) ?? INERT;
}

/** Where focus goes when Clear removes the bar and itself. */
export const SELECT_ALL_ID = "results-select-all";
