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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-tertiary">
        <Link href="/compliance" className="hover:text-ink-primary">
          Compliance
        </Link>
        <span className="mx-2">/</span>
        <span>{page.shortName}</span>
      </nav>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-semibold tracking-tightish text-ink-primary md:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 text-base text-ink-secondary leading-relaxed">
          {page.summary}
        </p>
      </header>

      <article className="mt-10 space-y-10">
        {SECTION_ORDER.map((heading) => {
          const section = page.sections.find((s) => s.heading === heading);
          if (!section) return null;
          return (
            <section key={heading}>
              <h2 className="font-display text-xl font-semibold text-ink-primary">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm text-ink-secondary leading-relaxed">
                {section.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
                {section.bullets ? (
                  <ul className="ml-5 list-disc space-y-1">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          );
        })}

        <section>
          <h2 className="font-display text-xl font-semibold text-ink-primary">
            References
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {page.references.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  className="text-accent-indigo underline hover:text-ink-primary"
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

      <section className="mt-16 rounded-lg border border-ink-200 bg-bg-l1 p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-ink-primary">
          Receipts on every supplier
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary leading-relaxed">
          Each SourceBD supplier profile carries source pills with
          issuer, URL, and last-seen date — the trail your auditor
          asks for.
        </p>
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center rounded-md bg-ink-primary px-5 py-2.5 text-sm font-medium text-bg-l0 hover:bg-ink-900"
        >
          {cta.label}
        </Link>
      </section>

      <p className="mt-12 text-center text-xs text-ink-tertiary">
        {DISCLAIMER} Last reviewed: {page.last_reviewed_at}.
      </p>
    </main>
  );
}
