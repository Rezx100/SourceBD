// /product/rfqs (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/rfqs"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero plays the Ask demo on the cotton stage (three suppliers ticked,
// one example RFQ sent, two example quotes back); the rows play the quotes at full size, a reply under the RFQ it
// answers, and one RFQ reviewed before it goes with a sanctioned example refused (critique 22 Oct: no 3 Oct
// screenshot). Then the other three products and the close on the night ground.

import { DemoQuotes, DemoReview, DemoRfq, DemoThread } from "@/components/site/demos";
import { ToneShift } from "@/components/site/motion";
import { PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FeatureRow, HeroActions, HeroCentered } from "@/components/site/sections/ui";

export const RFQS_KEY = "product/rfqs";
const P = PAGES[RFQS_KEY]!;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;

export function RfqsPage() {
  const [quotes, messages, many] = [row("01"), row("02"), row("03")];
  return (
    <ToneShift id={null} initial="paper" className="font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered
          label={`${P.group} · ${P.name}`}
          title={P.h1}
          lede={P.lede}
          stage={<DemoRfq stage="hero-cotton" eager />}
        >
          <HeroActions center />
        </HeroCentered>

        <FeatureRow
          label={quotes.label}
          headline={quotes.headline}
          lede={quotes.lede}
          tone="subtle"
          media={<DemoQuotes stage="weave" />}
        />
        <FeatureRow label={messages.label} headline={messages.headline} lede={messages.lede} flip media={<DemoThread stage="weave" />} />
        <FeatureRow label={many.label} headline={many.headline} lede={many.lede} tone="subtle" media={<DemoReview stage="weave" />} />
      </div>

      <div data-tone="dark">
        <CrossSell current={`/${RFQS_KEY}`} />
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}
