"use client";

// Locations map — Barikoi satellite tiles (bkoi-gl / MapLibre) at building-level
// zoom with one forest pin per geocoded location.
//
// When a supplier has more than one unique geocoded address, a separate map
// instance is rendered per address (each labeled with its address text) rather
// than a single multi-pin fitBounds view. Single-address profiles keep one map.
//
// Deliberately quiet: no scroll-zoom hijack, no rotation, so each map reads as
// a reference figure rather than an embedded app. Renders nothing without
// markers or a public API key.

import { useEffect, useRef } from "react";

import "bkoi-gl/dist/style/bkoi-gl.css";

export type LocationMapMarker = {
  latitude: number;
  longitude: number;
  label: string;
};

const MAP_STYLE_BASE =
  "https://map.barikoi.com/styles/barikoi_satellite/style.json";
const BUILDING_ZOOM = 18;

function AddressMap({ marker }: { marker: LocationMapMarker }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    let map: import("bkoi-gl").Map | undefined;

    (async () => {
      const bkoi = await import("bkoi-gl");
      if (cancelled || !containerRef.current) return;

      map = new bkoi.Map({
        container: containerRef.current,
        style: `${MAP_STYLE_BASE}?key=${encodeURIComponent(apiKey)}`,
        center: [marker.longitude, marker.latitude],
        zoom: BUILDING_ZOOM,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new bkoi.NavigationControl({ showCompass: false }), "top-right");
      map.touchZoomRotate.disableRotation();

      new bkoi.Marker({ color: "#1f4d3a" })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(
          new bkoi.Popup({ offset: 18, closeButton: false, maxWidth: "260px" }).setText(
            marker.label,
          ),
        )
        .addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Marker comes from a server component render — stable per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Satellite map showing supplier location: ${marker.label}`}
      className="h-[240px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 sm:h-[280px]"
    />
  );
}

export function LocationsMap({ markers }: { markers: LocationMapMarker[] }) {
  if (markers.length === 0) return null;

  if (markers.length === 1) {
    return <AddressMap marker={markers[0]!} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {markers.map((marker, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <p className="truncate text-[12.5px] font-medium text-neutral-500">
            {marker.label}
          </p>
          <AddressMap marker={marker} />
        </div>
      ))}
    </div>
  );
}
