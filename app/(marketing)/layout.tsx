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
// M6a: the marketing surface now uses its own type stack (Archivo
// display + Hanken Grotesk body + IBM Plex Mono data) loaded via
// `next/font/google` scoped to this layout — Next splits font
// delivery per layout, so the buyer / supplier / admin app
// surfaces keep Bricolage / Plus Jakarta untouched. The new tokens
// live under a `[data-surface="marketing"]` block in
// `app/globals.css` and apply only when this attribute is set on
// the root element below.

import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingTopNav } from "@/components/marketing/top-nav";
import { SkipLink } from "@/components/ui/skip-link";
import { PostHogProvider } from "@/lib/posthog/provider";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

const mktDisplay = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--mkt-font-display",
  display: "swap",
});
const mktBody = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mkt-font-body",
  display: "swap",
});
const mktMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mkt-font-mono",
  display: "swap",
});

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
        className={`${mktDisplay.variable} ${mktBody.variable} ${mktMono.variable} flex min-h-screen flex-col`}
      >
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

