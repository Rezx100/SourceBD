"use client";

// 1 · The announcement bar (Paper `1EU6-0` / `1EV3-0`). Dismissing it keeps a cookie for 30 days, the one cookie
// the home page sets; the page reads it on the server, so a dismissed bar never flashes back. The film, when it is
// asked for, opens on its own ground with no bar, as it always has.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { filmOn } from "@/components/site/film/engine/tier";
import { useState } from "react";
import { ANNOUNCE_COOKIE } from "./cookie";

const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Announcement() {
  const [open, setOpen] = useState(true);
  // `?.`: outside the app router (a test, a static render) there are no search params.
  const film = filmOn(useSearchParams()?.get("film") ?? undefined, process.env.NEXT_PUBLIC_HOME_FILM ?? "0");
  if (!open || film) return null;
  const dismiss = () => {
    document.cookie = `${ANNOUNCE_COOKIE}=1; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
    setOpen(false);
  };
  return (
    <div role="region" aria-label="Announcement" className="relative border-b border-line-subtle bg-brand-wash">
      <div className="mx-auto flex min-h-9 max-w-[1440px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-12 py-2 text-center text-[14px] leading-4 text-ink-strong">
        <span>UFLPA and sanctions checks now run on every saved supplier</span>
        <Link href="/compliance" prefetch={false} className={`inline-flex items-center gap-1 font-medium underline decoration-1 underline-offset-4 ${ring}`}>
          See the Compliance hub
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcement" className={`absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-ink-strong/5 ${ring}`}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
