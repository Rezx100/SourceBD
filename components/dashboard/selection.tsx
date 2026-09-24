"use client";

// Selection state for the Discover results bulk bar (REZ-B, handoff §7.5).
// `SupplierResultCard`, `ResultsTable`'s rows and the panel header's
// select-all checkbox all read the same context. Selection is scoped to
// "this page", exactly as the spec's "Select all on this page" label says:
// the page keys the provider on its full URL state, so any change of
// filter, sort, page or view remounts it empty — whether that navigation is
// a full load or a client-side one (Next keeps client state across a
// search-param change otherwise). The bar's Export re-runs only this page,
// so a selection that outlived its page would export short without a word.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { pruneToPage, selectionValue, type SelectionContextValue } from "@/lib/dashboard/selection";
import { Checkbox } from "./controls";

export type { SelectionContextValue };

/** Exported for the render tests, which mount the bar over a given selection. */
export const SelectionContext = createContext<SelectionContextValue | null>(null);

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

export function SelectionProvider({ pageIds, children }: { pageIds: readonly string[]; children?: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [edits, setEdits] = useState(0);
  const value = useMemo(
    () => selectionValue(selected, pageIds, setSelected, edits, () => setEdits((n) => n + 1)),
    [selected, pageIds, edits],
  );
  // A refresh keeps this provider (same URL key) but can change its rows.
  const pageKey = pageIds.join(",");
  useEffect(() => {
    setSelected((s) => pruneToPage(s, pageKey ? pageKey.split(",") : []));
  }, [pageKey]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  return useContext(SelectionContext) ?? INERT;
}

/** Where focus goes when the bar's Clear removes the bar (and itself). */
export const SELECT_ALL_ID = "discover-select-all";

/** The panel header's select-all checkbox — inert without a provider, real with one. */
export function SelectAllCheckbox() {
  const sel = useSelection();
  return (
    <Checkbox
      id={sel.interactive ? SELECT_ALL_ID : undefined}
      on={sel.interactive ? sel.allState : false}
      label="Select all on this page"
      onToggle={sel.interactive ? sel.toggleAllOnPage : undefined}
    />
  );
}
