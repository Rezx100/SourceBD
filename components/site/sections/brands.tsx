// The brands strip (the founder's second video, 22 Oct 2026, after mercury.com's logo row): retailers and brands that
// buy from factories on SourceBD. Each one is on the record: a published supplier list naming the factory (H&M, Next,
// M&S, ASOS: context/logos.lock.md §3 Tier 4) or a customs record of a shipment to it (Volza, read 22 Oct 2026 from
// `volza_export_checks.top_shipments`). The lock's rule holds: a buyer brand is never drawn as a logo, only as its name
// in our type (§1, §5.4), so the strip is a line of names that drifts left, paused on hover and still under reduced
// motion (app/ds.css). The list is written twice so the drift has no seam; the second copy is hidden from screen readers.
// Since the founder's walkthrough of 23 Oct 2026 the section is mercury.com's "Loved by": a centred headline in three
// lines at its size, then the row, on the night ground.

import { cn } from "@/lib/utils";
import { measure } from "./ui";

export const BRANDS = ["H&M", "Inditex", "Next", "Walmart", "M&S", "Tesco", "ASOS", "Bestseller", "LPP", "Action", "NKD", "Promod", "Delta Galil", "LC Waikiki", "Lojas Renner"] as const;

export function BrandStrip() {
  return (
    <section data-mk-tone="night" aria-labelledby="home-brands" className="overflow-hidden pt-24 md:pt-36">
      <div className={cn(measure, "flex flex-col items-center")}>
        <h2 id="home-brands" className="max-w-[560px] text-center font-display text-site-headline-sm text-ink [text-wrap:balance] md:text-site-headline">
          Factories on SourceBD already make for brands like these
        </h2>
      </div>
      <div className="group relative mt-8 md:mt-10 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        {/* Each copy carries its trailing gap, so moving by half the row lands the second copy exactly on the first. */}
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex h-14 shrink-0 items-center gap-14 pr-14">
              {BRANDS.map((b) => (
                <li key={b} className="whitespace-nowrap text-xl font-semibold tracking-tight text-ink-2 md:text-site-section-sm">
                  {b}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
