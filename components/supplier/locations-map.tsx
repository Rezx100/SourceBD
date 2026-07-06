"use client";

// Locations map — Barikoi vector tiles (bkoi-gl / MapLibre) with one forest
// pin per geocoded location. Deliberately quiet: no scroll-zoom hijack,
// no rotation, no animation on load (fitBounds is instant), so it reads as
// a reference figure inside the Locations card rather than an app inside
// the app. Renders nothing without markers or a public API key.

import { useEffect, useRef } from "react";

import "bkoi-gl/dist/style/bkoi-gl.css";

export type LocationMapMarker = {
  latitude: number;
  longitude: number;
  label: string;
};

const MAP_STYLE_BASE = "https://map.barikoi.com/styles/osm-liberty/style.json";

export function LocationsMap({ markers }: { markers: LocationMapMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_BARIKOI_API_KEY;
    if (!apiKey || !containerRef.current || markers.length === 0) return;

    let cancelled = false;
    let map: import("bkoi-gl").Map | undefined;

    (async () => {
      const bkoi = await import("bkoi-gl");
      if (cancelled || !containerRef.current) return;

      map = new bkoi.Map({
        container: containerRef.current,
        style: `${MAP_STYLE_BASE}?key=${encodeURIComponent(apiKey)}`,
        center: [markers[0]!.longitude, markers[0]!.latitude],
        zoom: 12,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new bkoi.NavigationControl({ showCompass: false }), "top-right");
      map.touchZoomRotate.disableRotation();

      for (const m of markers) {
        new bkoi.Marker({ color: "#1f4d3a" })
          .setLngLat([m.longitude, m.latitude])
          .setPopup(
            new bkoi.Popup({ offset: 18, closeButton: false, maxWidth: "260px" }).setText(
              m.label,
            ),
          )
          .addTo(map);
      }

      if (markers.length > 1) {
        const bounds = new bkoi.LngLatBounds();
        for (const m of markers) bounds.extend([m.longitude, m.latitude]);
        map.fitBounds(bounds, { padding: 56, maxZoom: 13, animate: false });
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Markers come from a server component render — stable per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (markers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Map showing ${markers.length} supplier ${
        markers.length === 1 ? "location" : "locations"
      }`}
      className="h-[240px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 sm:h-[280px]"
    />
  );
}
