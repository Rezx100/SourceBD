// App-shell topbar. Brand mark (left) · page title · global search ·
// verified count · notifications · avatar · mobile menu (right).
// Navigation lives in the sidebar / bottom tab bar — not duplicated here.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import type { Role } from "@/lib/auth";
import { pageTitleFromPath } from "@/lib/shell/page-title";
import { BrandMarkLink } from "@/components/marketing/logo";
import { TopbarHamburger } from "@/components/shell/topbar-hamburger";
import {
  VARIANT_HREF,
  variantFromPath,
} from "@/components/shell/sidebar";
import { UserAvatar } from "@/components/shell/user-avatar";

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
  const pageTitle = pageTitleFromPath(pathname, role);
  const homeHref = VARIANT_HREF[variant];
  const searchAction = variant === "admin" ? "/admin/suppliers" : "/app/discover";

  return (
    <header className="sticky top-0 z-30 flex min-h-[calc(4.25rem+env(safe-area-inset-top,0px))] items-center gap-2 border-b border-neutral-200 bg-white px-3 safe-pt shadow-sm sm:gap-3 sm:px-4 md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <BrandMarkLink
          href={homeHref}
          boxClassName="h-8 w-8 sm:h-9 sm:w-9"
          className="shrink-0"
        />
        <div className="hidden min-w-0 max-w-[8rem] flex-col justify-center sm:flex md:max-w-[10rem] lg:max-w-xs xl:max-w-sm">
          <p className="truncate font-display text-[16px] font-semibold tracking-[-0.01em] text-ink-primary">
            {pageTitle}
          </p>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <form
          action={searchAction}
          method="get"
          className="hidden max-w-md md:block lg:max-w-sm xl:max-w-md"
        >
          <label htmlFor="topbar-q" className="sr-only">
            Search suppliers
          </label>
          <div className="flex w-full min-w-[12rem] items-center gap-2 rounded-lg border border-hairline-strong bg-bg-l0 px-3 py-2 transition-colors focus-within:border-brand-forest/40 focus-within:bg-surface-l1 focus-within:shadow-sm lg:min-w-[14rem] xl:min-w-[16rem]">
            <MagnifyingGlass
              size={16}
              weight="bold"
              aria-hidden
              className="text-ink-tertiary"
            />
            <input
              id="topbar-q"
              name="q"
              type="search"
              placeholder="Search verified suppliers"
              className="w-full bg-transparent text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
            />
          </div>
        </form>

        {moatTotal != null ? (
          <Link
            href={variant === "buyer" ? "/app/discover" : "/admin/suppliers"}
            className="hidden shrink-0 items-center gap-2 rounded-lg border border-brand-forest/20 bg-brand-forest-soft px-3 py-1.5 xl:inline-flex"
            aria-label={`${moatTotal.toLocaleString("en-US")} verified suppliers`}
          >
            <span
              aria-hidden
              className="size-1.5 animate-pulse rounded-full bg-brand-forest"
            />
            <span className="font-display text-[14px] font-bold tabular-nums text-brand-forest">
              {moatTotal.toLocaleString("en-US")}
            </span>
            <span className="text-[13px] font-medium text-brand-forest/80">
              verified
            </span>
          </Link>
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            aria-label="Notifications"
            className="flex size-10 items-center justify-center rounded-lg text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary"
          >
            <Bell size={19} aria-hidden />
          </button>
          <Link
            href={variant === "admin" ? "/admin/users" : "/app/settings"}
            aria-label="Account menu"
            className="flex size-10 items-center justify-center rounded-full transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint"
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              displayName={displayName}
              email={email}
              size="sm"
            />
          </Link>
          <TopbarHamburger
            role={role}
            avatarUrl={avatarUrl}
            displayName={displayName}
            email={email}
          />
        </div>
      </div>
    </header>
  );
}
