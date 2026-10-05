// The frame every legal page sits in (B9f; Paper `30 Marketing · Legal`): a label, the title, the day it was last
// updated, the five legal pages as a list beside the text, and the text itself. The words of each notice are the
// notice's own and are not touched here; this only draws them in the v4 type and spacing, so the body is styled
// from the container (headings, paragraphs, lists, links, a table) and a page passes plain elements.

import Link from "next/link";
import type { ReactNode } from "react";
import { Display, Label, wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

export const LEGAL_PAGES = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/data-sources", label: "Data sources" },
  { href: "/legal/trademarks", label: "Trademarks" },
] as const;

const body = [
  "[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink first:[&_h2]:mt-0",
  "[&_p]:text-md [&_p]:leading-relaxed [&_p]:text-ink-2 [&_p+p]:mt-3 [&_h2+p]:mt-3",
  "[&_ul]:mt-3 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:text-md [&_ul]:text-ink-2 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-md [&_ol]:text-ink-2",
  "[&_strong]:font-semibold [&_strong]:text-ink",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:decoration-1 [&_a:hover]:text-brand-hover [&_a]:[text-underline-position:from-font]",
  "[&_code]:rounded-sm [&_code]:bg-sunken [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-ink",
  "[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-md [&_thead]:border-b [&_thead]:border-ink [&_th]:py-2 [&_th]:pr-4 [&_th]:text-sm [&_th]:font-medium [&_th]:text-ink-3 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top [&_td]:text-ink-2 [&_tbody_tr]:border-b [&_tbody_tr]:border-line",
  "[&_.note]:mt-4 [&_.note]:rounded-lg [&_.note]:border [&_.note]:border-line [&_.note]:bg-subtle [&_.note]:p-4 [&_.note_p]:mt-0 [&_.note_p]:text-base",
].join(" ");

export function LegalShell({ title, updated, active, children }: { title: string; updated?: string; active: (typeof LEGAL_PAGES)[number]["href"]; children: ReactNode }) {
  return (
    <main className="font-sans text-ink">
      <div className={cn(wrap, "grid gap-12 py-20 max-md:py-10 lg:grid-cols-[200px_minmax(0,720px)]")}>
        <nav aria-label="Legal" className="max-lg:order-2 lg:pt-3">
          <p className="mb-3 font-mono text-sm text-ink-3">Legal</p>
          <ul className="flex flex-col gap-1 max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-5">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} prefetch={false} aria-current={p.href === active ? "page" : undefined} className={cn("flex min-h-8 items-center text-md max-sm:min-h-11", p.href === active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink")}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <Label>Legal</Label>
            <Display level={2} as="h1">
              {title}
            </Display>
            {updated ? <p className="text-md text-ink-3">Last updated {updated}</p> : null}
          </header>
          <div className={body}>{children}</div>
        </article>
      </div>
    </main>
  );
}

/** `2026-06-03` as "3 Jun 2026". */
export function legalDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}` : iso;
}
