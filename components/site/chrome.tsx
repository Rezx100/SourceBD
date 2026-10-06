// Shared marketing chrome + metadata defaults. Used by both marketing-surface route groups:
//
//   - `app/(marketing)` — home, pricing, legal, discover, …
//   - `app/(public)`    — the public supplier profile, kept in its own group
//     so no `loading.tsx` sits above it (REZ-72: a Suspense fallback anywhere
//     in the chain flushes the shell early and turns the profile's 404/308
//     into a soft-200).
//
// Keep the two groups rendering identical chrome by changing it here only. B9a: the v4 navigation, mega
// footer and cookie banner (`components/site/`); analytics start only after the visitor's yes.

import type { Metadata } from "next";

import { CookieBanner } from "@/components/site/cookie-banner";
import { SiteFooter } from "@/components/site/footer";
import { SiteNav } from "@/components/site/nav";
import { ScrollToTop } from "@/components/site/scroll-to-top";
import { SkipLink } from "@/components/site/skip-link";
import { siteOriginFromEnv } from "@/lib/site-origin";
import { loadSiteFacts } from "@/lib/site-facts";
import { PostHogProvider } from "@/lib/posthog/provider";

const SITE_URL = siteOriginFromEnv();

// M4: default OpenGraph + Twitter card metadata + `metadataBase` for the
// marketing surface. Per-page `metadata` exports override these defaults
// (Next merges them shallowly). The root `app/layout.tsx` intentionally owns
// no OG/twitter keys — the group layouts are the sole owner of marketing OG
// defaults.
export const marketingMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "SourceBD",
    locale: "en_GB",
    type: "website",
    title: "SourceBD — verified Bangladesh RMG supply-chain intelligence",
    description:
      "Discover, vet, and message verified Bangladesh garment factories and buying houses with verified evidence behind every claim.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SourceBD — verified Bangladesh RMG supply-chain intelligence",
    description:
      "Discover, vet, and message verified Bangladesh garment factories and buying houses with verified evidence behind every claim.",
  },
};

export async function MarketingChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const facts = await loadSiteFacts();
  return (
    <PostHogProvider userId={null}>
      <div className="flex min-h-dvh flex-col bg-surface font-sans text-ink antialiased">
        <ScrollToTop />
        <SkipLink />
        <SiteNav listed={facts.sourcesListed} withRecords={facts.sourcesWithRecords} />
        <div
          id="main-content"
          tabIndex={-1}
          className="flex-1 focus:outline-none"
        >
          {children}
        </div>
        <SiteFooter facts={facts} year={new Date().getUTCFullYear()} />
        <CookieBanner />
      </div>
    </PostHogProvider>
  );
}
