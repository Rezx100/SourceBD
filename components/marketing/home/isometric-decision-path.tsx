import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { SectionHeader } from "@/components/marketing/home/section-header";

const ITEMS = [
  {
    title: "Shape the brief",
    body: "Product, location and capability requirements stay clear before you open a supplier record.",
    src: "/illustrations/shape-the-brief.svg",
    alt: "A sourcing brief assembled from clear requirements",
    width: 511,
    height: 767,
  },
  {
    title: "Inspect the record",
    body: "Review published evidence in context and decide the fit without a hidden ranking.",
    src: "/illustrations/inspect-the-record.svg",
    alt: "A public record assembled from stacked evidence layers",
    width: 487,
    height: 719,
  },
  {
    title: "Move with context",
    body: "Save the right factories or contact them directly with the sourcing requirement intact.",
    src: "/illustrations/move-with-context.svg",
    alt: "A shortlist moving toward a direct action",
    width: 479,
    height: 657,
  },
] as const;

export function IsometricDecisionPath() {
  return (
    <section className="border-b border-neutral-200 bg-white py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div>
          <SectionHeader
            kicker="From requirement to decision"
            title="Build a shortlist you can explain."
            description="Find suppliers, inspect the evidence, and confidently choose who makes the final list."
          />
          <Link
            href="/discover"
            className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-sm font-semibold text-brand-forest transition-colors hover:text-brand-forest-mid"
          >
            Start in Discover <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <div className="mt-12 border-y border-neutral-200 sm:mt-[4.5rem] md:mt-20 lg:grid lg:grid-cols-3">
          {ITEMS.map((item) => (
            <article
              key={item.title}
              className="relative flex flex-col border-b border-neutral-200 py-6 last:border-b-0 sm:py-8 lg:border-b-0 lg:border-l lg:px-8 lg:first:border-l-0 xl:px-10"
            >
              {/* Shared stage height — shorter on phones so the stacked
                  three-step path doesn't dominate the scroll. */}
              <div className="flex flex-1 items-center justify-center py-4 sm:py-6 md:py-8 lg:py-10">
                <div className="flex h-[160px] w-full items-center justify-center xs:h-[180px] sm:h-[220px] lg:h-[250px]">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    className="h-full w-auto bg-transparent object-contain"
                    sizes="(max-width: 1024px) 220px, 250px"
                    unoptimized
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:pt-6">
                <h3 className="font-display text-xl font-semibold tracking-tight text-neutral-900">
                  {item.title}
                </h3>
                <p className="max-w-sm text-sm leading-relaxed text-neutral-600">
                  {item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
