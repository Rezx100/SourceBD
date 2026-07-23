// Shared section kicker (eyebrow) for the marketing homepage.
//
// Hanken Grotesk body face — uppercase, open tracking, forest dot —
// so section labels read as editorial, not database chrome.
// Server-safe; importable from both server and client components.

import { cn } from "@/lib/utils";

export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 font-body text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-forest",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
      {children}
    </p>
  );
}
