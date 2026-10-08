"use client";

// "Show all details": a paragraph cut to two lines until the buyer asks for the rest. Without
// script the whole text is there (the clamp is a class this component adds once it has run).

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ShowMore({ text, label = "Show all details", lines = 2 }: { text: string; label?: string; lines?: 2 | 3 }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);
  const long = text.length > 110 || text.includes("\n");
  return (
    <>
      <p className={cn("whitespace-pre-wrap text-base text-ink-2 [overflow-wrap:anywhere]", armed && long && !open && (lines === 2 ? "line-clamp-2" : "line-clamp-3"))}>{text}</p>
      {armed && long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-fit rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {open ? "Show less" : label}
        </button>
      ) : null}
    </>
  );
}
