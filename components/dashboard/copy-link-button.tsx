"use client";

// Share (REZ-C §3.3: "Share (copies the full-page URL)").
//
// In the overlay it copies the record's own page, `href`, made absolute at
// click time — not the results URL the overlay sits on, which would share a
// search. On the full page `href` is omitted and it copies `location.href`,
// which is that page.

import { useState } from "react";
import { Button } from "./controls";
import { Icon } from "./icons";

export function CopyLinkButton({ href }: { href?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    if (typeof window === "undefined") return;
    const url = href ? new URL(href, window.location.origin).href : window.location.href;
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
      <Button variant="ghost" onClick={copy} aria-label="Copy a link to this record" data-share-href={href ?? "this page"}>
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
