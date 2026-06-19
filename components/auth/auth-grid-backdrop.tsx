"use client";

// Subtle animated grid backdrop for the auth brand panel.
// Magic UI `AnimatedGridPattern` masked to a soft radial fade, forest
// stroke at very low opacity so it reads as texture, never noise.

import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";

export function AuthGridBackdrop() {
  return (
    <AnimatedGridPattern
      numSquares={28}
      maxOpacity={0.07}
      duration={4}
      width={44}
      height={44}
      className="pointer-events-none absolute inset-0 h-full w-full skew-y-12 text-[#1f4d3a] [mask-image:radial-gradient(560px_circle_at_28%_18%,white,transparent)]"
    />
  );
}
