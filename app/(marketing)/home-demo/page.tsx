// SourceBD — cinematic homepage preview (visual review only).
//
// Parallel concept for founder review. The live homepage at
// app/(marketing)/page.tsx is intentionally untouched. Route:
//   /home-demo
//
// Narrative order: claim → scale proof → evidence → buyer workflow →
// kept-current → decision path → how the record is built → convert.
//
//   1. Hero (product window, live supplier count)
//   2. MoatStats (live counters + sanctions/freshness strip)
//   3. Evidence Anatomy (live Compliance surfaces from a real profile)
//   4. Capability feature grid (animated product-capability bento)
//   5. Workflow marquee (live evidence checks)
//   6. Isometric decision path
//   7. Verified-record steps (how the record is built)
//   8. Closing CTA
//
// All sections share one container (max-w-[1200px] px-4 sm:px-6), one Kicker,
// two vertical-rhythm steps (py-16/20 standard · py-24/28 feature) and
// hairline border-b separators with white / neutral-50 alternation.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { CapabilityFeatureGrid } from "@/components/marketing/home/capability-feature-grid";
import { EvidenceAnatomy } from "@/components/marketing/home/evidence-anatomy";
import { HeroBackdrop } from "@/components/marketing/home/hero-backdrop";
import { HomeHero } from "@/components/marketing/home/hero-product-window";
import { IsometricDecisionPath } from "@/components/marketing/home/isometric-decision-path";
import { MoatStats } from "@/components/marketing/home/moat-stats";
import { SectionHeader } from "@/components/marketing/home/section-header";
import { VerifiedRecordSteps } from "@/components/marketing/home/verified-record-steps";
import { WorkflowAgentsMarquee } from "@/components/marketing/home/workflow-agents-marquee";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Quiet reserved band while live sections resolve — no invented copy/numbers. */
function SectionFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className ?? "min-h-[12rem] border-b border-neutral-200 bg-white"}
    />
  );
}

function Deferred({
  children,
  fallbackClassName,
}: {
  children: ReactNode;
  fallbackClassName?: string;
}) {
  return (
    <Suspense fallback={<SectionFallback className={fallbackClassName} />}>
      {children}
    </Suspense>
  );
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SourceBD — See how sourcing works",
  description:
    "A cinematic walkthrough of SourceBD: search verified Bangladesh garment factories, vet the evidence, and message them directly.",
  robots: { index: false, follow: false },
};

// ─── Data ────────────────────────────────────────────────────────
type Stats = {
  suppliers_indexed: number | null;
  suppliers_with_tier1or2_source: number | null;
  sanctions_lists_screened: number | null;
  compliance_documents_mirrored: number | null;
  certifications_verified: number | null;
  last_refreshed_at: string | null;
};

const NULL_STATS: Stats = {
  suppliers_indexed: null,
  suppliers_with_tier1or2_source: null,
  sanctions_lists_screened: null,
  compliance_documents_mirrored: null,
  certifications_verified: null,
  last_refreshed_at: null,
};

async function loadStats(): Promise<Stats> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("marketing_stats");
    if (error || !data) return NULL_STATS;
    return data as Stats;
  } catch {
    return NULL_STATS;
  }
}

export default async function HomeDemoPage() {
  const stats = await loadStats();

  return (
    <div className="overflow-x-clip bg-bg-l0 font-body text-neutral-900">
      {/* ════════ 1 · HERO — wash band ends with the product window ════════ */}
      <div className="relative border-b border-neutral-200">
        <HeroBackdrop showGrid={false} />
        <div className="relative z-10">
          <HomeHero suppliersIndexed={stats.suppliers_indexed} />
        </div>
      </div>

      {/* ════════ 2 · MOAT PROOF — live counters + freshness ════════ */}
      <MoatStats
        suppliersIndexed={stats.suppliers_indexed}
        corroborated={stats.suppliers_with_tier1or2_source}
        documentsMirrored={stats.compliance_documents_mirrored}
        certificationsVerified={stats.certifications_verified}
        sanctionsListsScreened={stats.sanctions_lists_screened}
        lastRefreshedAt={stats.last_refreshed_at}
      />

      {/* ════════ 3 · EVIDENCE ANATOMY — live Compliance tab ════════ */}
      <Deferred fallbackClassName="min-h-[28rem] border-b border-neutral-200 bg-neutral-50">
        <EvidenceAnatomy />
      </Deferred>

      {/* ════════ 4 · CAPABILITY FEATURE GRID ════════ */}
      <CapabilityFeatureGrid />

      {/* ════════ 5 · LIVE EVIDENCE CHECKS ════════ */}
      <WorkflowAgentsMarquee />

      {/* ════════ 6 · DECISION PATH ════════ */}
      <IsometricDecisionPath />

      {/* ════════ 7 · VERIFIED-RECORD STEPS — find · build · verify ════════ */}
      <VerifiedRecordSteps />

      {/* ════════ 8 · CLOSING CTA — solid forest band, concentric rings ════════ */}
      <section className="relative overflow-hidden bg-brand-forest py-24 md:py-28">
        {/* Concentric rings radiating from the right edge, lightening inward */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] sm:block"
        >
          {[
            { size: 1060, tint: "rgba(120,190,150,0.08)" },
            { size: 840, tint: "rgba(120,190,150,0.14)" },
            { size: 630, tint: "rgba(130,200,160,0.22)" },
            { size: 430, tint: "rgba(150,215,175,0.32)" },
          ].map((ring) => (
            <span
              key={ring.size}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 rounded-full"
              style={{
                width: ring.size,
                height: ring.size,
                background: ring.tint,
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6">
          <BlurFade delay={0.1}>
            <div>
              <SectionHeader
                kicker="Start with the record"
                tone="inverse"
                scale="closing"
                title="Start vetting with evidence."
                description="Search the index free. Every record traceable to its issuing authority — refreshed weekly."
              />

              <div className="mt-16 flex flex-wrap items-center gap-4 sm:mt-[4.5rem] md:mt-20">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold !text-brand-forest shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5"
                >
                  Start free <ArrowRight size={16} weight="bold" />
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-lg border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-medium !text-white backdrop-blur-sm transition-colors hover:border-white/60"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>
    </div>
  );
}
