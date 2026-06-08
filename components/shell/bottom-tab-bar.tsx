"use client";

// Spec R1 — BottomTabBar.
// Spec R2 — Wired into `app/(app)/layout.tsx` at `md:hidden` so phones get
// the bottom-tab + MobileDrawer hamburger combo, with no overlap onto the
// tablet rail or the desktop sidebar.
//
// Slot source: the SECTIONS map exported from
// `components/shell/sidebar.tsx`. R2 takes the first 5 slots of the
// flattened IA per variant — keeps the bar in sync with the full sidebar
// without re-declaring destinations.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import {
  SECTIONS,
  variantFromPath,
  type ShellVariant,
  type Slot,
} from "@/components/shell/sidebar";

function topTabs(variant: ShellVariant, n = 5): Slot[] {
  const flat = SECTIONS[variant].flatMap((s) => s.slots);
  return flat.slice(0, n);
}

// Short, single-word labels for the bottom tab — the full sidebar labels
// ("Search suppliers", "Saved suppliers", …) wrap to two lines and collide
// in a 5-up bar on a 375px phone. The sidebar/drawer keep the full labels.
const SHORT_LABELS: Record<string, string> = {
  "/app/discover": "Discover",
  "/app/match": "Match",
  "/app/saved": "Saved",
  "/app/messages": "Messages",
  "/app/rfqs": "RFQs",
  "/app/orders": "Orders",
  "/app/compliance": "Compliance",
  "/supplier": "Home",
  "/supplier/rfqs": "RFQs",
  "/supplier/messages": "Messages",
  "/supplier/profile": "Profile",
  "/supplier/claim": "Claim",
  "/admin": "Overview",
  "/admin/suppliers": "Suppliers",
  "/admin/claims": "Claims",
  "/admin/certifications": "Certs",
  "/admin/sanctions": "Sanctions",
};

function shortLabel(slot: Slot): string {
  return SHORT_LABELS[slot.href] ?? slot.label.split(" ")[0] ?? slot.label;
}

type BottomTabBarProps = {
  /** Explicit variant override (used by /dev/components showcase). */
  variant?: ShellVariant;
  /** Reserved for R2 (badge counts, role-aware filtering). */
  role?: Role | null;
  /** Optional className — R2 will pass `md:hidden` to confine to phones. */
  className?: string;
};

export function BottomTabBar({ variant, className }: BottomTabBarProps) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const slots = topTabs(v);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        // Fixed to viewport bottom with safe-area inset. Solid surface —
        // no glassmorphism — so labels never bleed into scrolling content
        // beneath the bar (enterprise-grade legibility over translucency).
        "fixed left-0 right-0 bottom-0 z-40 safe-bottom-0 safe-pb safe-px md:hidden",
        "border-t border-hairline-strong bg-surface-l1",
        // Light shadow toward content above.
        "shadow-[0_-6px_18px_-8px_rgba(15,15,20,0.12)]",
        className,
      )}
    >
      <ul
        role="list"
        className="m-0 flex list-none items-stretch justify-around p-0"
      >
        {slots.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href} className="relative min-w-0 flex-1">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[56px] min-h-[44px] flex-col items-center justify-center gap-1 px-0.5",
                  active
                    ? "text-brand-forest"
                    : "text-ink-tertiary hover:text-ink-primary",
                )}
              >
                <s.Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="w-full truncate text-center font-display text-[10px] font-medium leading-none tracking-[-0.005em]">
                  {shortLabel(s)}
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-pill bg-brand-forest"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
