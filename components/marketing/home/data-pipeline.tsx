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

import { BrandMarkWithHairline } from "@/components/marketing/logo";
import { AnimatedBeam } from "@/components/ui/animated-beam";
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

function CanonicalIndexNode() {
  return (
    <div className="relative z-20">
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
      <BrandMarkWithHairline
        durationSeconds={BEAM_CYCLE_SECONDS}
        wrapperClassName="relative"
      />
    </div>
  );
}

export function DataPipeline({ className }: { className?: string }) {
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
        "relative isolate grid min-h-[340px] w-full grid-cols-[72px_minmax(150px,1fr)_72px] items-center gap-3 px-1 sm:min-h-[460px] sm:grid-cols-[82px_minmax(170px,1fr)_82px] sm:gap-5 sm:px-6",
        className,
      )}
    >
      {/* Left — certification bodies */}
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-7">
        {CERTS.map((c, i) => (
          <Node key={c.alt} ref={certRefs[i]} title={`Certification · ${c.alt}`}>
            <Logo src={c.src} alt={c.alt} />
          </Node>
        ))}
      </div>

      {/* Centre — canonical SourceBD index receiving both evidence streams. */}
      <div className="z-10 flex h-full items-center justify-center">
        <div ref={engineRef} title="SourceBD canonical index">
          <CanonicalIndexNode />
        </div>
      </div>

      {/* Right — registers & associations */}
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-7">
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
          elbowAt={0.45}
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
