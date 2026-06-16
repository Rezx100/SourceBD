"use client";

import createGlobe, { COBEOptions } from "cobe";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Centered on Bangladesh (Dhaka ~23.68N, 90.35E) — the platform is rooted
// in Bangladesh but the markers fan out to the buyer markets it serves
// (UK, US, EU, CA). Forest-green base keeps the brand signature.
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.32,
  dark: 0,
  diffuse: 1.25,
  mapSamples: 16000,
  mapBrightness: 5.2,
  baseColor: [0.17, 0.41, 0.31], // forest "ocean" sphere
  markerColor: [0.03, 0.12, 0.09], // deep forest pins (read on bright land)
  glowColor: [0.66, 0.83, 0.74], // soft sage halo
  markers: [
    { location: [23.685, 90.3563], size: 0.14 }, // Bangladesh (home)
    { location: [51.5074, -0.1278], size: 0.08 }, // London (UK)
    { location: [40.7128, -74.006], size: 0.08 }, // New York (US)
    { location: [52.52, 13.405], size: 0.06 }, // Berlin (EU)
    { location: [48.8566, 2.3522], size: 0.06 }, // Paris (EU)
    { location: [43.6532, -79.3832], size: 0.06 }, // Toronto (CA)
    { location: [41.9028, 12.4964], size: 0.05 }, // Rome (EU)
    { location: [40.4168, -3.7038], size: 0.05 }, // Madrid (EU)
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
