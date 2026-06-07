"use client";

// Spec R1 — BottomTabBar.
//
// Fixed bottom nav for phones. Visibility (when wired in R2):
// `md:hidden` — phone class only. Tablet portrait uses SidebarRail.
//
// Slot source is the existing `BUYER_SECTIONS` / `SUPPLIER_SECTIONS` /
// `ADMIN_SECTIONS` IA in `components/shell/sidebar.tsx`. Top 5 per
// variant; chosen by traffic + canonical workflow order. No new
// destinations invented.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  Certificate,
  ChatCircleText,
  Gauge,
  IdentificationBadge,
  MagnifyingGlass,
  Prohibit,
  ShieldCheck,
  Sparkle,
  Storefront,
  Tray,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

type Slot = { label: string; href: string; Icon: Icon };
type Variant = "buyer" | "supplier" | "admin";

const BUYER_TABS: Slot[] = [
  { label: "Search", href: "/app/discover", Icon: MagnifyingGlass },
  { label: "Match", href: "/app/match", Icon: Sparkle },
  { label: "Saved", href: "/app/saved", Icon: BookmarkSimple },
  { label: "Messages", href: "/app/messages", Icon: ChatCircleText },
  { label: "Compliance", href: "/app/compliance", Icon: ShieldCheck },
];
const SUPPLIER_TABS: Slot[] = [
  { label: "Home", href: "/supplier", Icon: Gauge },
  { label: "Profile", href: "/supplier/profile", Icon: Storefront },
  { label: "RFQs", href: "/supplier/rfqs", Icon: Tray },
  { label: "Messages", href: "/supplier/messages", Icon: ChatCircleText },
  { label: "Partners", href: "/supplier/partners", Icon: UsersThree },
];
const ADMIN_TABS: Slot[] = [
  { label: "Overview", href: "/admin", Icon: Gauge },
  { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
  { label: "Claims", href: "/admin/claims", Icon: IdentificationBadge },
  { label: "Certs", href: "/admin/certifications", Icon: Certificate },
  { label: "Sanctions", href: "/admin/sanctions", Icon: Prohibit },
];

function variantFromPath(pathname: string): Variant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "supplier";
  return "buyer";
}

const TABS: Record<Variant, Slot[]> = {
  buyer: BUYER_TABS,
  supplier: SUPPLIER_TABS,
  admin: ADMIN_TABS,
};

type BottomTabBarProps = {
  /** Explicit variant override (used by /dev/components showcase). */
  variant?: Variant;
  /** Reserved for R2 (badge counts, role-aware filtering). */
  role?: Role | null;
  /** Optional className — R2 will pass `md:hidden` to confine to phones. */
  className?: string;
};

export function BottomTabBar({ variant, className }: BottomTabBarProps) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const slots = TABS[v];

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        // Fixed to viewport bottom with safe-area inset; backdrop-blur so
        // content scrolling underneath stays legible.
        "fixed left-0 right-0 bottom-0 z-30 safe-bottom-0 safe-pb safe-px",
        "border-t border-hairline-strong bg-surface-l1/95",
        "supports-[backdrop-filter]:bg-surface-l1/82 supports-[backdrop-filter]:backdrop-blur",
        // Light shadow toward content above.
        "shadow-[0_-6px_18px_-8px_rgba(15,15,20,0.10)]",
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
            <li key={s.href} className="flex-1">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[56px] min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active
                    ? "text-brand-forest"
                    : "text-ink-tertiary hover:text-ink-primary",
                )}
              >
                <s.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="font-display tracking-[-0.005em]">{s.label}</span>
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
