// Marketing route-group layout. Anonymous surface — no app sidebar / app
// chrome. M2 mounts the shared top-nav + footer here so every marketing
// page (`/`, `/pricing`, `/legal/trademarks`) renders the same chrome.
// Per-page `<main>` content sits between them.
//
// M4: default OpenGraph + Twitter card metadata + `metadataBase` for
// the marketing surface. Per-page `metadata` exports override these
// defaults (Next merges them shallowly). The root `app/layout.tsx`
// intentionally owns no OG/twitter keys — this layout is the sole
// owner of marketing OG defaults.
//
// M6a (updated): fonts are unified in app/layout.tsx (Archivo / Hanken Grotesk /
// IBM Plex Mono). The [data-surface="marketing"] block in globals.css bridges
// --mkt-font-* CSS variables to the root --font-* set by next/font, so all
// marketing styles resolve correctly without a duplicate font bundle here.

import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingTopNav } from "@/components/marketing/top-nav";
import { ScrollToTop } from "@/components/shell/scroll-to-top";
import { SkipLink } from "@/components/ui/skip-link";
import { PostHogProvider } from "@/lib/posthog/provider";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

// Fonts are loaded once in app/layout.tsx (--font-display / --font-body / --font-mono).
// The marketing CSS layer bridges --mkt-font-* → --font-* via CSS variable inheritance,
// so no duplicate font bundle is needed here.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "SourceBD",
    locale: "en_GB",
    type: "website",
    title: "SourceBD — verified Bangladesh RMG supply-chain intelligence",
    description:
      "Discover, vet, and message verified Bangladesh garment factories and buying houses with receipts on every claim.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SourceBD — verified Bangladesh RMG supply-chain intelligence",
    description:
      "Discover, vet, and message verified Bangladesh garment factories and buying houses with receipts on every claim.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PostHogProvider userId={null}>
      <div
        data-surface="marketing"
        className="flex min-h-dvh flex-col"
      >
        <ScrollToTop />
        <SkipLink />
        <MarketingTopNav />
        <div
          id="main-content"
          tabIndex={-1}
          className="flex-1 focus:outline-none"
        >
          {children}
        </div>
        <MarketingFooter />
      </div>
    </PostHogProvider>
  );
}

