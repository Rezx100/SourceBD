"use client";

// Interactive Locations section — binds LocationsMap ↔ address list via shared
// selectedIndex state so clicking an address row flies to that pin, and clicking
// a map pin highlights that row in the list.
//
// REZ-30 adds two bindings on top of that:
//   • Geocoded rows on multi-site profiles carry the same numbered badge, in
//     the same address-kind colour, as their map pin — so "site 3" means one
//     thing on the map, in the list, and in the exported GeoJSON.
//   • `?site=N` deep-links a profile straight to one location. Read from the
//     URL on mount and written back with history.replaceState, so sharing a
//     pin never costs a navigation or a re-render of the server component.
//
// For addresses with no ETL geocode cache entry (markerIndex === null), clicking
// the row fires a one-credit Barikoi Autocomplete request to get a best-effort
// lat/lng. The result is ephemeral (session state only — never written to DB).
// A lighter sage pin distinguishes it from registry-verified forest-green pins.

import { useCallback, useEffect, useState } from "react";
import {
  Buildings,
  CircleNotch,
  EnvelopeSimple,
  Factory,
  MapPin,
  MapPinLine,
} from "@phosphor-icons/react";

import { AlsoRecordedAs } from "@/components/supplier/also-recorded-as";
import { AuthorityChip } from "@/components/supplier/authority-chip";
import { LocationsAddressGroup } from "@/components/supplier/locations-address-group";
import {
  LOCATION_KIND_STYLE,
  LocationsMap,
  type LocationKind,
  type LocationMapMarker,
} from "@/components/supplier/locations-map";
import { CATEGORY_BY_GROUP, secondaryTypeLabels, type AddressVariant } from "@/lib/dedup-addresses";
import { toTitleCaseAddress } from "@/lib/format-location";

/** Deep-link param that focuses one location on load. 1-based to match the
 *  numbering a buyer sees on the pins and in the address list. */
const SITE_PARAM = "site";

// ─── Serialisable shape passed from the server component ─────────────────────

export type SerializableLocation = {
  displayAddress: string;
  floors: string[];
  variants: AddressVariant[];
  types: string[];
  authorities: string[];
  /** Index into the `markers` array for this location, or null if not geocoded. */
  markerIndex: number | null;
};

export type SerializableGroup = {
  title: string;
  locations: SerializableLocation[];
};

// ─── Barikoi Autocomplete (live-locate) ──────────────────────────────────────
// Calls the Barikoi Search endpoint with the display address text.
// Uses NEXT_PUBLIC_BARIKOI_API_KEY (already public — bound to domain in the
// Barikoi dashboard). Returns null on any failure; never throws.

type LocateResult = { latitude: number; longitude: number };

async function barikoiLocate(
  query: string,
  apiKey: string,
): Promise<LocateResult | null> {
  try {
    const url =
      `https://barikoi.com/v2/api/search/geocode/place` +
      `?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: Array<{ latitude?: string | number; longitude?: string | number }>;
    };
    const first = json.places?.[0];
    if (!first?.latitude || !first?.longitude) return null;
    return {
      latitude: Number(first.latitude),
      longitude: Number(first.longitude),
    };
  } catch {
    return null;
  }
}

// ─── Group icon / kind maps ───────────────────────────────────────────────────

const GROUP_ICON: Record<string, React.ReactNode> = {
  Factories: <Factory size={17} weight="duotone" aria-hidden />,
  "Registered offices": <Buildings size={17} weight="duotone" aria-hidden />,
  "Mailing addresses": <EnvelopeSimple size={17} weight="duotone" aria-hidden />,
  "Other addresses": <MapPin size={17} weight="duotone" aria-hidden />,
};

/** Group titles come from `buildLocationOverview`; the map thinks in kinds.
 *  The table itself is server-safe and lives in `lib/dedup-addresses`. */
const GROUP_KIND = CATEGORY_BY_GROUP as Record<string, LocationKind>;

// ─── Address row ─────────────────────────────────────────────────────────────

type LocateState = "idle" | "loading" | "success" | "failed";

export function AddressRow({
  location,
  groupTitle,
  isSelected,
  locateState,
  showSiteNumber,
  onClick,
}: {
  location: SerializableLocation;
  groupTitle: string;
  isSelected: boolean;
  locateState: LocateState;
  /** True on multi-pin profiles, where the numbered badge is what ties this
   *  row to a specific pin. */
  showSiteNumber: boolean;
  onClick: () => void;
}) {
  const also = secondaryTypeLabels(location.types);
  const display = toTitleCaseAddress(location.displayAddress);
  const extraFloors = location.floors.filter(
    (floor) => !display.toLowerCase().includes(floor.toLowerCase()),
  );

  const isUngeocoded = location.markerIndex === null;
  const isTransientSelected = isSelected && isUngeocoded;
  const siteNumber =
    showSiteNumber && location.markerIndex !== null
      ? location.markerIndex + 1
      : null;
  const kindStyle = LOCATION_KIND_STYLE[GROUP_KIND[groupTitle] ?? "other"];

  // Icon tile — spinner while locating, cross-map-pin on failure, and on
  // multi-site profiles a numbered badge in the pin's own colour.
  const iconTile = (() => {
    if (locateState === "loading") {
      return (
        <CircleNotch
          size={17}
          weight="bold"
          className="animate-spin text-neutral-400"
          aria-hidden
        />
      );
    }
    if (locateState === "failed") {
      return (
        <MapPinLine size={17} weight="duotone" className="text-neutral-400" aria-hidden />
      );
    }
    if (siteNumber !== null) {
      return (
        <span
          className={
            "flex size-[19px] items-center justify-center font-mono text-[10.5px] font-bold " +
            (kindStyle.head === "round" ? "rounded-full" : "rounded-[5px]")
          }
          style={{ background: kindStyle.color, color: kindStyle.badgeColor }}
        >
          {siteNumber}
        </span>
      );
    }
    return GROUP_ICON[groupTitle] ?? <MapPin size={17} weight="duotone" aria-hidden />;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locateState === "failed"}
      className={[
        "flex w-full flex-col gap-2 rounded-lg px-2 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        isTransientSelected
          ? "bg-[#edf5f1] ring-1 ring-[#6b9e83]/30"
          : isSelected
            ? "bg-brand-forest-soft ring-1 ring-brand-forest/20"
            : locateState === "failed"
              ? "cursor-not-allowed opacity-60"
              : "hover:bg-neutral-50",
      ].join(" ")}
      aria-current={isSelected ? "true" : undefined}
      data-location-row=""
      data-location-group={groupTitle}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:flex-1">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-neutral-200/70 bg-[#fafaf9] text-neutral-500 sm:mt-px sm:size-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:text-neutral-400"
          aria-hidden
        >
          {iconTile}
        </span>
        <div className="min-w-0 pt-0.5 sm:pt-0">
          <p
            className="text-[14.5px] leading-[1.45] text-neutral-800"
            data-location-display=""
          >
            {siteNumber !== null ? (
              <span className="sr-only">Site {siteNumber}. </span>
            ) : null}
            {display}
            {extraFloors.length > 0 ? (
              <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
                Also on {extraFloors.join(", ")}
              </span>
            ) : null}
            {also.length > 0 ? (
              <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
                Also: {also.join(", ")}
              </span>
            ) : null}
          </p>
          <AlsoRecordedAs variants={location.variants} />
          {/* Hint text for ungeocoded rows (idle only — disappears after locate attempt) */}
          {isUngeocoded && locateState === "idle" ? (
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Click to locate on map
            </p>
          ) : locateState === "failed" ? (
            <p className="mt-0.5 text-[12px] text-neutral-400">
              Location not found
            </p>
          ) : locateState === "success" && isTransientSelected ? (
            <p className="mt-0.5 text-[12px] text-[#6b9e83]">
              Best-effort locate — not registry-verified
            </p>
          ) : null}
        </div>
      </div>
      {location.authorities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pl-[38px] sm:shrink-0 sm:justify-end sm:gap-1 sm:pl-0">
          {location.authorities.map((code) => (
            <AuthorityChip
              key={code}
              label={code.replace(/_/g, "-")}
              className="px-2 py-[3px] text-[11px] sm:px-2.5 sm:py-0.5 sm:text-[12px]"
            />
          ))}
        </div>
      ) : null}
    </button>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function LocationsSection({
  markers,
  groups,
  supplierSlug,
  profileBasePath,
}: {
  markers: LocationMapMarker[];
  groups: SerializableGroup[];
  /** Excluded from the nearby layer; also names the GeoJSON export. */
  supplierSlug?: string;
  /** `/suppliers` or `/app/suppliers` for nearby-supplier popup links. */
  profileBasePath?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Transient locate state — keyed by display address string.
  // Values: null = not yet attempted; object = success; "failed" = API failure.
  const [locateCache, setLocateCache] = useState<
    Map<string, LocateResult | "failed">
  >(new Map());
  // Which addresses are currently in-flight
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  // The transient marker currently shown on the map (null = none)
  const [transientMarker, setTransientMarkerState] =
    useState<LocationMapMarker | null>(null);

  const apiKey =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_BARIKOI_API_KEY
      : undefined;

  // --- ?site=N deep link (read once on mount) ---
  // Read straight from `location.search` rather than `useSearchParams` so this
  // stays a plain client island: no Suspense boundary, and no dependency on the
  // profile page's rendering mode.
  useEffect(() => {
    if (markers.length === 0) return;
    const raw = new URLSearchParams(window.location.search).get(SITE_PARAM);
    if (!raw) return;
    const requested = Number.parseInt(raw, 10);
    if (!Number.isInteger(requested)) return;
    if (requested < 1 || requested > markers.length) return;
    setSelectedIndex(requested - 1);
    // A shared pin link should land on the map, not the top of the profile.
    document
      .getElementById("locations")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [markers.length]);

  // --- keep the URL in step with the focused pin, without navigating ---
  useEffect(() => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(SITE_PARAM);
    const next = selectedIndex === null ? null : String(selectedIndex + 1);
    if (current === next) return;
    if (next === null) url.searchParams.delete(SITE_PARAM);
    else url.searchParams.set(SITE_PARAM, next);
    window.history.replaceState(null, "", url.toString());
  }, [selectedIndex]);

  // --- ETL-geocoded address click ---
  const handleAddressClick = useCallback((markerIndex: number | null) => {
    // Clicking a geocoded row clears any transient marker and focuses that ETL pin.
    setTransientMarkerState(null);
    setSelectedIndex((prev) => (prev === markerIndex ? null : markerIndex));
  }, []);

  // --- Map pin click ---
  const handleMapFocus = useCallback((index: number | null) => {
    setTransientMarkerState(null);
    setSelectedIndex(index);
  }, []);

  // --- Ungeocoded address click: fire Barikoi Autocomplete ---
  const handleLocateClick = useCallback(
    async (displayAddress: string) => {
      // Deselect the ETL-geocoded pin if one was selected.
      setSelectedIndex(null);

      const cached = locateCache.get(displayAddress);

      if (cached === "failed") return; // already tried and failed — row is disabled

      if (cached) {
        // Reuse cached result.
        setTransientMarkerState({
          latitude: cached.latitude,
          longitude: cached.longitude,
          label: displayAddress,
        });
        return;
      }

      if (loadingKeys.has(displayAddress)) return; // request in flight

      if (!apiKey) return;

      setLoadingKeys((prev) => new Set(prev).add(displayAddress));

      const result = await barikoiLocate(displayAddress, apiKey);

      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(displayAddress);
        return next;
      });

      setLocateCache((prev) => {
        const next = new Map(prev);
        next.set(displayAddress, result ?? "failed");
        return next;
      });

      if (result) {
        setTransientMarkerState({
          latitude: result.latitude,
          longitude: result.longitude,
          label: displayAddress,
        });
      }
    },
    [locateCache, loadingKeys, apiKey],
  );

  return (
    <div>
      {/* Show map whenever there are ETL markers OR a transient locate result */}
      {markers.length > 0 || transientMarker ? (
        <div className="mb-5">
          <LocationsMap
            markers={markers}
            focusedIndex={selectedIndex}
            onFocusChange={handleMapFocus}
            transientMarker={transientMarker}
            supplierSlug={supplierSlug}
            profileBasePath={profileBasePath}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <LocationsAddressGroup
            key={group.title}
            title={group.title}
            count={group.locations.length}
          >
            {group.locations.map((location) => {
              const isGeocoded = location.markerIndex !== null;
              const isSelected =
                isGeocoded && selectedIndex === location.markerIndex;

              // Determine transient locate state for this row.
              const locateState: LocateState = (() => {
                if (isGeocoded) return "idle"; // geocoded rows never go through locate flow
                const key = location.displayAddress;
                if (loadingKeys.has(key)) return "loading";
                const cached = locateCache.get(key);
                if (cached === "failed") return "failed";
                if (cached) return "success";
                return "idle";
              })();

              // A transient row is "selected" when it is the current transient
              // marker (its locate succeeded and it is the active transient pin).
              const isTransientSelected =
                !isGeocoded &&
                locateState === "success" &&
                transientMarker?.label === location.displayAddress;

              return (
                <AddressRow
                  key={location.displayAddress}
                  location={location}
                  groupTitle={group.title}
                  isSelected={isSelected || isTransientSelected}
                  locateState={locateState}
                  showSiteNumber={markers.length > 1}
                  onClick={() =>
                    isGeocoded
                      ? handleAddressClick(location.markerIndex)
                      : void handleLocateClick(location.displayAddress)
                  }
                />
              );
            })}
          </LocationsAddressGroup>
        ))}
      </div>
    </div>
  );
}
