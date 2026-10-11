"use client";

// Share on a phone's record (Paper page 35, the round button beside Close): the system's share sheet
// where there is one, else the link copied. It shares the full record page, never the search behind it.

import { Check, Export } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ShareButton({ href, className }: { href: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(href, location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Dismissed, or the clipboard refused: nothing to undo.
    }
  }
  const Glyph = copied ? Check : Export;
  return (
    <button type="button" onClick={share} aria-label={copied ? "Link copied" : "Share"} className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 outline-none before:absolute before:-inset-1 active:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus", className)}>
      <Glyph size={17} weight="thin" aria-hidden />
    </button>
  );
}
