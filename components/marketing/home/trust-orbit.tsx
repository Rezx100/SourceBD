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
    <div className="flex size-full items-center justify-center rounded-full border border-neutral-200/80 bg-white p-2">
      <Image
        src={src}
        alt={alt}
        width={36}
        height={36}
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
    <div className="relative flex h-full min-h-[360px] w-full items-center justify-center sm:min-h-[440px]">
      {/* Centre — SourceBD brand mark */}
      <div className="z-10 flex size-24 items-center justify-center rounded-3xl bg-[#1f4d3a] shadow-[0_10px_30px_-12px_rgba(31,77,58,0.45)]">
        <ShieldGlyph className="h-1/2 w-1/2" />
      </div>

      {/* Inner ring */}
      <OrbitingCircles iconSize={46} radius={102} duration={20}>
        {INNER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>

      {/* Outer ring — reversed */}
      <OrbitingCircles iconSize={52} radius={168} duration={30} reverse>
        {OUTER.map((l) => (
          <OrbitLogo key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </OrbitingCircles>
    </div>
  );
}
