// The film's end (handoff-home-film §3.8, §4, rebuilt after the founder's video of 7 Oct 2026: "very low quality
// images are used here", "3 things we never do, no visuals, just scrolling with text", "why should I trust you, this
// section is really badly made ... a lot of branded visuals to represent the SourceBD dashboard"). "Shortlist. Ask.
// Compare.", the real product large and sharp on the night stage; "Three things we never do.", each promise beside
// the app showing it kept; "Every source has its rank.", the ladder with the sources' marks, the rule shown on a real
// fact and the live figures, on the night stage; and the close, night again, where the planet comes back. Server-
// rendered, every word in the page on every tier; the engine moves them on the full tier only (engine/chapters.ts).

import Image from "next/image";
import Link from "next/link";
import { CheckCircle, ShieldCheck, Star } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties, ReactNode } from "react";
import { ButtonLink, CertChip, Chip, FactChip } from "@/components/kit";
import { SourceMark, hasSourceMark } from "@/components/patterns/source-mark";
import { Header, SCENE } from "@/components/site/film/chapters";
import { Screen, ScreenStage, SearchField } from "@/components/site/film/pane";
import { LINE_FULL, NAME } from "@/components/site/film/record";
import { AppWindow, Stage } from "@/components/site/film/stage";
import { Lede, wrap } from "@/components/site/parts";
import { RoleTabs } from "@/components/site/role-tabs";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/** The three steps, each a real v4 screen (2880 by 1800) with the part the step is about: upright on a narrow window (`focus`), wide from 1024px (`zoom`): the Saved page, the RFQ composer (where the cursor presses Send RFQ), the quotes. */
export const SCREENS: readonly { src: string; alt: string; step: string; cursor?: { x: number; y: number }; focus: { x: number; y: number }; zoom: { x: number; y: number } }[] = [
  { src: "/site/saved-selected.png", alt: "The Saved page with three suppliers picked, and the bar offering one RFQ to all three.", step: "Shortlist from your saved suppliers", focus: { x: 62, y: 38 }, zoom: { x: 85, y: 39 } },
  { src: "/site/rfq-one.png", alt: `The RFQ composer: one RFQ to ${NAME}, filled in, with Send RFQ ready to press.`, step: "Send one RFQ", cursor: { x: 92.6, y: 95.5 }, focus: { x: 48, y: 55 }, zoom: { x: 85, y: 100 } },
  { src: "/site/rfq-quotes.png", alt: "The RFQ's quotes, side by side.", step: "Compare the quotes", focus: { x: 42, y: 45 }, zoom: { x: 80, y: 48 } },
];
/** Where the compliance screen is looked at: the certificates that need a look (narrow), and the list checks beside them (wide). */
const COMPLIANCE_FOCUS = { x: 45, y: 45 } as const;
const COMPLIANCE_ZOOM = { x: 62, y: 26 } as const;
export const COMPLIANCE_STEPS = ["Certificate dates, expired first", "UFLPA Entity List checks", "Each fact with its source and date"] as const;
export const COMPLIANCE_SCREEN = { src: "/site/compliance-hub.png", alt: "The Compliance page: certificates that need a look, expired first, with an ask for the new certificate on each." } as const;
export const COMPLIANCE_LEDE = "Same loop, for compliance. Every supplier you shortlisted, with its certificate dates and list checks. Problems first.";
/** The app has no dark theme: the screens stay light in both, and the caption says so (§3.8). */
export const STAGE_CAPTION = "Real v4 screens · the app is light in both themes";

/** The three promises and the five rungs of the source ladder: the same data the page without the film draws. */
export const PROMISES: readonly [n: string, promise: string, line: string][] = [
  ["01", "No scores.", "No grade, rating or star on any supplier."],
  ["02", "No paid placement.", "No supplier pays to rank higher or look better."],
  ["03", "No fact without a source and a date.", "If we can’t say where it came from, we don’t show it."],
];
export const TIERS: readonly [tier: string, name: string, list: readonly string[]][] = [
  ["Tier 1", "Government and RSC", ["EPB", "RSC"]],
  ["Tier 2", "Trade bodies", ["BGMEA", "BKMEA", "BTMA", "BGAPMEA"]],
  ["Tier 3", "Certification bodies", ["GOTS", "OEKO-TEX", "WRAP"]],
  ["Tier 4", "Brand supplier lists", ["ASOS", "H&M", "Next"]],
  ["Tier 5", "Foreign regulators", ["UFLPA Entity List · US DHS"]],
];
export const LADDER_NOTE = "Brand lists are named in words, only when the brand names that factory. Foreign regulators are checked against, never used to fill in a record.";

/** The sourcing loop: three steps, the step's screen on the stage; the cursor arrives on the composer and presses Send RFQ. */
function SourcingStage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Every step is in the page; on the full tier the one the scroll is on is ink, the others wait in grey. */}
      <ol data-order-steps className="flex flex-wrap gap-x-8 gap-y-2 text-md text-ink-2">
        {SCREENS.map((s, i) => (
          <li key={s.step} data-on={i === 0 ? "" : undefined} className="group/step flex items-baseline gap-2 film-full:text-ink-3 film-full:transition-colors film-full:duration-slow film-full:data-[on]:text-ink">
            <span className="font-mono text-ink-3">{i + 1}</span>
            <span className={cn(i === 0 && "font-semibold text-ink film-full:font-normal film-full:text-inherit", "film-full:group-data-[on]/step:font-semibold")}>{s.step}</span>
          </li>
        ))}
      </ol>
      <ScreenStage caption={STAGE_CAPTION} data-order-screens="">
        {SCREENS.map((s, i) => (
          <Screen key={s.src} on={i === 0} cursor={s.cursor} focus={s.focus} zoom={s.zoom}>
            <Image src={s.src} alt={s.alt} width={1440} height={900} sizes="(min-width: 1024px) 1320px, 100vw" className="block h-auto w-full" />
          </Screen>
        ))}
      </ScreenStage>
    </div>
  );
}

function ComplianceStage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink-2">{COMPLIANCE_LEDE}</p>
      <ol className="flex flex-wrap gap-x-8 gap-y-2 text-md text-ink-2">
        {COMPLIANCE_STEPS.map((step, i) => (
          <li key={step} className="flex items-baseline gap-2">
            <span className="font-mono text-ink-3">{i + 1}</span>
            <span className={cn(i === 0 && "font-semibold text-ink")}>{step}</span>
          </li>
        ))}
      </ol>
      <ScreenStage caption={STAGE_CAPTION}>
        <Screen on focus={COMPLIANCE_FOCUS} zoom={COMPLIANCE_ZOOM}>
          <Image src={COMPLIANCE_SCREEN.src} alt={COMPLIANCE_SCREEN.alt} width={1440} height={900} sizes="(min-width: 1024px) 1320px, 100vw" className="block h-auto w-full" />
        </Screen>
      </ScreenStage>
    </div>
  );
}

/** The real product, large: the words across the top, the two roles' tabs, and for each its steps and its screens on the night stage. */
export function OrderScene() {
  return (
    <section id="ch-05" data-scene="order" className={cn(SCENE.hold, "film-full:h-[220svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(wrap, "flex flex-col gap-10 film-full:gap-6")}>
          <Header headline="Shortlist. Ask. Compare." lede="Save the suppliers you like. Send one RFQ, and each gets its own copy. The quotes come back side by side." />
          <RoleTabs
            tabs={[
              { key: "sourcing", label: "Sourcing", panel: <SourcingStage /> },
              { key: "compliance", label: "Compliance", panel: <ComplianceStage /> },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

/** A result as the search draws it. Real records, with only the marks the app's own screens show for them. */
const RESULTS: readonly { name: string; line: string; marks: string[]; workers: string }[] = [
  { name: NAME, line: LINE_FULL, marks: ["BGMEA", "GOTS", "RSC"], workers: "4,200" },
  { name: "Aboni Knitwear Ltd", line: "Factory · Savar, Dhaka", marks: ["WRAP"], workers: "3,166" },
  { name: "S M Knitwears Limited", line: "Factory · Gazipur", marks: ["GOTS"], workers: "4,820" },
];
/** One fact, both of its sources and the day each was read. */
const WORKERS: readonly [source: string, tier: string, value: string, read: string][] = [
  ["RSC", "Tier 1", "2,060 workers in 2 buildings", "read 24 Jul 2026"],
  ["BGMEA", "Tier 2", "4,200 employees, as declared by the factory", "read 24 Jul 2026"],
];

/** What another directory would put on the row, struck out: the app never draws it. */
function Never({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-sunken px-2 py-1 text-xs text-ink-3 line-through decoration-ink-2">
      <span className="sr-only">Never shown on SourceBD: </span>
      {children}
    </span>
  );
}

/** Each promise as the app keeps it, one window each; on the full tier the window of the promise the scroll is on shows. */
export const PROMISE_VIEWS: readonly { where: string; label: string; body: ReactNode }[] = [
  {
    where: "Search · knitwear, Gazipur",
    label: "A search result with the registers' facts and no score",
    body: (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-lg font-medium text-ink">{NAME}</p>
            <p className="text-sm text-ink-3">{LINE_FULL}</p>
          </div>
          <Never>
            <Star size={12} weight="fill" aria-hidden />
            4.6 · score 87
          </Never>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip icon={CheckCircle}>BGMEA general member</Chip>
          <CertChip state="valid">GOTS valid until 15 Dec 2026</CertChip>
          <Chip icon={ShieldCheck}>Covered by RSC</Chip>
        </div>
        <p className="border-t border-line pt-3 text-sm text-ink-2">What the registers say, each with its source. No grade, rating or star.</p>
      </div>
    ),
  },
  {
    where: "Search · knitwear · 3 results",
    label: "Search results in the order of the search, with no sponsored row",
    body: (
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-2.5 text-xs text-ink-3">
          <span>Sorted by best match to your search</span>
          <Never>Sponsored</Never>
        </div>
        <ul>
          {RESULTS.map((r) => (
            <li key={r.name} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-medium text-ink">{r.name}</span>
                <span className="text-sm text-ink-3">{r.line}</span>
              </div>
              <span className="flex shrink-0 gap-1">
                {r.marks.map((m) => (
                  <SourceMark key={m} source={m} lazy />
                ))}
              </span>
              <span className="w-24 shrink-0 text-right text-sm text-ink-2 max-sm:hidden">{r.workers} workers</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    where: `Saved · ${NAME} · Workers`,
    label: "One fact with each source and the day it was read",
    body: (
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-ink-3">Workers</p>
        {WORKERS.map(([source, , value, read]) => (
          <div key={source} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
            <SourceMark source={source} lazy />
            <span className="min-w-0 flex-1 text-base text-ink">{value}</span>
            <span className="rounded-sm px-2 py-0.5 text-xs font-medium text-ink ring-1 ring-brand-ink">{source}</span>
            <span className="rounded-sm px-2 py-0.5 font-mono text-xs text-ink ring-1 ring-brand-ink">{read}</span>
          </div>
        ))}
        <div className="pt-1">
          <FactChip state="disagree">2 sources differ</FactChip>
        </div>
      </div>
    ),
  },
];

/** Three things we never do: each promise grey until the scroll reaches it, then ink, and beside it the app showing it kept. */
export function PromisesScene() {
  return (
    <section id="ch-06" data-scene="promises" className={cn(SCENE.hold, "film-full:h-[180svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(wrap, "flex flex-col gap-10 film-full:gap-8")}>
          <Header headline="Three things we never do." lede="We show what the registers say. You decide what it means." />
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
            <ol className="flex flex-col gap-6 lg:w-[420px] lg:shrink-0">
              {PROMISES.map(([n, promise, line]) => (
                <li key={n} data-promise className="group/promise flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-3xl font-semibold tracking-tighter text-ink max-sm:text-2xl film-full:font-medium film-full:leading-[1.06] film-full:tracking-[-0.03em] film-full:text-ink-3 film-full:transition-colors film-full:duration-slow film-full:group-data-[on]/promise:text-ink">{promise}</h3>
                  <p data-beat="" className="text-md text-ink-2">
                    {line}
                  </p>
                </li>
              ))}
            </ol>
            <Stage className="min-w-0 flex-1 p-10 max-md:p-4">
              <div className="flex flex-col gap-6 film-full:grid">
                {PROMISE_VIEWS.map((v, i) => (
                  <div key={v.where} data-promise-view data-on={i === 0 ? "" : undefined} className="film-full:col-start-1 film-full:row-start-1 film-full:invisible film-full:opacity-0 film-full:transition-opacity film-full:duration-slow film-full:data-[on]:visible film-full:data-[on]:opacity-100">
                    <AppWindow where={v.where} label={v.label} className="mx-auto w-full max-w-[640px]">
                      {v.body}
                    </AppWindow>
                  </div>
                ))}
              </div>
            </Stage>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Today's four live figures, each with what it counts; a figure that was not read is left out. */
export function liveFigures(facts: SiteFacts): [figure: string, what: string][] {
  const out: [string, string][] = [];
  if (facts.suppliers !== null) out.push([withCommas(facts.suppliers), "Bangladesh garment suppliers"]);
  if (facts.certificatesOnFile !== null) out.push([withCommas(facts.certificatesOnFile), `certificates on file${facts.certificatesExpired !== null ? `, ${withCommas(facts.certificatesExpired)} already expired` : ""}`]);
  if (facts.sourcesListed !== null) out.push([String(facts.sourcesListed), `sources listed${facts.sourcesWithRecords !== null ? `, ${facts.sourcesWithRecords} hold supplier records` : ""}`]);
  if (facts.rscRecords !== null) out.push([withCommas(facts.rscRecords), "RSC factory records"]);
  return out;
}

/**
 * Why trust it (founder's video: "a lot of branded visuals to represent the SourceBD dashboard"): on the night stage,
 * the source ladder as five rungs with the sources' own marks, the rule shown on one real fact (two sources that
 * differ, the higher first, both shown), and today's figures large under them. A figure that was not read is left
 * out, and with none read the figures are not drawn.
 */
export function TrustScene({ facts }: { facts: SiteFacts }) {
  const figures = liveFigures(facts);
  const updated = readDay(facts.latestRead);
  return (
    <section id="ch-07" className="relative bg-surface py-24 text-ink max-md:py-14">
      <div className={cn(wrap, "flex flex-col gap-10")}>
        <Header headline="Every source has its rank." lede="Government registers come first. A source lower on the ladder never overwrites one above it." />
        <Stage className="p-10 max-md:p-4">
          <div className="flex flex-col gap-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
              {/* The ladder: each rung a little narrower than the one above it. */}
              <ol aria-label="The source ladder, highest first" className="flex flex-col gap-2.5">
                {TIERS.map(([tier, name, list], i) => (
                  <li key={tier} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-ink/[0.06] py-3 pl-5 pr-4 ring-1 ring-inset ring-line sm:w-[var(--rung)] sm:flex-nowrap" style={{ "--rung": `${100 - i * 6}%` } as CSSProperties}>
                    <span className="w-14 shrink-0 font-mono text-xs text-ink-3">{tier}</span>
                    <span className="min-w-0 flex-1 text-base font-semibold text-ink">{name}</span>
                    <span className="flex flex-wrap items-center gap-1 max-sm:basis-full max-sm:pl-[4.5rem] sm:justify-end">
                      {list.map((src) =>
                        hasSourceMark(src) ? (
                          <span key={src} data-ground="day" className="flex rounded-sm bg-surface">
                            <SourceMark source={src} lazy />
                          </span>
                        ) : (
                          <span key={src} className="rounded-sm px-1.5 py-0.5 text-xs text-ink-2 ring-1 ring-inset ring-line">
                            {src}
                          </span>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-4">
                <AppWindow where={`Saved · ${NAME} · Workers`} label="Two sources that differ, the higher one first, both shown" className="w-full">
                  <ul>
                    {WORKERS.map(([source, tier, value], i) => (
                      <li key={source} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                        <SourceMark source={source} lazy />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-xs text-ink-3">
                            {source} · {tier}
                          </span>
                          <span className="text-base text-ink">{value}</span>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-ink-2">{i ? "shown beside it" : "leads"}</span>
                      </li>
                    ))}
                  </ul>
                </AppWindow>
                <p className="text-sm text-ink-2">{LADDER_NOTE}</p>
              </div>
            </div>
            {figures.length ? (
              <ul className="grid gap-8 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
                {figures.map(([figure, what]) => (
                  <li key={what} className="flex flex-col gap-1">
                    <p className="text-5xl font-medium leading-none tracking-[-0.035em] text-ink max-sm:text-4xl">{figure}</p>
                    <p className="text-base text-ink-2">{what}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="flex flex-wrap items-baseline gap-x-3 text-md">
              {updated ? <span className="text-sm text-ink-3">Updated {updated}</span> : null}
              <Link href="/methodology" prefetch={false} className="link font-medium">
                See all {facts.sourcesListed ?? "the"} sources and how we check them
              </Link>
            </p>
          </div>
        </Stage>
      </div>
    </section>
  );
}

/** The close: night again, the planet back behind the way in. The page's last words and its search. */
export function CloseScene({ count }: { count: string | null }) {
  return (
    <section id="ch-08" data-scene="close" data-ground="night" className={cn(SCENE.hold, "film-full:h-[160svh]")}>
      <div className={cn(SCENE.stage, "film-full:isolate film-full:items-center film-full:overflow-hidden film-full:pt-0")}>
        {/* The planet's canvas moves in here (engine/start.ts) when the scene before has run its hold, and back when it has not. */}
        <div data-planet-close aria-hidden className="absolute inset-0 hidden film-full:block" />
        <div className={cn(wrap, "relative flex flex-col items-start gap-8")}>
          <h2 className="max-w-[820px] text-film-scene-phone font-medium leading-[1.02] tracking-[-0.035em] text-ink [text-wrap:balance] md:text-display-1">Now you know who you&rsquo;re buying from.</h2>
          <Lede className="max-w-[520px]">{count ? `Do the same for any of ${count} suppliers. Search is free.` : "Do the same for any supplier. Search is free."}</Lede>
          <SearchField id="close-q" material="glass" />
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
              Start free
            </ButtonLink>
            <ButtonLink href="/contact" prefetch={false} kind="secondary" size="lg" className="max-sm:h-input-touch">
              Book a demo
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
