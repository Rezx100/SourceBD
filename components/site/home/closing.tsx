// 18 · Closing split (Paper `Z3Q-0` / `Z7Q-0`): the night floor, the closing line and the two ways in, one for
// buyers and one for suppliers. Drawn on the night ground, so the tokens are the dark set's; the primary button keeps
// the nav's green with its white label (the kit's label is `surface`, which is dark on a night ground).

import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { Still, TextLink, measure } from "./ui";

const CARDS = [
  { who: "For buyers", line: "Free while we are in beta. No card needed.", body: "UK, US, EU and Canadian brands and retailers. Shortlist, vet and message verified factories in one sitting.", cta: ["Start free", "/signup"], link: ["See what is included", "/pricing"], primary: true },
  { who: "For suppliers", line: "Your record is already here. Claim it.", body: "Bangladesh factories and buying houses. Correct your details, add products and answer RFQs at no cost.", cta: ["Claim your record", "/suppliers"], link: ["Talk to us", "/contact"], primary: false },
] as const;

export function Closing() {
  return (
    <section aria-labelledby="home-close" className={cn(measure, "py-14 md:py-[120px]")}>
      <div data-ground="night" className="relative isolate flex flex-col items-center gap-8 overflow-hidden rounded-pane-phone px-4 py-10 md:gap-14 md:rounded-[24px] md:px-20 md:py-24">
        <Still name="night-floor" className="object-bottom" />
        <h2 id="home-close" className="relative text-center text-[34px] font-light leading-[40px] tracking-[-0.03em] text-ink md:text-[56px] md:leading-[64px]">
          Sourcing, rebuilt
          <br />
          from the register up.
        </h2>
        <div className="relative grid w-full max-w-[1120px] gap-4 md:gap-6 lg:grid-cols-2">
          {CARDS.map((c) => (
            <div key={c.who} className="flex flex-col gap-5 rounded-[16px] border border-ink/10 bg-surface/70 p-6 md:p-9">
              <p className="text-[14px] font-medium leading-[18px] text-ink-2">{c.who}</p>
              <h3 className="text-[24px] leading-8 tracking-[-0.02em] text-ink md:text-[28px] md:leading-9">{c.line}</h3>
              <p className="text-[16px] leading-[25px] text-ink-2">{c.body}</p>
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <ButtonLink href={c.cta[1]} prefetch={false} kind={c.primary ? "primary" : "secondary"} size="lg" className={cn("h-11 rounded-[10px] px-5 text-[15px]", c.primary && "text-brand-on")}>
                  {c.cta[0]}
                </ButtonLink>
                <TextLink href={c.link[1]} className="px-4 text-ink">
                  {c.link[0]}
                </TextLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
