// The home page at `/` (Paper "32 Home · Mercury direction", approved 10 Oct 2026; the motion plan of 14 Oct, M3): one
// tree for the 1440 board and the 390 board. The hero scrubs on scroll into the dark pinned tour, whose demos play
// real records; the ground then crossfades section by section (`ToneShift`): paper for the proof and the features,
// dark for Buy with confidence, paper for the ladder and the figures, the cutting-table photo for suppliers, dark for
// the closing. The announcement bar and the navigation sit above it in the (home) layout; the footer is the page's
// own. Figures come from the site's live facts (`lib/site-facts.ts`): a figure that was not read is left out, never
// guessed.

import type { HomeFact, HomeRecord } from "@/lib/home-records";
import type { SiteFacts } from "@/lib/site-facts";
import { ToneShift } from "./motion";
import { Chips, type Chip } from "./sections/chips";
import { Closing, HOME_CARDS } from "./sections/closing";
import { Confidence } from "./sections/confidence";
import { FAQ_ITEMS } from "./sections/faq-items";
import { Faq } from "./sections/faq";
import { Figures } from "./sections/figures";
import { PlatformGrid } from "./sections/grid";
import { HeroScrub } from "./sections/hero";
import { InsideRecord } from "./sections/inside-record";
import { Ladder } from "./sections/ladder";
import { MarksStrip } from "./sections/marks";
import { NeverDo } from "./sections/never";
import { RealRecords } from "./sections/real-records";
import { Showcase } from "./sections/showcase";
import { ForSuppliers } from "./sections/suppliers";
import { PinnedTour } from "./sections/tour";
import { VignetteGrid } from "./sections/vignettes";

export function HomeMercury({ facts, chips = [], cards = [], callouts = [] }: { facts: SiteFacts; chips?: Chip[]; cards?: HomeRecord[]; callouts?: (HomeFact | null)[] }) {
  // The shell around the page carries the skip link's anchor, so the main landmark here carries none.
  return (
    <ToneShift id={null} initial="photo" className="bg-canvas font-sans text-ink-strong antialiased">
      <HeroScrub suppliers={facts.suppliers} chips={chips.length ? <Chips chips={chips} /> : null} />
      <PinnedTour />
      <div data-tone="paper">
        <MarksStrip />
        <Showcase />
        <InsideRecord callouts={callouts} />
        <RealRecords cards={cards} />
        <VignetteGrid />
        <PlatformGrid />
      </div>
      <div data-tone="dark">
        <Confidence />
      </div>
      <div data-tone="paper">
        <Ladder />
        <Figures facts={facts} />
      </div>
      <div data-tone="photo">
        <ForSuppliers />
      </div>
      <div data-tone="paper">
        <NeverDo />
        <Faq id="home-faq" items={FAQ_ITEMS(facts)} />
      </div>
      <div data-tone="dark">
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
      </div>
    </ToneShift>
  );
}
