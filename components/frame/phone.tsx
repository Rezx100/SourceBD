"use client";

// The phone frame (Paper `03 Patterns` · App shell phone 390 and 320, and
// `11 · Account`): a 56 top bar with the page's title and the 44 account
// button, and the tab bar (D-3). The account button opens the account page over
// everything: Products, HS codes, the settings pages, feedback and Sign out. A page that draws its own bar (a record, a
// thread: `data-detail`) hides both, as S-09 asks.

import { ArrowLeft, CaretRight, ChatCircleText, Cube, Hash, Package, ShieldCheck, SignOut, UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { ring, ringInset } from "@/components/kit/classes";
import { TabBar } from "@/components/kit/phone";
import { LinkPending } from "@/components/patterns/link-pending";
import { PHONE_TABS, phoneTab, phoneTitle } from "@/lib/frame-nav";
import { cn } from "@/lib/utils";
import { NO_BADGES, useBadges, type BadgesInput, type FrameBadges } from "./badges";
import { FRAME_ICONS } from "./sidebar";
import { accountName, type FrameAccount } from "./topbar";

// The feedback form is fetched when it is first opened, not with every page (11 Oct 2026, speed pass).
const FeedbackDialog = dynamic(() => import("./feedback").then((m) => m.FeedbackDialog), { ssr: false });

const HIDE_ON_DETAIL = "max-md:group-has-[[data-detail]]/shell:hidden";
// A page that starts at its own field (the search results, Paper page 36 `search-results`) has no title over it.
const HIDE_ON_OWN_TOP = "max-md:group-has-[[data-own-top]]/shell:hidden";

/** A row of the account page's first group (`11 · Account`): an icon, a title and its line, a caret. */
function SheetRow({ href, icon: G, title, line }: { href: string; icon: typeof Package; title: string; line: string }) {
  return (
    <Link href={href} className={cn("flex min-h-[60px] items-center gap-3 border-t border-line px-4 first:border-t-0 active:bg-sunken", ringInset)}>
      <G size={22} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px]/[18px] font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-3">{line}</span>
      </span>
      <LinkPending />
      <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

/** A row of the settings group: the page's name, what it says at a glance, a caret. */
function SettingsRow({ href, title, note }: { href: string; title: string; note?: string }) {
  return (
    <Link href={href} className={cn("flex min-h-[52px] items-center justify-between gap-2 border-t border-line px-4 first:border-t-0 active:bg-sunken", ringInset)}>
      <span className="text-[15px]/[18px] text-ink">{title}</span>
      <span className="flex items-center gap-2">
        {note ? <span className="text-sm text-ink-3">{note}</span> : null}
        <LinkPending />
        <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
      </span>
    </Link>
  );
}

const group = "flex flex-col overflow-clip rounded-[12px] border border-line";

/**
 * The account page (`11 · Account`): a full-screen sheet from the frame's account button. Who is
 * signed in, Products and HS codes, the settings pages, Send feedback and Sign out. Paper's "4
 * products" and "210 headings" counts are not here: the frame reads neither. Its "Sanctions always on"
 * is not either: no email setting holds sanctions (`components/settings/emails.ts`).
 */
function AccountSheet({ account, onFeedback }: { account: FrameAccount; onFeedback: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // The frame outlives every navigation: a chosen row closes the sheet.
  useEffect(() => setOpen(false), [pathname]);
  const name = accountName(account);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <button type="button" aria-label={`Account: ${name}`} className={cn("flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-2 active:bg-sunken", ring)}>
          <UserCircle size={24} aria-hidden />
        </button>
      </D.Trigger>
      <D.Portal>
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-modal flex flex-col overflow-auto bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] outline-none animate-rise motion-reduce:animate-none"
        >
          <div className="flex h-14 shrink-0 items-center px-3">
            <D.Close aria-label="Close" className={cn("group flex size-11 items-center justify-center rounded-full", ring)}>
              <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2 group-active:bg-line">
                <ArrowLeft size={17} weight="thin" aria-hidden />
              </span>
            </D.Close>
          </div>
          <div className="flex flex-col gap-[22px] px-5 pt-2">
            <div className="flex items-center gap-3.5">
              {account.avatarUrl ? (
                // A Supabase Storage URL the buyer uploaded (Settings → Profile).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatarUrl} alt="" className="size-[60px] shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-sunken text-lg/[24px] font-semibold text-ink-2">
                  {account.initial ?? ""}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <D.Title className="text-xl/[30px] font-medium tracking-tighter text-ink [overflow-wrap:anywhere]">{name}</D.Title>
                {account.email && account.email !== name ? <span className="text-sm/[16px] text-ink-3 [overflow-wrap:anywhere]">{account.email}</span> : null}
              </span>
            </div>
            <nav aria-label="Account" className="flex flex-col gap-[22px]">
              <div className={group}>
                {account.admin ? <SheetRow href="/admin" icon={ShieldCheck} title="Admin console" line="Queues, suppliers, sources" /> : null}
                <SheetRow href="/app/products" icon={Cube} title="Products" line="Only you see these" />
                <SheetRow href="/app/headings" icon={Hash} title="HS codes" line="HS headings from EPB export records" />
              </div>
              <div className={group}>
                <SettingsRow href="/app/settings" title="Profile and company" />
                <SettingsRow href="/app/settings/members" title="Team and roles" />
                <SettingsRow href="/app/settings/notifications" title="Emails" />
                <SettingsRow href="/app/settings/security" title="Security" />
                <SettingsRow href="/app/settings/subscription" title="Plan and usage" note="Free in the beta" />
              </div>
              <div className={group}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onFeedback();
                  }}
                  className={cn("flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[15px]/[18px] text-ink active:bg-sunken", ringInset)}
                >
                  <ChatCircleText size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
                  Send feedback
                </button>
                <form action="/auth/sign-out" method="post" className="border-t border-line">
                  <button type="submit" className={cn("flex min-h-[52px] w-full items-center gap-3 px-4 text-[15px]/[18px] text-ink active:bg-sunken", ringInset)}>
                    <SignOut size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
                    Sign out of this device
                  </button>
                </form>
              </div>
            </nav>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** The phone's top bar: the page title (24/600) and the account button. */
export function PhoneBar({ account }: { account: FrameAccount | null }) {
  const title = phoneTitle(usePathname() ?? "");
  const [feedback, setFeedback] = useState(false);
  return (
    <div className={cn("sticky top-0 z-raised flex h-topbar shrink-0 items-center justify-between bg-surface pl-4 pr-1 md:hidden", HIDE_ON_DETAIL, HIDE_ON_OWN_TOP)}>
      <span className="truncate text-xl font-semibold tracking-tight text-ink">{title}</span>
      {account ? <AccountSheet account={account} onFeedback={() => setFeedback(true)} /> : null}
      {feedback ? <FeedbackDialog onClose={() => setFeedback(false)} /> : null}
    </div>
  );
}

/** The tab bar, fixed to the foot below 768. A badge on a tab is a dot, and "Compliance, new" to a screen reader. */
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
