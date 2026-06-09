// Spec M2 — Shared marketing top-nav (M6a light variant).
//
// Client component, role-aware after hydration. Mounted in
// `app/(marketing)/layout.tsx`. I-033 contract preserved: SSR + first
// client render emit the anonymous variant (matching prerendered HTML,
// clean hydration); `useEffect` fetches `/api/session/me` and swaps the
// right-side CTA group to the role-aware variant. UI visibility is
// never the security boundary — `middleware.ts` still gates `/app`,
// `/supplier`, `/admin`, `/api/v1/*` server-side.
//
// M6a: light cream chrome with shield wordmark glyph, scroll-driven
// hairline + soft shadow once the page leaves the top.
//
// Spec R2 — Adds a <md hamburger trigger that opens a MobileDrawer with
// the marketing nav links. Drawer body is route + role aware (same role
// signal as the right-side CTA swap) so anon visitors see the marketing
// nav + Sign in / Start free; logged-in visitors see the right-side CTA
// reflecting their workspace. No new fetch — the drawer reuses the
// already-fetched role state.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List as ListIcon } from "@phosphor-icons/react/dist/ssr";

import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { WordmarkMark } from "@/components/marketing/wordmark-mark";

type Role = "admin" | "buyer" | "supplier";

function homeHref(role: Role | null): string {
  if (role === "admin") return "/admin";
  if (role === "supplier") return "/supplier";
  if (role === "buyer") return "/app";
  return "/";
}

function RightLinks({ role }: { role: Role | null }) {
  if (role === "supplier") {
    return (
      <Link href="/supplier" className="mkt-btn mkt-btn-primary">
        Supplier portal
      </Link>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <Link href="/app" className="mkt-btn mkt-btn-primary">
        Open app
      </Link>
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
  const [role, setRole] = useState<Role | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        /* anon nav stays */
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
        {/* R2 — hamburger trigger, phone only (<md). Sits before the
           wordmark so it reads left-to-right: menu, brand, …, CTAs. */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="mkt-nav-menu inline-flex h-[44px] w-[44px] items-center justify-center rounded-pill text-current md:hidden"
          style={{ marginRight: 4 }}
        >
          <ListIcon size={20} weight="bold" aria-hidden />
        </button>

        <Link href={homeHref(role)} className="mkt-wordmark">
          <WordmarkMark />
          <span className="mkt-wm-text">Source<b>BD</b></span>
        </Link>
        <div className="mkt-nav-links hidden md:flex">
          <Link href="/#how-we-verify">How we verify</Link>
          <Link href="/#sources">Data sources</Link>
          <Link href="/compliance">Compliance</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="mkt-nav-right">
          <RightLinks role={role} />
        </div>
      </div>

      {/* R2 — Marketing drawer. Same role signal as the right-side CTA
         (no extra fetch). Drawer is icon-X close + nav links. */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        label="Marketing menu"
      >
        <ul role="list" className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
          <li>
            <Link
              href="/#how-we-verify"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded-pill px-3 font-medium text-ink-primary hover:bg-brand-forest-tint"
            >
              How we verify
            </Link>
          </li>
          <li>
            <Link
              href="/#sources"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded-pill px-3 font-medium text-ink-primary hover:bg-brand-forest-tint"
            >
              Data sources
            </Link>
          </li>
          <li>
            <Link
              href="/compliance"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded-pill px-3 font-medium text-ink-primary hover:bg-brand-forest-tint"
            >
              Compliance
            </Link>
          </li>
          <li>
            <Link
              href="/discover"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded-pill px-3 font-medium text-ink-primary hover:bg-brand-forest-tint"
            >
              Discover
            </Link>
          </li>
          <li>
            <Link
              href="/pricing"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center rounded-pill px-3 font-medium text-ink-primary hover:bg-brand-forest-tint"
            >
              Pricing
            </Link>
          </li>
        </ul>
        {/* Role-aware CTA inside the drawer mirrors the desktop right
           side. Anon: Sign in + Start free. Buyer/admin: Open app.
           Supplier: Supplier portal. */}
        <div className="mt-4 border-t border-hairline pt-4 flex flex-col gap-2">
          {role === "supplier" ? (
            <Link
              href="/supplier"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-brand-forest px-4 text-[14px] font-semibold text-ink-on-accent"
            >
              Supplier portal
            </Link>
          ) : role === "buyer" || role === "admin" ? (
            <Link
              href="/app"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-brand-forest px-4 text-[14px] font-semibold text-ink-on-accent"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-pill border border-hairline-strong px-4 text-[14px] font-semibold text-ink-primary"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-brand-forest px-4 text-[14px] font-semibold text-ink-on-accent"
              >
                Start free
              </Link>
            </>
          )}
        </div>
        {/* Sheet renders its own close button (44×44, top-right). */}
      </MobileDrawer>
    </nav>
  );
}
