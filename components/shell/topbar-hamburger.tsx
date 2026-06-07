"use client";

// Spec R2 — Topbar hamburger island.
//
// Renders the <md hamburger button + the MobileDrawer it opens. Mounted
// from the (server) Topbar so the rest of the chrome stays static. The
// drawer body is the full Sidebar's nav slot list, rendered as a flat
// link list per variant from the SECTIONS map.
//
// Visibility: `md:hidden` — phones only. Tablet (md..<lg) gets
// SidebarRail. Desktop (≥lg) gets the full Sidebar.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List as ListIcon } from "@phosphor-icons/react/dist/ssr";

import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { cn } from "@/lib/utils";
import {
  SECTIONS,
  VARIANT_LABEL,
  variantFromPath,
  type ShellVariant,
} from "@/components/shell/sidebar";

export function TopbarHamburger({
  variant,
}: {
  variant?: ShellVariant;
}) {
  const pathname = usePathname() ?? "/app";
  const v = variant ?? variantFromPath(pathname);
  const sections = SECTIONS[v];
  const [open, setOpen] = React.useState(false);

  // Close on route change.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${VARIANT_LABEL[v]} menu`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-pill text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint hover:text-ink-primary md:hidden"
      >
        <ListIcon size={20} weight="bold" aria-hidden />
      </button>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        label={VARIANT_LABEL[v]}
      >
        <nav aria-label={`${VARIANT_LABEL[v]} sections`} className="flex flex-col gap-1">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="px-2 pt-3 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-tertiary first:pt-0">
                {section.label}
              </p>
              {section.slots.map((slot) => {
                const active =
                  pathname === slot.href ||
                  pathname.startsWith(`${slot.href}/`);
                return (
                  <Link
                    key={slot.href}
                    href={slot.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center gap-3 rounded-pill px-3 text-[14px] font-medium",
                      active
                        ? "bg-brand-forest-tint text-brand-forest"
                        : "text-ink-primary hover:bg-brand-forest-tint",
                    )}
                  >
                    <slot.Icon
                      size={18}
                      weight={active ? "fill" : "regular"}
                      aria-hidden
                    />
                    <span>{slot.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </MobileDrawer>
    </>
  );
}
