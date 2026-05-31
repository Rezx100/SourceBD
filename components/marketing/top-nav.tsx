// Spec M2 — Shared marketing top-nav.
//
// Server component, role-aware. Mounted in `app/(marketing)/layout.tsx` so
// every marketing surface (`/`, `/pricing`, `/legal/trademarks`) renders
// the same chrome. JC #10 ack: brand-left, role-aware right side, no
// hamburger (single nav link).
//
// Role detection uses the existing `getServerRole()` helper from
// `lib/auth.ts` (cookie-aware Supabase server client). UI visibility is
// never the security control — the helper resolves the same way every
// authenticated surface does, including admin gates.

import Link from "next/link";

import { getServerRole, type Role } from "@/lib/auth";

function rightLinks(role: Role | null) {
  if (role === "supplier") {
    return (
      <>
        <Link
          href="/compliance"
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          Compliance
        </Link>
        <Link
          href="/pricing"
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          Pricing
        </Link>
        <Link
          href="/supplier"
          className="inline-flex items-center rounded-md bg-ink-primary px-4 py-2 text-sm font-medium text-bg-l0 hover:bg-ink-900"
        >
          Supplier portal
        </Link>
      </>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <>
        <Link
          href="/compliance"
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          Compliance
        </Link>
        <Link
          href="/pricing"
          className="text-sm text-ink-secondary hover:text-ink-primary"
        >
          Pricing
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center rounded-md bg-ink-primary px-4 py-2 text-sm font-medium text-bg-l0 hover:bg-ink-900"
        >
          Open app
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        href="/compliance"
        className="hidden text-sm text-ink-secondary hover:text-ink-primary sm:inline"
      >
        Compliance
      </Link>
      <Link
        href="/pricing"
        className="hidden text-sm text-ink-secondary hover:text-ink-primary sm:inline"
      >
        Pricing
      </Link>
      <Link
        href="/auth/sign-in"
        className="hidden text-sm text-ink-secondary hover:text-ink-primary sm:inline"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex items-center rounded-md bg-ink-primary px-4 py-2 text-sm font-medium text-bg-l0 hover:bg-ink-900"
      >
        Start free
      </Link>
    </>
  );
}

export async function MarketingTopNav() {
  // Role detection is best-effort: if the cookie session or Supabase
  // client throws (e.g. static prerender without runtime env), render the
  // logged-out variant rather than crashing the build.
  let role: Role | null = null;
  try {
    role = await getServerRole();
  } catch {
    role = null;
  }
  return (
    <nav
      data-marketing-nav
      className="sticky top-0 z-20 border-b border-ink-200 bg-bg-l0/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tightish text-ink-primary"
        >
          SourceBD
        </Link>
        <div className="flex items-center gap-3">{rightLinks(role)}</div>
      </div>
    </nav>
  );
}
