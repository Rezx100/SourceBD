// The compliance guides (B9f; Paper `30 Marketing · Resources`): the index of five laws and the article each one opens.
// The words of every article are `lib/marketing/compliance-pages` and stay as written; this draws them: a breadcrumb,
// the title, a line saying which law, when it was last reviewed, how many sources, and "not legal advice", the
// sections in their fixed order beside an "On this page" list, the sources, and the one call to action.

import Link from "next/link";
import { Close, Display, HeroActions, Label, Lede, wrap } from "@/components/site/parts";
import { COMPLIANCE_PAGES, DISCLAIMER, SECTION_ORDER, oldestReviewedAt, type CompliancePage } from "@/lib/marketing/compliance-pages";
import { readDay } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/** Where each law comes from, and the order the index shows them in. */
const REGION: Record<CompliancePage["slug"], string> = { uflpa: "US", "uk-msa": "UK", "eu-csddd": "EU", "eu-cbam": "EU", "eu-eudr": "EU" };
const ORDER: CompliancePage["slug"][] = ["uflpa", "uk-msa", "eu-csddd", "eu-cbam", "eu-eudr"];
const LAW: Record<CompliancePage["slug"], string> = { uflpa: "United States", "uk-msa": "United Kingdom", "eu-csddd": "European Union", "eu-cbam": "European Union", "eu-eudr": "European Union" };

const inOrder = () => ORDER.map((s) => COMPLIANCE_PAGES.find((p) => p.slug === s)).filter((p): p is CompliancePage => Boolean(p));
export const sectionId = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function GuidesIndex() {
  const reviewed = readDay(oldestReviewedAt());
  const pages = inOrder();
  return (
    <main className="font-sans text-ink">
      <section className="pb-12 pt-20 max-md:pb-8 max-md:pt-10">
        <div className={cn(wrap, "flex flex-col gap-6")}>
          <Label>Resources · Compliance guides</Label>
          <Display level={1} as="h1" className="max-w-[880px]">
            Compliance guides, in plain words.
          </Display>
          <Lede>Five laws a buyer of Bangladesh clothing meets, each with its sources and the date we last reviewed it.</Lede>
          <HeroActions tryLine="Search suppliers by name, product or HS code" />
        </div>
      </section>

      <section className="pb-24 max-md:pb-14">
        <div className={cn(wrap, "flex flex-col gap-6")}>
          <p className="font-mono text-sm text-ink-3">
            {pages.length} guides · not legal advice · all last reviewed {reviewed}
          </p>
          <ul className="grid gap-6 md:grid-cols-2">
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={`/compliance/${p.slug}`} prefetch={false} className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-6 hover:border-line-strong max-sm:p-5">
                  <span className="font-mono text-base text-ink-3">{REGION[p.slug]}</span>
                  <span className="text-xl font-semibold tracking-tight text-ink">{p.shortName}</span>
                  <span className="flex-1 text-md text-ink-2">{p.headline}</span>
                  <span className="text-sm text-ink-3">Last reviewed {readDay(p.last_reviewed_at)}</span>
                  <span className="text-md font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">Read the guide</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="max-w-prose text-sm text-ink-3">{DISCLAIMER}</p>
        </div>
      </section>

      <Close headline="Check your suppliers against the lists." lede="Free during beta. No card needed." />
    </main>
  );
}

export function GuideArticle({ page }: { page: CompliancePage }) {
  const sections = SECTION_ORDER.map((h) => page.sections.find((s) => s.heading === h)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const toc = [...sections.map((s) => s.heading), "References"];
  return (
    <main className="font-sans text-ink">
      <section className="pb-12 pt-16 max-md:pb-8 max-md:pt-8">
        <div className={cn(wrap, "flex flex-col gap-6")}>
          <nav aria-label="Breadcrumb" className="text-base text-ink-3">
            <Link href="/compliance" prefetch={false} className="hover:text-ink">
              Compliance guides
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span className="text-ink-2">{page.shortName}</span>
          </nav>
          <Display level={2} as="h1" className="max-w-[880px]">
            {page.title}
          </Display>
          <p className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-ink-3">
            <span>{LAW[page.slug]}</span>
            <span>Last reviewed {readDay(page.last_reviewed_at)}</span>
            <span>{page.references.length} sources</span>
            <span>Not legal advice</span>
          </p>
          <Lede>{page.summary}</Lede>
        </div>
      </section>

      <section className="pb-20 max-md:pb-12">
        <div className={cn(wrap, "grid gap-12 lg:grid-cols-[minmax(0,720px)_240px] lg:justify-between")}>
          <article className="flex min-w-0 flex-col gap-12 max-lg:order-2">
            {sections.map((s) => (
              <section key={s.heading} id={sectionId(s.heading)} className="flex scroll-mt-24 flex-col gap-3">
                <h2 className="text-2xl font-semibold tracking-tight text-ink">{s.heading}</h2>
                {s.body.map((para, i) => (
                  <p key={i} className="text-lg text-ink-2 max-sm:text-md">
                    {para}
                  </p>
                ))}
                {s.bullets ? (
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 text-lg text-ink-2 max-sm:text-md">
                    {s.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <section id="references" className="flex scroll-mt-24 flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-ink">References</h2>
              <ul className="flex flex-col gap-3 text-md">
                {page.references.map((r) => (
                  <li key={r.url} className="flex flex-col gap-0.5 [overflow-wrap:anywhere]">
                    <a href={r.url} rel="noopener noreferrer external" target="_blank" className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
                      {r.label}
                    </a>
                    <span className="text-sm text-ink-3">
                      {r.issuer} · accessed {readDay(r.accessed_on)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </article>
          <nav aria-label="On this page" className="flex flex-col gap-2 max-lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-sm text-ink-3">On this page</p>
            <ol className="flex flex-col gap-1">
              {toc.map((h) => (
                <li key={h}>
                  <a href={`#${sectionId(h)}`} className="flex min-h-8 items-center text-md text-ink-2 hover:text-ink max-sm:min-h-11">
                    {h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <Close
        headline={page.slug === "uflpa" ? "Check your saved suppliers" : "See the sources on a real supplier record"}
        lede={page.slug === "uflpa" ? "See each one against the UFLPA Entity List, with the date of the list. Free during beta." : "Every fact on a supplier names its source and the date we read it. Free during beta."}
      />
      <p className={cn(wrap, "pb-12 text-sm text-ink-3")}>
        {DISCLAIMER} Last reviewed {readDay(page.last_reviewed_at)}.
      </p>
    </main>
  );
}
