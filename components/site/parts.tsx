// The parts every v4 marketing page is built from (Paper `30 Marketing`): the evidence-in-the-open look at editorial
// scale, in the app's own tokens. A hero (one line, a search that runs on public Discover, Start free, Book a demo),
// a chapter or section with its small mono label, a record card, a claim set beside its receipt, a stat row, and
// the FAQ. Server components; the only script on a marketing page is the nav, the cookie banner and, where a page
// asks for it, a tab switch. No count-up, no gradient, no stock image: the data and the product are the pictures.

import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";

export const wrap = "mx-auto w-full max-w-[1200px] px-6 lg:px-10";

/** The small mono label above a headline: "02 · Who are they?". */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mono text-base text-ink-3 max-sm:text-sm", className)}>{children}</p>;
}

export function Display({ children, level = 2, as: As = "h2", className }: { children: ReactNode; level?: 1 | 2; as?: "h1" | "h2"; className?: string }) {
  return <As className={cn("font-semibold tracking-tighter text-ink [text-wrap:balance]", level === 1 ? "leading-[1.04]" : "leading-[1.1]", level === 1 ? "text-display-1 max-md:text-4xl" : "text-display-2 max-md:text-3xl", className)}>{children}</As>;
}

export const Lede = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cn("max-w-prose text-lg text-ink-2 max-sm:text-md", className)}>{children}</p>;

/** The search box that runs on public Discover, with the two calls to action beside it. */
export function HeroActions({ tryLine = "Try “knit dresses Gazipur” or “GOTS”" }: { tryLine?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <form action="/discover" method="get" role="search" className="flex w-full max-w-[560px] flex-col gap-2">
        <div className="flex gap-2 max-sm:flex-col">
          <label htmlFor="hero-q" className="sr-only">
            Search suppliers, products or certificates
          </label>
          <input
            id="hero-q"
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Supplier, product or certificate"
            className="h-12 min-w-0 flex-1 rounded-sm border border-line-strong bg-surface px-3 text-md text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]"
          />
          <button type="submit" className="h-12 rounded-sm bg-brand px-6 text-base font-semibold text-surface hover:bg-brand-hover active:bg-brand-active max-sm:h-input-touch">
            Search
          </button>
        </div>
        <p className="text-md text-ink-3">{tryLine}</p>
      </form>
      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
          Start free
        </ButtonLink>
        <Link href="/contact" prefetch={false} className="text-md font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:flex max-sm:min-h-11 max-sm:items-center">
          Book a demo
        </Link>
      </div>
    </div>
  );
}

export type Row = { label: string; value: string; from?: string; mono?: string; flag?: "new" | "soft" };

/** One supplier record, the object the home page carries from the first screen to the last. */
export function RecordCard({ name, line, rows, badge, className }: { name: string; line: string; rows: Row[]; badge?: string; className?: string }) {
  return (
    <figure aria-label={`Supplier record: ${name}`} className={cn("flex w-full max-w-[460px] flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-dialog max-sm:p-4", className)}>
      <div className="flex flex-col gap-1">
        <figcaption className="flex items-center justify-between gap-3 font-mono text-xs text-ink-3">
          <span>Supplier record</span>
          {badge ? <span className="font-sans text-xs font-semibold text-ink">{badge}</span> : null}
        </figcaption>
        <p className="text-xl font-semibold tracking-tight text-ink">{name}</p>
        <p className="text-base text-ink-3">{line}</p>
      </div>
      {rows.length ? (
        <dl className="flex flex-col divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <div key={r.label} className={cn("flex flex-col gap-0.5 py-3", r.flag === "new" && "-mx-2 rounded-sm bg-brand-wash px-2")}>
              <dt className="text-xs text-ink-3">{r.label}</dt>
              <dd className="text-base font-semibold text-ink">{r.value}</dd>
              {r.from ? <dd className="text-xs text-ink-3">{r.from}</dd> : null}
              {r.mono ? <dd className="font-mono text-xs text-ink-3 [overflow-wrap:anywhere]">{r.mono}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </figure>
  );
}

/** A claim in the supplier's words, and the receipt it is checked against: the source, the number, the day we read it. */
export function ClaimReceipt({ claim, source, fields }: { claim: string; source: string; fields: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-ink-3">The claim</p>
        <p className="text-xl text-ink-3">{claim}</p>
      </div>
      <div aria-hidden className="ml-4 h-8 w-px bg-brand" />
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <p className="text-base font-semibold text-ink">{source}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** A stat set as a plain fact: the figure, what it counts. Only drawn when the figure was read. */
export function Stat({ figure, children }: { figure: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-l border-line pl-5 first:border-l-0 first:pl-0 max-md:border-l-0 max-md:pl-0">
      <p className="font-mono text-3xl font-semibold tracking-tight text-ink max-sm:text-2xl">{figure}</p>
      <p className="text-md text-ink-2">{children}</p>
    </div>
  );
}

export function Section({ id, label, headline, lede, children, tone = "plain", className }: { id?: string; label?: ReactNode; headline: ReactNode; lede?: ReactNode; children?: ReactNode; tone?: "plain" | "subtle"; className?: string }) {
  return (
    <section id={id} className={cn("py-24 max-md:py-14", tone === "subtle" && "bg-subtle", className)}>
      <div className={cn(wrap, "flex flex-col gap-10")}>
        <div className="flex flex-col gap-4">
          {label ? <Label>{label}</Label> : null}
          <Display>{headline}</Display>
          {lede ? <Lede>{lede}</Lede> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** The FAQ: native details, so it works with no script and every answer is in the page for a search engine. */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="flex max-w-[800px] flex-col divide-y divide-line border-y border-line">
      {items.map((i) => (
        <details key={i.q} className="group py-5 max-sm:py-3">
          <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-ink max-sm:min-h-11 max-sm:text-md [&::-webkit-details-marker]:hidden">
            {i.q}
            <span aria-hidden className="shrink-0 font-mono text-ink-3 group-open:hidden">
              +
            </span>
            <span aria-hidden className="hidden shrink-0 font-mono text-ink-3 group-open:inline">
              &minus;
            </span>
          </summary>
          <div className="pt-3 text-md text-ink-2">{i.a}</div>
        </details>
      ))}
    </div>
  );
}

/** The two closing calls to action every page ends on. */
export function Close({ headline, lede }: { headline: ReactNode; lede?: ReactNode }) {
  return (
    <section className="border-t border-line py-24 max-md:py-14">
      <div className={cn(wrap, "flex flex-col items-start gap-6")}>
        <Display>{headline}</Display>
        {lede ? <Lede>{lede}</Lede> : null}
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
            Start free
          </ButtonLink>
          <Link href="/contact" prefetch={false} className="text-md font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:flex max-sm:min-h-11 max-sm:items-center">
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
