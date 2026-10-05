// Cookie consent (Paper `30 Marketing · Global · Cookie banner`). Two kinds only: the ones that keep a person
// signed in and remember this choice (always on, nothing to ask), and page counts (analytics), which are OFF until
// the person turns them on. Nothing is set before a choice, and "Reject non-essential" is as easy as "Accept all".
//
// The choice is one cookie the browser keeps for six months. `analytics` is read by the analytics provider
// before it starts anything, so no count is taken for someone who has not said yes.

export const CONSENT_COOKIE = "sbd_consent";
export const CONSENT_EVENT = "sbd:consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 183;

export type Consent = { v: 1; analytics: boolean };

/** `analytics:1` or `analytics:0`; anything else is no choice yet. */
export function parseConsent(raw: string | null | undefined): Consent | null {
  const m = /^v1\.(?:analytics=)?([01])$/.exec(raw ?? "");
  return m ? { v: 1, analytics: m[1] === "1" } : null;
}

export const serializeConsent = (c: Consent): string => `v1.analytics=${c.analytics ? 1 : 0}`;

/** The cookie string a browser sets: lax, site-wide, six months, secure on https. */
export function consentCookie(c: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(c)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Reads the choice from a `document.cookie` string. */
export function readConsent(cookieHeader: string | null | undefined): Consent | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === CONSENT_COOKIE) return parseConsent(v.join("="));
  }
  return null;
}
