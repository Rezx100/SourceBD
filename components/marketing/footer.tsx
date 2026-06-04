// Spec M2 — Shared marketing footer.
// Spec H7 — Adds the four statutory legal links (Terms, Privacy,
// Cookies, Data sources) between Compliance and Trademarks. The
// `_h7_smoke.py` check asserts the order is preserved.
//
// Server component. Mounted in `app/(marketing)/layout.tsx`.

import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer
      data-marketing-footer
      className="mt-24 border-t border-ink-200 bg-bg-l0"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-xs text-ink-secondary md:flex-row md:items-center md:justify-between">
        <span className="proto-wordmark text-base">SourceBD</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
          <Link href="/pricing" className="hover:text-ink-primary">
            Pricing
          </Link>
          <Link href="/compliance" className="hover:text-ink-primary">
            Compliance
          </Link>
          <Link href="/legal/terms" className="hover:text-ink-primary">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink-primary">
            Privacy
          </Link>
          <Link href="/legal/cookies" className="hover:text-ink-primary">
            Cookies
          </Link>
          <Link href="/legal/data-sources" className="hover:text-ink-primary">
            Data sources
          </Link>
          <Link href="/legal/trademarks" className="hover:text-ink-primary">
            Trademarks
          </Link>
          <span>© 2026 SourceBD</span>
        </div>
      </div>
    </footer>
  );
}
