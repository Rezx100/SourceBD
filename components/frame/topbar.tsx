"use client";

// The desktop topbar (Paper `03 Patterns` · App shell desktop 1440): 56 tall, the
// app's one search box (480, Ctrl K). The account control is the row at the sidebar's foot
// (DESIGN.md, Sidebar; the critique of 7 Oct 2026, item 7: the topbar's icon + "Account" was a
// placeholder), whose menu is `AccountMenu` here. Below 768 the phone bar takes its place. The
// field is a plain GET form to the results, so it works before any script runs; the suggestions
// under it are `components/search/typeahead.tsx`.

import { MagnifyingGlass } from "@phosphor-icons/react";
import Form from "next/form";
import { usePathname } from "next/navigation";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { Menu, MenuItem, MenuSeparator } from "@/components/kit/overlay";
import { SearchCombobox } from "@/components/search/typeahead";
import { FeedbackDialog } from "./feedback";
import { SearchCarry } from "./search-carry";
import { SearchShortcut } from "./search-shortcut";
import { pageDrawsOwnField, useApplePlatform } from "./topbar-search-slot";

/** `admin` only adds a link: /admin checks the role on the server itself (AGENTS rule 7). `plan` is the row's second line ("Free plan"). */
export type FrameAccount = { initial: string | null; name: string | null; email: string | null; avatarUrl?: string | null; admin?: boolean; plan?: string | null };

/** The name the account menu prints: the profile's name, else the email's name part. */
export function accountName(account: FrameAccount): string {
  return account.name ?? account.email?.split("@")[0] ?? "Your account";
}

function SearchField() {
  const apple = useApplePlatform();
  return (
    <Form
      prefetch={false}
      role="search"
      aria-label="Search"
      action="/app/discover"
      className="relative flex h-9 w-dialog min-w-0 shrink items-center gap-2 rounded-sm border border-line-strong px-3 transition-colors duration-fast hover:border-ink-3 focus-within:border-brand-ink focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand-ink)]"
    >
      <MagnifyingGlass size={16} className="shrink-0 text-ink-3" aria-hidden />
      <Suspense fallback={<input type="search" name="q" data-search="topbar" aria-label="Search" placeholder="Supplier, product or certificate" className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3" />}>
        <SearchCombobox variant="topbar" placeholder="Supplier, product or certificate" shortcutTarget />
        <SearchCarry />
      </Suspense>
      <kbd aria-label={apple ? "Command K" : "Control K"} className="shrink-0 rounded-sm border border-line px-1.5 font-sans text-xs text-ink-3">
        {apple ? "⌘ K" : "Ctrl K"}
      </kbd>
      <SearchShortcut />
    </Form>
  );
}

/** The account menu (the name, Settings, Plan, Send feedback, Sign out) behind whatever `trigger` opens it: the sidebar's account row. */
export function AccountMenu({ account, trigger, align = "end" }: { account: FrameAccount; trigger: ReactNode; align?: "start" | "end" }) {
  const signOut = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState(false);
  const name = accountName(account);
  return (
    <>
      <form ref={signOut} action="/auth/sign-out" method="post" hidden />
      {feedback ? <FeedbackDialog onClose={() => setFeedback(false)} /> : null}
      <Menu align={align} trigger={trigger}>
        <div className="flex flex-col px-2 pb-2 pt-1">
          <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
          {account.email && account.email !== name ? <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{account.email}</span> : null}
        </div>
        <MenuSeparator />
        {account.admin ? <MenuItem href="/admin">Admin console</MenuItem> : null}
        <MenuItem href="/app/settings">Settings</MenuItem>
        <MenuItem href="/app/settings/subscription">Plan</MenuItem>
        <MenuItem onSelect={() => setFeedback(true)}>Send feedback</MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => signOut.current?.requestSubmit()}>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}

export function FrameTopbar() {
  const own = pageDrawsOwnField(usePathname());
  return (
    <div className="hidden h-topbar shrink-0 items-center gap-4 border-b border-line px-6 md:flex">
      {/* The search landing draws the one large field itself: no second box above it. */}
      {own ? null : <SearchField />}
    </div>
  );
}
