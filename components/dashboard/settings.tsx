// Settings pieces of the dashboard kit (Spec B10): the settings frame with its
// sub-navigation, the plan labels, and the save feedback the settings forms
// share (a toast on success, an alert line on failure).
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

export type SettingsDoc = {
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  role: string | null;
  plan_tier: string | null;
  created_at: string | null;
  notifications: {
    digest: boolean;
    rfq_replies: boolean;
    saved_alerts: boolean;
  };
};

export function planLabel(tier: string | null | undefined): string {
  if (tier === "growth") return "Growth";
  if (tier === "enterprise") return "Enterprise";
  return "Starter";
}

export const SETTINGS_NAV = [
  { key: "overview", label: "Overview", href: "/app/settings" },
  { key: "profile", label: "Profile", href: "/app/settings/profile" },
  { key: "plan", label: "Plan", href: "/app/settings/plan" },
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
            {planLabel(settings.plan_tier)} plan
          </>
        ) : (
          "Manage your profile, plan, and notification preferences."
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
                    "flex h-8 items-center rounded-sm px-2.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken",
                    on && "bg-brand-tint font-semibold text-brand-ink ring-1 ring-inset ring-brand hover:bg-brand-tint",
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

/**
 * A settings page holds several forms, so no save button is the page's one
 * primary; a disabled one greys out, which the default variant does not do by itself.
 */
export const SAVING = "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled";

/** The footer row of a settings card: the submit button (which says "Saving…" while it works) and the toast. */
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
    <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-4 py-3">
      <Button type="submit" disabled={pending} aria-busy={pending || undefined} className={SAVING}>
        {pending ? pendingLabel : label}
      </Button>
      {children}
      {flash ? <Toast text={flash} href={null} className="fixed z-[60]" /> : null}
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
