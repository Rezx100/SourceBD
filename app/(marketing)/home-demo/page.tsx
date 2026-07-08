// SourceBD — CINEMATIC HOMEPAGE DEMO (visual review only).
//
// This is a parallel, non-production concept for founder review. The live
// homepage at app/(marketing)/page.tsx is intentionally untouched. Route:
//   /home-demo
//
// The centrepiece is <ProductDemo/>: a looping, code-driven "screen
// recording" (no video/GIF) of the real buyer journey — search → vet →
// contact — rendered from the actual design system. Everything else on the
// page is deliberately quieter than the current homepage: the authority
// logos appear exactly once, and the abstract pipeline/orbit/feed sections
// are gone. The animation is the explanation.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ProductDemo } from "@/components/marketing/home/product-demo";
import { MessagingDemo } from "@/components/marketing/home/messaging-demo";
import { IngestionMonitor } from "@/components/marketing/home/ingestion-monitor";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FOREST = "var(--brand-forest)";

export const metadata: Metadata = {
  title: "SourceBD — See how sourcing works (demo)",
  description:
    "A cinematic walkthrough of SourceBD: search verified Bangladesh garment factories, vet the evidence, and message them directly.",
  robots: { index: false, follow: false },
};

// ─── Data ────────────────────────────────────────────────────────
type Stats = {
  suppliers_indexed: number | null;
  suppliers_with_tier1or2_source: number | null;
  compliance_documents_mirrored: number | null;
};

async function loadStats(): Promise<Stats> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("marketing_stats");
    if (error || !data) return { suppliers_indexed: null, suppliers_with_tier1or2_source: null, compliance_documents_mirrored: null };
    return data as Stats;
  } catch {
    return { suppliers_indexed: null, suppliers_with_tier1or2_source: null, compliance_documents_mirrored: null };
  }
}

const AUTHORITY_LOGOS = [
  { src: "/inapp-logos/BGMEA%20logo.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BGAPMEA%20logo.png", alt: "BGAPMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
  { src: "/inapp-logos/EPB-Logo.png", alt: "EPB" },
  { src: "/inapp-logos/RSC-logo.png", alt: "RSC" },
  { src: "/inapp-logos/okeo100.png", alt: "OEKO-TEX" },
  { src: "/inapp-logos/wrap.png", alt: "WRAP" },
  { src: "/inapp-logos/gost.png", alt: "GOTS" },
  { src: "/inapp-logos/GRS.png", alt: "GRS" },
  { src: "/inapp-logos/RCS.png", alt: "RCS" },
  { src: "/inapp-logos/amfori.jpg", alt: "amfori BSCI" },
];

const POSITIONING = [
  {
    title: "Not a marketplace.",
    body: "We don't take a cut of your sourcing, rank suppliers who pay, or broker introductions.",
    positive: "We index who is real and let you reach them directly.",
  },
  {
    title: "Not a broker.",
    body: "No commissions, no exclusivity, no supplier we're quietly incentivised to push.",
    positive: "The same record is shown to every buyer, every time.",
  },
  {
    title: "Not a rating agency.",
    body: "We never invent a proprietary score that hides how a judgement was reached.",
    positive: "You see the issuer's evidence and form your own view.",
  },
];

export default async function HomeDemoPage() {
  const stats = await loadStats();
  const suppliersLabel = stats.suppliers_indexed
    ? stats.suppliers_indexed.toLocaleString()
    : "10,000";

  return (
    <div className="overflow-x-hidden bg-bg-l0 font-body text-neutral-900">
      {/* ════════ HERO + DEMO ════════ */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-white">
        <AnimatedGridPattern
          className="absolute inset-0 fill-brand-forest/5 stroke-brand-forest/10 text-brand-forest opacity-70 [mask-image:radial-gradient(760px_circle_at_50%_0%,white,transparent)]"
          numSquares={48}
          maxOpacity={0.08}
          duration={3}
          repeatDelay={1}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-14 text-center sm:px-8 md:pt-20">
          <BlurFade delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-pill border border-neutral-200 bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-brand-forest shadow-sm backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-forest" />
              Watch it work
            </span>
          </BlurFade>

          <BlurFade delay={0.2}>
            <h1 className="mx-auto mt-5 max-w-3xl text-balance font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-neutral-900 sm:text-5xl md:text-6xl">
              Source verified factories,
              <br className="hidden sm:block" /> <span className="text-brand-forest">the way it should feel.</span>
            </h1>
          </BlurFade>

          <BlurFade delay={0.3}>
            <p className="mx-auto mt-5 max-w-xl text-balance text-body leading-relaxed text-neutral-600 md:text-body-lg">
              Search, vet the evidence, and message Bangladesh garment suppliers
              directly — every claim traced to the authority that issued it.
              Here is the whole journey, start to finish.
            </p>
          </BlurFade>

          <BlurFade delay={0.4}>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/discover" className="btn-proto primary gap-2">
                Explore the index <ArrowRight size={16} />
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
              >
                Start free →
              </Link>
            </div>
          </BlurFade>

          {/* The cinematic product demo */}
          <BlurFade delay={0.5} className="mt-12">
            <ProductDemo />
          </BlurFade>
        </div>
      </section>

      {/* ════════ SINGLE TRUST STRIP ════════ */}
      <section className="border-b border-neutral-200 bg-neutral-50 py-11 md:py-14">
        <p className="mx-auto mb-7 max-w-2xl px-6 text-center text-sm text-neutral-500">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-forest">
            Sources of record
          </span>
          <br />
          <span className="mt-2 inline-block text-balance">
            Aggregated from the government bodies, trade associations and
            certification authorities buyers already trust — never invented.
          </span>
        </p>
        <div className="relative">
          <Marquee pauseOnHover className="[--duration:34s] [--gap:0.875rem] sm:[--gap:1.25rem]">
            {AUTHORITY_LOGOS.map((logo) => (
              <div
                key={logo.alt}
                className="flex h-14 w-28 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 shadow-sm sm:h-16 sm:w-36 sm:px-5"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={140}
                  height={56}
                  className="max-h-8 w-auto max-w-[76px] object-contain sm:max-h-9 sm:max-w-[100px]"
                />
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-neutral-50 to-transparent sm:w-32" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-neutral-50 to-transparent sm:w-32" />
        </div>
      </section>

      {/* ════════ MESSAGING (animated browser) ════════ */}
      <section className="border-b border-neutral-200 px-4 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <BlurFade delay={0.1}>
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-forest">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
                Reach them directly
              </p>
              <h2 className="text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-4xl">
                Message the factory. No broker in between.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-body leading-relaxed text-neutral-600">
                Send an inquiry, share an RFQ and negotiate terms with the verified
                supplier itself — SourceBD never takes a cut or sits between you.
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.25} inView className="mt-10">
            <MessagingDemo />
          </BlurFade>
        </div>
      </section>

      {/* ════════ SOURCES & INGESTION (animated) ════════ */}
      <section className="border-b border-neutral-200 px-5 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-5xl">
          <BlurFade delay={0.1}>
            <div className="text-center">
              <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-forest">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
                Behind the record
              </p>
              <h2 className="text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-4xl">
                The evidence keeps itself current.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-body leading-relaxed text-neutral-600">
                SourceBD continuously pulls from 31 official registers,
                certification bodies and sanctions lists — then reconciles every
                claim into one canonical factory record, higher-tier evidence
                always winning.
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.25} inView className="mt-10">
            <IngestionMonitor />
          </BlurFade>
        </div>
      </section>

      {/* ════════ STATS BAND ════════ */}
      <section className="border-b border-neutral-200 px-6 py-12 md:px-12 md:py-14 lg:px-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {[
            { value: stats.suppliers_indexed, fallback: "10,000", label: "Suppliers indexed" },
            { value: stats.suppliers_with_tier1or2_source, fallback: "9,000", label: "Gov / association corroborated" },
            { value: stats.compliance_documents_mirrored, fallback: "7,000", label: "Compliance documents mirrored" },
          ].map((s, i) => (
            <BlurFade key={s.label} delay={0.1 + i * 0.08}>
              <div className="flex flex-col items-center">
                <span className="flex items-baseline gap-1 font-display text-3xl font-bold tabular-nums text-neutral-900 sm:text-4xl">
                  {typeof s.value === "number" ? (
                    <NumberTicker value={s.value} className="tracking-tight text-neutral-900" />
                  ) : (
                    s.fallback
                  )}
                  <span className="text-brand-forest">+</span>
                </span>
                <span className="mt-1.5 text-sm text-neutral-500">{s.label}</span>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ════════ POSITIONING ════════ */}
      <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <BlurFade delay={0.1}>
            <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-forest">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
              What we are
            </p>
            <h2 className="text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-4xl">
              A neutral public-record index.{" "}
              <span className="text-neutral-400">Nothing more, by design.</span>
            </h2>
          </BlurFade>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {POSITIONING.map((card) => (
              <BlurFade key={card.title} delay={0.15}>
                <MagicCard
                  className="h-full rounded-xl border border-neutral-200 bg-white p-6"
                  gradientFrom={FOREST}
                  gradientTo="var(--brand-forest-mid)"
                  gradientColor="var(--brand-forest-soft)"
                  gradientOpacity={0.12}
                >
                  <div className="flex h-full flex-col">
                    <h3 className="font-display text-lg font-semibold text-neutral-800">
                      {card.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm text-neutral-500">{card.body}</p>
                    <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700">
                      <span className="text-brand-forest">✓</span> {card.positive}
                    </p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CLOSING CTA ════════ */}
      <section className="px-6 py-16 md:py-24">
        <BlurFade delay={0.1}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              Start vetting with verified evidence behind every claim.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-balance text-neutral-600">
              Search {suppliersLabel}+ indexed Bangladesh factories and buying
              houses — free to explore.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-proto primary gap-2">
                Start free <ArrowRight size={16} />
              </Link>
              <Link href="/discover" className="btn-proto">
                Browse the index
              </Link>
            </div>
          </div>
        </BlurFade>
      </section>
    </div>
  );
}
