// Public "your account is suspended" page (Spec A5).
// No auth gate; the middleware redirects suspended users here when they
// hit any gated surface. A suspended user can still sign out.

import { BlurFade } from "@/components/ui/blur-fade";

export const dynamic = "force-dynamic";

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-20 text-center">
      <BlurFade delay={0.08}>
        <p className="mb-2 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-sem-amber">
          Account suspended
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-primary">
          Your SourceBD account is suspended
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
          A platform administrator has paused access to this account. You
          cannot reach the buyer, supplier, or admin surfaces while the
          suspension is active. If you believe this is in error, please
          contact your account owner or reply to your most recent SourceBD
          email.
        </p>
        <form action="/auth/sign-out" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-pill border border-hairline px-4 py-2 text-xs text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
          >
            Sign out
          </button>
        </form>
      </BlurFade>
    </main>
  );
}
