"use client";

// Trust-sources orbit — OrbitingCircles.
//
// The SourceBD shield sits at the centre; the certification, association
// and government authority logos orbit around it — a literal picture of
// "every claim circles back to an issuing authority". Two rings at
// different radii / speeds so it reads as depth, not a flat ring.

import Image from "next/image";

import { ShieldGlyph } from "@/components/marketing/logo";
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
  { src: "/inapp-logos/bgmea.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
  { src: "/inapp-logos/RSC.png", alt: "RSC" },
];

const OUTER = [
  { src: "/inapp-logos/okeo100.png", alt: "OEKO-TEX" },
  { src: "/inapp-logos/wrap.png", alt: "WRAP" },
  { src: "/inapp-logos/gost.png", alt: "GOTS" },
  { src: "/inapp-logos/GRS.png", alt: "GRS" },
  { src: "/inapp-logos/RCS.png", alt: "RCS" },
  { src: "/inapp-logos/amfori.jpg", alt: "amfori" },
];

export function TrustOrbit() {
  return (
    <div className="relative flex h-full min-h-[300px] w-full items-center justify-center sm:min-h-[420px]">
      {/* Centre — SourceBD brand mark (matches the Step 01 engine shield) */}
      <div className="z-10 flex size-[64px] items-center justify-center rounded-lg bg-brand-forest shadow-sm sm:size-[76px]">
        <ShieldGlyph className="h-1/2 w-1/2" />
      </div>

      {/* Inner ring */}
      <OrbitingCircles iconSize={42} radius={82} duration={34}>
        {INNER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>

      {/* Outer ring — reversed, slower */}
      <OrbitingCircles iconSize={46} radius={130} duration={48} reverse>
        {OUTER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>
    </div>
  );
}
