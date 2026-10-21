// /product/records (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/records"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero's screenshot is now the record demo (Check, opening Aboni
// Knitwear at its certificates on the cotton stage); each row's proof is a small loop on the same snapshot where
// one exists (the receipts, a certificate counting down, the locked contact) and the 3 Oct screen where none does
// yet (safety). Then the record opened at three of its sections under tabs, the three real records the home shows,
// the other three products, and the close. The ground runs paper → dark → paper → dark (`ToneShift`): the wrapper
// divs carry `data-tone`, the sections do not.

import { DemoRecord, VignetteExpiry, VignetteReceipts } from "@/components/site/demos";
import { ContactLocked } from "@/components/site/demos/record";
import { ToneShift } from "@/components/site/motion";
import { Figure, PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { RealRecords } from "@/components/site/sections/real-records";
import { FeatureRow, H2, HeroActions, HeroCentered, Lede, Section, measure } from "@/components/site/sections/ui";
import { displayName } from "@/lib/dashboard/facts";
import type { HomeRecord } from "@/lib/home-records";
import { READ_AT, SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { RecordTabs } from "./records-tabs";
import { Staged } from "./staged";

export const RECORDS_KEY = "product/records";
const P = PAGES[RECORDS_KEY]!;
const NAME = displayName(SNAPSHOT.check.name);
const row = (n: string) => P.blocks.find((b) => b.n === n)!;

/** `cards`: the home's three real records as read; with none read, that section is not drawn. The page prints no live figure. */
export function RecordsPage({ cards }: { cards: HomeRecord[] }) {
  const [sources, certificates, disagree, safety, contacts] = [row("01"), row("02"), row("03"), row("04"), row("05")];
  return (
    <ToneShift id={null} initial="paper" className="font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered
          label={`${P.group} · ${P.name}`}
          title={P.h1}
          lede={P.lede}
          stage={<DemoRecord stage="hero-cotton" eager />}
        >
          <HeroActions center />
        </HeroCentered>

        <FeatureRow
          label={sources.label}
          headline={sources.headline}
          lede={sources.lede}
          tone="subtle"
          media={<VignetteReceipts stage="weave" />}
        />
        <FeatureRow
          label={certificates.label}
          headline={certificates.headline}
          lede={certificates.lede}
          flip
          media={<VignetteExpiry stage="weave" />}
        >
          {certificates.extra}
        </FeatureRow>
        <Section label={disagree.label} headline={disagree.headline} lede={disagree.lede} tone="subtle">
          {disagree.extra}
        </Section>
        {/* The one row still on its 3 Oct screen; when the words drop the shot for a demo, the row goes with them rather than drawing nothing. */}
        {safety.shot ? <FeatureRow label={safety.label} headline={safety.headline} lede={safety.lede} media={<Figure shot={safety.shot} still="weave" sizes="(min-width: 1440px) 720px, 100vw" />} /> : null}
        <FeatureRow
          label={contacts.label}
          headline={contacts.headline}
          lede={contacts.lede}
          flip
          tone="subtle"
          media={
            <Staged still="weave">
              <div data-ground="day" className="rounded-frame border border-line-strong bg-surface p-4 text-ink shadow-lg">
                <ContactLocked />
              </div>
            </Staged>
          }
        />
      </div>

      <div data-tone="dark">
        <section aria-labelledby="records-inside" className={cn(measure, "flex flex-col gap-10 py-14 md:gap-14 md:py-section")}>
          <div className="flex flex-col items-center gap-4 text-center">
            <H2 id="records-inside">Inside one record.</H2>
            <Lede className="mx-auto">
              {NAME}, as read {READ_AT}. Open it at its certificates, its sources or its contact: each plays as the record draws it, the dates and the locks included.
            </Lede>
          </div>
          <RecordTabs />
        </section>
      </div>

      {cards.length ? (
        <div data-tone="paper">
          <RealRecords cards={cards} />
        </div>
      ) : null}

      <div data-tone="dark">
        <CrossSell current={`/${RECORDS_KEY}`} />
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}
