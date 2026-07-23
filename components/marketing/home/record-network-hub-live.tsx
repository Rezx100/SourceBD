"use client";

// Inside-card live cue for the record-network hub. Quiet hairline track with
// a traveling forest comet (same cadence as the lead beam). No fill bar.

import { motion, useInView, useReducedMotion } from "motion/react";
import { useId, useRef } from "react";

/** Cadence matched to LEFT_NODES[0] beam duration + delay in the stage. */
const CYCLE_S = 4.2;
const CYCLE_DELAY_S = 0.2;

export function HubCardLiveMeter() {
  const ref = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref, { amount: 0.35, once: false });
  const active = inView && !reduce;

  return (
    <div ref={ref} className="mt-3.5" aria-hidden>
      <div className="relative h-px w-full overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Quiet track */}
          <line
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="rgb(229 229 229 / 0.9)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {active ? (
            <>
              <line
                x1="0"
                y1="0.5"
                x2="100"
                y2="0.5"
                stroke={`url(#${gradientId})`}
                strokeWidth="1.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <defs>
                <motion.linearGradient
                  id={gradientId}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="100"
                  y1="0"
                  y2="0"
                  initial={{ x1: -28, x2: -4 }}
                  animate={{ x1: [ -28, 104 ], x2: [ -4, 128 ] }}
                  transition={{
                    duration: CYCLE_S,
                    delay: CYCLE_DELAY_S,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <stop stopColor="#1f4d3a" stopOpacity="0" />
                  <stop offset="0.35" stopColor="#1f4d3a" />
                  <stop offset="0.65" stopColor="#2d6a4f" />
                  <stop offset="1" stopColor="#2d6a4f" stopOpacity="0" />
                </motion.linearGradient>
              </defs>
            </>
          ) : (
            <line
              x1="0"
              y1="0.5"
              x2="100"
              y2="0.5"
              stroke="rgb(31 77 58 / 0.45)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[12px] leading-none text-neutral-500">
        <span
          className={
            active
              ? "size-1 shrink-0 rounded-full bg-[#F68D2E] motion-safe:animate-pulse"
              : "size-1 shrink-0 rounded-full bg-brand-forest"
          }
        />
        <span className="font-medium text-neutral-600">
          {active ? "Updating" : "Up to date"}
        </span>
        <span className="text-neutral-400">from connected sources</span>
      </p>
    </div>
  );
}
