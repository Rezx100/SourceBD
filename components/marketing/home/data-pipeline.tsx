"use client";

// Data-pipeline diagram — AnimatedBeam (L / elbow routing).
//
// Two columns of real authority logos converge on the SourceBD
// verification engine in the centre: certification bodies on the left,
// government registers + trade associations on the right. The beams use
// an angular L / elbow route (no rounded curves) so it reads like a
// circuit board — collection → reconciliation.

import React, { forwardRef, useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { BrandMarkWithHairline } from "@/components/marketing/logo";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

/** Push outer nodes further from centre for a circuit-board tree read. */
const LEFT_STAGGER = [
  "-translate-x-2 sm:-translate-x-4",
  "-translate-x-0.5 sm:-translate-x-1",
  "-translate-x-4 sm:-translate-x-7",
  "-translate-x-1 sm:-translate-x-2",
  "-translate-x-3 sm:-translate-x-5",
] as const;

const RIGHT_STAGGER = [
  "translate-x-2 sm:translate-x-4",
  "translate-x-0.5 sm:translate-x-1",
  "translate-x-4 sm:translate-x-7",
  "translate-x-1 sm:translate-x-2",
  "translate-x-3 sm:translate-x-5",
] as const;

const Node = forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode; title?: string }
>(({ className, children, title }, ref) => {
  return (
    <div
      ref={ref}
      title={title}
      className={cn(
        "z-10 flex size-16 items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 shadow-sm sm:size-20 sm:p-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
});
Node.displayName = "Node";

function Logo({
  src,
  alt,
  size = 48,
}: {
  src: string;
  alt: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="h-full w-full object-contain"
    />
  );
}

// Left — certification bodies
const CERTS = [
  { src: "/inapp-logos/okeo100.png", alt: "OEKO-TEX" },
  { src: "/inapp-logos/wrap.png", alt: "WRAP" },
  { src: "/inapp-logos/gost.png", alt: "GOTS" },
  { src: "/inapp-logos/GRS.png", alt: "GRS" },
  { src: "/inapp-logos/RCS.png", alt: "RCS" },
];

// Right — government registers + trade associations
const REGS = [
  { src: "/inapp-logos/RSC-logo.png", alt: "RSC" },
  { src: "/inapp-logos/BGMEA%20logo.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BGAPMEA%20logo.png", alt: "BGAPMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
];

const BEAM_CYCLE_SECONDS = 3.2;

/**
 * AnimatedBeam paints a horizontal gradient wipe across the SVG (not path-
 * length). Left beams (10%→110%) and reverse right beams (90%→-10%) both
 * cross the centre mark around ~40% of the cycle — darken there, not at the
 * end. brightness(1.3) ≈ 20%+ lighter forest; 1.0 = baked-in darkest.
 */
const RECEIVE_FILTER = [
  "brightness(1.3)",
  "brightness(1.3)",
  "brightness(1)",
  "brightness(1)",
  "brightness(1.3)",
  "brightness(1.3)",
] as const;
const RECEIVE_TIMES = [0, 0.28, 0.4, 0.52, 0.68, 1] as const;

function CanonicalIndexNode({
  showConnectionDots = true,
  showHairline = true,
  markClassName,
  markSrc,
  markReceivePulse = false,
  hubPill = false,
}: {
  showConnectionDots?: boolean;
  showHairline?: boolean;
  markClassName?: string;
  /** When set, renders this image/SVG instead of the PNG BrandMark. */
  markSrc?: string;
  markReceivePulse?: boolean;
  /** White pill frame with corner pins — demo / hero pipeline stage. */
  hubPill?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const mark = markSrc ? (
    <span
      title="SourceBD"
      role="img"
      aria-label="SourceBD"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        markClassName,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={markSrc}
        alt=""
        aria-hidden
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  ) : (
    <BrandMarkWithHairline
      durationSeconds={BEAM_CYCLE_SECONDS}
      className={markClassName}
      wrapperClassName="relative"
      showHairline={showHairline}
    />
  );

  const markBody = markReceivePulse && !reduceMotion ? (
    <motion.span
      className="inline-flex"
      animate={{ filter: [...RECEIVE_FILTER] }}
      transition={{
        duration: BEAM_CYCLE_SECONDS,
        times: [...RECEIVE_TIMES],
        ease: "linear",
        repeat: Infinity,
      }}
    >
      {mark}
    </motion.span>
  ) : (
    mark
  );

  const hubContent = hubPill ? (
    <div className="relative flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-[0_8px_28px_-14px_rgba(15,23,42,0.18)] sm:px-5 sm:py-3">
      {[
        "left-2 top-2",
        "right-2 top-2",
        "left-2 bottom-2",
        "right-2 bottom-2",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn("absolute size-1 rounded-full bg-neutral-300", pos)}
        />
      ))}
      {markBody}
    </div>
  ) : (
    markBody
  );

  return (
    <div className="relative z-20">
      {showConnectionDots ? (
        <>
          <span
            aria-hidden
            className="absolute -left-1 top-1/2 z-10 size-2 -translate-y-1/2 rounded-full bg-brand-forest shadow-[0_0_0_5px_var(--brand-forest-soft)] motion-safe:animate-pulse"
            style={{ animationDuration: `${BEAM_CYCLE_SECONDS}s` }}
          />
          <span
            aria-hidden
            className="absolute -right-1 top-1/2 z-10 size-2 -translate-y-1/2 rounded-full bg-brand-forest shadow-[0_0_0_5px_var(--brand-forest-soft)] motion-safe:animate-pulse"
            style={{ animationDuration: `${BEAM_CYCLE_SECONDS}s` }}
          />
        </>
      ) : null}
      {hubContent}
    </div>
  );
}

export function DataPipeline({
  className,
  containerClassName = "min-h-[340px] grid-cols-[72px_minmax(150px,1fr)_72px] gap-3 px-1 sm:min-h-[460px] sm:grid-cols-[82px_minmax(170px,1fr)_82px] sm:gap-5 sm:px-6",
  columnGapClassName = "gap-5 sm:gap-7",
  nodeClassName,
  logoSize = 48,
  showConnectionDots = true,
  showHairline = true,
  markClassName,
  markSrc,
  markReceivePulse = false,
  hubPill = false,
  staggered = false,
  strokeLinecap = "round",
}: {
  className?: string;
  /** Overrides the outer grid sizing (min-h, columns, gap, padding). */
  containerClassName?: string;
  /** Overrides the vertical gap between stacked nodes in each column. */
  columnGapClassName?: string;
  /** Overrides each logo node's box size/padding. */
  nodeClassName?: string;
  /** Overrides the intrinsic logo image size (px). */
  logoSize?: number;
  /** Left/right pulsing connection nodes on the centre mark. Default on for production `/`. */
  showConnectionDots?: boolean;
  /** Soft pulsing halo around the centre BrandMark. Default on for production `/`. */
  showHairline?: boolean;
  /** Overrides the centre BrandMark frame size. */
  markClassName?: string;
  /** Optional centre mark asset (e.g. SVG). Demo can pass SourceBD_logo.svg. */
  markSrc?: string;
  /** Sync forest-green darken with beam comet arrival. Demo-only when enabled. */
  markReceivePulse?: boolean;
  /** Pill-shaped white hub frame with corner pins. */
  hubPill?: boolean;
  /** Offset outer nodes horizontally for a circuit-board tree layout. */
  staggered?: boolean;
  /** Comet cap style — use `butt` for sharp square pulses on angular paths. */
  strokeLinecap?: "round" | "butt" | "square";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const certRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const regRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate grid w-full items-center",
        containerClassName,
        className,
      )}
    >
      {/* Left — certification bodies */}
      <div className={cn("flex flex-col items-center justify-center", columnGapClassName)}>
        {CERTS.map((c, i) => (
          <Node
            key={c.alt}
            ref={certRefs[i]}
            title={`Certification · ${c.alt}`}
            className={cn(nodeClassName, staggered && LEFT_STAGGER[i])}
          >
            <Logo src={c.src} alt={c.alt} size={logoSize} />
          </Node>
        ))}
      </div>

      {/* Centre — canonical SourceBD index receiving both evidence streams. */}
      <div className="z-10 flex h-full items-center justify-center">
        <div ref={engineRef} title="SourceBD canonical index">
          <CanonicalIndexNode
            showConnectionDots={showConnectionDots}
            showHairline={showHairline}
            markClassName={markClassName}
            markSrc={markSrc}
            markReceivePulse={markReceivePulse}
            hubPill={hubPill}
          />
        </div>
      </div>

      {/* Right — registers & associations */}
      <div className={cn("flex flex-col items-center justify-center", columnGapClassName)}>
        {REGS.map((r, i) => (
          <Node
            key={r.alt}
            ref={regRefs[i]}
            title={`Register · ${r.alt}`}
            className={cn(nodeClassName, staggered && RIGHT_STAGGER[i])}
          >
            <Logo src={r.src} alt={r.alt} size={logoSize} />
          </Node>
        ))}
      </div>

      {/* Beams: cert logos → engine. Square (L / elbow) routing; every beam
          fires at the same time and pulses continuously — slow travel, no gap
          between repeats so it reads as a steady circuit. */}
      {certRefs.map((ref, i) => (
        <AnimatedBeam
          key={`c-${i}`}
          containerRef={containerRef}
          fromRef={ref}
          toRef={engineRef}
          pathType="angular"
          elbowAt={0.55}
          duration={BEAM_CYCLE_SECONDS}
          delay={0}
          pathColor="var(--hairline)"
          pathWidth={2}
          gradientStartColor="var(--brand-forest)"
          gradientStopColor="var(--brand-forest-mid)"
          strokeLinecap={strokeLinecap}
          strokeLinejoin="miter"
        />
      ))}
      {/* Beams: register logos → engine (mirrored square route, reversed, also
          firing simultaneously with the cert side) */}
      {regRefs.map((ref, i) => (
        <AnimatedBeam
          key={`r-${i}`}
          containerRef={containerRef}
          fromRef={ref}
          toRef={engineRef}
          pathType="angular"
          elbowAt={0.45}
          duration={BEAM_CYCLE_SECONDS}
          delay={0}
          reverse
          pathColor="var(--hairline)"
          pathWidth={2}
          gradientStartColor="var(--brand-forest)"
          gradientStopColor="var(--brand-forest-mid)"
          strokeLinecap={strokeLinecap}
          strokeLinejoin="miter"
        />
      ))}
    </div>
  );
}
