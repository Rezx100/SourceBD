"use client";

// The frame of the admin and supplier portals (B10): the same look as the buyer's frame (`./frame.tsx`: the 224
// sidebar that is a 64 rail under 1440, the 56 topbar, a page that scrolls itself) with this portal's own menu in
// place of the buyer's, no search box (neither portal searches), and on a phone a menu button that opens every
// item in a sheet. The current item follows the URL on the client, because the layout is drawn once around every
// page of both portals. Counts beside an item come from the layout and are words ("3"), never a guess.

import {
  Certificate,
  ChatCircleText,
  ClockCounterClockwise,
  Database,
  FileMagnifyingGlass,
  FileText,
  Gauge,
  IdentificationBadge,
  List,
  Prohibit,
  Sparkle,
  Storefront,
  Tray,
  UserCircle,
  Users,
  UsersThree,
  CaretDown,
  SignOut,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ring, ringInset } from "@/components/kit/classes";
import { Menu, MenuItem, MenuSeparator } from "@/components/kit/overlay";
import { PORTAL_HOME, PORTAL_NAME, PORTAL_NAV, portalMatch, portalOf, portalTitle, type PortalBadgeKey, type PortalIconKey, type PortalItem } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";
import { MAIN_ID } from "./frame";
import { MenuDismiss } from "./menu-dismiss";
import { accountName, type FrameAccount } from "./topbar";

export const PORTAL_ICONS: Record<PortalIconKey, Icon> = {
  gauge: Gauge,
  sparkle: Sparkle,
  queue: FileText,
  store: Storefront,
  chat: ChatCircleText,
  badge: IdentificationBadge,
  certificate: Certificate,
  prohibit: Prohibit,
  database: Database,
  magnify: FileMagnifyingGlass,
  history: ClockCounterClockwise,
  users: Users,
  tray: Tray,
  partners: UsersThree,
  file: FileText,
};

/** The counts by badge key, as the layout read them; a key that could not be read is absent and draws nothing, never a 0. */
export type PortalBadges = Partial<Record<PortalBadgeKey, number | null>>;

function Row({ item, current, count }: { item: PortalItem; current: "page" | "true" | undefined; count: number | null | undefined }) {
  const G = PORTAL_ICONS[item.icon];
  const has = typeof count === "number" && count > 0;
  return (
    <Link
      href={item.href}
      aria-current={current}
      title={item.label}
      className={cn(
        "relative flex h-10 shrink-0 items-center justify-center gap-2.5 rounded-sm text-base transition-colors duration-fast 2xl:justify-start",
        current ? "rounded-l-none border-l-2 border-brand bg-brand-tint font-semibold text-ink 2xl:px-2.5" : "font-medium text-ink-2 hover:bg-sunken hover:text-ink 2xl:px-3",
        ringInset,
      )}
    >
      <G size={20} className="shrink-0 text-ink-2" aria-hidden />
      <span className="sr-only 2xl:not-sr-only 2xl:min-w-0 2xl:flex-1 2xl:truncate">
        {item.label}
        {has ? <span className="sr-only">, {count} waiting</span> : null}
      </span>
      {has ? (
        <>
          <span aria-hidden className="hidden shrink-0 text-xs font-semibold text-ink-2 [font-variant-numeric:tabular-nums] 2xl:inline">
            {count}
          </span>
          <span aria-hidden className="absolute left-1/2 top-2 ml-[5px] size-2 rounded-full border-2 border-subtle bg-danger-solid 2xl:hidden" />
        </>
      ) : null}
    </Link>
  );
}

function Sidebar({ badges }: { badges: PortalBadges }) {
  const pathname = usePathname() ?? "";
  const role = portalOf(pathname);
  const now = portalMatch(role, pathname);
  const current = (key: string) => (key === now.key ? (now.exact ? "page" : "true") : undefined);
  return (
    <aside aria-label="Menu" className="hidden h-full w-16 shrink-0 flex-col border-r border-line bg-subtle md:flex 2xl:w-sidebar">
      <div className="flex h-14 shrink-0 flex-col justify-center px-5">
        <Link href={PORTAL_HOME[role]} className={cn("hidden rounded-sm text-md font-semibold tracking-tight text-brand 2xl:block", ringInset)}>
          SourceBD
        </Link>
      </div>
      <nav aria-label={`${PORTAL_NAME[role]} menu`} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
        {PORTAL_NAV[role].map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <p className="hidden px-3 pb-1 font-mono text-xs text-ink-3 2xl:block">{g.label}</p>
            {g.items.map((item) => (
              <Row key={item.key} item={item} current={current(item.key)} count={item.badge ? badges[item.badge] : null} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function AccountMenu({ account }: { account: FrameAccount }) {
  const signOut = useRef<HTMLFormElement>(null);
  const name = accountName(account);
  const role = portalOf(usePathname() ?? "");
  return (
    <>
      <form ref={signOut} action="/auth/sign-out" method="post" hidden />
      <Menu
        align="end"
        trigger={
          <button type="button" aria-label={`Account: ${name}`} className={cn("flex h-9 items-center gap-2 rounded-sm px-2 text-base font-medium text-ink-2 transition-colors duration-fast hover:bg-sunken hover:text-ink", ring)}>
            <UserCircle size={20} className="shrink-0" aria-hidden />
            Account
            <CaretDown size={16} className="shrink-0 text-ink-3" aria-hidden />
          </button>
        }
      >
        <div className="flex flex-col px-2 pb-2 pt-1">
          <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
          {account.email && account.email !== name ? <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{account.email}</span> : null}
          <span className="pt-0.5 text-xs text-ink-3">{PORTAL_NAME[role]}</span>
        </div>
        <MenuSeparator />
        {role === "admin" ? <MenuItem href="/app">Open the buyer app</MenuItem> : null}
        <MenuItem onSelect={() => signOut.current?.requestSubmit()}>Sign out</MenuItem>
      </Menu>
    </>
  );
}

function Topbar({ account }: { account: FrameAccount }) {
  const role = portalOf(usePathname() ?? "");
  return (
    <div className="hidden h-topbar shrink-0 items-center justify-between gap-4 border-b border-line px-6 md:flex">
      <span className="font-mono text-base text-ink-3">{PORTAL_NAME[role]}</span>
      <AccountMenu account={account} />
    </div>
  );
}

/** Below 768: the page's title, and a button that opens every item and Sign out in a sheet. */
function PhoneBar({ account, badges }: { account: FrameAccount; badges: PortalBadges }) {
  const pathname = usePathname() ?? "";
  const role = portalOf(pathname);
  const now = portalMatch(role, pathname);
  const [open, setOpen] = useState(false);
  // The frame outlives every navigation: a chosen row closes the sheet.
  useEffect(() => setOpen(false), [pathname]);
  const name = accountName(account);
  return (
    <div className="sticky top-0 z-raised flex h-topbar shrink-0 items-center justify-between bg-surface pl-4 pr-1 md:hidden">
      <span className="truncate text-xl font-semibold tracking-tight text-ink">{portalTitle(role, pathname) ?? PORTAL_NAME[role]}</span>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild>
          <button type="button" aria-label="Menu" className={cn("flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2", ring)}>
            <List size={24} aria-hidden />
          </button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade motion-reduce:animate-none" />
          <D.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-modal flex max-h-[90dvh] flex-col overflow-auto rounded-t-lg bg-surface pb-[env(safe-area-inset-bottom)] pt-3 outline-none animate-rise motion-reduce:animate-none">
            <div aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-line-strong" />
            <div className="flex flex-col px-4 pb-3 pt-4">
              <D.Title className="text-md font-semibold text-ink [overflow-wrap:anywhere]">{name}</D.Title>
              <span className="text-sm text-ink-3">{PORTAL_NAME[role]}</span>
            </div>
            <nav aria-label={`${PORTAL_NAME[role]} menu`} className="flex flex-col border-t border-line">
              {PORTAL_NAV[role].flatMap((g) => g.items).map((item) => {
                const G = PORTAL_ICONS[item.icon];
                const count = item.badge ? badges[item.badge] : null;
                return (
                  <Link key={item.key} href={item.href} aria-current={item.key === now.key ? (now.exact ? "page" : "true") : undefined} className={cn("flex min-h-14 items-center gap-3 border-b border-line px-4 text-md", item.key === now.key ? "font-semibold text-ink" : "font-medium text-ink-2", ringInset)}>
                    <G size={24} className="shrink-0 text-ink-2" aria-hidden />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {typeof count === "number" && count > 0 ? <span className="text-sm font-semibold text-ink-2 [font-variant-numeric:tabular-nums]">{count}</span> : null}
                  </Link>
                );
              })}
              {role === "admin" ? (
                <Link href="/app" className={cn("flex min-h-14 items-center gap-3 border-b border-line px-4 text-md font-medium text-ink-2", ringInset)}>
                  Open the buyer app
                </Link>
              ) : null}
              <form action="/auth/sign-out" method="post">
                <button type="submit" className={cn("flex min-h-14 w-full items-center gap-3 px-4 text-md font-medium text-ink", ringInset)}>
                  <SignOut size={24} className="shrink-0 text-ink-2" aria-hidden />
                  Sign out of this device
                </button>
              </form>
            </nav>
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}

/** `account` is null when the sign-in could not be read: the frame still draws, with a plain "Your account". */
export function PortalFrame({ account: read, badges = {}, children }: { account: FrameAccount | null; badges?: PortalBadges; children: ReactNode }) {
  const account = read ?? { initial: null, name: null, email: null };
  return (
    <div className="group/shell flex min-h-dvh flex-col bg-surface font-sans text-ink antialiased md:h-dvh md:flex-row md:overflow-clip">
      <a href={`#${MAIN_ID}`} className={cn("sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-toast focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-base focus:font-medium focus:text-ink", ring)}>
        Skip to content
      </a>
      <Sidebar badges={badges} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar account={account} />
        <PhoneBar account={account} badges={badges} />
        <main id={MAIN_ID} tabIndex={-1} className="isolate flex min-h-0 flex-1 flex-col px-4 py-6 outline-none max-md:overflow-x-clip md:overflow-y-auto md:px-8 md:py-8">
          {children}
        </main>
        <MenuDismiss />
      </div>
    </div>
  );
}
