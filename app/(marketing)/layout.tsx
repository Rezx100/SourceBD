// Marketing route-group layout. Anonymous surface — no app sidebar / app
// chrome. M2 mounts the shared top-nav + footer here so every marketing
// page (`/`, `/pricing`, `/legal/trademarks`) renders the same chrome.
// Per-page `<main>` content sits between them.

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingTopNav } from "@/components/marketing/top-nav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-l0">
      <MarketingTopNav />
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  );
}
