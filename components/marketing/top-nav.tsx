// Spec M2 — Shared marketing top-nav.
//
// Client component, role-aware after hydration. Mounted in
// `app/(marketing)/layout.tsx` so every marketing surface (`/`, `/pricing`,
// `/legal/trademarks`, `/discover`, `/suppliers/[slug]`, `/compliance/*`)
// renders the same chrome.
//
// I-033: marketing pages are statically generated (`force-static` or
// `revalidate=N`). A server component cannot detect the session under
// static rendering — there is no request cookie — so the cached HTML
// always rendered the anonymous CTAs even for logged-in visitors. This
// component now SSRs the anon variant (matching the prerendered HTML,
// so no hydration mismatch) and fetches `/api/session/me` once on mount
// to swap to the role-aware variant. UI visibility is never the security
// control — `middleware.ts` still gates `/app`, `/supplier`, `/admin`,
// `/api/v1/*` on the server.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Role = "admin" | "buyer" | "supplier";

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
        href="/login"
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

export function MarketingTopNav() {
  // SSR + first client render: anon variant. Matches the statically
  // generated HTML so hydration is clean.
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/session/me", {
      credentials: "include",
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && (data.role === "admin" || data.role === "buyer" || data.role === "supplier")) {
          setRole(data.role as Role);
        }
      })
      .catch(() => {
        // Network/abort: leave anon nav in place.
      });
    return () => ac.abort();
  }, []);

  return (
    <nav
      data-marketing-nav
      className="sticky top-0 z-20 border-b border-ink-200 bg-bg-l0/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="proto-wordmark">
          SourceBD
        </Link>
        <div className="flex items-center gap-3">{rightLinks(role)}</div>
      </div>
    </nav>
  );
}

