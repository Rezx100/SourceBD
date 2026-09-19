// AppShell of the dashboard kit (REZ-A, handoff §3.10): a 232px sidebar on
// canvas, a 56px frosted topbar, content at `content` width. Presentational —
// REZ-B wires the counts to `buyer_dashboard` and the nav to the routes.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Count, Kbd, LiveDot, Meter } from "./controls";
import { Icon, type IconName } from "./icons";
import { Caption, Eyebrow, Label } from "./type";

export type NavKey = "search" | "suppliers" | "products" | "rfqs" | "saved" | "messages" | "compliance";

export type SidebarModel = {
  active: NavKey;
  /** Live counts from `buyer_dashboard`; a missing count renders no pill. */
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

export function Sidebar({ model }: { model: SidebarModel }) {
  const { plan } = model;
  const pct =
    plan.used !== null && plan.used !== undefined && plan.allowance ? Math.round((plan.used / plan.allowance) * 100) : null;
  return (
    <aside className="flex w-sidebar shrink-0 flex-col gap-5 border-r border-line-subtle px-3 py-4">
      <div className="flex items-center gap-2.5 px-2 py-0.5">
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-sm bg-brand font-mono text-xs font-medium tracking-[0.02em] text-brand-on"
        >
          SB
        </span>
        <span className="text-title font-medium tracking-[-0.01em] text-ink-strong">SourceBD</span>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const on = item.key === model.active;
          const count = navCount(item.key, model.counts);
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken",
                on && "bg-brand-tint text-brand-ink hover:bg-brand-tint",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
              {count !== null ? <Count className={cn("ml-auto", on && "text-brand-ink")}>{count}</Count> : null}
            </a>
          );
        })}
      </nav>
      {model.recent.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Eyebrow className="px-2">Recent searches</Eyebrow>
          <div className="flex flex-col">
            {model.recent.map((r) => (
              <a
                key={r.href + r.label}
                href={r.href}
                className="block overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-2 py-[5px] text-sm text-ink hover:bg-surface-sunken"
              >
                {r.label}
                {r.count !== null ? <Count className="ml-1.5">{formatCount(r.count)}</Count> : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-1.5 border-t border-line-subtle px-2 pt-4">
        <div className="flex items-center gap-2">
          <Label className="text-ink-strong">{plan.name}</Label>
          {plan.note ? <Caption className="ml-auto">{plan.note}</Caption> : null}
        </div>
        {pct !== null ? (
          <>
            <Meter pct={pct} />
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
  /** "10,266 published suppliers · records read 18 Sep 2026" */
  caption: string;
  /** The viewer's initial; null renders an empty avatar. */
  initial: string | null;
};

export function Topbar({ model }: { model: TopbarModel }) {
  return (
    <div className="glass flex h-topbar shrink-0 items-center gap-4 border-b border-line-subtle px-6">
      <div
        role="search"
        className="flex h-control w-[360px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle"
      >
        <Icon name="search" />
        <span className="grow">Search suppliers, HS codes, certificates</span>
        <Kbd>⌘K</Kbd>
      </div>
      <Caption className="ml-auto inline-flex items-center gap-2">
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
  children,
}: {
  sidebar: SidebarModel;
  topbar: TopbarModel;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full bg-canvas text-base text-ink">
      <Sidebar model={sidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar model={topbar} />
        <div className={cn("mx-auto flex w-full max-w-[calc(75rem+3rem)] flex-col gap-4 p-6", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
