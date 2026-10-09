// Marketing route-group layout. Anonymous surface — no app sidebar / app
// chrome. M2 mounts the shared top-nav + footer here so every marketing
// page (`/`, `/pricing`, `/legal/trademarks`) renders the same chrome.
// Per-page `<main>` content sits between them.
//
// The chrome + metadata defaults live in `components/site/chrome.tsx`,
// shared with `app/(public)` (the supplier profile route group) so the two
// marketing-surface groups can never drift.
//
// Fonts load once in app/layout.tsx (Geist and Geist Mono); the Tailwind
// `font-sans` and `font-mono` stacks read them, so no font bundle lives here.

import { MarketingChrome, marketingMetadata } from "@/components/site/chrome";

export const metadata = marketingMetadata;

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingChrome>{children}</MarketingChrome>;
}
