// Explore-the-index teaser (audit gap d5) — real Discover deep links.
//
// Precision contract: each card's count is computed with EXACTLY the RPC
// args its /discover URL will produce (q is pre-normalised to the page's
// lowercase form, filters mirror the searchParams parsing in
// app/(marketing)/discover/page.tsx). The number a visitor clicks is the
// number they land on. Zero-result or errored queries drop their card.
//
// NOTE: public /discover only renders results when `q` is present, so every
// deep link carries a q term.

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { SectionHeader } from "@/components/marketing/home/section-header";
import { fetchDiscoverTotal } from "@/components/marketing/home/discover-count";
import type { DiscoverArgs } from "@/lib/discover-suppliers";

type TeaserQuery = {
  label: string;
  href: string;
  args: Partial<DiscoverArgs>;
};

const QUERIES: TeaserQuery[] = [
  {
    label: "OEKO-TEX certified knit suppliers",
    href: "/discover?q=knit&cert=oeko_tex",
    args: { p_q: "knit", p_cert_kinds: ["oeko_tex"], p_sort: "default" },
  },
  {
    label: "Denim suppliers in Gazipur",
    href: "/discover?q=denim&district=Gazipur",
    args: { p_q: "denim", p_district: "Gazipur", p_sort: "default" },
  },
  {
    label: "Sweater factories with 3+ verified sources",
    href: "/discover?q=sweater&entity=factory&min_sources=3",
    args: {
      p_q: "sweater",
      p_entity_types: ["factory"],
      p_min_sources: 3,
      p_sort: "default",
    },
  },
  {
    label: "GOTS-certified t-shirt suppliers",
    href: "/discover?q=t-shirt&cert=gots",
    args: { p_q: "t-shirt", p_cert_kinds: ["gots"], p_sort: "default" },
  },
];

export async function ExploreIndexTeaser() {
  const counts = await Promise.all(
    QUERIES.map((q) => fetchDiscoverTotal(q.args)),
  );

  const cards = QUERIES.map((q, i) => ({ ...q, count: counts[i] })).filter(
    (q) => q.count == null || q.count > 0,
  );

  if (cards.length === 0) return null;

  return (
    <section
      aria-label="Explore the index"
      className="border-b border-neutral-200 bg-neutral-50 py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <SectionHeader
          kicker="Enter the index"
          title="Start from a real query."
          description={
            <>
              Every filter on the index is deep-linkable. These are live queries
              — the counts are what you&apos;ll find on the other side.
            </>
          }
        />

        <ul className="mt-16 grid gap-3 sm:mt-[4.5rem] md:mt-20 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="group flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-forest/30 hover:bg-neutral-50"
              >
                <span className="min-w-0">
                  <span className="block font-display text-base font-semibold leading-snug tracking-tight text-neutral-900">
                    {card.label}
                  </span>
                  {card.count != null ? (
                    <span className="mt-0.5 block font-mono text-[12px] text-neutral-500">
                      {card.count.toLocaleString()} result
                      {card.count === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </span>
                <ArrowRight
                  size={18}
                  aria-hidden
                  className="shrink-0 text-neutral-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-forest"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
