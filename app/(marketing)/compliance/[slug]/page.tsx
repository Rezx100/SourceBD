// Spec M3 — Compliance regulation detail page. Public, indexable, static.
//
// One file, 5 prerendered routes via `generateStaticParams()`. Unknown
// slugs return `notFound()`. Each page renders the JC #11 six-section
// anatomy: What it is · Who it applies to · What you must do ·
// Penalties · How SourceBD's data helps · References.
//
// Inline staleness assertion (locked-in JC #8): `assertContentFresh()`
// throws at render so a stale page fails `pnpm build`, not just smoke.
//
// Role-aware CTA wraps `getServerRole()` in try/catch returning null
// (locked-in JC #7) so static prerender without runtime env renders
// the anon variant rather than crashing the build.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";

import { getServerRole, type Role } from "@/lib/auth";
import {
  COMPLIANCE_PAGES,
  DISCLAIMER,
  SECTION_ORDER,
  assertContentFresh,
  findCompliancePage,
} from "@/lib/marketing/compliance-pages";

export const dynamic = "force-static";
export const dynamicParams = false;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export function generateStaticParams() {
  return COMPLIANCE_PAGES.map((p) => ({ slug: p.slug }));
}

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const page = findCompliancePage(slug);
  if (!page) {
    return { title: "Compliance — SourceBD" };
  }
  return {
    title: `${page.shortName} — SourceBD compliance guide`,
    description: page.seo.description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE_URL}/compliance/${page.slug}` },
    openGraph: {
      title: page.seo.ogTitle,
      description: page.seo.description,
      url: `${SITE_URL}/compliance/${page.slug}`,
      type: "article",
    },
  };
}

function ctaFor(role: Role | null): { href: string; label: string } {
  if (role === "buyer" || role === "admin") {
    return { href: "/app/suppliers", label: "Open the supplier index" };
  }
  if (role === "supplier") {
    return { href: "/supplier", label: "Go to supplier portal" };
  }
  return { href: "/signup?plan=starter", label: "Start free" };
}

export default async function ComplianceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  assertContentFresh();

  const { slug } = await params;
  const page = findCompliancePage(slug);
  if (!page) {
    notFound();
  }

  let role: Role | null = null;
  try {
    role = await getServerRole();
  } catch {
    role = null;
  }
  const cta = ctaFor(role);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-9 sm:px-6 sm:py-14 md:py-16">
      {/* M4 — JSON-LD Article. `datePublished` and `dateModified` both
          derive from the single `last_reviewed_at` field (CompliancePage
          has no separate publish date — the page is a living summary;
          per spec M4 JC #7). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: page.title,
            description: page.seo.description,
            datePublished: page.last_reviewed_at,
            dateModified: page.last_reviewed_at,
            mainEntityOfPage: `${SITE_URL}/compliance/${page.slug}`,
            author: { "@type": "Organization", name: "SourceBD" },
            publisher: { "@type": "Organization", name: "SourceBD" },
          }),
        }}
      />

      <BlurFade delay={0.05}>
        <nav aria-label="Breadcrumb" className="text-[12px] text-neutral-400">
          <Link href="/compliance" className="hover:text-neutral-700">
            Compliance
          </Link>
          <span className="mx-2">/</span>
          <span>{page.shortName}</span>
        </nav>
      </BlurFade>

      <BlurFade delay={0.1}>
        <header className="mt-4">
          <h1 className="text-balance font-display text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {page.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {page.summary}
          </p>
        </header>
      </BlurFade>

      <BlurFade delay={0.15}>
      <article className="mt-8 min-w-0 space-y-6 overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6 md:mt-10 md:space-y-8 md:p-8">
        {SECTION_ORDER.map((heading) => {
          const section = page.sections.find((s) => s.heading === heading);
          if (!section) return null;
          return (
            <section key={heading} className="border-b border-neutral-100 pb-6 last:border-b-0 last:pb-0 md:pb-8">
              <h2 className="font-display text-lg font-semibold text-ink-primary sm:text-xl">
                {section.heading}
              </h2>
              <div className="mt-3 min-w-0 space-y-3 text-pretty break-words text-[14px] leading-relaxed text-ink-secondary sm:text-sm">
                {section.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
                {section.bullets ? (
                  <ul className="ml-4 list-disc space-y-1 sm:ml-5">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          );
        })}

        <section className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-ink-primary sm:text-xl">
            References
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] sm:text-sm">
            {page.references.map((ref) => (
              <li key={ref.url} className="break-words leading-relaxed">
                <a
                  href={ref.url}
                  className="text-brand-forest underline hover:text-ink-primary"
                  rel="noopener noreferrer external"
                  target="_blank"
                >
                  {ref.label}
                </a>
                <span className="text-ink-tertiary">
                  {" "}— {ref.issuer}. Accessed {ref.accessed_on}.
                </span>
              </li>
            ))}
          </ul>
        </section>
      </article>
      </BlurFade>

      <BlurFade delay={0.2}>
        <section className="mt-10 overflow-hidden rounded-lg border border-brand-forest/20 bg-brand-forest-soft p-5 text-center sm:mt-12 sm:p-8">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-900 sm:text-xl">
            <span className="text-brand-forest">Verified evidence</span> on every supplier
          </h2>
          <p className="mx-auto mt-3 max-w-md !text-center text-[14px] leading-relaxed text-neutral-600 sm:text-sm">
            Each SourceBD supplier profile carries source pills with
            issuer, URL, and last-seen date — the trail your auditor
            asks for.
          </p>
          <div className="mt-5 inline-block">
            <Link href={cta.href} className="btn-proto primary gap-2 px-5 py-2.5 text-sm sm:px-7">
              {cta.label} <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </BlurFade>

      <p className="mx-auto mt-12 text-center text-[12px] text-neutral-400">
        {DISCLAIMER} Last reviewed: {page.last_reviewed_at}.
      </p>
    </main>
  );
}
