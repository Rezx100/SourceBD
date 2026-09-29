// Type pieces of the dashboard kit (REZ-A): the artifact's named styles as
// components so a screen never hand-assembles them.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `.eyebrow`: 11px mono, uppercase, +0.08em — section eyebrows, table headers, column keys. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("font-mono text-eyebrow font-medium uppercase text-ink-subtle", className)}>{children}</span>
  );
}

/** `.code`: 13px mono — register numbers, certificate numbers, HS codes. */
export function Code({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("font-mono text-sm", className)}>{children}</span>;
}

/** `.cap`: 12px caption in `ink-subtle`. */
export function Caption({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-xs text-ink-subtle", className)}>{children}</span>;
}

/** `.label`: 13px medium. */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-sm font-medium", className)}>{children}</span>;
}

/**
 * A company's or building's name (or the line under it) on one line, cut at
 * the end with an ellipsis: the One-Line Name Rule (founder, 29 Sep 2026, "the
 * way Apple and Microsoft do it"). The whole text stays in the DOM for a
 * screen reader and in `title` for the pointer. `data-name` marks it for the
 * guards that refuse a cut anywhere else (a chip, a fact, a caption).
 */
export function OneLine({ text, title, className }: { text: string; title?: string; className?: string }) {
  return (
    <span data-name="" title={title ?? text} className={cn("block min-w-0 truncate", className)}>
      {text}
    </span>
  );
}

/** `.title`: 15px medium, `ink-strong` — a card name, a tab. Wraps at any length. */
export function Title({ as: As = "span", className, children }: { as?: "span" | "h1" | "h2"; className?: string; children: ReactNode }) {
  return <As className={cn("text-title font-medium text-ink-strong [overflow-wrap:anywhere]", className)}>{children}</As>;
}

/** `.h-sm` 18 · `.h` 22 · `.h-lg` 28, all weight 500 in `ink-strong`. */
export function Heading({
  level = "h",
  as: As = "h2",
  className,
  children,
}: {
  level?: "sm" | "h" | "lg";
  as?: "h1" | "h2" | "h3" | "div";
  className?: string;
  children: ReactNode;
}) {
  return (
    <As
      className={cn(
        "font-medium text-ink-strong [overflow-wrap:anywhere]",
        level === "sm" && "text-xl",
        level === "h" && "text-2xl",
        level === "lg" && "text-3xl",
        className,
      )}
    >
      {children}
    </As>
  );
}
