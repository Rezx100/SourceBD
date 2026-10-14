// The parts every marketing page is drawn with (M1, handoff-mercury-motion-sitewide.md §3): the home page's look,
// one set for the whole site. One measure (1280 of content at 1440), one rhythm (`py-section`), light display type
// from the `site-*` scale, ink links, one focus ring. Green is spent on the primary button and the wordmark only,
// never on a link (the founder's critique of 7 Oct, item 2). Server components; the FAQ, the closing band and the
// footer are their own files beside this one.

import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { buttonClass } from "@/components/kit/button-class";
import { SourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";

/** 1280 wide at 1440 (80 px a side), 20 px a side on a phone. */
export const measure = "mx-auto w-full max-w-site px-5 md:px-10 xl:px-20";

/** The one focus ring on the site: near-black, offset, never green. */
export const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** A link in running text: ink, underlined. */
export const inkLink = cn("font-medium text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring);

/** The wordmark: the one green word on the site besides the main button. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("w-fit text-xl font-semibold tracking-tight text-brand", ring, className)}>
      SourceBD
    </Link>
  );
}

export function H2({ children, className, id, as: As = "h2" }: { children: ReactNode; className?: string; id?: string; as?: "h2" | "h3" }) {
  return <As id={id} className={cn("text-site-h2-sm font-normal text-ink-strong [text-wrap:balance] md:text-site-h2", className)}>{children}</As>;
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[680px] text-md text-ink-muted md:text-site-lede", className)}>{children}</p>;
}

/** The small label above a headline: "02 · Who are they?". */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-site-body font-medium text-ink-subtle", className)}>{children}</p>;
}

/** A page's headline (level 1: light, 56 at most) or a section's (level 2: the H2). */
export function Display({ children, level = 2, as: As = "h2", className }: { children: ReactNode; level?: 1 | 2; as?: "h1" | "h2"; className?: string }) {
  return (
    <As className={cn("text-ink-strong [text-wrap:balance]", level === 1 ? "text-site-h1-sm font-light md:text-site-h1" : "text-site-h2-sm font-normal md:text-site-h2", className)}>
      {children}
    </As>
  );
}

/** The underlined link under a block of copy: ink, never green. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} prefetch={false} className={cn("inline-flex min-h-11 items-center text-site-body font-medium text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring, className)}>
      {children}
    </Link>
  );
}

/** The search that runs on public Discover, then Start free and Book a demo: every inner page's hero actions. */
export function HeroActions({ tryLine = "Try “knit dresses Gazipur” or “GOTS”", center = false }: { tryLine?: string; center?: boolean }) {
  return (
    <div className={cn("flex w-full flex-col gap-4", center && "items-center")}>
      <form action="/discover" method="get" role="search" className="flex w-full max-w-[560px] flex-col gap-2">
        <div className="flex gap-2.5 max-sm:flex-col">
          <label htmlFor="hero-q" className="sr-only">
            Search suppliers, products or certificates
          </label>
          <input
            id="hero-q"
            name="q"
            type="search"
            autoComplete="off"
            placeholder="Supplier, product or certificate"
            className="h-12 w-full min-w-0 rounded-frame border border-line bg-surface px-4 text-site-body text-ink-strong outline-none placeholder:text-ink-subtle focus:border-accent focus:[box-shadow:inset_0_0_0_1px_theme(colors.accent)] sm:flex-1"
          />
          <button type="submit" className={buttonClass({ kind: "secondary", size: "lg", className: "h-12 rounded-frame px-5 text-site-body" })}>
            Search
          </button>
        </div>
        <p className={cn("text-sm text-ink-subtle", center && "text-center")}>{tryLine}</p>
      </form>
      <div className="flex flex-wrap items-center gap-2.5">
        <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="h-12 rounded-frame px-5 text-site-body">
          Start free
        </ButtonLink>
        <TextLink href="/contact" className="px-4">
          Book a demo
        </TextLink>
      </div>
    </div>
  );
}

/** Every inner page's first section: label, a light headline of 56 at most, the lede and what follows, centred. */
export function HeroCentered({ label, title, lede, children, stage }: { label?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode; stage?: ReactNode }) {
  return (
    <section className="pb-14 pt-10 md:pb-section md:pt-24">
      <div className={cn(measure, "flex flex-col items-center gap-6 text-center md:gap-7")}>
        {label ? <Label>{label}</Label> : null}
        <Display level={1} as="h1" className="max-w-[880px]">
          {title}
        </Display>
        {lede ? <Lede className="mx-auto">{lede}</Lede> : null}
        {children}
      </div>
      {stage ? <div className={cn(measure, "pt-10 md:pt-16")}>{stage}</div> : null}
    </section>
  );
}

export type Tone = "paper" | "subtle" | "dark";

/** A section of an inner page: label, headline, lede, then what it shows. `dark` is the night ground. */
export function Section({ id, label, headline, lede, children, tone = "paper", className }: { id?: string; label?: ReactNode; headline: ReactNode; lede?: ReactNode; children?: ReactNode; tone?: Tone | "plain"; className?: string }) {
  return (
    <section id={id} data-ground={tone === "dark" ? "night" : undefined} className={cn("py-14 md:py-section", tone === "subtle" && "bg-subtle", tone === "dark" && "bg-surface text-ink", className)}>
      <div className={cn(measure, "flex flex-col gap-10 md:gap-14")}>
        <div className="flex flex-col gap-5">
          {label ? <Label>{label}</Label> : null}
          <Display>{headline}</Display>
          {lede ? <Lede>{lede}</Lede> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Text on one side, the product on the other (the home page's showcase rows); `flip` puts the product first. */
export function FeatureRow({ label, headline, lede, children, media, flip = false, tone = "paper" }: { label?: ReactNode; headline: ReactNode; lede?: ReactNode; children?: ReactNode; media: ReactNode; flip?: boolean; tone?: "paper" | "subtle" }) {
  return (
    <section className={cn("py-14 md:py-section", tone === "subtle" && "bg-subtle")}>
      <div className={cn(measure, "grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16")}>
        <div className={cn("flex flex-col gap-5", flip && "lg:order-2")}>
          {label ? <Label>{label}</Label> : null}
          <H2>{headline}</H2>
          {lede ? <Lede>{lede}</Lede> : null}
          {children}
        </div>
        <div className={cn(flip && "lg:order-1")}>{media}</div>
      </div>
    </section>
  );
}

export type StillName = "hero-cotton" | "thread-cones" | "weave" | "thread-cone" | "carton" | "paper-seal" | "hangtags-fanned" | "selvedge" | "night-eyelet" | "cutting-table" | "hangtag" | "night-floor";

const set = (name: StillName, ext: "avif" | "webp") => `/site/home/${name}-1600.${ext} 1600w, /site/home/${name}-2560.${ext} 2560w`;

/** A backdrop: AVIF then WebP, 1600 and 2560 wide, filling its (positioned) parent. Decoration, so no alt. */
export function Still({ name, className, eager = false, sizes = "(min-width: 1440px) 1280px, 100vw" }: { name: StillName; className?: string; eager?: boolean; sizes?: string }) {
  return (
    <picture>
      <source type="image/avif" srcSet={set(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(name, "webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
      <img
        src={`/site/home/${name}-1600.webp`}
        alt=""
        width={1600}
        height={1063}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    </picture>
  );
}

/** The screens with a phone export of their own; the rest draw the desktop screen at every width. */
const PHONE = new Set(["results", "saved-selected", "rfq-detail", "compliance", "messages-thread", "full-certs2"]);

export type ScreenName = "results" | "saved-selected" | "rfq-detail" | "compliance" | "record" | "messages-thread" | "full-certs2" | "record-sanctioned" | "full" | "settings-members" | "landing";

/**
 * A product screen as shipped, framed as Paper frames it (12 px corner, hairline, soft drop). Below 768 the phone
 * export when there is one (`phone` names a different one, as the board does). `alt` says what it shows.
 */
export function Screen({ name, phone, alt, sizes = "(min-width: 1440px) 1152px, 90vw", className, eager = false }: { name: ScreenName; phone?: ScreenName | null; alt: string; sizes?: string; className?: string; eager?: boolean }) {
  const p = phone === null ? null : (phone ?? name);
  const hasPhone = p !== null && PHONE.has(p);
  return (
    <picture>
      {hasPhone ? <source media="(max-width: 767px)" type="image/webp" srcSet={`/site/home/screen-${p}-m-390.webp 390w, /site/home/screen-${p}-m-780.webp 780w`} sizes="calc(100vw - 72px)" width={390} height={844} /> : null}
      <source type="image/webp" srcSet={`/site/home/screen-${name}-1440.webp 1440w, /site/home/screen-${name}-2880.webp 2880w`} sizes={sizes} width={1440} height={900} />
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md) */}
      <img
        src={`/site/home/screen-${name}-1440.webp`}
        alt={alt}
        width={1440}
        height={900}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("relative block h-auto w-full rounded-frame border border-ink-strong/10 object-cover object-left-top shadow-lg", className)}
      />
    </picture>
  );
}

/** A screenshot on a photo stage, the home page's way of showing the product (the textile still behind it). */
export function Stage({ still = "weave", children, className, eager = false }: { still?: StillName; children: ReactNode; className?: string; eager?: boolean }) {
  return (
    <div className={cn("relative isolate flex items-center justify-center overflow-hidden rounded-card px-4 py-6 md:rounded-stage md:px-16 md:py-16", className)}>
      <Still name={still} eager={eager} />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

/** A framed source mark at 24 (the default) or 32 px (the strip: a 22 px mark). */
export function Mark({ code, large = false, lazy = true }: { code: string; large?: boolean; lazy?: boolean }) {
  return <SourceMark source={code} lazy={lazy} className={cn("border-ink-strong/10", large && "size-8 [&>img]:max-h-[22px] [&>img]:max-w-[22px]")} />;
}
