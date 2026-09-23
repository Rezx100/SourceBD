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

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { selectAllState, toggleAllOnPage, toggleId } from "@/lib/dashboard/selection";
import { Checkbox } from "./controls";

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
};

export function SelectionProvider({ pageIds, children }: { pageIds: readonly string[]; children?: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const value = useMemo<SelectionContextValue>(
    () => ({
      interactive: true,
      selected,
      isSelected: (id) => selected.has(id),
      toggle: (id) => setSelected((s) => toggleId(s, id)),
      toggleAllOnPage: () => setSelected((s) => toggleAllOnPage(s, pageIds)),
      allState: selectAllState(selected, pageIds),
      clear: () => setSelected(new Set()),
    }),
    [selected, pageIds],
  );
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
