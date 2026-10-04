"use client";

// The Sites tab's body (B4d, Paper `Record full page · Sites`): the Barikoi map beside one card per
// premises. The map is the existing capture (`components/supplier/locations-map.tsx`: pins from the ETL's
// geocode cache, no geocoding at runtime); this holds the selection both ways. A card is a link
// (`?site=2`), so the list works with no script; with one, a click selects, the map flies to the pin,
// and a click on a pin selects its card. The selected card is tint plus a bar. The URL follows the
// selection without a navigation, so a site can be shared.

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteList, type Site } from "@/components/patterns/locations";
import { MAP_ATTRIBUTION, MapWidget, useNearbyLayer, type LocationMapMarker, type MapStyle } from "@/components/supplier/locations-map";
import { cn } from "@/lib/utils";
import { siteSummary, type SiteCard } from "./words";

const SITE_PARAM = "site";

const segment = "min-h-11 px-3.5 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:min-h-9";

export function SitesView({
  cards,
  slug,
  baseHref,
  initial = null,
  wide,
  mapKey,
}: {
  cards: SiteCard[];
  slug: string;
  /** The Sites tab's own link; a card adds `site=N` to it, so the list works with no script. (A string: a function cannot cross from the server page.) */
  baseHref: string;
  /** `?site=` as the server read it: the card selected on first paint. */
  initial?: number | null;
  /** The full page puts the cards beside the map; beside the results there is no room. */
  wide: boolean;
  /** The Barikoi key is public and bound to the domain; with none, the list stands alone. */
  mapKey: boolean;
}) {
  const markers = useMemo<LocationMapMarker[]>(
    () =>
      cards
        .filter((c) => c.pin)
        .map((c) => ({
          latitude: c.pin!.latitude,
          longitude: c.pin!.longitude,
          label: c.address,
          kind: c.kind === "office" ? "registered" : "factory",
          confidencePct: c.pin!.confidencePct,
          addressStatus: c.pin!.addressStatus,
        })),
    [cards],
  );
  const [selected, setSelected] = useState<number | null>(initial && initial >= 1 && initial <= cards.length ? initial : null);
  // The card is selected on first paint (it works with no script), but the map is told only after
  // mount: a map born already focused would not fly to the pin.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const focusedIndex = mounted && selected !== null && selected <= markers.length ? selected - 1 : null;
  const nearby = useNearbyLayer(markers, focusedIndex, slug);

  // The URL follows the selection; no navigation, so the server component is not read again.
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = selected === null ? null : String(selected);
    if (url.searchParams.get(SITE_PARAM) === next) return;
    if (next === null) url.searchParams.delete(SITE_PARAM);
    else url.searchParams.set(SITE_PARAM, next);
    window.history.replaceState(null, "", url.toString());
  }, [selected]);

  const onPin = useCallback((index: number | null) => setSelected(index === null ? null : index + 1), []);
  const onSelect = useCallback((n: number) => setSelected((prev) => (prev === n ? null : n)), []);

  const sites: Site[] = cards.map((c) => ({ n: c.n, kind: c.kind, words: c.words, address: c.address, note: c.note, href: `${baseHref}${baseHref.includes("?") ? "&" : "?"}${SITE_PARAM}=${c.n}` }));
  const mapped = mapKey && markers.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h3 className="text-lg font-semibold text-ink">Sites · {cards.length}</h3>
          <p className="text-sm text-ink-2">{siteSummary(cards)}</p>
        </div>
        {mapped ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label="Map style" className="flex overflow-clip rounded-md border border-line">
              {(["street", "satellite"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={mapStyle === s}
                  onClick={() => setMapStyle(s)}
                  className={cn(segment, mapStyle === s ? "bg-subtle text-ink" : "bg-surface text-ink-2 hover:bg-subtle")}
                >
                  {s === "street" ? "Street" : "Satellite"}
                </button>
              ))}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={nearby.enabled}
              onClick={nearby.toggle}
              className="flex min-h-11 items-center gap-2.5 rounded-sm text-sm text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-9"
            >
              <span aria-hidden className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", nearby.enabled ? "bg-brand" : "bg-line-strong")}>
                <span className={cn("size-4 rounded-full bg-surface transition-transform", nearby.enabled && "translate-x-4")} />
              </span>
              {nearby.pending ? "Loading nearby suppliers" : "Show nearby suppliers"}
            </button>
          </div>
        ) : null}
      </div>
      {mapped && nearby.enabled && nearby.failed ? <p role="status" className="text-sm text-ink-2">Nearby suppliers could not be read. Switch it off and on to try again.</p> : null}
      {mapped && nearby.enabled && !nearby.failed && !nearby.pending && nearby.loaded && nearby.sites.length === 0 ? (
        <p role="status" className="text-sm text-ink-2">No other published SourceBD site within 6 km of this view.</p>
      ) : null}

      <div className={cn("flex flex-col gap-4", wide && mapped && "lg:grid lg:grid-cols-[minmax(0,1fr)_19.25rem] lg:items-start")}>
        {mapped ? (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="overflow-clip rounded-lg border border-line">
              <MapWidget
                markers={markers}
                focusedIndex={focusedIndex}
                onFocusChange={onPin}
                mapStyle={mapStyle}
                nearbySites={nearby.sites}
                nearbyEnabled={nearby.enabled}
                profileBasePath="/app/suppliers"
                ariaLabel={
                  markers.length > 1
                    ? `Map of ${markers.length} pinned sites. Use the left and right arrow keys to move between them.`
                    : `Map of the pinned site: ${markers[0]!.label}`
                }
                heightClass="h-[300px] sm:h-[375px]"
              />
            </div>
            <p className="text-xs text-ink-3">{MAP_ATTRIBUTION[mapStyle]}. Pins are placed from the address text, so they are approximate.</p>
          </div>
        ) : null}
        <SiteList sites={sites} selected={selected ?? undefined} onSelect={onSelect} />
      </div>
    </div>
  );
}
