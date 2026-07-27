"use client";

// Supplier profile Locations map — Barikoi GL (bkoi-gl / MapLibre).
//
// REZ-29 established the baseline: satellite ↔ street toggle, campus-level
// zoom, one overview map for multi-site suppliers, address-list ↔ map sync.
// REZ-30 turns it into an inspection surface:
//
//   • Tall in-page map. Fullscreen is deliberately gone — an overlay that hid
//     the address list, provenance chips and the rest of the profile made the
//     map harder to reason about, not easier.
//   • Pins carry meaning: address kind by colour + shape, a number badge, and
//     a lighter sage treatment for anything that is not a cached, confident
//     geocode.
//   • Near-duplicate pins fan out instead of stacking, so a campus with a
//     factory and a registered office at the same gate stays clickable.
//   • Straight-line distances between sites and to a curated landmark set,
//     both explicitly approximate.
//   • Optional layer of other published SourceBD sites nearby — our own
//     catalog, lazily fetched, off by default.
//   • Scale bar, readable attribution, GeoJSON export, ?site= deep links
//     (driven by the parent), and arrow-key site cycling.
//
// Cost discipline: this component makes zero geocoding calls. Coordinates
// arrive already resolved from the `address_geocodes` cache; only map tiles
// and the optional nearby-sites API are fetched at runtime.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Airplane,
  Anchor,
  ArrowLeft,
  ArrowRight,
  Buildings,
  DownloadSimple,
  Factory,
  FrameCorners,
  Info,
  RoadHorizon,
  UsersThree,
} from "@phosphor-icons/react";

import { nearestLandmarks, type LandmarkKind } from "@/lib/bd-landmarks";
import {
  clusterCoincident,
  formatDistanceKm,
  metresPerPixel,
  nearestOtherIndex,
  spiderfyOffset,
  widestSpanKm,
} from "@/lib/geo";
import type { NearbySupplierSite } from "@/lib/nearby-suppliers";
import { cn } from "@/lib/utils";

import "bkoi-gl/dist/style/bkoi-gl.css";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LocationKind = "factory" | "registered" | "mailing" | "other";

export type MapStyle = "satellite" | "street";

export type LocationMapMarker = {
  latitude: number;
  longitude: number;
  label: string;
  /** Address kind this pin represents — drives colour, shape and legend. */
  kind?: LocationKind;
  /** Rupantor confidence from the geocode cache, when the row has one. */
  confidencePct?: number | null;
  /** Rupantor address_status from the geocode cache ("full_address", "area"…). */
  addressStatus?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLE_URLS: Record<MapStyle, string> = {
  satellite: "https://map.barikoi.com/styles/barikoi_satellite/style.json",
  street: "https://map.barikoi.com/styles/osm_barikoi_v1/style.json",
};

/** Credit lines required by each basemap. The satellite style is Barikoi's, but
 *  its imagery is Stadia's Airbus/CNES/PlanetObserver stack — crediting only
 *  Barikoi and OSM while showing that imagery would be plainly wrong, so the
 *  strip follows whichever style is live. */
const MAP_ATTRIBUTION: Record<MapStyle, string> = {
  street: "Map data © Barikoi, OpenStreetMap contributors",
  satellite:
    "Imagery © Stadia Maps, CNES / Airbus DS, PlanetObserver · Map data © Barikoi, OpenStreetMap contributors",
};

const CAMPUS_ZOOM = 16;
const MAX_ZOOM: Record<MapStyle, number> = { satellite: 19, street: 20 };
const OVERVIEW_PADDING = 64;
const OVERVIEW_MAX_ZOOM = 15;

/** Below this, Rupantor matched the locality rather than the premises. Pins
 *  are still useful for orientation but must not read as building-level. */
const CONFIDENT_PCT = 70;

/** Pins within this distance of each other would overlap on screen. */
const COINCIDENT_KM = 0.06;

const NEARBY_RADIUS_KM = 6;

/** Only used to give the canvas a valid centre when the profile has no cached
 *  pin at all and the map exists purely to host a transient locate. */
const DHAKA_FALLBACK = { latitude: 23.7806, longitude: 90.4074 };

// Two independent visual channels, so neither has to carry everything:
//   • WHICH KIND of address → head shape (round vs square) plus fill tone.
//     Shape is what keeps the four kinds separable without relying on colour
//     vision; the number badge is what ties a pin to its address-list row.
//   • HOW PRECISE the geocode is → filled vs hollow head (see pinSvg).
// Every pin is the same full-size teardrop: on many profiles the factory sits
// in the "Other addresses" bucket, and the buyer's most important pin must
// never be the faintest mark on the map.
const KIND_STYLE: Record<
  LocationKind,
  {
    label: string;
    color: string;
    /** Numeral ink for a filled head — light fills need dark numerals. */
    badgeColor: string;
    /** Ring and numeral ink for a hollow head, i.e. this kind's colour pushed
     *  dark enough to stay readable against a white fill. */
    inkColor: string;
    head: "round" | "square";
  }
> = {
  factory: {
    label: "Factory",
    color: "#1f4d3a",
    badgeColor: "#ffffff",
    inkColor: "#1f4d3a",
    head: "round",
  },
  registered: {
    label: "Registered office",
    color: "#3f3f46",
    badgeColor: "#ffffff",
    inkColor: "#3f3f46",
    head: "round",
  },
  mailing: {
    label: "Mailing address",
    color: "#a1a1aa",
    badgeColor: "#27272a",
    inkColor: "#52525b",
    head: "square",
  },
  other: {
    label: "Other address",
    color: "#71717a",
    badgeColor: "#ffffff",
    inkColor: "#52525b",
    head: "square",
  },
};

/** Lighter sage — reserved for a live best-effort locate, which is not in the
 *  geocode cache at all and so is a different class of thing from a pin whose
 *  cached geocode merely resolved to an area. */
const APPROXIMATE_COLOR = "#6b9e83";
const NEARBY_COLOR = "#2d6a4f";

const LANDMARK_ICON: Record<LandmarkKind, React.ReactNode> = {
  seaport: <Anchor size={12} weight="bold" aria-hidden />,
  landport: <RoadHorizon size={12} weight="bold" aria-hidden />,
  airport: <Airplane size={12} weight="bold" aria-hidden />,
  epz: <Factory size={12} weight="bold" aria-hidden />,
  logistics: <RoadHorizon size={12} weight="bold" aria-hidden />,
  cluster: <Buildings size={12} weight="bold" aria-hidden />,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function styleUrl(style: MapStyle, apiKey: string) {
  return `${MAP_STYLE_URLS[style]}?key=${encodeURIComponent(apiKey)}`;
}

function markerBounds(
  markers: readonly LocationMapMarker[],
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

function kindOf(marker: LocationMapMarker): LocationKind {
  return marker.kind ?? "other";
}

/** A pin is "approximate" when the cached geocode resolved to something coarser
 *  than the premises. Rupantor's confidence score is the only usable signal
 *  here: `address_status` is "incomplete" on every cached row, so keying the
 *  cue off it would flag all pins and say nothing. Rows with no confidence
 *  recorded predate confidence capture and are left unflagged rather than
 *  accused. */
function isApproximate(marker: LocationMapMarker): boolean {
  return marker.confidencePct != null && marker.confidencePct < CONFIDENT_PCT;
}

/** Compact locality for the site switcher: the tail of the address minus
 *  country and postcode. "Plot 5, Konabari, Gazipur" → "Konabari, Gazipur". */
function shortSiteLabel(label: string): string {
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^bangladesh$/i.test(part))
    .filter((part) => !/^\d{4}$/.test(part));
  if (parts.length === 0) return label;
  const text = parts.slice(-2).join(", ");
  return text.length > 34 ? `${text.slice(0, 33)}…` : text;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Pin elements ────────────────────────────────────────────────────────────
// Built as DOM rather than React portals so bkoi-gl owns the marker lifecycle.
// MapLibre writes `transform: translate(...)` onto the root element it is
// given, so every visual transform of ours lives on an inner wrapper.

type PinHead = "round" | "square";

/** Teardrop with a circular head; tip sits on the coordinate. */
const ROUND_HEAD_PATH =
  "M12 1.2c-6 0-10.8 4.9-10.8 10.8 0 7.4 9.1 17.1 10.1 18.2a.93.93 0 0 0 1.4 0c1-1.1 10.1-10.8 10.1-18.2C22.8 6.1 18 1.2 12 1.2z";
/** Same footprint, squared head — the shape channel for admin-only addresses. */
const SQUARE_HEAD_PATH =
  "M5.4 1.4H18.6A4 4 0 0 1 22.6 5.4V18A4 4 0 0 1 18.6 22H15.6L12 30.2 8.4 22H5.4A4 4 0 0 1 1.4 18V5.4A4 4 0 0 1 5.4 1.4Z";

/**
 * The head fill carries the geocode-confidence cue: a premises-level match is
 * filled in the kind's colour, an area-level one is hollow — the same
 * filled/outline idiom a map reader already expects for "exact vs indicative".
 * It is deliberately not a dashed outline: at pin size the dashes cut across
 * the site numeral and cost more legibility than they buy.
 *
 * Both variants sit on a dark outer stroke, so the pin holds its edge over
 * satellite imagery as well as over pale street tiles.
 */
function pinSvg(
  head: PinHead,
  color: string,
  badge: string | null,
  badgeColor: string,
  inkColor: string,
  approximate: boolean,
): string {
  const path = head === "round" ? ROUND_HEAD_PATH : SQUARE_HEAD_PATH;
  const badgeY = head === "round" ? 16.6 : 16.1;
  const fill = approximate ? "#ffffff" : color;
  const ring = approximate ? inkColor : "#ffffff";
  const ringWidth = approximate ? 2.6 : 2;
  const numeralInk = approximate ? inkColor : badgeColor;
  return `
    <svg width="29" height="38" viewBox="0 0 24 32" aria-hidden="true">
      <path d="${path}" fill="${fill}" stroke="rgba(15,15,20,0.4)" stroke-width="3.4" />
      <path d="${path}" fill="none" stroke="${ring}" stroke-width="${ringWidth}" />
      ${
        badge
          ? `<text x="12" y="${badgeY}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" font-weight="700" fill="${numeralInk}">${badge}</text>`
          : ""
      }
    </svg>`;
}

function buildPin(opts: {
  head: PinHead;
  color: string;
  badge: string | null;
  badgeColor: string;
  inkColor: string;
  approximate: boolean;
  title: string;
}): { root: HTMLDivElement; inner: HTMLDivElement } {
  const root = document.createElement("div");
  root.style.cursor = "pointer";
  root.title = opts.title;

  const inner = document.createElement("div");
  inner.style.transformOrigin = "bottom center";
  inner.style.transition = "transform 180ms cubic-bezier(0.22,0.61,0.36,1)";
  inner.style.filter = "drop-shadow(0 2px 3px rgba(15,15,20,0.42))";
  inner.style.lineHeight = "0";
  inner.innerHTML = pinSvg(
    opts.head,
    opts.color,
    opts.badge,
    opts.badgeColor,
    opts.inkColor,
    opts.approximate,
  );

  root.appendChild(inner);
  return { root, inner };
}

function setPinSelected(
  root: HTMLElement,
  inner: HTMLElement,
  selected: boolean,
) {
  inner.style.transform = selected ? "scale(1.28)" : "scale(1)";
  inner.style.filter = selected
    ? "drop-shadow(0 4px 7px rgba(15,15,20,0.5))"
    : "drop-shadow(0 2px 3px rgba(15,15,20,0.42))";
  root.style.zIndex = selected ? "5" : "1";
}

// ─── Popup content ───────────────────────────────────────────────────────────

function pinPopupHtml(marker: LocationMapMarker, badge: string | null) {
  const lat = marker.latitude.toFixed(6);
  const lng = marker.longitude.toFixed(6);
  const kind = KIND_STYLE[kindOf(marker)];
  const approximate = isApproximate(marker);
  const confidence = approximate
    ? "Approximate locate — matched to the area, not the building"
    : "Geocoded from the registry address text";

  return `
    <div style="min-width:196px;max-width:250px;padding:3px 2px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${kind.color}">
        ${badge ? `Site ${escapeHtml(badge)} · ` : ""}${escapeHtml(kind.label)}
      </p>
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#171717;line-height:1.4">${escapeHtml(marker.label)}</p>
      <p style="margin:0 0 4px;font-size:11.5px;color:#737373;font-family:ui-monospace,SFMono-Regular,monospace">${lat}, ${lng}</p>
      <p style="margin:0 0 9px;font-size:10.5px;color:#a3a3a3;line-height:1.45">${confidence}</p>
      <button
        data-copy-coords="${lat},${lng}"
        style="width:100%;padding:5px 8px;font-size:11.5px;font-weight:600;color:#404040;background:#fafaf9;border:1px solid #e5e5e5;border-radius:6px;cursor:pointer"
      >Copy coordinates</button>
    </div>`;
}

function nearbyPopupHtml(site: NearbySupplierSite, profileBasePath: string) {
  const kindLabel =
    site.entityType === "buying_house" ? "Buying house" : "Factory";
  return `
    <div style="min-width:186px;max-width:240px;padding:3px 2px">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${NEARBY_COLOR}">
        ${escapeHtml(kindLabel)} · ${escapeHtml(formatDistanceKm(site.distanceKm))} away
      </p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#171717;line-height:1.4">${escapeHtml(site.companyName)}</p>
      <a
        href="${escapeHtml(profileBasePath)}/${encodeURIComponent(site.slug)}"
        style="display:block;padding:5px 8px;font-size:11.5px;font-weight:600;color:#1f4d3a;background:#ecf3ee;border-radius:6px;text-align:center;text-decoration:none"
      >View verified profile</a>
    </div>`;
}

// ─── Map instance hook ────────────────────────────────────────────────────────

type ViewState = { zoom: number; latitude: number };

function useMapInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  markers: readonly LocationMapMarker[],
  initialStyle: MapStyle,
  apiKey: string,
  onMarkerClickRef: React.RefObject<((index: number) => void) | null>,
  onViewChangeRef: React.RefObject<((view: ViewState) => void) | null>,
) {
  const mapRef = useRef<import("bkoi-gl").Map | null>(null);
  const popupsRef = useRef<import("bkoi-gl").Popup[]>([]);
  const pinElementsRef = useRef<Array<{ root: HTMLElement; inner: HTMLElement }>>(
    [],
  );

  // Pixel offsets that keep near-coincident pins individually clickable.
  const offsets = useMemo(() => {
    const clusters = clusterCoincident(markers, COINCIDENT_KM);
    return clusters.map((c) =>
      spiderfyOffset(c.positionInCluster, c.clusterSize),
    );
  }, [markers]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: import("bkoi-gl").Map | undefined;

    (async () => {
      const bkoi = await import("bkoi-gl");
      if (cancelled || !containerRef.current) return;

      const isMulti = markers.length > 1;
      // With no cached pins the map still mounts to host a best-effort
      // transient locate, which flies to its own position on arrival — so any
      // in-country centre will do until then.
      const first = markers[0];
      const center: [number, number] = isMulti
        ? [
            markers.reduce((s, m) => s + m.longitude, 0) / markers.length,
            markers.reduce((s, m) => s + m.latitude, 0) / markers.length,
          ]
        : first
          ? [first.longitude, first.latitude]
          : [DHAKA_FALLBACK.longitude, DHAKA_FALLBACK.latitude];

      map = new bkoi.Map({
        container: containerRef.current,
        style: styleUrl(initialStyle, apiKey),
        center,
        zoom: isMulti ? 10 : CAMPUS_ZOOM,
        maxZoom: MAX_ZOOM[initialStyle],
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        // Arrow keys belong to the site switcher, not to map panning.
        keyboard: false,
        attributionControl: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new bkoi.NavigationControl({ showCompass: false }),
        "top-right",
      );

      mapRef.current = map;

      const publishView = () => {
        const current = mapRef.current;
        if (!current) return;
        onViewChangeRef.current?.({
          zoom: current.getZoom(),
          latitude: current.getCenter().lat,
        });
      };
      map.on("move", publishView);
      map.on("zoom", publishView);

      map.on("load", () => {
        if (cancelled) return;
        publishView();

        const newPopups: import("bkoi-gl").Popup[] = [];
        const newPins: Array<{ root: HTMLElement; inner: HTMLElement }> = [];

        for (let i = 0; i < markers.length; i++) {
          const m = markers[i]!;
          const badge = markers.length > 1 ? String(i + 1) : null;
          const style = KIND_STYLE[kindOf(m)];
          const approximate = isApproximate(m);

          const popup = new bkoi.Popup({
            offset: 34,
            closeButton: true,
            maxWidth: "270px",
          }).setHTML(pinPopupHtml(m, badge));

          popup.on("open", () => {
            const el = popup.getElement();
            const btn = el?.querySelector<HTMLButtonElement>("[data-copy-coords]");
            if (!btn) return;
            btn.onclick = () => {
              void navigator.clipboard.writeText(btn.dataset.copyCoords ?? "");
              btn.textContent = "Copied";
              setTimeout(() => {
                btn.textContent = "Copy coordinates";
              }, 1800);
            };
          });

          const { root, inner } = buildPin({
            head: style.head,
            color: style.color,
            badge,
            badgeColor: style.badgeColor,
            inkColor: style.inkColor,
            approximate,
            title: m.label,
          });

          new bkoi.Marker({
            element: root,
            anchor: "bottom",
            offset: offsets[i] ?? [0, 0],
          })
            .setLngLat([m.longitude, m.latitude])
            .setPopup(popup)
            .addTo(map!);

          root.addEventListener("click", () => {
            onMarkerClickRef.current?.(i);
          });

          newPopups.push(popup);
          newPins.push({ root, inner });
        }

        popupsRef.current = newPopups;
        pinElementsRef.current = newPins;

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
      popupsRef.current = [];
      pinElementsRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // Intentionally mount-only — markers are stable per server render.
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
    setTimeout(() => popupsRef.current[index]?.addTo(map), 650);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetToOverview = useCallback(() => {
    const map = mapRef.current;
    if (!map || markers.length < 2) return;
    for (const p of popupsRef.current) p.remove();
    map.fitBounds(markerBounds(markers), {
      padding: OVERVIEW_PADDING,
      maxZoom: OVERVIEW_MAX_ZOOM,
      duration: 600,
    });
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelectedPin = useCallback((index: number | null) => {
    pinElementsRef.current.forEach((pin, i) => {
      setPinSelected(pin.root, pin.inner, i === index);
    });
  }, []);

  const resize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  // Transient pin — a best-effort live locate for an address with no cache
  // row. Lives outside the stable marker array so it can be swapped freely.
  const transientRef = useRef<{
    marker: import("bkoi-gl").Marker;
    popup: import("bkoi-gl").Popup;
  } | null>(null);

  const setTransientMarker = useCallback((m: LocationMapMarker | null) => {
    transientRef.current?.popup.remove();
    transientRef.current?.marker.remove();
    transientRef.current = null;

    if (!m || !mapRef.current) return;

    (async () => {
      const bkoi = await import("bkoi-gl");
      const map = mapRef.current;
      if (!map) return;

      const lat = m.latitude.toFixed(6);
      const lng = m.longitude.toFixed(6);
      const popup = new bkoi.Popup({
        offset: 34,
        closeButton: true,
        maxWidth: "250px",
      }).setHTML(`
        <div style="min-width:186px;padding:3px 2px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${APPROXIMATE_COLOR}">Best-effort locate</p>
          <p style="margin:0 0 6px;font-size:12.5px;font-weight:600;color:#171717;line-height:1.4">${escapeHtml(m.label)}</p>
          <p style="margin:0 0 4px;font-size:11px;color:#737373;font-family:ui-monospace,SFMono-Regular,monospace">${lat}, ${lng}</p>
          <p style="margin:0;font-size:10.5px;color:#a3a3a3;line-height:1.45">Not registry-verified and not in our geocode cache</p>
        </div>`);

      // Hollow, like any other approximate pin, and unnumbered — a live locate
      // is not one of the profile's numbered registry sites.
      const { root } = buildPin({
        head: "round",
        color: APPROXIMATE_COLOR,
        badge: null,
        badgeColor: "#ffffff",
        inkColor: APPROXIMATE_COLOR,
        approximate: true,
        title: m.label,
      });

      const marker = new bkoi.Marker({ element: root, anchor: "bottom" })
        .setLngLat([m.longitude, m.latitude])
        .setPopup(popup)
        .addTo(map);

      transientRef.current = { marker, popup };
      map.flyTo({
        center: [m.longitude, m.latitude],
        zoom: CAMPUS_ZOOM,
        duration: 600,
      });
      setTimeout(() => popup.addTo(map), 650);
    })();
  }, []);

  // Nearby published sites — a secondary layer, replaced wholesale on toggle.
  const nearbyRef = useRef<import("bkoi-gl").Marker[]>([]);

  const setNearbySites = useCallback(
    (sites: readonly NearbySupplierSite[], profileBasePath: string) => {
      for (const marker of nearbyRef.current) marker.remove();
      nearbyRef.current = [];
      if (sites.length === 0 || !mapRef.current) return;

      // Neighbours in a shared industrial estate are routinely geocoded to the
      // exact same point, which would stack a dozen dots into one. Fan them
      // out the same way the profile's own pins are fanned out.
      const nearbyOffsets = clusterCoincident(sites, COINCIDENT_KM).map((c) =>
        spiderfyOffset(c.positionInCluster, c.clusterSize),
      );

      (async () => {
        const bkoi = await import("bkoi-gl");
        const map = mapRef.current;
        if (!map) return;
        for (const [index, site] of sites.entries()) {
          const root = document.createElement("div");
          root.style.cursor = "pointer";
          root.title = site.companyName;
          root.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="5.6" fill="#ffffff" stroke="${NEARBY_COLOR}" stroke-width="2.4" />
            </svg>`;
          root.style.filter = "drop-shadow(0 1px 2px rgba(15,15,20,0.4))";
          const marker = new bkoi.Marker({
            element: root,
            anchor: "center",
            offset: nearbyOffsets[index] ?? [0, 0],
          })
            .setLngLat([site.longitude, site.latitude])
            .setPopup(
              new bkoi.Popup({ offset: 14, closeButton: true, maxWidth: "260px" })
                .setHTML(nearbyPopupHtml(site, profileBasePath)),
            )
            .addTo(map);
          nearbyRef.current.push(marker);
        }
      })();
    },
    [],
  );

  return {
    setStyle,
    flyToMarker,
    resetToOverview,
    setSelectedPin,
    resize,
    setTransientMarker,
    setNearbySites,
  };
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarButton({
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-brand-forest text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        props.className,
      )}
    >
      {children}
    </button>
  );
}

function MapToolbar({
  markerCount,
  focusedIndex,
  focusedShortLabel,
  onStep,
  onResetFocus,
  mapStyle,
  onStyleChange,
  nearbyEnabled,
  nearbyPending,
  onNearbyToggle,
  onExport,
}: {
  markerCount: number;
  focusedIndex: number | null;
  focusedShortLabel: string | null;
  onStep: (delta: number) => void;
  onResetFocus: () => void;
  mapStyle: MapStyle;
  onStyleChange: (style: MapStyle) => void;
  nearbyEnabled: boolean;
  nearbyPending: boolean;
  onNearbyToggle: () => void;
  onExport: () => void;
}) {
  const isMulti = markerCount > 1;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-neutral-200 bg-[#fafaf9] px-2 py-1.5">
      {isMulti ? (
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => onStep(-1)}
            aria-label="Previous site"
            className="px-1.5"
          >
            <ArrowLeft size={13} weight="bold" aria-hidden />
          </ToolbarButton>
          <span className="min-w-0 px-0.5 text-[11.5px] font-semibold text-neutral-700">
            {focusedIndex === null ? (
              <>
                {markerCount} sites
                <span className="ml-1 font-normal text-neutral-400">
                  · overview
                </span>
              </>
            ) : (
              <>
                Site {focusedIndex + 1}
                <span className="text-neutral-400">/{markerCount}</span>
                {focusedShortLabel ? (
                  <span className="ml-1.5 hidden font-normal text-neutral-500 sm:inline">
                    {focusedShortLabel}
                  </span>
                ) : null}
              </>
            )}
          </span>
          <ToolbarButton
            onClick={() => onStep(1)}
            aria-label="Next site"
            className="px-1.5"
          >
            <ArrowRight size={13} weight="bold" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            onClick={onResetFocus}
            disabled={focusedIndex === null}
            aria-label="Show all sites"
          >
            <FrameCorners size={13} weight="bold" aria-hidden />
            <span className="hidden sm:inline">All sites</span>
          </ToolbarButton>
        </div>
      ) : (
        <span className="px-1 text-[11.5px] font-semibold text-neutral-600">
          {focusedShortLabel ?? "Single site"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <div
          className="flex items-center gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-neutral-200"
          role="group"
          aria-label="Map imagery"
        >
          <ToolbarButton
            onClick={() => onStyleChange("satellite")}
            active={mapStyle === "satellite"}
            aria-pressed={mapStyle === "satellite"}
            className="h-6"
          >
            Satellite
          </ToolbarButton>
          <ToolbarButton
            onClick={() => onStyleChange("street")}
            active={mapStyle === "street"}
            aria-pressed={mapStyle === "street"}
            className="h-6"
          >
            Street
          </ToolbarButton>
        </div>

        <ToolbarButton
          onClick={onNearbyToggle}
          active={nearbyEnabled}
          aria-pressed={nearbyEnabled}
          title="Show other published SourceBD sites within 6 km"
        >
          <UsersThree size={13} weight="bold" aria-hidden />
          <span className="hidden sm:inline">
            {nearbyPending ? "Loading…" : "Nearby"}
          </span>
        </ToolbarButton>

        <ToolbarButton
          onClick={onExport}
          title="Download these pins as GeoJSON"
          aria-label="Download pins as GeoJSON"
        >
          <DownloadSimple size={13} weight="bold" aria-hidden />
          <span className="hidden md:inline">GeoJSON</span>
        </ToolbarButton>
      </div>
    </div>
  );
}

// ─── Scale bar + attribution ─────────────────────────────────────────────────
// Updated imperatively on every map move: a React state update per frame would
// re-render the whole card while the buyer is panning.

const SCALE_TARGET_PX = 88;
const NICE_METRES = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000,
];

function ScaleBar({
  barRef,
  labelRef,
}: {
  barRef: React.RefObject<HTMLDivElement | null>;
  labelRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-white/85 px-2 py-1 backdrop-blur-sm">
      <div
        ref={barRef}
        className="h-[5px] border-x-2 border-b-2 border-neutral-600"
        style={{ width: `${SCALE_TARGET_PX}px` }}
      />
      <span
        ref={labelRef}
        className="font-mono text-[10px] font-semibold tabular-nums text-neutral-600"
      />
    </div>
  );
}

// ─── Insights strip (distances, landmarks, legend, attribution) ──────────────

function InsightsStrip({
  markers,
  focusedIndex,
  nearbyCount,
  nearbyEnabled,
  nearbyState,
  mapStyle,
}: {
  markers: readonly LocationMapMarker[];
  focusedIndex: number | null;
  nearbyCount: number;
  nearbyEnabled: boolean;
  nearbyState: "loading" | "failed" | "ready";
  mapStyle: MapStyle;
}) {
  const span = useMemo(() => widestSpanKm(markers), [markers]);
  const nearest = useMemo(
    () => (focusedIndex === null ? null : nearestOtherIndex(markers, focusedIndex)),
    [markers, focusedIndex],
  );
  const landmarkOrigin =
    focusedIndex !== null ? markers[focusedIndex] : (markers[0] ?? null);
  const landmarks = useMemo(
    () => (landmarkOrigin ? nearestLandmarks(landmarkOrigin) : []),
    [landmarkOrigin],
  );

  const kindsPresent = useMemo(() => {
    const present = new Set<LocationKind>();
    for (const m of markers) present.add(kindOf(m));
    return (Object.keys(KIND_STYLE) as LocationKind[]).filter((k) =>
      present.has(k),
    );
  }, [markers]);

  const anyApproximate = markers.some(isApproximate);

  // ── Distance sentence ──
  let distanceLine: React.ReactNode = null;
  if (nearest) {
    distanceLine = (
      <>
        <strong className="font-semibold text-neutral-800">
          {formatDistanceKm(nearest.km)}
        </strong>{" "}
        from the nearest other site
        <span className="text-neutral-400">
          {" "}
          (site {nearest.index + 1})
        </span>
      </>
    );
  } else if (span) {
    distanceLine =
      markers.length === 2 ? (
        <>
          Both sites are{" "}
          <strong className="font-semibold text-neutral-800">
            {formatDistanceKm(span.km)}
          </strong>{" "}
          apart
        </>
      ) : (
        <>
          {markers.length} sites spanning{" "}
          <strong className="font-semibold text-neutral-800">
            {formatDistanceKm(span.km)}
          </strong>{" "}
          at the widest
        </>
      );
  }

  return (
    <div className="mt-3 space-y-2.5">
      {distanceLine || landmarks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {distanceLine ? (
            <p className="text-[12.5px] leading-5 text-neutral-600">
              {distanceLine}
            </p>
          ) : null}
          {distanceLine && landmarks.length > 0 ? (
            <span className="hidden text-neutral-300 sm:inline" aria-hidden>
              ·
            </span>
          ) : null}
          {landmarks.map(({ landmark, km }) => (
            <span
              key={landmark.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-[3px] text-[11px] text-neutral-600"
            >
              <span className="text-neutral-400">
                {LANDMARK_ICON[landmark.kind]}
              </span>
              <span className="font-mono font-semibold tabular-nums text-neutral-700">
                {formatDistanceKm(km)}
              </span>
              <span className="text-neutral-500">to {landmark.name}</span>
            </span>
          ))}
        </div>
      ) : null}

      {nearbyEnabled ? (
        <p
          className="flex items-start gap-1.5 text-[11.5px] leading-5 text-neutral-500"
          aria-live="polite"
        >
          <span className="mt-[3px] size-2.5 shrink-0 rounded-full border-2 border-brand-forest-mid bg-white" />
          {nearbyState === "loading"
            ? `Looking for other published SourceBD sites within ${NEARBY_RADIUS_KM} km…`
            : nearbyState === "failed"
              ? "Nearby sites could not be loaded. Toggle the layer to try again."
              : nearbyCount > 0
                ? `${nearbyCount} other published SourceBD ${nearbyCount === 1 ? "site" : "sites"} within ${NEARBY_RADIUS_KM} km.`
                : `No other published SourceBD sites within ${NEARBY_RADIUS_KM} km of this view.`}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-neutral-100 pt-2.5">
        {kindsPresent.map((kind) => {
          const style = KIND_STYLE[kind];
          return (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500"
            >
              {/* Swatch mirrors the pin's head shape, not just its colour. */}
              <span
                className={cn(
                  "size-3 shrink-0 ring-1 ring-inset ring-white/70",
                  style.head === "round" ? "rounded-full" : "rounded-[3px]",
                )}
                style={{ background: style.color }}
                aria-hidden
              />
              {style.label}
            </span>
          );
        })}
        {anyApproximate ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span
              className="size-3 shrink-0 rounded-full border-2 border-neutral-500 bg-white"
              aria-hidden
            />
            Hollow pin = area-level locate
          </span>
        ) : null}

        <span className="ml-auto text-[10.5px] text-neutral-400">
          {MAP_ATTRIBUTION[mapStyle]}
        </span>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-[1.55] text-neutral-400">
        <Info size={13} weight="bold" className="mt-[2px] shrink-0" aria-hidden />
        Pins are geocoded from the registry address text, so they locate the
        premises approximately — not to survey accuracy. Distances are
        straight-line, and landmark chips are display context, not registry
        facts.
      </p>
    </div>
  );
}

// ─── Map widget ───────────────────────────────────────────────────────────────

function MapWidget({
  markers,
  focusedIndex,
  onFocusChange,
  mapStyle,
  transientMarker,
  nearbySites,
  nearbyEnabled,
  profileBasePath,
  ariaLabel,
}: {
  markers: readonly LocationMapMarker[];
  focusedIndex: number | null;
  onFocusChange: (index: number | null) => void;
  mapStyle: MapStyle;
  transientMarker?: LocationMapMarker | null;
  nearbySites: readonly NearbySupplierSite[];
  nearbyEnabled: boolean;
  profileBasePath: string;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleBarRef = useRef<HTMLDivElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);

  const onFocusChangeRef = useRef<((index: number) => void) | null>(null);
  onFocusChangeRef.current = onFocusChange;

  // Recompute the scale bar straight into the DOM on every map move.
  const onViewChangeRef = useRef<((view: ViewState) => void) | null>(null);
  onViewChangeRef.current = ({ zoom, latitude }) => {
    const bar = scaleBarRef.current;
    const label = scaleLabelRef.current;
    if (!bar || !label) return;
    const mpp = metresPerPixel(latitude, zoom);
    const targetMetres = mpp * SCALE_TARGET_PX;
    // Largest round distance that still fits the target width, so the bar
    // never overflows the corner of the map it sits in.
    let metres = NICE_METRES[0]!;
    for (const candidate of NICE_METRES) {
      if (candidate > targetMetres) break;
      metres = candidate;
    }
    bar.style.width = `${Math.round(metres / mpp)}px`;
    label.textContent =
      metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
  };

  const {
    setStyle,
    flyToMarker,
    resetToOverview,
    setSelectedPin,
    resize,
    setTransientMarker,
    setNearbySites,
  } = useMapInstance(
    containerRef,
    markers,
    mapStyle,
    process.env.NEXT_PUBLIC_BARIKOI_API_KEY ?? "",
    onFocusChangeRef,
    onViewChangeRef,
  );

  const prevStyleRef = useRef<MapStyle>(mapStyle);
  useEffect(() => {
    if (mapStyle !== prevStyleRef.current) {
      setStyle(mapStyle);
      prevStyleRef.current = mapStyle;
    }
  }, [mapStyle, setStyle]);

  const prevFocusRef = useRef<number | null>(focusedIndex);
  useEffect(() => {
    setSelectedPin(focusedIndex);
    if (focusedIndex === prevFocusRef.current) return;
    prevFocusRef.current = focusedIndex;
    if (focusedIndex === null) resetToOverview();
    else flyToMarker(focusedIndex);
  }, [focusedIndex, flyToMarker, resetToOverview, setSelectedPin]);

  useEffect(() => {
    setTransientMarker(transientMarker ?? null);
  }, [transientMarker, setTransientMarker]);

  useEffect(() => {
    setNearbySites(nearbyEnabled ? nearbySites : [], profileBasePath);
  }, [nearbyEnabled, nearbySites, profileBasePath, setNearbySites]);

  // The map is laid out inside a card that can reflow (tab switches, expanding
  // address groups); a one-shot resize on mount settles the canvas.
  useEffect(() => {
    const t = setTimeout(() => resize(), 120);
    return () => clearTimeout(t);
  }, [resize]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (markers.length < 2) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next =
        focusedIndex === null
          ? delta > 0
            ? 0
            : markers.length - 1
          : (focusedIndex + delta + markers.length) % markers.length;
      onFocusChange(next);
    } else if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      onFocusChange(null);
    }
  };

  return (
    <div
      tabIndex={0}
      role="group"
      aria-roledescription="Interactive map"
      aria-label={ariaLabel}
      aria-keyshortcuts="ArrowLeft ArrowRight Home"
      onKeyDown={handleKeyDown}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/45"
    >
      {/* No aria-hidden here: bkoi-gl injects its own labelled zoom controls
          inside this container, and hiding a focusable subtree from assistive
          tech while leaving it in the tab order is worse than not hiding it.
          The address list below is the accessible equivalent of the pins. */}
      <div
        ref={containerRef}
        className="h-[380px] w-full bg-neutral-100 sm:h-[470px] lg:h-[540px]"
      />
      <ScaleBar barRef={scaleBarRef} labelRef={scaleLabelRef} />
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface LocationsMapProps {
  markers: readonly LocationMapMarker[];
  /** Controlled focused-pin index from a parent (address-list sync). */
  focusedIndex?: number | null;
  onFocusChange?: (index: number | null) => void;
  /** Best-effort live locate for an address with no cache row. */
  transientMarker?: LocationMapMarker | null;
  /** Slug of the profile being viewed — excluded from the nearby layer and
   *  used as the GeoJSON filename. */
  supplierSlug?: string;
  /** `/suppliers` or `/app/suppliers`, so nearby popups link to the right shell. */
  profileBasePath?: string;
}

export function LocationsMap(props: LocationsMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
  if (!apiKey || (props.markers.length === 0 && !props.transientMarker)) {
    return null;
  }
  return <LocationsMapInner {...props} />;
}

function LocationsMapInner({
  markers,
  focusedIndex: externalFocusedIndex,
  onFocusChange: externalOnFocusChange,
  transientMarker,
  supplierSlug,
  profileBasePath = "/suppliers",
}: LocationsMapProps) {
  const [internalFocusedIndex, setInternalFocusedIndex] = useState<number | null>(
    null,
  );
  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [nearbyPending, setNearbyPending] = useState(false);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  // Keyed by anchor coordinate rather than a "have we fetched" flag: the cache
  // holding the answer is what makes the fetch effect idempotent, so a re-run
  // can never leave the layer permanently empty. Only answers are cached —
  // caching a failure too would turn one dropped request into a layer that
  // stays empty for the rest of the session.
  const [nearbyByAnchor, setNearbyByAnchor] = useState<
    ReadonlyMap<string, NearbySupplierSite[]>
  >(new Map());

  const isControlled = externalFocusedIndex !== undefined;
  const focusedIndex = isControlled ? externalFocusedIndex! : internalFocusedIndex;

  const handleFocusChange = useCallback(
    (index: number | null) => {
      if (isControlled) externalOnFocusChange?.(index);
      else setInternalFocusedIndex(index);
    },
    [isControlled, externalOnFocusChange],
  );

  const handleStep = useCallback(
    (delta: number) => {
      if (markers.length < 2) return;
      const next =
        focusedIndex === null
          ? delta > 0
            ? 0
            : markers.length - 1
          : (focusedIndex + delta + markers.length) % markers.length;
      handleFocusChange(next);
    },
    [focusedIndex, markers.length, handleFocusChange],
  );

  // Nearby layer is lazy: nothing is requested until a buyer turns it on, and
  // each anchor is fetched at most once. The anchor is the focused pin, or the
  // first pin in overview, so "nearby" always means "near what I am looking at".
  const nearbyAnchor = markers[focusedIndex ?? 0] ?? null;
  const nearbyAnchorKey = nearbyAnchor
    ? `${nearbyAnchor.latitude.toFixed(4)},${nearbyAnchor.longitude.toFixed(4)}`
    : null;
  const nearbyLoaded = nearbyAnchorKey
    ? nearbyByAnchor.has(nearbyAnchorKey)
    : false;
  const nearbySites = nearbyAnchorKey
    ? (nearbyByAnchor.get(nearbyAnchorKey) ?? [])
    : [];

  useEffect(() => {
    if (!nearbyEnabled || !nearbyAnchor || !nearbyAnchorKey) return;
    if (nearbyByAnchor.has(nearbyAnchorKey)) return;

    let cancelled = false;
    setNearbyPending(true);
    setNearbyFailed(false);
    const params = new URLSearchParams({
      lat: String(nearbyAnchor.latitude),
      lng: String(nearbyAnchor.longitude),
      radius: String(NEARBY_RADIUS_KM),
    });
    if (supplierSlug) params.set("exclude", supplierSlug);

    fetch(`/api/suppliers/nearby?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`nearby lookup failed: ${res.status}`);
        return (await res.json()) as { sites?: NearbySupplierSite[] };
      })
      .then((json) => {
        if (cancelled) return;
        // A genuine empty answer is cached, so a dead spot is not re-queried on
        // every toggle.
        setNearbyByAnchor((prev) =>
          new Map(prev).set(nearbyAnchorKey, json.sites ?? []),
        );
      })
      .catch(() => {
        // Deliberately not cached: the next toggle or site change retries.
        if (!cancelled) setNearbyFailed(true);
      })
      .finally(() => {
        if (!cancelled) setNearbyPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    nearbyEnabled,
    nearbyAnchor,
    nearbyAnchorKey,
    nearbyByAnchor,
    supplierSlug,
  ]);

  const handleExport = useCallback(() => {
    const featureCollection = {
      type: "FeatureCollection",
      features: markers.map((m, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
        properties: {
          site: i + 1,
          address: m.label,
          address_kind: kindOf(m),
          geocode_confidence_pct: m.confidencePct ?? null,
          geocode_address_status: m.addressStatus ?? null,
          precision: isApproximate(m) ? "approximate" : "premises",
        },
      })),
    };
    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${supplierSlug ?? "supplier"}-locations.geojson`;
    anchor.click();
    // Revoking in the same tick cancels the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [markers, supplierSlug]);

  const focusedShortLabel = useMemo(() => {
    const target = focusedIndex === null ? markers[0] : markers[focusedIndex];
    return target ? shortSiteLabel(target.label) : null;
  }, [focusedIndex, markers]);

  const ariaLabel =
    markers.length > 1
      ? `Map of ${markers.length} verified locations. Use left and right arrow keys to move between sites.`
      : `Map of the verified location: ${markers[0]?.label ?? "supplier site"}`;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <MapToolbar
          markerCount={markers.length}
          focusedIndex={focusedIndex}
          focusedShortLabel={focusedShortLabel}
          onStep={handleStep}
          onResetFocus={() => handleFocusChange(null)}
          mapStyle={mapStyle}
          onStyleChange={setMapStyle}
          nearbyEnabled={nearbyEnabled}
          nearbyPending={nearbyPending}
          onNearbyToggle={() => setNearbyEnabled((v) => !v)}
          onExport={handleExport}
        />
        <MapWidget
          markers={markers}
          focusedIndex={focusedIndex}
          onFocusChange={handleFocusChange}
          mapStyle={mapStyle}
          transientMarker={transientMarker}
          nearbySites={nearbySites}
          nearbyEnabled={nearbyEnabled}
          profileBasePath={profileBasePath}
          ariaLabel={ariaLabel}
        />
      </div>

      <InsightsStrip
        markers={markers}
        focusedIndex={focusedIndex}
        nearbyCount={nearbySites.length}
        nearbyEnabled={nearbyEnabled}
        mapStyle={mapStyle}
        nearbyState={
          nearbyFailed
            ? "failed"
            : nearbyPending || !nearbyLoaded
              ? "loading"
              : "ready"
        }
      />

      {/* Announce site changes for screen-reader users driving the switcher.
          Single-pin profiles have nothing to cycle, so there is nothing to say. */}
      {markers.length > 1 ? (
        <p aria-live="polite" className="sr-only">
          {focusedIndex === null
            ? `Showing all ${markers.length} sites`
            : `Site ${focusedIndex + 1} of ${markers.length}: ${markers[focusedIndex]?.label ?? ""}`}
        </p>
      ) : null}
    </div>
  );
}

/** Kind colours/labels, so the address list can mirror the map legend. */
export { KIND_STYLE as LOCATION_KIND_STYLE };
