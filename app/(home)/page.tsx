// SourceBD home: the Mercury page (`components/site/home.tsx`, drawn from `components/site/sections`). Figures are the
// site's live facts (`lib/site-facts.ts`, cached ten minutes). Nav, announcement, footer and cookie banner are the
// (home) layout's. The film home page and its `?film=1` switch were retired on 14 Oct 2026 (M1). The page streams:
// the three records are not waited for before the first paint, which drew a white page for two to three seconds in
// production (critique 22 Oct, S9; 22 Oct: 2.3 s to the first byte against 0.6 s for /pricing). The common-search
// chips and their counts left the page on the founder's recording of 22 Oct 13:17.

import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeMercury } from "@/components/site/home";
import { homeDescription } from "@/components/site/sections/hero";
import { RealRecords } from "@/components/site/sections/real-records";
import { loadHomeRecords } from "@/lib/home-records";
import { loadSiteFacts } from "@/lib/site-facts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const dynamic = "force-dynamic";

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

type Records = ReturnType<typeof loadHomeRecords>;

async function LiveRecords({ records }: { records: Records }) {
  return <RealRecords cards={(await records).cards} />;
}

export default async function HomePage() {
  // The facts (cached ten minutes) are the only read the first paint waits for; the records start now and stream.
  const records = loadHomeRecords();
  const facts = await loadSiteFacts();
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
      <HomeMercury
        facts={facts}
        slots={{
          records: (
            <Suspense fallback={null}>
              <LiveRecords records={records} />
            </Suspense>
          ),
        }}
      />
    </>
  );
}
