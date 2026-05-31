// Demo-mode banner — Spec M5. Anonymous public chrome that appears
// above /discover and /suppliers/[slug]. Server component; no client
// island. Plain <aside aria-label="Demo mode"> (not role="status" —
// this is static marketing chrome, not a live region).

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function DemoBanner({ next }: { next: string }) {
  const signupHref = `/signup?next=${encodeURIComponent(next)}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  return (
    <aside
      aria-label="Demo mode"
      className="border-b border-hairline bg-brand-forest-tint"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-secondary">
          <span className="font-medium text-ink-primary">Demo mode.</span>{" "}
          Contacts and saved-supplier features are reserved for verified
          buyers. Sign up free to unlock.
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="primary" size="sm">
            <Link href={signupHref}>Sign up free</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={loginHref}>Sign in</Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
