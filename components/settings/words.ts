// The words of Settings (Paper `10 · Settings`, `11 · Settings`): the groups the navigation draws,
// the line under the signed-in email, and the one-line summary each phone row carries. Kept out of
// React so a test reads them. Paper's Audit log is design only (nothing records it) and is not here;
// Security is `components/security/`, Team and roles is `components/team/`.

import { planLabel, workspaceOf, type SettingsDoc } from "./doc";

export type SettingsKey = "profile" | "security" | "emails" | "company" | "team" | "templates" | "plan";

export type SettingsItem = { key: SettingsKey; label: string; href: string };

/** Paper's order: the account first, then the company. Company details is the page at `/app/settings`. */
export const SETTINGS_GROUPS: readonly { title: string; items: readonly SettingsItem[] }[] = [
  {
    title: "Your account",
    items: [
      { key: "profile", label: "Profile", href: "/app/settings/profile" },
      { key: "security", label: "Security", href: "/app/settings/security" },
      { key: "emails", label: "Emails", href: "/app/settings/notifications" },
    ],
  },
  {
    title: "Your company",
    items: [
      { key: "company", label: "Company details", href: "/app/settings" },
      { key: "team", label: "Team and roles", href: "/app/settings/members" },
      { key: "templates", label: "RFQ templates", href: "/app/settings/inquiry" },
      { key: "plan", label: "Plan and usage", href: "/app/settings/subscription" },
    ],
  },
];

export const SETTINGS_HOME = "/app/settings";
/** On a phone `/app/settings` is the list, so Company details has an address of its own. */
export const COMPANY_PHONE_HREF = "/app/settings/workspace";

export const itemOf = (key: SettingsKey): SettingsItem => SETTINGS_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)!;

/** "alex@example.com · Free plan (beta)"; null when the email could not be read. */
export function settingsSubline(doc: SettingsDoc | null): string | null {
  return doc?.email ? `${doc.email} · ${planLabel(doc.plan_tier)} plan (beta)` : null;
}

/** "Free during the beta", or the paid plan's name. */
export function planWords(doc: SettingsDoc | null): string {
  const label = planLabel(doc?.plan_tier);
  return label === "Free" ? "Free during the beta" : `${label} plan`;
}

/** The line a phone row carries under its name. */
export function rowLine(key: SettingsKey, doc: SettingsDoc | null): string {
  switch (key) {
    case "profile":
      return "Name, picture, email, password";
    case "security":
      return "Two-step sign-in, devices";
    case "emails":
      return "Quotes, saved suppliers, weekly summary";
    case "company": {
      const w = workspaceOf(doc);
      const line = [w.company_name, w.company_type].filter(Boolean).join(" · ");
      return line || "Not filled in yet";
    }
    case "team":
      return "People, roles and invites";
    case "templates":
      return "Opening message and questions";
    case "plan":
      return planWords(doc);
  }
}

export const SETTINGS_ERROR_TITLE = "We couldn't load your settings.";
export const SETTINGS_ERROR_BODY = "Check your connection. Your settings are safe.";
