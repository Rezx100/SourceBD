// App-shell topbar. Logo (left) · global search (centre, GET → /app/discover?q=)
// · notification bell · avatar placeholder. Per `frontend-design-spec.md` §2.1.
// Server component — interactive search submit is a plain HTML form, no JS.

import Link from "next/link";
import { Bell, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface-l1/95 px-4 shadow-l1 backdrop-blur supports-[backdrop-filter]:bg-surface-l1/80">
      <Link
        href="/"
        className="font-display text-base font-semibold tracking-tightish text-ink-primary"
      >
        SourceBD
      </Link>

      <form action="/app/discover" method="get" className="ml-2 hidden flex-1 max-w-xl md:flex">
        <label htmlFor="topbar-q" className="sr-only">
          Search suppliers
        </label>
        <div className="flex w-full items-center gap-2 rounded-input border border-hairline-strong bg-bg-l0 px-3 py-1.5">
          <MagnifyingGlass size={14} weight="bold" aria-hidden className="text-ink-tertiary" />
          <input
            id="topbar-q"
            name="q"
            type="search"
            placeholder="Search verified suppliers"
            className="w-full bg-transparent text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
        >
          <Bell size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
        >
          <UserCircle size={20} aria-hidden />
        </button>
      </div>
    </header>
  );
}
