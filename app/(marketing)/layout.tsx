// Marketing route-group layout. Anonymous surface — no app sidebar / app
// chrome. M2 mounts the shared top-nav + footer here so every marketing
// page (`/`, `/pricing`, `/legal/trademarks`) renders the same chrome.
// Per-page `<main>` content sits between them.
//
// The chrome + metadata defaults live in `components/marketing/chrome.tsx`,
// shared with `app/(public)` (the supplier profile route group) so the two
// marketing-surface groups can never drift.
//
// M6a (updated): fonts are unified in app/layout.tsx (Archivo / Hanken Grotesk /
// IBM Plex Mono). The [data-surface="marketing"] block in globals.css bridges
// --mkt-font-* CSS variables to the root --font-* set by next/font, so all
// marketing styles resolve correctly without a duplicate font bundle here.

import { MarketingChrome, marketingMetadata } from "@/components/marketing/chrome";

export const metadata = marketingMetadata;

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingChrome>{children}</MarketingChrome>;
}
