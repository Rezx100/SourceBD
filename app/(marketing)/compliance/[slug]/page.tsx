// Compliance guide (B9f restyle of Spec M3): one file, five prerendered routes via `generateStaticParams()`. Unknown
// slugs are decided by the router (`dynamicParams = false`) and `notFound()` stays as the second guard. The guide
// is drawn by `components/site/guides.tsx` from `lib/marketing/compliance-pages`, whose words are unchanged.
// `assertContentFresh()` throws at render so a stale guide fails `pnpm build`.

import { notFound } from "next/navigation";
import { GuideArticle } from "@/components/site/guides";
import { COMPLIANCE_PAGES, assertContentFresh, findCompliancePage } from "@/lib/marketing/compliance-pages";

export const dynamic = "force-static";
export const dynamicParams = false;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export function generateStaticParams() {
  return COMPLIANCE_PAGES.map((p) => ({ slug: p.slug }));
}

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
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

export default async function ComplianceGuidePage({ params }: { params: Promise<Params> }) {
  assertContentFresh();

  const { slug } = await params;
  const page = findCompliancePage(slug);
  if (!page) {
    notFound();
  }

  return (
    <>
      {/* M4 — JSON-LD Article. `datePublished` and `dateModified` both derive from the single `last_reviewed_at`
          field (the guide is a living summary; spec M4 JC #7). */}
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
      <GuideArticle page={page} />
    </>
  );
}
