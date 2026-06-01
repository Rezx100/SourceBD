// Root Suspense fallback. Matched only when no segment-specific
// `loading.tsx` covers the boundary (e.g. a bare route under `app/` with
// no route-group wrapper). Renders a minimal centred card.

export default function RootLoading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <div
        role="status"
        aria-busy="true"
        className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1"
      >
        <span className="sr-only">Loading</span>
        <div className="h-3 w-32 animate-pulse rounded-pill bg-hairline" />
        <div className="mt-3 h-3 w-48 animate-pulse rounded-pill bg-hairline" />
        <div className="mt-6 h-24 w-full animate-pulse rounded-card bg-hairline" />
      </div>
    </main>
  );
}
