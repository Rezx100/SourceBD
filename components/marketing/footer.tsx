// Spec M2 — Shared marketing footer.
//
// Server component. JC #9 ack: minimal layout — brand + © + trademarks +
// pricing. Privacy + terms remain forbidden placeholders until H7 (M1 JC
// #7 carry-forward; UK ICO posture).
//
// Mounted in `app/(marketing)/layout.tsx`; the M1 home page's inline
// footer collapses into this component on the same PR.

import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer
      data-marketing-footer
      className="mt-24 border-t border-ink-200 bg-bg-l0"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-xs text-ink-secondary md:flex-row md:items-center md:justify-between">
        <span className="font-display text-sm text-ink-primary">SourceBD</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/pricing" className="hover:text-ink-primary">
            Pricing
          </Link>
          <Link href="/compliance" className="hover:text-ink-primary">
            Compliance
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
