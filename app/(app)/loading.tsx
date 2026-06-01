// App-shell Suspense fallback. Rendered inside the topbar + sidebar
// shell (Next mounts it as `<Suspense fallback>` for children of
// `app/(app)/layout.tsx`). Mirrors the shell's `px-4/md:px-8` padding so
// the skeleton doesn't reflow when content arrives.

export default function AppLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-4 px-4 py-6 md:px-8 md:py-8"
    >
      <span className="sr-only">Loading</span>
      <div className="h-4 w-40 animate-pulse rounded-pill bg-hairline" />
      <div className="h-3 w-72 animate-pulse rounded-pill bg-hairline" />
      <div className="h-3 w-64 animate-pulse rounded-pill bg-hairline" />
      <div className="h-48 w-full max-w-3xl animate-pulse rounded-card bg-surface-l1" />
    </div>
  );
}
