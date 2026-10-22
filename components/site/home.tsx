// The home page at `/`, rebuilt from the founder's two videos of 22 Oct 2026 after mercury.com's: the buyer's sourcing
// studio and the zoom into its laptop, the tour on the night ground, the brands its factories make for, then the
// record's features on the paper ground, the night again for buying with confidence, and the close. Every picture of
// the product is the real app, recorded from the admin account (`sections/browser.tsx`). Each section stands on its own
// ground, fixed (`PageMain`): nothing crossfades as the page scrolls. The announcement bar and the navigation sit above
// it in the (home) layout; the footer is the page's own. Figures come from the site's live facts (`lib/site-facts.ts`):
// a figure that was not read is left out, never guessed. `slots` lets the route stream the chips' counts and the three
// records in after the first paint; without them the page draws the data it is given.

import type { ReactNode } from "react";
import type { HomeRecord } from "@/lib/home-records";
import type { SiteFacts } from "@/lib/site-facts";
import { PageMain } from "./motion";
import { BrandStrip } from "./sections/brands";
import { Chips, type Chip } from "./sections/chips";
import { Closing, HOME_CARDS } from "./sections/closing";
import { Confidence } from "./sections/confidence";
import { FAQ_ITEMS } from "./sections/faq-items";
import { Faq } from "./sections/faq";
import { Figures } from "./sections/figures";
import { PlatformGrid } from "./sections/grid";
import { InsideRecord } from "./sections/inside-record";
import { Ladder } from "./sections/ladder";
import { MarksStrip } from "./sections/marks";
import { NeverDo } from "./sections/never";
import { Opening } from "./sections/opening";
import { RealRecords } from "./sections/real-records";
import { Showcase } from "./sections/showcase";
import { ForSuppliers } from "./sections/suppliers";
import { VignetteGrid } from "./sections/vignettes";

export function HomeMercury({ facts, chips = [], cards = [], slots = {} }: { facts: SiteFacts; chips?: Chip[]; cards?: HomeRecord[]; slots?: { chips?: ReactNode; records?: ReactNode } }) {
  // The shell around the page carries the skip link's anchor, so the main landmark here carries none.
  return (
    <PageMain id={null} className="font-sans text-ink-strong antialiased">
      <Opening suppliers={facts.suppliers} chips={slots.chips ?? (chips.length ? <Chips chips={chips} className="md:justify-start" /> : null)} />
      <BrandStrip />
      <MarksStrip />
      <Showcase />
      <InsideRecord />
      {slots.records ?? <RealRecords cards={cards} />}
      <VignetteGrid />
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
    </PageMain>
  );
}
