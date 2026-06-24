// App-shell topbar. Logo (left) · quick-nav (role-aware) · global search
// · moat headline · notification bell · avatar. Per `frontend-design-spec.md`
// §2.1 plus debug batch 2026-06-06 I-022 (quick-nav links + verified count
// surfaced in the header so the topbar carries useful info, not just chrome).
// Client component only so the quick links/search target can follow the
// current route group. Server-side auth still happens in middleware and the
// layout; this file only chooses buyer/supplier/admin chrome.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import type { Role } from "@/lib/auth";
import { ShieldGlyph } from "@/components/marketing/logo";
import { TopbarHamburger } from "@/components/shell/topbar-hamburger";
import { variantFromPath } from "@/components/shell/sidebar";
import { UserAvatar } from "@/components/shell/user-avatar";

type QuickLink = { href: string; label: string };

const QUICK_LINKS: Record<"buyer" | "supplier" | "admin", QuickLink[]> = {
  // I-024 — Surface the workflows buyers/suppliers actually live in. Buyers
  // get the discovery + outreach loop (Discover · Saved · RFQs · Messages ·
  // Compliance); suppliers get the inbound loop (Dashboard · RFQs ·
  // Messages · Profile). Admin nav stays operational.
  buyer: [
    { href: "/app/discover", label: "Discover" },
    { href: "/app/saved", label: "Saved" },
    { href: "/app/rfqs", label: "RFQs" },
    { href: "/app/messages", label: "Messages" },
    { href: "/app/compliance", label: "Compliance" },
  ],
  supplier: [
    { href: "/supplier", label: "Dashboard" },
    { href: "/supplier/rfqs", label: "RFQs" },
    { href: "/supplier/messages", label: "Messages" },
    { href: "/supplier/profile", label: "Profile" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/suppliers", label: "Suppliers" },
    { href: "/admin/claims", label: "Claims" },
    { href: "/admin/sanctions", label: "Sanctions" },
  ],
};

export function Topbar({
  role = null,
  moatTotal = null,
  avatarUrl = null,
  displayName = null,
  email = null,
}: {
  role?: Role | null;
  moatTotal?: number | null;
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname() ?? "/app";
  const variant = variantFromPath(pathname, role);
  const links = QUICK_LINKS[variant];

  const searchAction = variant === "admin" ? "/admin/suppliers" : "/app/discover";

  return (
    <header className="sticky top-0 z-30 flex min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] items-center gap-2 border-b border-neutral-200 bg-white px-3 safe-pt shadow-sm md:gap-3 md:px-4">
      <TopbarHamburger
        role={role}
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={email}
      />
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 font-display text-[15px] font-bold tracking-tight text-ink-primary"
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg bg-brand-forest"
        >
          <ShieldGlyph className="h-4 w-4" />
        </span>
        <span>
          Source<span className="font-extrabold">BD</span>
        </span>
      </Link>

      <nav
        aria-label="Quick navigation"
        className="ml-2 hidden items-center gap-0.5 lg:flex"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-pill px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <form
        action={searchAction}
        method="get"
        className="ml-auto hidden max-w-md flex-1 md:flex"
      >
        <label htmlFor="topbar-q" className="sr-only">
          Search suppliers
        </label>
        <div className="flex w-full items-center gap-2 rounded-pill border border-hairline-strong bg-bg-l0 px-3 py-1.5 transition-colors focus-within:border-brand-forest/40 focus-within:bg-surface-l1">
          <MagnifyingGlass
            size={15}
            weight="bold"
            aria-hidden
            className="text-ink-tertiary"
          />
          <input
            id="topbar-q"
            name="q"
            type="search"
            placeholder="Search verified suppliers"
            className="w-full bg-transparent text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
      </form>

      {moatTotal != null ? (
        <Link
          href={variant === "buyer" ? "/app/discover" : "/admin/suppliers"}
          className="hidden items-center gap-2 rounded-pill border border-brand-forest/20 bg-brand-forest-soft px-3 py-1.5 xl:inline-flex"
          aria-label={`${moatTotal.toLocaleString("en-US")} verified suppliers`}
        >
          <span
            aria-hidden
            className="size-1.5 animate-pulse rounded-full bg-brand-forest"
          />
          <span className="font-display text-[13px] font-bold tabular-nums text-brand-forest">
            {moatTotal.toLocaleString("en-US")}
          </span>
          <span className="text-[12px] font-medium text-brand-forest/80">
            verified
          </span>
        </Link>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5 md:ml-0 md:gap-1">
        <button
          type="button"
          aria-label="Notifications"
          className="flex size-9 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
        >
          <Bell size={18} aria-hidden />
        </button>
        <Link
          href={variant === "admin" ? "/admin/users" : "/app/settings"}
          aria-label="Account menu"
          className="flex size-9 items-center justify-center rounded-full transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint"
        >
          <UserAvatar
            avatarUrl={avatarUrl}
            displayName={displayName}
            email={email}
            size="sm"
          />
        </Link>
      </div>
    </header>
  );
}
