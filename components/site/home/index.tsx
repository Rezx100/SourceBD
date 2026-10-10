// The home page at `/` (Paper "32 Home · Mercury direction", approved 10 Oct 2026): one tree for the 1440 board and
// the 390 board, in the boards' order. The announcement bar and the navigation sit above it in the (home) layout;
// the footer is the page's own. Figures come from the site's live facts (`lib/site-facts.ts`): a figure that was
// not read is left out, never guessed.

import type { SiteFacts } from "@/lib/site-facts";
import { Closing } from "./closing";
import { HomeFaq } from "./faq";
import { HomeFooter } from "./footer";
import { PlatformGrid } from "./grid";
import { HeroCopy, HeroStage } from "./hero";
import { Ladder } from "./ladder";
import { MarksStrip } from "./marks";
import { NeverDo } from "./never";
import { Overview } from "./overview";
import { Showcase } from "./showcase";
import { StartInAMinute } from "./start";
import { ForSuppliers } from "./suppliers";

export function HomeMercury({ facts, year }: { facts: SiteFacts; year: number }) {
  return (
    <div className="bg-canvas font-sans text-ink-strong antialiased">
      <main>
        <HeroCopy suppliers={facts.suppliers} />
        <HeroStage />
        <MarksStrip />
        <Overview />
        <Showcase />
        <StartInAMinute />
        <PlatformGrid />
        <Ladder />
        <ForSuppliers />
        <NeverDo />
        <HomeFaq facts={facts} />
        <Closing />
      </main>
      <HomeFooter year={year} />
    </div>
  );
}
