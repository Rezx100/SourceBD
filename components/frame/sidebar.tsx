"use client";

// The desktop sidebar (Paper `03 Patterns` · App shell desktop 1440): 224 wide on
// the subtle fill, the wordmark, six items, Products and Settings at the foot.
// Under 1440 it is a 64px rail of icons; each name stays for a screen reader and
// on hover, and a count becomes the phone tab bar's dot. A client component so
// the current item follows the URL: the layout draws the frame once.

import {
  Bell,
  BookmarkSimple,
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
      <span className="sr-only 2xl:not-sr-only 2xl:min-w-0 2xl:flex-1 2xl:truncate">
        {item.label}
        {badge ? <span className="sr-only">, {badge.text}</span> : null}
      </span>
      {badge ? (
        <>
          <span aria-hidden className={cn("hidden shrink-0 whitespace-nowrap text-xs font-semibold 2xl:inline", badge.tone === "danger" ? "text-danger" : "text-ink-2")}>
            {badge.text}
          </span>
          <span aria-hidden className="absolute left-1/2 top-2 ml-[5px] size-2 rounded-full border-2 border-subtle bg-danger-solid 2xl:hidden" />
        </>
      ) : null}
    </Link>
  );
}

/** Drawn at once without badges; the counts fill in when the layout's read settles, and the menu never waits on them. */
export function FrameSidebar({ badges, extra }: { badges?: BadgesInput; extra?: ReactNode }) {
  return (
    // The fallback has no `extra`: it is an async server element, and drawing it in both places would run its reads twice.
    <Suspense fallback={<SidebarBody badges={NO_BADGES} />}>
      <SidebarWithBadges badges={badges} extra={extra} />
    </Suspense>
  );
}

function SidebarWithBadges({ badges, extra }: { badges?: BadgesInput; extra?: ReactNode }) {
  return <SidebarBody badges={useBadges(badges)} extra={extra} />;
}

/** `extra` sits above Products and Settings: the getting-started card, drawn by the layout (a server element). */
function SidebarBody({ badges, extra }: { badges: FrameBadges; extra?: ReactNode }) {
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
        <nav aria-label="Products and settings" className="flex flex-col gap-0.5 border-t border-line px-3 pb-4 pt-2">
          {FRAME_FOOT.map((item) => (
            <Row key={item.key} item={item} current={current(item.key)} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
