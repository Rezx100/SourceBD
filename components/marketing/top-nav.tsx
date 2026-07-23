// Marketing top-nav — Linear-inspired light-mode layout.
//
// Logo left · nav links + auth actions right (links | Log in · Sign up).
// No btn-proto. Role-aware CTAs from /api/session/me after mount.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const linkClass =
  "text-[13.5px] font-medium tracking-[-0.01em] text-neutral-500 transition-colors duration-150 hover:text-neutral-900";

const signupClass =
  "inline-flex h-9 items-center justify-center rounded-full bg-brand-forest px-5 font-body text-[13px] font-medium leading-none tracking-[0.01em] !text-white transition-[background-color,transform] duration-150 hover:bg-brand-forest-mid active:scale-[0.98]";

function AuthActions({ role }: { role: Role | null }) {
  if (role === "supplier") {
    return (
      <Link href="/supplier" className={signupClass}>
        Supplier portal
      </Link>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <Link href="/app" className={signupClass}>
        Open app
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className={linkClass}>
        Log in
      </Link>
      <Link href="/signup" className={signupClass}>
        Sign up
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
      <Link
        href="/supplier"
        onClick={onNavigate}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-brand-forest text-[15px] font-semibold !text-white"
      >
        Supplier portal
      </Link>
    );
  }
  if (role === "buyer" || role === "admin") {
    return (
      <Link
        href="/app"
        onClick={onNavigate}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-brand-forest text-[15px] font-semibold !text-white"
      >
        Open app
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/login"
        onClick={onNavigate}
        className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-neutral-200 px-4 text-[15px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        onClick={onNavigate}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-brand-forest text-[15px] font-semibold !text-white"
      >
        Sign up
      </Link>
    </>
  );
}

export function MarketingTopNav() {
  const [role, setRole] = useState<Role | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Separate from `drawerOpen` so the panel paints off-screen for one frame
  // before sliding in — same double-rAF pattern as Sheet / MobileDrawer.
  const [drawerEntered, setDrawerEntered] = useState(false);
  const drawerOpenRef = useRef(false);
  drawerOpenRef.current = drawerOpen;

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

  // Drive the slide-in after an off-screen paint; skip resetting entered on
  // Strict Mode remount while the drawer is still open (pingpong fix).
  useEffect(() => {
    if (!drawerOpen) {
      setDrawerEntered(false);
      return;
    }

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setDrawerEntered(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (!drawerOpenRef.current) {
        setDrawerEntered(false);
      }
    };
  }, [drawerOpen]);

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
          "sticky top-0 z-50 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md safe-pt transition-shadow duration-200",
          scrolled && "shadow-sm",
        )}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center px-4 sm:px-6 lg:px-8">
          <Wordmark
            boxClassName="h-8 w-8 sm:h-9 sm:w-9"
            textClassName="text-[18px] sm:text-[22px]"
            className="shrink-0"
          />

          {/* Desktop: links + separator + auth, all right-aligned */}
          <div className="ml-auto hidden h-full items-center gap-6 md:flex">
            <div className="flex h-full items-center gap-5">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              ))}
            </div>

            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-neutral-200"
            />

            <div className="flex h-full items-center gap-4">
              <AuthActions role={role} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
          >
            <ListIcon size={20} weight="bold" aria-hidden />
          </button>
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
          // `overflow-hidden` clips the off-canvas panel (translateX(100%))
          // so it can't widen the document's scrollWidth and cause phantom
          // horizontal scroll on phones while the drawer is closed.
          "fixed inset-0 z-[100] overflow-hidden md:hidden",
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
            drawerOpen && drawerEntered ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Panel */}
        <div
          inert={!drawerOpen}
          style={{
            transform:
              drawerOpen && drawerEntered ? "translateX(0)" : "translateX(100%)",
          }}
          className={cn(
            "absolute right-0 top-0 flex h-dvh w-[min(86vw,360px)] flex-col border-l border-neutral-200 bg-white safe-pb transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 safe-pt">
            <Wordmark
              onClick={() => setDrawerOpen(false)}
              textClassName="text-[18px]"
            />
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
                className="flex min-h-[48px] items-center rounded-lg px-3 text-[16px] font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
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
