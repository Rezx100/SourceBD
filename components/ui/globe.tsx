"use client";

import createGlobe, { COBEOptions } from "cobe";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Centered on Bangladesh (Dhaka ~23.68N, 90.35E) — the platform is rooted
// in Bangladesh but the markers fan out to the buyer markets it serves
// (UK, US, EU, CA). Blended "dotted-sphere" look: a near-white base + white
// glow so the sphere dissolves into the white hero (only the dotted
// continents + glowing forest pins read), per the Magic UI globe pattern.
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: -0.5, // start with South Asia facing forward
  theta: 0.25,
  dark: 0,
  diffuse: 0.4, // flat, even shading so the rim feathers into the page
  mapSamples: 16000,
  mapBrightness: 1.2, // continents read as soft neutral dots on white
  baseColor: [1, 1, 1], // white sphere → blends with the hero background
  markerColor: [31 / 255, 77 / 255, 58 / 255], // forest #1f4d3a brand pins
  glowColor: [1, 1, 1], // white halo so the edge dissolves, no hard disc
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
    // Defer WebGL creation until the canvas actually has a width. When the
    // globe is hidden (`display:none` at < lg) its `offsetWidth` is 0, and
    // creating a cobe instance at width 0 spams `WebGL: INVALID_OPERATION:
    // drawArrays` every animation frame — that error loop pins the main
    // thread and visibly stalls CSS transitions/animations across the page.
    // A ResizeObserver mounts the globe only once it has real dimensions and
    // tears it down if it collapses back to 0, so the mobile (hidden) path
    // never touches the GPU.
    const canvas = canvasRef.current;
    if (!canvas) return;

    let globe: ReturnType<typeof createGlobe> | null = null;

    const createIfSized = () => {
      width = canvas.offsetWidth;
      if (globe || width === 0) return;
      globe = createGlobe(canvas, {
        ...config,
        width: width * 2,
        height: width * 2,
        onRender,
      });
      requestAnimationFrame(() => {
        canvas.style.opacity = "1";
      });
    };

    const destroyIfHidden = () => {
      if (globe && canvas.offsetWidth === 0) {
        globe.destroy();
        globe = null;
        canvas.style.opacity = "0";
      }
    };

    const ro = new ResizeObserver(() => {
      onResize();
      createIfSized();
      destroyIfHidden();
    });
    ro.observe(canvas);

    window.addEventListener("resize", onResize);
    createIfSized();

    return () => {
      ro.disconnect();
      if (globe) globe.destroy();
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
