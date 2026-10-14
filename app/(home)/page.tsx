// SourceBD home: the Mercury page (Paper "32 Home · Mercury direction", `components/site/home/`) unless the film is
// asked for. The film (`components/site/home.tsx` with `film`) is behind its flag: `?film=1` for one visit, or a
// build with NEXT_PUBLIC_HOME_FILM set to anything but 0. Figures are the site's live facts (`lib/site-facts.ts`,
// cached ten minutes). Nav, announcement and cookie banner are the (home) layout's; each branch draws its footer.

import type { Metadata } from "next";
import { filmOn } from "@/components/site/film/engine/tier";
import { SiteFooter } from "@/components/site/footer";
import { Home } from "@/components/site/home";
import { loadChips } from "@/components/site/home/chips";
import { HomeMercury } from "@/components/site/home/index";
import { loadHomeRecords } from "@/lib/home-records";
import { loadSiteFacts, withCommas } from "@/lib/site-facts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const dynamic = "force-dynamic";

/** The live published count, as the hero says it; with no read count the sentence has no number (never a rounded "10,000+"). */
function homeDescription(suppliers: number | null): string {
  const search = suppliers !== null ? `Search ${withCommas(suppliers)} factories and buying houses` : "Search factories and buying houses";
  return `Every fact on a Bangladesh garment supplier, with its source and the date we read it. ${search} checked against the registers that list them. No scores. No paid placement.`;
}

export async function generateMetadata(): Promise<Metadata> {
  return { ...HOME_METADATA, description: homeDescription((await loadSiteFacts()).suppliers) };
}

const HOME_METADATA: Metadata = {
  title: "SourceBD — Bangladesh sourcing, on the record",
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

/** The Mercury page's live reads, in parallel: the chips' counts and the three records. Each is soft and cached. */
async function mercuryData() {
  const [chips, records] = await Promise.all([loadChips(), loadHomeRecords()]);
  return { chips, ...records };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ film?: string | string[] }> }) {
  const { film } = await searchParams;
  // The film is off unless asked for: an unset build flag now means the Mercury page (filmOn reads unset as on).
  const showFilm = filmOn(film, process.env.NEXT_PUBLIC_HOME_FILM ?? "0");
  const year = new Date().getUTCFullYear();
  // Side by side: the facts used to be read first and the page's own reads only after them.
  const [facts, data] = await Promise.all([loadSiteFacts(), showFilm ? null : mercuryData()]);
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
        <HomeMercury facts={facts} year={year} {...data} />
      )}
    </>
  );
}
