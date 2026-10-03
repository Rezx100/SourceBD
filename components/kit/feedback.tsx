// Empty, error, skeleton (`02 Components · 6`). The empty state sits where the content
// would be, says what is missing and offers one next step; it never apologises. An error
// replaces only what failed, with its cause and Try again, so the rest of the screen
// stays usable. Skeletons are sunken blocks shaped like the layout that loads.

import { XCircle, type Icon } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `card`: a bordered 400-wide card with a glyph. `table`: inside a table's frame, under
 * its head, no glyph and no border.
 */
export function Empty({
  icon: Glyph,
  title,
  children,
  action,
  variant = "card",
  className,
}: {
  icon?: Icon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "table";
  className?: string;
}) {
  const card = variant === "card";
  return (
    <div className={cn("flex flex-col items-start", card ? "max-w-[400px] gap-3 rounded-md border border-line p-8" : "gap-2 px-6 pb-10 pt-8", className)}>
      {card && Glyph ? <Glyph size={24} className="shrink-0 text-ink-3" aria-hidden /> : null}
      <div className="flex flex-col gap-1">
        <p className="text-md font-semibold text-ink">{title}</p>
        {children ? <p className="text-base text-ink-2">{children}</p> : null}
      </div>
      {action ? <div className={card ? "" : "flex gap-2 pt-2"}>{action}</div> : null}
    </div>
  );
}

/** A section that failed to load: a 3px danger edge, the words, Try again (`retry`, a secondary button). */
export function InlineError({ children, retry, className }: { children: ReactNode; retry?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 rounded-md p-5 [border-left-width:3px] border-l-danger", className)}>
      <p className="flex items-start gap-2 text-base font-medium text-ink">
        <XCircle size={20} weight="fill" className="shrink-0 text-danger" aria-hidden />
        <span>{children}</span>
      </p>
      {retry}
    </div>
  );
}

/** A whole list or pane that failed: subtle, with what is kept and a brand Try again (`retry`). */
export function ErrorPanel({ title, children, retry, className }: { title: ReactNode; children?: ReactNode; retry?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 rounded-md bg-subtle p-8", className)}>
      <p className="text-md font-semibold text-ink">{title}</p>
      {children ? <p className="text-base text-ink-2">{children}</p> : null}
      {retry}
    </div>
  );
}

/** One block. `tone="subtle"` is the lighter second line under a heading. No shimmer under reduced motion. */
export function Skeleton({ tone = "sunken", className, ...rest }: ComponentProps<"div"> & { tone?: "sunken" | "subtle" }) {
  return <div aria-hidden className={cn("rounded-sm animate-pulse motion-reduce:animate-none", tone === "sunken" ? "bg-sunken" : "bg-subtle", className)} {...rest} />;
}

/** A record pane while it loads: name, line, tabs, two fact rows. */
export function PaneSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col gap-4 rounded-md border border-line p-5", className)}>
      <Skeleton className="h-5 w-60" />
      <Skeleton className="h-3 w-80" />
      <div className="flex gap-4 border-b border-line py-2">
        <Skeleton className="h-3 w-[72px]" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      {[
        ["w-[200px]", "w-[140px]"],
        ["w-60", "w-40"],
      ].map(([a, b]) => (
        <div key={a} className="flex gap-6">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-col gap-2">
            <Skeleton className={cn("h-3", a)} />
            <Skeleton tone="subtle" className={cn("h-3", b)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Rows of a list in a pane or on a phone: a name bar and a lighter line under it. */
export function RowSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const name = ["w-[220px]", "w-[180px]", "w-[260px]"];
  const line = ["w-[120px]", "w-[100px]", "w-[140px]"];
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col rounded-md border border-line", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
          <Skeleton className={cn("h-3.5", name[i % 3])} />
          <Skeleton tone="subtle" className={cn("h-3", line[i % 3])} />
        </div>
      ))}
    </div>
  );
}
