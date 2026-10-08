"use client";

// The desktop sidebar (Paper `03 Patterns` · App shell desktop 1440): 224 wide on
// the subtle fill, the wordmark, six items, Products and Settings, and the account row at
// the foot (DESIGN.md, Sidebar: the photo, the name, the plan, a menu). A count beside an
// item is a number in a mono pill ("10"); its words ("10 to check") are in the row's
// accessible name, so "Complia… 10 to check" cannot happen (the critique of 7 Oct 2026,
// item 7). Under 1440 it is a 64px rail of icons; each name stays for a screen reader and
// on hover, and a count becomes the phone tab bar's dot. A client component so the current
// item follows the URL: the layout draws the frame once.

import {
  Bell,
  BookmarkSimple,
  CaretUpDown,
  ChatCircleText,
  FileText,
  GearSix,
  MagnifyingGlass,
  Package,
  Receipt,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ringInset } from "@/components/kit/classes";
import { FRAME_FOOT, FRAME_NAV, frameMatch, type FrameItem, type FrameKey } from "@/lib/frame-nav";
import { cn } from "@/lib/utils";
import { NO_BADGES, useBadges, type BadgesInput, type FrameBadges } from "./badges";
import { AccountMenu, accountName, type FrameAccount } from "./topbar";

/** "120 to check" → "120", "99+ new" → "99+": the pill shows the figure; the words stay in the accessible name. */
export const badgeFigure = (text: string): string => /^\d+\+?/.exec(text)?.[0] ?? text;

export const FRAME_ICONS: Record<FrameKey, Icon> = {
  search: MagnifyingGlass,
  saved: BookmarkSimple,
  messages: ChatCircleText,
  rfqs: Receipt,
  orders: FileText,
  compliance: Bell,
  products: Package,
  settings: GearSix,
};

export type { FrameBadges } from "./badges";

function Row({ item, current, badge }: { item: FrameItem; current: "page" | "true" | undefined; badge?: FrameBadges[FrameKey] }) {
  const G = FRAME_ICONS[item.key];
  return (
    <Link
      href={item.href}
      aria-current={current}
      title={item.label}
      className={cn(
        "relative flex h-10 shrink-0 items-center justify-center gap-2.5 rounded-sm text-base transition-colors duration-fast 2xl:justify-start",
        current
          ? "rounded-l-none border-l-2 border-brand-ink bg-brand-tint font-semibold text-ink 2xl:px-2.5"
          : "font-medium text-ink-2 hover:bg-sunken hover:text-ink 2xl:px-3",
        ringInset,
      )}
    >
      <G size={20} className="shrink-0 text-ink-2" aria-hidden />
      <span className="sr-only 2xl:not-sr-only 2xl:min-w-0 2xl:flex-1">
        {item.label}
        {badge ? <span className="sr-only">, {badge.text}</span> : null}
      </span>
      {badge ? (
        <>
          <span aria-hidden className={cn("hidden h-5 shrink-0 items-center rounded-md px-1.5 font-mono text-xs font-medium tabular-nums 2xl:inline-flex", badge.tone === "caution" ? "bg-caution-tint text-caution" : "bg-sunken text-ink-2")}>
            {badgeFigure(badge.text)}
          </span>
          <span aria-hidden className="absolute left-1/2 top-2 ml-[5px] size-2 rounded-full border-2 border-subtle bg-danger-solid 2xl:hidden" />
        </>
      ) : null}
    </Link>
  );
}

/**
 * The account row at the sidebar's foot (DESIGN.md, Sidebar): the whole 48px row is the menu's
 * button: a 32px photo (the initials when there is none), the name on line one, the plan on line
 * two, an up-and-down chevron at the end. In the 64px rail the photo alone, named on hover and to a
 * screen reader. An unread sign-in still gets the menu ("Your account").
 */
function AccountRow({ account }: { account: FrameAccount }) {
  const name = accountName(account);
  const plan = account.plan ? `${account.plan} · Public beta` : "Public beta";
  return (
    <AccountMenu
      account={account}
      align="start"
      trigger={
        <button
          type="button"
          aria-label={`Account: ${name}`}
          title={`${name} · ${plan}`}
          data-account-row=""
          className={cn("flex h-12 w-full items-center justify-center gap-2.5 rounded-sm text-left transition-colors duration-fast hover:bg-sunken data-[state=open]:bg-brand-tint 2xl:justify-start 2xl:px-2", ringInset)}
        >
          {account.avatarUrl ? (
            // A Supabase Storage URL the buyer uploaded (Settings → Profile).
            // eslint-disable-next-line @next/next/no-img-element -- a remote avatar, 32px
            <img src={account.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-medium text-surface">
              {account.initial ?? ""}
            </span>
          )}
          <span className="hidden min-w-0 flex-1 flex-col 2xl:flex">
            <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
            <span className="text-sm text-ink-3">{plan}</span>
          </span>
          <CaretUpDown size={16} className="hidden shrink-0 text-ink-3 2xl:block" aria-hidden />
        </button>
      }
    />
  );
}

/** Drawn at once without badges; the counts fill in when the layout's read settles, and the menu never waits on them. */
export function FrameSidebar({ badges, extra, account }: { badges?: BadgesInput; extra?: ReactNode; account?: FrameAccount | null }) {
  return (
    // The fallback has no `extra`: it is an async server element, and drawing it in both places would run its reads twice.
    <Suspense fallback={<SidebarBody badges={NO_BADGES} account={account} />}>
      <SidebarWithBadges badges={badges} extra={extra} account={account} />
    </Suspense>
  );
}

function SidebarWithBadges({ badges, extra, account }: { badges?: BadgesInput; extra?: ReactNode; account?: FrameAccount | null }) {
  return <SidebarBody badges={useBadges(badges)} extra={extra} account={account} />;
}

/** `extra` sits above Products and Settings: the getting-started card, drawn by the layout (a server element). */
function SidebarBody({ badges, extra, account }: { badges: FrameBadges; extra?: ReactNode; account?: FrameAccount | null }) {
  const now = frameMatch(usePathname() ?? "");
  const current = (key: FrameKey) => (key === now.key ? (now.exact ? "page" : "true") : undefined);
  return (
    <aside aria-label="Menu" className="hidden h-full w-16 shrink-0 flex-col justify-between border-r border-line bg-subtle md:flex 2xl:w-sidebar">
      <div className="flex min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center px-5">
          <Link href="/app" className={cn("hidden rounded-sm text-md font-semibold tracking-tight text-brand 2xl:block", ringInset)}>
            SourceBD
          </Link>
        </div>
        <nav aria-label="Main menu" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {FRAME_NAV.map((item) => (
            <Row key={item.key} item={item} current={current(item.key)} badge={badges[item.key]} />
          ))}
        </nav>
      </div>
      <div className="flex min-h-0 flex-col">
        {extra}
        <nav aria-label="Products and settings" className="flex flex-col gap-0.5 border-t border-line px-3 pb-2 pt-2">
          {FRAME_FOOT.map((item) => (
            <Row key={item.key} item={item} current={current(item.key)} />
          ))}
        </nav>
        {account ? (
          <div className="border-t border-line px-3 py-2">
            <AccountRow account={account} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
