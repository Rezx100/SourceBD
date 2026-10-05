// Public supplier record (anon, /suppliers/[slug]). B9g restyled it onto the v4 record: the page now builds the
// buyer record's own model (`buildSheet`) from the same public profile read and draws it with
// `components/record/public-record.tsx`. Only the markup changed. The data read, the miss handling (404, the 308
// to the mother company, the timeout 307s), the cache lifetime and the JSON-LD are exactly as REZ-72 and its
// successors left them, and the HTTP-boundary guard (`scripts/test-profile-http-boundary.mjs`) holds them.
//
// Hard contracts preserved:
//   - RPC `public.buyer_supplier_profile` is unchanged (no DB migration).
//   - No contact value reaches this page: the record model carries counts at most, and here not even those
//     (`contactCounts: null`, Contact is locked); filed addresses are stripped of phones and emails by the
//     record builder (`lib/contact-text.ts`), as on the buyer's record.
//   - No SBI / pillar / grade / score. The sanctions band overrides the page when an active hit exists, and
//     "Sign up to contact" is replaced by the refusal in words.
//   - Source trust hierarchy is law: the Sources section lists each register with its tier and the day it was read.
//   - M4 JSON-LD Organization / LocalBusiness preserved.
//   - No `loading.tsx` anywhere above this page (see `app/(public)/layout.tsx`): its `notFound()` and
//     `permanentRedirect()` must reach the wire as a real 404 and 308.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { PublicRecord } from "@/components/record/public-record";
import { buildSheet, type ProfilePayload } from "@/lib/dashboard/build-models";
import { resolveUnpublishedProfileMiss } from "@/lib/facility-parent-redirect";
import { sanitizeFacilityPanel, type FacilityPanel } from "@/lib/format-facility-group";
import { getPublicSupplierProfile, ProfileStatementTimeout } from "@/lib/public-supplier-profile";
import { siteOriginFromEnv, urlOnSite } from "@/lib/site-origin";

export const dynamic = "force-static";
export const revalidate = 300;
export const dynamicParams = true;

const SITE_URL = siteOriginFromEnv();

/** The payload's supplier carries a country the record model does not read; the metadata and JSON-LD do. */
type Supplier = ProfilePayload["supplier"] & { country?: string | null };

// ---------- metadata ------------------------------------------------------

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const pack = await getPublicSupplierProfile(slug);
    if (pack.timedOut) {
      return {
        title: "Service temporarily slow — SourceBD",
        robots: { index: false, follow: false },
      };
    }
    if (!pack.data) return { title: "Supplier — SourceBD" };
    const s = (pack.data as ProfilePayload).supplier as Supplier;
    const loc = [s.city, s.district, s.country].filter(Boolean).join(", ");
    const title = `${s.company_name} — Bangladesh RMG supplier on SourceBD`;
    const description = loc
      ? `${s.company_name}, ${loc}. Verified registers, certifications, and source evidence on SourceBD.`
      : `${s.company_name}. Verified registers, certifications, and source evidence on SourceBD.`;
    return {
      title,
      description,
      robots: { index: true, follow: true },
      alternates: { canonical: `${SITE_URL}/suppliers/${slug}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/suppliers/${slug}`,
        type: "profile",
      },
    };
  } catch (err) {
    const isTimeout = err instanceof ProfileStatementTimeout || (err instanceof Error && err.name === "ProfileStatementTimeout");
    if (isTimeout) {
      return {
        title: "Service temporarily slow — SourceBD",
        robots: { index: false, follow: false },
      };
    }
    return { title: "Supplier — SourceBD" };
  }
}

// ---------- entry --------------------------------------------------------

export default async function PublicSupplierProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await getPublicSupplierProfile(slug);
  if (pack.timedOut) {
    // Middleware issues the uncached 307. Do not redirect() here:
    // force-static would give that 307 s-maxage=300. A throw is not
    // stored as a factory page.
    throw new ProfileStatementTimeout(slug);
  }
  const { data, parentSlug, facilityRaw, epbHs } = pack;
  if (data == null) {
    const miss = resolveUnpublishedProfileMiss({
      profileFound: false,
      parentSlug,
      routeGroup: "public",
    });
    if (miss.action === "redirect") {
      permanentRedirect(urlOnSite(miss.path).toString());
    }
    notFound();
  }

  const profile = data as ProfilePayload;
  const s = profile.supplier as Supplier;
  // As the buyer's record reads it (`fetchFacilityPanel`): a panel with no buildings is a panel ("No extension
  // buildings on this record."); only a failed or malformed read is `null`, which says the buildings could not be read.
  const facilitiesPanel =
    facilityRaw && typeof facilityRaw === "object" && Array.isArray((facilityRaw as FacilityPanel).facilities) && (facilityRaw as FacilityPanel).group
      ? sanitizeFacilityPanel(facilityRaw as FacilityPanel)
      : null;

  // The model is the buyer record's own. Fixed at the page's own revalidation, which is at most five minutes old.
  const today = new Date();
  const model = buildSheet(
    { profile, hscodes: epbHs.hscodes, hscodesError: epbHs.loadError, workers: null, today },
    {
      // Contact is locked here: no counts, no values, no plan.
      contactCounts: null,
      // `panel: null` says "the buildings could not be read", which is what a timed-out read is.
      facilities: { panel: facilitiesPanel },
      supplierId: null,
      saved: false,
      rfqHref: null,
      fullHref: `/suppliers/${s.slug}`,
      closeHref: null,
      // A line's own page is the buyer's: a visitor is taken to sign up and then to it.
      lineHref: (hs) => `/signup?next=${encodeURIComponent(`/app/suppliers/${s.slug}/lines/${hs}`)}`,
      allLinesHref: null,
    },
  );

  const hasLocality = !!(s.city || s.district);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": hasLocality ? "LocalBusiness" : "Organization",
    name: s.company_name,
    url: `${SITE_URL}/suppliers/${s.slug}`,
  };
  if (hasLocality || s.country) {
    ld.address = {
      "@type": "PostalAddress",
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.district ? { addressRegion: s.district } : {}),
      ...(s.country ? { addressCountry: s.country } : {}),
    };
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PublicRecord model={model} today={today} />
    </main>
  );
}
