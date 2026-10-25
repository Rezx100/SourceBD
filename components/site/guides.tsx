// The compliance guides (B9f; Paper `30 Marketing · Resources`): the index of five laws and the article each one opens.
// The words of every article are `lib/marketing/compliance-pages` and stay as written; this draws them in the home
// page's design (25 Oct 2026): the index is home's guide tiles, all five; an article stands on the day ground, its head
// in the hero's type with the breadcrumb, which law, when it was last reviewed, how many sources and "not legal
// advice", the sections in their fixed order beside an "On this page" list, the sources, and home's close.

import Link from "next/link";
import { HomeMain } from "@/components/site/home-main";
import { CloseActions, Finale, Guides } from "@/components/site/sections/close";
import { PageHead, prose } from "@/components/site/sections/inner";
import { column, inkLink } from "@/components/site/sections/ui";
import { COMPLIANCE_PAGES, DISCLAIMER, SECTION_ORDER, oldestReviewedAt, type CompliancePage } from "@/lib/marketing/compliance-pages";
import { readDay } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/** Where each law comes from, its short mark on the tile, and the order the index shows them in. */
const LAW: Record<CompliancePage["slug"], string> = { uflpa: "United States", "uk-msa": "United Kingdom", "eu-csddd": "European Union", "eu-cbam": "European Union", "eu-eudr": "European Union" };
const MARK: Record<CompliancePage["slug"], string> = { uflpa: "UFLPA", "uk-msa": "MSA §54", "eu-csddd": "CSDDD", "eu-cbam": "CBAM", "eu-eudr": "EUDR" };
const ORDER: CompliancePage["slug"][] = ["uflpa", "uk-msa", "eu-csddd", "eu-cbam", "eu-eudr"];

const inOrder = () => ORDER.map((s) => COMPLIANCE_PAGES.find((p) => p.slug === s)).filter((p): p is CompliancePage => Boolean(p));
export const sectionId = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function GuidesIndex() {
  const reviewed = readDay(oldestReviewedAt());
  const pages = inOrder();
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label="Compliance guides" title="Compliance guides, in plain words." lede="Five laws a buyer of Bangladesh clothing meets, each with its sources and the date we last reviewed it.">
        <CloseActions />
      </PageHead>
      <Guides id="guides" heading="Pick a law. Each guide names its sources." guides={pages.map((p) => ({ href: `/compliance/${p.slug}`, mark: MARK[p.slug], title: `${p.shortName}: ${p.headline}` }))} />
      <section data-mk-tone="night" aria-label="Not legal advice" className="pt-10">
        <p className={cn(column, "font-book text-site-item text-ink-2")}>
          {pages.length} guides · not legal advice · all last reviewed {reviewed}. {DISCLAIMER}
        </p>
      </section>
      <Finale heading="Check your suppliers against the lists." />
    </HomeMain>
  );
}

export function GuideArticle({ page }: { page: CompliancePage }) {
  const sections = SECTION_ORDER.map((h) => page.sections.find((s) => s.heading === h)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const toc = [...sections.map((s) => s.heading), "References"];
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead
        tone="day"
        label={
          <nav aria-label="Breadcrumb" className="inline">
            <Link href="/compliance" prefetch={false} className="hover:text-ink">
              Compliance guides
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span>{page.shortName}</span>
          </nav>
        }
        title={page.title}
        lede={page.summary}
      >
        <p className="flex flex-wrap justify-center gap-x-6 gap-y-1 font-book text-site-item text-ink-2">
          <span>{LAW[page.slug]}</span>
          <span>Last reviewed {readDay(page.last_reviewed_at)}</span>
          <span>{page.references.length} sources</span>
          <span>Not legal advice</span>
        </p>
      </PageHead>

      <section data-mk-tone="day" aria-label={page.shortName} className="pb-16 md:pb-24">
        <div className={cn(column, "grid gap-12 lg:grid-cols-[minmax(0,672px)_224px] lg:justify-between")}>
          <article className={cn("flex min-w-0 flex-col gap-12 max-lg:order-2", prose)}>
            {sections.map((s) => (
              <section key={s.heading} id={sectionId(s.heading)} className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-6">
                <h2>{s.heading}</h2>
                {s.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
                {s.bullets ? (
                  <ul>
                    {s.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <section id="references" className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-6">
              <h2>References</h2>
              <ul className="!list-none !pl-0 [&>li+li]:mt-2">
                {page.references.map((r) => (
                  <li key={r.url} className="flex flex-col gap-0.5 [overflow-wrap:anywhere]">
                    <a href={r.url} rel="noopener noreferrer external" target="_blank" className={inkLink}>
                      {r.label}
                    </a>
                    <span className="text-site-item text-ink-3">
                      {r.issuer} · accessed {readDay(r.accessed_on)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <p className="text-site-item text-ink-3">
              {DISCLAIMER} Last reviewed {readDay(page.last_reviewed_at)}.
            </p>
          </article>
          <nav aria-label="On this page" className="flex flex-col gap-2 max-lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <p className="font-display text-site-item text-ink">On this page</p>
            <ol className="flex flex-col gap-1">
              {toc.map((h) => (
                <li key={h}>
                  <a href={`#${sectionId(h)}`} className="flex min-h-8 items-center font-book text-site-item text-ink-2 hover:text-ink max-sm:min-h-11">
                    {h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <Finale heading={page.slug === "uflpa" ? "Check your saved suppliers against the UFLPA Entity List." : "See the sources on a real supplier record."} />
    </HomeMain>
  );
}
