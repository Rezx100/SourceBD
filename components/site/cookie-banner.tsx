"use client";

// The cookie banner (Paper `30 Marketing · Global · Cookie banner`): "Reject non-essential" and "Accept all" are
// the same button, side by side, so saying no is exactly as easy as saying yes; "Choose cookies" opens the one
// real choice (page counts, off until turned on). Nothing is set before a choice, and the banner never blocks the
// page. The choice is one cookie (`lib/consent.ts`); the analytics provider reads it before it starts anything and
// listens for the change. "Cookie settings" in the footer reopens it. On a phone it is a compact sheet along the bottom
// edge: the sentence with "Choose cookies" at its end, then the two equal buttons (critique 22 Oct, S10); it still
// shows as soon as the page runs, since it asks for consent.

import { useEffect, useId, useState } from "react";
import { Button, Switch } from "@/components/kit";
import { CONSENT_EVENT, consentCookie, readConsent, type Consent } from "@/lib/consent";

export const OPEN_COOKIES_EVENT = "sbd:open-cookies";

function save(c: Consent) {
  document.cookie = consentCookie(c, window.location.protocol === "https:");
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** The card, with no state of its own about whether it is shown, so a test can draw each view. */
export function CookieCard({ view, analytics, onAnalytics, onReject, onAccept, onChoose, onSave, onBack }: {
  view: "ask" | "choose";
  analytics: boolean;
  onAnalytics: (on: boolean) => void;
  onReject: () => void;
  onAccept: () => void;
  onChoose: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const id = useId();
  return (
    <section
      role="region"
      aria-labelledby={`${id}-t`}
      className="fixed bottom-4 left-4 z-toast flex w-[calc(100vw-2rem)] max-w-[440px] flex-col gap-4 rounded-lg border border-line bg-surface p-5 font-sans text-ink shadow-dialog max-sm:inset-x-0 max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:gap-3 max-sm:rounded-none max-sm:rounded-t-lg max-sm:border-x-0 max-sm:border-b-0 max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-4"
    >
      {view === "ask" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <h2 id={`${id}-t`} className="text-md font-medium max-sm:sr-only">
              Cookies
            </h2>
            <p className="text-base text-ink-2 max-sm:text-sm">
              We use cookies that keep you signed in. With your OK, we would also count which pages people read. Nothing is set until you choose.{" "}
              <button type="button" className="font-medium text-ink underline decoration-1 underline-offset-2 sm:hidden" onClick={onChoose}>
                Choose cookies
              </button>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* The same kind and size: no choice is made to look like the one we want. */}
            <Button kind="secondary" size="md" className="max-sm:h-input-touch max-sm:flex-1" onClick={onReject}>
              Reject non-essential
            </Button>
            <Button kind="secondary" size="md" className="max-sm:h-input-touch max-sm:flex-1" onClick={onAccept}>
              Accept all
            </Button>
            <Button kind="quiet" size="md" className="max-sm:hidden" onClick={onChoose}>
              Choose cookies
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 id={`${id}-t`} className="text-md font-medium">
            Choose cookies
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            <li className="flex items-start justify-between gap-4 py-3 first:pt-0">
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-medium">Needed to run the site</p>
                <p className="text-sm text-ink-3">Keeps you signed in and remembers this choice.</p>
              </div>
              <p className="shrink-0 pt-0.5 text-sm font-medium text-ink-2">Always on</p>
            </li>
            <li className="flex items-start justify-between gap-4 py-3 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-medium">Page counts</p>
                <p className="text-sm text-ink-3">Which pages people read. Off until you turn it on.</p>
              </div>
              <Switch aria-label="Page counts" checked={analytics} onChange={(e) => onAnalytics(e.target.checked)} />
            </li>
          </ul>
          <div className="flex gap-2">
            <Button kind="quiet" size="md" className="max-sm:h-input-touch" onClick={onBack}>
              Back
            </Button>
            <Button kind="secondary" size="md" className="max-sm:h-input-touch max-sm:flex-1" onClick={onSave}>
              Save choice
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function CookieBanner() {
  const [view, setView] = useState<"hidden" | "ask" | "choose">("hidden");
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    // Read after mount: the server cannot see the cookie the browser keeps for this choice.
    const have = readConsent(document.cookie);
    if (have) setAnalytics(have.analytics);
    else setView("ask");
    const reopen = () => {
      setAnalytics(readConsent(document.cookie)?.analytics === true);
      setView("choose");
    };
    window.addEventListener(OPEN_COOKIES_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIES_EVENT, reopen);
  }, []);
  if (view === "hidden") return null;
  const done = (a: boolean) => {
    save({ v: 1, analytics: a });
    setView("hidden");
  };
  return <CookieCard view={view} analytics={analytics} onAnalytics={setAnalytics} onReject={() => done(false)} onAccept={() => done(true)} onChoose={() => setView("choose")} onSave={() => done(analytics)} onBack={() => setView(readConsent(document.cookie) ? "hidden" : "ask")} />;
}

/** The footer's "Cookie settings". */
export function CookieSettingsButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIES_EVENT))} className="w-fit text-left text-sm text-ink-3 underline decoration-1 hover:text-ink max-md:min-h-11">
      Cookie settings
    </button>
  );
}
