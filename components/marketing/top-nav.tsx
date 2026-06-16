// Marketing top-nav — Magic UI light-mode design.
//
// Sticky white nav with a subtle scroll-shadow. Role-aware right CTAs
// fetched from /api/session/me on mount. Forest green (#1f4d3a) appears
// only on the shield glyph and the primary CTA button — nowhere else.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List as ListIcon } from "@phosphor-icons/react/dist/ssr";

import { Wordmark } from "@/components/marketing/logo";
import { MobileDrawer } from "@/components/ui/mobile-drawer";

type Role = "admin" | "buyer" | "supplier";

const NAV_LINKS = [
  { href: "/#how-we-verify", label: "How we verify" },
  { href: "/#sources", label: "Sources" },
  { href: "/discover", label: "Discover" },
  { href: "/pricing", label: "Pricing" },
];

const CTA_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-[#1f4d3a] px-4 py-2 text-sm font-medium !text-white shadow-sm transition-colors hover:bg-[#2d6a4f]";

function RightLinks({ role }: { role: Role | null }) {
  if (role === "supplier") {
    return (
      <Link href="/supplier" className={CTA_BUTTON}>
        Supplier portal
      </Link>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <Link href="/app" className={CTA_BUTTON}>
        Open app
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
      >
        Sign in
      </Link>
      <Link href="/signup" className={CTA_BUTTON}>
        Start free
      </Link>
    </>
  );
}

export function MarketingTopNav() {
  const [role, setRole] = useState<Role | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Role detection — anonymous variant is the SSR + first-paint default
  // so hydration stays clean; CTAs swap only after this resolves.
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
          (data.role === "admin" ||
            data.role === "buyer" ||
            data.role === "supplier")
        ) {
          setRole(data.role as Role);
        }
      })
      .catch(() => {});
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
      className={`sticky top-0 z-50 w-full border-b transition-all duration-200 ${
        scrolled
          ? "border-neutral-200 bg-white/90 shadow-sm backdrop-blur-md"
          : "border-transparent bg-white"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-12 lg:px-20">
        {/* Mobile hamburger (<md only) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
        >
          <ListIcon size={20} weight="bold" aria-hidden />
        </button>

        {/* Wordmark */}
        <Wordmark />

        {/* Desktop nav links (md+) */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-4">
          <RightLinks role={role} />
        </div>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        label="Navigation"
      >
        <ul className="flex flex-col gap-1 p-0">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setDrawerOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-[15px] font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-200 pt-4">
          {role === "supplier" ? (
            <Link
              href="/supplier"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f4d3a] px-4 text-sm font-medium !text-white"
            >
              Supplier portal
            </Link>
          ) : role === "buyer" || role === "admin" ? (
            <Link
              href="/app"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f4d3a] px-4 text-sm font-medium !text-white"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-800"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f4d3a] px-4 text-sm font-medium !text-white"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </MobileDrawer>
    </nav>
  );
}
