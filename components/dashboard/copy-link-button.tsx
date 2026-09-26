"use client";

// Share (REZ-C §3.3: "Share (copies the full-page URL)").
//
// It copies the record's own page, `href`, made absolute at click time — in
// the overlay never the results URL it sits on, which would share a search.
// When the clipboard refuses, the link is shown to copy by hand: the address
// bar holds the search, not this record.

import { useState } from "react";
import { Button } from "./controls";
import { Icon } from "./icons";

export function CopyLinkButton({ href }: { href: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [url, setUrl] = useState("");

  async function copy() {
    if (typeof window === "undefined") return;
    const absolute = new URL(href, window.location.origin).href;
    setUrl(absolute);
    try {
      // `navigator.clipboard` needs a secure context and permission, and is
      // absent in some in-app browsers. A silent no-op would be the same
      // defect this control exists to fix, so the failure is stated.
      await navigator.clipboard.writeText(absolute);
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
        {state === "copied" ? "Link copied" : null}
        {state === "failed" ? (
          <>
            Could not copy. The link: <span className="select-all break-all text-ink">{url}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}
