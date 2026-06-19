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
    <div className="flex size-full items-center justify-center rounded-full border border-neutral-200 bg-white p-1 shadow-[0_2px_8px_-2px_rgba(16,40,28,0.12)]">
      <Image
        src={src}
        alt={alt}
        width={44}
        height={44}
        className="h-full w-full object-contain"
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
    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center sm:min-h-[500px]">
      {/* Centre — SourceBD brand mark (matches the Step 01 engine shield) */}
      <div className="z-10 flex size-[72px] items-center justify-center rounded-3xl bg-[#1f4d3a] shadow-[0_12px_34px_-12px_rgba(31,77,58,0.5)] sm:size-[84px]">
        <ShieldGlyph className="h-1/2 w-1/2" />
      </div>

      {/* Inner ring */}
      <OrbitingCircles iconSize={48} radius={98} duration={24}>
        {INNER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>

      {/* Outer ring — reversed, slower */}
      <OrbitingCircles iconSize={54} radius={160} duration={36} reverse>
        {OUTER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>
    </div>
  );
}
