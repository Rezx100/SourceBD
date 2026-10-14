// The home page at `/` (Paper "32 Home · Mercury direction", approved 10 Oct 2026): one tree for the 1440 board and
// the 390 board, in the boards' order. The announcement bar and the navigation sit above it in the (home) layout;
// the footer is the page's own. Figures come from the site's live facts (`lib/site-facts.ts`): a figure that was
// not read is left out, never guessed.

import type { HomeFact, HomeRecord } from "@/lib/home-records";
import type { SiteFacts } from "@/lib/site-facts";
import { Chips, type Chip } from "./sections/chips";
import { Closing, HOME_CARDS } from "./sections/closing";
import { Confidence } from "./sections/confidence";
import { FAQ_ITEMS } from "./sections/faq-items";
import { Faq } from "./sections/faq";
import { Figures } from "./sections/figures";
import { PlatformGrid } from "./sections/grid";
import { HeroCopy, HeroStage } from "./sections/hero";
import { InsideRecord } from "./sections/inside-record";
import { Ladder } from "./sections/ladder";
import { MarksStrip } from "./sections/marks";
import { NeverDo } from "./sections/never";
import { Overview } from "./sections/overview";
import { RealRecords } from "./sections/real-records";
import { Showcase } from "./sections/showcase";
import { StartInAMinute } from "./sections/start";
import { ForSuppliers } from "./sections/suppliers";

export function HomeMercury({ facts, chips = [], cards = [], callouts = [] }: { facts: SiteFacts; chips?: Chip[]; cards?: HomeRecord[]; callouts?: (HomeFact | null)[] }) {
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
        <Faq id="home-faq" items={FAQ_ITEMS(facts)} />
        <Closing
          cards={HOME_CARDS}
          headline={
            <>
              Sourcing, rebuilt
              <br />
              from the register up.
            </>
          }
        />
      </main>
    </div>
  );
}
