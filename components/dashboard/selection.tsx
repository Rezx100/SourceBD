"use client";

// Selection state for the Discover results bulk bar (REZ-B, handoff §7.5).
// One provider per page load — `SupplierResultCard`, `ResultsTable`'s rows
// and the panel header's select-all checkbox all read the same context, and
// the URL-is-the-state page navigation (sort, filter, page) remounts it
// fresh, so selection is scoped to "this page" exactly as the spec's
// "Select all on this page" label says.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { allOnPageSelected, toggleAllOnPage, toggleId } from "@/lib/dashboard/selection";
import { Checkbox } from "./controls";

type SelectionContextValue = {
  /** False outside a `SelectionProvider` — the `/dev/ds` gallery renders
   * these same cards with no provider, and must keep the old inert checkbox
   * rather than a tabbable one that silently does nothing. */
  interactive: boolean;
  selected: ReadonlySet<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAllOnPage: () => void;
  allOnPageSelected: boolean;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

const INERT: SelectionContextValue = {
  interactive: false,
  selected: new Set(),
  isSelected: () => false,
  toggle: () => {},
  toggleAllOnPage: () => {},
  allOnPageSelected: false,
  clear: () => {},
};

export function SelectionProvider({ pageIds, children }: { pageIds: readonly string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const value = useMemo<SelectionContextValue>(
    () => ({
      interactive: true,
      selected,
      isSelected: (id) => selected.has(id),
      toggle: (id) => setSelected((s) => toggleId(s, id)),
      toggleAllOnPage: () => setSelected((s) => toggleAllOnPage(s, pageIds)),
      allOnPageSelected: allOnPageSelected(selected, pageIds),
      clear: () => setSelected(new Set()),
    }),
    [selected, pageIds],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  return useContext(SelectionContext) ?? INERT;
}

/** The panel header's select-all checkbox — inert without a provider, real with one. */
export function SelectAllCheckbox() {
  const sel = useSelection();
  return (
    <Checkbox
      on={sel.interactive && sel.allOnPageSelected}
      label="Select all on this page"
      onToggle={sel.interactive ? sel.toggleAllOnPage : undefined}
    />
  );
}
