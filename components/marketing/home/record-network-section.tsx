// "How the record is built" — /home-demo section 5.
//
// The animated diagram is `IntelligenceEngineStage` (six trusted sources →
// collector → SourceBD engine → distributor → six verified outputs, all
// continuously live). This shell owns the section chrome around it: the
// heading, then a labelled hairline and the three-step "how it behaves"
// story below the diagram — laid on the same open surface as the animation
// (hairlines only, no card of its own) so the whole thing reads as one
// section.

import { Pulse, Scales, Stack } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { IntelligenceEngineStage } from "@/components/marketing/home/intelligence-engine-stage";
import { SectionHeader } from "@/components/marketing/home/section-header";

/** How the stage above behaves — three steps inside the unified panel. */
const PIPELINE_STEPS = [
  {
    num: "01",
    kicker: "Collect & reconcile",
    icon: Stack,
    title: "Every source, one canonical record.",
    body: "Government registers and trade associations on one side, certification bodies on the other — 31 official sources, refreshed continuously, then matched and de-duplicated into a single verified factory record.",
  },
  {
    num: "02",
    kicker: "Live, claim by claim",
    icon: Pulse,
    title: "Verified evidence, as it lands.",
    body: "Register matches, certificate confirmations and sanctions screens flow straight into each supplier profile — every row comes from a named issuer, stamped with its tier and its date.",
  },
  {
    num: "03",
    kicker: "Ordered by authority",
    icon: Scales,
    title: "The issuer is the ranking.",
    body: "No proprietary score, ever. Each fact carries the weight of the body that issued it — and higher-tier evidence always outranks lower-tier.",
  },
] as const;

export async function RecordNetworkSection() {
  return (
    <section
      className="relative overflow-hidden bg-white py-16 md:py-20"
      aria-label="How the verified record is built"
    >
      {/* Open wash — brand-forest whisper on the gathering side, forest-mid
          on the verified side. Same stops/opacities as before; hue only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(31,77,58,0.08)_0%,rgba(255,255,255,0)_34%,rgba(255,255,255,0)_64%,rgba(45,106,79,0.06)_100%)]"
      />

      <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <BlurFade delay={0.08}>
          <SectionHeader
            kicker="How the record is built"
            title="How every supplier record is verified."
            description="Registers, certification bodies, and watchlists are scanned continuously — every evidence stream is reconciled into one canonical supplier record."
          />
        </BlurFade>

        <BlurFade delay={0.14}>
          <div className="mt-10 sm:mt-12 md:mt-16">
            <IntelligenceEngineStage />
          </div>
        </BlurFade>

        {/* Unified evidence trail — no card of its own, so it reads as the
            same surface the animation sits on: a labelled hairline closing
            the diagram, then the three-step story. Never boxes. */}
        <BlurFade delay={0.18}>
          <div className="mt-9 sm:mt-11">
            {/* Hairline carrying the section's through-line — bridges the
                diagram into the three steps below. */}
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-neutral-200/70" />
              <p className="text-center font-mono text-[9.5px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                Evidence in · trusted intelligence out
              </p>
              <span aria-hidden className="h-px flex-1 bg-neutral-200/70" />
            </div>

            {/* How the pipeline behaves, in three steps. Columns separated
                by vertical hairlines only. */}
            <div className="mt-7 grid grid-cols-1 gap-6 sm:mt-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-neutral-200/70">
              {PIPELINE_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className={i === 0 ? "sm:pr-6 lg:pr-7" : "sm:px-6 lg:px-7"}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-brand-forest/10 bg-gradient-to-b from-brand-forest/[0.08] to-brand-forest/[0.03] text-brand-forest shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                      <step.icon size={14} weight="duotone" aria-hidden />
                    </span>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap text-[11.5px] leading-none">
                      <span className="font-display font-bold tabular-nums text-brand-forest">
                        {step.num}
                      </span>
                      <span className="font-medium text-neutral-500">
                        {step.kicker}
                      </span>
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-[13.5px] font-bold leading-snug tracking-[-0.01em] text-neutral-900">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
