"use client";

// Verified-record pipeline — /home-demo only.
// Certification bodies and government registers converge on the SourceBD
// canonical index with sharp square comet pulses along L-shaped routes.

import { RecordBuildPipeline } from "@/components/marketing/home/record-build-pipeline";
import { SectionHeader } from "@/components/marketing/home/section-header";
import { BlurFade } from "@/components/ui/blur-fade";

export function VerifiedRecordSteps() {
  return (
    <section
      className="border-b border-neutral-200 bg-neutral-50 py-16 md:py-20"
      aria-label="How the verified record is built"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <BlurFade delay={0.08}>
          <SectionHeader
            kicker="How the record is built"
            title="How every supplier record is verified."
            description="Independent evidence is gathered, reconciled, and attached before a supplier record becomes searchable."
          />
        </BlurFade>

        <BlurFade delay={0.14}>
          <div
            className="relative mt-12 sm:mt-[4.5rem] md:mt-20"
            role="img"
            aria-label="Certification bodies and government registers feed the SourceBD canonical index"
          >
            {/* Soft wash — neutral lavender to a whisper of forest tint */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-card bg-gradient-to-br from-neutral-100/90 via-white to-brand-forest-tint/20"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-card bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.85)_0%,transparent_72%)]"
            />

            <div className="relative overflow-hidden rounded-card border border-neutral-200 bg-white/70 px-2 py-6 backdrop-blur-[2px] sm:px-6 sm:py-10 md:px-10 md:py-12">
              <RecordBuildPipeline />
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
