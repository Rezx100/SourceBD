"use client";

// Locations map — Barikoi GL (bkoi-gl / MapLibre) with:
//   • Satellite ↔ street style toggle
//   • Campus-level default zoom (16); per-style maxZoom caps
//   • One overview map for multi-site suppliers (fitBounds + click-to-focus)
//   • Single-address profiles keep one focused map
//   • Fullscreen / large-map mode (Esc or ✕ to exit)
//   • Copy lat/lng to clipboard + Open in Google Maps (per-pin popup)
//   • Quiet by default: no scroll-zoom hijack; no rotation

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowsIn, ArrowsOut, List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

import "bkoi-gl/dist/style/bkoi-gl.css";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LocationMapMarker = {
  latitude: number;
  longitude: number;
  label: string;
};

export type MapStyle = "satellite" | "street";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLE_URLS: Record<MapStyle, string> = {
  satellite: "https://map.barikoi.com/styles/barikoi_satellite/style.json",
  street: "https://map.barikoi.com/styles/osm_barikoi_v1/style.json",
};

const CAMPUS_ZOOM = 16;
const MAX_ZOOM: Record<MapStyle, number> = { satellite: 19, street: 20 };
// fitBounds padding (px) for overview mode
const OVERVIEW_PADDING = 52;
// Maximum overview zoom so distant single-cluster sites read clearly
const OVERVIEW_MAX_ZOOM = 15;
// Lighter sage color for transient (live-located) pins — visually distinct from
// ETL-verified forest-green pins so buyers know it is a best-effort locate.
const TRANSIENT_PIN_COLOR = "#6b9e83";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function styleUrl(style: MapStyle, apiKey: string) {
  return `${MAP_STYLE_URLS[style]}?key=${encodeURIComponent(apiKey)}`;
}

/** Compute [west, south, east, north] bounds from a set of markers. */
function markerBounds(
  markers: LocationMapMarker[],
): [[number, number], [number, number]] {
  let west = markers[0]!.longitude;
  let east = markers[0]!.longitude;
  let south = markers[0]!.latitude;
  let north = markers[0]!.latitude;
  for (const m of markers) {
    if (m.longitude < west) west = m.longitude;
    if (m.longitude > east) east = m.longitude;
    if (m.latitude < south) south = m.latitude;
    if (m.latitude > north) north = m.latitude;
  }
  return [
    [west, south],
    [east, north],
  ];
}

// ─── Pin popup HTML ──────────────────────────────────────────────────────────
// We render popup content as static HTML (no React portal needed) so the
// bkoi-gl Popup can own its DOM. Copy/open actions are wired up after
// the popup is added to the map via popupElement refs.

function makePinPopupHtml(marker: LocationMapMarker, index: number) {
  const lat = marker.latitude.toFixed(6);
  const lng = marker.longitude.toFixed(6);
  return `
    <div style="min-width:180px;padding:4px 2px">
      <p style="margin:0 0 5px;font-size:13px;font-weight:600;color:#1a1a1a;line-height:1.4">${marker.label}</p>
      <p style="margin:0 0 9px;font-size:11.5px;color:#666;font-family:monospace">${lat}, ${lng}</p>
      <button
        data-copy-coords="${lat},${lng}"
        data-pin-index="${index}"
        style="width:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 8px;font-size:11.5px;font-weight:500;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer"
        title="Copy coordinates"
      >
        Copy coordinates
      </button>
    </div>`;
}

// ─── Shared map controls bar (style toggle + back-to-overview + fullscreen) ──

function MapControls({
  mapStyle,
  onStyleChange,
  isFullscreen,
  onFullscreenToggle,
  focusedIndex,
  onResetFocus,
  markerCount,
}: {
  mapStyle: MapStyle;
  onStyleChange: (s: MapStyle) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  focusedIndex: number | null;
  onResetFocus: () => void;
  markerCount: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end gap-2">
      {/* Style toggle */}
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-neutral-200/80 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => onStyleChange("satellite")}
          aria-pressed={mapStyle === "satellite"}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
            mapStyle === "satellite"
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => onStyleChange("street")}
          aria-pressed={mapStyle === "street"}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
            mapStyle === "street"
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          Street
        </button>
      </div>

      {/* Back to overview (multi-pin, focused state) */}
      {markerCount > 1 && focusedIndex !== null ? (
        <button
          type="button"
          onClick={onResetFocus}
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-neutral-100"
        >
          <List size={13} weight="bold" aria-hidden />
          All sites
        </button>
      ) : null}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Fullscreen toggle */}
      <button
        type="button"
        onClick={onFullscreenToggle}
        aria-label={isFullscreen ? "Exit fullscreen" : "Expand map"}
        className="pointer-events-auto flex items-center justify-center rounded-lg border border-neutral-200/80 bg-white/90 p-1.5 text-neutral-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-neutral-100"
      >
        {isFullscreen ? (
          <ArrowsIn size={14} weight="bold" aria-hidden />
        ) : (
          <ArrowsOut size={14} weight="bold" aria-hidden />
        )}
      </button>
    </div>
  );
}

// ─── Core map hook ─────────────────────────────────────────────────────────────
// Initialises a bkoi-gl Map instance and returns imperative handles.
// The map is recreated only when `containerRef` gets a new element.

function useMapInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  markers: LocationMapMarker[],
  initialStyle: MapStyle,
  apiKey: string,
  /** Ref to the callback to fire when the user clicks a map pin. The ref
   *  avoids the hook needing to re-run when the callback identity changes. */
  onMarkerClickRef: React.RefObject<((index: number) => void) | null>,
) {
  const mapRef = useRef<import("bkoi-gl").Map | null>(null);
  const bkoiMarkersRef = useRef<import("bkoi-gl").Marker[]>([]);
  const popupsRef = useRef<import("bkoi-gl").Popup[]>([]);

  // Set up map on mount; tear down on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: import("bkoi-gl").Map | undefined;

    (async () => {
      const bkoi = await import("bkoi-gl");
      if (cancelled || !containerRef.current) return;

      const isMulti = markers.length > 1;
      const center: [number, number] = isMulti
        ? [
            markers.reduce((s, m) => s + m.longitude, 0) / markers.length,
            markers.reduce((s, m) => s + m.latitude, 0) / markers.length,
          ]
        : [markers[0]!.longitude, markers[0]!.latitude];

      map = new bkoi.Map({
        container: containerRef.current,
        style: styleUrl(initialStyle, apiKey),
        center,
        zoom: isMulti ? 10 : CAMPUS_ZOOM,
        maxZoom: MAX_ZOOM[initialStyle],
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new bkoi.NavigationControl({ showCompass: false }),
        "top-right",
      );

      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        // Add HTML pins
        const newMarkers: import("bkoi-gl").Marker[] = [];
        const newPopups: import("bkoi-gl").Popup[] = [];

        for (let i = 0; i < markers.length; i++) {
          const m = markers[i]!;
          const popup = new bkoi.Popup({
            offset: 20,
            closeButton: true,
            maxWidth: "260px",
          }).setHTML(makePinPopupHtml(m, i));

          // Wire up the copy button inside the popup after it opens
          popup.on("open", () => {
            const el = popup.getElement();
            if (!el) return;
            const btn = el.querySelector<HTMLButtonElement>(
              `[data-copy-coords]`,
            );
            if (btn) {
              btn.onclick = () => {
                const coords = btn.dataset.copyCoords ?? "";
                void navigator.clipboard.writeText(coords);
                btn.textContent = "Copied!";
                setTimeout(() => (btn.textContent = "Copy"), 1800);
              };
            }
          });

          const marker = new bkoi.Marker({ color: "#1f4d3a" })
            .setLngLat([m.longitude, m.latitude])
            .setPopup(popup)
            .addTo(map!);

          // Notify the parent (address list) when a pin is clicked.
          marker.getElement().addEventListener("click", () => {
            onMarkerClickRef.current?.(i);
          });

          newMarkers.push(marker);
          newPopups.push(popup);
        }

        bkoiMarkersRef.current = newMarkers;
        popupsRef.current = newPopups;

        // fitBounds for overview (multi-pin)
        if (isMulti) {
          map!.fitBounds(markerBounds(markers), {
            padding: OVERVIEW_PADDING,
            maxZoom: OVERVIEW_MAX_ZOOM,
            duration: 0,
          });
        }
      });
    })();

    return () => {
      cancelled = true;
      bkoiMarkersRef.current = [];
      popupsRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // Intentionally run only on mount — markers are stable per server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStyle = useCallback(
    (nextStyle: MapStyle) => {
      const map = mapRef.current;
      if (!map) return;
      map.setStyle(styleUrl(nextStyle, apiKey));
      map.setMaxZoom(MAX_ZOOM[nextStyle]);
    },
    [apiKey],
  );

  const flyToMarker = useCallback((index: number) => {
    const map = mapRef.current;
    const m = markers[index];
    if (!map || !m) return;
    map.flyTo({
      center: [m.longitude, m.latitude],
      zoom: CAMPUS_ZOOM,
      duration: 600,
    });
    // Open popup for the focused marker
    setTimeout(() => {
      popupsRef.current[index]?.addTo(map);
    }, 650);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetToOverview = useCallback(() => {
    const map = mapRef.current;
    if (!map || markers.length < 2) return;
    // Close any open popups
    for (const p of popupsRef.current) p.remove();
    map.fitBounds(markerBounds(markers), {
      padding: OVERVIEW_PADDING,
      maxZoom: OVERVIEW_MAX_ZOOM,
      duration: 600,
    });
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  // Transient marker — lives outside the stable marker array so it can be
  // added/replaced/removed imperatively after mount.
  const transientMarkerRef = useRef<import("bkoi-gl").Marker | null>(null);
  const transientPopupRef = useRef<import("bkoi-gl").Popup | null>(null);

  const setTransientMarker = useCallback(
    (m: LocationMapMarker | null) => {
      // Remove any existing transient pin.
      transientPopupRef.current?.remove();
      transientMarkerRef.current?.remove();
      transientMarkerRef.current = null;
      transientPopupRef.current = null;

      const map = mapRef.current;
      if (!m || !map) return;

      (async () => {
        const bkoi = await import("bkoi-gl");
        if (!mapRef.current) return;

        const lat = m.latitude.toFixed(6);
        const lng = m.longitude.toFixed(6);
        const popupHtml = `
          <div style="min-width:180px;padding:4px 2px">
            <p style="margin:0 0 5px;font-size:12px;font-weight:600;color:#1a1a1a;line-height:1.4">${m.label}</p>
            <p style="margin:0 0 4px;font-size:11px;color:#888;font-family:monospace">${lat}, ${lng}</p>
            <p style="margin:0;font-size:10.5px;color:#aaa;font-style:italic">Best-effort locate — not registry-verified</p>
          </div>`;

        const popup = new bkoi.Popup({
          offset: 20,
          closeButton: true,
          maxWidth: "240px",
        }).setHTML(popupHtml);

        const marker = new bkoi.Marker({ color: TRANSIENT_PIN_COLOR })
          .setLngLat([m.longitude, m.latitude])
          .setPopup(popup)
          .addTo(mapRef.current);

        transientMarkerRef.current = marker;
        transientPopupRef.current = popup;

        mapRef.current.flyTo({
          center: [m.longitude, m.latitude],
          zoom: CAMPUS_ZOOM,
          duration: 600,
        });
        setTimeout(() => popup.addTo(mapRef.current!), 650);
      })();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { setStyle, flyToMarker, resetToOverview, resize, setTransientMarker };
}

// ─── Map widget (the actual rendered map + overlaid controls) ─────────────────

interface MapWidgetProps {
  markers: LocationMapMarker[];
  /** Externally controlled focused-marker index (for list ↔ map sync). */
  focusedIndex: number | null;
  onFocusChange: (index: number | null) => void;
  /** Current map style — drives setStyle calls when it changes. */
  mapStyle: MapStyle;
  /** True while the fullscreen overlay is open — triggers a map resize. */
  isFullscreen: boolean;
  /** Optional live-located transient pin (best-effort Autocomplete result).
   *  Displayed in a lighter sage color to distinguish from ETL-verified pins. */
  transientMarker?: LocationMapMarker | null;
  className?: string;
  ariaLabel: string;
}

function MapWidget({
  markers,
  focusedIndex,
  onFocusChange,
  mapStyle,
  isFullscreen,
  transientMarker,
  className,
  ariaLabel,
}: MapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable ref so the map init closure always calls the latest onFocusChange
  // without needing to re-run the map setup effect.
  const onFocusChangeRef = useRef<((index: number) => void) | null>(null);
  onFocusChangeRef.current = onFocusChange;

  const { setStyle, flyToMarker, resetToOverview, resize, setTransientMarker } = useMapInstance(
    containerRef,
    markers,
    mapStyle,
    process.env.NEXT_PUBLIC_BARIKOI_API_KEY ?? "",
    onFocusChangeRef,
  );

  // When style changes externally, update the map.
  const prevStyleRef = useRef<MapStyle>(mapStyle);
  useEffect(() => {
    if (mapStyle !== prevStyleRef.current) {
      setStyle(mapStyle);
      prevStyleRef.current = mapStyle;
    }
  }, [mapStyle, setStyle]);

  // When focusedIndex changes externally, fly to that marker or reset overview.
  const prevFocusRef = useRef<number | null>(focusedIndex);
  useEffect(() => {
    if (focusedIndex === prevFocusRef.current) return;
    prevFocusRef.current = focusedIndex;
    if (focusedIndex === null) {
      resetToOverview();
    } else {
      flyToMarker(focusedIndex);
    }
  }, [focusedIndex, flyToMarker, resetToOverview]);

  // Resize map when fullscreen state changes.
  useEffect(() => {
    // Small delay so the CSS transition finishes before resize
    const t = setTimeout(() => resize(), 120);
    return () => clearTimeout(t);
  }, [isFullscreen, resize]);

  // Sync transient (live-located) pin to the imperative map handle.
  useEffect(() => {
    setTransientMarker(transientMarker ?? null);
  }, [transientMarker, setTransientMarker]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50",
        isFullscreen ? "h-full" : "h-[280px] sm:h-[340px]",
        className,
      )}
    />
  );
}

// ─── Fullscreen shell ────────────────────────────────────────────────────────

function FullscreenShell({
  isFullscreen,
  onClose,
  children,
}: {
  isFullscreen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, onClose]);

  if (!isFullscreen) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen map"
    >
      {/* Close button (top-right of overlay) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen map"
        className="absolute right-5 top-5 z-10 flex items-center justify-center rounded-lg border border-neutral-200/50 bg-white/90 p-2 text-neutral-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
      >
        <ArrowsIn size={16} weight="bold" aria-hidden />
      </button>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface LocationsMapProps {
  markers: LocationMapMarker[];
  /** Controlled focused-marker index from a parent (for list ↔ map sync).
   *  When undefined the component manages its own focus state. */
  focusedIndex?: number | null;
  onFocusChange?: (index: number | null) => void;
  /** Optional transient pin for a live-located (Autocomplete) address. */
  transientMarker?: LocationMapMarker | null;
}

export function LocationsMap({
  markers,
  focusedIndex: externalFocusedIndex,
  onFocusChange: externalOnFocusChange,
  transientMarker,
}: LocationsMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
  if (!apiKey || (markers.length === 0 && !transientMarker)) return null;

  return (
    <LocationsMapInner
      markers={markers}
      externalFocusedIndex={externalFocusedIndex}
      externalOnFocusChange={externalOnFocusChange}
      transientMarker={transientMarker}
    />
  );
}

// Inner component so hooks run unconditionally after the guard above.
function LocationsMapInner({
  markers,
  externalFocusedIndex,
  externalOnFocusChange,
  transientMarker,
}: {
  markers: LocationMapMarker[];
  externalFocusedIndex?: number | null;
  externalOnFocusChange?: (index: number | null) => void;
  transientMarker?: LocationMapMarker | null;
}) {
  const [internalFocusedIndex, setInternalFocusedIndex] = useState<
    number | null
  >(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isControlled = externalFocusedIndex !== undefined;
  const focusedIndex = isControlled ? externalFocusedIndex! : internalFocusedIndex;

  const handleFocusChange = useCallback(
    (index: number | null) => {
      if (isControlled) {
        externalOnFocusChange?.(index);
      } else {
        setInternalFocusedIndex(index);
      }
    },
    [isControlled, externalOnFocusChange],
  );

  const handleFullscreenToggle = useCallback(
    () => setIsFullscreen((v) => !v),
    [],
  );

  const isMulti = markers.length > 1;
  const ariaLabel =
    isMulti
      ? `Map showing ${markers.length} supplier locations`
      : `Satellite map showing supplier location: ${markers[0]!.label}`;

  const controls = (
    <MapControls
      mapStyle={mapStyle}
      onStyleChange={setMapStyle}
      isFullscreen={isFullscreen}
      onFullscreenToggle={handleFullscreenToggle}
      focusedIndex={focusedIndex}
      onResetFocus={() => handleFocusChange(null)}
      markerCount={markers.length}
    />
  );

  const widget = (
    <div className="relative">
      <MapWidget
        markers={markers}
        focusedIndex={focusedIndex}
        onFocusChange={handleFocusChange}
        mapStyle={mapStyle}
        isFullscreen={isFullscreen}
        transientMarker={transientMarker}
        ariaLabel={ariaLabel}
      />
      {controls}
    </div>
  );

  return (
    <FullscreenShell
      isFullscreen={isFullscreen}
      onClose={() => setIsFullscreen(false)}
    >
      {widget}
    </FullscreenShell>
  );
}
