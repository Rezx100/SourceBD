"use client";

// The phone frame (Paper `03 Patterns` · App shell phone 390 and 320, and
// `11 · Account sheet`): a 56 top bar with the page's title and the 44 account
// button, and the tab bar (D-3). The account button opens a sheet with Products,
// HS codes, Settings and Sign out. A page that draws its own bar (a record, a
// thread: `data-detail`) hides both, as S-09 asks.

import { CaretRight, GearSix, Hash, Package, SignOut, UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { Suspense, useEffect, useState } from "react";
import { ring, ringInset } from "@/components/kit/classes";
import { TabBar } from "@/components/kit/phone";
import { PHONE_TABS, phoneTab, phoneTitle } from "@/lib/frame-nav";
import { cn } from "@/lib/utils";
import { NO_BADGES, useBadges, type BadgesInput, type FrameBadges } from "./badges";
import { FRAME_ICONS } from "./sidebar";
import { accountName, type FrameAccount } from "./topbar";

const HIDE_ON_DETAIL = "max-md:group-has-[[data-detail]]/shell:hidden";

function SheetRow({ href, icon: G, title, line }: { href: string; icon: typeof Package; title: string; line: string }) {
  return (
    <Link href={href} className={cn("flex min-h-14 items-center gap-3 border-b border-line pl-4 pr-2", ringInset)}>
      <G size={24} className="shrink-0 text-ink-2" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-md font-medium text-ink">{title}</span>
        <span className="text-sm text-ink-3">{line}</span>
      </span>
      <span className="flex size-11 shrink-0 items-center justify-center">
        <CaretRight size={20} className="text-ink-3" aria-hidden />
      </span>
    </Link>
  );
}

function AccountSheet({ account }: { account: FrameAccount }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // The frame outlives every navigation: a chosen row closes the sheet.
  useEffect(() => setOpen(false), [pathname]);
  const name = accountName(account);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <button type="button" aria-label={`Account: ${name}`} className={cn("flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2", ring)}>
          <UserCircle size={24} aria-hidden />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade motion-reduce:animate-none" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-modal flex max-h-[90dvh] flex-col overflow-auto rounded-t-lg bg-surface pb-[env(safe-area-inset-bottom)] pt-3 outline-none animate-rise motion-reduce:animate-none"
        >
          <div aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-line-strong" />
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            {account.avatarUrl ? (
              // A Supabase Storage URL the buyer uploaded (Settings → Profile).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-md font-semibold text-ink-2">
                {account.initial ?? ""}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <D.Title className="text-md font-semibold text-ink [overflow-wrap:anywhere]">{name}</D.Title>
              {account.email && account.email !== name ? <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{account.email}</span> : null}
            </span>
          </div>
          <nav aria-label="Account" className="flex flex-col border-t border-line">
            <SheetRow href="/app/products" icon={Package} title="Products" line="Only you see these" />
            <SheetRow href="/app/headings" icon={Hash} title="HS codes" line="HS headings from EPB export records" />
            <SheetRow href="/app/settings" icon={GearSix} title="Settings" line="Profile, company, team, emails" />
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
  );
}

/** The phone's top bar: the page title (24/600) and the account button. */
export function PhoneBar({ account }: { account: FrameAccount | null }) {
  const title = phoneTitle(usePathname() ?? "");
  return (
    <div className={cn("sticky top-0 z-raised flex h-topbar shrink-0 items-center justify-between bg-surface pl-4 pr-1 md:hidden", HIDE_ON_DETAIL)}>
      <span className="truncate text-xl font-semibold tracking-tight text-ink">{title}</span>
      {account ? <AccountSheet account={account} /> : null}
    </div>
  );
}

/** The tab bar, fixed to the foot below 768. A badge on a tab is a dot, and "Alerts, new" to a screen reader. */
export function PhoneTabs({ badges }: { badges?: BadgesInput }) {
  return (
    <Suspense fallback={<PhoneTabsBody badges={NO_BADGES} />}>
      <PhoneTabsWithBadges badges={badges} />
    </Suspense>
  );
}

function PhoneTabsWithBadges({ badges }: { badges?: BadgesInput }) {
  return <PhoneTabsBody badges={useBadges(badges)} />;
}

function PhoneTabsBody({ badges }: { badges: FrameBadges }) {
  const now = phoneTab(usePathname() ?? "");
  return (
    <div className={cn("fixed inset-x-0 bottom-0 z-raised md:hidden", HIDE_ON_DETAIL)}>
      <TabBar
        label="Tabs"
        items={PHONE_TABS.map((t) => ({ href: t.href, label: t.label, icon: FRAME_ICONS[t.key], current: t.key === now, isNew: Boolean(badges[t.key]) }))}
      />
    </div>
  );
}
