// Chips (`02 Components · 3`): 24 tall, a 14px glyph and words, radius 6 (one radius for every chip and pill in the app), 13/500. A
// problem gets colour, glyph and words; a normal state stays neutral; "not on file" is
// dashed. Server-safe.

import { CheckCircle, Clock, Info, MinusCircle, Warning, X, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ring } from "./classes";

const CHIP = "inline-flex h-6 w-fit items-center gap-1.5 rounded-md border px-2 text-sm font-medium";

function Glyph({ icon: G, weight = "fill", className }: { icon: Icon; weight?: "fill" | "regular"; className: string }) {
  return <G size={14} weight={weight} className={cn("shrink-0", className)} aria-hidden />;
}

const CERT = {
  valid: { box: "border-cert-valid-edge bg-surface text-cert-valid-fg", icon: CheckCircle, glyph: "text-cert-valid-fg", weight: "fill" },
  expiring: { box: "border-caution-icon bg-cert-expiring-bg text-cert-expiring-fg", icon: Clock, glyph: "text-caution-icon", weight: "fill" },
  expired: { box: "border-danger bg-cert-expired-bg text-cert-expired-fg", icon: XCircle, glyph: "text-danger", weight: "fill" },
  // No expiry on file is not a problem and not a pass: dashed, minus, ink-2 words.
  none: { box: "border-dashed border-cert-no-expiry-edge bg-surface font-medium text-ink-2", icon: MinusCircle, glyph: "text-cert-no-expiry-fg", weight: "regular" },
} as const;

export type CertState = keyof typeof CERT;

/** Certificate status. The words carry the date: "Valid until 12 May 2027", "Expired 29 Sep 2026". */
export function CertChip({ state, children, className }: { state: CertState; children: ReactNode; className?: string }) {
  const c = CERT[state];
  return (
    <span className={cn(CHIP, c.box, className)}>
      <Glyph icon={c.icon} weight={c.weight} className={c.glyph} />
      {children}
    </span>
  );
}

const FACT = {
  stale: { box: "border-caution-icon bg-caution-tint text-caution", icon: Clock, glyph: "text-caution-icon", weight: "fill" },
  disagree: { box: "border-danger bg-danger-tint text-danger", icon: Warning, glyph: "text-danger", weight: "fill" },
  changed: { box: "border-info bg-info-tint text-info", icon: Info, glyph: "text-info", weight: "fill" },
  notOnFile: { box: "border-dashed border-line-strong text-ink-2", icon: MinusCircle, glyph: "text-ink-3", weight: "regular" },
} as const;

export type FactState = keyof typeof FACT;

/** What is wrong with a fact. A current fact has no chip: its source line is enough. */
export function FactChip({ state, children, className }: { state: FactState; children: ReactNode; className?: string }) {
  const c = FACT[state];
  return (
    <span className={cn(CHIP, c.box, className)}>
      <Glyph icon={c.icon} weight={c.weight} className={c.glyph} />
      {children}
    </span>
  );
}

/** Company type: "Factory", "Buying house"; `published={false}` is the dashed "Type not published". */
export function TypeChip({ children, published = true, className }: { children: ReactNode; published?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-sm font-medium",
        published ? "bg-sunken text-ink-2" : "border border-dashed border-line-strong text-ink-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A count in nav and tabs only. Say its noun to a screen reader: `label="11 saved suppliers"`. */
export function Count({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <span aria-label={label} className={cn("inline-flex h-5 items-center rounded-md bg-sunken px-1.5 text-xs font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}

/**
 * A filter that is on: its words and an × that removes it. The × is a link to the page
 * without the filter (filters live in the address), 24 square.
 */
export function FilterChip({
  children,
  removeHref,
  removeLabel,
  className,
}: {
  children: ReactNode;
  removeHref: string;
  /** "Remove Certificate: GOTS" */
  removeLabel: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-0.5 rounded-md border border-line-strong bg-surface pl-2 text-sm font-medium text-ink hover:border-ink-3 hover:bg-subtle", className)}>
      {children}
      <Link
        href={removeHref}
        aria-label={removeLabel}
        className={cn("flex size-6 shrink-0 items-center justify-center rounded-[3px] text-ink-2 hover:bg-line hover:text-ink", ring)}
      >
        <X size={12} aria-hidden />
      </Link>
    </span>
  );
}

/** A filter the buyer did not choose but may undo: "Hiding sanctioned suppliers · Show them". */
export function StandingFilter({ children, action, className }: { children: ReactNode; action: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-2 rounded-md bg-sunken px-2 text-sm font-medium text-ink-2", className)}>
      {children}
      {action}
    </span>
  );
}

/** A chip that is neither a certificate nor a fact state: "Covered by RSC" (neutral), "No longer covered by RSC" (caution). */
export function Chip({
  tone = "neutral",
  icon,
  weight = "fill",
  children,
  className,
}: {
  tone?: "neutral" | "caution";
  icon: Icon;
  weight?: "fill" | "regular";
  children: ReactNode;
  className?: string;
}) {
  const caution = tone === "caution";
  return (
    <span className={cn(CHIP, caution ? "border-caution-icon bg-caution-tint text-caution" : "border-line text-ink-2", className)}>
      <Glyph icon={icon} weight={weight} className={caution ? "text-caution-icon" : "text-ink-2"} />
      {children}
    </span>
  );
}
