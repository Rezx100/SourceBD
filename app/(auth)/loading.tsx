// Auth-shell Suspense fallback. Single centred card with two muted bars.

export default function AuthLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-16"
    >
      <span className="sr-only">Loading</span>
      <div className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1">
        <div className="h-3 w-32 animate-pulse rounded-pill bg-hairline" />
        <div className="mt-3 h-3 w-48 animate-pulse rounded-pill bg-hairline" />
        <div className="mt-6 h-9 w-full animate-pulse rounded-input bg-hairline" />
      </div>
    </div>
  );
}
