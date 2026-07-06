"use client";

// Trust-sources orbit — OrbitingCircles.
//
// The SourceBD shield sits at the centre; the certification, association
// and government authority logos orbit around it — a literal picture of
// "every claim circles back to an issuing authority". Two rings at
// different radii / speeds so it reads as depth, not a flat ring.

import Image from "next/image";

import { BrandMarkWithHairline } from "@/components/marketing/logo";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";

function OrbitLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex size-full items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white p-1 shadow-sm [clip-path:circle(50%_at_50%_50%)]">
      <Image
        src={src}
        alt={alt}
        width={44}
        height={44}
        className="h-full w-full rounded-full object-contain"
      />
    </div>
  );
}

const INNER = [
  { src: "/inapp-logos/BGMEA%20logo.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BGAPMEA%20logo.png", alt: "BGAPMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
  { src: "/inapp-logos/EPB-Logo.png", alt: "EPB" },
  { src: "/inapp-logos/RSC-logo.png", alt: "RSC" },
];

const OUTER = [
  { src: "/inapp-logos/okeo100.png", alt: "OEKO-TEX" },
  { src: "/inapp-logos/wrap.png", alt: "WRAP" },
  { src: "/inapp-logos/gost.png", alt: "GOTS" },
  { src: "/inapp-logos/GRS.png", alt: "GRS" },
  { src: "/inapp-logos/RCS.png", alt: "RCS" },
  { src: "/inapp-logos/amfori.jpg", alt: "amfori" },
];

const HAIRLINE_CYCLE_SECONDS = 3.2;

export function TrustOrbit() {
  return (
    <div className="relative isolate flex h-full min-h-[322px] w-full items-center justify-center [contain:layout] sm:min-h-[560px]">
      <BrandMarkWithHairline durationSeconds={HAIRLINE_CYCLE_SECONDS} />

      {/* Phone rings: same animation, smaller radius so the orbit stays in-frame. */}
      <div className="contents sm:hidden">
        <OrbitingCircles iconSize={38} radius={84} duration={34}>
          {INNER.map((l) => (
            <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
          ))}
        </OrbitingCircles>

        <OrbitingCircles iconSize={42} radius={126} duration={48} reverse>
          {OUTER.map((l) => (
            <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
          ))}
        </OrbitingCircles>
      </div>

      {/* Larger rings for tablet and desktop. */}
      <div className="hidden sm:contents">
        <OrbitingCircles iconSize={48} radius={112} duration={34}>
          {INNER.map((l) => (
            <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
          ))}
        </OrbitingCircles>

        <OrbitingCircles iconSize={56} radius={180} duration={48} reverse>
          {OUTER.map((l) => (
            <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
          ))}
        </OrbitingCircles>
      </div>
    </div>
  );
}
