// AppShell of the dashboard kit: a 232px sidebar on canvas, a 56px frosted
// topbar, and the content region. The buyer layout draws it ONCE around every
// /app page (27 Sep 2026): the rail and the topbar stay mounted across client
// navigations and only `<main>` changes. From `md` up the shell IS the
// viewport — the page never scrolls; the content region does, or a pane
// inside it (the results beside an open record, the inbox beside a thread).
// Below `md` the rail reflows into a strip under the logo and the document
// scrolls as one, which is what a phone expects.

import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NAV, activeNavKey, navMatch, type NavKey } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";
import { Kbd, LiveDot, Meter } from "./controls";
import { Icon } from "./icons";
import { RecentSearchesSlot } from "./recent-searches";
import { SearchCarry } from "./search-carry";
import { SearchShortcut } from "./search-shortcut";
import { SearchTypeahead } from "./search-typeahead";
import { SidebarNav, type NavCounts } from "./sidebar-nav";
import { Caption, Label } from "./type";

export { NAV, activeNavKey, navMatch, type NavKey };

export type SidebarModel = {
  /**
   * False when the buyer is on a page UNDER the active item rather than on it.
   * The rail then marks the row as current-section (`aria-current="true"`)
   * instead of current-page.
   */
  activeExact?: boolean;
  /**
   * The nav item to mark current. The layout leaves it out and the rail reads
   * the URL itself, so the mark follows every client navigation; the gallery
   * and the tests name a screen. `null` marks nothing — `/app/searches/new`
   * used to claim `"search"`, which put `aria-current="page"` on a link to a
   * page the buyer was not on (WCAG 4.1.2).
   */
  active?: NavKey | null;
  /** Live counts from `buyer_dashboard`; a count that could not be read is null and renders no pill. */
  counts: NavCounts;
  recent: { label: string; count: number | null; href: string }[];
  /** Plan line: name, and the RFQ allowance when billing exists. */
  plan: { name: string; note?: string | null; used?: number | null; allowance?: number | null };
  /** Who is signed in, drawn at the foot of the rail above the plan; the way to Settings. */
  account?: { initial: string | null; name: string | null; email: string | null };
};

export function Sidebar({ model, screenLabel }: { model: SidebarModel; screenLabel?: string }) {
  const { plan, account } = model;
  const pct =
    plan.used !== null && plan.used !== undefined && plan.allowance ? Math.round((plan.used / plan.allowance) * 100) : null;
  // Below `md` there is no room for a 232px rail beside the content — at
  // 320px it left about 88px to read in. It does not follow that the nav can
  // be hidden: an earlier pass did that and handed phones a bottom tab bar
  // with five of the ten destinations, so Products and Compliance hub became
  // unreachable below 768px (WCAG 1.4.10). So it reflows instead: a
  // horizontal, scrollable strip of the same links on phones, the full rail
  // from `md`, where it is the viewport's height and scrolls on its own.
  return (
    <aside
      aria-label={screenLabel ? `Sidebar, ${screenLabel}` : "Sidebar"}
      className="flex w-full shrink-0 flex-col gap-5 border-b border-line-subtle px-3 py-3 md:h-full md:w-sidebar md:overflow-y-auto md:border-b-0 md:border-r md:py-4"
    >
      {/* The way home: /app has no nav item of its own. */}
      <Link href="/app" aria-label="SourceBD home" className="hidden items-center gap-2.5 rounded-sm px-2 py-0.5 md:flex">
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-sm bg-brand font-mono text-xs font-medium tracking-[0.02em] text-brand-on"
        >
          SB
        </span>
        <span className="text-title font-medium tracking-[-0.01em] text-ink-strong">SourceBD</span>
      </Link>
      <SidebarNav
        label={screenLabel ? `Primary, ${screenLabel}` : "Primary"}
        active={model.active}
        activeExact={model.activeExact}
        counts={model.counts}
      />
      {/* Rail furniture, not navigation: hidden on phones where the strip
          above carries every destination. */}
      <div className="hidden md:contents">
        <RecentSearchesSlot items={model.recent} />
      </div>
      {/* No plan named (a loading state does not know it): no footer at all. */}
      {plan.name ? (
        <div data-plan="true" className="mt-auto hidden flex-col gap-3 border-t border-line-subtle px-2 pt-4 md:flex">
          {account ? (
            // The account, where every SaaS rail keeps it: who is signed in,
            // one click from Settings. The topbar's avatar goes there too.
            <Link
              href="/app/settings"
              className="-mx-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors duration-fast hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium",
                  account.initial ? "bg-tier-2 text-tier-2-on" : "border border-line-strong bg-surface",
                )}
              >
                {account.initial ?? ""}
              </span>
              <span className="flex min-w-0 flex-col">
                <Label className="text-ink-strong [overflow-wrap:anywhere]">{account.name ?? account.email ?? "Your account"}</Label>
                {account.name && account.email ? (
                  <Caption className="truncate" title={account.email}>
                    {account.email}
                  </Caption>
                ) : null}
              </span>
            </Link>
          ) : null}
          <div className="flex items-center gap-2">
            <Label className="text-ink-strong">{plan.name}</Label>
            {plan.note ? <Caption className="ml-auto">{plan.note}</Caption> : null}
          </div>
          {pct !== null ? (
            <>
              <Meter pct={pct} label={`RFQs used this month, ${plan.name}`} />
              <Caption>
                {plan.used} of {plan.allowance} RFQs this month
              </Caption>
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

export type TopbarModel = {
  /** "10,266 published suppliers · 4 records on this page, read 18 May – 18 Sep 2026" */
  caption: string;
  /** The viewer's initial; null renders an empty avatar. */
  initial: string | null;
  searchAction?: string;
  /** What the field starts with when the URL carries no `q` (the gallery). */
  searchQuery?: string;
};

export function Topbar({ model, screenLabel }: { model: TopbarModel; screenLabel?: string }) {
  return (
    <div className="glass flex h-topbar shrink-0 items-center gap-3 border-b border-line-subtle px-4 sm:gap-4 sm:px-6">
      {model.searchAction ? (
        // `next/form`: submitting runs a client navigation to the results
        // instead of reloading the document. Not prefetched, like the rail's
        // Search row: /app/discover is rate-limited and a prefetch spends the
        // allowance. The one search field in the app: on the results page the
        // filter bar carries chips, not a second box.
        <Form
          prefetch={false}
          role="search"
          // Named, because /app/products renders a search landmark of its own
          // and two unnamed ones are indistinguishable (WCAG 1.3.1). Not
          // `Search, ${screenLabel}` unconditionally: on the results page the
          // screen label IS "Search", and the landmark read "Search, Search".
          aria-label={screenLabel && screenLabel !== "Search" ? `Search, ${screenLabel}` : "Search"}
          action={model.searchAction}
          // `relative`: the typeahead's listbox hangs under this field.
          // `focus-within`: the whole field, not only the caret, says it is
          // live — the outline steps up to brand and the ring lifts it.
          className="relative flex h-control w-full min-w-0 max-w-[360px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle transition-[border-color,box-shadow] duration-fast focus-within:border-brand focus-within:shadow-xs"
        >
          <Icon name="search" />
          {/* The input itself, plus the suggestions under it as the buyer
              types. Renders the same `<input>` on the server — `name="q"`,
              `data-search="topbar"` — so the GET form and ⌘K work before any
              script runs, and without it. It reads the URL's `q` on the
              results page, and the filters ride along as hidden fields, so a
              new query keeps them. `Suspense`: both read the URL, which a
              statically rendered page (the gallery) has to defer. */}
          <Suspense fallback={null}>
            <SearchTypeahead defaultValue={model.searchQuery ?? ""} />
            <SearchCarry />
          </Suspense>
          <Kbd>⌘K</Kbd>
          <SearchShortcut />
        </Form>
      ) : (
        <div className="flex h-control w-full min-w-0 max-w-[360px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle">
          <Icon name="search" />
          <span className="min-w-0 grow truncate">Search suppliers, HS codes, certificates</span>
        </div>
      )}
      <Caption className="ml-auto hidden items-center gap-2 lg:inline-flex">
        <LiveDot />
        {model.caption}
      </Caption>
      {/* No Help button until /app/help exists: it had no destination
          (founder decision, 24 Sep). render.test.ts holds this. */}
      <Link
        href="/app/settings"
        aria-label="Account and settings"
        className={cn(
          "grid size-7 place-items-center rounded-full text-xs font-medium",
          model.initial ? "bg-tier-2 text-tier-2-on" : "border border-line-strong bg-surface",
        )}
      >
        <span aria-hidden>{model.initial ?? ""}</span>
      </Link>
    </div>
  );
}

/**
 * The shell: sidebar · (topbar + content). From `md` up it is exactly the
 * viewport: the rail scrolls on its own, `<main>` scrolls on its own, and a
 * page that wants panes of its own (the results beside a record) fills
 * `<main>` and scrolls inside them instead — `Page` is the frame for every
 * page that simply scrolls.
 */
export function AppShell({
  sidebar,
  topbar,
  className,
  contentClassName,
  /** The content landmark's id, and the skip link's target. Six screens in one gallery document must not share one. */
  mainId = "ds-main",
  /**
   * Distinguishes this instance's nav, search and main landmarks — and its
   * skip link's own name — from another AppShell's when both are live in the
   * same accessible tree at once (the gallery renders several).
   */
  screenLabel,
  children,
}: {
  sidebar: SidebarModel;
  topbar: TopbarModel;
  /** The gallery's frames have a height of their own: `md:h-full` there, the viewport here. */
  className?: string;
  contentClassName?: string;
  mainId?: string;
  screenLabel?: string;
  children: ReactNode;
}) {
  // Every screen opens with the same ten sidebar links. Without a `main`
  // landmark and a skip link there is no way past them (WCAG 2.4.1).
  return (
    <div className={cn("flex min-h-dvh flex-col bg-canvas text-base text-ink md:h-dvh md:flex-row md:overflow-hidden", className)}>
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:border focus:border-line-strong focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-strong"
      >
        {screenLabel ? `Skip to content, ${screenLabel}` : "Skip to content"}
      </a>
      <Sidebar model={sidebar} screenLabel={screenLabel} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar model={topbar} screenLabel={screenLabel} />
        <main
          id={mainId}
          aria-label={screenLabel}
          // Without it the skip link relies on the browser choosing to move
          // focus to a non-focusable fragment target, which older Safari does
          // not.
          tabIndex={-1}
          // The one scroll region of a plain page. A workbench page (the
          // search, the inbox) fills it with `min-h-0 flex-1` columns that
          // scroll themselves, and this never overflows.
          className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", contentClassName)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
