// The two solutions pages (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["solutions/*"]`, pinned by
// `pages.test.ts`, in the home page's frame. Each hero plays the demo of what the team does first (the Ask: three
// picked from a search, one RFQ; the Watch: the saved suppliers checked), then a pinned tour of three product demos for
// that team on the night ground, then its rows, each with its demo (critique 22 Oct: no 3 Oct screenshot), its
// outcome, three products chosen for the team, and the close.

import type { ReactNode } from "react";
import { DemoCompliance, DemoFilters, DemoQuotes, DemoRecord, DemoRfq, DemoStatement } from "@/components/site/demos";
import { ToneShift } from "@/components/site/motion";
import { PAGES, type Page } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { Display, FeatureRow, HeroActions, HeroCentered, Label, Section, measure } from "@/components/site/sections/ui";
import { cn } from "@/lib/utils";
import { ComplianceTour, SourcingTour } from "./solutions-tours";

export const SOURCING_KEY = "solutions/sourcing";
export const COMPLIANCE_TEAMS_KEY = "solutions/compliance";

/** One solutions page: the template's shape with the tour after the hero and the chosen three products before the close; `hero` and `media` (by row `n`) are its demos. */
function SolutionsPage({ p, hero, media, tour, products }: { p: Page; hero: ReactNode; media: Record<string, ReactNode>; tour: ReactNode; products: string[] }) {
  return (
    <ToneShift id={null} initial="paper" className="font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered label={`${p.group} · ${p.name}`} title={p.h1} lede={p.lede} stage={hero}>
          <HeroActions center />
        </HeroCentered>
      </div>

      {tour}

      <div data-tone="paper">
        {p.blocks.map((b, i) => {
          const tone = i % 2 === 0 ? "subtle" : "paper";
          return media[b.n] ? (
            <FeatureRow key={b.headline} label={b.label} headline={b.headline} lede={b.lede} flip={i % 2 === 1} tone={tone} media={media[b.n]}>
              {b.extra}
            </FeatureRow>
          ) : (
            <Section key={b.headline} label={b.label} headline={b.headline} lede={b.lede} tone={tone}>
              {b.extra}
            </Section>
          );
        })}
        {p.outcome ? (
          <section className="py-14 md:py-section">
            <div className={cn(measure, "flex flex-col items-center gap-4 text-center")}>
              <Label>The outcome</Label>
              <Display as="h2" className="max-w-[880px] font-light">
                {p.outcome}
              </Display>
            </div>
          </section>
        ) : null}
      </div>

      <div data-tone="dark">
        <CrossSell only={products} />
        <Closing headline={p.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}

export function SolutionsSourcingPage() {
  return (
    <SolutionsPage
      p={PAGES[SOURCING_KEY]!}
      hero={<DemoRfq stage="hero-cotton" eager />}
      media={{ "01": <DemoFilters stage="weave" />, "02": <DemoRecord stage="weave" />, "03": <DemoQuotes stage="weave" /> }}
      tour={<SourcingTour />}
      products={["/product/search", "/product/records", "/product/rfqs"]}
    />
  );
}

export function SolutionsCompliancePage() {
  return (
    <SolutionsPage
      p={PAGES[COMPLIANCE_TEAMS_KEY]!}
      hero={<DemoCompliance stage="hero-cotton" eager />}
      media={{ "01": <DemoRecord stage="weave" />, "02": <DemoCompliance view="uflpa" stage="weave" />, "03": <DemoCompliance view="expiry" stage="weave" />, "04": <DemoStatement stage="weave" /> }}
      tour={<ComplianceTour />}
      products={["/product/records", "/product/compliance", "/product/search"]}
    />
  );
}
