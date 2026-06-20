// SourceBD — marketing homepage.
//
// An enterprise-grade composition built around Magic UI's animated
// primitives, each used to carry a specific message — never for
// decoration alone:
//
//   • Globe            → BD-rooted platform serving international buyers
//   • TextHighlighter  → one deliberate emphasis in the closing CTA
//   • AvatarCircles    → 10,000+ verified companies, social proof
//   • Marquee          → the real authority logos we aggregate from
//   • NumberTicker     → the live index, in numbers (marketing_stats RPC)
//   • AnimatedBeam     → the verification engine, behind the scenes
//   • OrbitingCircles  → every claim circles back to an issuing authority
//   • AnimatedList     → live provenance feed (receipts in motion)
//   • Provider grid    → the certifications & registers we read directly
//
// Light mode only. Forest green (#1f4d3a) is a signature, not a theme.
// Nav + footer are mounted by app/(marketing)/layout.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import {
  ArrowRight,
  Buildings,
  Certificate,
  FileText,
  MagnifyingGlass,
  ShieldCheck,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";

import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { AvatarCircles } from "@/components/ui/avatar-circles";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { TextHighlighter } from "@/components/ui/text-highlighter";

import { DataPipeline } from "@/components/marketing/home/data-pipeline";
import { TrustOrbit } from "@/components/marketing/home/trust-orbit";
import { VerificationFeed } from "@/components/marketing/home/verification-feed";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";
const FOREST = "#1f4d3a";

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
      "Discover and vet verified Bangladesh RMG factories with a receipt on every claim — government registers, trade associations, certification bodies and sanctions lists in one index.",
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

// ─── Static content ──────────────────────────────────────────────

const AUTHORITY_LOGOS = [
  { src: "/inapp-logos/bgmea.png", alt: "BGMEA" },
  { src: "/inapp-logos/bkmea.png", alt: "BKMEA" },
  { src: "/inapp-logos/BTMA.webp", alt: "BTMA" },
  { src: "/inapp-logos/RSC.png", alt: "RSC" },
  { src: "/inapp-logos/okeo100.png", alt: "OEKO-TEX" },
  { src: "/inapp-logos/wrap.png", alt: "WRAP" },
  { src: "/inapp-logos/gost.png", alt: "GOTS" },
  { src: "/inapp-logos/GRS.png", alt: "GRS" },
  { src: "/inapp-logos/RCS.png", alt: "RCS" },
  { src: "/inapp-logos/OCS.png", alt: "OCS" },
  { src: "/inapp-logos/amfori.jpg", alt: "amfori BSCI" },
];

const COMPANY_AVATARS = [
  { initials: "AT", label: "Aman Tex" },
  { initials: "DG", label: "DBL Group" },
  { initials: "SK", label: "Square Knit" },
  { initials: "VT", label: "Viyellatex" },
  { initials: "PG", label: "Pacific Group" },
  { initials: "EH", label: "Epyllion" },
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

// ─── Primitives ──────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 font-[family-name:var(--mkt-font-mono)] text-xs uppercase tracking-widest text-[#1f4d3a]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1f4d3a]" />
      {children}
    </p>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--mkt-font-display)] text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
      {children}
    </h2>
  );
}

function HeroDossierPreview({ stats }: { stats: Stats }) {
  const suppliers = stats.suppliers_indexed?.toLocaleString("en-GB") ?? "10,000+";
  const documents =
    stats.compliance_documents_mirrored?.toLocaleString("en-GB") ?? "7,000+";
  const corroborated =
    stats.suppliers_with_tier1or2_source?.toLocaleString("en-GB") ?? "9,000+";

  return (
    <MagicCard
      className="mx-auto w-full max-w-[520px] rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      gradientFrom={FOREST}
      gradientTo="#2d6a4f"
      gradientColor="#ecf3ee"
      gradientOpacity={0.1}
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="font-[family-name:var(--mkt-font-mono)] text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Evidence dossier
          </p>
          <h2 className="mt-1 font-[family-name:var(--mkt-font-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Verified supplier profile
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">
            The same card language buyers use inside the portal: receipts,
            source rows, and documents before any outreach.
          </p>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-brand-forest">
          <ShieldCheck size={24} weight="duotone" aria-hidden />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 py-4">
        {[
          [suppliers, "suppliers"],
          [corroborated, "corroborated"],
          [documents, "documents"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="font-[family-name:var(--mkt-font-display)] text-xl font-bold leading-none text-neutral-900">
              {value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-neutral-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-neutral-200 pt-4">
        {[
          ["BGMEA", "Trade association register", "Verified"],
          ["RSC", "Remediation and safety evidence", "96%"],
          ["GOTS", "Certification body record", "Active"],
          ["UFLPA", "Sanctions screening", "Clear"],
        ].map(([code, label, status]) => (
          <div
            key={code}
            className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
          >
            <span className="font-[family-name:var(--mkt-font-mono)] text-xs font-semibold text-brand-forest">
              {code}
            </span>
            <span className="min-w-0 truncate text-sm text-neutral-700">{label}</span>
            <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600">
              {status}
            </span>
          </div>
        ))}
      </div>
    </MagicCard>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default async function HomeV2Page() {
  const stats = await loadStats();
  const suppliersLabel = stats.suppliers_indexed
    ? `${stats.suppliers_indexed.toLocaleString()}`
    : "10,000";

  return (
    <div className="overflow-x-hidden bg-bg-l0 font-[family-name:var(--mkt-font-body)] text-neutral-900">
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

      {/* ════════ HERO ════════ */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-white">
        <AnimatedGridPattern
          className="absolute inset-0 fill-[#1f4d3a]/[0.05] stroke-[#1f4d3a]/[0.07] text-[#1f4d3a] opacity-70 [mask-image:radial-gradient(700px_circle_at_30%_30%,white,transparent)]"
          numSquares={50}
          maxOpacity={0.09}
          duration={3}
          repeatDelay={1}
        />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-6 pb-16 pt-16 md:px-12 md:pt-24 lg:grid-cols-2 lg:gap-12 lg:px-20">
          {/* Left — message */}
          <div className="text-center lg:text-left">
            <BlurFade delay={0.15}>
              <h1 className="font-[family-name:var(--mkt-font-display)] text-[clamp(2.75rem,12vw,4.75rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-neutral-900">
                Verified
                <br />
                Bangladesh
                <br />
                <span className="text-[#1f4d3a]">factories.</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.3}>
              <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-neutral-600 sm:mt-6 md:text-lg lg:mx-0 lg:text-xl">
                Find, vet and message garment suppliers — with a receipt on
                every claim.
              </p>
            </BlurFade>

            <BlurFade delay={0.45}>
              {/* Search field with a calm, continuous comet: a single
                  forest-green segment travels the rounded-rect perimeter
                  (A→B→C→D→A) at uniform speed via SVG stroke-dashoffset
                  (pathLength-normalised). Pure CSS animation — smooth across
                  corners, no JS, no hydration cost. */}
              <form
                className="relative mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm md:px-4 md:py-2.5 lg:mx-0"
                action="/discover"
                method="get"
                role="search"
              >
                <svg
                  aria-hidden
                  className="search-comet pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  {/* One unified comet: many fine, evenly phase-shifted
                      sub-segments travel the perimeter together. Their width +
                      opacity follow a sine envelope (0 at both tips, peak in the
                      middle), so the streak reads as a single line that narrows
                      and fades at BOTH ends — not discrete steps. All share one
                      linear keyframe, so the loop is seamless and smooth across
                      corners. */}
                  {Array.from({ length: 22 }, (_, i) => {
                    const t = (i + 1) / 23; // 0..1 along the streak
                    const env = Math.sin(Math.PI * t); // 0 at ends, 1 mid
                    return (
                      <rect
                        key={i}
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx="12"
                        ry="12"
                        pathLength={100}
                        fill="none"
                        stroke="#2d6a4f"
                        strokeWidth={0.2 + env * 1.1}
                        strokeLinecap="round"
                        strokeDasharray="1 99"
                        style={{ opacity: 0.04 + env * 0.8, animationDelay: `-${i * 0.03}s` }}
                      />
                    );
                  })}
                </svg>
                <MagnifyingGlass size={20} className="hidden shrink-0 text-neutral-400 sm:block" />
                <input
                  type="search"
                  name="q"
                  placeholder="OEKO-TEX certified knit factory…"
                  aria-label="Search suppliers"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-[#1f4d3a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2d6a4f]"
                >
                  Search
                </button>
              </form>
            </BlurFade>

            {/* Avatar proof */}
            <BlurFade delay={0.6}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 md:mt-10 lg:justify-start">
                <AvatarCircles avatarUrls={COMPANY_AVATARS} overflowLabel="10k+" />
                <p className="text-[15px] text-neutral-600">
                  <span className="font-[family-name:var(--mkt-font-display)] font-bold text-neutral-900">
                    {suppliersLabel}+
                  </span>{" "}
                  verified companies indexed
                </p>
              </div>
            </BlurFade>
          </div>

          {/* Right — product-derived dossier preview. This keeps the public
              homepage visually tied to the portal instead of using an abstract
              decorative object. */}
          <BlurFade delay={0.3} className="relative hidden lg:block">
            <HeroDossierPreview stats={stats} />
            <div className="pointer-events-none mt-4 flex justify-center">
              <span className="inline-flex items-center whitespace-nowrap rounded-full border border-neutral-200 bg-white/90 px-3.5 py-1.5 font-[family-name:var(--mkt-font-mono)] text-[10px] text-neutral-600 shadow-sm backdrop-blur-sm sm:text-[11px]">
                <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-[#1f4d3a]" />
                <span className="font-semibold text-[#1f4d3a]">Dhaka HQ</span>
                <span className="mx-2 text-neutral-300">·</span>
                serving UK&nbsp;·&nbsp;US&nbsp;·&nbsp;EU&nbsp;·&nbsp;CA
              </span>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ════════ AUTHORITY MARQUEE ════════ */}
      <section id="sources" className="border-b border-neutral-200 bg-neutral-50 py-12 md:py-16">
        <div className="mx-auto mb-8 max-w-6xl px-6 text-center md:px-12 lg:px-20">
          <p className="font-[family-name:var(--mkt-font-mono)] text-[11px] uppercase tracking-[0.2em] text-[#1f4d3a] sm:text-xs">
            Sources of record
          </p>
          <h2 className="mt-2 font-[family-name:var(--mkt-font-display)] text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl md:text-3xl">
            Built on the registers buyers already trust.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-500">
            Government bodies, trade associations and certification authorities —
            aggregated, never invented.
          </p>
        </div>

        {/* edge-faded marquee for depth */}
        <div className="relative">
          <Marquee pauseOnHover className="[--duration:40s] [--gap:1.25rem]">
            {AUTHORITY_LOGOS.map((logo) => (
              <div
                key={logo.alt}
                className="flex h-16 w-32 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 shadow-[0_1px_3px_rgba(16,40,28,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#1f4d3a]/25 hover:shadow-md sm:h-20 sm:w-40 sm:px-6"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={140}
                  height={56}
                  className="max-h-9 w-auto max-w-[88px] object-contain sm:max-h-11 sm:max-w-[112px]"
                />
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-neutral-50 via-neutral-50 to-transparent sm:w-40" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-neutral-50 via-neutral-50 to-transparent sm:w-40" />
        </div>
      </section>

      {/* ════════ STATS BAND ════════ */}
      <section className="border-b border-neutral-200 px-6 py-12 md:px-12 md:py-14 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-neutral-200">
            {[
              { icon: <Buildings size={26} weight="duotone" />, value: stats.suppliers_indexed, label: "Suppliers indexed" },
              { icon: <ShieldCheck size={26} weight="duotone" />, value: stats.suppliers_with_tier1or2_source, label: "Gov / association corroborated" },
              { icon: <FileText size={26} weight="duotone" />, value: stats.compliance_documents_mirrored, label: "Compliance documents mirrored" },
              { icon: <Storefront size={26} weight="duotone" />, value: 31, label: "Official sources in sync", outOf: 31 },
            ].map((s, i) => (
              <BlurFade key={s.label} delay={0.1 + i * 0.08}>
                <div className="flex flex-col lg:px-7">
                  <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#ecf3ee] text-[#1f4d3a] shadow-[0_2px_10px_-2px_rgba(31,77,58,0.22)]">
                    {s.icon}
                  </span>
                  <span className="flex items-baseline gap-1 font-[family-name:var(--mkt-font-display)] text-3xl font-bold tabular-nums text-neutral-900 sm:text-4xl">
                    {typeof s.value === "number" ? (
                      <NumberTicker value={s.value} className="tracking-tight text-neutral-900" />
                    ) : (
                      "—"
                    )}
                    {s.outOf ? (
                      <span className="text-base font-semibold text-neutral-400 sm:text-lg">
                        / {s.outOf}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 text-sm text-neutral-500">{s.label}</span>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FEATURE 1 — Behind the scenes (AnimatedBeam) ════════ */}
      <section id="how-we-verify" className="border-b border-neutral-200 px-6 py-14 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* copy */}
          <div>
            <BlurFade delay={0.1}>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ecf3ee] text-[#1f4d3a]">
                <FileText size={30} weight="duotone" />
              </span>
              <p className="mt-6 font-[family-name:var(--mkt-font-mono)] text-xs uppercase tracking-[0.2em] text-[#1f4d3a]">
                Step 01 · Collect &amp; reconcile
              </p>
              <h2 className="mt-3 font-[family-name:var(--mkt-font-display)] text-3xl font-bold leading-tight tracking-tight text-neutral-900 md:text-[2.6rem]">
                Two sides of evidence, one verified record.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600">
                Certification bodies on one side, government registers and trade
                associations on the other — all reconciled into a single
                canonical factory record you can act on.
              </p>
            </BlurFade>

            <BlurFade delay={0.25}>
              <ul className="mt-8 space-y-4">
                {[
                  "31 official sources, continuously refreshed",
                  "Matched and de-duplicated to one canonical factory",
                  "Higher-tier evidence always overrides lower-tier",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-base text-neutral-700">
                    <ShieldCheck size={22} weight="fill" className="mt-0.5 shrink-0 text-[#1f4d3a]" />
                    {line}
                  </li>
                ))}
              </ul>
            </BlurFade>
          </div>

          {/* borderless visual — bleeds into the page, no box */}
          <BlurFade delay={0.2}>
            <div className="relative mx-auto w-full max-w-[440px] sm:max-w-[480px]">
              <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(31,77,58,0.08),transparent_68%)]" />
              <DataPipeline />
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ════════ FEATURE 2 — Live provenance feed (AnimatedList) ════════ */}
      <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* borderless visual (left on desktop) — bleeds into the page */}
          <BlurFade delay={0.2} className="order-2 lg:order-1">
            <div className="relative mx-auto w-full max-w-[480px] lg:mx-0">
              <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_50%_45%,rgba(31,77,58,0.08),transparent_68%)]" />
              <VerificationFeed />
            </div>
          </BlurFade>

          {/* copy */}
          <div className="order-1 lg:order-2">
            <BlurFade delay={0.1}>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ecf3ee] text-[#1f4d3a]">
                <ShieldCheck size={30} weight="duotone" />
              </span>
              <p className="mt-6 font-[family-name:var(--mkt-font-mono)] text-xs uppercase tracking-[0.2em] text-[#1f4d3a]">
                Step 02 · Receipts, in real time
              </p>
              <h2 className="mt-3 font-[family-name:var(--mkt-font-display)] text-3xl font-bold leading-tight tracking-tight text-neutral-900 md:text-[2.6rem]">
                Watch the evidence land, claim by claim.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600">
                Register matches, certificate confirmations and sanctions
                screens stream into each supplier profile — every row a receipt
                from a named issuer, with the tier and date attached.
              </p>
            </BlurFade>

            <BlurFade delay={0.25}>
              <Link
                href="/discover"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#1f4d3a] px-5 py-3 text-sm font-medium !text-white shadow-sm transition-colors hover:bg-[#2d6a4f]"
              >
                Explore the index <ArrowRight size={16} />
              </Link>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* ════════ FEATURE 3 — Trust hierarchy (OrbitingCircles) ════════ */}
      <section className="border-b border-neutral-200 px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* copy */}
          <div>
            <BlurFade delay={0.1}>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ecf3ee] text-[#1f4d3a]">
                <Certificate size={30} weight="duotone" />
              </span>
              <p className="mt-6 font-[family-name:var(--mkt-font-mono)] text-xs uppercase tracking-[0.2em] text-[#1f4d3a]">
                Step 03 · Ranked by authority
              </p>
              <h2 className="mt-3 font-[family-name:var(--mkt-font-display)] text-3xl font-bold leading-tight tracking-tight text-neutral-900 md:text-[2.6rem]">
                Every claim circles back to an authority.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600">
                We never publish a proprietary score. Each fact on a profile is
                ranked by the body that issued it — government and statutory
                first, then associations, certification bodies, brand
                disclosures, and sanctions screening.
              </p>
            </BlurFade>

            <BlurFade delay={0.25}>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {["Government", "Associations", "Certifications", "Brand disclosures", "Sanctions", "Cross-check"].map(
                  (t, i) => (
                    <span
                      key={t}
                      className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700"
                    >
                      <span className="font-[family-name:var(--mkt-font-mono)] text-[#1f4d3a]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {t}
                    </span>
                  ),
                )}
              </div>
            </BlurFade>
          </div>

          {/* borderless orbit — bleeds into the page */}
          <BlurFade delay={0.2}>
            <div className="relative mx-auto flex w-full max-w-[460px] scale-[0.82] justify-center sm:scale-95 lg:scale-110">
              <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_center,rgba(31,77,58,0.09),transparent_62%)]" />
              <TrustOrbit />
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ════════ POSITIONING ════════ */}
      <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <BlurFade delay={0.1}>
            <Kicker>What we are</Kicker>
            <Heading>
              A neutral public-record index.{" "}
              <span className="text-neutral-400">Nothing more, by design.</span>
            </Heading>
          </BlurFade>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-12 md:grid-cols-3">
            {POSITIONING.map((card) => (
              <BlurFade key={card.title} delay={0.15}>
                <MagicCard
                  className="rounded-xl border border-neutral-200 bg-white p-6"
                  gradientFrom={FOREST}
                  gradientTo="#2d6a4f"
                  gradientColor="#ecf3ee"
                  gradientOpacity={0.12}
                >
                  <div className="flex h-full flex-col">
                    <h3 className="font-[family-name:var(--mkt-font-display)] text-lg font-semibold text-neutral-800">
                      {card.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm text-neutral-500">{card.body}</p>
                    <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-700">
                      <span className="text-[#1f4d3a]">✓</span> {card.positive}
                    </p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA ════════ */}
      <section className="px-6 py-20 md:px-12 md:py-24 lg:px-20">
        <div className="mx-auto max-w-6xl text-center">
          <BlurFade delay={0.1}>
            <h2 className="font-[family-name:var(--mkt-font-display)] text-3xl font-bold tracking-tight text-neutral-900 md:text-5xl">
              Start vetting with{" "}
              <TextHighlighter
                highlightColor="#bfe3cf"
                transition={{ type: "spring", duration: 1, delay: 0.2, bounce: 0 }}
              >
                receipts on every claim.
              </TextHighlighter>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-neutral-600">
              Free to search the index. No marketplace fees, ever — just the
              public record, refreshed weekly.
            </p>
          </BlurFade>

          <BlurFade delay={0.25}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup">
                <ShimmerButton className="px-8 py-3" background="#1f4d3a">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    Start free <ArrowRight size={16} />
                  </span>
                </ShimmerButton>
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
              >
                See pricing
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>
    </div>
  );
}
