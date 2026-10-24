// The home page at `/`, mercury.com's page section for section since the founder's walkthrough of 23 Oct 2026 ("make
// exact same home page for SourceBD"), measured at 1440 and matched side by side: the buyer's studio and the zoom into
// its laptop, the tour, the brands its factories make for and what suppliers and buyers said, on the night ground; the first grid of
// four on the warm ground; the promise, the two split sections and the second grid on the day ground; then the night
// again for the figures, the checks, the guides and the close. The whole page takes one ground at a time and fades to
// the next (`HomeMain`). Every picture of the product is the real app: the tour's recordings and, everywhere else, parts
// of it animated in code from real captures (`sections/browser.tsx`, `Clip`), no part shown twice (founder's video 3);
// the split sections' pictures are drawn, as Mercury's are. Mercury's customer stories are what suppliers and buyers
// told the founder before launch (`sections/voices.tsx`), and its quote is SourceBD's promise. The announcement bar and
// the navigation sit above it in the (home) layout; the footer is the chrome's. Figures come from the site's live facts
// (`lib/site-facts.ts`): a figure that was not read is left out, never guessed.

import type { SiteFacts } from "@/lib/site-facts";
import { HomeMain } from "./home-main";
import { BrandStrip } from "./sections/brands";
import { CardGrid, HEAD_START, SEASONED } from "./sections/card-grid";
import { Finale, Guides, Protection, Stats } from "./sections/close";
import { Opening } from "./sections/opening";
import { PROMISES, START, Split } from "./sections/split";
import { Statement } from "./sections/statement";
import { Voices } from "./sections/voices";

export function HomeMercury({ facts }: { facts: SiteFacts }) {
  // The shell around the page carries the skip link's anchor, so the main landmark here carries none.
  return (
    <HomeMain className="font-sans antialiased">
      <Opening suppliers={facts.suppliers} />
      <BrandStrip />
      <Voices />
      <CardGrid id="home-head-start" tone="warm" heading="Vetting a factory used to take weeks. Now it’s a head start." cards={HEAD_START} />
      <Statement />
      <Split id="home-start" tone="day" heading="Get started in minutes. And never chase a factory again." items={START} />
      <Split id="home-promises" tone="day" heading="Stop paying for leads. Start sourcing from the record." items={PROMISES} flip />
      <CardGrid id="home-seasoned" tone="day" heading="Run sourcing like a seasoned pro" cards={SEASONED} />
      <Stats facts={facts} />
      <Protection />
      <Guides />
      <Finale />
    </HomeMain>
  );
}
