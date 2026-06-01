// Marketing-shell Suspense fallback. Centred to match marketing chrome
// max-width. Pure CSS; no JS.

export default function MarketingLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto max-w-5xl space-y-4 px-6 py-16"
    >
      <span className="sr-only">Loading</span>
      <div className="h-40 w-full animate-pulse rounded-card bg-surface-l1" />
      <div className="h-3 w-56 animate-pulse rounded-pill bg-hairline" />
      <div className="h-3 w-72 animate-pulse rounded-pill bg-hairline" />
      <div className="h-3 w-40 animate-pulse rounded-pill bg-hairline" />
    </div>
  );
}
