// SourceBD home: the Mercury page (Paper "32 Home · Mercury direction", `components/site/home/`) unless the film is
// asked for. The film (`components/site/home.tsx` with `film`) is behind its flag: `?film=1` for one visit, or a
// build with NEXT_PUBLIC_HOME_FILM set to anything but 0. Figures are the site's live facts (`lib/site-facts.ts`,
// cached ten minutes). Nav, announcement and cookie banner are the (home) layout's; each branch draws its footer.

import type { Metadata } from "next";
import { filmOn } from "@/components/site/film/engine/tier";
import { SiteFooter } from "@/components/site/footer";
import { Home } from "@/components/site/home";
import { HomeMercury } from "@/components/site/home/index";
import { loadSiteFacts } from "@/lib/site-facts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SourceBD — Bangladesh sourcing, on the record",
  description:
    "Every fact on a Bangladesh garment supplier, with its source and the date we read it. Search 10,000+ factories and buying houses checked against the registers that list them. No scores. No paid placement.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "SourceBD — Bangladesh sourcing, on the record",
    description: "Every fact on a Bangladesh garment supplier, with its source and date. No scores. No paid placement.",
    url: `${SITE_URL}/`,
    siteName: "SourceBD",
    locale: "en_GB",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "SourceBD — Bangladesh sourcing, on the record", description: "Every fact on a Bangladesh garment supplier, with its source and date." },
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ film?: string | string[] }> }) {
  const [facts, { film }] = await Promise.all([loadSiteFacts(), searchParams]);
  // The film is off unless asked for: an unset build flag now means the Mercury page (filmOn reads unset as on).
  const showFilm = filmOn(film, process.env.NEXT_PUBLIC_HOME_FILM ?? "0");
  const year = new Date().getUTCFullYear();
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
      {showFilm ? (
        <>
          <Home facts={facts} film />
          <SiteFooter facts={facts} year={year} />
        </>
      ) : (
        <HomeMercury facts={facts} year={year} />
      )}
    </>
  );
}
