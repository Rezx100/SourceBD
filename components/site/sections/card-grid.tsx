"use client";

// The home page's two grids of four, mercury.com's "Banking's been a headache" and "Run your business like a seasoned
// pro" (the founder's walkthrough of 23 Oct 2026, measured at 1440): a hairline rule, the headline under it, then two
// by two the cards (496 × 331, a 12 px radius, the ground's raised panel), each a walk through the real app cut as the
// tour's dark flows are (`Clip`, PROVENANCE.md; founder, 24 Oct 2026): one window at the app's own size from the card's
// top left, the same in every card, sharp where it reads and falling into a blur, its name and its line under it. The
// four start two seconds apart so only one moves strongly at a time. The first grid stands on the warm ground, the
// second on the day.

import type { ReactNode } from "react";
import type { HomeGround } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { Clip } from "./browser";
import { column, rule } from "./ui";

/** A card: its words, and its clip (`clip-<clip>`) with the sentence a screen reader gets in its place. */
export type GridCard = { title: string; body: string; clip: string; says: string };

/** The rule and the headline over a home section's cards. */
export function SectionHead({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn(rule, "pt-6", className)}>
      <h2 id={id} className="max-w-[672px] font-display text-site-section-sm text-ink [text-wrap:balance] md:text-site-section">
        {children}
      </h2>
    </div>
  );
}

/** A card's name and its line, under its picture. */
export function CardWords({ title, body }: { title: ReactNode; body: ReactNode }) {
  return (
    <div className="mt-3 flex flex-col">
      <h3 className="font-display text-site-card text-ink">{title}</h3>
      {body ? <p className="font-book text-site-card text-ink-2">{body}</p> : null}
    </div>
  );
}

export function CardGrid({ id, tone, heading, cards }: { id: string; tone: HomeGround; heading: ReactNode; cards: readonly GridCard[] }) {
  return (
    <section data-mk-tone={tone} aria-labelledby={id} className="pb-16 pt-14 md:pb-12 md:pt-[72px]">
      <div className={column}>
        <SectionHead id={id}>{heading}</SectionHead>
        <ul className="mt-8 grid gap-x-8 gap-y-10 md:mt-10 md:grid-cols-2">
          {cards.map((c, i) => (
            <li key={c.title} className="flex flex-col">
              <div className="relative aspect-[496/331] overflow-hidden rounded-frame bg-sunken">
                <Clip name={c.clip} says={c.says} delay={i * 2000} />
              </div>
              <CardWords title={c.title} body={c.body} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The first grid, on the warm ground: four parts of a record that used to take a chase. */
export const HEAD_START: readonly GridCard[] = [
  {
    title: "Filter the way you buy",
    body: "Tick the certificate you need and the list narrows to the suppliers that hold it, the count changing as you tick.",
    clip: "filters",
    says: "The search's Certificates menu: GOTS is ticked and 10,048 suppliers narrow to the 581 holding a valid GOTS certificate.",
  },
  {
    title: "See who they already make for",
    body: "Every record names the brands a factory ships to, from the brands' own supplier lists and from export shipment records.",
    clip: "buyers",
    says: "Aboni Knitwear's buyers: ASOS, H&M and NEXT from the brands' own supplier lists, Inditex, NEW Yorker, Outerstuff, Style Revolution and Tesco from export shipment records.",
  },
  {
    title: "Know where their goods go",
    body: "Export shipment records by market, then the latest shipments, each with its date, its goods, its buyer and its value.",
    clip: "shipments",
    says: "Aboni Knitwear's exports by market, 62% of their value to the European Union, then its latest shipments, each with its date, goods, buyer and value.",
  },
  {
    title: "Every certificate, with its dates",
    body: "Each certificate's number, its certifier and the day it lapses, read from the body that issued it. An expired one says so.",
    clip: "certificates",
    says: "Aboni Knitwear's four current certificates, OEKO-TEX, two GOTS and WRAP, each with its number, its issuer and its date, and a GOTS that ended on 4 Apr 2026.",
  },
];

/** The second grid, on the day ground: the rest of a record, for the desk that checks it. */
export const SEASONED: readonly GridCard[] = [
  {
    title: "Size them up in one look",
    body: "Factory types, workforce, women and men, sewing machines and capacity, each from the register that filed it.",
    clip: "keyfacts",
    says: "Aboni Knitwear's key facts: dyeing, knit, packaging and woven; 3,314 workers, 1,558 women and 1,756 men; 850 sewing machines; 1,000,000 pieces a month.",
  },
  {
    title: "Every membership, from its register",
    body: "EPB, BGMEA, BKMEA and BGAPMEA numbers, each read from the body that holds it.",
    clip: "memberships",
    says: "Aboni Knitwear's memberships: EPB BD04293, BGAPMEA 597, BGMEA General 3498 and BKMEA 625 - B/2002, each with the day it was read.",
  },
  {
    title: "Safety, as RSC found it",
    body: "RSC inspections, how much of each remediation plan is fixed, and the inspection reports to open.",
    clip: "safety",
    says: "Aboni Knitwear's two buildings in the RSC programme: 100% of safety issues fixed, the initial plan completed, worker safety training completed, and the fire, structural, electrical and boiler reports.",
  },
  {
    title: "Every source, in trust order",
    body: "The government register first, then RSC, the industry bodies, the certifiers, the brands' own lists and export shipment records.",
    clip: "sources",
    says: "Aboni Knitwear's eleven sources in trust order: EPB; RSC; BGAPMEA, BGMEA and BKMEA; GOTS, OEKO-TEX and WRAP; ASOS, H&M and NEXT's lists; Bangladesh export shipments.",
  },
];
