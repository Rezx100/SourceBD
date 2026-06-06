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
//
// M6a: re-skinned with the new dark cinematic chrome — sticky nav
// with a scroll-driven `.scrolled` glass-blur state, animated
// underline on hover, shield wordmark glyph. Logic above is
// unchanged.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Role = "admin" | "buyer" | "supplier";

function RightLinks({ role }: { role: Role | null }) {
  if (role === "supplier") {
    return (
      <>
        <Link href="/supplier" className="mkt-btn mkt-btn-primary">
          Supplier portal
        </Link>
      </>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <>
        <Link href="/app" className="mkt-btn mkt-btn-primary">
          Open app
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/login" className="mkt-signin">
        Sign in
      </Link>
      <Link href="/signup" className="mkt-btn mkt-btn-primary">
        Start free
      </Link>
    </>
  );
}

export function MarketingTopNav() {
  // SSR + first client render: anon variant. Matches the statically
  // generated HTML so hydration is clean.
  const [role, setRole] = useState<Role | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/session/me", {
      credentials: "include",
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (
          data &&
          (data.role === "admin" || data.role === "buyer" || data.role === "supplier")
        ) {
          setRole(data.role as Role);
        }
      })
      .catch(() => {
        // Network/abort: leave anon nav in place.
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      data-marketing-nav
      className={`mkt-nav${scrolled ? " scrolled" : ""}`}
    >
      <div className="mkt-wrap mkt-nav-row">
        <Link href="/" className="mkt-wordmark">
          <span className="mkt-wm-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 3.5v5c0 4.6-3.2 7.8-8 9-4.8-1.2-8-4.4-8-9v-5L12 3z" />
              <path d="M9 12l2 2 4-4.5" />
            </svg>
          </span>
          Source<b>BD</b>
        </Link>
        <div className="mkt-nav-links">
          <Link href="/discover">Discover</Link>
          <Link href="/compliance">Compliance</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="mkt-nav-right">
          <RightLinks role={role} />
        </div>
      </div>
    </nav>
  );
}


