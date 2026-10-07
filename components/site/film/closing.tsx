// The film's end (handoff-home-film §3.8, §4, rebuilt after the founder's video of 7 Oct 2026): "Shortlist. Ask.
// Compare.", the real product on a stage; "Three things we never do."; "Every source has its rank." with the live
// figures under it; and the close, night again, where the planet comes back behind the way in. Server-rendered,
// every word in the page on every tier; the engine moves them on the full tier only (engine/chapters.ts). The
// whole-record card and the thread that ended in it are gone.

import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { ButtonLink } from "@/components/kit";
import { SCENE } from "@/components/site/film/chapters";
import { Screen, ScreenStage, SearchField } from "@/components/site/film/pane";
import { NAME } from "@/components/site/film/record";
import { Words } from "@/components/site/film/words";
import { Lede, wrap } from "@/components/site/parts";
import { RoleTabs } from "@/components/site/role-tabs";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

/** Chapter 07's three steps, each a real v4 screen: the Saved page, the RFQ composer (where the cursor presses Send RFQ), the quotes. */
export const SCREENS: readonly { src: string; alt: string; step: string; cursor?: { x: number; y: number }; focus: { x: number; y: number } }[] = [
  { src: "/site/saved-selected.png", alt: "The Saved page with three suppliers picked, and the bar offering one RFQ to all three.", step: "Shortlist from your saved suppliers", focus: { x: 62, y: 38 } },
  { src: "/site/rfq-one.png", alt: `The RFQ composer: one RFQ to ${NAME}, filled in, with Send RFQ ready to press.`, step: "Send one RFQ", cursor: { x: 92.6, y: 95.5 }, focus: { x: 48, y: 55 } },
  { src: "/site/rfq-quotes.png", alt: "The RFQ's quotes, side by side.", step: "Compare the quotes", focus: { x: 42, y: 45 } },
];
/** Where the compliance screen is looked at on a narrow window: the certificates that need a look. */
const COMPLIANCE_FOCUS = { x: 45, y: 45 } as const;
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
          <Screen key={s.src} on={i === 0} cursor={s.cursor} focus={s.focus}>
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
        <Screen on focus={COMPLIANCE_FOCUS}>
          <Image src={COMPLIANCE_SCREEN.src} alt={COMPLIANCE_SCREEN.alt} width={1440} height={900} sizes="(min-width: 1024px) 720px, 100vw" className="block h-auto w-full" />
        </Screen>
      </ScreenStage>
    </div>
  );
}

/** 09 · the real product, large: three steps and the screen for each on a staged window; the two roles' tabs both in the page. */
export function OrderScene() {
  return (
    <section id="ch-05" data-scene="order" className={cn(SCENE.hold, "film-full:h-[260svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(SCENE.row, "film-full:lg:items-center")}>
          <div className={cn(SCENE.left, "lg:max-w-[400px]")}>
            <Words headline="Shortlist. Ask. Compare." lede="Save the suppliers you like. Send one RFQ, and each gets its own copy. The quotes come back side by side." />
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
    <section id="ch-06" data-scene="promises" className={cn(SCENE.hold, "film-full:h-[200svh]")}>
      <div className={SCENE.stage}>
        <div className={cn(wrap, "flex flex-col gap-12")}>
          <Words headline="Three things we never do." lede="We show what the registers say. You decide what it means." />
          <ol className="flex flex-col gap-6">
            {PROMISES.map(([n, promise, line]) => (
              <li key={n} data-promise className="group/promise flex flex-col gap-2 border-t border-line pt-4 md:flex-row md:items-baseline md:gap-10">
                <h3 className="text-3xl font-semibold tracking-tighter text-ink max-sm:text-2xl md:flex-1 film-full:text-film-scene film-full:font-medium film-full:leading-[1.06] film-full:tracking-[-0.03em] film-full:text-ink-3 film-full:transition-colors film-full:duration-slow film-full:group-data-[on]/promise:text-ink">{promise}</h3>
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
 * Why trust it: the source ladder, its five rungs in rank order, and the live figures under it, as one scene. Plain
 * here; its own drawing comes with the next pass. A figure that was not read is left out, and with none read the
 * figures are not drawn.
 */
export function TrustScene({ facts }: { facts: SiteFacts }) {
  const figures = liveFigures(facts);
  const updated = readDay(facts.latestRead);
  return (
    <section id="ch-07" className="relative bg-surface py-24 text-ink max-md:py-14">
      <div className={cn(wrap, "flex flex-col gap-12")}>
        <Words headline="Every source has its rank." lede="Government registers come first. A source lower on the ladder never overwrites one above it." />
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
        {figures.length ? (
          <ul className="grid gap-8 md:grid-cols-4">
            {figures.map(([figure, what]) => (
              <li key={what} className="flex flex-col gap-1 border-t border-line pt-3">
                <p className="text-3xl font-medium tracking-[-0.03em] text-ink">{figure}</p>
                <p className="text-base text-ink-2">{what}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="flex flex-wrap items-baseline gap-x-3 text-md">
          {updated ? <span className="font-mono text-xs text-ink-3">Updated {updated}</span> : null}
          <Link href="/methodology" prefetch={false} className="link font-medium">
            See all {facts.sourcesListed ?? "the"} sources and how we check them
          </Link>
        </p>
      </div>
    </section>
  );
}

/** The close: night again, the planet back behind the way in. The page's last words and its search. */
export function CloseScene({ count }: { count: string | null }) {
  return (
    <section id="ch-08" data-scene="close" data-ground="night" className={cn(SCENE.hold, "film-full:h-[200svh]")}>
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
