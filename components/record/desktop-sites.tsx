"use client";

// The Sites section's body on a desktop (Paper page 37): the app's own map (`locations-map.tsx`: pins
// from the ETL's geocode cache, no geocoding at runtime) beside a table of the premises, one row each.
// A row's site is a link (`?site=2`), so the table works with no script; with one, a click selects the
// row, the map flies to its pin, and a click on a pin selects its row. The address follows the
// selection without a navigation, so a site can be shared. The behaviour is `useSiteSelection`, shared with
// the phone's `SitesView`; this draws it as the board's table.

import Link from "next/link";
import { ring } from "@/components/kit";
import { MAP_ATTRIBUTION, MapWidget } from "@/components/record/locations-map";
import { cn } from "@/lib/utils";
import type { SiteLine } from "./desktop-words";
import { SITE_PARAM, useSiteSelection } from "./sites-view";

// The map sits beside the table only from 840px of column: the address then keeps 220px or more. Under
// that the map is over the table, and the address has the row's whole width.
const WIDE_ROW = "[@container_(min-width:840px)]:flex-row [@container_(min-width:840px)]:items-start [@container_(min-width:840px)]:gap-5";
const COLS = "grid grid-cols-[28px_104px_minmax(0,1fr)_112px] items-center gap-x-3";
const segment = "h-7 px-2.5 text-xs font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus";

export function DesktopSites({ lines, slug, baseHref, initial = null, mapKey }: { lines: SiteLine[]; slug: string; /** The Sites tab's own link; a row adds `site=N` to it. */ baseHref: string; /** `?site=` as the server read it. */ initial?: number | null; /** The Barikoi key is public and bound to the domain; with none, the table stands alone. */ mapKey: boolean }) {
  const { markers, selected, focusedIndex, nearby, mapStyle, setMapStyle, onPin, onSelect } = useSiteSelection(lines, slug, initial);
  const mapped = mapKey && markers.length > 0;

  return (
    <div className={cn("flex flex-col gap-3", WIDE_ROW)}>
      {mapped ? (
        <div className="flex flex-col gap-2 px-3 [@container_(min-width:840px)]:w-[292px] [@container_(min-width:840px)]:shrink-0 [@container_(min-width:840px)]:pr-0">
          <div className="overflow-clip rounded-[10px] border border-line">
            <MapWidget
              markers={markers}
              focusedIndex={focusedIndex}
              onFocusChange={onPin}
              mapStyle={mapStyle}
              nearbySites={nearby.sites}
              nearbyEnabled={nearby.enabled}
              profileBasePath="/app/suppliers"
              ariaLabel={markers.length > 1 ? `Map of ${markers.length} pinned sites. Use the left and right arrow keys to move between them.` : `Map of the pinned site: ${markers[0]!.label}`}
              heightClass="h-[196px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div role="group" aria-label="Map style" className="flex overflow-clip rounded-md border border-line">
              {(["street", "satellite"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={mapStyle === s} onClick={() => setMapStyle(s)} className={cn(segment, mapStyle === s ? "bg-sunken text-ink" : "bg-surface text-ink-2 hover:bg-subtle")}>
                  {s === "street" ? "Street" : "Satellite"}
                </button>
              ))}
            </div>
            <button type="button" role="switch" aria-checked={nearby.enabled} onClick={nearby.toggle} className={cn("flex h-7 items-center gap-2 rounded-sm text-xs text-ink-2", ring)}>
              <span aria-hidden className={cn("flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none", nearby.enabled ? "bg-brand-ink" : "bg-line-strong")}>
                <span className={cn("size-3 rounded-full bg-surface transition-transform motion-reduce:transition-none", nearby.enabled && "translate-x-3")} />
              </span>
              {nearby.pending ? "Loading nearby suppliers" : "Nearby suppliers"}
            </button>
          </div>
          {nearby.enabled && nearby.failed ? <p role="status" className="text-xs text-ink-2">Nearby suppliers could not be read. Switch it off and on to try again.</p> : null}
          {nearby.enabled && !nearby.failed && !nearby.pending && nearby.loaded && nearby.sites.length === 0 ? <p role="status" className="text-xs text-ink-2">No other published SourceBD site within 6 km of this view.</p> : null}
          <p className="text-xs text-ink-3">{MAP_ATTRIBUTION[mapStyle]}. Pins are placed from the address text, so they are approximate.</p>
        </div>
      ) : null}
      <div role="table" aria-label="Sites" className="flex min-w-0 flex-1 flex-col">
        <div role="rowgroup">
          <div role="row" className={cn(COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
            <span role="columnheader">Pin</span>
            <span role="columnheader">Site</span>
            <span role="columnheader">Address</span>
            <span role="columnheader">From</span>
          </div>
        </div>
        <div role="rowgroup">
          {lines.map((l) => {
            const on = l.n === selected;
            return (
              <div key={l.n} role="row" aria-current={on ? "true" : undefined} className={cn(COLS, "relative min-h-11 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-subtle", on && "bg-sunken hover:bg-sunken")}>
                <span role="cell">
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-xs font-semibold [font-variant-numeric:tabular-nums]", l.pin ? "bg-ink text-surface" : "border border-line-strong text-ink-2")}>{l.n}</span>
                </span>
                <span role="cell" className="flex min-w-0 flex-col">
                  {/* The row is the link: its target covers the row, its words are the site's kind. */}
                  <Link
                    href={`${baseHref}${baseHref.includes("?") ? "&" : "?"}${SITE_PARAM}=${l.n}`}
                    scroll={false}
                    prefetch={false}
                    onClick={(e) => {
                      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onSelect(l.n);
                    }}
                    className="rounded-sm text-base font-medium text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-focus"
                  >
                    {l.site}
                    <span className="sr-only">, site {l.n}{l.pin ? ", show on the map" : ", not pinned yet"}</span>
                  </Link>
                  {l.detail ? <span className="text-xs text-ink-3">{l.detail}</span> : null}
                </span>
                <span role="cell" className="flex min-w-0 flex-col text-base text-ink [overflow-wrap:anywhere]">
                  {l.address}
                  {l.approx ? <span className="text-xs text-ink-3">The pin marks the area, not the building.</span> : null}
                </span>
                <span role="cell" className="text-sm text-ink-2">{l.from ?? "The record"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
