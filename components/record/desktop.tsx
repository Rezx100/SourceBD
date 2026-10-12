// The sections of the supplier record on a desktop (Paper page 37: the full page and the pane beside a
// list). Overview, Exports, Products, Certificates, Checks, Safety, Sites, Sources, Contact, each drawn
// from the record's model and saying only what it holds. One drawing for both: a section lays itself out
// by the width of the column it is in (the `@container` variants: the tables gain their columns from
// 760px), so a pane dragged wide and a page in a narrow window are both right.
//
// One rule for shapes (founder, 12 Oct 2026): a pill only ever means "this needs a look"; a state that
// is fine is plain text; a document is an underlined link with a small glyph; a register's number is a
// grey stamp. Nothing is cut off with an ellipsis and nothing is scored. Server-safe; the map, Copy and
// the paid reveal are the only script.

import { ArrowUpRight, Buildings, CaretDown, CaretRight, Check, Clock, Envelope, Factory, FileText, Gauge, Globe, HardHat, Hourglass, ListChecks, Lock, MapPin, Needle, Package, Phone, ShieldCheck, Storefront, Tag, UsersThree, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ButtonLink, Define, ring } from "@/components/kit";
import { ABSENT, CONTACT_LIMIT_WORDS, SourceMark, onFileWords } from "@/components/patterns";
import { hasSourceMark } from "@/components/patterns/source-mark";
import { buyersOf, customsWindow, initials, type VolzaMarketName } from "@/lib/dashboard/facts";
import type { ContactDetails, SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { mailHref, siteHref, telHref } from "./contact-card";
import { CopyButton } from "./copy-button";
import { DesktopSites } from "./desktop-sites";
import {
  buyerTiles,
  certTable,
  checkRows,
  customsFootLine,
  exportTiles,
  exportsLead,
  factCells,
  filedWith,
  memberTiles,
  safetyLead,
  safetyLines,
  siteLines,
  type BarPart,
  type CertLine,
  type CheckRow,
  type SafetyLine,
} from "./desktop-words";
import { RecordRfqs, productItems, sourceGroups } from "./panels";
import { NO_CUSTOMS, UFLPA_LABEL, marketShares, noCustoms, recordsEnd, sanctionListRows, shortDay, uflpaLine, type StatusRow } from "./phone-words";
import { ShipmentRevealSection } from "./shipment-reveal";
import { staleWords, type TabId } from "./words";

/** The level of a section's heading: h2 on the record's own page (the name is the h1), h3 in a pane. */
export type Level = "h2" | "h3";
const under = (h: Level) => (h === "h2" ? "h3" : "h4");

const NUM = "[font-variant-numeric:tabular-nums]";
const TILE = "rounded-[10px] border border-line";
/** A link to a document or a register's page: underlined, never a pill. */
const DOC = cn("flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2", ring);
/** A row or a tile that is one link: the link's target covers it. */
const COVER = "outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-focus";

export type SectionProps = { model: SupplierSheetModel; today: Date; level: Level };

/* ------------------------------------------------------------------ pieces */

/** A section under the first: a hairline, its title and count, one line of what it is, then its body. */
function Section({ id, title, count, aside, sub, level: H, first = false, children }: { id: string; title: string; count?: number | null; aside?: ReactNode; sub?: string | null; level: Level; first?: boolean; children: ReactNode }) {
  return (
    <section id={`record-${id}`} aria-label={title} className={cn("flex scroll-mt-[calc(var(--record-offset,0px)+12px)] flex-col", !first && "border-t border-line pt-7")}>
      <div className="flex flex-col pb-4">
        <div className="flex items-baseline justify-between gap-4 px-3">
          <div className="flex items-baseline gap-2">
            <H className="text-lg font-medium tracking-tight text-ink">{title}</H>
            {count ? <span className={cn("text-lg font-medium tracking-tight text-ink-3", NUM)}>{count}</span> : null}
          </div>
          {aside}
        </div>
        {sub ? <p className="max-w-pane px-3 pt-0.5 text-base text-ink-2">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A titled group inside a section. */
function Block({ title, label, count, aside, sub, level: H, children }: { title: string; label?: string; count?: number | null; aside?: ReactNode; sub?: string | null; level: "h2" | "h3" | "h4"; children: ReactNode }) {
  return (
    <section aria-label={label ?? title} className="flex flex-col">
      <div className="flex flex-col pb-3">
        <div className="flex items-baseline justify-between gap-4 px-3">
          <div className="flex items-baseline gap-2">
            <H className="text-md font-medium text-ink">{title}</H>
            {count ? <span className={cn("text-md font-medium text-ink-3", NUM)}>{count}</span> : null}
          </div>
          {aside}
        </div>
        {sub ? <p className="px-3 pt-0.5 text-sm text-ink-2">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Nothing on file, said in a line or two: no picture, the page just gets shorter. */
function Absent({ title, body, note }: { title: string; body?: string | null; note?: { title: string; body: string } | null }) {
  return (
    <div className="flex flex-col gap-1.5 px-3">
      <p className="text-[15px]/[22px] font-medium text-ink">{title}</p>
      {body ? <p className="max-w-[620px] text-base text-ink-2">{body}</p> : null}
      {note ? (
        <div className="flex max-w-[620px] flex-col gap-0.5 rounded-lg bg-subtle px-3.5 py-3">
          <p className="text-base font-medium text-ink">{note.title}</p>
          <p className="text-sm text-ink-2">{note.body}</p>
        </div>
      ) : null}
    </div>
  );
}

/** A register's number as a small grey stamp. */
function Stamp({ children }: { children: string }) {
  return <span className="flex h-6 items-center rounded-md bg-subtle px-2 font-mono text-xs text-ink [overflow-wrap:anywhere]">{children}</span>;
}

/** The only pill on the record: a state that needs a look. */
function Look({ icon: G, children }: { icon: Icon; children: string }) {
  return (
    <span className="flex h-6 w-fit items-center gap-[5px] whitespace-nowrap rounded-full bg-caution-tint pl-2 pr-2.5 text-xs font-medium text-caution">
      <G size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
      {children}
    </span>
  );
}

/** A register's approved mark in its white frame, at the size the row needs. */
function Mark({ source, size = "md" }: { source: string; size?: "sm" | "md" | "lg" }) {
  return <SourceMark source={source} lazy className={size === "lg" ? "size-9 rounded-lg [&>img]:max-h-[26px] [&>img]:max-w-[26px]" : size === "md" ? "size-8 rounded-lg [&>img]:max-h-[22px] [&>img]:max-w-[22px]" : "size-7 [&>img]:max-h-[18px] [&>img]:max-w-[18px]"} />;
}

/** A brand has no logo here: its letters on the sunken ground. */
function Letters({ children, size = "lg" }: { children: string; size?: "sm" | "lg" }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center bg-sunken font-mono text-xs font-medium tracking-[0.02em] text-ink-2", size === "lg" ? "size-9 rounded-lg" : "size-7 rounded-md")}>
      {children}
    </span>
  );
}

const BAR_TONE: Record<BarPart["tone"], string> = { ink: "bg-ink", "ink-2": "bg-ink-2", "line-strong": "bg-line-strong", sunken: "bg-sunken" };

/** A 6px bar in segments by share. The words under it say what it shows; the bar is for the eye. */
function Segments({ parts }: { parts: BarPart[] }) {
  return (
    <span aria-hidden className="flex h-1.5 shrink-0 gap-0.5 overflow-clip rounded-[3px]">
      {parts.map((p, i) => (
        <span key={i} className={cn("h-1.5 basis-0", BAR_TONE[p.tone])} style={{ flexGrow: p.share }} />
      ))}
    </span>
  );
}

function Progress({ pct, tone, className }: { pct: number; tone: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-1.5 shrink-0 overflow-clip rounded-full bg-sunken", className)}>
      <span className={cn("rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

const STATUS_ICON: Record<StatusRow["key"], Icon> = { safety: HardHat, certificates: Hourglass, sanctions: ShieldCheck };

/**
 * The three checks in a few words each, in every head from the start: the Checks section sits under the
 * Certificates table, so this is what says at the top that something needs a look. Each jumps to Checks.
 */
export function StatusStrip({ statuses, href, className }: { statuses: StatusRow[]; /** Checks, on this record. */ href: string; className?: string }) {
  return (
    <ul aria-label="Checks, in short" className={cn("flex h-[26px] w-fit shrink-0 items-center rounded-lg bg-subtle", className)}>
      {statuses.map((s, i) => {
        const G = s.tone === "sanction" ? WarningOctagon : STATUS_ICON[s.key];
        return (
          <li key={s.key} className={cn("flex h-3.5 items-center px-3", i > 0 && "border-l border-line")}>
            <a href={href} data-jump="checks" className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-sm text-xs hover:underline", s.tone === "caution" ? "font-medium text-caution" : s.tone === "sanction" ? "font-medium text-sanction" : "text-ink-3", ring)}>
              <G size={14} weight={s.tone === "sanction" ? "fill" : "thin"} className={cn("shrink-0", s.tone === "caution" && "text-caution-icon")} aria-hidden />
              <span className="sr-only">{s.label}: </span>
              {s.short}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- overview */

const GRID_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-2 [@container_(min-width:520px)]:grid-cols-4"];

/** The export grid: four figures worked out from the customs record, each with its bar and a few words. */
function ExportGrid({ model, today, level, href, revealHref, market, rank }: SectionProps & { href: string; revealHref: string; market: VolzaMarketName | null; rank: number | null }) {
  const v = model.volza;
  if (!v) return null;
  const tiles = exportTiles(v, { market, rank });
  return (
    <Block
      title="Exports"
      label="Export figures"
      level={level}
      aside={
        <a href={href} data-jump="exports" className={cn("flex shrink-0 items-center gap-0.5 rounded-sm text-sm font-medium text-ink-2 hover:text-ink", ring)}>
          All exports
          <CaretRight size={14} weight="thin" className="shrink-0" aria-hidden />
        </a>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className={cn("overflow-clip", TILE)}>
          <dl className={cn("-mb-px -mr-px grid", GRID_COLS[tiles.length], NUM)}>
            {tiles.map((t) => (
              <div key={t.key} className="flex min-h-[112px] flex-col justify-between gap-2.5 border-b border-r border-line p-3 [@container_(min-width:760px)]:min-h-[116px] [@container_(min-width:760px)]:px-4 [@container_(min-width:760px)]:py-3.5">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-ink-3 [@container_(min-width:760px)]:text-sm">{t.label}</dt>
                  <dd className="text-lg font-medium tracking-tighter text-ink [@container_(min-width:760px)]:text-xl">{t.value}</dd>
                </div>
                <dd className="flex flex-col gap-[7px]">
                  {t.bar ? <Segments parts={t.bar} /> : null}
                  <span className="min-h-8 text-xs text-ink-3">{t.sub}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <CustomsFoot model={model} today={today} />
        {/* The paid reveal's shortcut, as shipped: only for a reader who can reveal or already has. */}
        {revealHref && (model.shipments?.state === "offer" || model.shipments?.state === "shown") ? (
          <div className="px-3 pt-1">
            <ButtonLink href={revealHref} prefetch={false}>
              Show recent shipments
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </Block>
  );
}

function CustomsFoot({ model, today }: { model: SupplierSheetModel; today: Date }) {
  if (!model.volza) return null;
  return (
    <p className={cn("flex items-start gap-1.5 px-3 text-xs text-ink-3", NUM)}>
      <FileText size={14} weight="thin" className="mt-px shrink-0" aria-hidden />
      {customsFootLine(model.volza, today)}
    </p>
  );
}

export const FACT_ICON: Record<string, Icon> = { "Factory types": Factory, Type: Factory, Workers: UsersThree, "Women · men": UsersThree, "Sewing machines": Needle, "Capacity, as filed": Gauge, Founded: Buildings, Address: MapPin, Products: Tag, Exports: Package };

/** Words that break between their " · " parts first: a part moves to the next line whole before it is split. */
function Parts({ children }: { children: string }) {
  const parts = children.split(" · ");
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          <span className="inline-block">{i < parts.length - 1 ? `${p} ·` : p}</span>
          {i < parts.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

function KeyFacts({ model, level }: Omit<SectionProps, "today">) {
  const cells = factCells(model);
  if (cells.length === 0) return null;
  return (
    <Block title="Key facts" level={level}>
      <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3.5 px-3 [@container_(min-width:840px)]:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]", NUM)}>
        {cells.map((f) => {
          const G = FACT_ICON[f.label] ?? FileText;
          return (
            <div key={f.label} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle">
                <G size={20} weight="thin" className="text-ink-2" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-px">
                <dt className="text-xs text-ink-3">{f.label}</dt>
                <dd className={f.empty ? "text-base text-ink-2" : "text-[15px]/[22px] font-medium text-ink"}>
                  <Parts>{f.value}</Parts>
                </dd>
                {f.from ? (
                  <dd className="text-xs text-ink-3">
                    <Parts>{f.from}</Parts>
                  </dd>
                ) : null}
              </div>
            </div>
          );
        })}
      </dl>
    </Block>
  );
}

function Memberships({ model, today, level }: SectionProps) {
  const tiles = memberTiles(model, today);
  // No membership on file: the fact's own sentence ("Not on file · 5 registers checked"), when the record carries the fact at all.
  const none = model.facts.find((f) => f.label === "Registers");
  if (tiles.length === 0 && !none) return null;
  return (
    <Block title="Memberships" level={level}>
      {tiles.length === 0 ? (
        <Absent title={none?.empty ?? ABSENT.onFile} body={none?.checked ? `${none.checked.charAt(0).toUpperCase()}${none.checked.slice(1)}.` : null} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 px-3 [@container_(min-width:760px)]:grid-cols-2 [@container_(min-width:760px)]:gap-3">
          {tiles.map((m) => (
            <li key={`${m.name}-${m.number}`} className={cn("relative flex items-center gap-3 py-3 pl-3 pr-3.5", TILE, m.href && "hover:bg-subtle")}>
              <Mark source={m.mark ?? m.name} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-medium text-ink">{m.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {m.number ? (
                    <>
                      <span className="sr-only">registration number</span>
                      <Stamp>{m.number}</Stamp>
                    </>
                  ) : null}
                  {m.read ? <span className={cn("text-xs text-ink-3", NUM)}>read {m.read}</span> : null}
                  {m.stale ? <span className={cn("text-xs font-medium text-caution", NUM)}>{m.stale}</span> : null}
                </span>
              </div>
              {m.href ? (
                <a href={m.href} aria-label={`Open the ${m.name} page`} className={cn("flex shrink-0 text-ink-2", COVER)}>
                  <ArrowUpRight size={16} weight="thin" aria-hidden />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function Buyers({ model, today, level }: SectionProps) {
  const v = model.volza;
  const tiles = buyerTiles(model, buyersOf(model.products.buyerLists, v), today);
  if (tiles.length === 0) return null;
  const fromCustoms = tiles.filter((b) => b.customs).length;
  const read = v ? shortDay(v.fetched_at, today) : null;
  return (
    <Block title="Buyers" count={tiles.length} level={level}>
      <div className="flex flex-col gap-2.5">
        <ul className="grid grid-cols-2 gap-3 px-3 [@container_(min-width:760px)]:grid-cols-3">
          {tiles.map((b) => (
            <li key={b.name} className={cn("relative flex min-h-[62px] items-center gap-3 px-3 py-2.5", TILE, b.listed && b.href && "hover:bg-subtle")}>
              <Letters>{b.letters}</Letters>
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{b.name}</span>
                <span className={cn("flex items-center gap-[5px] text-xs text-ink-3", NUM)}>
                  {b.listed ? <Storefront size={14} weight="thin" className="shrink-0" aria-hidden /> : <Package size={14} weight="thin" className="shrink-0" aria-hidden />}
                  {b.listed ? `Supplier list${b.customs ? " · customs records" : b.read ? ` · read ${b.read}` : ""}` : "Customs records"}
                </span>
                {/* The customs record's own name, small: the short name above is ours, not customs'. */}
                {b.filed ? <span className="text-[11px]/[14px] text-ink-3 [overflow-wrap:anywhere]">as {b.filed}</span> : null}
              </div>
              {b.listed && b.href ? (
                <a href={b.href} aria-label={`Open the ${b.name} supplier list`} className={cn("flex shrink-0 text-ink-2", COVER)}>
                  <ArrowUpRight size={16} weight="thin" aria-hidden />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {fromCustoms > 0 ? (
          <p className={cn("px-3 text-xs text-ink-3", NUM)}>
            Customs records name the importer: often an agent or a buying house, not the brand.
            {v && v.buyers !== null && v.buyers > fromCustoms ? ` ${fromCustoms} of ${v.buyers.toLocaleString("en-GB")} shown.` : ""}
            {read ? ` Customs records read ${read}.` : ""}
          </p>
        ) : null}
      </div>
    </Block>
  );
}

/** The export grid first, then the facts. The checks sit lower, under the Certificates table. */
export function OverviewSection({ model, today, level, exportsHref, revealHref, market = null, rank = null }: SectionProps & { exportsHref: string; /** The Exports section's Recent shipments. */ revealHref: string; /** The reader's own market, when the database holds it. */ market?: VolzaMarketName | null; /** The share of exporters on record this one is bigger than, when it has been read. */ rank?: number | null }) {
  return (
    <section id="record-overview" aria-label="Overview" className="flex scroll-mt-[calc(var(--record-offset,0px)+12px)] flex-col gap-[26px] [@container_(min-width:760px)]:gap-8">
      <ExportGrid model={model} today={today} level={level} href={exportsHref} revealHref={revealHref} market={market} rank={rank} />
      {model.sanctionSample ? (
        <p className="flex flex-wrap items-center gap-2 px-3 text-xs text-ink-3">
          <span className="flex h-[22px] items-center rounded border border-dashed border-line-strong px-2 font-medium text-ink">Sample state</span>
          No published supplier is on a sanctions list today. Placeholders only; no real company is shown.
        </p>
      ) : null}
      <KeyFacts model={model} level={level} />
      <Memberships model={model} today={today} level={level} />
      <Buyers model={model} today={today} level={level} />
      {model.rfqs.rows.length > 0 ? (
        <div className="px-3">
          <RecordRfqs model={model} level={level} />
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------- exports */

const SHARE_TONES = ["bg-ink", "bg-ink-2", "bg-ink-3", "bg-line-strong", "bg-line"];
const MARKET_COLS = "grid grid-cols-[minmax(0,1fr)_104px_84px_88px] items-center gap-x-4 [@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_104px_84px_88px_96px]";
const WIDE_CELL = "hidden [@container_(min-width:760px)]:block";

export function ExportsSection({ model, today, level }: SectionProps) {
  const v = model.volza;
  const Sub = under(level);
  const reveal = model.shipments ? <ShipmentRevealSection key={model.slug} slug={model.slug} initial={model.shipments} level={Sub === "h4" ? "h3" : Sub} /> : null;
  if (!v) {
    return (
      <Section id="exports" title="Exports" level={level}>
        <div className="flex flex-col gap-5">
          {noCustoms(model) ? <Absent title={NO_CUSTOMS.title} body={NO_CUSTOMS.body} note={model.products.onEpb ? { title: NO_CUSTOMS.epbTitle, body: NO_CUSTOMS.epbBody } : null} /> : null}
          {reveal ? <div className="px-3">{reveal}</div> : null}
        </div>
      </Section>
    );
  }
  const shares = marketShares(v);
  return (
    <Section id="exports" title="Exports" sub={exportsLead(v)} level={level}>
      <div className={cn("flex flex-col gap-5", NUM)}>
        {shares.length > 0 ? (
          <Block title="Where it goes" sub="Share of export value, by market" level={Sub}>
            {shares.every((s) => s.pct !== null) ? (
              <div aria-hidden className="mx-3 mb-1.5 mt-1 flex gap-0.5 overflow-clip rounded-[3px]">
                {shares.map((s, i) => (
                  <span key={s.name} className={cn("h-2.5", SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)])} style={{ width: `${s.pct}%` }} />
                ))}
              </div>
            ) : null}
            <div role="table" aria-label="Exports by market" className="flex flex-col">
              <div role="rowgroup">
                <div role="row" className={cn(MARKET_COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
                  <span role="columnheader">Market</span>
                  <span role="columnheader" className="text-right">Share of value</span>
                  <span role="columnheader" className="text-right">Value</span>
                  <span role="columnheader" className="text-right">Shipments</span>
                  <span role="columnheader" className={cn("text-right", WIDE_CELL)}>Buyers</span>
                </div>
              </div>
              <div role="rowgroup">
                {shares.map((s, i) => (
                  <div key={s.name} role="row" className={cn(MARKET_COLS, "min-h-10 border-b border-line px-3 py-2.5 text-base text-ink last:border-b-0 hover:bg-subtle")}>
                    <span role="cell" className="flex items-center gap-2.5 font-medium">
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px]", SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)])} />
                      {s.name}
                    </span>
                    <span role="cell" className="text-right font-medium">{s.pct !== null ? `${s.pct}%` : ""}</span>
                    <span role="cell" className="text-right">{s.value ?? ""}</span>
                    <span role="cell" className="text-right">{s.shipments.toLocaleString("en-GB")}</span>
                    <span role="cell" className={cn("text-right", WIDE_CELL, s.buyers === null && "text-xs text-ink-3")}>{s.buyers !== null ? s.buyers.toLocaleString("en-GB") : "Not split out"}</span>
                  </div>
                ))}
              </div>
            </div>
          </Block>
        ) : null}
        {reveal ? <div className="px-3">{reveal}</div> : null}
        <CustomsFoot model={model} today={today} />
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- products */

const PANE_LINES = 6;

/**
 * Products: one answer to "what does it make", from the two registers that say so, kept apart because
 * they are different claims: the export codes on its EPB page (photo, short name, code), then the names
 * it filed with its trade body. `fold`: the pane shows six lines and unfolds the rest.
 */
export function ProductsSection({ model, today, level, fold }: SectionProps & { fold: boolean }) {
  const p = model.products;
  const Sub = under(level);
  const lines = p.lineTiles ?? p.tiles;
  const items = productItems(p.productList);
  const filed = filedWith(model, today);
  const tile = (t: (typeof lines)[number]) => (
    <li key={t.hs} className="relative flex items-center gap-2.5 rounded-md py-1 hover:bg-subtle">
      {t.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- a 40px catalogue thumbnail, already sized
        <img src={t.thumb} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-10 shrink-0 rounded-md bg-subtle object-cover" />
      ) : (
        <span aria-hidden className="size-10 shrink-0 rounded-md bg-subtle" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <Link href={model.lineHref(t.hs)} prefetch={false} scroll={false} className={cn("text-base font-medium text-ink", COVER)}>
          {t.short}
        </Link>
        <span className="font-mono text-xs text-ink-3">{t.hs}</span>
      </span>
    </li>
  );
  const GRID = "grid grid-cols-2 gap-x-3 gap-y-2 px-3 [@container_(min-width:760px)]:grid-cols-4 [@container_(min-width:760px)]:gap-y-2.5";
  const first = fold ? lines.slice(0, PANE_LINES) : lines;
  const rest = fold ? lines.slice(PANE_LINES) : [];
  return (
    <Section id="products" title="Products" level={level}>
      {p.linesUnknown || lines.length > 0 || items.length > 0 ? (
        <div className="flex flex-col gap-6">
          {p.linesUnknown ? (
            <Block title="What it ships" level={Sub}>
              <p className="px-3 text-base text-ink-2">The export lines could not be read.</p>
            </Block>
          ) : lines.length > 0 ? (
            <Block title="What it ships" count={p.lines} sub="Product codes on its EPB exporter page. Each opens the line. Photos illustrate the code." level={Sub}>
              <ul data-export-lines="" className={GRID}>
                {first.map(tile)}
              </ul>
              {rest.length > 0 ? (
                <details className="group/lines flex flex-col">
                  <summary className={cn("mx-3 mt-3 flex h-9 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-line text-base font-medium text-ink hover:bg-subtle [&::-webkit-details-marker]:hidden", ring)}>
                    <span className="group-open/lines:hidden">All {lines.length} lines</span>
                    <span className="hidden group-open/lines:inline">Show the first {PANE_LINES}</span>
                    <CaretDown size={14} weight="thin" className="shrink-0 text-ink-2 group-open/lines:rotate-180" aria-hidden />
                  </summary>
                  <ul className={cn(GRID, "pt-2")}>{rest.map(tile)}</ul>
                </details>
              ) : null}
            </Block>
          ) : p.onEpb ? (
            <Block title="What it ships" level={Sub}>
              <p className="px-3 text-base text-ink-2">On the EPB exporter register · no lines on file.</p>
            </Block>
          ) : null}
          {items.length > 0 ? (
            <Block title={filed.body ? `As filed with ${filed.body}` : "As filed"} count={items.length} aside={filed.read ? <span className={cn("shrink-0 text-sm text-ink-3", NUM)}>read {filed.read}</span> : null} level={Sub}>
              <p data-filed-products="" className="max-w-[760px] px-3 text-base text-ink">
                {items.join("  ·  ")}
              </p>
            </Block>
          ) : null}
        </div>
      ) : (
        <Absent title="Not published. Ask in your RFQ." body="Products they export: not on the EPB exporter list." />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ certificates */

const CERT_COLS =
  "grid grid-cols-[minmax(0,1fr)_132px_92px_64px] items-center gap-x-3 [@container_(min-width:560px)]:grid-cols-[minmax(0,1fr)_158px_104px_88px] [@container_(min-width:560px)]:gap-x-4 [@container_(min-width:900px)]:grid-cols-[minmax(0,1fr)_150px_104px_164px_92px_92px] [@container_(min-width:900px)]:gap-x-3";
// The fixed columns and their gaps take 686px, so the six start at 900px of column, where the name keeps
// 214px or more (at 760 it had none: a letter a line). Under that the table keeps four columns and says the
// issuer under the name.
const CERT_WIDE_CELL = "hidden [@container_(min-width:900px)]:block";
const CERT_MARK: Record<string, string> = { "OEKO-TEX": "OEKO-TEX", GOTS: "GOTS", WRAP: "WRAP" };

/**
 * One certificate: a row of the table, then its numbers on a second line. One grid for both, so the
 * document link is drawn once: in the last column where the table is wide, beside the numbers where it is not.
 */
function CertRow({ c }: { c: CertLine }) {
  const scheme = c.scheme.split(" ")[0]!;
  const ended = /^Ended/.test(c.state);
  return (
    <div role="row" id={c.anchor ?? undefined} className={cn(CERT_COLS, "min-h-20 scroll-mt-[calc(var(--record-offset,0px)+12px)] content-center gap-y-2 border-b border-line px-3 py-2.5 last:border-b-0 target:bg-brand-tint hover:bg-subtle [@container_(min-width:900px)]:min-h-[84px]")}>
      <span role="cell" className="flex min-w-0 items-center gap-3">
        {CERT_MARK[scheme] ? <Mark source={CERT_MARK[scheme]} /> : <Letters size="sm">{initials(c.scheme)}</Letters>}
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-base font-medium text-ink [@container_(min-width:900px)]:text-[15px]/[22px]">{c.scheme}</span>
          {c.issuer ? <span className="text-xs text-ink-3 [@container_(min-width:900px)]:hidden">Issued by {c.issuer}</span> : null}
        </span>
      </span>
      <span role="cell">{c.look ? <Look icon={Hourglass}>{c.state}</Look> : <span className={cn("text-base", ended ? "text-ink-3" : "text-ink")}>{c.state}</span>}</span>
      <span role="cell" className={c.until ? cn("whitespace-nowrap text-base", c.look ? "font-medium text-caution" : ended ? "text-ink-3" : "text-ink") : "text-xs text-ink-3"}>{c.until ?? "No end date published"}</span>
      <span role="cell" className={cn("text-base text-ink [overflow-wrap:anywhere]", CERT_WIDE_CELL)}>
        {c.issuer ?? ""}
      </span>
      <span role="cell" className="flex flex-col">
        <span className="text-sm text-ink-2">{c.checked ?? ""}</span>
        {c.checkedNote ? <span className={cn("text-xs", c.look ? "font-medium text-caution" : "text-ink-3")}>{c.checkedNote}</span> : null}
      </span>
      <span role="cell" className="col-start-4 row-start-2 flex justify-end [@container_(min-width:900px)]:col-start-6 [@container_(min-width:900px)]:row-start-1">
        {c.doc ? <DocLink c={c} /> : null}
      </span>
      <span role="cell" className="col-span-3 col-start-1 row-start-2 flex flex-wrap items-center gap-1.5 pl-10 [@container_(min-width:900px)]:col-span-5 [@container_(min-width:900px)]:pl-11">
        {c.numbers.length > 0 ? <span className="shrink-0 text-xs text-ink-3">{c.numberLabel}</span> : null}
        {c.numbers.map((x) => (
          <Stamp key={x}>{x}</Stamp>
        ))}
      </span>
    </div>
  );
}

function DocLink({ c }: { c: CertLine }) {
  const G = c.doc!.label === "Certificate" ? FileText : ArrowUpRight;
  return (
    <a href={c.doc!.href} className={DOC}>
      <G size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
      {c.doc!.label}
      <span className="sr-only">, {c.scheme}</span>
    </a>
  );
}

function CertHead() {
  return (
    <div role="rowgroup">
      <div role="row" className={cn(CERT_COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
        <span role="columnheader">Certificate</span>
        <span role="columnheader">State</span>
        <span role="columnheader">Valid until</span>
        <span role="columnheader" className={CERT_WIDE_CELL}>Issued by</span>
        <span role="columnheader">Last checked</span>
        <span role="columnheader" className={CERT_WIDE_CELL}>
          <span className="sr-only">Document</span>
        </span>
      </div>
    </div>
  );
}

export function CertificatesSection({ model, today, level }: SectionProps) {
  const t = certTable(model, today);
  // A line over a group of rows: a row of one cell, so the table stays rows and cells to a screen reader.
  const group = (words: string) => (
    <div role="row" className="flex h-9 items-end border-b border-line px-3 pb-1.5 text-xs font-medium text-ink-3">
      <span role="cell">{words}</span>
    </div>
  );
  return (
    <Section id="certificates" title="Certificates" count={t.count} sub={t.held.length > 0 ? `Soonest expiry first.${model.certChecks ? " Each one checked with its issuer." : ""}` : null} level={level}>
      {t.held.length === 0 && t.ended.length === 0 ? <Absent title={ABSENT.certificates} body={`${model.certsEmpty.charAt(0).toUpperCase()}${model.certsEmpty.slice(1).replace(/\.$/, "")}.`} /> : null}
      {t.held.length > 0 || t.ended.length > 0 ? (
        <div role="table" aria-label="Certificates" className={cn("flex flex-col", NUM)}>
          <CertHead />
          <div role="rowgroup">
            {t.held.length === 0 ? (
              <div role="row" className="border-b border-line px-3 py-3 text-base text-ink-2">
                <span role="cell">None held today.</span>
              </div>
            ) : null}
            {t.held.map((c) => (
              <CertRow key={c.key} c={c} />
            ))}
          </div>
          {t.ended.length > 0 ? (
            // Ended: our arithmetic on the last register read, which may predate the end. Said plainly, never a warning.
            <div role="rowgroup" aria-label="No longer current">
              {group("No longer current · not counted above")}
              {t.ended.map((c) => (
                <CertRow key={c.key} c={c} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {/* A building's certificate is not this record's: shown under the building's name, not counted above. */}
      {model.buildingCerts.map((b) => {
        const own = certTable({ ...model, certs: b.certs }, today);
        return (
          <div key={b.building} role="table" aria-label={`Certificates held by ${b.building}`} className={cn("flex flex-col pt-2", NUM)}>
            <div role="rowgroup">
              {group(`Held by ${b.building} · the building's own, not counted above`)}
              {[...own.held, ...own.ended].map((c) => (
                <CertRow key={c.key} c={c} />
              ))}
            </div>
          </div>
        );
      })}
    </Section>
  );
}

/* ------------------------------------------------------------------ checks */

const CHECK_ICON: Record<CheckRow["kind"], Icon> = { safety: HardHat, certificates: Hourglass, sanctions: ShieldCheck };
// The wide row's columns: the words, then the figure and the foot when any row has one, then the caret.
const CHECK_COLS: Record<string, string> = {
  "11": "[@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_168px_240px_16px]",
  "10": "[@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_168px_0px_16px]",
  "01": "[@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_0px_240px_16px]",
  "00": "[@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_0px_0px_16px]",
};

function CheckLine({ c, cols, href, children }: { c: CheckRow; cols: string; href: string | null; children?: ReactNode }) {
  const bad = c.tone === "sanction";
  const G = bad ? WarningOctagon : c.kind === "sanctions" && !c.quiet ? Clock : CHECK_ICON[c.kind];
  const ink = bad ? "text-sanction" : c.quiet ? "text-ink-3" : "text-caution";
  const figure = c.figure;
  return (
    <li id={bad ? "sanctions" : undefined} className={cn("relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-t border-line px-3.5 py-3 first:border-t-0 [@container_(min-width:760px)]:min-h-16 [@container_(min-width:760px)]:gap-x-6 [@container_(min-width:760px)]:gap-y-[3px] [@container_(min-width:760px)]:pl-4", cols, href && "hover:bg-subtle")}>
      <span className={cn("col-start-1 row-start-1 flex items-center gap-1.5 text-xs font-medium", ink)}>
        <G size={16} weight={bad ? "fill" : "thin"} className={cn("shrink-0", !bad && !c.quiet && "text-caution-icon")} aria-hidden />
        {c.tag}
      </span>
      <span className="col-start-1 row-start-2 flex min-w-0 flex-col gap-0.5">
        {href ? (
          <a href={href} data-jump={c.section} className={cn("text-base font-medium [@container_(min-width:760px)]:text-[15px]/[22px]", bad ? "text-sanction" : "text-ink", COVER)}>
            {c.title}
          </a>
        ) : (
          <span className={cn("text-base font-medium [@container_(min-width:760px)]:text-[15px]/[22px]", bad ? "text-sanction" : "text-ink")}>{c.title}</span>
        )}
        {c.body ? <span className="max-w-[72ch] text-sm text-ink-2">{c.body}</span> : null}
        {children}
      </span>
      {figure ? (
        <span className={cn("col-start-2 row-start-2 flex w-[132px] flex-col gap-[5px] [@container_(min-width:760px)]:row-span-2 [@container_(min-width:760px)]:row-start-1 [@container_(min-width:760px)]:w-auto [@container_(min-width:760px)]:self-center", NUM)}>
          <span className="flex items-baseline gap-1.5">
            <span className={cn("text-md/[22px] font-medium", "n" in figure ? "text-caution" : "text-ink")}>{"n" in figure ? figure.n : `${figure.pct}%`}</span>
            <span className="text-xs text-ink-3">{figure.words}</span>
          </span>
          {"pct" in figure ? <Progress pct={figure.pct} tone={c.quiet ? "bg-ink-2" : "bg-caution-icon"} /> : null}
        </span>
      ) : null}
      {c.foot ? (
        <span className={cn("col-span-2 row-start-3 text-xs [@container_(min-width:760px)]:col-span-1 [@container_(min-width:760px)]:col-start-3 [@container_(min-width:760px)]:row-span-2 [@container_(min-width:760px)]:row-start-1 [@container_(min-width:760px)]:self-center [@container_(min-width:760px)]:text-right", c.footCaution ? "font-medium text-caution" : "text-ink-3", NUM)}>
          {c.foot}
        </span>
      ) : null}
      {href ? <CaretRight size={16} weight="thin" className="col-start-2 row-start-1 shrink-0 justify-self-end text-ink-3 [@container_(min-width:760px)]:col-start-4 [@container_(min-width:760px)]:row-span-2 [@container_(min-width:760px)]:self-center" aria-hidden /> : null}
    </li>
  );
}

/**
 * Checks: Safety, Certificates and Sanctions, each said once. A check that needs a look gets its full
 * row; one that does not gets a quiet line. On a sanctioned record the matches are in the Sanctions row.
 */
export function ChecksSection({ model, today, level, hrefOf }: SectionProps & { /** A section of this record, by the tab its address carries and its anchor. */ hrefOf: (section: string) => string }) {
  const { rows, looks } = checkRows(model, today);
  const cols = CHECK_COLS[`${rows.some((r) => r.figure) ? 1 : 0}${rows.some((r) => r.foot) ? 1 : 0}`]!;
  return (
    <Section id="checks" title="Checks" aside={looks > 0 ? <span className="shrink-0 text-sm font-medium text-caution">{looks === 1 ? "1 needs a look" : `${looks} need a look`}</span> : null} level={level}>
      <ul className={cn("flex flex-col overflow-clip", TILE)}>
        {rows.map((c) =>
          c.tone === "sanction" ? (
            <CheckLine key={c.key} c={c} cols={cols} href={null}>
              {model.sanctions.length === 0 ? <span className="max-w-[72ch] text-sm text-ink-2">{model.sanctionsEmpty}</span> : null}
              {model.sanctions.map((s, i) => (
                <span key={`${s.list}-${s.ref}-${i}`} className="flex max-w-[72ch] flex-col gap-0.5 pt-1.5 text-sm text-ink-2">
                  <span className="font-medium text-ink">
                    {s.list}: matched as {s.matchedName}
                  </span>
                  <span className={cn("text-xs text-ink-3", NUM)}>{[s.ref ? `Entry ${s.ref}` : null, s.listedOn ? `listed ${s.listedOn}` : null, s.screenedOn ? `checked ${s.screenedOn}` : null].filter(Boolean).join(" · ")}</span>
                  {s.href ? (
                    <a href={s.href} className={cn(DOC, "w-fit")}>
                      <ArrowUpRight size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                      {s.opens === "entry" ? "Open the entry" : "Open the list"}
                    </a>
                  ) : null}
                </span>
              ))}
              <span className="max-w-[72ch] pt-1.5 text-sm text-ink-2">The record stays readable for due diligence. Save still works, so the supplier can be tracked.</span>
            </CheckLine>
          ) : (
            <CheckLine key={c.key} c={c} cols={cols} href={hrefOf(c.section)} />
          ),
        )}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ safety */

const RSC_COLS =
  "grid grid-cols-[minmax(0,1fr)_150px_124px] items-center gap-x-4 [@container_(min-width:760px)]:grid-cols-[minmax(0,1fr)_168px_152px_148px_64px]";
const TRAINING_TONE = { good: "font-medium text-brand-ink", look: "font-medium text-caution" } as const;

/** One building: a row of the table, then its reports. Where the table is narrow the training moves to a line of its own. */
function SafetyRow({ b }: { b: SafetyLine }) {
  return (
    <div role="row" className={cn(RSC_COLS, "min-h-[72px] content-center gap-y-2 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-subtle")}>
      <span role="cell" className="flex min-w-0 flex-col gap-px">
        <span className="text-base font-medium text-ink [overflow-wrap:anywhere] [@container_(min-width:760px)]:text-[15px]/[22px]">{b.name}</span>
        {b.ref ? <span className="font-mono text-xs text-ink-2">RSC {b.ref}</span> : null}
      </span>
      <span role="cell">
        {b.status ? (
          b.behind ? (
            <Look icon={Clock}>{b.status}</Look>
          ) : (
            <span className="flex items-center gap-1.5 text-base text-ink">
              <Check size={14} weight="thin" className="shrink-0 text-brand-ink" aria-hidden />
              {b.status}
            </span>
          )
        ) : null}
      </span>
      <span role="cell" className="flex items-center gap-2.5">
        {b.progress !== null ? (
          <>
            {/* Green once every issue is fixed, orange while the building is behind. */}
            <Progress pct={b.progress} tone={b.progress === 100 ? "bg-brand-ink" : b.behind ? "bg-caution-icon" : "bg-ink-3"} className="w-16 [@container_(min-width:760px)]:w-[88px]" />
            <span className="text-base font-medium text-ink">{b.progress}%</span>
          </>
        ) : null}
      </span>
      <span role="cell" className="col-span-full row-start-2 flex items-baseline gap-2 empty:hidden [@container_(min-width:760px)]:col-span-1 [@container_(min-width:760px)]:col-start-4 [@container_(min-width:760px)]:row-start-1">
        {b.training ? (
          <>
            <span className="text-xs text-ink-3 [@container_(min-width:760px)]:hidden">Worker safety training</span>
            <span className={cn("text-base", b.trainingTone ? TRAINING_TONE[b.trainingTone] : "text-ink")}>{b.training}</span>
          </>
        ) : null}
      </span>
      <span role="cell" className={cn("col-start-5 row-start-1 text-sm text-ink-2", WIDE_CELL)}>
        {b.read ?? ""}
      </span>
      {b.reports.length > 0 || b.missing ? (
        <span role="cell" className="col-span-full row-start-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 [@container_(min-width:760px)]:row-start-2">
          {b.reports.length > 0 ? <span className="shrink-0 text-xs text-ink-3">Inspection reports</span> : null}
          {b.reports.map((r) => {
            const G = r.plan ? ListChecks : FileText;
            return (
              <a key={r.label} href={r.href} className={DOC}>
                <G size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                {r.label}
                <span className="sr-only">, {b.name}</span>
              </a>
            );
          })}
          {b.missing ? <span className="text-xs text-ink-3">{b.missing}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function SafetySection({ model, today, level }: SectionProps) {
  const lines = safetyLines(model, today);
  if (lines.length === 0) {
    return (
      <Section id="safety" title="Safety" level={level}>
        <Absent
          title="Not in the RSC programme"
          body={model.rscBuildings.length > 0 ? `RSC covers ${model.rscBuildings.join(", ")}: the buildings, not this record.` : "This factory is not on the RMG Sustainability Council's list, so there are no building inspections or repair progress to show."}
          note={{ title: "Not the same as unsafe", body: "RSC covers factories that brands signed up. Ask for fire and building reports in your RFQ." }}
        />
      </Section>
    );
  }
  return (
    <Section id="safety" title="Safety" count={lines.length} sub={safetyLead(lines)} level={level}>
      <div role="table" aria-label="RSC buildings" className={cn("flex flex-col", NUM)}>
        <div role="rowgroup">
          <div role="row" className={cn(RSC_COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
            <span role="columnheader">Building</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Safety issues fixed</span>
            <span role="columnheader" className={WIDE_CELL}>Worker safety training</span>
            <span role="columnheader" className={WIDE_CELL}>Last read</span>
          </div>
        </div>
        <div role="rowgroup">
          {lines.map((b) => (
            <SafetyRow key={b.key} b={b} />
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- sites */

export function SitesSection({ model, level, tabHref, site }: Omit<SectionProps, "today"> & { tabHref: (tab: TabId) => string; site: number | null }) {
  const lines = siteLines(model.locations);
  const { facilities } = model;
  const Sub = under(level);
  return (
    <Section id="sites" title="Sites" count={lines.length} level={level}>
      <div className="flex flex-col gap-6">
        <div id="locations">
          {lines.length === 0 ? <Absent title="No address on file" body={model.locationsEmpty} /> : <DesktopSites lines={lines} slug={model.slug} baseHref={tabHref("sites")} initial={site} mapKey={Boolean(process.env.NEXT_PUBLIC_BARIKOI_API_KEY)} />}
        </div>
        {/* The extension buildings: an unread list says so, and never says there are none. */}
        {facilities.rows.length > 0 || facilities.count === null ? (
          <div id="facilities">
            <Block title="Extension buildings" count={facilities.count} level={Sub}>
              {facilities.rows.length === 0 ? (
                <p className="px-3 text-base text-ink-2">{facilities.empty}</p>
              ) : (
                <ul data-facilities="true" className="flex flex-col">
                  {facilities.rows.map((f) => (
                    <li key={f.name} className="flex flex-col gap-0.5 border-b border-line px-3 py-2.5 first:border-t last:border-b-0">
                      <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{f.name}</span>
                      {f.address ? <span className="text-sm text-ink-2 [overflow-wrap:anywhere]">{f.address}</span> : null}
                      {f.workers ? <span className={cn("text-xs text-ink-3", NUM)}>{f.workers}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- sources */

const SOURCE_LINE = "flex min-h-12 flex-col gap-2 border-t border-line p-3 first:border-t-0 [@container_(min-width:760px)]:flex-row [@container_(min-width:760px)]:items-center [@container_(min-width:760px)]:gap-4 [@container_(min-width:760px)]:py-2";
const SOURCE_KIND = "text-xs font-medium text-ink-3 [@container_(min-width:760px)]:w-[140px] [@container_(min-width:760px)]:shrink-0 [@container_(min-width:760px)]:text-sm [@container_(min-width:760px)]:font-normal";

/**
 * Who filed what, by how far each is trusted: the kind once at the start of its line, then each source as
 * its mark and its name. The numbers and read dates sit with the facts they back, so a source here carries
 * a note only when its read is stale. The sanctions lists keep each list's own read date.
 */
export function SourcesSection({ model, today, level }: SectionProps) {
  const v = model.volza;
  const behind = v ? recordsEnd(v, today) : null;
  const lists = sanctionListRows(model, today);
  const uflpa = uflpaLine(model, today);
  const groups = sourceGroups(model.sources);
  const Sub = under(level);
  return (
    <Section id="sources" title="Sources" count={model.sources.length} sub={model.sources.length === 0 ? "No register has filed a record for this company." : `${model.sourcesCaption}. Highest trust first.`} level={level}>
      <div className="flex flex-col gap-5">
        {groups.length > 0 || v ? (
          <div className="flex flex-col border-y border-line">
            {groups.map((g) => (
              <section key={g.kind} aria-label={g.kind} className={SOURCE_LINE}>
                <Sub className={SOURCE_KIND}>
                  <Define term={g.kind} />
                </Sub>
                <ul className="flex min-w-0 flex-1 flex-wrap gap-x-7 gap-y-2.5">
                  {g.rows.map((s) => {
                    const stale = staleWords(s.readDate, today);
                    return (
                      <li key={s.mark.code} className="flex items-center gap-2">
                        {hasSourceMark(s.mark.code) ? <Mark source={s.mark.code} size="sm" /> : <Letters size="sm">{initials(s.mark.label)}</Letters>}
                        {s.mark.href ? (
                          <a href={s.mark.href} title={s.name !== s.mark.label ? s.name : undefined} className={cn("rounded-sm text-base font-medium text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2", ring)}>
                            {s.mark.label}
                          </a>
                        ) : (
                          <span className="text-base font-medium text-ink">{s.mark.label}</span>
                        )}
                        {stale ? <span className={cn("whitespace-nowrap text-xs font-medium text-caution", NUM)}>{stale}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {v ? (
              <section aria-label="Customs records" className={SOURCE_LINE}>
                <Sub className={SOURCE_KIND}>Customs records</Sub>
                <p className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2", NUM)}>
                  <Letters size="sm">CU</Letters>
                  <span className="text-base font-medium text-ink">Bangladesh customs exports, {customsWindow(v)}</span>
                  {behind !== null ? <span className="whitespace-nowrap text-xs font-medium text-caution">ends {behind} days ago</span> : null}
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
        {lists.length > 0 || uflpa ? (
          <section aria-label="Sanctions lists" className="mx-3 flex flex-col gap-3 rounded-[10px] bg-subtle p-4">
            <div className="flex flex-col gap-px">
              <Sub className={cn("flex items-center gap-2 text-[15px]/[22px] font-medium", model.sanctioned ? "text-sanction" : "text-ink")}>
                {model.sanctioned ? <WarningOctagon size={16} weight="fill" className="shrink-0" aria-hidden /> : <ShieldCheck size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden />}
                Sanctions lists · {model.sanctioned ? `on the ${model.sanctions[0]?.list ?? "sanctions list"}` : "not listed"}
              </Sub>
              <p className="text-sm text-ink-2">Checked for every supplier. Each list with the day it was last read.</p>
            </div>
            <dl className={cn("grid grid-cols-2 gap-x-5 gap-y-2 text-sm [@container_(min-width:760px)]:grid-cols-4", NUM)}>
              {lists.map((l) => (
                <div key={l.label} className="flex flex-col gap-0.5">
                  <dt className="text-ink">{l.label}</dt>
                  <dd className={l.old ? "font-medium text-caution" : "text-ink-2"}>{l.day}</dd>
                </div>
              ))}
              {uflpa ? (
                <div className="col-span-2 flex flex-col gap-0.5">
                  <dt className="text-ink">{UFLPA_LABEL}</dt>
                  <dd className="text-ink-2">{uflpa}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- contact */

function Way({ icon: G, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5 border-t border-line py-3.5 first:border-t-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken">
        <G size={18} weight="thin" className="text-ink-2" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-ink-3">{label}</span>
        {children}
      </div>
    </li>
  );
}

const CONTACT_LINK = cn("rounded-sm text-base text-brand-ink underline decoration-1 underline-offset-[3px] [overflow-wrap:anywhere] hover:decoration-2", ring);

/** The details, once the database returned them: the person on a tinted ground, then one line per way to reach them. */
function ContactCard({ details }: { details: ContactDetails }) {
  const { emails, phones, website, person, role } = details;
  if (emails.length + phones.length === 0 && !website && !person) {
    return <p data-contact-details="" className={cn("mx-3 p-4 text-base font-medium text-ink-2", TILE)}>No email or phone on file</p>;
  }
  return (
    <div data-contact-details="" className={cn("mx-3 flex flex-col overflow-clip [@container_(min-width:760px)]:flex-row", TILE)}>
      {person ? (
        <div className="flex items-center gap-3.5 border-b border-line bg-subtle p-4 [@container_(min-width:760px)]:w-[268px] [@container_(min-width:760px)]:shrink-0 [@container_(min-width:760px)]:border-b-0 [@container_(min-width:760px)]:border-r [@container_(min-width:760px)]:p-5">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-md font-medium text-ink-2">
            {initials(person)}
          </span>
          <p className="flex min-w-0 flex-col">
            <span className="text-md font-medium text-ink [overflow-wrap:anywhere]">{person}</span>
            {role ? <span className="text-sm text-ink-2 [overflow-wrap:anywhere]">{role}</span> : null}
            <span className="text-xs text-ink-3">Contact person</span>
          </p>
        </div>
      ) : null}
      <ul className="flex min-w-0 flex-1 flex-col px-4 py-0.5 [@container_(min-width:760px)]:px-5 [@container_(min-width:760px)]:py-1">
        {emails.length ? (
          <Way icon={Envelope} label={emails.length === 1 ? "Email" : `Emails · ${emails.length}`}>
            {emails.map((e, i) => (
              <span key={`${e}-${i}`} className="flex flex-wrap items-center gap-2.5">
                <a href={mailHref(e)} className={CONTACT_LINK}>
                  {e}
                </a>
                <CopyButton value={e} name="email" words />
              </span>
            ))}
          </Way>
        ) : null}
        {phones.length ? (
          <Way icon={Phone} label={phones.length === 1 ? "Phone number" : `Phone numbers · ${phones.length}`}>
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {phones.map((p, i) => (
                // A number is a number with its copy glyph, not a pill.
                <span key={`${p}-${i}`} className="flex h-6 items-center gap-1">
                  <a href={telHref(p)} className={cn("whitespace-nowrap rounded-sm text-base text-ink hover:underline", NUM, ring)}>
                    {p}
                  </a>
                  <CopyButton value={p} name="phone number" />
                </span>
              ))}
            </span>
          </Way>
        ) : null}
        {website ? (
          <Way icon={Globe} label="Website">
            <a href={siteHref(website)} target="_blank" rel="noopener noreferrer nofollow" className={cn(CONTACT_LINK, "flex w-fit items-center gap-1")}>
              {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
              <ArrowUpRight size={14} weight="thin" className="shrink-0" aria-hidden />
            </a>
          </Way>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Contact, the record's last section: a buyer reads what the registers hold, then how to reach the
 * supplier. Locked, it says how many details are on file and never a value; when the database returned
 * the details (0145: an admin, or a Growth or Enterprise buyer) they are drawn.
 */
export function ContactSection({ model, level }: Omit<SectionProps, "today">) {
  const counts = model.contact.counts;
  const onFile = counts ? onFileWords(counts.emails, counts.phones, counts.website, counts.representatives) : null;
  return (
    <Section id="contact" title="Contact" level={level}>
      {model.contact.details ? (
        <ContactCard details={model.contact.details} />
      ) : (
        <div className="mx-3 flex items-start gap-3 rounded-[10px] bg-sunken p-4">
          {onFile || !counts ? <Lock size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* An unread count says only that the details are locked: "none on file" would be a claim. */}
            <p className="text-[15px]/[22px] font-medium text-ink">{onFile ?? (counts ? "No email or phone on file" : "Contact details are locked")}</p>
            <p className="text-base text-ink-2">{onFile ? "Locked. " : ""}Send an RFQ and the supplier replies in Messages.</p>
            {/* A reader who may see details but has opened the day's allowance of suppliers (0145). */}
            {model.contact.limited ? <p className="pt-1.5 text-base text-ink-2">{CONTACT_LIMIT_WORDS}</p> : null}
          </div>
        </div>
      )}
    </Section>
  );
}
