// The small parts a result row is made of, shared by the table and the list beside a pane (Paper page
// 37, boards 07b, 08 and 08b): what it makes, where its exports go, the certificates it holds today.
// No hooks and no state, so both client lists and the phone's server-drawn rows draw them.

import { Lock } from "@phosphor-icons/react/dist/ssr";
import { Fragment, type ReactNode } from "react";
import { SourceMark } from "@/components/patterns";
import { hasSourceMark } from "@/components/patterns/source-mark";
import type { CertBody } from "@/components/patterns/words";
import { highlightParts } from "@/lib/search-suggest-ui";
import { cn } from "@/lib/utils";
import type { ResultRow } from "./model";

const MARKET_WORDS: Record<string, string> = { EU: "the EU", US: "the US", UK: "the UK", CA: "Canada" };
const listed = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * The certificates it holds today, as the bodies' marks and nothing else (founder, 12 Oct 2026): how long
 * each has left is the record's business, and one that has ended is not drawn, like one never held. No
 * mark stands without its name (`context/logos.lock.md` section 1): a screen reader hears them. A body
 * with no approved mark is counted, never drawn. In `words` mode (the results table, founder, 15 Oct
 * 2026: "use the scheme words") the schemes are named in chips instead, the first two, and the rest
 * counted; no mark, no state, no colour, on one line.
 */
export function HeldMarks({ held, className, markClassName = "size-5 [&>img]:max-h-3.5 [&>img]:max-w-3.5", words = false }: { held: readonly CertBody[]; className?: string; /** A mark's own frame, where a caller draws it at another size (a phone's row). */ markClassName?: string; /** The schemes' names in chips, two then "+N more", instead of their marks. */ words?: boolean }) {
  const shown = words ? held.slice(0, 2) : held.filter((b) => hasSourceMark(b.code));
  const rest = held.length - shown.length;
  return (
    <span className={cn("inline-flex items-center gap-2", words && "whitespace-nowrap", className)}>
      <span className="sr-only">Certificates held: {listed(held.map((b) => b.scheme))}</span>
      <span aria-hidden className="inline-flex items-center gap-2" title={held.map((b) => b.scheme).join(" · ")}>
        {shown.map((b) =>
          words ? (
            <span key={b.code} className="inline-flex h-5 items-center rounded-md border border-line px-1.5 text-xs font-medium text-ink-2">
              {b.scheme}
            </span>
          ) : (
            <SourceMark key={b.code} source={b.code} className={markClassName} />
          ),
        )}
        {rest > 0 ? <span className="text-xs font-medium text-ink-3">{words ? `+${rest} more` : `+${rest}`}</span> : null}
      </span>
    </span>
  );
}

/**
 * Where the customs records show it shipping, biggest share first: four small codes, not a sentence
 * (founder, 12 Oct 2026: "buyers want to know if this company ships to my country").
 */
export function ShipsTo({ to, label, className }: { to: readonly string[]; /** The words before the codes ("ships to"), where the column's head does not say them. */ label?: ReactNode; className?: string }) {
  if (to.length === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <span className="sr-only">Ships to {listed(to.map((c) => MARKET_WORDS[c] ?? c))}</span>
      {label ? (
        <span aria-hidden className="whitespace-nowrap text-xs text-ink-3">
          {label}
        </span>
      ) : null}
      {to.map((c) => (
        <span key={c} aria-hidden className="flex h-[18px] min-w-6 items-center justify-center rounded border border-line bg-surface px-1 font-mono text-[11px]/[14px] text-ink-2">
          {c}
        </span>
      ))}
    </span>
  );
}

/** A customs record is on file that the reader's plan does not include: said so, with no figure and no market. */
export function ExportedLocked({ className }: { className?: string }) {
  return (
    <span title="Customs records are on the Growth and Enterprise plans" className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs text-ink-3", className)}>
      <Lock size={14} weight="thin" className="shrink-0" aria-hidden />
      On Growth
      <span className="sr-only">: customs records are on the Growth and Enterprise plans</span>
    </span>
  );
}

/**
 * "Women's denim apparel, Polo shirts +19": each name whole, the count of the rest after them. One line,
 * clipped at the cell's edge with the names in `title`; a caller with room to wrap adds `flex-wrap` and
 * the names then wrap whole, one by one.
 */
export function Products({ products, className, q }: { products: NonNullable<ResultRow["products"]>; className?: string; /** The search's words, lit in the names that answer them. */ q?: string | null }) {
  return (
    <span data-products="" title={products.shown.join(", ")} className={cn("flex min-w-0 items-baseline gap-x-[5px] overflow-clip text-sm text-ink-2", className)}>
      {products.shown.map((p, i) => (
        <span key={p} className="whitespace-nowrap">
          <Hit text={p} q={q} />
          {i < products.shown.length - 1 ? "," : ""}
        </span>
      ))}
      {products.more > 0 ? <span className="whitespace-nowrap text-ink-3">+{products.more}</span> : null}
    </span>
  );
}

/**
 * Words with the search's terms lit: a word start that begins with a typed term is marked, as the
 * typeahead does it. The reason a row is on the page, shown where it is, instead of said in a line.
 */
export function Hit({ text, q }: { text: string; q?: string | null }) {
  // The ranking's terms (`matchedProducts` in model.ts): two characters or more, so "s m knit" lights "knit" alone.
  const terms = (q ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
    .join(" ");
  if (!terms) return <>{text}</>;
  return (
    <>
      {highlightParts(text, terms).map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded-[2px] bg-accent-tint-strong px-px text-ink">
            {p.text}
          </mark>
        ) : (
          <Fragment key={k}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
