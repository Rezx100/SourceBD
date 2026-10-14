"use client";

// The four vignettes (handoff-mercury-motion-sitewide.md §4.3): each loops one small moment of the product. An expiry
// chip counting down a real certificate's days (the chip's own words at each day); a record's source marks settling
// in tier order; two example quotes landing; a sanctioned row turning maroon as Send RFQ is refused. The certificate
// and the sources are the snapshot's; the sanctioned company is the site's placeholder, never a real one.

import type { ReactNode } from "react";
import { CertChip, buttonClass } from "@/components/kit";
import { Refusal, SanctionTag, SourceChip, TIER_LABEL, tierOf } from "@/components/patterns";
import { certWords, usd, vsTarget } from "@/components/patterns/words";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName, formatDay } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import { SANCTIONED_SAMPLE, SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Demo, streamed } from "./stage";

const { check, saved } = SNAPSHOT;

/* ------------------------------------------------------------------ an expiry chip counting days */

/** The certificate on the saved records that ends soonest after the read: a real date, counted down day by day. */
const SOON = saved
  .flatMap((r) => r.certs.filter((c) => c.expiresOn && c.expiresOn >= SNAPSHOT.readAt).map((c) => ({ supplier: displayName(r.name), cert: certName(c.kind, c.number), expiresOn: c.expiresOn! })))
  .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0] ?? null;

type E = CursorState & { daysLeft: number };
const DAYS = [30, 21, 14, 7, 3, 1, 0];
const dayBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000);
export const EXPIRY_STEPS: Step<E>[] = DAYS.map((d, i) => ({ at: i * 900, state: { daysLeft: d } }));

export function VignetteExpiry({ className }: { className?: string }) {
  if (!SOON) return null;
  return (
    <Demo steps={EXPIRY_STEPS} description={`${SOON.supplier}'s ${SOON.cert} ends ${formatDay(SOON.expiresOn)}: the chip counts the days down as they pass.`} className={className}>
      {(s) => {
        const w = certWords(SOON.expiresOn, dayBefore(SOON.expiresOn, s.daysLeft));
        return (
          <Small>
            <p className="text-sm font-medium text-ink">{SOON.supplier}</p>
            <p className="text-xs text-ink-3">{SOON.cert}</p>
            <CertChip key={w.label} state={w.state} className="mt-2 animate-swap-in motion-reduce:animate-none">
              {w.label}
            </CertChip>
          </Small>
        );
      }}
    </Demo>
  );
}

/* ------------------------------------------------------------------ a source mark stack settling */

const SOURCES = [...check.sources].sort((a, b) => tierOf(a) - tierOf(b));
type M = CursorState & { shown: number };
export const MARKS_STEPS: Step<M>[] = [{ at: 0, state: { shown: 0 } }, ...streamed(SOURCES.length, 500, (shown) => ({ shown }))];

export function VignetteMarks({ className }: { className?: string }) {
  return (
    <Demo steps={MARKS_STEPS} description={`${displayName(check.name)} is listed by ${SOURCES.length} sources, each mark arriving in tier order.`} className={className}>
      {(s) => (
        <Small>
          <p className="text-sm font-medium text-ink">{displayName(check.name)}</p>
          <p className="text-xs text-ink-3">
            {s.shown} of {SOURCES.length} sources
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {SOURCES.slice(0, s.shown).map((code) => (
              <span key={code} className="animate-swap-in motion-reduce:animate-none" title={TIER_LABEL[tierOf(code)]}>
                <SourceChip source={code} name={code.replace(/^BRAND_/, "").replace("HM", "H&M")} />
              </span>
            ))}
          </div>
        </Small>
      )}
    </Demo>
  );
}

/* ------------------------------------------------------------------ quotes landing */

const QUOTED = SNAPSHOT.search.rows.slice(0, 2).map((r) => displayName(r.name));
const TARGET = 6.5;
const LANDING = [
  { supplier: QUOTED[0]!, price: 6.15 },
  { supplier: QUOTED[1]!, price: 6.9 },
];
type Q = CursorState & { landed: number };
export const QUOTES_STEPS: Step<Q>[] = [
  { at: 0, state: { landed: 0 } },
  { at: 900, state: { landed: 1 } },
  { at: 2200, state: { landed: 2 } },
];

export function VignetteQuotes({ className }: { className?: string }) {
  return (
    <Demo steps={QUOTES_STEPS} description="Two example quotes landing beside each other, each against the target price." className={className}>
      {(s) => (
        <Small>
          <p className="text-sm font-medium text-ink">Example quotes</p>
          <p className="text-xs text-ink-3">target {usd(TARGET)} per piece · the suppliers are real, the figures are examples</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {LANDING.slice(0, s.landed).map((q) => (
              <li key={q.supplier} className="flex animate-swap-in items-baseline justify-between gap-3 rounded-md border border-line px-3 py-2 motion-reduce:animate-none">
                <span className="truncate text-sm font-medium text-ink">{q.supplier}</span>
                <span className="shrink-0 text-sm tabular-nums text-ink">
                  <span className="font-semibold">{usd(q.price)}</span> <span className="text-ink-3">· {vsTarget(q.price, TARGET)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Small>
      )}
    </Demo>
  );
}

/* ------------------------------------------------------------------ a sanction row turning maroon */

type X = CursorState & { listed: boolean };
export const SANCTION_STEPS: Step<X>[] = [
  { at: 0, state: { listed: false } },
  { at: 1800, state: { listed: true } },
];

export function VignetteSanction({ className }: { className?: string }) {
  return (
    <Demo steps={SANCTION_STEPS} description={`A placeholder supplier, ${SANCTIONED_SAMPLE}, turning maroon as it appears on the UFLPA Entity List, with Send RFQ refused.`} className={className}>
      {(s) => (
        <Small className={cn("transition-colors duration-slow", s.listed && "border-l-2 border-l-sanction bg-sanction-tint")}>
          <p className="text-sm font-medium text-ink">{SANCTIONED_SAMPLE}</p>
          <p className="text-xs text-ink-3">Factory · placeholder</p>
          <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
            {s.listed ? <SanctionTag list="UFLPA Entity List" /> : <span className="text-xs text-ink-3">Not on any list read</span>}
            {s.listed ? <Refusal className="text-sm" /> : <span className={buttonClass({ kind: "primary" })}>Send RFQ</span>}
          </div>
        </Small>
      )}
    </Demo>
  );
}

/** A vignette's window: small, the product's light ground, one moment inside. */
function Small({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-ground="day" className={cn("flex min-h-[168px] flex-col rounded-frame border border-ink-strong/10 bg-surface p-4 text-ink shadow-md", className)}>{children}</div>;
}

/** Every vignette, for the grid and the gallery. */
export const VIGNETTES = [
  { key: "expiry", title: "Every certificate carries its date", body: "The chip counts down; at 90 days the record and the Compliance hub both say so.", Demo: VignetteExpiry, names: SOON ? [SOON.supplier] : [] },
  { key: "marks", title: "Every source, in trust order", body: "Government and RSC first, then the trade bodies, then the certifiers, then brand lists.", Demo: VignetteMarks, names: [displayName(check.name)] },
  { key: "quotes", title: "Quotes land beside each other", body: "Each against your target, with the record a click away.", Demo: VignetteQuotes, names: QUOTED },
  { key: "sanction", title: "A listing is never hidden by layout", body: "The row turns maroon on every surface and Send RFQ is refused in words.", Demo: VignetteSanction, names: [SANCTIONED_SAMPLE] },
] as const;

/** Every company the vignettes name. */
export const NAMES = VIGNETTES.flatMap((v) => v.names);
