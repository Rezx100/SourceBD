// Public "your account is suspended" page (Spec A5).
// No auth gate; the middleware redirects suspended users here when they
// hit any gated surface. A suspended user can still sign out.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-20 text-center">
      <p className="text-[11px] text-ink-tertiary">
        Account suspended
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
        Your SourceBD account is suspended
      </h1>
      <p className="text-sm text-ink-secondary">
        A platform administrator has paused access to this account. You
        cannot reach the buyer, supplier, or admin surfaces while the
        suspension is active. If you believe this is in error, please
        contact your account owner or reply to your most recent SourceBD
        email.
      </p>
      <p>
        <Link
          href="/auth/sign-out"
          className="rounded-pill border border-hairline px-4 py-2 text-xs text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
        >
          Sign out
        </Link>
      </p>
    </main>
  );
}
