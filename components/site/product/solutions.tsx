// The two solutions pages (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["solutions/*"]`, pinned by
// `pages.test.ts`, in the home page's frame. Each keeps its 3 Oct screen as the hero's still (the Saved page with
// three picked; the Compliance hub), then a pinned tour of three product demos for that team on the night ground,
// then its rows with their screens, its outcome, three products chosen for the team, and the close.

import type { ReactNode } from "react";
import { ToneShift } from "@/components/site/motion";
import { Figure, PAGES, type Page } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { Display, FeatureRow, HeroActions, HeroCentered, Label, Section, measure } from "@/components/site/sections/ui";
import { cn } from "@/lib/utils";
import { ComplianceTour, SourcingTour } from "./solutions-tours";

export const SOURCING_KEY = "solutions/sourcing";
export const COMPLIANCE_TEAMS_KEY = "solutions/compliance";

const STILLS = ["weave", "thread-cones", "selvedge", "carton"] as const;

/** One solutions page: the template's shape with the tour after the hero and the chosen three products before the close. */
function SolutionsPage({ p, tour, products }: { p: Page; tour: ReactNode; products: string[] }) {
  return (
    <ToneShift id={null} initial="paper" className="bg-canvas font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered label={`${p.group} · ${p.name}`} title={p.h1} lede={p.lede} stage={p.hero ? <Figure shot={p.hero} still="hero-cotton" eager /> : undefined}>
          <HeroActions center />
        </HeroCentered>
      </div>

      {tour}

      <div data-tone="paper">
        {p.blocks.map((b, i) => {
          const label = b.n ? `${b.n} · ${b.label}` : b.label;
          const tone = i % 2 === 0 ? "subtle" : "paper";
          return b.shot ? (
            <FeatureRow key={b.headline} label={label} headline={b.headline} lede={b.lede} flip={i % 2 === 1} tone={tone} media={<Figure shot={b.shot} still={STILLS[i % STILLS.length]!} sizes="(min-width: 1440px) 720px, 100vw" />}>
              {b.extra}
            </FeatureRow>
          ) : (
            <Section key={b.headline} label={label} headline={b.headline} lede={b.lede} tone={tone}>
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
        <CrossSell current="" only={products} />
        <Closing headline={p.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}

export function SolutionsSourcingPage() {
  return <SolutionsPage p={PAGES[SOURCING_KEY]!} tour={<SourcingTour />} products={["/product/search", "/product/records", "/product/rfqs"]} />;
}

export function SolutionsCompliancePage() {
  return <SolutionsPage p={PAGES[COMPLIANCE_TEAMS_KEY]!} tour={<ComplianceTour />} products={["/product/records", "/product/compliance", "/product/search"]} />;
}
