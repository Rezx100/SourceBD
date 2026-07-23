// Keyboard-only skip-to-content link. Mounted as the first focusable
// element in the app shell and the marketing shell so Tab from the very
// top of the page reveals "Skip to main content" before the topbar / nav
// link list. Targets the `id="main-content"` anchor that each shell sets
// on its `<main>`. Server component, zero client JS.

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:inline-flex focus-visible:items-center focus-visible:rounded-pill focus-visible:bg-accent-indigo focus-visible:px-3.5 focus-visible:py-1.5 focus-visible:text-[14px] focus-visible:font-semibold focus-visible:text-ink-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-indigo"
    >
      Skip to main content
    </a>
  );
}
