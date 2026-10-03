// Chat (`03 Patterns · 10`, a sample state): the supplier on the left in a white bubble with a
// line, you on the right in brand-tint; the name and time under each bubble, the date once per
// day, "Read" once under your last message. The composer is pinned (B6 builds it: attach, the
// field, Send). Server-safe.

import { Checks, FileText } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The thread's surface: subtle, bubbles stacked 12 apart. */
export function ChatThread({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col gap-3 bg-subtle p-4 sm:p-5", className)}>{children}</div>;
}

/** One line per day, with times only on bubbles: "2 Oct 2026". */
export function DateLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium text-ink-3">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** An attached file as a chip inside a bubble. */
export function FileChip({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="flex items-center gap-2 rounded-md border border-line bg-surface p-2">
      <FileText size={20} className="shrink-0 text-ink-2" aria-hidden />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className="text-xs text-ink-3">{detail}</span>
      </span>
    </span>
  );
}

/**
 * `from="them"` is the supplier; `"you"` is the buyer. `meta` is "Aboni Knitwear Ltd. · 10:12"
 * (on a phone just the time); `read` adds "· Read" and its ticks to your last message.
 */
export function Bubble({ from, meta, read, children }: { from: "them" | "you"; meta: string; read?: boolean; children: ReactNode }) {
  const you = from === "you";
  return (
    <div className={cn("flex max-w-[440px] flex-col gap-1 max-sm:max-w-[300px]", you ? "items-end self-end" : "self-start")}>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-t-lg px-3 py-2.5 text-md text-ink sm:text-base",
          you ? "rounded-bl-lg rounded-br-sm bg-brand-tint" : "rounded-bl-sm rounded-br-lg border border-line bg-surface",
        )}
      >
        {children}
      </div>
      <p className="flex items-center gap-1 text-xs text-ink-3">
        {meta}
        {read ? (
          <>
            {" "}
            · Read <Checks size={14} className="shrink-0" aria-hidden />
          </>
        ) : null}
      </p>
    </div>
  );
}
