// /product/rfqs (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/rfqs"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero's screenshot is now the Ask demo on the cotton stage (three
// suppliers ticked, one example RFQ sent, two example quotes back); the quotes row plays the quotes vignette; the
// thread and the 50-supplier form keep their 3 Oct screens, since no demo draws a thread or the review step yet. Then
// the other three products and the close on the night ground.

import { DemoRfq, VignetteQuotes } from "@/components/site/demos";
import { ToneShift } from "@/components/site/motion";
import { Figure, PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FeatureRow, HeroActions, HeroCentered } from "@/components/site/sections/ui";

export const RFQS_KEY = "product/rfqs";
const P = PAGES[RFQS_KEY]!;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;
const label = (b: { n: string; label: string }) => `${b.n} · ${b.label}`;

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
          label={label(quotes)}
          headline={quotes.headline}
          lede={quotes.lede}
          tone="subtle"
          media={<VignetteQuotes stage="weave" />}
        />
        {messages.shot ? <FeatureRow label={label(messages)} headline={messages.headline} lede={messages.lede} flip media={<Figure shot={messages.shot} still="weave" sizes="(min-width: 1440px) 720px, 100vw" />} /> : null}
        {many.shot ? <FeatureRow label={label(many)} headline={many.headline} lede={many.lede} tone="subtle" media={<Figure shot={many.shot} still="weave" sizes="(min-width: 1440px) 720px, 100vw" />} /> : null}
      </div>

      <div data-tone="dark">
        <CrossSell current={`/${RFQS_KEY}`} />
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}
