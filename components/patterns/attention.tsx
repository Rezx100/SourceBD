// Needs attention (`03 Patterns · 11`): one row per problem on the buyer's saved suppliers:
// glyph, supplier, what happened with its date, and one action ("Ask for the new certificate").
// Empty is a sentence, never a blank. Phone: stacked, the action 44 tall and full width.
// Server-safe; the action comes in as a node.

import { Clock, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Fragment, type ReactNode } from "react";
import { Define } from "@/components/kit/define";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  /** Both are amber (a date passed is caution, never a failure); "expired" is the XCircle, "expiring" the clock. */
  state: "expired" | "expiring";
  supplier: string;
  /** "WRAP 7865 expired 29 Sep 2026." */
  what: string;
  /** "No renewal on file." */
  note?: string;
  /** The scheme `what` opens with ("WRAP"), drawn as a defined term (round 3, item 5). */
  scheme?: string;
  /** A secondary Button or ButtonLink. */
  action: ReactNode;
  /** A line over this row when it differs from the row before: the hub's "Coming up in 31 to 90 days". */
  group?: string;
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
      <section className={cn("flex flex-col gap-1 rounded-lg bg-subtle p-4", className)}>
        <h3 className="text-base font-semibold text-ink">Nothing needs attention</h3>
        <p className="text-sm text-ink-2">No certificate on your saved suppliers expires in the next 90 days.</p>
      </section>
    );
  return (
    // On the landing's surface ground a card takes a tonal step, never a border (DESIGN.md Don'ts).
    <section aria-label="Needs attention" className={cn("flex flex-col rounded-lg bg-subtle", className)}>
      <header className={cn("flex h-12 items-center justify-between border-b border-line px-4", header === "phone" && "sm:hidden")}>
        <h3 className="text-md font-semibold text-ink sm:text-base">
          Needs attention · {n} {n === 1 ? "certificate" : "certificates"}
        </h3>
        <p className="text-xs text-ink-3 max-sm:hidden">{scope}</p>
      </header>
      <ul>
        {items.map((it, i) => {
          const Glyph = it.state === "expired" ? XCircle : Clock;
          const heading = it.group && it.group !== items[i - 1]?.group ? it.group : null;
          return (
            <Fragment key={`${it.supplier}-${i}`}>
            {heading ? (
              <li className="border-b border-line bg-subtle px-4 py-2">
                <h4 className="text-xs font-semibold text-ink-2">{heading}</h4>
              </li>
            ) : null}
            <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:min-h-16 sm:flex-row sm:items-center sm:gap-3">
              <Glyph size={20} weight="fill" className="shrink-0 text-caution-icon max-sm:hidden" aria-hidden />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-md font-medium text-ink sm:text-base">
                  <Glyph size={16} weight="fill" className="shrink-0 text-caution-icon sm:hidden" aria-hidden />
                  {it.supplier}
                </p>
                <p className="flex flex-wrap gap-x-1.5 text-base sm:text-sm">
                  <span className="font-medium text-caution">
                    {it.scheme && it.what.startsWith(it.scheme) ? (
                      <>
                        <Define term={it.scheme}>{it.scheme}</Define>
                        {it.what.slice(it.scheme.length)}
                      </>
                    ) : (
                      it.what
                    )}
                  </span>
                  {it.note ? <span className="text-ink-3 max-sm:hidden">{it.note}</span> : null}
                </p>
              </div>
              <div className="max-sm:[&>*]:h-11 max-sm:[&>*]:w-full max-sm:[&>*]:text-md">{it.action}</div>
            </li>
            </Fragment>
          );
        })}
      </ul>
      {footer ? <div className="border-t border-line">{footer}</div> : null}
    </section>
  );
}
