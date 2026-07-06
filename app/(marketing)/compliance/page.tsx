// Spec M3 — Compliance Hub. Public, indexable, static.
//
// Hub for 5 regulation detail pages. JC #11 ack: hybrid hub + detail
// pattern, hub lists tiles, detail pages carry the verified evidence.
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

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">

      {/* ── Hero ── */}
      <section className="text-center">
        <BlurFade delay={0.1}>
          <p className="mb-3 inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-brand-forest sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Compliance guides
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl">
            <span className="text-brand-forest">Compliance</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.2}>
          <p className="mx-auto mt-4 max-w-lg !text-center text-sm leading-relaxed text-neutral-600 sm:text-base">
            {HUB_METADATA.headline}
          </p>
          <p className="mx-auto mt-3 max-w-md !text-center text-sm leading-relaxed text-neutral-400">
            {HUB_METADATA.summary}
          </p>
        </BlurFade>
      </section>

      {/* ── Regulation tiles ── */}
      <section className="mt-9 grid grid-cols-1 gap-3 sm:mt-12 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {COMPLIANCE_PAGES.map((page, i) => (
          <BlurFade key={page.slug} delay={0.15 + i * 0.07}>
            <Link href={`/compliance/${page.slug}`} className="block h-full">
              <MagicCard
                className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-forest/25 hover:bg-neutral-50 sm:p-6"
                gradientFrom="var(--brand-forest)"
                gradientTo="var(--brand-forest-mid)"
                gradientColor="var(--brand-forest-soft)"
                gradientOpacity={0.1}
              >
                <h2 className="font-display text-base font-bold text-neutral-900 sm:text-lg">
                  {page.shortName}
                </h2>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-neutral-500 sm:text-sm">
                  {page.headline}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-forest">
                  Read the guide <ArrowRight size={17} />
                </span>
              </MagicCard>
            </Link>
          </BlurFade>
        ))}
      </section>

      {/* ── CTA band ── */}
      <BlurFade delay={0.15}>
        <section className="mt-10 overflow-hidden rounded-lg border border-brand-forest/20 bg-brand-forest-soft p-5 text-center sm:mt-16 sm:p-10">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
            Use SourceBD&apos;s{" "}
            <span className="text-brand-forest">verified evidence</span> behind every claim
          </h2>
          <p className="mx-auto mt-3 max-w-md !text-center text-[14px] leading-relaxed text-neutral-600 sm:text-sm">
            Every supplier profile carries source pills with issuer, URL,
            and last-seen date — the same provenance trail your compliance
            team needs.
          </p>
          <div className="mt-6 inline-block">
            <Link href={cta.href} className="btn-proto primary px-7 py-2.5 text-sm">
              {cta.label}
            </Link>
          </div>
        </section>
      </BlurFade>

      <p className="mx-auto mt-12 text-center text-[12px] text-neutral-400">
        {DISCLAIMER} Last reviewed: {reviewedAt}.
      </p>
    </main>
  );
}
