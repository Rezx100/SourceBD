// The frame every legal page sits in (B9f; Paper `30 Marketing · Legal`), in the home page's design since 25 Oct 2026:
// the head on the day ground in the hero's type with the day it was last updated, then the five legal pages as a list
// beside the text in home's column. The words of each notice are the notice's own and are not touched here; the body is
// styled from the container (`prose`: headings, paragraphs, lists, links, a table), so a page passes plain elements.

import Link from "next/link";
import type { ReactNode } from "react";
import { HomeMain } from "@/components/site/home-main";
import { PageHead, prose } from "@/components/site/sections/inner";
import { column } from "@/components/site/sections/ui";
import { cn } from "@/lib/utils";

export const LEGAL_PAGES = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/data-sources", label: "Data sources" },
  { href: "/legal/trademarks", label: "Trademarks" },
] as const;

export function LegalShell({ title, updated, active, children }: { title: string; updated?: string; active: (typeof LEGAL_PAGES)[number]["href"]; children: ReactNode }) {
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead tone="day" label="Legal" title={title} lede={updated ? `Last updated ${updated}` : undefined} />
      <section data-mk-tone="day" aria-label={title} className="pb-16 md:pb-24">
        <div className={cn(column, "grid gap-12 lg:grid-cols-[176px_minmax(0,672px)] lg:justify-between")}>
          <nav aria-label="Legal" className="max-lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 font-display text-site-item text-ink">Legal</p>
            <ul className="flex flex-col gap-1 max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-5">
              {LEGAL_PAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} prefetch={false} aria-current={p.href === active ? "page" : undefined} className={cn("flex min-h-8 items-center text-site-item max-sm:min-h-11", p.href === active ? "font-display text-ink" : "font-book text-ink-2 hover:text-ink")}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <article className={cn("border-t border-line pt-8", prose)}>{children}</article>
        </div>
      </section>
    </HomeMain>
  );
}

/** `2026-06-03` as "3 Jun 2026". */
export function legalDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}` : iso;
}
