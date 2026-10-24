// The parts every marketing page is drawn with (M1, handoff-mercury-motion-sitewide.md §3): the home page's look,
// one set for the whole site. One measure (1280 of content at 1440), one rhythm (`py-section`), light display type
// from the `site-*` scale, ink links, one focus ring. Green is spent on the primary button and the logo's swatches
// only, never on a link (the founder's critique of 7 Oct, item 2). Server components; the FAQ, the closing band and the
// footer are their own files beside this one.

import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { buttonClass } from "@/components/kit/button-class";
import { Logo } from "@/components/patterns/logo";
import { SourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";

/** 1280 wide at 1440 (80 px a side), 20 px a side on a phone. */
export const measure = "mx-auto w-full max-w-site px-5 md:px-10 xl:px-20";

/** The home page's column since the founder's walkthrough of 23 Oct 2026: mercury.com's 1024 at 1440, 20 px a side on a phone, 40 on a tablet. */
export const column = "mx-auto w-[calc(100%-40px)] max-w-column md:w-[calc(100%-80px)]";

/** The tour's wider column (mercury.com's): 1136 at 1440, the list at 152 from the left. */
export const tourMeasure = "mx-auto w-[calc(100%-40px)] max-w-column-wide md:w-[calc(100%-80px)]";

/** The rule over a home section's headline (mercury.com's): a hairline in the ground's rule colour. */
export const rule = "border-t border-[rgb(var(--mk-rule))]";

/** The one focus ring on the site: near-black, offset, never green. */
export const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** A link in running text: ink, underlined. */
export const inkLink = cn("font-medium text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring);

/** The logo, its icon 35 px tall and the word 85% of that (the founder, 25 Oct 2026): the word in the ink of its ground, the two swatches green on a light one and paper on the night (the footer, the bar over a dark section). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("w-fit rounded-sm text-ink", ring, className)}>
      <Logo height={35} />
    </Link>
  );
}

export function H2({ children, className, id, as: As = "h2" }: { children: ReactNode; className?: string; id?: string; as?: "h2" | "h3" }) {
  return <As id={id} className={cn("text-site-h2-sm font-normal text-ink-strong [text-wrap:balance] md:text-site-h2", className)}>{children}</As>;
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[680px] text-md text-ink-muted md:text-site-lede", className)}>{children}</p>;
}

/** The small label above a headline: a hero's breadcrumb ("Product · Supplier search") or a row's name ("Filters"); never a number (critique 22 Oct, S13). */
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

/**
 * An inner page's one hero action (critique 22 Oct, S8): the green Start free with Book a demo as a text link, or, on
 * the search page alone (`search`), the search that runs on public Discover, its button drawn secondary.
 */
export function HeroActions({ search = false, center = false }: { search?: boolean; center?: boolean }) {
  if (!search) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2.5", center && "justify-center")}>
        <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="h-12 rounded-frame px-5 text-site-body">
          Start free
        </ButtonLink>
        <TextLink href="/contact" className="px-4">
          Book a demo
        </TextLink>
      </div>
    );
  }
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
        <p className={cn("text-sm text-ink-subtle", center && "text-center")}>Try “knit dresses Gazipur” or “GOTS”</p>
      </form>
    </div>
  );
}

/** Every inner page's first section: label, a light headline of 56 at most, the lede and what follows, centred. */
export function HeroCentered({ label, title, lede, children, stage, className }: { label?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode; stage?: ReactNode; className?: string }) {
  return (
    <section className={cn("pb-14 pt-10 md:pb-section md:pt-24", className)}>
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
    <section id={id} data-ground={tone === "dark" ? "night" : undefined} className={cn("py-14 md:py-section", tone === "subtle" && "bg-surface", tone === "dark" && "bg-surface text-ink", className)}>
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
    <section className={cn("py-14 md:py-section", tone === "subtle" && "bg-surface")}>
      <div className={cn(measure, "grid items-center gap-10 lg:gap-16", flip ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
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

/**
 * The site's photographs (the founder's videos, 22 Oct 2026): one world, the buyer's own. The sourcing studio with the
 * laptop the home page zooms into (`hero`), its swatches and its sample rail behind the product's windows, a northern
 * European port at night, the studio at dusk for the close, and the factory floor for the suppliers' section.
 */
export type StillName = "hero" | "laptop" | "swatches" | "rail" | "port" | "dusk" | "mill";

/** The widths each photograph ships at, and its height at the first of them. `laptop` is the hero's laptop, upscaled, for its zoom. */
const WIDTHS: Record<StillName, number[]> = { hero: [1600, 2560, 3840], laptop: [2560, 4096], swatches: [1600, 2560], rail: [1600, 2560], port: [1600, 2560], dusk: [1600, 2560], mill: [1600, 2560] };
const HEIGHT: Partial<Record<StillName, number>> = { laptop: 1440, dusk: 687 };

const set = (name: StillName, ext: "avif" | "webp") => WIDTHS[name].map((w) => `/site/home/${name}-${w}.${ext} ${w}w`).join(", ");

/** A photograph: AVIF then WebP at each width it ships at, filling its (positioned) parent. Decoration, so no alt. */
export function Still({ name, className, eager = false, sizes = "(min-width: 1440px) 1280px, 100vw" }: { name: StillName; className?: string; eager?: boolean; sizes?: string }) {
  return (
    <picture>
      <source type="image/avif" srcSet={set(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set(name, "webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md), no optimizer pass */}
      <img
        src={`/site/home/${name}-${WIDTHS[name][0]}.webp`}
        alt=""
        width={WIDTHS[name][0]}
        height={HEIGHT[name] ?? 900}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    </picture>
  );
}

/** The product's window on a photograph from the buyer's studio. */
export function Stage({ still = "rail", children, className, eager = false }: { still?: StillName; children: ReactNode; className?: string; eager?: boolean }) {
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
