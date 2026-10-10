// The pieces every section of the home page is drawn with (Paper "32 Home · Mercury direction"): the 1280 measure,
// the 48/56 heading and its lede, the underlined text link, a backdrop still, a product screen and a framed source
// mark. The colours are the token names Paper's values resolve to (`ink-strong`, `ink-muted`, `ink-subtle`,
// `line-subtle`, `brand-wash`); green is spent on the primary button, the wordmark and the icons' one detail, never on
// a link (the founder's critique of 7 Oct, item 2).

import Link from "next/link";
import type { ReactNode } from "react";
import { SourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";

/** 1280 wide at 1440 (80 px a side), 20 px a side on a phone. */
export const measure = "mx-auto w-full max-w-[1440px] px-5 md:px-10 xl:px-20";

export function H2({ children, className, id, as: As = "h2" }: { children: ReactNode; className?: string; id?: string; as?: "h2" | "h3" }) {
  return <As id={id} className={cn("text-[30px] font-normal leading-[38px] tracking-[-0.025em] text-ink-strong [text-wrap:balance] md:text-[48px] md:leading-[56px]", className)}>{children}</As>;
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[16px] leading-6 text-ink-muted md:text-[17px] md:leading-[27px]", className)}>{children}</p>;
}

export const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The underlined link under a block of copy: ink, never green. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} prefetch={false} className={cn("inline-flex min-h-11 items-center text-[15px] font-medium leading-[18px] text-ink-strong underline decoration-1 underline-offset-4 hover:decoration-2", ring, className)}>
      {children}
    </Link>
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
 * A product screen as shipped, framed as Paper frames it (10–12 px corner, hairline, soft drop). Below 768 the
 * phone export when there is one (`phone` names a different one, as the board does). `alt` says what it shows.
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
        className={cn("relative block h-auto w-full rounded-[10px] border border-ink-strong/10 object-cover object-left-top shadow-lg md:rounded-[12px]", className)}
      />
    </picture>
  );
}

/** A framed source mark at 24 (the default) or 32 px (the strip: a 22 px mark). */
export function Mark({ code, large = false, lazy = true }: { code: string; large?: boolean; lazy?: boolean }) {
  return <SourceMark source={code} lazy={lazy} className={cn("border-ink-strong/10", large && "size-8 [&>img]:max-h-[22px] [&>img]:max-w-[22px]")} />;
}
