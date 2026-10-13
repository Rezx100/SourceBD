// The supplier record on a phone (Paper page 35, the supplier drawer): Share and Close in a
// bar that sticks with the name beside them, the three statuses as one short strip that opens Checks,
// the nine tabs, and every section under them on the one page (founder, 12 Oct 2026: the sections reveal
// as the reader scrolls). Drawn beside the desktop record and hidden from 640, so the desktop is untouched.
// It says only what the record's model holds: the boards' placeholder figures (a yearly change, a
// month-by-month chart, a buyer's share, a line's share) are not drawn, and customs figures are per
// supplier and per market, never per HS code. Server-safe; the tabs are the only script.

import { ArrowUpRight, CaretDown, CaretRight, Clock, Factory, FileText, HardHat, Hourglass, Lock, MapPin, Package, ShieldCheck, Storefront, WarningOctagon, X } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Skeleton, ring } from "@/components/kit";
import { ABSENT, CONTACT_LIMIT_WORDS, SourceMark, onFileWords } from "@/components/patterns";
import { hasSourceMark } from "@/components/patterns/source-mark";
import { LinkPending } from "@/components/patterns/link-pending";
import { buyersOf, customsWindow, formatUsdShort, initials } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { ContactDetailsCard } from "./contact-card";
import { CERT_MARK, FACT_ICON } from "./desktop";
import { SECTIONS, certTable, checkRows, exportTiles, factCells, filedWith, headStatuses, memberTiles, sectionCount, type BarPart, type CertLine, type CheckRow, type SectionId } from "./desktop-words";
import { RecordRfqs, SitesPanel, productItems, sourceGroups, type Level } from "./panels";
import { PhoneBar, PhonePanel, PhoneTabLink, PhoneTabStrip, PhoneTabs } from "./phone-tabs";
import { NO_CUSTOMS, UFLPA_LABEL, biggestMarket, marketShares, noCustoms, recordsEnd, rscBehind, rscCards, sanctionListRows, shortDay, uflpaLine, type RscCard, type StatusRow } from "./phone-words";
import { ShareButton } from "./share-button";
import { ShipmentRevealSection } from "./shipment-reveal";
import { staleWords, type TabId } from "./words";

const NUM = "[font-variant-numeric:tabular-nums]";
const TITLE = "text-lg font-medium tracking-tight text-ink";
const CARD = "flex flex-col overflow-clip rounded-[10px] border border-line";
/**
 * A round 36 button in a 44 box. The box is the button and the circle is drawn inside it: with the
 * target hung outside a 36 button, a thumb's touch on the edge did not always land (founder, 13 Oct 2026).
 */
const ROUND_44 = "size-11 bg-transparent active:bg-transparent before:absolute before:inset-1 before:rounded-full before:bg-sunken active:before:bg-line [&>svg]:relative";
const ROUND = cn("relative flex shrink-0 items-center justify-center rounded-full text-ink-2 outline-none", ROUND_44, ring);
/** A document that opens: underlined words, on one line, with a 44 target (Paper page 35, 13 Oct 2026: links, not grey pills). */
const DOC = cn("relative flex shrink-0 items-center gap-1.5 rounded-sm font-medium text-ink before:absolute before:-inset-x-1.5 active:bg-sunken [&>span]:underline [&>span]:decoration-line-strong [&>span]:decoration-1 [&>span]:underline-offset-[3px]", ring);

/** The one pill on the record: this needs a look. Everything else is said in plain words. */
function LookPill({ icon: G, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-caution-tint pl-2 pr-2.5 text-sm font-medium text-caution">
      <G size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
      {children}
    </span>
  );
}

const STATUS_ICON: Record<StatusRow["key"], Icon> = { safety: HardHat, certificates: Hourglass, sanctions: ShieldCheck };
const toneText = (t: StatusRow["tone"], plain = "text-ink") => (t === "caution" ? "text-caution" : t === "sanction" ? "text-sanction" : plain);
const toneIcon = (t: StatusRow["tone"], plain = "text-ink-2") => (t === "caution" ? "text-caution-icon" : t === "sanction" ? "text-sanction" : plain);

/** A section under the first on a tab: a hairline, then its title. */
function Section({ title, count, aside, level: H, children, first = false, tight = false, headClassName }: { title: string; count?: ReactNode; aside?: ReactNode; level: Level; children: ReactNode; first?: boolean; /** The Overview's and Products' sections: 20px above and below the hairline (Paper page 35, 13 Oct 2026). */ tight?: boolean; headClassName?: string }) {
  return (
    <section className={cn("flex flex-col px-5", tight ? "pt-5" : first ? "pt-6" : "pt-7")}>
      <div className={cn("flex items-baseline justify-between gap-3", tight && !first ? "pb-2" : "pb-3.5", !first && "border-t border-line", !first && (tight ? "pt-5" : "pt-7"), headClassName)}>
        <div className="flex items-baseline gap-2">
          <H className={TITLE}>{title}</H>
          {count !== undefined && count !== null ? <span className="text-lg text-ink-3">{count}</span> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A tab that holds nothing, said plainly: the glyph, what is missing, and what that does and does not mean. */
function Empty({ icon: G, title, body, foot, note, level: H, testId }: { icon: Icon; title: string; body: string; foot?: string | null; note?: { title: string; body: string } | null; level: Level; testId?: string }) {
  return (
    <div data-phone-empty={testId} className="flex flex-col items-start gap-3 px-6 pb-8 pt-10">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sunken">
        <G size={28} weight="thin" className="text-ink-2" aria-hidden />
      </span>
      <H className={TITLE}>{title}</H>
      <p className="text-[15px]/[22px] text-ink-2">{body}</p>
      {foot ? <p className="text-xs text-ink-3">{foot}</p> : null}
      {note ? (
        <div className="flex flex-col gap-1 self-stretch rounded-lg bg-subtle p-4">
          <p className="text-base font-medium text-ink">{note.title}</p>
          <p className="text-sm text-ink-2">{note.body}</p>
        </div>
      ) : null}
    </div>
  );
}

function Bar({ pct, tone, className }: { pct: number; tone: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-1.5 shrink-0 overflow-clip rounded-full bg-sunken", className)}>
      <span className={cn("rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

const BAR_TONE: Record<BarPart["tone"], string> = { ink: "bg-ink", "ink-2": "bg-ink-2", "line-strong": "bg-line-strong", sunken: "bg-sunken" };

/** An export tile's 6px bar: one figure against its whole as a meter, several shares as segments. The caption under it says what it shows. */
function TileBar({ parts }: { parts: BarPart[] }) {
  if (parts.some((p) => p.tone === "sunken")) return <Bar pct={parts[0]!.share} tone={BAR_TONE[parts[0]!.tone]} />;
  return (
    <span aria-hidden className="flex h-1.5 shrink-0 gap-0.5 overflow-clip rounded-full">
      {parts.map((p, i) => (
        <span key={i} className={cn("basis-0", BAR_TONE[p.tone])} style={{ flexGrow: p.share }} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- overview */

/** The customs footnotes: the window and the read, and how far behind the records are. */
function CustomsFoot({ model, today, className }: { model: SupplierSheetModel; today: Date; className?: string }) {
  const v = model.volza;
  if (!v) return null;
  const behind = recordsEnd(v, today);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <FileText size={14} weight="thin" className="shrink-0" aria-hidden />
        Customs records, {customsWindow(v)} · read {shortDay(v.fetched_at, today) ?? "date unknown"}
      </p>
      {behind !== null ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-caution">
          <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
          The records end {behind} days ago
        </p>
      ) : null}
    </div>
  );
}

function Overview({ model, today, sectionHref, level }: PanelProps) {
  const v = model.volza;
  // The desktop's four worked-out figures. The fourth is always the biggest market, never the reader's own (founder, 13 Oct 2026).
  const tiles = v ? exportTiles(v, { rank: model.exportRank ?? null, market: biggestMarket(v) }) : [];
  const cells = factCells(model);
  const members = memberTiles(model, today);
  // Who buys from it, once: the brands whose own lists name it and the importers on its customs records,
  // the same company joined into one row (founder, 12 Oct 2026: they were two sections, a scroll apart).
  const buyers = buyersOf(model.products.buyerLists, v);
  const fromCustoms = buyers.filter((b) => b.customs).length;
  const readOf = (code: string | null) => model.sources.find((s) => s.mark.code === code || s.mark.label === code) ?? null;
  return (
    <div className="flex flex-col pb-8">
      {tiles.length > 0 ? (
        <Section
          first
          tight
          title="Exports"
          level={level}
          aside={
            <PhoneTabLink tab="exports" href={sectionHref("exports")} className={cn("-my-3 flex h-11 items-center gap-0.5 rounded-sm text-base/[18px] font-medium text-ink-2 active:bg-sunken", ring)}>
              All exports
              <CaretRight size={16} weight="thin" className="shrink-0" aria-hidden />
            </PhoneTabLink>
          }
        >
          <dl className={cn("grid grid-cols-2 overflow-clip rounded-lg border border-line", NUM)}>
            {tiles.map((t, i) => (
              <div key={t.key} className={cn("flex flex-col px-3.5 py-3", i % 2 === 0 && "border-r border-line", i > 1 && "border-t border-line")}>
                <dt className="text-sm text-ink-3">{t.label}</dt>
                <dd className="pt-1.5 text-xl font-medium tracking-tighter text-ink">{t.value}</dd>
                {t.bar || t.sub ? (
                  <dd className="flex flex-col gap-1.5 pt-2">
                    {t.bar ? <TileBar parts={t.bar} /> : null}
                    {t.sub ? <span className="text-sm text-ink-2">{t.sub}</span> : null}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
          <CustomsFoot model={model} today={today} className="pt-3" />
        </Section>
      ) : null}
      {cells.length > 0 ? (
        <Section first={tiles.length === 0} tight title="Key facts" level={level}>
          <dl data-phone-facts="" className={cn("grid grid-cols-2 gap-x-4", NUM)}>
            {cells.map((f, i) => {
              const G = FACT_ICON[f.label] ?? FileText;
              return (
                // The hairline between two rows runs the section's width: each cell reaches half across the 16px gap.
                <div key={f.label} className={cn("flex min-w-0 flex-col gap-0.5 py-2", i > 1 && "border-t border-line", i > 1 && (i % 2 === 1 ? "-ml-2 pl-2" : i === cells.length - 1 ? "col-span-2" : "-mr-2 pr-2"))}>
                  <dt className="flex items-center gap-1.5 text-sm text-ink-3">
                    {/* Regular weight and the label's own size: a hairline glyph faded out over a 17px figure (founder, 13 Oct 2026). */}
                    <G size={16} className="shrink-0 text-ink-2" aria-hidden />
                    {f.label}
                  </dt>
                  <dd className={cn("text-md", f.empty ? "text-ink-2" : "text-ink")}>{f.value}</dd>
                  {/* "From BKMEA": a bare "BKMEA" beside a figure does not say it is where the figure came from (founder, 12 Oct 2026). */}
                  {f.from ? <dd className="text-xs text-ink-3">{f.from}</dd> : null}
                </div>
              );
            })}
          </dl>
        </Section>
      ) : null}
      {members.length > 0 ? (
        <Section tight title="Memberships" level={level}>
          <ul className="flex flex-col">
            {members.map((m) => (
              <Listed key={`${m.name}-${m.number}`} lead={<SourceMark source={m.mark ?? m.name} lazy className="size-9 rounded-full [&>img]:max-h-[26px] [&>img]:max-w-[26px]" />} title={m.title} href={m.href} opens={m.name}>
                {m.number ? <span className="font-mono text-ink-2">{m.number}</span> : null}
                {m.read ? <span>{m.number ? "· " : ""}read {m.read}</span> : null}
                {m.stale ? <Stale>{m.stale}</Stale> : null}
              </Listed>
            ))}
          </ul>
        </Section>
      ) : null}
      {buyers.length > 0 ? (
        <Section tight title="Buyers" count={buyers.length} level={level}>
          <ul data-phone-buyers="" className="flex flex-col">
            {buyers.map((b) => {
              const s = b.listed ? readOf(b.name) : null;
              // The name people know is the row; the customs record's own name is small beside its source, so the short one is never read as the record's.
              const customs = b.customs ? `${b.listed ? "customs" : "Customs"} records${b.filed ? ` as ${b.filed}` : ""}` : null;
              return (
                <Listed key={b.name} lead={<Disc icon={b.listed ? Storefront : Package} />} title={b.name} href={s?.mark.href ?? null} opens={b.name}>
                  <span>{[b.listed ? "Supplier list" : null, customs, !b.customs && s?.readDate ? `read ${s.readDate}` : null].filter(Boolean).join(" · ")}</span>
                </Listed>
              );
            })}
          </ul>
          {fromCustoms > 0 ? (
            <p className="pt-2 text-xs text-ink-3">
              Customs records name the importer: often an agent or a buying house, not the brand.
              {v && v.buyers !== null && v.buyers > fromCustoms ? ` ${fromCustoms} of ${v.buyers.toLocaleString("en-GB")} shown.` : ""}
            </p>
          ) : null}
        </Section>
      ) : null}
      {model.rfqs.rows.length > 0 ? (
        <div className="px-5 pt-2">
          <RecordRfqs model={model} level={level} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Contact, the last section of the record and a tab of its own (founder, 12 and 13 Oct 2026): a buyer reads what the registers
 * hold, then how to reach the supplier. Locked, it says how many details are on file, never a value;
 * when the database returned the details (0145: an admin, or a Growth or Enterprise buyer) they are drawn.
 */
export function PhoneContact({ model, level }: { model: SupplierSheetModel; level: Level }) {
  const counts = model.contact.counts;
  const onFile = counts ? onFileWords(counts.emails, counts.phones, counts.website, counts.representatives) : null;
  return (
    <section data-phone-contact="" className="flex flex-col pb-8">
      <Section first title="Contact" level={level}>
        {model.contact.details ? (
          <ContactDetailsCard details={model.contact.details} className="rounded-[10px]" />
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-sunken p-4">
            <Lock size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/* An unread count says only that the details are locked: "none on file" would be a claim. */}
              <p className="text-md font-medium text-ink">{onFile ?? "Contact details are locked"}</p>
              <p className="text-base text-ink-2">{onFile ? "Locked. " : ""}Send an RFQ and the supplier replies in Messages.</p>
              {/* A reader who may see details but has opened the day's allowance of suppliers (0145). */}
              {model.contact.limited ? <p className="pt-1.5 text-base text-ink-2">{CONTACT_LIMIT_WORDS}</p> : null}
            </div>
          </div>
        )}
      </Section>
    </section>
  );
}

function Stale({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1 font-medium text-caution">
      <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
      {children}
    </span>
  );
}

function Disc({ icon: G }: { icon: Icon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken">
      <G size={20} weight="thin" className="text-ink-2" aria-hidden />
    </span>
  );
}

/** A membership or a buyer: the register's mark or a glyph, its name, what we hold it from in small words, and the register's own page where the record carries it. */
function Listed({ lead, title, href, opens, children }: { lead: ReactNode; title: string; href: string | null; opens: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-md/[22px] font-medium text-ink">{title}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">{children}</span>
      </span>
      {href ? (
        <a href={href} aria-label={`Open the ${opens} page`} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-2 active:bg-sunken", ring)}>
          <ArrowUpRight size={18} weight="thin" aria-hidden />
        </a>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ checks */

const CHECK_ICON: Record<CheckRow["kind"], Icon> = { safety: HardHat, certificates: Hourglass, sanctions: ShieldCheck };
// The shared helpers say "Worst"; the phone's boards say the fact (founder, 13 Oct 2026). A quiet row has no
// building behind, so the one it leads with is the least fixed.
const furthest = (s: string | null) => s?.replace(/^Worst: /, "Furthest behind: ").replace(/^Worst of /, "Least fixed of ") ?? null;

function CheckBody({ c, children }: { c: CheckRow; children?: ReactNode }) {
  const G = c.tone === "sanction" ? WarningOctagon : c.kind === "sanctions" && !c.quiet ? Clock : CHECK_ICON[c.kind];
  const body = furthest(c.body);
  return (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", toneText(c.tone, "text-ink-3"))}>
          <G size={16} weight={c.tone === "sanction" ? "fill" : "thin"} className={cn("shrink-0", toneIcon(c.tone, "text-ink-3"))} aria-hidden />
          {c.tag}
        </span>
        {children ? null : <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />}
      </span>
      <span className={cn("text-md/[22px]", c.quiet ? "" : "font-medium", c.tone === "sanction" ? "text-sanction" : "text-ink")}>{c.title}</span>
      {c.figure && "pct" in c.figure ? (
        <span className="flex items-center gap-2.5">
          <Bar pct={c.figure.pct} tone={c.quiet ? "bg-ink-2" : "bg-caution-icon"} className="min-w-0 flex-1" />
          <span className={cn("shrink-0 text-sm font-medium text-ink", NUM)}>{c.figure.pct}% fixed</span>
        </span>
      ) : null}
      {body ? <span className="text-sm text-ink-2">{body}</span> : null}
      {children}
      {c.foot ? <span className={cn("text-xs", c.footCaution ? "font-medium text-caution" : "text-ink-3")}>{c.foot}</span> : null}
    </>
  );
}

/**
 * Checks: Safety, Certificates and Sanctions in one card, each said once. A full row where it needs a
 * look, a quiet one where it does not; on a sanctioned record the matches are in the Sanctions row.
 */
function Checks({ model, today, sectionHref, level }: PanelProps) {
  const { rows, looks } = checkRows(model, today);
  const row = "flex flex-col gap-1.5 px-4 py-3";
  return (
    <div className="flex flex-col pb-8">
      <Section first title="Checks" aside={looks > 0 ? <span className="shrink-0 text-sm font-medium text-caution">{looks === 1 ? "1 needs a look" : `${looks} need a look`}</span> : null} level={level}>
        <ul data-phone-checks="" className={CARD}>
          {rows.map((c) => (
            <li key={c.key} className="border-t border-line first:border-t-0">
              {c.tone === "sanction" ? (
                <div className={row}>
                  <CheckBody c={c}>
                    {model.sanctions.length === 0 ? <span className="text-sm text-ink-2">{model.sanctionsEmpty}</span> : null}
                    {model.sanctions.map((s, i) => (
                      <span key={`${s.list}-${s.ref}-${i}`} className="flex flex-col gap-0.5 text-sm text-ink-2">
                        <span className="font-medium text-ink">
                          {s.list}: matched as {s.matchedName}
                        </span>
                        <span className={cn("text-xs text-ink-3", NUM)}>{[s.ref ? `Entry ${s.ref}` : null, s.listedOn ? `listed ${s.listedOn}` : null, s.screenedOn ? `checked ${s.screenedOn}` : null].filter(Boolean).join(" · ")}</span>
                        {s.href ? (
                          <a href={s.href} className={cn("relative w-fit rounded-sm text-sm font-medium text-ink underline decoration-line-strong underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 active:bg-sunken", ring)}>
                            {s.opens === "entry" ? "Open the entry" : "Open the list"}
                          </a>
                        ) : null}
                      </span>
                    ))}
                    <span className="text-sm text-ink-2">The record stays readable for due diligence. Save still works, so the supplier can be tracked.</span>
                  </CheckBody>
                </div>
              ) : (
                <PhoneTabLink tab={c.section} href={sectionHref(c.section)} className={cn(row, "active:bg-sunken", ring)}>
                  <CheckBody c={c} />
                </PhoneTabLink>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ----------------------------------------------------------------- exports */

const SHARE_TONES = ["bg-ink", "bg-ink-2", "bg-ink-3", "bg-line-strong", "bg-line"];

function Exports({ model, today, level }: PanelProps) {
  const v = model.volza;
  const shares = v ? marketShares(v) : [];
  if (!v) {
    return (
      <div className="flex flex-col pb-8">
        {noCustoms(model) ? (
          <Empty
            testId="customs"
            icon={Package}
            title={NO_CUSTOMS.title}
            body={NO_CUSTOMS.body}
            note={model.products.onEpb ? { title: NO_CUSTOMS.epbTitle, body: NO_CUSTOMS.epbBody } : null}
            level={level}
          />
        ) : null}
        {model.shipments ? (
          <div className="px-5 pt-6">
            <ShipmentRevealSection key={model.slug} slug={model.slug} initial={model.shipments} level={level} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col pb-8", NUM)}>
      <section aria-label="Customs exports" className="flex flex-col px-5 pt-6">
        <p className="text-sm text-ink-3">
          {v.fob_usd !== null ? "Export value" : "Shipments"}, {customsWindow(v)}
        </p>
        <p className="pt-1 text-2xl font-medium tracking-tighter text-ink">{v.fob_usd !== null ? formatUsdShort(v.fob_usd) : v.shipments.toLocaleString("en-GB")}</p>
        {v.fob_usd !== null ? <p className="pt-1 text-sm text-ink-2">Free on board, {v.shipments.toLocaleString("en-GB")} shipments, every line together</p> : null}
      </section>
      {shares.length > 0 ? (
        <Section title="Where it goes" level={level}>
          <p className="-mt-3 pb-3.5 text-base text-ink-2">Share of export value, by market</p>
          {shares.every((s) => s.pct !== null) ? (
            <div aria-hidden className="flex h-3.5 shrink-0 gap-0.5 overflow-clip rounded-sm">
              {shares.map((s, i) => (
                <span key={s.name} className={SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)]} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
          ) : null}
          <ul className="flex flex-col pt-2">
            {shares.map((s, i) => (
              <li key={s.name} className="flex min-h-[52px] items-center gap-2.5 border-b border-line last:border-b-0">
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px]", SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)])} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px]/[22px] font-medium text-ink">{s.name}</span>
                  <span className="text-xs text-ink-3">{[`${s.shipments.toLocaleString("en-GB")} shipments`, s.buyers !== null ? `${s.buyers.toLocaleString("en-GB")} buyers` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex flex-col items-end">
                  {s.pct !== null ? <span className="text-[15px]/[22px] font-medium text-ink">{s.pct}%</span> : null}
                  {s.value ? <span className="text-xs text-ink-3">{s.value}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {model.shipments ? (
        <div className="px-5 pt-7">
          <div className="border-t border-line pt-7">
            <ShipmentRevealSection key={model.slug} slug={model.slug} initial={model.shipments} level={level} />
          </div>
        </div>
      ) : null}
      <CustomsFoot model={model} today={today} className="px-5 pt-3.5" />
    </div>
  );
}

/* ------------------------------------------------------------ certificates */

/* ---------------------------------------------------------------- products */

/**
 * Products: what it makes, from the two registers that say so, kept apart because they are different
 * claims and never merged (founder, 13 Oct 2026): the export codes on its EPB page, a row each that opens
 * the line, six until the reader asks for all, then the names it filed with its trade body, as plain words.
 */
function Products({ model, today, level }: PanelProps) {
  const p = model.products;
  // Six lines, and a link that draws them all (`?lines=all`): the page's own switch, so nothing is unfolded by script.
  const lines = p.tiles;
  const items = productItems(p.productList);
  const filed = filedWith(model, today);
  const row = (t: (typeof lines)[number]) => (
    <li key={t.hs} className="border-t border-line first:border-t-0">
      <Link href={model.lineHref(t.hs)} scroll={false} className={cn("flex items-center gap-3 py-1.5 active:bg-sunken", ring)}>
        {t.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 40px catalogue thumbnail, already sized
          <img src={t.thumb} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-10 shrink-0 rounded-lg bg-subtle object-cover" />
        ) : (
          <span aria-hidden className="size-10 shrink-0 rounded-lg bg-subtle" />
        )}
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-md/[22px] font-medium text-ink">{t.short}</span>
          <span className="font-mono text-xs text-ink-3">{t.hs}</span>
        </span>
        <LinkPending />
        <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
      </Link>
    </li>
  );
  const all = "mt-1.5 flex h-11 items-center justify-center gap-1.5 rounded-lg border border-line text-[15px]/[20px] font-medium text-ink active:bg-sunken";
  if (!p.linesUnknown && lines.length === 0 && items.length === 0 && !p.onEpb) {
    return <Empty testId="products" icon={Package} title="Not published. Ask in your RFQ." body="Products they export: not on the EPB exporter list." level={level} />;
  }
  return (
    <div className="flex flex-col pb-8">
      {p.linesUnknown || lines.length > 0 || p.onEpb ? (
        <Section first tight headClassName="pb-2" title="What it ships" count={lines.length > 0 && p.lines > 0 ? p.lines : undefined} aside={lines.length > 0 ? <span className="shrink-0 text-sm text-ink-3">EPB codes · photos illustrate</span> : null} level={level}>
          {p.linesUnknown ? (
            <p className="text-base text-ink-2">The export lines could not be read.</p>
          ) : lines.length === 0 ? (
            <p className="text-base text-ink-2">On the EPB exporter register · no lines on file.</p>
          ) : (
            <>
              <ul data-phone-lines="" className="flex flex-col">
                {lines.map(row)}
              </ul>
              {p.allLinesHref ? (
                <Link href={p.allLinesHref} scroll={false} className={cn(all, ring)}>
                  All {p.lines} lines
                  <CaretDown size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
                </Link>
              ) : null}
            </>
          )}
        </Section>
      ) : null}
      {items.length > 0 ? (
        <Section first={!(p.linesUnknown || lines.length > 0 || p.onEpb)} tight headClassName="pb-2" title={filed.body ? `As filed with ${filed.body}` : "As filed"} count={items.length} aside={filed.read ? <span className={cn("shrink-0 text-sm text-ink-3", NUM)}>read {filed.read}</span> : null} level={level}>
          <p data-phone-filed="" className="text-[15px]/[22px] text-ink">
            {items.join(" · ")}
          </p>
        </Section>
      ) : null}
    </div>
  );
}

const STAMP = "flex h-6 items-center rounded-md bg-subtle px-2 font-mono text-sm/[16px] text-ink";
/** "WRAP" issued by WRAP says nothing: the issuer is named only when it is someone other than the scheme. */
const issuedBy = (c: CertLine) => (c.issuer && c.issuer.split(/\s+/)[0]!.toLowerCase() !== c.scheme.split(/\s+/)[0]!.toLowerCase() ? c.issuer : null);

/**
 * One certificate: its scheme's mark and name, and its state. A pill only when it needs a look; else the
 * state in plain words ("Valid to 13 Jul 2027", "No end date published", "Ended 5 Sep 2026"). Then its
 * number as a stamp, who issued it when that is not the scheme, and when we last checked it beside the
 * document. The certifier's scope text is left to the certificate itself (founder, 12 Oct 2026).
 */
function CertCard({ c, ended = false }: { c: CertLine; ended?: boolean }) {
  const mark = CERT_MARK[c.scheme.split(" ")[0]!];
  const issuer = issuedBy(c);
  const stamps = c.numbers.map((x) => (
    <span key={x} className={STAMP}>
      {x}
    </span>
  ));
  const row = "flex min-h-6 items-center justify-between gap-3";
  const foot = Boolean(c.checked || c.doc);
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border border-line px-4 pt-3", foot ? "pb-1.5" : "pb-3")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {mark ? <SourceMark source={mark} lazy className="size-7 rounded-full [&>img]:max-h-[18px] [&>img]:max-w-[18px]" /> : null}
          <p className={cn("min-w-0 text-[18px]/[26px] font-medium tracking-tight", ended ? "text-ink-2" : "text-ink")}>{c.scheme}</p>
        </div>
        {c.look ? <LookPill icon={Hourglass}>{c.state}</LookPill> : <p className={cn("text-right text-base", c.until && !ended ? "font-medium text-ink" : "text-ink-2")}>{ended ? c.state : c.until ? `Valid to ${c.until}` : "No end date published"}</p>}
      </div>
      {(c.look && c.until) || c.numbers.length > 0 || issuer ? (
        <dl className="flex flex-col gap-1">
          {c.look && c.until ? (
            <div className={row}>
              <dt className="shrink-0 text-sm text-ink-3">Valid until</dt>
              <dd className="text-right text-base font-medium text-caution">{c.until}</dd>
            </div>
          ) : null}
          {c.numbers.length > 2 ? (
            // Three or more: a line of stamps under the label.
            <div className="flex flex-col gap-1.5 pb-0.5">
              <dt className="text-sm text-ink-3">{c.numberLabel}</dt>
              <dd className="flex flex-wrap gap-1.5">{stamps}</dd>
            </div>
          ) : c.numbers.length > 0 ? (
            <div className={row}>
              <dt className="shrink-0 text-sm text-ink-3">{c.numberLabel}</dt>
              <dd className="flex flex-wrap justify-end gap-1.5">{stamps}</dd>
            </div>
          ) : null}
          {issuer ? (
            <div className={row}>
              <dt className="shrink-0 text-sm text-ink-3">Issued by</dt>
              <dd className={cn("text-right text-base", ended ? "text-ink-2" : "text-ink")}>{issuer}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {foot ? (
        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-line">
          <p className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
            {c.checked ? `Checked ${c.checked}` : null}
            {c.checkedNote ? (
              <span className="flex items-center gap-1 font-medium text-caution">
                <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
                {c.checkedNote}
              </span>
            ) : null}
          </p>
          {c.doc ? (
            <a href={c.doc.href} className={cn(DOC, "h-10 text-base before:-inset-y-0.5")}>
              {c.doc.label === "Certificate" ? <FileText size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden /> : <ArrowUpRight size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden />}
              <span>{c.doc.label}</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Certificates({ model, today, level: H }: PanelProps) {
  // The desktop's table, as cards: those held today, then the ones that have ended in a group that is not counted.
  const t = certTable(model, today);
  return (
    <div className="flex flex-col gap-3 px-5 pb-8 pt-6">
      {t.held.length === 0 && t.ended.length === 0 ? (
        <div className="flex flex-col gap-0.5 pb-1">
          <H className={TITLE}>{ABSENT.certificates}</H>
          <p className="text-base text-ink-2">{model.certsEmpty}</p>
          <p className="pt-1 text-xs text-ink-3">{model.certsEmptyChip}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0.5 pb-1">
            <H className={TITLE}>{t.count === 0 ? "None held today" : `${t.count} ${t.count === 1 ? "certification" : "certifications"}`}</H>
            {t.held.length > 0 ? <p className="text-base text-ink-2">Soonest expiry first.{model.certChecks ? " Each one checked with its issuer." : ""}</p> : null}
          </div>
          {t.held.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {t.held.map((c) => (
                <CertCard key={c.key} c={c} />
              ))}
            </ul>
          ) : null}
          {/* Ended: our arithmetic on the last register read, which may predate the end. Said plainly, never a warning, and it stays on the record. */}
          {t.ended.length > 0 ? (
            <section data-phone-ended="" className="flex flex-col gap-3 pt-2">
              <p className="text-sm font-medium text-ink-3">No longer current · not counted above</p>
              <ul className="flex flex-col gap-3">
                {t.ended.map((c) => (
                  <CertCard key={c.key} c={c} ended />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      {/* A building's certificate is not this record's: it is shown under the building's name and is not counted above. */}
      {model.buildingCerts.map((b) => {
        const own = certTable({ ...model, certs: b.certs }, today);
        return (
          <section key={b.building} className="flex flex-col gap-3 pt-2">
            <p className="text-sm font-medium text-ink-3">Held by {b.building} · the building&apos;s own, not counted above</p>
            <ul className="flex flex-col gap-3">
              {own.held.map((c) => (
                <CertCard key={c.key} c={c} />
              ))}
              {own.ended.map((c) => (
                <CertCard key={c.key} c={c} ended />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ safety */

const REPORT: Record<string, string> = { CAP: "Action plan" };
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rscTone = (c: RscCard) => (rscBehind(c) ? "bg-caution-icon" : c.progress === 100 ? "bg-brand-ink" : "bg-line-strong");
const trainingTone = (t: string) => (/complete/i.test(t) ? "text-brand-ink" : /yet|not start/i.test(t) ? "text-caution" : "text-ink");

/** What the register says under a building's figures: the training, the reports that open, the ones it does not hold, the read. */
function RscDetail({ c }: { c: RscCard }) {
  const open = c.links.filter((l) => l.href);
  const missing = c.links.filter((l) => !l.href).map((l) => (REPORT[l.label] ?? l.label).toLowerCase());
  return (
    <>
      {c.training ? (
        <p className="flex items-center justify-between gap-3 pt-0.5 text-base">
          <span className="text-ink-2">Worker safety training</span>
          <span className={cn("text-right font-medium", trainingTone(c.training))}>{sentence(c.training.replace(/^training /, ""))}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-0.5 border-t border-line pt-2">
        {open.length > 0 ? (
          <>
            <p className="text-xs text-ink-3">Inspection reports</p>
            <ul data-phone-reports="" className="flex flex-wrap gap-x-3.5">
              {open.map((l) => (
                <li key={l.label}>
                  <a href={l.href!} className={cn(DOC, "h-[30px] text-sm before:-inset-y-[7px]")}>
                    <span>{REPORT[l.label] ?? l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="text-xs text-ink-3">{[missing.length ? `No ${missing.join(", ")} report on the register` : null, "RSC", c.readDate ? `read ${c.readDate}` : null].filter(Boolean).join(" · ")}</p>
      </div>
    </>
  );
}

function RscFull({ c }: { c: RscCard }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-line px-4 pb-2.5 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[18px]/[26px] font-medium tracking-tight text-ink">{c.name}</p>
          {c.ref ? <p className="font-mono text-xs text-ink-2">RSC {c.ref}</p> : null}
        </div>
        {/* Only "Behind schedule" is a pill: any other status is the register's plain words. */}
        {c.status ? rscBehind(c) ? <LookPill icon={Clock}>{sentence(c.status)}</LookPill> : <span className="shrink-0 pt-1 text-sm text-ink-2">{sentence(c.status)}</span> : null}
      </div>
      {c.progress !== null ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-base text-ink-2">Safety issues fixed</span>
            <span className={cn("text-[18px]/[24px] font-medium tracking-tighter text-ink", NUM)}>{c.progress}%</span>
          </p>
          <Bar pct={c.progress} tone={rscTone(c)} />
        </div>
      ) : null}
      <RscDetail c={c} />
    </li>
  );
}

/** One of many buildings: a row that opens to what the register holds for it. */
function RscRow({ c, open }: { c: RscCard; open: boolean }) {
  const behind = rscBehind(c);
  return (
    <li className="border-t border-line first:border-t-0">
      <details open={open || undefined} className="group/rsc">
        <summary className={cn("flex min-h-14 cursor-pointer list-none items-center gap-3 py-2 pl-4 pr-3 active:bg-sunken [&::-webkit-details-marker]:hidden", ring)}>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex justify-between gap-3">
              <span className="text-[15px]/[20px] font-medium text-ink">{c.name}</span>
              <span className={cn("shrink-0 text-sm/[20px] font-medium", NUM, behind ? "text-caution" : c.progress === 100 ? "text-brand-ink" : "text-ink-2")}>
                {[c.progress !== null ? `${c.progress}%` : null, behind ? "behind" : c.progress === 100 ? "finished" : c.status].filter(Boolean).join(" · ")}
              </span>
            </span>
            {c.progress !== null ? <Bar pct={c.progress} tone={rscTone(c)} className="h-1" /> : null}
          </span>
          <CaretDown size={16} weight="thin" className="shrink-0 text-ink-3 transition-transform group-open/rsc:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          <RscDetail c={c} />
        </div>
      </details>
    </li>
  );
}

function Safety({ model, level: H }: PanelProps) {
  const cards = rscCards(model);
  const behind = cards.filter(rscBehind).length;
  if (cards.length === 0) {
    return (
      <Empty
        testId="rsc"
        icon={HardHat}
        title="Not in the RSC programme"
        body={
          model.rscBuildings.length > 0
            ? `RSC covers ${model.rscBuildings.join(", ")}: the buildings, not this record.`
            : "This factory is not on the RMG Sustainability Council's list, so there are no building inspections or repair progress to show."
        }
        note={{ title: "Not the same as unsafe", body: "RSC covers factories that brands signed up. Ask for fire and building reports in your RFQ." }}
        level={H}
      />
    );
  }
  const many = cards.length > 2;
  // The order is behind schedule first, then the least fixed: said as the fact (founder, 13 Oct 2026).
  const lead = behind ? "Furthest behind first" : "Least fixed first";
  return (
    <div className="flex flex-col gap-3 px-5 pb-8 pt-6">
      <div className="flex flex-col gap-0.5 pb-1">
        <H className={TITLE}>{cards.length === 1 ? "In the RSC programme" : `${cards.length} buildings in the RSC programme`}</H>
        {/* The rows' figures are a bare percentage: what it is a percentage of is said once, over them. */}
        {cards.length > 1 ? <p className="text-base text-ink-2">{many ? `Safety issues fixed, ${lead.toLowerCase()}.${behind ? ` ${behind} behind.` : ""}` : `${lead}.${behind === 2 ? " Both are behind schedule." : behind ? " One is behind schedule." : ""}`}</p> : null}
      </div>
      {many ? (
        <ul className={CARD}>
          {cards.map((c, i) => (
            <RscRow key={`${c.name}-${i}`} c={c} open={i === 0} />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((c, i) => (
            <RscFull key={`${c.name}-${i}`} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- sources */

function SourceLine({ lead, title, sub, note, href }: { lead: ReactNode; title: string; sub?: ReactNode; note?: string | null; href?: string | null }) {
  const body = (
    <>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px]/[20px] font-medium text-ink">{title}</span>
        {sub ? <span className="text-xs text-ink-3">{sub}</span> : null}
      </span>
      {note ? <span className={cn("shrink-0 text-xs font-medium text-caution", NUM)}>{note}</span> : null}
    </>
  );
  const box = "flex min-h-11 items-center gap-2.5 py-1";
  return (
    <li className="border-b border-line">
      {href ? (
        <a href={href} className={cn(box, "active:bg-sunken", ring)}>
          {body}
        </a>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}

/** A brand, and the customs records, have no mark of their own here: their letters on the sunken ground. */
function Letters({ children }: { children: string }) {
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-[10px]/[14px] font-medium text-ink-2">
      {children}
    </span>
  );
}

function Sources({ model, today, level: H }: PanelProps) {
  const v = model.volza;
  const behind = v ? recordsEnd(v, today) : null;
  const lists = sanctionListRows(model, today);
  const uflpa = uflpaLine(model, today);
  const n = model.sources.length;
  const groups = sourceGroups(model.sources);
  return (
    <div className="flex flex-col px-5 pb-8 pt-6">
      <div className="flex flex-col gap-0.5 pb-2">
        <H className={TITLE}>
          {n} {n === 1 ? "source" : "sources"}
        </H>
        <p className="text-base text-ink-2">{n === 0 ? "No register has filed a record for this company." : model.sourcesCaption}</p>
      </div>
      {/* A row a source: its mark, its name, and a note only when its read is stale. Nothing else (Paper page 35, 13 Oct 2026). */}
      {groups.map((g) => (
        <section key={g.kind} aria-label={g.kind} className="flex flex-col pt-3">
          <p className="text-sm font-medium text-ink-3">{g.kind}</p>
          <ul>
            {g.rows.map((s) => (
              <SourceLine
                key={s.mark.code}
                lead={hasSourceMark(s.mark.code) ? <SourceMark source={s.mark.code} lazy className="size-7 rounded-full [&>img]:max-h-[18px] [&>img]:max-w-[18px]" /> : <Letters>{initials(s.mark.label)}</Letters>}
                title={s.mark.label}
                note={staleWords(s.readDate, today)}
                href={s.mark.href}
              />
            ))}
          </ul>
        </section>
      ))}
      {v ? (
        <section aria-label="Customs records" className="flex flex-col pt-3">
          <p className="text-sm font-medium text-ink-3">Customs records</p>
          <ul>
            <SourceLine
              lead={<Letters>CU</Letters>}
              title="Bangladesh customs exports"
              sub={
                <>
                  {customsWindow(v)}
                  {behind !== null ? <span className="font-medium text-caution"> · ends {behind} days ago</span> : null}
                </>
              }
            />
          </ul>
        </section>
      ) : null}
      {lists.length > 0 || uflpa ? (
        <section aria-label="Sanctions lists" data-phone-sanctions="" className="mt-6 flex flex-col gap-2.5 rounded-lg bg-subtle p-4">
          <div className="flex flex-col gap-0.5">
            <p className={cn("flex items-center gap-1.5 text-[15px]/[22px] font-medium", model.sanctioned ? "text-sanction" : "text-ink")}>
              {model.sanctioned ? <WarningOctagon size={16} weight="fill" className="shrink-0" aria-hidden /> : null}
              Sanctions lists · {model.sanctioned ? `on the ${model.sanctions[0]?.list ?? "sanctions list"}` : "not listed"}
            </p>
            <p className="text-sm text-ink-2">Read for every supplier, not only this one</p>
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            {lists.map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <dt className="text-ink">{l.label}</dt>
                <dd className={l.old ? "font-medium text-caution" : "text-ink-2"}>{l.day}</dd>
              </div>
            ))}
            {uflpa ? (
              <div className="flex flex-col">
                <dt className="text-ink">{UFLPA_LABEL}</dt>
                <dd className="text-ink-2">{uflpa}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- the record */

type PanelProps = { model: SupplierSheetModel; today: Date; /** A section's link: the `?tab=` it rides on. */ sectionHref: (id: SectionId) => string; level: Level };

/** Safety, Certificates and Sanctions in a few words each: under the name, and again under the bar once that has scrolled away. */
function StatusStrip({ status }: { status: StatusRow[] }) {
  return (
    <span className="flex h-[30px] overflow-clip rounded-lg bg-subtle">
      {status.map((s, i) => {
        const G = s.tone === "sanction" ? WarningOctagon : STATUS_ICON[s.key];
        return (
          <Fragment key={s.key}>
            {i > 0 ? <span aria-hidden className="h-3.5 w-px shrink-0 self-center bg-line" /> : null}
            <span className="flex flex-auto items-center justify-center gap-1.5 whitespace-nowrap px-2">
              <G size={14} weight={s.tone === "sanction" ? "fill" : "thin"} className={cn("shrink-0", toneIcon(s.tone, "text-ink-3"))} aria-hidden />
              <span className={cn("text-xs", s.tone ? "font-medium" : "", toneText(s.tone, "text-ink-3"))}>{s.short}</span>
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

export function PhoneRecord({
  model,
  page,
  tab,
  tabHref,
  today,
  backHref,
  site,
}: {
  model: SupplierSheetModel;
  /** The record's own page; else the drawer a narrow window gets, which draws the name and Close itself. */
  page: boolean;
  tab: TabId;
  tabHref: (tab: TabId) => string;
  today: Date;
  backHref: string | null;
  site: number | null;
}) {
  const Title = page ? "h1" : "h2";
  const level: Level = page ? "h2" : "h3";
  // What is held today: a certificate that has ended is not in the head (the desktop's rule, `headStatuses`).
  const status = headStatuses(model, today);
  const sectionHref = (id: SectionId) => tabHref(SECTIONS.find((s) => s.id === id)!.tab);
  // The two lines under the name are the desktop's one (`recordSubline`): what it is, then where.
  const fact = (label: string) => model.facts.find((f) => f.label === label)?.value ?? null;
  const type = [model.meta[0]?.text ?? null, fact("Established") ? `founded ${fact("Established")}` : null, fact("Parent group") ? `part of ${fact("Parent group")}` : null].filter(Boolean).join(" · ");
  const place = model.meta.find((m) => m.icon === "address")?.text ?? null;
  const props: PanelProps = { model, today, sectionHref, level };
  // What stays over the sections: on the page the bar (56) and the statuses (42), then the tabs (48).
  // A section lands with the 12px gap over it tucked under the strip, so the strip's hairline is not doubled.
  const under = page ? "scroll-mt-[134px]" : "scroll-mt-9";
  return (
    <PhoneTabs key={model.fullHref} initial={tab} className="flex flex-col sm:hidden">
      {page ? (
        // Its own layer, so the phone moves it with the page instead of repainting it a beat late. It has
        // no ground until the name has left its row: the name's first line is read through it, beside
        // the two buttons, so the record starts at the name and not at an empty bar (founder, 12 Oct 2026).
        <PhoneBar className="sticky top-0 z-raised flex h-14 shrink-0 items-center pl-5 pr-3 [transform:translateZ(0)] data-[stuck]:bg-surface">
          {/* The one cut line on the record: the name again, for the eye only. The whole name is the h1 under the bar. */}
          <p aria-hidden className="min-w-0 flex-1 truncate pr-2 text-xl/[30px] font-semibold tracking-[-0.025em] text-ink opacity-0 group-data-[stuck]/bar:opacity-100">
            {model.name}
          </p>
          <ShareButton href={model.fullHref} className={ROUND_44} />
          <Link href={backHref ?? "/app"} aria-label="Back to search" className={ROUND}>
            <X size={17} weight="thin" aria-hidden />
          </Link>
          <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-full bg-surface pb-3 pl-5 pr-4 group-data-[past]/bar:visible">
            <StatusStrip status={status} />
          </div>
        </PhoneBar>
      ) : null}

      {/* On the page the header starts in the bar's own row: the name beside Share and Close, kept clear of them on every line. */}
      <header className={cn("flex flex-col px-5 pb-6", page ? "-mt-14 pt-2.5" : "pt-1")}>
        {/* In the drawer a narrow window gets, the drawer's own title says only "Supplier": the name is said here too (founder, 12 Oct 2026). */}
        <Title data-phone-name="" className={cn("font-medium tracking-tighter text-ink [overflow-wrap:anywhere]", page ? "pr-[88px] text-2xl/[36px]" : "text-xl/[30px]")}>
          {model.name}
        </Title>
        <div className="flex flex-col gap-1.5 pb-5 pt-2 text-[15px]/[22px] text-ink-2">
          {type ? (
            <p className="flex items-start gap-2">
              <Factory size={18} weight="thin" className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              {type}
            </p>
          ) : null}
          {place ? (
            <p className="flex items-start gap-2">
              <MapPin size={18} weight="thin" className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              {place}
            </p>
          ) : null}
        </div>
        {model.sanctionSample ? <p className="pb-3 text-xs text-ink-2">Sample state. No published supplier is on a sanctions list today; no real company is shown.</p> : null}
        {/* The three statuses in one short strip from the start (founder, 13 Oct 2026: the three rows said what Checks says). It opens Checks. */}
        <PhoneTabLink tab="checks" href={sectionHref("checks")} aria-label={`Checks: ${status.map((s) => s.short).join(", ")}`} className={cn("relative block rounded-lg before:absolute before:inset-x-0 before:-inset-y-[7px] active:opacity-70", ring)}>
          <span data-phone-summary="" className="block">
            <StatusStrip status={status} />
          </span>
        </PhoneTabLink>
      </header>

      <PhoneTabStrip className={page ? "top-[98px]" : "top-0"} tabs={SECTIONS.map((t) => ({ id: t.id, label: t.label, href: sectionHref(t.id), count: (t.id === "sites" || t.id === "sources" ? sectionCount(model, t.id) : null) ?? undefined }))} />

      {/* Every section, in tab order: a tab jumps to one and the strip follows the scroll through them. What parts
          one from the next is a gap of the page's own ground between two hairlines, edge to edge (founder, 12 Oct
          2026: the solid grey band read as a bar, not as a pause). */}
      <div data-phone-panels="" className="flex flex-col [&>*+*]:before:block [&>*+*]:before:h-3 [&>*+*]:before:border-y [&>*+*]:before:border-line [&>*+*]:before:bg-subtle [&>*+*]:before:content-['']">
        <PhonePanel id="overview" label="Overview" className={under}>
          <Overview {...props} />
        </PhonePanel>
        <PhonePanel id="exports" label="Exports" className={under}>
          <Exports {...props} />
        </PhonePanel>
        <PhonePanel id="products" label="Products" className={under}>
          <Products {...props} />
        </PhonePanel>
        <PhonePanel id="certificates" label="Certificates" className={under}>
          <Certificates {...props} />
        </PhonePanel>
        <PhonePanel id="checks" label="Checks" className={under}>
          <Checks {...props} />
        </PhonePanel>
        <PhonePanel id="safety" label="Safety" className={under}>
          <Safety {...props} />
        </PhonePanel>
        {/* The map is not built until the reader is a screen away from it. */}
        <PhonePanel id="sites" label="Sites" lazy className={under}>
          <div className="px-5 pb-8 pt-6">
            <SitesPanel model={model} tabHref={tabHref} site={site} wide={false} level={level} />
          </div>
        </PhonePanel>
        <PhonePanel id="sources" label="Sources" className={under}>
          <Sources {...props} />
        </PhonePanel>
        <PhonePanel id="contact" label="Contact" className={under}>
          <PhoneContact model={model} level={level} />
        </PhonePanel>
      </div>
      <div data-phone-end="" aria-hidden />
    </PhoneTabs>
  );
}

/** The record while it is read (board `d-loading`): the lines under the name, the tabs' place, four tiles and two rows. */
export function PhoneRecordSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col", className)}>
      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-2">
        <Skeleton className="h-3.5 w-60 max-w-full" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-[150px] rounded-full" />
          <Skeleton className="h-8 w-[120px] rounded-full" />
        </div>
      </div>
      <div className="h-12 shrink-0 border-b border-line" />
      <div className="flex flex-col gap-3.5 px-5 pt-7">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 overflow-clip rounded-lg border border-line">
          {["w-[70px]", "w-[50px]", "w-14", "w-[76px]"].map((w, i) => (
            <div key={i} className={cn("flex h-[120px] flex-col gap-2.5 p-3.5", i % 2 === 0 && "border-r border-line", i > 1 && "border-t border-line")}>
              <Skeleton className="h-3 w-[90px]" />
              <Skeleton className={cn("h-6", w)} />
            </div>
          ))}
        </div>
        {["w-[220px]", "w-[180px]"].map((w) => (
          <div key={w} className="flex gap-3 pt-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={cn("h-3.5 max-w-full", w)} />
              <Skeleton className="h-3 w-60 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
