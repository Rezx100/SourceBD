"use client";

import createGlobe, { COBEOptions } from "cobe";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Centered on Bangladesh (Dhaka ~23.68N, 90.35E) — the platform is rooted
// in Bangladesh but the markers fan out to the buyer markets it serves
// (UK, US, EU, CA). Forest "ocean" + pale-mint continents (high contrast
// so it reads as a real globe, not a flat disc) + readable forest pins.
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: -0.5, // start with South Asia facing forward
  theta: 0.25,
  dark: 0,
  diffuse: 1.2,
  mapSamples: 22000, // denser sampling → crisper coastlines
  mapBrightness: 6, // land dots lift to pale mint vs the forest ocean
  baseColor: [0.22, 0.47, 0.36], // forest "ocean" sphere (bright enough to read)
  markerColor: [0.05, 0.18, 0.13], // deep-forest pins
  glowColor: [0.78, 0.89, 0.82], // soft sage halo
  markers: [
    { location: [23.685, 90.3563], size: 0.12 }, // Bangladesh (home — hero pin)
    { location: [51.5074, -0.1278], size: 0.055 }, // London (UK)
    { location: [40.7128, -74.006], size: 0.055 }, // New York (US)
    { location: [43.6532, -79.3832], size: 0.05 }, // Toronto (CA)
    { location: [50.1109, 8.6821], size: 0.05 }, // Frankfurt (EU)
  ],
};

export function Globe({
  className,
  config = GLOBE_CONFIG,
}: {
  className?: string;
  config?: COBEOptions;
}) {
  let phi = 0;
  let width = 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [r, setR] = useState(0);

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      setR(delta / 200);
    }
  };

  const onRender = useCallback(
    (state: Record<string, number>) => {
      if (!pointerInteracting.current) phi += 0.004;
      state.phi = phi + r;
      state.width = width * 2;
      state.height = width * 2;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r],
  );

  const onResize = useCallback(() => {
    if (canvasRef.current) {
      width = canvasRef.current.offsetWidth;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      width: width * 2,
      height: width * 2,
      onRender,
    });

    setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    });
    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 mx-auto aspect-square w-full max-w-[600px]",
        className,
      )}
    >
      <canvas
        className={cn(
          "size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]",
        )}
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          updatePointerInteraction(e.clientX);
        }}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
    </div>
  );
}
