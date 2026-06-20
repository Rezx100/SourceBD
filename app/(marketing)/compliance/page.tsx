// Spec M3 — Compliance Hub. Public, indexable, static.
//
// Hub for 5 regulation detail pages. JC #11 ack: hybrid hub + detail
// pattern, hub lists tiles, detail pages carry the receipts.
//
// Inline staleness assertion (locked-in JC #8): calls
// `assertContentFresh()` so any page in `COMPLIANCE_PAGES` older than
// 365 days throws at render — failing `pnpm build`, not just smoke.
//
// Role-aware CTA strip (locked-in JC #7): wraps `getServerRole()` in
// try/catch returning null so static prerender without runtime env
// renders the anon variant rather than crashing the build (same
// pattern as `components/marketing/top-nav.tsx`).
//
// Design: Magic UI BlurFade entrances, MagicCard for regulation tiles,
// ShimmerButton for primary CTA — unified with home page.

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";

import { getServerRole, type Role } from "@/lib/auth";
import {
  COMPLIANCE_PAGES,
  DISCLAIMER,
  HUB_METADATA,
  assertContentFresh,
  oldestReviewedAt,
} from "@/lib/marketing/compliance-pages";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";
const FOREST = "#1f4d3a";

export const metadata = {
  title: HUB_METADATA.title,
  description: HUB_METADATA.description,
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/compliance" },
};

function ctaFor(role: Role | null): { href: string; label: string } {
  if (role === "buyer" || role === "admin") {
    return { href: "/app/suppliers", label: "Open the supplier index" };
  }
  if (role === "supplier") {
    return { href: "/supplier", label: "Go to supplier portal" };
  }
  return { href: "/signup?plan=starter", label: "Start free" };
}

export default async function ComplianceHubPage() {
  assertContentFresh();

  let role: Role | null = null;
  try {
    role = await getServerRole();
  } catch {
    role = null;
  }
  const cta = ctaFor(role);
  const reviewedAt = oldestReviewedAt();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">

      {/* ── Hero ── */}
      <section className="text-center">
        <BlurFade delay={0.1}>
          <p className="mb-3 inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[#1f4d3a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f4d3a]" />
            Compliance guides
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            <span className="text-[#1f4d3a]">Compliance</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.2}>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600">
            {HUB_METADATA.headline}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-400 leading-relaxed">
            {HUB_METADATA.summary}
          </p>
        </BlurFade>
      </section>

      {/* ── Regulation tiles ── */}
      <section className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {COMPLIANCE_PAGES.map((page, i) => (
          <BlurFade key={page.slug} delay={0.15 + i * 0.07}>
            <Link href={`/compliance/${page.slug}`} className="block h-full">
              <MagicCard
                className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md"
                gradientFrom={FOREST}
                gradientTo="#2d6a4f"
                gradientColor="#ecf3ee"
                gradientOpacity={0.1}
              >
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-neutral-900">
                  {page.shortName}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                  {page.headline}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1f4d3a]">
                  Read the guide <ArrowRight size={13} />
                </span>
              </MagicCard>
            </Link>
          </BlurFade>
        ))}
      </section>

      {/* ── CTA band ── */}
      <BlurFade delay={0.15}>
        <section className="mt-16 overflow-hidden rounded-2xl border border-[#1f4d3a]/20 bg-[#ecf3ee] p-10 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-neutral-900">
            Use SourceBD&apos;s{" "}
            <span className="text-[#1f4d3a]">receipts</span> on every claim
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Every supplier profile carries source pills with issuer, URL,
            and last-seen date — the same provenance trail your compliance
            team needs.
          </p>
          <div className="mt-6 inline-block">
            <Link href={cta.href}>
              <ShimmerButton className="px-8 py-3 text-sm font-medium" background={FOREST}>
                {cta.label}
              </ShimmerButton>
            </Link>
          </div>
        </section>
      </BlurFade>

      <p className="mx-auto mt-12 text-center text-[11px] text-neutral-400">
        {DISCLAIMER} Last reviewed: {reviewedAt}.
      </p>
    </main>
  );
}
