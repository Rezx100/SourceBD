"use client";

// Spec R1 — SidebarRail (tablet icon-only collapsed sidebar).
//
// STANDALONE variant — does NOT edit `components/shell/sidebar.tsx`.
// R2 will mount this at `hidden md:flex lg:hidden` alongside the full
// sidebar at `lg:flex`. R1 only ships the component + showcases it.
//
// Slot list mirrors the existing `BUYER_SECTIONS` / `SUPPLIER_SECTIONS`
// / `ADMIN_SECTIONS` constants — see `components/shell/sidebar.tsx`.
// To keep R1 strictly additive (no edits to that file), the slot
// structure is duplicated below from the same source-of-truth shape;
// R2 will dedup by exporting them from `sidebar.tsx` and importing here.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  Certificate,
  ChatCircleText,
  ClockCounterClockwise,
  FileText,
  GearSix,
  Gauge,
  IdentificationBadge,
  MagnifyingGlass,
  Package,
  Prohibit,
  ShieldCheck,
  Sparkle,
  Storefront,
  Tray,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

type RailSlot = { label: string; href: string; Icon: Icon };
type RailVariant = "buyer" | "supplier" | "admin";

// Curated top-of-IA slots per variant (a subset of the full sidebar IA;
// the rail is icon-only so we keep the most-trafficked destinations).
const BUYER_RAIL: RailSlot[] = [
  { label: "Search suppliers", href: "/app/discover", Icon: MagnifyingGlass },
  { label: "Find matches", href: "/app/match", Icon: Sparkle },
  { label: "Saved", href: "/app/saved", Icon: BookmarkSimple },
  { label: "Messages", href: "/app/messages", Icon: ChatCircleText },
  { label: "RFQs", href: "/app/rfqs", Icon: FileText },
  { label: "Orders", href: "/app/orders", Icon: Package },
  { label: "Compliance", href: "/app/compliance", Icon: ShieldCheck },
  { label: "Settings", href: "/app/settings", Icon: GearSix },
];
const SUPPLIER_RAIL: RailSlot[] = [
  { label: "Dashboard", href: "/supplier", Icon: Gauge },
  { label: "Profile", href: "/supplier/profile", Icon: Storefront },
  { label: "Messages", href: "/supplier/messages", Icon: ChatCircleText },
  { label: "RFQs received", href: "/supplier/rfqs", Icon: Tray },
  { label: "Partners", href: "/supplier/partners", Icon: UsersThree },
  { label: "Documents", href: "/supplier/documents", Icon: FileText },
  { label: "Settings", href: "/app/settings", Icon: GearSix },
];
const ADMIN_RAIL: RailSlot[] = [
  { label: "Overview", href: "/admin", Icon: Gauge },
  { label: "Suppliers", href: "/admin/suppliers", Icon: Storefront },
  { label: "Claims", href: "/admin/claims", Icon: IdentificationBadge },
  { label: "Certifications", href: "/admin/certifications", Icon: Certificate },
  { label: "Sanctions", href: "/admin/sanctions", Icon: Prohibit },
  { label: "Audit log", href: "/admin/audit-log", Icon: ClockCounterClockwise },
  { label: "Users", href: "/admin/users", Icon: Users },
];

function variantFromPath(pathname: string): RailVariant {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "supplier";
  return "buyer";
}

const RAILS: Record<RailVariant, RailSlot[]> = {
  buyer: BUYER_RAIL,
  supplier: SUPPLIER_RAIL,
  admin: ADMIN_RAIL,
};

type SidebarRailProps = {
  /** Optional explicit variant (e.g. for the /dev/components showcase
   *  where the path may not match a real route). Falls back to path. */
  variant?: RailVariant;
  /** Role (currently unused for routing — server middleware gates
   *  routes — but kept in the API so R2 can drive visual a11y hints). */
  role?: Role | null;
  className?: string;
};

export function SidebarRail({ variant, className }: SidebarRailProps) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const slots = RAILS[v];

  return (
    <nav
      aria-label="Collapsed primary navigation"
      className={cn(
        // Visibility is the consumer's responsibility (R2 picks
        // `hidden md:flex lg:hidden`). R1 defaults to always-visible
        // so /dev/components can showcase it at every breakpoint.
        "sticky top-14 flex h-[calc(100dvh-56px)] w-[64px] flex-shrink-0 flex-col items-stretch gap-1 border-r border-hairline-strong bg-surface-l1 px-1 py-3",
        className,
      )}
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {slots.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(`${s.href}/`);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                aria-label={s.label}
                title={s.label}
                className={cn(
                  // 44×44 hit area, 20px glyph, label sr-only.
                  "group relative mx-auto flex h-[44px] w-[44px] items-center justify-center rounded-pill text-ink-tertiary transition-colors duration-hover ease-smooth",
                  active
                    ? "bg-brand-forest-tint text-brand-forest"
                    : "hover:bg-brand-forest-tint hover:text-ink-primary",
                )}
              >
                <s.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="sr-only">{s.label}</span>
                {/* Active marker — 3 px forest pill aligned to the left edge. */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute left-[-1px] top-1.5 bottom-1.5 w-[3px] rounded-pill bg-brand-forest"
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
