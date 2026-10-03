// Needs attention (`03 Patterns · 11`): one row per problem on the buyer's saved suppliers:
// glyph, supplier, what happened with its date, and one action ("Ask for the new certificate").
// Empty is a sentence, never a blank. Phone: stacked, the action 44 tall and full width.
// Server-safe; the action comes in as a node.

import { Clock, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  /** "expired" is red, "expiring" is amber. */
  state: "expired" | "expiring";
  supplier: string;
  /** "WRAP 7865 expired 29 Sep 2026." */
  what: string;
  /** "No renewal on file." */
  note?: string;
  /** A secondary Button or ButtonLink. */
  action: ReactNode;
};

export function NeedsAttention({
  items,
  total,
  footer,
  header = "always",
  scope = "On your saved suppliers",
  className,
}: {
  items: AttentionItem[];
  /** How many certificates need attention in all, when the list shows only the first few: the heading says this number. */
  total?: number;
  /** Under the rows, inside the card: "See all 9 certificates". */
  footer?: ReactNode;
  /** `phone`: the heading is drawn by the page above the card from `sm` up (the search landing). */
  header?: "always" | "phone";
  scope?: string;
  className?: string;
}) {
  const n = total ?? items.length;
  if (items.length === 0)
    return (
      <section className={cn("flex flex-col gap-1 rounded-lg border border-line p-4", className)}>
        <h3 className="text-base font-semibold text-ink">Nothing needs attention</h3>
        <p className="text-sm text-ink-2">No certificate on your saved suppliers expires in the next 90 days.</p>
      </section>
    );
  return (
    <section aria-label="Needs attention" className={cn("flex flex-col rounded-lg border border-line", className)}>
      <header className={cn("flex h-12 items-center justify-between border-b border-line px-4", header === "phone" && "sm:hidden")}>
        <h3 className="text-md font-semibold text-ink sm:text-base">
          Needs attention · {n} {n === 1 ? "certificate" : "certificates"}
        </h3>
        <p className="text-xs text-ink-3 max-sm:hidden">{scope}</p>
      </header>
      <ul>
        {items.map((it, i) => {
          const Glyph = it.state === "expired" ? XCircle : Clock;
          return (
            <li key={`${it.supplier}-${i}`} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:min-h-16 sm:flex-row sm:items-center sm:gap-3">
              <Glyph size={20} weight="fill" className={cn("shrink-0 max-sm:hidden", it.state === "expired" ? "text-danger" : "text-caution-icon")} aria-hidden />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-md font-medium text-ink sm:text-base">
                  <Glyph size={16} weight="fill" className={cn("shrink-0 sm:hidden", it.state === "expired" ? "text-danger" : "text-caution-icon")} aria-hidden />
                  {it.supplier}
                </p>
                <p className="flex flex-wrap gap-x-1.5 text-base sm:text-sm">
                  <span className={cn("font-medium", it.state === "expired" ? "text-danger" : "text-caution")}>{it.what}</span>
                  {it.note ? <span className="text-ink-3 max-sm:hidden">{it.note}</span> : null}
                </p>
              </div>
              <div className="max-sm:[&>*]:h-11 max-sm:[&>*]:w-full max-sm:[&>*]:text-md">{it.action}</div>
            </li>
          );
        })}
      </ul>
      {footer ? <div className="border-t border-line">{footer}</div> : null}
    </section>
  );
}
