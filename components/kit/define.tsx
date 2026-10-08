"use client";

// A defined term (the help layer, critique of 8 Oct 2026, item 6): the word with a dotted underline,
// its one-sentence definition from `lib/dashboard/glossary.ts` in the kit's tooltip on hover and on
// focus, and the same sentence in `aria-describedby` for a screen reader. A term the glossary does not
// hold is drawn plain, so a missing entry is a test failure, never a broken screen.

import { useId, type ReactNode } from "react";
import { define } from "@/lib/dashboard/glossary";
import { cn } from "@/lib/utils";
import { ring } from "./classes";
import { Tooltip } from "./overlay";

export function Define({
  term,
  children,
  className,
  focusable = true,
  describedId,
}: {
  term: string;
  children?: ReactNode;
  className?: string;
  /** False inside a group that is one tab stop itself (the record strip): reachable by hover and through the group. */
  focusable?: boolean;
  /** The definition's id, when the group names it in its own `aria-describedby`. */
  describedId?: string;
}) {
  const own = useId();
  const id = describedId ?? own;
  const what = define(term);
  if (!what) return <>{children ?? term}</>;
  return (
    <>
      <Tooltip label={what}>
        <span tabIndex={focusable ? 0 : -1} data-define={term} aria-describedby={id} className={cn("cursor-help rounded-sm underline decoration-dotted decoration-1 underline-offset-2 [text-underline-position:from-font]", ring, className)}>
          {children ?? term}
        </span>
      </Tooltip>
      <span id={id} className="sr-only">
        {what}
      </span>
    </>
  );
}
