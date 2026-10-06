// The filter pane beside the results (`?filters=1`; Paper `10 · Filters panel open, live
// count`, `11 · Filters sheet`). The server part: the chips and the standing filter's link are
// searches with the pane still open, the heading list is the catalogue's, and the body is the
// client's. Keyed by the search, so a chip's × (a navigation) starts the draft again from the
// search it now describes.

import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
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

export function FilterPane({
  state,
  count,
  closeHref,
  defaultOpen,
}: {
  state: DiscoverState;
  /** What the search finds; null when it could not be read. */
  count: number | null;
  closeHref: string;
  defaultOpen?: readonly GroupId[];
}) {
  return (
    <FilterPanel
      defaultOpen={defaultOpen}
      key={serializeDiscoverState(state).toString()}
      state={state}
      count={count}
      chips={appliedChips(state).map((c) => ({ key: c.key, label: c.label, href: withPane(c.without) }))}
      showThemHref={state.sanctioned ? null : withPane({ ...state, sanctioned: true, page: 1 })}
      hsOptions={HS_OPTIONS}
      closeHref={closeHref}
    />
  );
}
