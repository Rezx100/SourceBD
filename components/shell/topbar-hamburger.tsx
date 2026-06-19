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
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-secondary transition-colors duration-hover ease-smooth hover:bg-[rgba(15,15,20,0.05)] hover:text-ink-primary md:hidden"
      >
        <ListIcon size={20} weight="bold" aria-hidden />
      </button>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        label={VARIANT_LABEL[v]}
      >
        <nav aria-label={`${VARIANT_LABEL[v]} sections`} className="flex flex-col gap-5">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
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
                      "group flex min-h-[44px] items-center gap-3 rounded-md px-2.5 text-[14px] transition-colors",
                      active
                        ? "bg-brand-forest-soft font-semibold text-brand-forest"
                        : "font-medium text-ink-secondary hover:bg-[rgba(15,15,20,0.045)] hover:text-ink-primary",
                    )}
                  >
                    <slot.Icon
                      size={19}
                      weight={active ? "fill" : "regular"}
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        active ? "text-brand-forest" : "text-ink-tertiary",
                      )}
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
