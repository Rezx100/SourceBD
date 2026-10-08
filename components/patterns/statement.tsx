// Statement claim to confirm (`03 Patterns · 13`): in a modern slavery statement draft,
// anything only the buyer can know stays a marked gap (a dashed caution chip) until they
// confirm it. A rail lists the open claims; Download stays disabled with its reason in words
// ("Confirm 2 claims to download."). A confirmed claim is plain text with a thin underline.
// Server-safe; the Fill in and Confirm buttons come in as nodes.

import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";

/** An open claim inside the draft. `focused` is the one the rail is pointing at (a 2px brand edge). */
export function OpenClaim({ children, focused }: { children: string; focused?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-sm bg-caution-tint px-1.5 text-md font-medium text-caution", focused ? "border-2 border-brand-ink" : "border border-dashed border-caution-icon")}>
      [Confirm: {children}]
    </span>
  );
}

/** A claim the buyer has confirmed: plain text, a thin line under it. */
export function ConfirmedClaim({ children }: { children: ReactNode }) {
  return <span className="border-b border-line-strong text-md text-ink">{children}</span>;
}

/** The sentence count of what stops the download, in words. */
export const downloadBlockedWords = (open: number) => `Confirm ${open} ${open === 1 ? "claim" : "claims"} to download.`;

export function ClaimRail({
  claims,
  downloadHref,
  className,
}: {
  /** The open claims: what is asked, and its Fill in button. */
  claims: { label: string; action: ReactNode }[];
  /** Where the finished statement downloads; used only when no claim is open. */
  downloadHref: string;
  className?: string;
}) {
  const open = claims.length;
  return (
    <aside aria-label="Claims to confirm" className={cn("flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-line p-5", className)}>
      <h3 className="text-md font-semibold text-ink">
        Before you download{open ? ` · ${open} ${open === 1 ? "claim" : "claims"} to confirm` : ""}
      </h3>
      <ul>
        {claims.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-3 border-t border-line py-2.5 last:border-b">
            <span className="text-base text-ink">{c.label}</span>
            {c.action}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5">
        {open ? (
          <Button kind="primary" size="lg" disabled full aria-describedby="claims-why">
            Download statement
          </Button>
        ) : (
          <ButtonLink kind="primary" size="lg" href={downloadHref} full>
            Download statement
          </ButtonLink>
        )}
        {open ? (
          <p id="claims-why" className="text-sm text-ink-2">
            {downloadBlockedWords(open)}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
