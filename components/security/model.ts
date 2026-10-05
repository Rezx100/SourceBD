// Security (Paper `10 · Settings · Security`), out of React: reading the two replies it rests on (the
// authenticator factors from Auth, the live sessions from `account_sessions()`, 0115), naming a browser from
// its user agent, and the words. Nothing here reads the database; a reply that is not the shape is null, never
// an empty list ("No other devices" must not be what a failed read says).

import { formatDay } from "@/lib/dashboard/facts";

export type Factor = { id: string; verified: boolean; createdAt: string | null };
export type Device = { id: string; startedAt: string | null; lastActiveAt: string | null; agent: string | null; current: boolean };

const iso = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

/** Auth's `listFactors().all`: the authenticator-app factors, verified or not. Null when the reply is not a list. */
export function parseFactors(all: unknown): Factor[] | null {
  if (!Array.isArray(all)) return null;
  const out: Factor[] = [];
  for (const f of all) {
    if (!f || typeof f !== "object") continue;
    const r = f as Record<string, unknown>;
    if (typeof r.id !== "string" || r.factor_type !== "totp") continue;
    out.push({ id: r.id, verified: r.status === "verified", createdAt: iso(r.created_at) });
  }
  return out;
}

/** `account_sessions()`'s rows. Null when the reply is not a list or a row is not the shape. */
export function parseDevices(raw: unknown): Device[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Device[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") return null;
    out.push({ id: r.id, startedAt: iso(r.created_at), lastActiveAt: iso(r.last_active_at), agent: typeof r.user_agent === "string" && r.user_agent.trim() ? r.user_agent : null, current: r.is_current === true });
  }
  // This device first, then the most recently active.
  return out.sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastActiveAt ?? "") - Date.parse(a.lastActiveAt ?? "") || 0);
}

/** "Chrome on Windows", "Safari on iPhone"; null when the agent is a server's or unknown ("node", empty). */
export function deviceName(agent: string | null): string | null {
  if (!agent || !/mozilla|applewebkit|gecko|opera|opr\//i.test(agent)) return null;
  const browser = /edg(e|a|ios)?\//i.test(agent)
    ? "Edge"
    : /opr\/|opera/i.test(agent)
      ? "Opera"
      : /firefox|fxios/i.test(agent)
        ? "Firefox"
        : /chrome|crios|chromium/i.test(agent)
          ? "Chrome"
          : /safari/i.test(agent)
            ? "Safari"
            : null;
  const os = /iphone|ipod/i.test(agent)
    ? "iPhone"
    : /ipad/i.test(agent)
      ? "iPad"
      : /android/i.test(agent)
        ? "Android"
        : /windows/i.test(agent)
          ? "Windows"
          : /mac os x|macintosh/i.test(agent)
            ? "Mac"
            : /cros/i.test(agent)
              ? "ChromeOS"
              : /linux|x11/i.test(agent)
                ? "Linux"
                : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}

export const deviceLabel = (d: Device): string => deviceName(d.agent) ?? "A browser session";

/** "2 Oct 2026", the way every other page writes a day. */
export const dayWords = (v: string | null): string | null => formatDay(v);

/** "active now" for this device, "last active 2 Oct 2026" for the others; the start date when it was never refreshed. */
export function deviceLine(d: Device): string {
  if (d.current) return "active now";
  const last = dayWords(d.lastActiveAt) ?? dayWords(d.startedAt);
  return last ? `last active ${last}` : "last active unknown";
}

export const SECURITY_COPY = {
  twoStepOff: "Ask for a code from an authenticator app when you sign in.",
  twoStepOn: "On. You enter a code from your authenticator app each time you sign in.",
  lostPhone: "If you lose your phone, contact support: we can remove it once we know it is you.",
  passwordNote: "Change it on your Profile. We ask for the current one first.",
  signedOutOthers: "Signed out of your other devices. They can work for up to an hour before the sign-out reaches them.",
  ended: "Signed out of that device.",
  sso: "Single sign-on (SAML) comes with Enterprise.",
} as const;

export const CODE_RE = /^\d{6}$/;
export const codeRefusal = (code: string): string | null => (CODE_RE.test(code.replace(/\s+/g, "")) ? null : "Enter the 6-digit code from your app.");
