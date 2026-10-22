// The two solutions pages (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["solutions/*"]`, pinned by
// `pages.test.ts`, in the home page's frame. Each hero plays the demo of what the team does first (the Ask: three
// picked from a search, one RFQ; the Watch: the saved suppliers checked), then a pinned tour of three product demos for
// that team on the night ground, then its rows, each with its demo (critique 22 Oct: no 3 Oct screenshot), three
// products chosen for the team, and the close, whose line is the team's outcome.

import type { ReactNode } from "react";
import { DemoCompliance, DemoFilters, DemoQuotes, DemoRecord, DemoRfq, DemoStatement } from "@/components/site/demos";
import { ToneShift } from "@/components/site/motion";
import { PAGES, type Page } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FeatureRow, HeroActions, HeroCentered, Section } from "@/components/site/sections/ui";
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
      </div>

      <div data-tone="dark">
        <CrossSell only={products} />
        {/* The outcome is the close's own line (critique 22 Oct: a kicker over one line, on a page that already closes). */}
        <Closing headline={p.close} lede={`${p.outcome ? `${p.outcome} ` : ""}Free during beta. No card needed.`} />
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
