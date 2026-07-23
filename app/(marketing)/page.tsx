// SourceBD — marketing homepage.
//
// Founder-approved composition promoted from /home-demo (23 Jul 2026).
//
// Narrative order: claim → scale proof → evidence → capabilities →
// how the record is built → decision path → convert.
//
//   1. Hero (animated product window, live supplier count)
//   2. MoatStats (live counters + sanctions/freshness strip)
//   3. Evidence Anatomy (live Compliance surfaces from a real profile)
//   4. Buyer workflow bento (animated product-capability story)
//   5. Record network (how the record is built — intelligence engine)
//   6. Isometric decision path
//   7. Closing CTA
//
// All sections share one container (max-w-[1200px] px-4 sm:px-6), one Kicker,
// two vertical-rhythm steps (py-16/20 standard · py-24/28 feature) and
// hairline border-b separators with white / neutral-50 alternation.
//
// Nav + footer are mounted by app/(marketing)/layout.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { BuyerWorkflowBento } from "@/components/marketing/home/buyer-workflow-bento";
import { EvidenceAnatomy } from "@/components/marketing/home/evidence-anatomy";
import { HeroBackdrop } from "@/components/marketing/home/hero-backdrop";
import { HomeHero } from "@/components/marketing/home/hero-product-window";
import { IsometricDecisionPath } from "@/components/marketing/home/isometric-decision-path";
import { MoatStats } from "@/components/marketing/home/moat-stats";
import { Kicker } from "@/components/marketing/home/kicker";
import { RecordNetworkSection } from "@/components/marketing/home/record-network-section";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

/** Quiet reserved band while live sections resolve — no invented copy/numbers. */
function SectionFallback({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={className ?? "min-h-[12rem] border-b border-neutral-200 bg-white"}
    >
      <span className="sr-only">Loading live supplier evidence</span>
    </div>
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
  title: "SourceBD — Verified Bangladesh Garment Factories, on the Record",
  description:
    "A public-record index of Bangladesh's ready-made-garment sector. Discover, vet and message verified factories — every claim traced to the government register, trade association, certification body or sanctions list that issued it.",
  keywords: [
    "Bangladesh garment factories",
    "RMG suppliers",
    "verified apparel manufacturers",
    "BGMEA BKMEA members",
    "OEKO-TEX WRAP GOTS certified",
    "UFLPA sanctions screening",
    "supply chain due diligence",
  ],
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "SourceBD — Verified Bangladesh Garment Factories, on the Record",
    description:
      "Discover and vet verified Bangladesh RMG factories with verified evidence behind every claim — government registers, trade associations, certification bodies and sanctions lists in one index.",
    url: `${SITE_URL}/`,
    siteName: "SourceBD",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SourceBD — Verified Bangladesh Garment Factories",
    description:
      "A public-record index of Bangladesh's RMG sector. Every claim traced to the authority that issued it.",
  },
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

export default async function HomePage() {
  const stats = await loadStats();

  return (
    <main
      aria-label="SourceBD product overview"
      className="overflow-x-clip bg-bg-l0 font-body text-neutral-900"
    >
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "SourceBD",
            url: SITE_URL,
            description:
              "A public-record index of Bangladesh's ready-made-garment sector.",
            areaServed: ["GB", "US", "EU", "CA"],
            knowsAbout: [
              "Bangladesh RMG suppliers",
              "garment factory verification",
              "supply chain due diligence",
            ],
          }),
        }}
      />

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

      {/* ════════ 3 · EVIDENCE ANATOMY — live Compliance tab ════════
          Anchor target for the nav/footer "Sources" links; scroll-mt clears
          the 72px sticky nav. */}
      <div id="sources" className="scroll-mt-24">
        <Deferred fallbackClassName="min-h-[28rem] border-b border-neutral-200 bg-neutral-50">
          <EvidenceAnatomy />
        </Deferred>
      </div>

      {/* ════════ 4 · BUYER WORKFLOW BENTO — one connected sourcing story ════════ */}
      <BuyerWorkflowBento />

      {/* ════════ 5 · RECORD NETWORK — evidence streams → canonical record ════════
          Anchor target for the nav/footer "How we verify" links. */}
      <div id="how-we-verify" className="scroll-mt-24">
        <Deferred fallbackClassName="min-h-[28rem] border-b border-neutral-200 bg-white">
          <RecordNetworkSection />
        </Deferred>
      </div>

      {/* ════════ 6 · DECISION PATH ════════ */}
      <IsometricDecisionPath />

      {/* ════════ 7 · CLOSING CTA — light editorial close. Centered dark
          typography on a near-white band; the forest button is the only
          saturated element. The scenic footer below closes the page on the
          same light register. ════════ */}
      <section className="relative overflow-hidden bg-neutral-50 py-20 sm:py-24 md:py-32">
        {/* Whisper decoration only: a centered forest tint behind the
            headline and a faint ring echoing the record motif. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_300px_at_50%_18%,rgba(31,77,58,0.06),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-forest/[0.07] sm:size-[760px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-forest/[0.05] sm:size-[520px]"
        />

        <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 text-center">
          <BlurFade delay={0.1}>
            <div className="flex flex-col items-center">
              <Kicker>Start with the record</Kicker>
              <h2 className="mt-4 max-w-[20ch] text-balance font-display text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
                Start vetting with evidence.
              </h2>
              <p className="mt-5 max-w-[46ch] text-balance text-base leading-relaxed text-neutral-600">
                Search the index free. Every record traceable to its issuing
                authority — refreshed weekly.
              </p>

              <div className="mt-10 flex w-full flex-col items-stretch justify-center gap-3 min-[420px]:w-auto min-[420px]:flex-row min-[420px]:items-center sm:mt-12 sm:gap-4">
                <Link
                  href="/signup"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-forest px-6 py-2.5 text-sm font-semibold !text-white shadow-[0_14px_30px_-14px_rgba(31,77,58,0.55)] transition-transform motion-safe:hover:-translate-y-0.5"
                >
                  Start free <ArrowRight size={16} weight="bold" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium !text-neutral-800 shadow-[0_1px_2px_rgba(15,15,20,0.04)] transition-colors hover:border-neutral-400"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>
    </main>
  );
}
