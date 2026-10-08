// The home page, "Know who you're buying from" (Paper `30 Marketing · Chapter 1 to 9`): nine chapters that each
// answer one question a buyer asks about a new factory, and add one row to one real supplier record, then the FAQ.
// The record is Mondol Fabrics Ltd., read from production on 3 Oct 2026 (BGMEA 4002, EPB 2798, RSC 10861,
// GOTS-19020 valid until 15 Dec 2026): every figure in it is a captured fact with the date it was read, not a live
// count. The live figures (suppliers, sources, certificates, the latest read) come from `lib/site-facts.ts` and a
// figure that was not read is left out.
//
// Built differently from Paper, on purpose (decisions in the PR): the chapters are stacked sections, each showing
// the record as it stands at that beat, not scenes pinned while the scroll drives them (no script, and a phone and
// a reduced-motion reader get the same page); the opening is the district counts, not a dot map (the geocode cache
// is not wired for the public site); chapter 4 shows the address and its honesty note without the Barikoi capture.

import Image from "next/image";
import Link from "next/link";
import { DIFFER, ProofScene, RECEIPTS, SourceDates, SourcesScene, WatchScene } from "@/components/site/film/chapters";
import { COMPLIANCE_LEDE, COMPLIANCE_SCREEN, COMPLIANCE_STEPS, CloseScene, LADDER_NOTE, OrderScene, PROMISES, PromisesScene, SCREENS, TIERS, TrustScene, liveFigures } from "@/components/site/film/closing";
import { TIER_SCRIPT } from "@/components/site/film/engine/tier";
import { Opening } from "@/components/site/film/opening";
import * as record from "@/components/site/film/record";
import { FilmRuntime } from "@/components/site/film/runtime";
import { ClaimReceipt, Display, Faq, HeroActions, Label, Lede, RecordCard, Section, Stat, wrap, type Row } from "@/components/site/parts";
import { RoleTabs } from "@/components/site/role-tabs";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

const NAME = record.NAME;

// The record's facts are the film's (components/site/film/record.ts); the old card names the sources in words.
const SOURCES: Row = { ...record.SOURCES, from: "EPB, RSC, BGMEA, BKMEA, GOTS" };
const BGMEA: Row = record.BGMEA;
const GOTS: Row = record.GOTS;
const SAFETY: Row = record.SAFETY;
const SITE: Row = record.SITE;
const EXPORTS: Row = record.EXPORTS;
const UFLPA: Row = record.UFLPA;
const RFQ: Row = record.RFQ;

const mark = (r: Row): Row => ({ ...r, flag: "new" });

/** The district counts of 3 Oct 2026, from the suppliers' register addresses. Not live: dated, and not a district total (the column mixes spellings). */
const DISTRICTS: [string, number][] = [["Dhaka district", 4421], ["Gazipur", 1819], ["Narayanganj", 1628], ["Chattogram", 1080]];

export const FAQ_ITEMS = (f: SiteFacts) => [
  {
    q: "Where do the facts come from?",
    a: `From ${f.sourcesListed ?? "our"} public sources${f.sourcesWithRecords !== null ? `, ${f.sourcesWithRecords} of them holding supplier records` : ""}: government bodies and RSC, trade bodies such as BGMEA and BKMEA, certification bodies, brand supplier lists and the UFLPA Entity List. Each fact shows its source and the date we read it.`,
  },
  { q: "Do you score or rank suppliers?", a: "No. We show what each source says and when we read it. There is no grade, rating or star on any supplier." },
  { q: "Can a supplier pay to appear higher?", a: "No. No supplier pays to rank higher or look better." },
  { q: "How fresh is each fact?", a: `Each fact shows the date we read its source.${readDay(f.latestRead) ? ` The latest register read was ${readDay(f.latestRead)}.` : ""}` },
  { q: "How do I contact a supplier?", a: "Contact details stay locked. Send an RFQ and the supplier replies in Messages." },
  { q: "Do you list buying houses too?", a: "Yes. Search can be narrowed to factories or to buying houses." },
];

function Chapter({ n, question, headline, lede, record, children }: { n: string; question: string; headline: string; lede: string; record: Row[]; children?: React.ReactNode }) {
  return (
    <Section id={`ch-${n}`} label={`${n} · ${question}`} headline={headline} lede={lede}>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <RecordCard name={NAME} line="Factory · Gazipur" rows={record} className="lg:shrink-0" />
        {children ? <div className="flex w-full max-w-[460px] flex-col gap-8">{children}</div> : null}
      </div>
    </Section>
  );
}

/** `film` is the flag (`filmOn` in engine/tier.ts: on unless the build or the address turns it off): off, the page is exactly what it was before the film. */
export function Home({ facts, film = false }: { facts: SiteFacts; film?: boolean }) {
  const count = facts.suppliers !== null ? withCommas(facts.suppliers) : null;
  const updated = readDay(facts.latestRead);
  const R = (...rows: Row[]) => rows;
  return (
    <main className="font-sans text-ink" {...(film ? { "data-film": "", "data-theme-auto": "" } : {})}>
      {film ? (
        <>
          <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
          <FilmRuntime />
          <Opening count={count} />
        </>
      ) : (
        <>
      {/* 1 · Opening */}
      <section className="pb-24 pt-20 max-md:pb-14 max-md:pt-10">
        <div className={cn(wrap, "flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between")}>
          <div className="flex min-w-0 flex-col gap-8">
            {count ? <Label>{count} suppliers{updated ? ` · updated ${updated}` : ""}</Label> : null}
            <Display level={1} as="h1" className="max-w-[760px]">
              Know who you&rsquo;re buying from.
            </Display>
            <Lede className="max-w-[560px]">{count ? `${count} Bangladesh garment suppliers, each checked against the registers that list them.` : "Bangladesh garment suppliers, each checked against the registers that list them."}</Lede>
            <HeroActions />
          </div>
          <RecordCard name={NAME} line="Factory · Gazipur" rows={[]} badge={count ? `1 of ${count} suppliers` : undefined} className="lg:shrink-0" />
        </div>
      </section>

      <Section
        id="ch-1"
        label="Where are they?"
        headline="Most sit in four districts."
        lede="Suppliers by district, from their register addresses, as counted on 3 Oct 2026."
      >
        <ul className="grid max-w-[720px] grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4">
          {DISTRICTS.map(([name, n]) => (
            <li key={name} className="flex flex-col gap-1 border-t border-ink pt-3">
              <span className="text-lg text-ink-2">{name}</span>
              <span className="font-mono text-2xl font-semibold text-ink">{withCommas(n)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <Label>Pick one</Label>
          <p className="text-3xl font-semibold tracking-tighter text-ink max-sm:text-2xl">Follow one factory down the page.</p>
          <Lede>{NAME} makes knitwear in Kashimpur, Gazipur. Each row its record gains below comes from a named source.</Lede>
          <p className="font-mono text-xs text-ink-3">A real record, as it stands on 3 Oct 2026.</p>
        </div>
      </Section>
        </>
      )}

      {film ? (
        <>
          <SourcesScene />
          <ProofScene />
          <WatchScene />
        </>
      ) : (
        <>
      <Chapter n="02" question="Who are they?" headline="One factory. One record." lede="Five registers file it under their own number, on their own date. We match them to one factory, and every fact keeps the source it came from and the day we read it." record={R(mark(SOURCES))}>
        <SourceDates />
      </Chapter>

      <Chapter n="03" question="Is that true?" headline="Every claim, beside its source." lede="A factory says it is a BGMEA member, and the BGMEA register says so too, under number 4002. The certificate is on file: its number, who issued it and when it runs out. Safety comes from the RSC record. When two sources disagree, you see both." record={R(SOURCES, BGMEA, GOTS, mark(SAFETY))}>
        {RECEIPTS.map((r) => (
          <ClaimReceipt key={r.source} claim={r.claim} source={r.source} fields={r.fields} />
        ))}
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-subtle p-4">
          <p className="text-sm font-semibold text-ink">2 sources differ</p>
          <p className="text-base text-ink-2">{DIFFER}</p>
        </div>
      </Chapter>

      <Chapter n="04" question="Where are they?" headline="One address, on the map." lede="The address comes from the registers. Where the pin is only close, we say so." record={R(SOURCES, BGMEA, GOTS, SAFETY, mark(SITE))}>
        <div className="flex flex-col gap-2 rounded-lg border border-line p-5">
          <p className="text-xs text-ink-3">Factory &middot; approximate location</p>
          <p className="text-md font-semibold text-ink">Nayapara, Kashimpur, Gazipur</p>
          <p className="text-sm text-ink-3">The pin marks the area, not the building. From BGMEA and BKMEA.</p>
        </div>
      </Chapter>

      <Chapter n="05" question="Who do they ship to?" headline="Export records are coming." lede="Export records arrive in v2. Until then this chapter shows no figures." record={R(SOURCES, BGMEA, GOTS, SAFETY, SITE, mark(EXPORTS))}>
        <div className="flex flex-col gap-3 rounded-lg border border-line p-5">
          <p className="text-lg font-semibold text-ink">Export records, per supplier</p>
          <p className="text-md text-ink-2">Each record will show the date, the product and its HS code, pieces, FOB per piece, the buyer, the destination, and sea or air.</p>
          <p className="text-base text-ink-3">From Bangladesh customs export records. Used to cross-check, never to replace a register.</p>
        </div>
      </Chapter>

      <Chapter n="06" question="Will it still be true next month?" headline="The list changes. We check again." lede="Your saved suppliers are checked against our latest copy of the UFLPA Entity List. We say what we found, never “clear”." record={R(SOURCES, BGMEA, record.GOTS_DUE, SAFETY, SITE, EXPORTS, mark(UFLPA))}>
        <ol className="flex flex-col gap-4 border-l border-line pl-5">
          {[["3 Oct", "Day 0 · shortlisted"], ["15 Nov", "Day 43 · alert: GOTS valid until 15 Dec"], ["1 Dec", "New list copy · checked again"]].map(([d, t]) => (
            <li key={d} className="flex flex-col gap-0.5">
              <span className="font-mono text-xs text-ink-3">{d}</span>
              <span className="text-base text-ink">{t}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-1 rounded-lg border border-line p-5">
          <p className="text-lg font-semibold text-ink">Checked against the UFLPA Entity List</p>
          <p className="text-sm font-semibold text-ink">No link found</p>
          <p className="text-base text-ink-2">{NAME} is not on the list.</p>
          <p className="text-sm text-ink-3">UFLPA Entity List, US DHS &middot; our copy from 14 May 2026</p>
        </div>
      </Chapter>
        </>
      )}

      {film ? (
        <>
          <OrderScene />
          <PromisesScene />
          <TrustScene facts={facts} />
          <CloseScene count={count} />
        </>
      ) : (
        <>
      <Section id="ch-7" label="07 · Can they make my order?" headline="Shortlist. Ask. Compare." lede="Save the suppliers you like. Send one RFQ, and each gets its own copy. The quotes come back side by side.">
        <RoleTabs
          tabs={[
            {
              key: "sourcing",
              label: "Sourcing",
              panel: (
                <figure className="flex flex-col gap-4">
                  <ol className="flex flex-wrap gap-x-8 gap-y-2 text-md text-ink-2">
                    <li><span className="font-mono text-ink-3">1 </span><strong className="text-ink">{SCREENS[0]!.step}</strong></li>
                    <li><span className="font-mono text-ink-3">2 </span>{SCREENS[1]!.step}</li>
                    <li><span className="font-mono text-ink-3">3 </span>{SCREENS[2]!.step}</li>
                  </ol>
                  <Image src={SCREENS[0]!.src} alt={SCREENS[0]!.alt} width={1440} height={900} className="h-auto w-full rounded-lg border border-line" />
                  <figcaption className="font-mono text-xs text-ink-3">Real v4 screen &middot; Saved suppliers, 3 picked for one RFQ</figcaption>
                </figure>
              ),
            },
            {
              key: "compliance",
              label: "Compliance",
              panel: (
                <figure className="flex flex-col gap-4">
                  <p className="text-lg text-ink-2">{COMPLIANCE_LEDE}</p>
                  <ol className="flex flex-wrap gap-x-8 gap-y-2 text-md text-ink-2">
                    <li><span className="font-mono text-ink-3">1 </span><strong className="text-ink">{COMPLIANCE_STEPS[0]}</strong></li>
                    <li><span className="font-mono text-ink-3">2 </span>{COMPLIANCE_STEPS[1]}</li>
                    <li><span className="font-mono text-ink-3">3 </span>{COMPLIANCE_STEPS[2]}</li>
                  </ol>
                  <Image src={COMPLIANCE_SCREEN.src} alt={COMPLIANCE_SCREEN.alt} width={1440} height={900} className="h-auto w-full rounded-lg border border-line" />
                  <figcaption className="font-mono text-xs text-ink-3">Real v4 screen &middot; Compliance, certificate dates, expired first</figcaption>
                </figure>
              ),
            },
          ]}
        />
      </Section>

      <Section id="ch-8" label="08 · Why should I trust you?" headline="Three things we never do." lede="We show what the registers say. You decide what it means." tone="subtle">
        <ol className="grid gap-8 md:grid-cols-3">
          {PROMISES.map(([n, h, b]) => (
            <li key={n} className="flex flex-col gap-2 border-t border-ink pt-4">
              <span className="font-mono text-base text-ink-3">{n}</span>
              <h3 className="text-3xl font-semibold tracking-tighter text-ink max-sm:text-2xl">{h}</h3>
              <p className="text-md text-ink-2">{b}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-4">
          <Display>Every source has its rank.</Display>
          <Lede>Government registers come first. A source lower on the ladder never overwrites one above it.</Lede>
          <ol className="grid gap-6 md:grid-cols-5">
            {TIERS.map(([t, n, list]) => (
              <li key={t} className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="font-mono text-xs text-ink-3">{t}</span>
                <span className="text-md font-semibold text-ink">{n}</span>
                <ul className="flex flex-col gap-0.5 text-base text-ink-2">
                  {list.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-3">{LADDER_NOTE}</p>
          <p className="flex flex-wrap items-baseline gap-x-3 text-md">
            {facts.sourcesListed !== null ? <span className="font-mono text-xs text-ink-3">{facts.sourcesListed} sources listed{facts.sourcesWithRecords !== null ? ` · ${facts.sourcesWithRecords} hold supplier records` : ""}</span> : null}
            <Link href="/methodology" prefetch={false} className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
              See all {facts.sourcesListed ?? "the"} sources and how we check them
            </Link>
          </p>
        </div>
        {count || facts.certificatesOnFile !== null || facts.sourcesListed !== null || facts.rscRecords !== null ? (
          <div className="flex flex-col gap-4">
            <Display>The numbers, as they stand.</Display>
            <Lede>Counted straight from our records, not rounded. The date says when.</Lede>
            <div className="grid gap-8 md:grid-cols-4">
              {liveFigures(facts).map(([figure, what]) => (
                <Stat key={what} figure={figure}>
                  {what}
                </Stat>
              ))}
            </div>
            {updated || facts.latestRead ? <p className="font-mono text-xs text-ink-3">Updated {updated}{facts.latestRead ? ` · latest register read ${readDay(facts.latestRead)}` : ""}</p> : null}
          </div>
        ) : null}
      </Section>

      <Section id="ch-9" label="09 · The whole record" headline="Every row, with its source." lede="Who they are, what is true, where they are, who they ship to, and what to watch. Then you send the RFQ.">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <RecordCard name={NAME} line="Factory · Kashimpur, Gazipur" badge="Saved · watching" rows={R(SOURCES, BGMEA, GOTS, SAFETY, { ...SITE, value: "Kashimpur, Gazipur · approximate", from: undefined }, { label: "Export records", value: "Coming in v2" }, UFLPA, mark(RFQ))} />
          <div className="flex w-full max-w-[460px] flex-col gap-2 rounded-lg border border-line p-5">
            <p className="text-md font-semibold text-ink">RFQ sent to {NAME}</p>
            <p className="text-base text-ink-2">Contact details stay locked. The supplier replies here, in Messages.</p>
          </div>
        </div>
      </Section>
        </>
      )}

      {/* With the film on, the close carries these words and the search, on the planet. */}
      {film ? null : (
        <section className="border-t border-line py-24 max-md:py-14">
          <div className={cn(wrap, "flex flex-col gap-6")}>
            <Label>One factory, followed from a dot to an RFQ</Label>
            <Display level={1}>Now you know who you&rsquo;re buying from.</Display>
            <Lede>{count ? `Do the same for any of ${count} suppliers. Search is free.` : "Do the same for any supplier. Search is free."}</Lede>
            <HeroActions />
          </div>
        </section>
      )}

      <Section id="faq" label="Questions" headline="Asked before you sign up." tone="subtle">
        <Faq items={FAQ_ITEMS(facts)} />
      </Section>
    </main>
  );
}

