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

/** `.title`: 15px medium, `ink-strong` — a card name, a tab. Wraps at any length. */
export function Title({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-title font-medium text-ink-strong [overflow-wrap:anywhere]", className)}>{children}</span>;
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
