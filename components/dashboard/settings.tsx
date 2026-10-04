// Settings pieces of the dashboard kit (Spec B10): the settings frame with its
// sub-navigation, the plan labels, the workspace and inquiry documents
// `settings_get` returns, and the save feedback the settings forms share (a
// toast on success, an alert line on failure).
//
// No "use client": the frame renders on the server; the forms, which are
// client islands, import `FormActions` and `FormError` from here (and
// `useFlash` from `./use-flash`, which a server module cannot import).

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./controls";
import { Icon } from "./icons";
import { PageHeader } from "./page";
import { Toast } from "./toast";

import { COMPANY_TYPES, EMPLOYEE_BANDS, PLAN_NOTE, inquiryOf, planLabel, workspaceOf, type InquiryDoc, type SettingsDoc, type WorkspaceDoc } from "@/components/settings/doc";

export { COMPANY_TYPES, EMPLOYEE_BANDS, PLAN_NOTE, inquiryOf, planLabel, workspaceOf };
export type { InquiryDoc, SettingsDoc, WorkspaceDoc };

export const SETTINGS_NAV = [
  { key: "workspace", label: "Workspace", href: "/app/settings" },
  { key: "subscription", label: "Subscription", href: "/app/settings/subscription" },
  { key: "members", label: "Members", href: "/app/settings/members" },
  { key: "inquiry", label: "Inquiry", href: "/app/settings/inquiry" },
  { key: "profile", label: "Profile", href: "/app/settings/profile" },
  { key: "notifications", label: "Notifications", href: "/app/settings/notifications" },
] as const;

export type SettingsKey = (typeof SETTINGS_NAV)[number]["key"];

/** The one `h1` of every settings page: "Settings", and who is signed in on which plan. */
export function SettingsHeader({ settings }: { settings: SettingsDoc | null }) {
  return (
    <PageHeader
      title="Settings"
      caption={
        settings?.email ? (
          <>
            Signed in as <span className="font-medium text-ink [overflow-wrap:anywhere]">{settings.email}</span> ·{" "}
            {planLabel(settings.plan_tier)} plan · {PLAN_NOTE}
          </>
        ) : (
          "Your company, plan, team, RFQ defaults, profile and email preferences."
        )
      }
    />
  );
}

/**
 * Sub-navigation on the left, content on the right; on a phone the links wrap
 * into a row above the content. Wrapping, not `overflow-x-auto`: a scroll
 * strip clips the focus ring top and bottom (see the rail in `app-shell.tsx`).
 */
export function SettingsFrame({ current, children }: { current: SettingsKey; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <nav aria-label="Settings" className="shrink-0 md:w-44">
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0 md:flex-col">
          {SETTINGS_NAV.map((item) => {
            const on = item.key === current;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    // 44px under a finger on a phone, pressed grey on a tap.
                    "flex h-8 items-center rounded-sm px-2.5 text-sm font-medium text-ink-muted transition-colors duration-fast [touch-action:manipulation] hover:bg-surface-sunken hover:text-ink-strong active:bg-surface-sunken max-sm:h-target max-sm:px-3",
                    // The current page: its tint is 1.07:1 from a hovered row's, so a
                    // near-black bar carries it (under it on a phone, at its start as
                    // a side nav), as on the rail.
                    on &&
                      "bg-brand-tint font-semibold text-brand-ink shadow-[inset_0_-2px_0_rgb(var(--ds-accent))] hover:bg-brand-tint hover:text-brand-ink md:shadow-[inset_3px_0_0_rgb(var(--ds-accent))]",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  );
}

/** The footer row of a settings section: its save button (which says "Saving…" while it works) and the toast. */
export function FormActions({
  pending,
  label,
  pendingLabel = "Saving…",
  flash,
  children,
}: {
  pending: boolean;
  label: string;
  pendingLabel?: string;
  flash: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
      <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? pendingLabel : label}
      </Button>
      {children}
      {flash ? <Toast text={flash} href={null} className="fixed z-toast" /> : null}
    </div>
  );
}

/** A save that failed: said next to the control, and announced. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 flex items-start gap-1.5 text-sm text-danger-ink">
      <Icon name="warn" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
