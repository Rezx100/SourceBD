// AppShell of the dashboard kit (REZ-A, handoff §3.10): a 232px sidebar on
// canvas, a 56px frosted topbar, content at `content` width. Presentational —
// REZ-B wires the counts to `buyer_dashboard` and the nav to the routes.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Count, Kbd, LiveDot, Meter } from "./controls";
import { Icon, type IconName } from "./icons";
import { Caption, Label } from "./type";
import { RecentSearchesSlot } from "./recent-searches";

export type NavKey = "search" | "suppliers" | "products" | "rfqs" | "saved" | "messages" | "compliance";

export type SidebarModel = {
  active: NavKey;
  /** Live counts from `buyer_dashboard`; a count that could not be read is null and renders no pill. */
  counts: { suppliers?: number | null; rfqs?: number | null; saved?: number | null };
  recent: { label: string; count: number | null; href: string }[];
  /** Plan line: name, and the RFQ allowance when billing exists. */
  plan: { name: string; note?: string | null; used?: number | null; allowance?: number | null };
};

const NAV: readonly { key: NavKey; label: string; icon: IconName; href: string }[] = [
  { key: "search", label: "Search", icon: "search", href: "/app/discover" },
  { key: "suppliers", label: "Suppliers", icon: "building", href: "/app/discover" },
  { key: "products", label: "Products", icon: "tag", href: "/app/products" },
  { key: "rfqs", label: "RFQs", icon: "send", href: "/app/rfqs" },
  { key: "saved", label: "Saved", icon: "bookmark", href: "/app/saved" },
  { key: "messages", label: "Messages", icon: "chat", href: "/app/messages" },
  { key: "compliance", label: "Compliance hub", icon: "shield", href: "/app/compliance" },
];

function navCount(key: NavKey, counts: SidebarModel["counts"]): ReactNode {
  if (key === "search") return "⌘K";
  const n = key === "suppliers" ? counts.suppliers : key === "rfqs" ? counts.rfqs : key === "saved" ? counts.saved : null;
  return n === null || n === undefined ? null : formatCount(n);
}

export function Sidebar({ model, screenLabel }: { model: SidebarModel; screenLabel?: string }) {
  const { plan } = model;
  const pct =
    plan.used !== null && plan.used !== undefined && plan.allowance ? Math.round((plan.used / plan.allowance) * 100) : null;
  // Below `md` there is no room for a 232px rail beside the content — at
  // 320px it left about 88px to read in. It does not follow that the nav can
  // be hidden: an earlier pass did that and handed phones `BottomTabBar`
  // instead, which carries the app's top five destinations and NOT Products
  // or Compliance hub, both of which this kit's own rail lists. The kit
  // routes render no hamburger either, so those two became unreachable below
  // 768px while staying one click away above it — functionality lost at the
  // narrower width (WCAG 1.4.10).
  //
  // So it reflows instead of hiding: a horizontal, scrollable strip of the
  // same links under the topbar on phones, the full rail from `md`. Every
  // destination stays reachable at every width, with no drawer, no state and
  // no second navigation to keep in step.
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-line-subtle px-3 py-3 md:w-sidebar md:border-b-0 md:border-r md:py-4">
      <div className="hidden items-center gap-2.5 px-2 py-0.5 md:flex">
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-sm bg-brand font-mono text-xs font-medium tracking-[0.02em] text-brand-on"
        >
          SB
        </span>
        <span className="text-title font-medium tracking-[-0.01em] text-ink-strong">SourceBD</span>
      </div>
      <nav
        aria-label={screenLabel ? `Primary, ${screenLabel}` : "Primary"}
        className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0"
      >
        {NAV.map((item) => {
          const on = item.key === model.active;
          const count = navCount(item.key, model.counts);
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 snap-start items-center gap-2.5 whitespace-nowrap rounded-sm px-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken md:shrink",
                // The tint alone is 1.07:1 against the canvas beside it, so on
                // a dim screen the current item was indistinguishable from the
                // rest (WCAG 1.4.11 asks 3:1 for a state). `brand` is 7.87:1
                // against both, so the rail carries the state and the tint
                // only decorates it.
                on && "bg-brand-tint text-brand-ink hover:bg-brand-tint shadow-[inset_3px_0_0_rgb(var(--ds-brand))]",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
              {count !== null ? <Count className={cn("ml-auto", on && "text-brand-ink")}>{count}</Count> : null}
            </a>
          );
        })}
      </nav>
      {/* Rail furniture, not navigation: hidden on phones where the strip
          above carries every destination. */}
      <div className="hidden md:contents">
        <RecentSearchesSlot items={model.recent} />
      </div>
      <div className="mt-auto hidden flex-col gap-1.5 border-t border-line-subtle px-2 pt-4 md:flex">
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
    </aside>
  );
}

export type TopbarModel = {
  /** "10,266 published suppliers · 4 records on this page, read 18 May – 18 Sep 2026" */
  caption: string;
  /** The viewer's initial; null renders an empty avatar. */
  initial: string | null;
  searchAction?: string;
  searchQuery?: string;
};

export function Topbar({ model }: { model: TopbarModel }) {
  return (
    <div className="glass flex h-topbar shrink-0 items-center gap-3 border-b border-line-subtle px-4 sm:gap-4 sm:px-6">
      {model.searchAction ? (
        <form
          role="search"
          action={model.searchAction}
          method="get"
          className="flex h-control w-full min-w-0 max-w-[360px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle"
        >
          <Icon name="search" />
          <input
            type="search"
            name="q"
            defaultValue={model.searchQuery ?? ""}
            placeholder="Search suppliers, HS codes, certificates"
            aria-label="Search suppliers, HS codes, certificates"
            // No `outline-none`: Tailwind emits it as a transparent 2px outline
            // in @layer utilities, which lands after the global
            // `:focus-visible` ring in @layer base at equal specificity and
            // wins — leaving a keyboard user with no indicator at all on the
            // primary search field.
            className="grow bg-transparent text-ink-strong placeholder:text-ink-subtle"
          />
          <Kbd>⌘K</Kbd>
        </form>
      ) : (
        <div className="flex h-control w-full min-w-0 max-w-[360px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle">
          <Icon name="search" />
          <span className="grow">Search suppliers, HS codes, certificates</span>
          <Kbd>⌘K</Kbd>
        </div>
      )}
      <Caption className="ml-auto hidden items-center gap-2 lg:inline-flex">
        <LiveDot />
        {model.caption}
      </Caption>
      <Button variant="ghost" icon aria-label="Help">
        ?
      </Button>
      <span
        aria-hidden
        className={cn("grid size-7 place-items-center rounded-full text-xs font-medium", model.initial ? "bg-tier-2 text-tier-2-on" : "border border-line-strong bg-surface")}
      >
        {model.initial ?? ""}
      </span>
    </div>
  );
}

/** The shell: sidebar · (topbar + content). `Stage` wraps it when a sheet or dialog sits over it. */
export function AppShell({
  sidebar,
  topbar,
  contentClassName,
  /**
   * The content landmark's id, and the skip link's target. Six screens in one
   * gallery document all carried `ds-main`, so `getElementById` resolved every
   * skip link to the first screen and the page shipped six duplicate ids.
   */
  mainId = "ds-main",
  /**
   * Distinguishes this instance's nav, search and main landmarks — and its
   * skip link's own name — from another AppShell's when both are live in the
   * same accessible tree at once. The gallery renders several full, non-inert
   * instances on one page; the first pass at this only threaded the label
   * into `nav`/`search` and left three duplicate, unnamed `main` landmarks
   * and three identical "Skip to content" links behind (the accessibility
   * critic's cycle-18 finding — the same class of collision `mainId` already
   * disambiguates by id, `screenLabel` must also disambiguate by name). A
   * screen behind a modal (wrapped in `inert`) never needs one: `inert`
   * removes it from the accessibility tree entirely, so nothing there can
   * collide.
   */
  screenLabel,
  children,
}: {
  sidebar: SidebarModel;
  topbar: TopbarModel;
  contentClassName?: string;
  mainId?: string;
  screenLabel?: string;
  children: ReactNode;
}) {
  // Every screen opens with the same eight sidebar links. Without a `main`
  // landmark and a skip link there is no way past them: no landmark marks the
  // content, and three of the six screens rendered no heading either, so
  // heading navigation gave nothing (WCAG 2.4.1, level A). The app shell this
  // kit replaces already has both — `app/(app)/layout.tsx` renders `SkipLink`
  // and `<main id="main-content">`.
  return (
    <div className="flex min-h-full flex-col bg-canvas text-base text-ink md:flex-row">
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:border focus:border-line-strong focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-strong"
      >
        {screenLabel ? `Skip to content, ${screenLabel}` : "Skip to content"}
      </a>
      <Sidebar model={sidebar} screenLabel={screenLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar model={topbar} />
        <main
          id={mainId}
          aria-label={screenLabel}
          className={cn(
            "mx-auto flex w-full max-w-[calc(75rem+3rem)] flex-col gap-4 p-4 sm:p-6",
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
