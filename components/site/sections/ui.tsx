// The small parts every marketing page is drawn with: the home page's column and rule, one focus ring, ink links (green
// is spent on the primary button and the logo's swatches only, never on a link: the founder's critique of 7 Oct, item
// 2), the logo and the site's photographs. Server-safe: no "use client", so a server page reads these as strings. The
// sections an inner page is built from are `inner.tsx` and home's own (card-grid, close, split).

import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/patterns/logo";
import { cn } from "@/lib/utils";

/** 1280 wide at 1440 (80 px a side), 20 px a side on a phone. */
export const measure = "mx-auto w-full max-w-site px-5 md:px-10 xl:px-20";

/** The home page's column since the founder's walkthrough of 23 Oct 2026: mercury.com's 1024 at 1440, 20 px a side on a phone, 40 on a tablet. */
export const column = "mx-auto w-[calc(100%-40px)] max-w-column md:w-[calc(100%-80px)]";

/** The tour's wider column (mercury.com's): 1136 at 1440, the list at 152 from the left. */
export const tourMeasure = "mx-auto w-[calc(100%-40px)] max-w-column-wide md:w-[calc(100%-80px)]";

/** The rule over a home section's headline (mercury.com's): a hairline in the ground's rule colour. */
export const rule = "border-t border-[rgb(var(--mk-rule))]";

/** The one focus ring on the site: near-black, offset, never green. */
export const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Home's second pill (the close's Book a demo): the ink at 15% under the ink. Here, not in close.tsx, so a server page can read it as a string. */
export const secondary = cn("inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-ink/15 px-4 text-site-item text-ink transition-colors hover:bg-ink/25", ring);

/** A link in running text: ink, underlined. */
export const inkLink = cn("font-medium text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring);

/** The logo, its icon 35 px tall and the word 75% of that (the founder, 25 Oct 2026): the word in the ink of its ground, the two swatches green on a light one and paper on the night (the footer, the bar over a dark section). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("w-fit rounded-sm text-ink", ring, className)}>
      <Logo height={35} />
    </Link>
  );
}

/** The underlined link under a block of copy: ink, never green. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} prefetch={false} className={cn("inline-flex min-h-11 items-center text-site-body font-medium text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring, className)}>
      {children}
    </Link>
  );
}

/**
 * The site's photographs (the founder's videos, 22 Oct 2026): the buyer's own world, the sourcing studio with the
 * laptop the home page zooms into (`hero`). The swatches, the sample rail, the port, the dusk and the mill went with
 * the old stages and closing band when every page took the home page's design (25 Oct 2026).
 */
export type StillName = "hero" | "laptop";

/** The widths each photograph ships at, and its height at the first of them. `laptop` is the hero's laptop, upscaled, for its zoom. */
const WIDTHS: Record<StillName, number[]> = { hero: [1600, 2560, 3840], laptop: [2560, 4096] };
const HEIGHT: Partial<Record<StillName, number>> = { laptop: 1440 };

const set = (name: StillName, ext: "avif" | "webp") => WIDTHS[name].map((w) => `/site/home/${name}-${w}.${ext} ${w}w`).join(", ");

/** A photograph: AVIF then WebP at each width it ships at, filling its (positioned) parent. Decoration, so no alt. */
export function Still({ name, className, eager = false, sizes = "(min-width: 1440px) 1280px, 100vw" }: { name: StillName; className?: string; eager?: boolean; sizes?: string }) {
  return (
    <picture>
      <source type="image/avif" srcSet={set(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(name, "webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
      <img
        src={`/site/home/${name}-${WIDTHS[name][0]}.webp`}
        alt=""
        width={WIDTHS[name][0]}
        height={HEIGHT[name] ?? 900}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    </picture>
  );
}
