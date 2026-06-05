// App-shell topbar. Logo (left) · quick-nav (role-aware) · global search
// · moat headline · notification bell · avatar. Per `frontend-design-spec.md`
// §2.1 plus debug batch 2026-06-06 I-022 (quick-nav links + verified count
// surfaced in the header so the topbar carries useful info, not just chrome).
// Server component — interactive search submit is a plain HTML form, no JS.

import Link from "next/link";
import { Bell, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";

import type { Role } from "@/lib/auth";

type QuickLink = { href: string; label: string };

const QUICK_LINKS: Record<"buyer" | "supplier" | "admin", QuickLink[]> = {
  buyer: [
    { href: "/app/discover", label: "Discover" },
    { href: "/app/saved", label: "Saved" },
    { href: "/app/messages", label: "Messages" },
    { href: "/app/compliance", label: "Compliance" },
  ],
  supplier: [
    { href: "/supplier", label: "Dashboard" },
    { href: "/supplier/rfqs", label: "RFQs" },
    { href: "/supplier/messages", label: "Messages" },
    { href: "/supplier/documents", label: "Documents" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/suppliers", label: "Suppliers" },
    { href: "/admin/claims", label: "Claims" },
    { href: "/admin/sanctions", label: "Sanctions" },
  ],
};

function variantFor(role: Role | null): "buyer" | "supplier" | "admin" {
  if (role === "admin") return "admin";
  if (role === "supplier") return "supplier";
  return "buyer";
}

export function Topbar({
  role = null,
  moatTotal = null,
}: {
  role?: Role | null;
  moatTotal?: number | null;
}) {
  const variant = variantFor(role);
  const links = QUICK_LINKS[variant];

  return (
    <header className="topbar sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline px-4 backdrop-blur">
      <Link href="/" className="proto-wordmark shrink-0">
        SourceBD
      </Link>

      <nav
        aria-label="Quick navigation"
        className="ml-2 hidden items-center gap-1 lg:flex"
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="topbar-quick-link">
            {l.label}
          </Link>
        ))}
      </nav>

      <form
        action={variant === "buyer" ? "/app/discover" : "/app/discover"}
        method="get"
        className="ml-auto hidden flex-1 max-w-md md:flex"
      >
        <label htmlFor="topbar-q" className="sr-only">
          Search suppliers
        </label>
        <div className="flex w-full items-center gap-2 rounded-input border border-hairline-strong bg-bg-l0 px-3 py-1.5">
          <MagnifyingGlass
            size={14}
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
          className="topbar-moat hidden xl:inline-flex"
          aria-label={`${moatTotal.toLocaleString("en-US")} verified suppliers`}
        >
          <span className="topbar-moat-dot" aria-hidden />
          <span className="topbar-moat-count">
            {moatTotal.toLocaleString("en-US")}
          </span>
          <span className="topbar-moat-label">verified</span>
        </Link>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
        >
          <Bell size={18} aria-hidden />
        </button>
        <Link
          href={variant === "admin" ? "/admin/users" : "/app/settings"}
          aria-label="Account menu"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
        >
          <UserCircle size={20} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
