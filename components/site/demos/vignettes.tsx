"use client";

// The vignettes (handoff-mercury-motion-sitewide.md §4.3): each loops one small moment of the product. The home's four:
// an expiry chip counting down a real certificate's days (the chip's own words at each day); a record's source marks
// settling in tier order; two example quotes landing; a sanctioned row turning maroon as Send RFQ is refused. Two
// more for the product pages (M4): a search typed and its first rows arriving (the cross-sell's loop for search), and
// three of a record's facts landing with their receipts (the records page's "sources in words"). The certificate,
// the sources and the facts are the snapshot's; the sanctioned company is the site's example, never a real one, and
// its name says so.

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { CertChip, buttonClass } from "@/components/kit";
import { Refusal, SanctionTag, SourceChip, SourceLine, TIER_LABEL, tierOf } from "@/components/patterns";
import { certWords, usd, vsTarget } from "@/components/patterns/words";
import type { CursorState, Step } from "@/components/site/motion";
import { daysUntil, displayName, formatDay } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import { BRAND_LIST, CERT_REGISTER, SANCTIONED_SAMPLE, SNAPSHOT, TODAY, sourcesCaption } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Chip, Demo, endOf, streamed, typed, type Frame } from "./stage";

const { check, saved, search } = SNAPSHOT;

/* ------------------------------------------------------------------ an expiry chip counting days */

/** The certificate on the saved records that ends soonest after the read: a real date, counted down day by day. */
const SOON = saved
  .flatMap((r) => r.certs.filter((c) => c.expiresOn && c.expiresOn >= SNAPSHOT.readAt).map((c) => ({ supplier: displayName(r.name), cert: certName(c.kind, c.number), expiresOn: c.expiresOn! })))
  .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0] ?? null;

type E = CursorState & { daysLeft: number };
/** The days the chip counts down through, ending on the certificate's real state on the day of the read (the server's step). */
const LEFT = SOON ? (daysUntil(SOON.expiresOn, TODAY) ?? 0) : 0;
const DAYS = [...[30, 21, 14, 7, 3, 1].filter((d) => d > LEFT), LEFT];
const dayBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000);
export const EXPIRY_STEPS: Step<E>[] = DAYS.map((d, i) => ({ at: i * 900, state: { daysLeft: d } }));

export function VignetteExpiry(frame: Frame) {
  if (!SOON) return null;
  return (
    <Demo {...frame} steps={EXPIRY_STEPS} description={`${SOON.supplier}'s ${SOON.cert} ends ${formatDay(SOON.expiresOn)}: the chip counts the days down as they pass.`}>
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
/** The product's caption for a record's sources: registers and certifiers, brand lists apart. */
const SOURCES_CAPTION = sourcesCaption(check);
type M = CursorState & { shown: number };
export const MARKS_STEPS: Step<M>[] = [{ at: 0, state: { shown: 0 } }, ...streamed(SOURCES.length, 500, (shown) => ({ shown }))];

export function VignetteMarks(frame: Frame) {
  return (
    <Demo {...frame} steps={MARKS_STEPS} description={`${displayName(check.name)} is listed by ${SOURCES_CAPTION}, each arriving in tier order.`}>
      {(s) => (
        <Small>
          <p className="text-sm font-medium text-ink">{displayName(check.name)}</p>
          <p className="text-xs text-ink-3">{SOURCES_CAPTION}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {SOURCES.map((code, i) => (
              <span key={code} className={cn(fading, i >= s.shown && "opacity-40")} title={TIER_LABEL[tierOf(code)]}>
                {/* A brand list has no mark of its own: its name in a chip, never a placeholder glyph (critique 22 Oct). */}
                {BRAND_LIST[code] ? <span className="inline-flex h-6 items-center rounded-md border border-line px-2 text-xs font-medium text-ink-2">{BRAND_LIST[code]}</span> : <SourceChip source={code} name={code} />}
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

export function VignetteQuotes(frame: Frame) {
  return (
    <Demo {...frame} steps={QUOTES_STEPS} description="Two example quotes landing beside each other, each against the target price.">
      {(s) => (
        <Small>
          <p className="text-sm font-medium text-ink">Example quotes</p>
          <p className="text-xs text-ink-3">target {usd(TARGET)} per piece · the suppliers are real, the figures are examples</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {LANDING.map((q, i) => (
              <li key={q.supplier} className={cn("flex items-baseline justify-between gap-3 rounded-md border border-line px-3 py-2", fading, i >= s.landed && "opacity-40")}>
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


export function VignetteSanction(frame: Frame) {
  return (
    <Demo {...frame} steps={SANCTION_STEPS} description={`An example company, ${SANCTIONED_SAMPLE}, turning maroon as it appears on the UFLPA Entity List, with Send RFQ refused.`}>
      {(s) => (
        <Small className={cn("transition-colors duration-slow", s.listed && "border-l-2 border-l-sanction bg-sanction-tint")}>
          <p className="text-sm font-medium text-ink">{SANCTIONED_SAMPLE}</p>
          <p className="text-xs text-ink-3">Factory</p>
          <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
            {s.listed ? <SanctionTag list="UFLPA Entity List" /> : <span className="text-xs text-ink-3">Not on any list read</span>}
            {s.listed ? <Refusal className="text-sm" /> : <span className={buttonClass({ kind: "primary" })}>Send RFQ</span>}
          </div>
        </Small>
      )}
    </Demo>
  );
}

/* ------------------------------------------------------------------ a search typed, its first rows arriving (M4) */

const QUERY = search.chips.join(" ");
const FOUND = search.rows.slice(0, 3).map((r) => ({ slug: r.slug, name: displayName(r.name), line: [r.type, r.place].filter(Boolean).join(" · ") }));
type F = CursorState & { typed: string; chips: boolean; rows: number };
const found = (over: Partial<F>): F => ({ typed: QUERY, chips: true, rows: FOUND.length, ...over });
const typing = typed(QUERY, 400, (t) => found({ typed: t, chips: false, rows: 0 }));
const foundAt = endOf(typing) + 500;
export const SEARCH_STEPS: Step<F>[] = [{ at: 0, state: found({ typed: "", chips: false, rows: 0 }) }, ...typing, { at: foundAt, state: found({ rows: 0 }) }, ...streamed(FOUND.length, foundAt + 400, (rows) => found({ rows }))];

/** Every company the search vignette names. */
export const SEARCH_NAMES = FOUND.map((r) => r.name);

export function VignetteSearch(frame: Frame) {
  return (
    <Demo {...frame} steps={SEARCH_STEPS} description={`A search for ${QUERY} typed, its filter chips, and the first three suppliers found.`}>
      {(s) => (
        <Small>
          <p className="flex items-center gap-2 text-sm">
            <MagnifyingGlass size={14} className="shrink-0 text-ink-3" aria-hidden />
            <span className={cn("truncate", s.typed ? "font-medium text-ink" : "text-ink-3")}>{s.typed || "Supplier, product or certificate"}</span>
            {s.typed && !s.chips ? <span aria-hidden className="h-4 w-px animate-pulse bg-ink" /> : null}
          </p>
          <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
            {s.chips
              ? search.chips.map((c) => <Chip key={c}>{c}</Chip>)
              : null}
          </div>
          <ul className="mt-2 flex flex-col">
            {FOUND.map((r, i) => (
              <li key={r.slug} className={cn("flex items-baseline justify-between gap-3 border-t border-line py-1.5", fading, i >= s.rows && "opacity-40")}>
                <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="shrink-0 text-xs text-ink-3">{r.line}</span>
              </li>
            ))}
          </ul>
        </Small>
      )}
    </Demo>
  );
}

/* ------------------------------------------------------------------ three facts landing with their receipts (M4) */

const dated = check.certs.filter((c) => c.expiresOn && c.expiresOn >= SNAPSHOT.readAt);
/** The record's facts with a register and a read day in the snapshot: its BGMEA number, then one dated certificate per scheme. */
const RECEIPTS = [
  check.bgmea && check.read.BGMEA ? { fact: `BGMEA member no. ${check.bgmea}`, from: `From BGMEA · read ${formatDay(check.read.BGMEA)}` } : null,
  ...dated
    .filter((c, i) => dated.findIndex((d) => d.kind === c.kind) === i)
    .map((c) => {
      const reg = CERT_REGISTER[c.kind];
      const read = reg ? check.read[reg.code] : undefined;
      return reg && read ? { fact: `${certName(c.kind, c.number)} · valid to ${formatDay(c.expiresOn)}`, from: `From ${reg.name} · read ${formatDay(read)}` } : null;
    }),
]
  .filter((r): r is { fact: string; from: string } => r !== null)
  .slice(0, 3);
type R = CursorState & { shown: number };
export const RECEIPT_STEPS: Step<R>[] = [{ at: 0, state: { shown: 0 } }, ...RECEIPTS.map((_, i) => ({ at: 600 + i * 1100, state: { shown: i + 1 } }))];

/** Every company the receipts vignette names. */
export const RECEIPT_NAMES = [displayName(check.name)];

export function VignetteReceipts(frame: Frame) {
  return (
    <Demo {...frame} steps={RECEIPT_STEPS} description={`${displayName(check.name)}'s record: ${RECEIPTS.length} facts landing, each with the register it came from and the day it was read.`}>
      {(s) => (
        <Small>
          <p className="text-sm font-medium text-ink">{displayName(check.name)}</p>
          <p className="text-xs text-ink-3">
            {s.shown} of {RECEIPTS.length} facts, each with its receipt
          </p>
          <ul className="mt-2 flex flex-col">
            {RECEIPTS.map((r, i) => (
              <li key={r.fact} className={cn("flex flex-col gap-0.5 border-t border-line py-2", fading, i >= s.shown && "opacity-40")}>
                <span className="text-sm font-medium text-ink">{r.fact}</span>
                <SourceLine>{r.from}</SourceLine>
              </li>
            ))}
          </ul>
        </Small>
      )}
    </Demo>
  );
}

/** A vignette's window: small, the product's light ground and a real edge, one moment inside (critique 22 Oct, S4). One height for every vignette, so cards side by side stand level. */
function Small({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-ground="day" className={cn("flex min-h-[204px] flex-col rounded-frame border border-line-strong bg-surface p-4 text-ink", className)}>{children}</div>;
}

/** A row of a list that streams: it stands under a fade until the moment reaches it, so the list is never empty (critique 22 Oct, S5). */
const fading = "transition-opacity duration-slow motion-reduce:transition-none";

/** The home's four vignettes, for its grid and the gallery; the product pages' two are exported above. */
export const VIGNETTES = [
  { key: "expiry", title: "Every certificate carries its date", body: "The chip counts down; at 90 days the record and the Compliance hub both say so.", Demo: VignetteExpiry, names: SOON ? [SOON.supplier] : [] },
  { key: "marks", title: "Every source, in trust order", body: "Government and RSC first, then the trade bodies, then the certifiers, then brand lists.", Demo: VignetteMarks, names: [displayName(check.name)] },
  { key: "quotes", title: "Quotes land beside each other", body: "Each against your target, with the record a click away.", Demo: VignetteQuotes, names: QUOTED },
  { key: "sanction", title: "A listing is never hidden by layout", body: "The row turns maroon on every surface and Send RFQ is refused in words.", Demo: VignetteSanction, names: [SANCTIONED_SAMPLE] },
] as const;

/** Every company the vignettes name. */
export const NAMES = VIGNETTES.flatMap((v) => v.names);
