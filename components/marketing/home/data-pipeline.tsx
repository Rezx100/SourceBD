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

import { AnimatedBeam } from "@/components/ui/animated-beam";
import { ShieldGlyph } from "@/components/marketing/logo";
import { cn } from "@/lib/utils";

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

function Logo({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={48}
      height={48}
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
];

// Right — government registers + trade associations
const REGS = [
  { src: "/inapp-logos/RSC.png", alt: "RSC" },
  { src: "/inapp-logos/bgmea.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
];

const BEAM_CYCLE_SECONDS = 2.5;

export function DataPipeline({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const certRefs = [
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
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full min-h-[380px] w-full items-stretch justify-between px-1 sm:min-h-[460px] sm:px-6",
        className,
      )}
    >
      {/* Left — certification bodies */}
      <div className="flex flex-col justify-center gap-5 sm:gap-7">
        {CERTS.map((c, i) => (
          <Node key={c.alt} ref={certRefs[i]} title={`Certification · ${c.alt}`}>
            <Logo src={c.src} alt={c.alt} />
          </Node>
        ))}
      </div>

      {/* Centre — SourceBD verification engine (absolutely centred so it
          stays dead-centre regardless of column widths) */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div
          ref={engineRef}
          title="SourceBD verification engine"
          className="pointer-events-auto flex size-20 items-center justify-center rounded-lg bg-brand-forest shadow-sm sm:size-24"
        >
          <ShieldGlyph className="h-1/2 w-1/2" />
        </div>
      </div>

      {/* Right — registers & associations */}
      <div className="flex flex-col justify-center gap-5 sm:gap-7">
        {REGS.map((r, i) => (
          <Node key={r.alt} ref={regRefs[i]} title={`Register · ${r.alt}`}>
            <Logo src={r.src} alt={r.alt} />
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
          elbowAt={0.55}
          duration={BEAM_CYCLE_SECONDS}
          delay={0}
          reverse
          pathColor="var(--hairline)"
          pathWidth={2}
          gradientStartColor="var(--brand-forest)"
          gradientStopColor="var(--brand-forest-mid)"
        />
      ))}
    </div>
  );
}
