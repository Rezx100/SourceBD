// The supplier record on a phone (Paper page 35, the supplier drawer, 15 boards): Share and Close in a
// bar that sticks with the name beside them, the three statuses as rows that jump to their section,
// the tabs, and every section under them on the one page (founder, 12 Oct 2026: the sections reveal
// as the reader scrolls). Drawn beside the desktop record and hidden from 640, so the desktop is untouched.
// It says only what the record's model holds: the boards' placeholder figures (a yearly change, a
// month-by-month chart, a buyer's share, a line's share) are not drawn, and customs figures are per
// supplier and per market, never per HS code. Server-safe; the tabs are the only script.

import { ArrowUpRight, CaretDown, CaretRight, Clock, Factory, FileText, HardHat, Hourglass, IdentificationBadge, ListChecks, Lock, MapPin, Package, ShieldCheck, Storefront, WarningOctagon, X } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CertChip, Skeleton, ring } from "@/components/kit";
import { ABSENT, onFileWords } from "@/components/patterns";
import { certShort } from "@/components/patterns/words";
import { LinkPending } from "@/components/patterns/link-pending";
import { brandsInCustoms, customsBuyers, customsWindow, formatDay, formatUsdShort } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { ProductsPanel, RecordRfqs, SanctionEvidence, SitesPanel, sourceGroups, type Level } from "./panels";
import { PhoneBar, PhonePanel, PhoneTabLink, PhoneTabStrip, PhoneTabs } from "./phone-tabs";
import { NO_CUSTOMS, UFLPA_LABEL, certGroups, customsTiles, lookCards, marketShares, noCustoms, phoneStatus, recordsEnd, rscBehind, rscCards, sanctionListRows, shortDay, uflpaLine, type CertGroup, type LookCard, type RscCard, type StatusRow } from "./phone-words";
import { ShareButton } from "./share-button";
import { ShipmentRevealSection } from "./shipment-reveal";
import { TABS, keyFacts, staleWords, tabCount, type TabId } from "./words";

const NUM = "[font-variant-numeric:tabular-nums]";
const TITLE = "text-lg font-medium tracking-tight text-ink";
const CARD = "flex flex-col overflow-clip rounded-[10px] border border-line";
/** A round 36 button with a 44 target (Share's own shape). */
const ROUND = cn("relative flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 outline-none before:absolute before:-inset-1 active:bg-line", ring);
/** A pill that opens a register's own page. */
const PILL = cn("relative inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken pl-2.5 pr-3 text-sm font-medium text-ink before:absolute before:inset-x-0 before:-inset-y-1 active:bg-line", ring);

const STATUS_ICON: Record<StatusRow["key"], Icon> = { safety: HardHat, certificates: Hourglass, sanctions: ShieldCheck };
const STATUS_TAB: Record<StatusRow["key"], TabId> = { safety: "safety", certificates: "certificates", sanctions: "sources" };
const toneText = (t: StatusRow["tone"], plain = "text-ink") => (t === "caution" ? "text-caution" : t === "sanction" ? "text-sanction" : plain);
const toneIcon = (t: StatusRow["tone"], plain = "text-ink-2") => (t === "caution" ? "text-caution-icon" : t === "sanction" ? "text-sanction" : plain);

/** A section under the first on a tab: a hairline, then its title. */
function Section({ title, count, aside, level: H, children, first = false }: { title: string; count?: ReactNode; aside?: ReactNode; level: Level; children: ReactNode; first?: boolean }) {
  return (
    <section className={cn("flex flex-col px-5", first ? "pt-6" : "pt-7")}>
      <div className={cn("flex items-baseline justify-between gap-3 pb-3.5", !first && "border-t border-line pt-7")}>
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

/* ---------------------------------------------------------------- overview */

const LOOK_ICON: Record<LookCard["kind"], Icon> = { safety: HardHat, certificate: Hourglass, sanctions: Clock };

function Look({ card, href }: { card: LookCard; href: string }) {
  const G = LOOK_ICON[card.kind];
  return (
    <li className="border-t border-line first:border-t-0">
      <PhoneTabLink tab={card.tab} href={href} className={cn("flex flex-col gap-2.5 p-4 active:bg-sunken", ring)}>
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-caution">
            <G size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
            {card.tag}
          </span>
          <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
        </span>
        <span className="text-md/[22px] font-medium text-ink">{card.title}</span>
        {card.progress ? (
          <span className="flex flex-col gap-1.5">
            <span className="flex justify-between gap-3 text-sm">
              <span className="text-ink-2">{card.progress.label}</span>
              <span className={cn("font-medium text-ink", NUM)}>{card.progress.pct}%</span>
            </span>
            <Bar pct={card.progress.pct} tone="bg-caution-icon" />
          </span>
        ) : null}
        {card.figure ? (
          <span className="flex items-baseline gap-1.5">
            <span className={cn("text-xl/[28px] font-medium tracking-tighter text-caution", NUM)}>{card.figure.n}</span>
            <span className="text-sm text-ink-2">{card.figure.words}</span>
          </span>
        ) : null}
        {card.body ? <span className="text-sm text-ink-2">{card.body}</span> : null}
        {card.foot ? <span className={cn("text-xs", card.footCaution ? "font-medium text-caution" : "text-ink-3")}>{card.foot}</span> : null}
      </PhoneTabLink>
    </li>
  );
}

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

function Overview({ model, today, tabHref, level }: PanelProps) {
  const v = model.volza;
  const tiles = v ? customsTiles(v, today) : [];
  const looks = lookCards(model, today);
  const facts = keyFacts(model);
  const members = facts.find((f) => f.label === "Memberships")?.values.flatMap((x) => (x.membership ? [x.membership] : [])) ?? [];
  const brands = model.products.buyerLists;
  const agreed = brandsInCustoms(brands, v);
  // The brands' lists have a section of their own here, and the customs buyers are the Exports section's, a scroll away.
  const rows = facts.filter((f) => f.label !== "Memberships" && f.label !== "Brand supplier lists" && f.label !== "Buyers in shipment records");
  const counts = model.contact.counts;
  const onFile = counts ? onFileWords(counts.emails, counts.phones, counts.website, counts.representatives) : null;
  const readOf = (code: string | null) => model.sources.find((s) => s.mark.code === code || s.mark.label === code) ?? null;
  return (
    <div className="flex flex-col pb-8">
      {model.sanctioned ? (
        <div className="px-5 pt-6">
          <SanctionEvidence model={model} level={level} anchor={false} />
        </div>
      ) : null}
      {tiles.length > 0 ? (
        <Section
          first
          title="Exports"
          level={level}
          aside={
            <PhoneTabLink tab="exports" href={tabHref("exports")} className={cn("-my-3 flex h-11 items-center gap-0.5 rounded-sm text-base/[18px] font-medium text-ink-2 active:bg-sunken", ring)}>
              All exports
              <CaretRight size={16} weight="thin" className="shrink-0" aria-hidden />
            </PhoneTabLink>
          }
        >
          <dl className={cn("grid grid-cols-2 overflow-clip rounded-lg border border-line", NUM)}>
            {tiles.map((t, i) => (
              <div key={t.label} className={cn("flex min-h-[120px] flex-col justify-between gap-2.5 px-3.5 pb-3 pt-3.5", i % 2 === 0 && "border-r border-line", i > 1 && "border-t border-line")}>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-sm text-ink-3">{t.label}</dt>
                  <dd className="text-xl font-medium tracking-tighter text-ink">{t.value}</dd>
                </div>
                {t.sub ? <dd className="text-sm text-ink-2">{t.sub}</dd> : null}
              </div>
            ))}
          </dl>
          <CustomsFoot model={model} today={today} className="pt-3" />
        </Section>
      ) : null}
      {looks.length > 0 ? (
        <Section first={tiles.length === 0} title="Needs a look" count={looks.length} aside={<span className="text-sm text-ink-3">Worst first</span>} level={level}>
          <ul className={CARD}>
            {looks.map((c) => (
              <Look key={c.key} card={c} href={tabHref(c.tab)} />
            ))}
          </ul>
        </Section>
      ) : null}
      <Section first={tiles.length === 0 && looks.length === 0} title="Key facts" level={level}>
        <dl className="-mt-1 flex flex-col">
          {rows.map((f) => {
            const from = f.source?.replace(/^From /, "") ?? null;
            const beside = from !== null && from.length <= 8;
            return (
              <div key={f.label} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <dt className="text-sm text-ink-3">{f.label}</dt>
                  {f.values.length ? (
                    f.values.map((x) => (
                      <dd key={x.text} className={cn("text-md text-ink", x.mono && "font-mono text-base")}>
                        {x.text}
                      </dd>
                    ))
                  ) : (
                    <dd className="text-md text-ink-2">{f.empty}</dd>
                  )}
                  {from && !beside ? <dd className="text-xs text-ink-3">{from}</dd> : null}
                </div>
                {beside ? <dd className="w-14 shrink-0 text-right text-xs text-ink-3">{from}</dd> : null}
              </div>
            );
          })}
        </dl>
      </Section>
      {members.length + brands.length > 0 ? (
        <Section title="Memberships and brand lists" level={level}>
          <ul className="-mt-2 flex flex-col">
            {members.map((m) => {
              const s = readOf(m.mark);
              const stale = staleWords(s?.readDate ?? null, today);
              return (
                <Listed key={`${m.name}-${m.number}`} icon={IdentificationBadge} title={[m.name, m.qualifier].filter(Boolean).join(" ")} href={s?.mark.href ?? null} opens={m.name}>
                  {m.number ? <span className="font-mono text-ink-2">{m.number}</span> : null}
                  {s?.readDate && !stale ? <span>{m.number ? "· " : ""}read {s.readDate}</span> : null}
                  {stale ? <Stale>{stale}</Stale> : null}
                </Listed>
              );
            })}
            {brands.map((b) => {
              const s = readOf(b);
              return (
                <Listed key={b} icon={Storefront} title={b} href={s?.mark.href ?? null} opens={b}>
                  <span>{[agreed.has(b) ? "Also in shipment records" : "Supplier list", s?.readDate ? `read ${s.readDate}` : null].filter(Boolean).join(" · ")}</span>
                </Listed>
              );
            })}
          </ul>
        </Section>
      ) : null}
      {model.rfqs.rows.length > 0 ? (
        <div className="px-5 pt-2">
          <RecordRfqs model={model} level={level} />
        </div>
      ) : null}
      <Section title="Contact" level={level}>
        <div className="flex items-start gap-3 rounded-lg bg-sunken p-4">
          <Lock size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* An unread count says only that the details are locked: "none on file" would be a claim. */}
            <p className="text-md font-medium text-ink">{onFile ?? "Contact details are locked"}</p>
            <p className="text-base text-ink-2">{onFile ? "Locked. " : ""}Send an RFQ and the supplier replies in Messages.</p>
          </div>
        </div>
      </Section>
    </div>
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

/** A membership or a brand's list: its glyph, its name, the number and the read, and the register's own page where the record carries it. */
function Listed({ icon: G, title, href, opens, children }: { icon: Icon; title: string; href: string | null; opens: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken">
        <G size={20} weight="thin" className="text-ink-2" aria-hidden />
      </span>
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

/* ----------------------------------------------------------------- exports */

const SHARE_TONES = ["bg-ink", "bg-ink-2", "bg-ink-3", "bg-line-strong", "bg-line"];

function Exports({ model, today, level }: PanelProps) {
  const v = model.volza;
  const p = model.products;
  const shares = v ? marketShares(v) : [];
  const buyers = customsBuyers(v);
  const small = v?.small_orders ?? null;
  const lines = (
    <Section first={!v && !noCustoms(model) && !model.shipments} title="What it ships" count={p.lines > 0 ? p.lines : undefined} level={level}>
      {p.linesUnknown ? (
        <p className="text-base text-ink-2">The export lines could not be read.</p>
      ) : p.lines === 0 ? (
        <p className="text-base text-ink-2">{p.onEpb ? "On the EPB exporter register · no lines on file." : "Products they export: not on the EPB exporter list."}</p>
      ) : (
        <>
          <p className="-mt-3 pb-3.5 text-base text-ink-2">Product codes on its EPB exporter page. Each opens the line.</p>
          <ul className="flex flex-wrap gap-2">
            {p.tiles.map((t) => (
              <li key={t.hs}>
                <Link href={model.lineHref(t.hs)} scroll={false} className={cn("relative flex h-9 items-center gap-2 rounded-full bg-sunken px-3 before:absolute before:inset-x-0 before:-inset-y-1 active:bg-line", ring)}>
                  <span className="font-mono text-xs text-ink-3">{t.hs}</span>
                  <span className="text-base font-medium text-ink">{t.short}</span>
                  <LinkPending />
                </Link>
              </li>
            ))}
          </ul>
          {p.allLinesHref ? (
            <Link href={p.allLinesHref} scroll={false} className={cn("mt-3 flex h-11 items-center justify-center gap-1.5 rounded-lg border border-line text-base font-medium text-ink active:bg-sunken", ring)}>
              All {p.lines} lines
              <CaretDown size={16} weight="thin" className="shrink-0" aria-hidden />
            </Link>
          ) : null}
        </>
      )}
    </Section>
  );
  if (!v) {
    return (
      <div className="flex flex-col pb-8">
        {noCustoms(model) ? (
          <Empty
            testId="customs"
            icon={Package}
            title={NO_CUSTOMS.title}
            body={NO_CUSTOMS.body}
            note={p.onEpb ? { title: NO_CUSTOMS.epbTitle, body: NO_CUSTOMS.epbBody } : null}
            level={level}
          />
        ) : null}
        {model.shipments ? (
          <div className="px-5 pt-6">
            <ShipmentRevealSection key={model.slug} slug={model.slug} initial={model.shipments} level={level} />
          </div>
        ) : null}
        {lines}
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
      {buyers.length > 0 ? (
        <Section title="Buyers" count={v.buyers !== null ? `of ${v.buyers.toLocaleString("en-GB")}` : undefined} level={level}>
          <ul className="-mt-1 flex flex-wrap gap-2">
            {buyers.map((b) => (
              <li key={b} className="flex min-h-8 items-center rounded-full bg-subtle px-3 py-1 text-base font-medium text-ink">
                {b}
              </li>
            ))}
          </ul>
          <p className="pt-3 text-xs text-ink-3">As named on customs records: often an importer or an agent, not the brand.</p>
        </Section>
      ) : null}
      {lines}
      {small && small.of > 0 ? (
        <Section title="Order size" level={level}>
          <div className="-mt-0.5 flex items-baseline justify-between gap-3 pb-2">
            <p className="text-base text-ink-2">Shipments under {small.under_pcs.toLocaleString("en-GB")} pieces</p>
            <p className="text-xl font-medium tracking-tighter text-ink">{Math.round((100 * small.shipments) / small.of)}%</p>
          </div>
          <Bar pct={(100 * small.shipments) / small.of} tone="bg-ink-2" className="h-2.5" />
          <p className="pt-2 text-sm text-ink-3">
            {small.shipments.toLocaleString("en-GB")} of {small.of.toLocaleString("en-GB")} shipments
          </p>
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

/**
 * One certificate: its scheme and its state in a few words, then the three facts a buyer checks (the
 * date, the number, who issued it) and when we last saw it. The certifier's scope text is left to the
 * certificate itself: a buyer in this trade knows what the scheme covers (founder, 12 Oct 2026).
 */
function CertCard({ g, today }: { g: CertGroup; today: Date }) {
  const c = g.rows[0]!;
  const gots = /^gots/i.test(g.scheme);
  const day = formatDay(c.expiresOn);
  const facts: [string, string, string][] = g.listed
    ? []
    : ([
        [g.state === "expired" ? "Expired on" : "Valid until", day ?? "", cn("text-base font-medium", g.state === "valid" ? "text-ink" : "text-caution")],
        [gots ? "Licence" : "Certificate", c.number ?? "", "font-mono text-sm/[20px] text-ink"],
        ["Issued by", c.issuer ?? "", "text-base text-ink"],
      ] satisfies [string, string, string][]).filter((f) => f[1]);
  const numbers = g.rows.flatMap((r) => (r.number ? [r.number] : []));
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line px-4 pb-3 pt-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[17px]/[24px] font-medium tracking-tight text-ink">{g.scheme}</p>
        <CertChip state={g.state} className="shrink-0">
          {g.listed ? (g.rows.length > 1 ? `${g.rows.length} listings` : "Listed") : certShort(c.expiresOn, today, c.delistedOn)}
        </CertChip>
      </div>
      {facts.length > 0 ? (
        <dl className="flex flex-col gap-1.5">
          {facts.map(([label, value, tone]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="shrink-0 text-sm text-ink-3">{label}</dt>
              <dd className={cn("text-right", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {g.listed && numbers.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {numbers.map((n) => (
            <li key={n} className="flex h-7 items-center rounded-md bg-subtle px-2.5 font-mono text-sm/[16px] text-ink">
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      {c.check || c.documentUrl ? (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
          <p className={cn("text-xs", c.check?.caution ? "font-medium text-caution" : "text-ink-3")}>{c.check ? c.check.text.charAt(0).toUpperCase() + c.check.text.slice(1) : ""}</p>
          {c.documentUrl ? (
            <a href={c.documentUrl} className={cn(PILL, "shrink-0")}>
              {g.listed ? <ArrowUpRight size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden /> : <FileText size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden />}
              {g.listed ? "Listing" : (c.documentLabel ?? "Certificate")}
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Certificates({ model, today, level: H }: PanelProps) {
  const groups = certGroups(model, today);
  const n = model.certs.length;
  const expired = groups.filter((g) => g.state === "expired").length;
  return (
    <div className="flex flex-col gap-3 px-5 pb-8 pt-6">
      {n === 0 ? (
        <div className="flex flex-col gap-0.5 pb-1">
          <H className={TITLE}>{ABSENT.certificates}</H>
          <p className="text-base text-ink-2">{model.certsEmpty}</p>
          <p className="pt-1 text-xs text-ink-3">{model.certsEmptyChip}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0.5 pb-1">
            <H className={TITLE}>
              {n} {n === 1 ? "certification" : "certifications"}
            </H>
            <p className="text-base text-ink-2">{expired ? `${expired} expired. Expired and expiring come first.` : `Soonest expiry first.${model.certChecks ? " Each one checked with its issuer." : ""}`}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <CertCard key={`${g.scheme}-${g.rows[0]!.number}-${g.rows[0]!.expiresOn}`} g={g} today={today} />
            ))}
          </ul>
        </>
      )}
      {/* A building's certificate is not this record's: it is shown under the building's name and is not counted above. */}
      {model.buildingCerts.map((b) => (
        <section key={b.building} className="flex flex-col gap-3 pt-2">
          <p className="text-sm font-medium text-ink-3">Held by {b.building} · the building&apos;s own, not counted above</p>
          <ul className="flex flex-col gap-3">
            {certGroups({ ...model, certs: b.certs }, today).map((g) => (
              <CertCard key={`${g.scheme}-${g.rows[0]!.number}-${g.rows[0]!.expiresOn}`} g={g} today={today} />
            ))}
          </ul>
        </section>
      ))}
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
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {open.length > 0 ? (
          <>
            <p className="text-xs text-ink-3">Inspection reports</p>
            <ul className="flex flex-wrap gap-2">
              {open.map((l) => (
                <li key={l.label}>
                  <a href={l.href!} className={PILL}>
                    {l.label === "CAP" ? <ListChecks size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden /> : <FileText size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden />}
                    {REPORT[l.label] ?? l.label}
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
    <li className="flex flex-col gap-3.5 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[18px]/[26px] font-medium tracking-tight text-ink">{c.name}</p>
          {c.ref ? <p className="font-mono text-xs text-ink-2">RSC {c.ref}</p> : null}
        </div>
        {c.status ? (
          <span className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-2.5 text-sm font-medium", rscBehind(c) ? "bg-caution-tint text-caution" : "bg-subtle text-ink-2")}>
            {rscBehind(c) ? <Clock size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden /> : null}
            {sentence(c.status)}
          </span>
        ) : null}
      </div>
      {c.progress !== null ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-base text-ink-2">Safety issues fixed</span>
            <span className={cn("text-lg font-medium tracking-tighter text-ink", NUM)}>{c.progress}%</span>
          </p>
          <Bar pct={c.progress} tone={rscTone(c)} className="h-2.5" />
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
  return (
    <div className="flex flex-col gap-3 px-5 pb-8 pt-6">
      <div className="flex flex-col gap-0.5 pb-1">
        <H className={TITLE}>{cards.length === 1 ? "In the RSC programme" : `${cards.length} buildings in the RSC programme`}</H>
        {cards.length > 1 ? <p className="text-base text-ink-2">{behind ? `${behind} behind schedule. ` : ""}Worst first.</p> : null}
      </div>
      {many ? (
        <>
          <div aria-hidden className="flex h-2 shrink-0 gap-1">
            {cards.map((c, i) => (
              <span key={i} className={cn("flex-1 rounded-full", rscTone(c))} />
            ))}
          </div>
          <ul className={CARD}>
            {cards.map((c, i) => (
              <RscRow key={`${c.name}-${i}`} c={c} open={i === 0} />
            ))}
          </ul>
        </>
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

function SourceLine({ title, sub, day, note, href }: { title: string; sub: ReactNode; day: string | null; note?: string | null; href?: string | null }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px]/[22px] font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-3 [overflow-wrap:anywhere]">{sub}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        {day ? <span className="text-sm text-ink-2">{day}</span> : null}
        {note ? <span className="text-xs font-medium text-caution">{note}</span> : null}
      </span>
    </>
  );
  const box = "flex min-h-[60px] items-center gap-3 py-2";
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

function Sources({ model, today, level: H }: PanelProps) {
  const v = model.volza;
  const behind = v ? recordsEnd(v, today) : null;
  const lists = sanctionListRows(model, today);
  const uflpa = uflpaLine(model, today);
  const n = model.sources.length;
  const kind = "pb-1 text-sm font-medium text-ink-3";
  return (
    <div className="flex flex-col px-5 pb-8 pt-6">
      <div className="flex flex-col gap-0.5 pb-2">
        <H className={TITLE}>
          {n} {n === 1 ? "source" : "sources"}
        </H>
        <p className="text-base text-ink-2">{n === 0 ? "No register has filed a record for this company." : model.sourcesCaption}</p>
      </div>
      {sourceGroups(model.sources).map((g) => (
        <section key={g.kind} aria-label={g.kind} className="flex flex-col pt-4">
          <p className={kind}>{g.kind}</p>
          <ul>
            {g.rows.map((s) => {
              const stale = staleWords(s.readDate, today);
              return (
                <SourceLine
                  key={s.mark.code}
                  title={s.mark.label}
                  sub={
                    <>
                      {s.name !== s.mark.label ? s.name : null}
                      {s.refs.length ? <span className="font-mono">{s.name !== s.mark.label ? " · " : ""}{s.refs.join(", ")}</span> : null}
                    </>
                  }
                  day={s.readDate}
                  note={stale?.replace(/^read /, "")}
                  href={s.mark.href}
                />
              );
            })}
          </ul>
        </section>
      ))}
      {v ? (
        <section aria-label="Customs records" className="flex flex-col pt-4">
          <p className={kind}>Customs records</p>
          <ul>
            <SourceLine title="Bangladesh customs exports" sub={`Shipment records, ${customsWindow(v)}`} day={shortDay(v.fetched_at, today)} note={behind !== null ? `ends ${behind} days ago` : null} />
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

type PanelProps = { model: SupplierSheetModel; today: Date; tabHref: (tab: TabId) => string; level: Level };

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
  const status = phoneStatus(model, today);
  // The two lines under the name are the desktop's one (`recordSubline`): what it is, then where.
  const fact = (label: string) => model.facts.find((f) => f.label === label)?.value ?? null;
  const type = [model.meta[0]?.text ?? null, fact("Established") ? `founded ${fact("Established")}` : null, fact("Parent group") ? `part of ${fact("Parent group")}` : null].filter(Boolean).join(" · ");
  const place = model.meta.find((m) => m.icon === "address")?.text ?? null;
  const props: PanelProps = { model, today, tabHref, level };
  // What stays over the sections: on the page the bar (56) and the short statuses (42), then the strip (48).
  // A section lands with its 8px band tucked under the strip, so the strip's hairline is not doubled.
  const under = page ? "scroll-mt-[138px]" : "scroll-mt-10";
  return (
    <PhoneTabs key={model.fullHref} initial={tab} className="flex flex-col sm:hidden">
      {page ? (
        // Its own layer, so the phone moves it with the page instead of repainting it a beat late. It has
        // no ground until the name has left its row: the name's first line is read through it, beside
        // the two buttons, so the record starts at the name and not at an empty bar (founder, 12 Oct 2026).
        <PhoneBar className="sticky top-0 z-raised flex h-14 shrink-0 items-center gap-2 pl-5 pr-4 [transform:translateZ(0)] data-[stuck]:bg-surface">
          {/* The one cut line on the record: the name again, for the eye only. The whole name is the h1 under the bar. */}
          <p aria-hidden className="min-w-0 flex-1 truncate pr-1 text-xl/[30px] font-semibold tracking-[-0.025em] text-ink opacity-0 group-data-[stuck]/bar:opacity-100">
            {model.name}
          </p>
          <ShareButton href={model.fullHref} />
          <Link href={backHref ?? "/app"} aria-label="Back to search" className={ROUND}>
            <X size={17} weight="thin" aria-hidden />
          </Link>
          <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-full bg-surface pb-3 pl-5 pr-4 group-data-[past]/bar:visible">
            <div className="flex h-[30px] overflow-clip rounded-lg bg-subtle">
              {status.map((s, i) => {
                const G = STATUS_ICON[s.key];
                return (
                  <Fragment key={s.key}>
                    {i > 0 ? <span className="h-3.5 w-px shrink-0 self-center bg-line" /> : null}
                    <span className="flex flex-auto items-center justify-center gap-1.5 whitespace-nowrap px-2">
                      <G size={14} weight="thin" className={cn("shrink-0", toneIcon(s.tone, "text-ink-3"))} aria-hidden />
                      <span className={cn("text-xs", s.tone ? "font-medium" : "", toneText(s.tone, "text-ink-3"))}>{s.short}</span>
                    </span>
                  </Fragment>
                );
              })}
            </div>
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
        <ul aria-label="Summary" data-phone-summary="" className={CARD}>
          {status.map((s) => {
            const G = s.tone === "sanction" ? WarningOctagon : STATUS_ICON[s.key];
            const to = s.tone === "sanction" ? "overview" : STATUS_TAB[s.key];
            return (
              <li key={s.key} className="border-t border-line first:border-t-0">
                <PhoneTabLink tab={to} href={tabHref(to)} className={cn("flex min-h-12 items-center gap-2.5 pl-3.5 pr-2.5 active:bg-sunken", ring)}>
                  <G size={18} weight="thin" className={cn("shrink-0", toneIcon(s.tone))} aria-hidden />
                  <span className="w-24 shrink-0 text-base text-ink-3">{s.label}</span>
                  <span className="flex min-w-0 flex-1 flex-col items-end py-[7px] text-right">
                    <span className={cn("text-base font-medium", toneText(s.tone))}>{s.value}</span>
                    {s.sub ? <span className="text-xs text-ink-3">{s.sub}</span> : null}
                  </span>
                  <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                </PhoneTabLink>
              </li>
            );
          })}
        </ul>
      </header>

      <PhoneTabStrip className={page ? "top-[98px]" : "top-0"} tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: tabHref(t.id), count: tabCount(model, t.id) ?? undefined }))} />

      {/* Every section, in tab order: a tab jumps to one and the strip follows the scroll through them. A tonal band parts each from the last. */}
      <div data-phone-panels="" className="flex flex-col [&>*+*]:border-t-8 [&>*+*]:border-sunken">
        <PhonePanel id="overview" label="Overview" className={under}>
          <Overview {...props} />
        </PhonePanel>
        <PhonePanel id="exports" label="Exports" className={under}>
          <Exports {...props} />
        </PhonePanel>
        <PhonePanel id="certificates" label="Certificates" className={under}>
          <Certificates {...props} />
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
        <PhonePanel id="products" label="Products" className={under}>
          <div className="px-5 pb-8 pt-6">
            <ProductsPanel model={model} level={level} open />
          </div>
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
