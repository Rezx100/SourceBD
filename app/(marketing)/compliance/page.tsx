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

import Link from "next/link";

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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <h1 className="font-display text-4xl font-light tracking-tight text-ink-primary md:text-5xl">
          <span className="proto-wordmark text-4xl md:text-5xl">Compliance</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-secondary leading-relaxed">
          {HUB_METADATA.headline}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-tertiary leading-relaxed">
          {HUB_METADATA.summary}
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {COMPLIANCE_PAGES.map((page) => (
          <Link
            key={page.slug}
            href={`/compliance/${page.slug}`}
            className="proto-card hoverable flex flex-col"
          >
            <h2 className="font-display text-lg font-semibold text-ink-primary">
              {page.shortName}
            </h2>
            <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
              {page.headline}
            </p>
            <span className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-[0.08em] text-brand-forest">
              Read the guide →
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-hero border border-hairline-strong bg-brand-forest-soft p-10 text-center">
        <h2 className="font-display text-2xl font-light tracking-tight text-ink-primary">
          Use SourceBD&apos;s{" "}
          <span className="proto-wordmark text-2xl">receipts</span> on every
          claim
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-secondary leading-relaxed">
          Every supplier profile carries source pills with issuer, URL,
          and last-seen date — the same provenance trail your
          compliance team needs.
        </p>
        <Link href={cta.href} className="btn-proto primary mt-6 inline-flex">
          {cta.label}
        </Link>
      </section>

      <p className="affiliation-disclaimer mx-auto mt-12 text-center">
        {DISCLAIMER} Last reviewed: {reviewedAt}.
      </p>
    </main>
  );
}
