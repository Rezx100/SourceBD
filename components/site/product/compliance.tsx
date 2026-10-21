// /product/compliance (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/compliance"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero's screenshot is now the Watch demo on the cotton stage (the
// saved suppliers checked against the UFLPA Entity List, the certificates grouped by when they end); the four
// moments follow as on the home; the needs-attention row plays the expiry vignette, the UFLPA row keeps its 3 Oct
// screen, the lists table and the statement keep their words; then the other three products and the close on the
// night ground. No sanctions row: the page's words hold none.

import { DemoCompliance, VignetteExpiry } from "@/components/site/demos";
import { ToneShift } from "@/components/site/motion";
import { Figure, PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FeatureRow, HeroActions, HeroCentered, Section } from "@/components/site/sections/ui";
import { VignetteGrid } from "@/components/site/sections/vignettes";

export const COMPLIANCE_KEY = "product/compliance";
const P = PAGES[COMPLIANCE_KEY]!;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;
const label = (b: { n: string; label: string }) => (b.n ? `${b.n} · ${b.label}` : b.label);

export function CompliancePage() {
  const [attention, uflpa, lists, statement] = [row("01"), row("02"), row(""), row("03")];
  return (
    <ToneShift id={null} initial="paper" className="bg-canvas font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered
          label={`${P.group} · ${P.name}`}
          title={P.h1}
          lede={P.lede}
          stage={<DemoCompliance stage="hero-cotton" lead />}
        >
          <HeroActions center />
        </HeroCentered>

        <VignetteGrid />

        <FeatureRow
          label={label(attention)}
          headline={attention.headline}
          lede={attention.lede}
          tone="subtle"
          media={<VignetteExpiry stage="weave" />}
        />
        {uflpa.shot ? <FeatureRow label={label(uflpa)} headline={uflpa.headline} lede={uflpa.lede} flip media={<Figure shot={uflpa.shot} still="weave" sizes="(min-width: 1440px) 720px, 100vw" />} /> : null}
        <Section label={label(lists)} headline={lists.headline} lede={lists.lede} tone="subtle">
          {lists.extra}
        </Section>
        <Section label={label(statement)} headline={statement.headline} lede={statement.lede} />
      </div>

      <div data-tone="dark">
        <CrossSell current={`/${COMPLIANCE_KEY}`} />
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}
