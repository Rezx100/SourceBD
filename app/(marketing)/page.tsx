// SourceBD home, "Know who you're buying from" (B9b): nine chapters that each answer one question a buyer asks about a
// new factory, then the FAQ. The page is `components/site/home.tsx`; its figures are the site's live facts
// (`lib/site-facts.ts`, cached ten minutes). Nav, footer and the cookie banner are the marketing chrome.

import type { Metadata } from "next";
import { filmOn } from "@/components/site/film/engine/tier";
import { Home } from "@/components/site/home";
import { loadSiteFacts } from "@/lib/site-facts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SourceBD — Know who you’re buying from",
  description:
    "Every fact on a Bangladesh garment supplier, with its source and the date we read it. Search 10,000+ factories and buying houses checked against the registers that list them. No scores. No paid placement.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "SourceBD — Know who you’re buying from",
    description: "Every fact on a Bangladesh garment supplier, with its source and date. No scores. No paid placement.",
    url: `${SITE_URL}/`,
    siteName: "SourceBD",
    locale: "en_GB",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "SourceBD — Know who you’re buying from", description: "Every fact on a Bangladesh garment supplier, with its source and date." },
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ film?: string | string[] }> }) {
  const [facts, { film }] = await Promise.all([loadSiteFacts(), searchParams]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "SourceBD",
            url: SITE_URL,
            description: "Every fact on a Bangladesh garment supplier, with its source and date.",
            areaServed: ["GB", "US", "EU", "CA"],
          }),
        }}
      />
      <Home facts={facts} film={filmOn(film, process.env.NEXT_PUBLIC_HOME_FILM)} />
    </>
  );
}
