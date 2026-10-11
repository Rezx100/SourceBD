"use client";

// PostHog, loaded only after the visitor says yes: `posthog-js` is fetched by `import()` inside the
// first init, so a visitor who has not consented never downloads it (11 Oct 2026, the phone speed
// pass). Under the same yes, the page's real speed is reported (`useReportWebVitals`: INP, LCP, TTFB)
// so the founder can see what phones get after a deploy. Targets: INP under 200 ms at p75.

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import type { PostHog } from "posthog-js";

import { CONSENT_EVENT, readConsent } from "@/lib/consent";

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /^email(_primary)?$/i,
  /^phones?$/i,
  /^contact_(name|role)$/i,
  /^nid_number$/i,
  /^proprietor_nid$/i,
  /^owner_phone$/i,
  /^trade_license_number$/i,
  /^password$/i,
  /^verification_token(_hash)?$/i,
  /^body_ciphertext$/i,
  /^sbi(_.*)?$/i,
  /^pillar(_.*)?$/i,
  /^internal_score$/i,
  /^supplier_score_internal$/i,
];

function isForbiddenKey(key: string): boolean {
  for (const pat of FORBIDDEN) if (pat.test(key)) return true;
  return false;
}

function sanitize(properties: Record<string, unknown>): Record<string, unknown> {
  for (const k of Object.keys(properties)) {
    if (isForbiddenKey(k)) delete properties[k];
  }
  return properties;
}

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

const yes = () => readConsent(document.cookie)?.analytics === true;

function ensureInit(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (typeof window === "undefined") return Promise.resolve(null);
  // No page count is taken for someone who has not said yes (the cookie banner sets the choice).
  if (!yes()) return Promise.resolve(null);
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return Promise.resolve(null);
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      // The answer may have changed while the library downloaded: no init, so no page view, without a yes.
      if (!yes()) {
        loading = null;
        return null;
      }
      posthog.init(key, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
        capture_performance: false,
        disable_session_recording: true,
        person_profiles: "identified_only",
        sanitize_properties: sanitize,
      });
      client = posthog;
      flushVitals();
      return posthog;
    })
    .catch(() => {
      // A failed download is no analytics, never a broken page; the next yes tries again.
      loading = null;
      return null;
    });
  return loading;
}

/** The speed figures reported, as Next names them. */
export const VITALS: ReadonlySet<string> = new Set(["INP", "LCP", "TTFB"]);

type Vital = { metric: string; value: number; rating: string | undefined; navigation_type: string | undefined; path: string };
// LCP and TTFB arrive before the library does; a few are held until it has loaded.
const held: Vital[] = [];

function flushVitals(): void {
  if (!client || !yes()) {
    held.length = 0;
    return;
  }
  for (const v of held.splice(0)) client.capture("web_vital", v);
}

/** One speed figure, in whole milliseconds, for the page it was measured on. Nothing without a yes. */
export function reportVital(m: { name: string; value: number; rating?: string; navigationType?: string }): void {
  if (!VITALS.has(m.name) || typeof window === "undefined" || !yes()) return;
  const v: Vital = { metric: m.name, value: Math.round(m.value), rating: m.rating, navigation_type: m.navigationType, path: window.location.pathname };
  if (client) client.capture("web_vital", v);
  else if (held.length < 10) held.push(v);
}

export function PostHogProvider({
  userId,
  children,
}: {
  userId?: string | null;
  children: React.ReactNode;
}) {
  useReportWebVitals(reportVital);
  useEffect(() => {
    let live = true;
    const apply = () => {
      if (!yes()) {
        // A withdrawn yes stops counting at once.
        client?.opt_out_capturing();
        held.length = 0;
        return;
      }
      void ensureInit().then((posthog) => {
        // The answer may have changed while the library downloaded.
        if (!posthog || !live || !yes()) return;
        posthog.opt_in_capturing();
        if (userId) {
          posthog.identify(userId);
        } else {
          posthog.reset();
        }
      });
    };
    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => {
      live = false;
      window.removeEventListener(CONSENT_EVENT, apply);
    };
  }, [userId]);
  return <>{children}</>;
}
