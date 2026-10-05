"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

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

let initialised = false;

function ensureInit(): void {
  if (initialised) return;
  if (typeof window === "undefined") return;
  // No page count is taken for someone who has not said yes (the cookie banner sets the choice).
  if (readConsent(document.cookie)?.analytics !== true) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,
    capture_performance: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
    sanitize_properties: sanitize,
  });
  initialised = true;
}

export function PostHogProvider({
  userId,
  children,
}: {
  userId?: string | null;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const apply = () => {
      const yes = readConsent(document.cookie)?.analytics === true;
      if (!yes) {
        // A withdrawn yes stops counting at once.
        if (initialised) posthog.opt_out_capturing();
        return;
      }
      ensureInit();
      if (!initialised) return;
      posthog.opt_in_capturing();
      if (userId) {
        posthog.identify(userId);
      } else {
        posthog.reset();
      }
    };
    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => window.removeEventListener(CONSENT_EVENT, apply);
  }, [userId]);
  return <>{children}</>;
}
