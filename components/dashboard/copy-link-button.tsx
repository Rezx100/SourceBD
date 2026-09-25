"use client";

// Share, on the full record page (REZ-C §3.3: "Share (copies the full-page
// URL)").
//
// In the overlay, Share is "Open full page" — a real link to somewhere else.
// On the full page there is nowhere to go, and it was rendered as a link to
// the page the reader was already on, labelled "Share this record": a control
// with a name, a promise and no effect. This copies the URL.
//
// It reads `location.href` at click time rather than taking a prop, so what is
// copied is exactly what the reader is looking at.

import { useState } from "react";
import { Button } from "./controls";
import { Icon } from "./icons";

export function CopyLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    if (!url) return;
    try {
      // `navigator.clipboard` needs a secure context and permission, and is
      // absent in some in-app browsers. A silent no-op would be the same
      // defect this control exists to fix, so the failure is stated and the
      // reader can copy from the address bar.
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" onClick={copy} aria-label="Copy a link to this record">
        <Icon name="share" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      {/* Announced, not just shown: the button's own label does not change, so
          without this a screen-reader user gets no confirmation at all. */}
      <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
        {state === "copied" ? "Link copied" : state === "failed" ? "Could not copy — the link is in the address bar" : ""}
      </span>
    </span>
  );
}
