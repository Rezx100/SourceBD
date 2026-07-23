"use client";

// Home hero backdrop — vertical wash + optional grid. No blur.

import { useReducedMotion } from "motion/react";

const CELL = 56;

const WASH = `
  linear-gradient(
    180deg,
    #fafafa 0%,
    #f6f7f8 10%,
    #eef4f0 28%,
    #e4efe9 48%,
    #d8e9e0 72%,
    #cfe3d7 88%,
    #fafafa 100%
  )
`;

type Props = {
  /** When false, only the wash renders (grid lives on the hero section). */
  showGrid?: boolean;
};

export function HeroBackdrop({ showGrid = true }: Props) {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <style>{`
        @keyframes hero-wash-drift {
          from { background-position: 50% 0%; }
          to { background-position: 50% 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-wash {
            animation: none !important;
            background-position: 50% 35% !important;
          }
        }
      `}</style>

      <div
        className="hero-wash absolute inset-0"
        style={{
          backgroundImage: WASH,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 165%",
          backgroundPosition: "50% 0%",
          animation: reduce
            ? undefined
            : "hero-wash-drift 18s ease-in-out infinite alternate",
        }}
      />

      {showGrid ? <HeroGrid /> : null}
    </div>
  );
}

/** Grid only — sized to its parent (hero). Blends out at the bottom edge. */
export function HeroGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 opacity-[0.4]"
      style={{
        backgroundImage: `
          linear-gradient(
            to right,
            color-mix(in srgb, var(--brand-forest) 14%, transparent) 1px,
            transparent 1px
          ),
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--brand-forest) 14%, transparent) 1px,
            transparent 1px
          )
        `,
        backgroundSize: `${CELL}px ${CELL}px`,
        backgroundPosition: "center top",
        maskImage:
          "linear-gradient(180deg, transparent 0%, black 14%, black 72%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(180deg, transparent 0%, black 14%, black 72%, transparent 100%)",
      }}
    />
  );
}
