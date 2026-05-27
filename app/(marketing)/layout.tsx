// Marketing route-group layout. Anonymous surface — no sidebar, no auth chrome.
// Per-section pages live under this group (`/`, `/buyers`, `/suppliers`, `/pricing`,
// `/about`, `/legal/*`) per frontend-design-spec §2.4. F2 ships only `/`; the rest
// arrive in their own Phase-1 marketing specs.

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg-l0">{children}</div>;
}
