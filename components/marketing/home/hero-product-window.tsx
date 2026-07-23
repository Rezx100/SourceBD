// Home hero product window.
// Single app-window geometry mirroring the production shell:
// sidebar (border-r hairline) + dashboard main on one continuous surface.
// The window itself is the animated HeroDashboardDemo client island
// (components/marketing/home/hero-dashboard-demo.tsx): the approved
// static dashboard brought to life with one looping "Find matches"
// workflow in the same animation language as the buyer-workflow bento.
// Illustrative fixture data only.

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { HeroDashboardDemo } from "@/components/marketing/home/hero-dashboard-demo";
import { HeroGrid } from "@/components/marketing/home/hero-backdrop";

// Decorative monogram tiles only — deliberately NOT initials of real
// companies. A neutrality-first index must not imply any group endorses
// or uses the product, so these map to nothing and stay aria-hidden.
const INDEX_TILE_MARKS = ["KN", "WV", "DN", "SW", "TX"];

export function HomeHero({
  suppliersIndexed = null,
}: {
  suppliersIndexed?: number | null;
}) {
  // Live count renders exact (no "+"); the "+" belongs only to the rounded
  // fallback used before the RPC responds.
  const suppliersLabel =
    suppliersIndexed != null ? suppliersIndexed.toLocaleString() : "10,000+";

  return (
    <section className="relative overflow-hidden font-body text-neutral-900 antialiased">
      <HeroGrid />

      <div
        className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pt-14 sm:px-6 sm:pt-[72px] lg:pt-[88px]"
      >
        <div className="mx-auto flex max-w-[52rem] flex-col items-center text-center">
          <h1 className="w-full font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-[#111] md:text-5xl">
            Know before you source.
          </h1>

          <p className="max-w-[42rem] pt-4 font-body text-base font-medium leading-relaxed tracking-[-0.01em] text-neutral-600 sm:pt-5 sm:text-lg">
            Verify supplier information using trusted records before making
            first contact.
          </p>

          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 min-[420px]:w-auto min-[420px]:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] w-full max-w-[18rem] items-center justify-center gap-2 rounded-lg bg-brand-forest px-5 py-2.5 font-body text-[14px] font-medium tracking-[-0.01em] !text-white transition-[background-color,transform] duration-150 hover:bg-brand-forest-mid motion-safe:active:scale-[0.99] min-[420px]:w-auto"
            >
              Start free
            </Link>
            <Link
              href="/discover"
              className="group inline-flex min-h-[44px] w-full max-w-[18rem] items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 font-body text-[14px] font-medium tracking-[-0.01em] text-neutral-800 transition-[border-color,background-color,transform] duration-150 hover:border-neutral-400 hover:bg-neutral-50 motion-safe:active:scale-[0.99] min-[420px]:w-auto"
            >
              Discover
              <ArrowRight
                size={15}
                weight="bold"
                className="text-neutral-500 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-neutral-800"
                aria-hidden
              />
            </Link>
          </div>

          <div className="mt-6 flex max-w-full flex-col items-center justify-center gap-2.5 min-[420px]:flex-row">
            <div aria-hidden className="flex shrink-0 flex-nowrap -space-x-2">
              {INDEX_TILE_MARKS.map((mark, i) => (
                <span
                  key={mark}
                  className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white font-display text-[9px] font-semibold tracking-wide text-neutral-500 shadow-[0_0_0_1px_rgba(15,15,20,0.02)]"
                  style={{ zIndex: i + 1 }}
                >
                  {mark}
                </span>
              ))}
            </div>
            <p className="max-w-[19rem] text-balance font-body text-[12.5px] leading-snug tracking-[-0.01em] text-neutral-500">
              <span className="font-semibold text-neutral-700">
                {suppliersLabel}
              </span>{" "}
              companies indexed, on the public record
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-8 w-full overflow-visible pb-16 sm:mt-10 sm:pb-20 lg:pb-24">
        <div className="relative mx-auto w-full max-w-[1200px] overflow-visible px-4 sm:px-6">
          <div className="relative">
            <span className="sr-only">
              Preview of the SourceBD buyer dashboard. Animated
              demonstration: the buyer opens Find matches, completes the
              three-step wizard — product, certifications and memberships,
              review — receives ranked verified-supplier matches, follows
              the top factory, and returns to the dashboard where the
              saved-supplier count updates.
            </span>
            <HeroDashboardDemo />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[10%] -bottom-10 h-14 sm:inset-x-[14%] sm:-bottom-12 sm:h-16"
              style={{
                background:
                  "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(15, 15, 20, 0.06) 0%, transparent 70%)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
