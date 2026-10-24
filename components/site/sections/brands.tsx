// The brands strip (the founder's second video, 22 Oct 2026, after mercury.com's logo row): retailers and brands that
// buy from factories on SourceBD. Each one is on the record: a published supplier list naming the factory (H&M, Next,
// M&S, ASOS: context/logos.lock.md §3 Tier 4) or a customs record of a shipment to it (Volza, read 22 Oct 2026 from
// `volza_export_checks.top_shipments`). Since the founder's recording of 24 Oct 2026 each is drawn by its own logo in
// one colour, as mercury.com's row is (public/site/home/brands, where each came from is in PROVENANCE.md; the lock's
// §1 note records his change): a mask in the ground's quiet ink, sized so every mark has about the same weight, the
// brand's name its label. The row drifts left, paused on hover and still under reduced motion (app/ds.css), written
// twice so the drift has no seam; the second copy is hidden from screen readers. The headline is mercury.com's "Loved
// by" at its size, centred in two lines, on the night ground.

import { cn } from "@/lib/utils";
import { measure } from "./ui";

/** Each brand, its logo's file in public/site/home/brands and that logo's width over its height. */
export const BRANDS = [
  ["H&M", "hm", 1.52],
  ["Inditex", "inditex", 4.84],
  ["Next", "next", 3.45],
  ["Walmart", "walmart", 5.26],
  ["M&S", "ms", 2.54],
  ["Tesco", "tesco", 3.52],
  ["ASOS", "asos", 3.44],
  ["Bestseller", "bestseller", 9.14],
  ["LPP", "lpp", 2.65],
  ["Action", "action", 5.33],
  ["NKD", "nkd", 1],
  ["Promod", "promod", 6.58],
  ["Delta Galil", "deltagalil", 3.29],
  ["LC Waikiki", "lcw", 7.16],
  ["Lojas Renner", "renner", 5.43],
] as const;

/** A logo's height in px: every mark covers about the same area (a 3.5 : 1 wordmark stands 34 px high), 44 px at most. */
export const logoHeight = (ratio: number) => Math.round(Math.min(44, Math.sqrt(4000 / ratio)));

export function BrandStrip() {
  return (
    <section data-mk-tone="night" aria-labelledby="home-brands" className="overflow-hidden pt-24 md:pt-36">
      <div className={cn(measure, "flex flex-col items-center")}>
        <h2 id="home-brands" className="max-w-[760px] text-center font-display text-site-headline-sm text-ink [text-wrap:balance] md:text-site-headline">
          Factories on SourceBD already make for brands like these
        </h2>
      </div>
      <div className="group relative mt-8 md:mt-10 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        {/* Each copy carries its trailing gap, so moving by half the row lands the second copy exactly on the first. */}
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex h-16 shrink-0 items-center gap-16 pr-16">
              {BRANDS.map(([name, file, ratio]) => {
                const h = logoHeight(ratio);
                const url = `url(/site/home/brands/${file}.webp)`;
                return (
                  <li key={name} className="shrink-0">
                    <span
                      role="img"
                      aria-label={name}
                      className="block bg-ink-2 [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                      style={{ width: Math.round(h * ratio), height: h, maskImage: url, WebkitMaskImage: url }}
                    />
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
