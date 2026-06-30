// Marketing top-nav — Magic UI light-mode design.
//
// Sticky white nav with a subtle scroll-shadow. Role-aware right CTAs
// fetched from /api/session/me on mount. Uses shared SourceBD brand tokens.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List as ListIcon, X as XIcon } from "@phosphor-icons/react/dist/ssr";

import { Wordmark } from "@/components/marketing/logo";
import { cn } from "@/lib/utils";

type Role = "admin" | "buyer" | "supplier";

const NAV_LINKS = [
  { href: "/#how-we-verify", label: "How we verify" },
  { href: "/#sources", label: "Sources" },
  { href: "/discover", label: "Discover" },
  { href: "/pricing", label: "Pricing" },
];

const CTA_BUTTON = "btn-proto primary";

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
      <Link href="/signup" className="btn-proto primary">
        Start free
      </Link>
    </>
  );
}

/** Full-width CTA block reused inside the mobile drawer. */
function DrawerCtas({
  role,
  onNavigate,
}: {
  role: Role | null;
  onNavigate: () => void;
}) {
  if (role === "supplier") {
    return (
      <Link href="/supplier" onClick={onNavigate} className="btn-proto primary min-h-[48px] justify-center">
        Supplier portal
      </Link>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <Link href="/app" onClick={onNavigate} className="btn-proto primary min-h-[48px] justify-center">
        Open app
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/login"
        onClick={onNavigate}
        className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        onClick={onNavigate}
        className="btn-proto primary min-h-[48px] w-full justify-center"
      >
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

  // Lock body scroll + Esc-to-close while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <>
    <nav
      className={cn(
        "sticky top-0 z-50 w-full border-b border-neutral-200 bg-white safe-pt transition-shadow duration-200",
        scrolled && "shadow-sm",
      )}
    >
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:h-[72px] sm:px-6 md:gap-4 lg:px-8">
        {/* Wordmark — always pinned far-left */}
        <Wordmark
          boxClassName="h-8 w-8 sm:h-9 sm:w-9"
          textClassName="text-[18px] sm:text-[19px]"
          className="shrink-0"
        />

        {/* Desktop nav links (md+) */}
        <div className="ml-2 hidden items-center gap-1 md:flex lg:ml-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-pill px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary lg:text-sm"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right cluster — desktop CTAs, or the mobile hamburger far-right */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-4 md:flex">
            <RightLinks role={role} />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-neutral-600 transition-colors duration-hover ease-smooth hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
          >
            <ListIcon size={20} weight="bold" aria-hidden />
          </button>
        </div>
      </div>
    </nav>

      {/* Mobile drawer — permanently mounted and driven purely by CSS
          transitions, so the slide is deterministic on every browser.
          (A framer-motion enter-animation on a nested AnimatePresence
          child silently parked the panel off-screen on mobile.) Depth
          comes from a translucent scrim + hairline border, never a drop
          shadow; `inert` removes the off-screen panel from the tab order
          and a11y tree while closed; transitions disable under
          prefers-reduced-motion. */}
      <div
        className={cn(
          "fixed inset-0 z-[100] md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!drawerOpen}
      >
        {/* Scrim */}
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={drawerOpen ? 0 : -1}
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 h-full w-full cursor-default bg-neutral-950/30 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Panel */}
        <div
          inert={!drawerOpen}
          style={{ transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
          className={cn(
            "absolute right-0 top-0 flex h-dvh w-[min(86vw,360px)] flex-col border-l border-neutral-200 bg-white safe-pb transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 safe-pt">
            <Wordmark onClick={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <XIcon size={20} weight="bold" aria-hidden />
            </button>
          </div>

          <div className="flex flex-col gap-1 px-3 py-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setDrawerOpen(false)}
                className="flex min-h-[48px] items-center rounded-lg px-3 text-[15px] font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2.5 border-t border-neutral-200 px-5 py-5">
            <DrawerCtas role={role} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
