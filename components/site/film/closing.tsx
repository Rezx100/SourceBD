// Scenes 09 to 12 (handoff-home-film §3.8, §4): "07 · Can they make my order?", where the real product stands
// staged on an atmosphere, three steps and a drawn cursor that presses Send RFQ; "08 · Why should I trust you?",
// where the three promises turn from grey to ink at poster size, the source ladder's rungs arrive in rank order
// and the live figures rise whole; and "09 · The whole record", night again, where the planet comes back, the
// whole record stitches on row by row and the thread ends in a bartack at the RFQ. Server-rendered, every word in
// the page on every tier; the engine moves them on the full tier only (engine/chapters.ts). The words are today's;
// the promises, the ladder and the screens' words are the same data the page without the film draws.

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { SCENE } from "@/components/site/film/chapters";
import { FieldPane, RecordPane, Screen, ScreenStage } from "@/components/site/film/pane";
import { BGMEA, EXPORTS, GOTS, NAME, RFQ, SAFETY, SITE, SOURCES, UFLPA } from "@/components/site/film/record";
import { Thread, ThreadLayer } from "@/components/site/film/thread";
import { Words } from "@/components/site/film/words";
import { Display, Lede, wrap } from "@/components/site/parts";
import { RoleTabs } from "@/components/site/role-tabs";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/** Chapter 07's three steps, each a real v4 screen: the Saved page, the RFQ composer (where the cursor presses Send RFQ), the quotes. */
export const SCREENS: readonly { src: string; alt: string; step: string; cursor?: { x: number; y: number } }[] = [
  { src: "/site/saved-selected.png", alt: "The Saved page with three suppliers picked, and the bar offering one RFQ to all three.", step: "Shortlist from your saved suppliers" },
  { src: "/site/rfq-one.png", alt: `The RFQ composer: one RFQ to ${NAME}, filled in, with Send RFQ ready to press.`, step: "Send one RFQ", cursor: { x: 92.6, y: 95.5 } },
  { src: "/site/rfq-quotes.png", alt: "The RFQ's quotes, side by side.", step: "Compare the quotes" },
];
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

/**
 * The atmosphere behind the screens (§3.8), drawn here until a generated one is granted: near-monochrome, low
 * contrast, no people, no logos, no text. A weave of fine diagonal lines in the ground's own roles, two soft
 * pools of light and shade, and one green thread in soft focus. Decoration.
 */
export function Atmosphere() {
  // Ids of this instance's own: the page draws one stage per role, and a reference to a `<defs>` in a hidden panel would draw nothing.
  const id = useId();
  const weave = `${id}w`, soft = `${id}s`, thread = `${id}t`;
  return (
    <svg aria-hidden viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="block">
      <defs>
        <pattern id={weave} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
          <path d="M0 7H14" className="stroke-line" strokeWidth={0.8} />
        </pattern>
        <filter id={soft} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
        <filter id={thread} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <rect width="800" height="500" className="fill-subtle" />
      <rect width="800" height="500" fill={`url(#${weave})`} opacity={0.55} />
      <ellipse cx="190" cy="120" rx="300" ry="170" className="fill-surface" opacity={0.7} filter={`url(#${soft})`} />
      <ellipse cx="660" cy="420" rx="320" ry="190" className="fill-sunken" opacity={0.85} filter={`url(#${soft})`} />
      <path d="M-20 390C180 330 300 470 470 380S720 250 830 320" className="fill-none stroke-brand-ink" strokeWidth={2.4} strokeLinecap="round" opacity={0.42} filter={`url(#${thread})`} />
    </svg>
  );
}

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
      <ScreenStage atmosphere={<Atmosphere />} caption={STAGE_CAPTION} data-order-screens="">
        {SCREENS.map((s, i) => (
          <Screen key={s.src} on={i === 0} cursor={s.cursor}>
            <Image src={s.src} alt={s.alt} width={1440} height={900} sizes="(min-width: 1024px) 720px, 100vw" className="block h-auto w-full" />
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
      <ScreenStage atmosphere={<Atmosphere />} caption={STAGE_CAPTION}>
        <Screen on>
          <Image src={COMPLIANCE_SCREEN.src} alt={COMPLIANCE_SCREEN.alt} width={1440} height={900} sizes="(min-width: 1024px) 720px, 100vw" className="block h-auto w-full" />
        </Screen>
      </ScreenStage>
    </div>
  );
}

/** 09 · the real product, large: three steps and the screen for each on a staged window; the two roles' tabs both in the page. */
export function OrderScene() {
  return (
    <section id="ch-7" data-scene="order" data-chapter="ch-7" className={cn(SCENE.hold, "film-full:h-[420svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(SCENE.row, "film-full:lg:items-center")}>
          <div className={cn(SCENE.left, "lg:max-w-[400px]")}>
            <Words label="07 · Can they make my order?" headline="Shortlist. Ask. Compare." lede="Save the suppliers you like. Send one RFQ, and each gets its own copy. The quotes come back side by side." />
          </div>
          <div className="w-full min-w-0 lg:max-w-[760px]">
            <RoleTabs
              tabs={[
                { key: "sourcing", label: "Sourcing", panel: <SourcingStage /> },
                { key: "compliance", label: "Compliance", panel: <ComplianceStage /> },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** 10 · the three promises at poster size: grey until the scroll reaches each, then ink, its line beside it. */
export function PromisesScene() {
  return (
    <section id="ch-8" data-scene="promises" data-chapter="ch-8" className={cn(SCENE.hold, "film-full:h-[360svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(wrap, "flex flex-col gap-12")}>
          <Words label="08 · Why should I trust you?" headline="Three things we never do." lede="We show what the registers say. You decide what it means." />
          <ol className="flex flex-col gap-6">
            {PROMISES.map(([n, promise, line]) => (
              <li key={n} data-promise className="group/promise flex flex-col gap-2 border-t border-ink pt-4 md:flex-row md:items-baseline md:gap-10">
                <span className="font-mono text-base text-ink-3 md:w-10 md:shrink-0">{n}</span>
                <h3 className="text-3xl font-semibold tracking-tighter text-ink max-sm:text-2xl md:flex-1 film-full:text-film-scene film-full:leading-[1.06] film-full:tracking-[-0.025em] film-full:text-ink-3 film-full:transition-colors film-full:duration-slow film-full:group-data-[on]/promise:text-ink">{promise}</h3>
                <p data-beat="" className="text-md text-ink-2 md:w-[300px] md:shrink-0">
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** The source ladder, between 10 and 11, as it is today: its five rungs arrive in rank order. */
export function LadderScene({ facts }: { facts: SiteFacts }) {
  return (
    <section data-scene="ladder" data-chapter="ch-8" className={cn(SCENE.hold, "film-full:h-[260svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(wrap, "flex flex-col gap-10")}>
          <div className="flex flex-col gap-4">
            <Display>Every source has its rank.</Display>
            <Lede>Government registers come first. A source lower on the ladder never overwrites one above it.</Lede>
          </div>
          <ol className="grid gap-6 md:grid-cols-5">
            {TIERS.map(([t, n, list]) => (
              <li key={t} data-beat="" className="flex flex-col gap-2 border-t border-line pt-3">
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

/** 11 · the numbers, as they stand: the live figures rise whole, one after another, never counting up. None was read: no scene. */
export function FiguresScene({ facts }: { facts: SiteFacts }) {
  const figures = liveFigures(facts);
  const updated = readDay(facts.latestRead);
  if (!figures.length) return null;
  return (
    <section data-scene="figures" data-chapter="ch-8" className={cn(SCENE.hold, "film-full:h-[400svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(SCENE.row, "film-full:lg:items-center")}>
          <div className={cn(SCENE.left, "lg:max-w-[400px]")}>
            <Words label="08 · Why should I trust you?" headline="The numbers, as they stand." lede="Counted straight from our records, not rounded. The date says when." />
            {updated ? <p className="font-mono text-xs text-ink-3">Updated {updated} · latest register read {updated}</p> : null}
          </div>
          <ul className="flex w-full flex-col gap-3 lg:max-w-[720px]">
            {figures.map(([figure, what]) => (
              <li key={what} data-beat="" className="flex flex-col gap-1 border-t border-line pt-3 md:flex-row md:items-baseline md:gap-6">
                <p className="film-figure-fit font-mono text-3xl font-semibold tracking-tight text-ink max-sm:text-2xl film-full:font-sans film-full:tracking-[-0.04em]">{figure}</p>
                <p className="text-md text-ink-2 md:max-w-[300px]">{what}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The whole record's rows, in the order the chapters added them, the RFQ last. */
export const WHOLE_RECORD = [SOURCES, BGMEA, GOTS, SAFETY, SITE, EXPORTS, UFLPA, RFQ] as const;

/** 12 · the whole record, and the way in: night again, the planet back as the ground, every row stitching on, the thread ending in a bartack at the RFQ, the search. */
export function CloseScene() {
  return (
    <section id="ch-9" data-scene="close" data-chapter="ch-9" data-ground="night" className={cn(SCENE.hold, "film-full:h-[520svh]")}>
      <div className={cn(SCENE.stage, "film-full:isolate film-full:overflow-hidden")}>
        {/* The planet's canvas moves in here (engine/start.ts) when scene 11 has run its hold, and back when it has not. */}
        <div data-planet-close aria-hidden className="absolute inset-0 hidden film-full:block" />
        <div className={cn(SCENE.row, "relative")}>
          <div className={cn(SCENE.left, "lg:max-w-[560px]")}>
            <Words label="09 · The whole record" headline="Every row, with its source." lede="Who they are, what is true, where they are, who they ship to, and what to watch. Then you send the RFQ." />
            <div className="flex w-full max-w-[560px] flex-col gap-2">
              <FieldPane id="close-q" material="glass" />
              <p className="text-md text-ink-3">Try &ldquo;knit dresses Gazipur&rdquo; or &ldquo;GOTS&rdquo;</p>
            </div>
          </div>
          {/* Glass: the planet is live under it. Every row is a beat: the record fills top to bottom as the scroll moves. */}
          <div className="flex w-full max-w-[400px] flex-col gap-6 lg:shrink-0">
            <RecordPane material="glass" name={NAME} line="Factory · Kashimpur, Gazipur" state="Saved · watching" rows={WHOLE_RECORD.map((r) => ({ ...r, beat: true }))} />
          </div>
        </div>
        {/* From the planet's light down to the RFQ row; the engine lays it on every frame the planet draws, and sets the bartack at the row. */}
        <ThreadLayer viewBox="0 0 1 1" className="hidden film-full:block">
          <g data-tie>
            <Thread d="M0 0" join end={{ x: 0, y: 0 }} />
          </g>
        </ThreadLayer>
      </div>
    </section>
  );
}
