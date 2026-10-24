"use client";

// The home page's last sections, on the night ground, mercury.com's from "You're creating something to stand the test
// of time" to the close (the founder's walkthrough of 23 Oct 2026, measured at 1440):
//
// - `Stats`: a centred headline and four figures across the column, parted by hairlines. The figures are the site's
//   live facts (`lib/site-facts.ts`): one that was not read is left out, never guessed; "0 scores" is true by
//   definition. They count up once as the row scrolls in, ending on the figure the server drew; nothing counts with no
//   script, under reduced motion, or when the row is on screen as the page opens.
// - `Protection`: three cards, each a part of the real app in its dark theme held still, filling the card (`AppStill`,
//   PROVENANCE.md; founder's recording of 24 Oct 2026): the checks a buyer gets on every record. The words are the
//   Security and Compliance pages'.
// - `Guides`: three of the compliance guides, where Mercury lists its press, each a card with its law's short name on
//   a tile (our type, no logo) and the way in.
// - `Finale`: the closing headline with Start free and Book a demo, then a card for buyers and one for suppliers.

import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/kit";
import { stillPreferred } from "@/components/site/motion";
import { withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { AppStill } from "./browser";
import { CardWords, SectionHead } from "./card-grid";
import { column, ring } from "./ui";

/** The figures as [figure, what it counts], each only when it was read; four at most, as the row holds. */
export function statCells(f: SiteFacts): [string, string][] {
  const cells: ([string, string] | null)[] = [
    f.suppliers !== null ? [withCommas(f.suppliers), "Garment suppliers published"] : null,
    f.certificatesOnFile !== null ? [withCommas(f.certificatesOnFile), "Certificates on file"] : null,
    f.sourcesWithRecords !== null && f.sourcesListed !== null ? [String(f.sourcesWithRecords), `Of ${f.sourcesListed} public sources hold records`] : null,
    ["0", "Scores, grades or stars"],
  ];
  return cells.filter((c): c is [string, string] => c !== null);
}

const COUNT_MS = 1600;

/** How far through the count `t` (0 to 1) is shown: fast, then settling. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** A figure partway through its count: a plain number counts up, anything else is drawn as it is. */
export function counted(figure: string, t: number): string {
  if (t >= 1 || !/^[\d,]+$/.test(figure)) return figure;
  return withCommas(Math.round(Number(figure.replace(/,/g, "")) * ease(t)));
}

export function Stats({ facts }: { facts: SiteFacts }) {
  const cells = statCells(facts);
  const row = useRef<HTMLUListElement>(null);
  const [t, setT] = useState(1);
  useEffect(() => {
    const el = row.current;
    if (!el || stillPreferred() || el.getBoundingClientRect().top < innerHeight || typeof IntersectionObserver === "undefined") return;
    setT(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / COUNT_MS);
        setT(k);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section data-mk-tone="night" aria-labelledby="home-figures" className="pt-24 md:pt-36">
      <div className={cn(column, "flex flex-col items-center")}>
        <h2 id="home-figures" className="max-w-[672px] text-center font-display text-site-headline-sm text-ink [text-wrap:balance] md:text-site-headline">
          You’re building supply chains to last. So are we.
        </h2>
        <ul ref={row} className="mt-12 grid w-full grid-cols-2 gap-y-10 md:mt-16 md:flex md:justify-center">
          {cells.map(([n, what]) => (
            <li key={what} className="flex flex-col items-center gap-2 px-4 text-center md:w-1/4 md:border-l md:border-line md:first:border-l-0">
              <span className="font-display tabular-nums text-site-stat-sm text-ink md:text-site-stat">{counted(n, t)}</span>
              <span className="max-w-[190px] font-display text-site-card text-ink-2">{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const CARDS: { still: string; says: string; title: string; body: string }[] = [
  { still: "sanctions", says: "A record's sanctions panel: not listed, read for every supplier, with the day each list was read: US Treasury (OFAC) 8 Oct, US Labor (ILAB) 24 Oct, European Union 6 Oct, UK (OFSI) 6 Oct.", title: "Every supplier, against sanctions lists", body: "US, EU and UK lists, each with the day we read it. A supplier on one is marked everywhere and Send RFQ is refused." },
  { still: "uflpa", says: "The UFLPA checks on the saved list: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18 suppliers, then the suppliers A to Z.", title: "Forced-labour lists, checked for you", body: "Every saved supplier against the UFLPA Entity List. Entries added since our last read are said to be unchecked." },
  { still: "locked", says: "A record's contact panel: the contact details are locked, and Send RFQ under it.", title: "Contacts locked until they are given", body: "Contact details open only when the supplier or a register provides them. Locked is a state, not a blur." },
];

export function Protection() {
  return (
    <section data-mk-tone="night" aria-labelledby="home-confidence" className="pt-20 md:pt-[72px]">
      <div className={column}>
        <SectionHead id="home-confidence">
          Standard checks stop short. SourceBD goes further.
        </SectionHead>
        <ul className="mt-8 grid gap-x-8 gap-y-10 md:mt-10 md:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.title} className="flex flex-col">
              <div className="relative aspect-[4/5] overflow-hidden rounded-frame bg-sunken">
                <AppStill name={c.still} says={c.says} />
              </div>
              <CardWords title={c.title} body={c.body} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const GUIDES: { href: string; mark: string; title: string }[] = [
  { href: "/compliance/uflpa", mark: "UFLPA", title: "What the UFLPA asks of a garment buyer" },
  { href: "/compliance/uk-msa", mark: "MSA §54", title: "Writing a Modern Slavery Act statement" },
  { href: "/compliance/eu-csddd", mark: "CSDDD", title: "Due diligence under the EU’s CSDDD" },
];

export function Guides() {
  return (
    <section data-mk-tone="night" aria-labelledby="home-guides" className="pt-20 md:pt-[72px]">
      <div className={column}>
        <SectionHead id="home-guides">From our compliance guides</SectionHead>
        <ul className="mt-8 grid gap-8 md:mt-10 md:grid-cols-3">
          {GUIDES.map((g) => (
            <li key={g.href}>
              <Link href={g.href} prefetch={false} className={cn("group flex h-full min-h-[447px] flex-col rounded-frame bg-sunken p-8 max-md:min-h-0", ring)}>
                <span aria-hidden className="flex aspect-[256/171] items-center justify-center rounded-lg bg-ink/[0.06] font-display text-site-section text-ink">
                  {g.mark}
                </span>
                <span className="mt-8 font-display text-xl text-ink md:text-site-h3 md:tracking-normal">{g.title}</span>
                <span aria-hidden className="mt-auto flex size-10 items-center justify-center rounded-full bg-ink/15 text-ink transition-colors group-hover:bg-ink/25 max-md:mt-8">
                  <ArrowRight size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The two ways in under the closing headline: buyers, and the suppliers whose records are already here. */
export const HOME_CARDS = [
  { who: "SourceBD for buyers", body: "Free while we are in beta, no card needed. Shortlist, vet and message verified Bangladesh factories in one sitting.", link: ["See what is included", "/pricing"] },
  { who: "SourceBD for suppliers", body: "Your record is already here, read from the registers. Claim it, keep it current and answer buyers’ RFQs at no cost.", link: ["Claim your record", "/signup?role=supplier"] },
] as const;

const secondary = cn("inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-ink/15 px-4 text-site-item text-ink transition-colors hover:bg-ink/25", ring);

export function Finale() {
  return (
    <section data-mk-tone="night" aria-labelledby="site-close" className="pb-8 pt-24 md:pb-40 md:pt-36">
      <div className={cn(column, "flex flex-col items-center")}>
        <h2 id="site-close" className="max-w-[672px] text-center font-display text-site-headline-sm text-ink [text-wrap:balance] md:text-site-headline">
          Sourcing, rebuilt from the register up.
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="h-10 rounded-full px-5 text-site-item">
            Start free
          </ButtonLink>
          <Link href="/contact" prefetch={false} className={secondary}>
            Book a demo
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
        <ul className="mt-16 grid w-full gap-8 md:mt-[72px] md:grid-cols-2">
          {HOME_CARDS.map((c) => (
            <li key={c.who} className="flex flex-col gap-3 rounded-frame bg-sunken p-8">
              <h3 className="font-display text-xl text-ink md:text-site-h3 md:tracking-normal">{c.who}</h3>
              <p className="max-w-[432px] font-book text-site-card text-ink-2">{c.body}</p>
              <Link href={c.link[1]} prefetch={false} className={cn(secondary, "mt-6")}>
                {c.link[0]}
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
