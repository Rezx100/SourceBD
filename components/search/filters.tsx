// The filter pane beside the results (`?filters=1`; Paper `10 · Filters panel open, live
// count`, `11 · Filters sheet`). The server part: the chips and the standing filter's link are
// searches with the pane still open, the heading list is the catalogue's, and the body is the
// client's. Keyed by the search, so a chip's × (a navigation) starts the draft again from the
// search it now describes.

import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { loadUflpaSheetNotice } from "@/components/compliance/uflpa-read";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { cn } from "@/lib/utils";
import { discoverHref, serializeDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";
import { HS_CATALOGUE } from "@/lib/hs-catalogue";
import { appliedChips, type GroupId } from "./filter-model";
import { FilterPanel } from "./filter-panel";

const HS_OPTIONS = HS_CATALOGUE.map((r) => ({ hs: r.hs, label: hsBuyerLabel(r.hs, r.heading ?? null) }));

/** The search with the filter pane still open. */
function withPane(state: DiscoverState): string {
  const href = discoverHref(state);
  return `${href}${href.includes("?") ? "&" : "?"}filters=1`;
}

/**
 * The phone sheet's line under the sanctions switch (Paper page 36, `filters`): what the last read of
 * the UFLPA list found, with its date from the record. Read on its own, so the sheet never waits for
 * it; nothing is drawn when neither the check nor the read date could be read.
 */
export async function UflpaSheetNote({ supabase, today }: { /** The Supabase server client. */ supabase: unknown; today: Date }) {
  const n = await loadUflpaSheetNotice(supabase, today);
  if (!n) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs font-medium md:hidden", n.hit ? "text-caution" : "text-ink-2")}>
      <ShieldCheck size={14} className={cn("mt-px shrink-0", n.hit ? "text-caution-icon" : "text-ink-3")} aria-hidden />
      {n.line}
    </p>
  );
}

export function FilterPane({
  state,
  count,
  closeHref,
  defaultOpen,
  note,
}: {
  state: DiscoverState;
  /** What the search finds; null when it could not be read. */
  count: number | null;
  closeHref: string;
  defaultOpen?: readonly GroupId[];
  /** `UflpaSheetNote`, in a boundary of its own. */
  note?: ReactNode;
}) {
  return (
    <FilterPanel
      sanctionsNote={note}
      defaultOpen={defaultOpen}
      key={serializeDiscoverState(state).toString()}
      state={state}
      count={count}
      chips={appliedChips(state).map((c) => ({ key: c.key, label: c.label, href: withPane(c.without) }))}
      hsOptions={HS_OPTIONS}
      closeHref={closeHref}
    />
  );
}
