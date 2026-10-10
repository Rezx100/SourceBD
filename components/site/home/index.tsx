// The home page at `/` (Paper "32 Home · Mercury direction", approved 10 Oct 2026): one tree for the 1440 board and
// the 390 board, in the boards' order. The announcement bar and the navigation sit above it in the (home) layout;
// the footer is the page's own. Figures come from the site's live facts (`lib/site-facts.ts`): a figure that was
// not read is left out, never guessed.

import type { HomeFact, HomeRecord } from "@/lib/home-records";
import type { SiteFacts } from "@/lib/site-facts";
import { Chips, type Chip } from "./chips";
import { Closing } from "./closing";
import { Confidence } from "./confidence";
import { HomeFaq } from "./faq";
import { Figures } from "./figures";
import { HomeFooter } from "./footer";
import { PlatformGrid } from "./grid";
import { HeroCopy, HeroStage } from "./hero";
import { InsideRecord } from "./inside-record";
import { Ladder } from "./ladder";
import { MarksStrip } from "./marks";
import { NeverDo } from "./never";
import { Overview } from "./overview";
import { RealRecords } from "./real-records";
import { Showcase } from "./showcase";
import { StartInAMinute } from "./start";
import { ForSuppliers } from "./suppliers";

export function HomeMercury({ facts, year, chips = [], cards = [], callouts = [] }: { facts: SiteFacts; year: number; chips?: Chip[]; cards?: HomeRecord[]; callouts?: HomeFact[] }) {
  return (
    <div className="bg-canvas font-sans text-ink-strong antialiased">
      <main>
        <HeroCopy suppliers={facts.suppliers} chips={chips.length ? <Chips chips={chips} /> : null} />
        <HeroStage />
        <MarksStrip />
        <Overview />
        <Showcase />
        <InsideRecord callouts={callouts} />
        <RealRecords cards={cards} />
        <StartInAMinute />
        <PlatformGrid />
        <Confidence />
        <Ladder />
        <Figures facts={facts} />
        <ForSuppliers />
        <NeverDo />
        <HomeFaq facts={facts} />
        <Closing />
      </main>
      <HomeFooter year={year} />
    </div>
  );
}
