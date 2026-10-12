"use client";

// Copy on the record's contact card (Paper page 37): the word "Copy" beside an email, the glyph alone
// beside a phone number. It says "Copied" for two seconds, to the eye and to a screen reader.

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { ring } from "@/components/kit";
import { cn } from "@/lib/utils";

export function CopyButton({ value, name, words = false }: { value: string; /** What is copied, for a screen reader: "email", "phone number". */ name: string; /** Draw the word beside the glyph. */ words?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard refused: the value is on the page to select by hand.
    }
  }
  const Glyph = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${name} ${value}`}
      className={cn("flex h-6 shrink-0 items-center gap-1 rounded-md text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink", words ? "bg-subtle px-2" : "w-6 justify-center", ring)}
    >
      <Glyph size={14} weight="thin" aria-hidden />
      {words ? (copied ? "Copied" : "Copy") : null}
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
