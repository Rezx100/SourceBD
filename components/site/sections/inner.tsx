// Every marketing page in the home page's design (the founder, 25 Oct 2026: "roll the current home page design out to
// every marketing page"): the parts an inner page needs that home draws inside its own sections, made from home's own
// pieces rather than forked. A page is `HomeMain` (the grounds that fade at the window's middle) holding, in order,
// `PageHead`, then home's `CardGrid`, `FactCards` and `Band` sections, then home's `Finale`. Type is home's: the head in
// the hero's weight and size, section headlines under `SectionHead`'s rule, names and lines in `CardWords`; cards are
// home's sunken 12 px panels; the column is home's 1024.

import type { ReactNode } from "react";
import { buttonClass } from "@/components/kit/button-class";
import type { HomeGround } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { CardWords, SectionHead } from "./card-grid";
import { glass } from "./hero";
import { column } from "./ui";

/**
 * An inner page's first section, where home has its studio: a small label, the headline in the hero's type, its
 * line, then what the page offers first (the two ways in, a search, a form) and, where the page shows the product, a
 * wide card of the real app (`picture`, a `Clip`), 1024 × 640 at 1440. Night by default, as home's tour is; the
 * reading pages (legal, guides, status) stand on the day ground.
 */
export function PageHead({ id = "page-title", tone = "night", label, title, lede, children, picture }: { id?: string; tone?: HomeGround; label?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode; picture?: ReactNode }) {
  return (
    <section data-mk-tone={tone} aria-labelledby={id} className="pb-14 pt-12 md:pb-16 md:pt-24">
      <div className={cn(column, "flex flex-col items-center text-center")}>
        {/* A div, not a p: a guide's label is its breadcrumb <nav>, which a <p> may not hold. */}
        {label ? <div className="font-display text-site-item text-ink-2">{label}</div> : null}
        <h1 id={id} className="mt-4 max-w-[860px] font-display text-site-display-sm text-ink [text-wrap:balance] md:text-site-display">
          {title}
        </h1>
        {lede ? <p className="mt-4 max-w-[640px] font-book text-md text-ink-2 [text-wrap:pretty] md:text-site-card">{lede}</p> : null}
        {children ? <div className="mt-8 flex w-full flex-col items-center">{children}</div> : null}
      </div>
      {picture ? (
        <div className={cn(column, "mt-12 md:mt-16")}>
          <div className="relative aspect-[1024/640] overflow-hidden rounded-frame bg-sunken">{picture}</div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The search page's one way in (critique 22 Oct, S8): home's glass pill with its button inside, the search running on
 * public Discover. The words to try sit under it.
 */
export function SearchPill() {
  return (
    <form action="/discover" method="get" role="search" className="flex w-full max-w-[460px] flex-col items-center gap-3">
      <div className={cn("flex h-12 w-full items-center gap-2 rounded-full py-1 pl-5 pr-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent", glass)}>
        <label htmlFor="hero-q" className="sr-only">
          Search suppliers, products or certificates
        </label>
        <input id="hero-q" name="q" type="search" autoComplete="off" placeholder="Supplier, product or certificate" className="h-10 min-w-0 flex-1 bg-transparent text-site-item text-ink outline-none placeholder:text-ink-2" />
        <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-10 shrink-0 rounded-full px-5 text-site-item" })}>
          Search
        </button>
      </div>
      <p className="font-book text-site-item text-ink-2">Try “knit dresses Gazipur” or “GOTS”</p>
    </form>
  );
}

/** A section of an inner page: home's rule and headline over whatever it shows (a table, an article, a form). */
export function Band({ id, tone, heading, lede, children, className }: { id: string; tone: HomeGround; heading: ReactNode; lede?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section data-mk-tone={tone} aria-labelledby={id} className={cn("pb-16 pt-14 md:pb-12 md:pt-[72px]", className)}>
      <div className={column}>
        <SectionHead id={id}>{heading}</SectionHead>
        {lede ? <p className="mt-4 max-w-[672px] font-book text-site-card text-ink-2 [text-wrap:pretty]">{lede}</p> : null}
        {children ? <div className="mt-8 md:mt-10">{children}</div> : null}
      </div>
    </section>
  );
}

export type Fact = { title: ReactNode; body: ReactNode; figure?: ReactNode };

/** Facts as home's cards without a picture: each a sunken panel with its name and its line (`CardWords`), a figure over them when it has one. */
export function FactList({ items, cols = 3 }: { items: readonly Fact[]; cols?: 1 | 2 | 3 }) {
  return (
    <ul className={cn("grid content-start gap-4 md:gap-8",cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:gap-4")}>
      {items.map((f, i) => (
        <li key={i} className="flex flex-col rounded-frame bg-sunken p-6 md:p-8">
          {f.figure !== undefined ? <span className="mb-4 font-display tabular-nums text-site-stat-sm text-ink">{f.figure}</span> : null}
          <CardWords title={f.title} body={f.body} />
        </li>
      ))}
    </ul>
  );
}

/** `Band` holding `FactList`: the shape most of an inner page's words take. */
export function FactCards({ id, tone, heading, lede, items, cols, children }: { id: string; tone: HomeGround; heading: ReactNode; lede?: ReactNode; items: readonly Fact[]; cols?: 1 | 2 | 3; children?: ReactNode }) {
  return (
    <Band id={id} tone={tone} heading={heading} lede={lede}>
      <FactList items={items} cols={cols} />
      {children ? <div className="mt-8 flex flex-wrap items-center gap-2">{children}</div> : null}
    </Band>
  );
}

/** A table in home's type: names in the display weight, lines in the book, hairlines between rows. Wraps the `<table>`, which scrolls sideways on a phone. */
export const tabular = cn(
  "overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
  "[&_table]:w-full [&_table]:min-w-[640px] [&_table]:border-collapse [&_table]:text-left [&_table]:font-book [&_table]:text-site-item [&_table]:text-ink-2",
  "[&_thead_tr]:border-b [&_thead_tr]:border-ink/40 [&_thead_th]:pb-3 [&_thead_th]:pr-4 [&_thead_th]:font-display [&_thead_th]:text-ink-2",
  "[&_tbody_tr]:border-b [&_tbody_tr]:border-line [&_tbody_th]:py-4 [&_tbody_th]:pr-4 [&_tbody_th]:align-top [&_tbody_th]:font-display [&_tbody_th]:text-ink [&_td]:py-4 [&_td]:pr-4 [&_td]:align-top",
);

/** Long reading (the legal notices, the guides) in home's type: headings in the display weight, the text in the book at the cards' size. */
export const prose = [
  "font-book text-site-card text-ink-2",
  "[&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-site-lead [&_h2]:text-ink first:[&_h2]:mt-0 [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-site-card [&_h3]:text-ink",
  "[&_p+p]:mt-4 [&_h2+p]:mt-4 [&_h3+p]:mt-2",
  "[&_ul]:mt-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_strong]:font-display [&_strong]:text-ink",
  "[&_a]:text-ink [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-4 [&_a:hover]:decoration-2",
  "[&_code]:rounded-sm [&_code]:bg-sunken [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-ink",
  "[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-site-item [&_thead]:border-b [&_thead]:border-ink/40 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-display [&_th]:text-ink-2 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top [&_tbody_tr]:border-b [&_tbody_tr]:border-line",
  "[&_.note]:mt-4 [&_.note]:rounded-frame [&_.note]:bg-sunken [&_.note]:p-5 [&_.note_p]:mt-0",
].join(" ");
