// The panels of the supplier record (B4c, Paper `10 · Record` and `11 · Record`): Overview,
// Certificates, Safety, Sites, Sources, Products. Each takes the record's model and says only
// what it holds: a missing figure is a sentence ("Not published. Ask in your RFQ."), never a
// zero, and no contact value is in the model at all. Server-safe; links are real links.

import { CaretRight, FileText, Hourglass, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CertChip, Define, FactChip, Unpublished } from "@/components/kit";
import { ABSENT, CertTable, ExportsSummary, FactList, FactRow, PendingMark, RSC_REPORTS, RscBlock, SourceChip, SourceLine, SourceMark, certWords, type RscBlockData, type RscReportName } from "@/components/patterns";
import { volzaSource, volzaStats, type VolzaExports } from "@/lib/dashboard/facts";
import type { RecordRfqRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { SitesView } from "./sites-view";
import { certRows, keyFacts, needsLook, pendingLegend, siteCards, staleWords, type Membership, type TabId } from "./words";

/**
 * The level of a panel's headings: h3 beside the results (the search owns the h1, the record's name
 * is the h2) and h2 on the record's own page, where the name is the h1, so no level is skipped.
 */
export type Level = "h2" | "h3";
const under = (h: Level) => (h === "h2" ? "h3" : "h4");

const LINK =
  "rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const names = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The small caption over a group of rows ("Needs a look", "Key facts"). */
function Eyebrow({ children, className, level: H = "h3" }: { children: string; className?: string; level?: Level }) {
  return <H className={cn("pb-1 pt-5 text-xs font-semibold text-ink-2", className)}>{children}</H>;
}

/** A line of prose that is not a fact: the record's summary, a note under a list. */
function Note({ children }: { children: React.ReactNode }) {
  // A line of prose wraps at 72 characters (the RSC summary ran ~147 on one line).
  return <p className="max-w-[72ch] text-base text-ink-2">{children}</p>;
}

/* ---------------------------------------------------------------- overview */

/** The certificates that need a look: one row each, problems first, no frame (Paper `Needs a look`). */
function ProblemRows({ model, today, level: H }: { model: SupplierSheetModel; today: Date; level: Level }) {
  const rows = needsLook(certRows(model, today), today);
  if (rows.length === 0) return null;
  // The link's column is kept for every row once one row has a page to open, so the chips stay in line.
  const docs = rows.some((c) => c.documentUrl);
  return (
    <section aria-label="Needs a look">
      <H className="py-2 text-xs font-semibold text-ink-3">Needs a look</H>
      <ul>
        {rows.map((c, i) => {
          const w = certWords(c.expiresOn, today);
          return (
            <li key={`${c.scheme}-${c.number}-${i}`} className="relative flex scroll-mt-16 flex-col gap-1.5 border-b border-line py-3 target:bg-brand-tint sm:min-h-14 sm:flex-row sm:items-center sm:gap-4 sm:py-2">
              <span className="flex flex-col max-sm:order-2 max-sm:flex-row max-sm:items-baseline max-sm:gap-2 sm:w-[110px] sm:shrink-0">
                <span className="text-md font-medium text-ink sm:text-base">{c.scheme}</span>
                {c.number ? <span className="font-mono text-sm text-ink-2">{c.number}</span> : null}
              </span>
              <span className="text-sm text-ink-2 max-sm:order-3 sm:min-w-0 sm:flex-1 sm:text-base">{c.issuer ?? <Unpublished>{ABSENT.issuer}</Unpublished>}</span>
              <span className="flex max-sm:order-1 sm:shrink-0">
                <CertChip state={w.state} className="whitespace-nowrap">
                  {w.label}
                </CertChip>
              </span>
              {c.documentUrl ? (
                <span className="flex h-8 items-center gap-1.5 max-sm:order-4 sm:w-[124px] sm:shrink-0">
                  <FileText size={16} className="shrink-0 text-brand-ink" aria-hidden />
                  <a href={c.documentUrl} className={cn(LINK, "text-sm max-sm:after:absolute max-sm:after:inset-0")}>
                    {c.documentLabel ?? "Open certificate"}
                  </a>
                </span>
              ) : docs ? (
                <span className="max-sm:hidden sm:w-[124px] sm:shrink-0" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What the watchlist matched, where a buyer reads it: the banner asserts, this evidences. */
function SanctionEvidence({ model, level: H }: { model: SupplierSheetModel; level: Level }) {
  return (
    <section aria-label="Sanctions matches" id="sanctions" className="flex flex-col gap-2">
      <H className="pt-1 text-xs font-semibold text-ink-2">Sanctions matches{model.sanctions.length ? ` · ${model.sanctions.length}` : ""}</H>
      {model.sanctions.length === 0 ? (
        <p className="text-base text-ink-2">{model.sanctionsEmpty}</p>
      ) : (
        <ul className="flex flex-col overflow-clip rounded-lg border border-sanction bg-sanction-tint">
          {model.sanctions.map((s, i) => (
            <li key={`${s.list}-${s.ref}-${i}`} className="flex flex-col gap-0.5 border-b border-line px-4 py-3 last:border-b-0">
              <span className="flex items-center gap-1.5 text-base font-semibold text-sanction">
                <WarningOctagon size={16} weight="fill" className="shrink-0" aria-hidden />
                {s.list}
              </span>
              <span className="text-base text-ink">Matched as {s.matchedName}</span>
              <span className="text-xs text-ink-3">
                {[s.ref ? `Entry ${s.ref}` : null, s.listedOn ? `listed ${s.listedOn}` : null, s.screenedOn ? `checked ${s.screenedOn}` : null].filter(Boolean).join(" · ")}
              </span>
              {s.href ? (
                <a href={s.href} className={cn(LINK, "w-fit text-sm")}>
                  {s.opens === "entry" ? "Open the entry" : "Open the list"}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-2">The record stays readable for due diligence. Save still works, so the supplier can be tracked.</p>
    </section>
  );
}

/**
 * One registration on one line: the register's mark and short name in a column of their own, then
 * the number in mono, so a list of them reads down as two columns (founder, 6 Oct 2026: "scattered,
 * I have to look really closely to understand what is what").
 */
function MembershipLine({ m }: { m: Membership }) {
  return (
    <span className="flex items-center gap-2.5">
      <SourceMark source={m.mark ?? m.name} />
      <span className="w-24 shrink-0 text-md font-medium text-ink sm:text-base">{m.name}</span>
      {m.number ? (
        <span className="font-mono text-md font-normal text-ink [overflow-wrap:anywhere] sm:text-base">
          <span className="sr-only">registration number </span>
          {m.number}
        </span>
      ) : null}
      {m.qualifier ? <span className="text-sm font-normal text-ink-3">{m.qualifier}</span> : null}
    </span>
  );
}

/**
 * Needs a look in the full page's right column, under Contact (critique of 8 Oct 2026, round 3, item 7:
 * the main column ran four screens beside a column that held only the padlock). Stacked for 344.
 */
export function NeedsLookAside({ model, today, level: H = "h3" }: { model: SupplierSheetModel; today: Date; level?: Level }) {
  const rows = needsLook(certRows(model, today), today);
  if (rows.length === 0) return null;
  return (
    <section aria-label="Needs a look" className="flex w-full max-w-details flex-col rounded-lg border border-line p-4">
      <H className="pb-1 text-base font-semibold text-ink">Needs a look</H>
      <ul>
        {rows.map((c, i) => {
          const w = certWords(c.expiresOn, today);
          return (
            <li key={`${c.scheme}-${c.number}-${i}`} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-medium text-ink">{c.scheme}</span>
                {c.number ? <span className="font-mono text-sm text-ink-2">{c.number}</span> : null}
              </span>
              <CertChip state={w.state} className="shrink-0 whitespace-nowrap">
                {w.label}
              </CertChip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OverviewPanel({ model, today, level = "h3", lookAside = false }: { model: SupplierSheetModel; today: Date; level?: Level; /** The full page draws Needs a look beside the column from `lg`. */ lookAside?: boolean }) {
  const facts = keyFacts(model);
  const legend = pendingLegend(facts);
  return (
    <div className="flex flex-col gap-1">
      {model.summary ? <Note>{model.summary}</Note> : null}
      {model.sanctioned ? <SanctionEvidence model={model} level={level} /> : null}
      {lookAside ? (
        <div className="lg:hidden">
          <ProblemRows model={model} today={today} level={level} />
        </div>
      ) : (
        <ProblemRows model={model} today={today} level={level} />
      )}
      <Eyebrow level={level}>Key facts</Eyebrow>
      <FactList>
        {facts.map((f) => (
          <FactRow
            key={f.label}
            label={f.label}
            values={f.values.map((v, i) => ({
              value: v.membership ? <MembershipLine m={v.membership} /> : v.text,
              mono: v.mono && !v.membership,
              source: i === f.values.length - 1 ? f.source : null,
              pending: i === f.values.length - 1 && f.pending,
            }))}
            empty={f.empty}
          />
        ))}
      </FactList>
      {/* The pending mark's one legend: what the dashed document under a fact means, said once. */}
      {legend ? (
        <p className="flex items-center gap-1.5 pt-2 text-xs text-ink-3">
          <PendingMark />
          <Define term="Source pending">{legend}</Define>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ certificates */

/** "From GOTS, OEKO-TEX and WRAP": the schemes the certificates are of. */
function certFrom(model: SupplierSheetModel): string | undefined {
  const schemes = [...new Set(model.certs.map((c) => c.scheme.split(" ")[0]!))];
  return schemes.length ? `From ${names(schemes)}` : undefined;
}

export function CertificatesPanel({ model, today, compact = false, level: H = "h3" }: { model: SupplierSheetModel; today: Date; compact?: boolean; level?: Level }) {
  return (
    <div className="flex flex-col gap-4">
      {model.certs.length > 0 ? (
        <CertTable certs={certRows(model, today)} today={today} from={certFrom(model)} compact={compact} level={H} />
      ) : (
        <div className="flex flex-col gap-2">
          <H className="text-base font-semibold text-ink">Certificates</H>
          <FactChip state="notOnFile">{model.certsEmptyChip}</FactChip>
          <p className="text-base text-ink-2">{model.certsEmpty}</p>
        </div>
      )}
      {/* A building's certificate is not this record's: it is shown under the building's name and is not counted above. */}
      {model.buildingCerts.map((b) => (
        <CertTable
          key={b.building}
          certs={certRows({ ...model, certs: b.certs }, today)}
          today={today}
          compact={compact}
          level={H}
          from={`Held by ${b.building} · the building's own, not counted above`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ safety */

const REPORT_OF: Record<string, RscReportName> = { Fire: "Fire", Electrical: "Electrical", Structural: "Structural", Boiler: "Boiler", CAP: "Corrective action plan" };

type Rsc = NonNullable<SupplierSheetModel["rsc"]>;

const sentence = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);

/** The register's facts as Paper words them: "75% of initial items fixed · behind schedule". */
function rscData(r: Pick<Rsc, "progress" | "status" | "training" | "links" | "readDate"> & { ref?: string | null }): RscBlockData {
  const reports = Object.fromEntries(RSC_REPORTS.map((n) => [n, null])) as Record<RscReportName, string | null>;
  for (const l of r.links) {
    const key = REPORT_OF[l.label];
    if (key) reports[key] = l.href;
  }
  return {
    factoryId: r.ref ?? null,
    covered: true,
    remediation: [r.progress !== null ? `${r.progress}% of initial items fixed` : null, r.status].filter(Boolean).join(" · ") || null,
    training: sentence(r.training),
    reports,
    checkedOn: r.readDate,
  };
}

export function SafetyPanel({ model, level: H = "h3" }: { model: SupplierSheetModel; level?: Level }) {
  const Sub = under(H);
  return (
    <div className="flex flex-col gap-4">
      <H className="text-lg font-semibold text-ink">Safety (RSC)</H>
      {model.rsc ? (
        <RscBlock data={rscData(model.rsc)} level={Sub} />
      ) : (
        <div className="flex flex-col gap-2">
          <FactChip state="notOnFile">No active RSC record on file</FactChip>
          <p className="text-base text-ink-2">
            {model.rscBuildings.length > 0 ? `RSC covers ${names(model.rscBuildings)}: the buildings, not this record.` : "RSC publishes inspection reports for the factories it covers. This company is not one of them."}
          </p>
        </div>
      )}
      {/* A building's own row, labelled as the building's: the register published a status and up to five reports for it. */}
      {model.rscBuildingBlocks.map((b) => {
        const d = rscData(b);
        const open = b.links.filter((l) => l.href);
        return (
          <section key={b.name} className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <Sub className="text-base font-medium text-ink">{b.name} · RSC record for this building</Sub>
              <p className="text-xs text-ink-3">{[d.remediation, b.training ? `training ${b.training}` : null, b.readDate ? `checked ${b.readDate}` : null].filter(Boolean).join(" · ")}</p>
            </div>
            {open.length > 0 ? (
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {open.map((l) => (
                  <li key={l.label}>
                    <a href={l.href!} className={cn(LINK, "text-sm")}>
                      {REPORT_OF[l.label] ?? l.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- sites */

/**
 * The premises, one card each, beside the map (B4d). One clean address per premises, the registry's
 * other spellings never printed (RC-09). With the geocode cache read, a card says whether its pin is
 * on the address or only the area; where the cache was not read, nothing is said about a pin.
 */
export function SitesPanel({ model, tabHref, site = null, wide = true, level: H = "h3" }: { model: SupplierSheetModel; tabHref: (tab: TabId) => string; site?: number | null; wide?: boolean; level?: Level }) {
  const { locations, facilities } = model;
  const cards = siteCards(locations);
  const base = tabHref("sites");
  return (
    <div className="flex flex-col gap-5">
      <section id="locations" className="flex flex-col gap-2">
        {locations.length === 0 ? (
          <>
            <H className="text-base font-semibold text-ink">Sites</H>
            <p className="text-base text-ink-2">{model.locationsEmpty}</p>
          </>
        ) : (
          <SitesView
            cards={cards}
            slug={model.slug}
            baseHref={base}
            initial={site}
            wide={wide}
            level={H}
            mapKey={Boolean(process.env.NEXT_PUBLIC_BARIKOI_API_KEY)}
          />
        )}
      </section>
      {/* The extension buildings: an unread list says so, and never says there are none. */}
      <section id="facilities" className="flex flex-col gap-2">
        <H className="text-base font-semibold text-ink">Extension buildings{facilities.count ? ` · ${facilities.count}` : ""}</H>
        {facilities.rows.length === 0 ? (
          <p className="text-base text-ink-2">{facilities.empty}</p>
        ) : (
          <ul data-facilities="true" className="flex flex-col overflow-clip rounded-lg border border-line">
            {facilities.rows.map((f) => (
              <li key={f.name} className="flex flex-col gap-0.5 border-b border-line px-4 py-3 last:border-b-0">
                <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{f.name}</span>
                {f.address ? <span className="text-sm text-ink-2 [overflow-wrap:anywhere]">{f.address}</span> : null}
                {f.workers ? <span className="text-xs text-ink-3">{f.workers}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- sources */

// The Sources table's columns once the table itself is 600px wide (the full page; a docked pane stacks
// them): source, the record's number there, the last read, the register's page. Sized by the table,
// not the screen: the same record is drawn in a 640px pane and a 1200px page at one screen width.
const SOURCE_COLS =
  "[@container_(min-width:600px)]:grid [@container_(min-width:600px)]:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_8.25rem_5.5rem] [@container_(min-width:600px)]:items-center [@container_(min-width:600px)]:gap-4";

/** The sources in the model's order (best rank first), one group per kind: "Government register", "Industry body". */
function sourceGroups(sources: SupplierSheetModel["sources"]): { kind: string; rows: SupplierSheetModel["sources"] }[] {
  const groups: { kind: string; rows: SupplierSheetModel["sources"] }[] = [];
  for (const s of sources) {
    const held = groups.find((g) => g.kind === s.tier);
    if (held) held.rows.push(s);
    else groups.push({ kind: s.tier, rows: [s] });
  }
  return groups;
}

/**
 * Who filed something on this record, grouped by how far each is trusted, so the kind is said once
 * per group and every row is the same three facts in the same three columns (founder, 6 Oct 2026:
 * the rows were a wrapping line each, so no column lined up with the row above it).
 */
export function SourcesPanel({ model, today, level: H = "h3" }: { model: SupplierSheetModel; today: Date; level?: Level }) {
  const Sub = under(H);
  return (
    <section aria-label="Sources" className="flex flex-col rounded-md border border-line [container-type:inline-size]">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 border-b border-line px-4 py-2">
        <H className="text-base font-semibold text-ink">Sources · {model.sources.length}</H>
        <p className="max-w-[72ch] text-xs text-ink-3">{model.sourcesCaption}</p>
      </header>
      {model.sources.length === 0 ? (
        <p className="px-4 py-3 text-base text-ink-2">No register has filed a record for this company.</p>
      ) : (
        <>
          <div className={cn("hidden h-9 border-b border-line bg-subtle px-4 text-xs font-medium text-ink-3", SOURCE_COLS)}>
            <span>Source</span>
            <span>Number</span>
            <span>Last read</span>
            <span>Page</span>
          </div>
          {sourceGroups(model.sources).map((g) => (
            <section key={g.kind} aria-label={g.kind} className="flex flex-col border-b border-line pb-1.5 last:border-b-0">
              <Sub className="px-4 pb-0.5 pt-3 text-xs font-semibold text-ink-2">
                <Define term={g.kind} />
              </Sub>
              <ul>
                {g.rows.map((s) => {
                  const stale = staleWords(s.readDate, today);
                  return (
                    <li key={s.mark.code} className={cn("flex flex-col gap-1 px-4 py-2", SOURCE_COLS)}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <SourceChip source={s.mark.code} name={s.mark.label} />
                        {/* A brand list's full name is its short one: said once. */}
                        {s.name !== s.mark.label ? <span className="pl-[30px] text-xs text-ink-3">{s.name}</span> : null}
                      </span>
                      {/* One wrapping line under the name where the table is narrow; a cell each where it is wide. */}
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pl-[30px] [@container_(min-width:600px)]:contents">
                        {/* A number is never broken: two certificates are two lines in their cell. */}
                        <span className="flex flex-wrap gap-x-3 font-mono text-sm text-ink empty:hidden [@container_(min-width:600px)]:flex-col [@container_(min-width:600px)]:empty:flex">
                          {s.refs.map((r) => (
                            <span key={r} className="[overflow-wrap:anywhere]">
                              {r}
                            </span>
                          ))}
                        </span>
                        {/* A stale read is its own glyph and its own words (the clock means a certificate expiring). */}
                        <span className={cn("flex items-center gap-1 text-sm", stale ? "font-medium text-caution" : "text-ink-2")} title={stale ? (s.readDate ?? undefined) : undefined}>
                          {stale ? <Hourglass size={12} weight="fill" className="shrink-0 text-caution-icon" aria-hidden /> : null}
                          <span>
                            {s.readDate && !stale ? <span className="[@container_(min-width:600px)]:sr-only">read </span> : null}
                            {stale ? <Define term="stale read">{stale}</Define> : (s.readDate ?? <Unpublished>{ABSENT.dated}</Unpublished>)}
                          </span>
                        </span>
                        {s.mark.href ? (
                          <a href={s.mark.href} className={cn(LINK, "w-fit text-sm")}>
                            Open <span className="sr-only">the {s.mark.label} </span>
                            {s.mark.opens === "list" ? "list" : "page"}
                          </a>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- products */

/** The product list as the register filed it, spellings that differ only in case or spacing merged. */
export function productItems(items: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of items) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (text && !seen.has(text.toLowerCase())) seen.set(text.toLowerCase(), text);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

const PRODUCTS_SHOWN = 8;

/**
 * `open`: the filed list unfolds on the Products tab and stays folded elsewhere, so the Overview's
 * long tail is one line (the critique of 7 Oct 2026: the record ran four screens beside a card that
 * fits in one). The register that filed the list is not linked yet: the pending mark, not a sentence.
 */
export function ProductsPanel({ model, level: H = "h3", open = false }: { model: SupplierSheetModel; level?: Level; open?: boolean }) {
  const p = model.products;
  const items = productItems(p.productList);
  const shown = items.slice(0, PRODUCTS_SHOWN);
  const rest = items.slice(PRODUCTS_SHOWN);
  const row = (t: string) => (
    <li key={t} className="border-b border-line px-4 py-2.5 text-base font-medium text-ink last:border-b-0 [overflow-wrap:anywhere]">
      {t}
    </li>
  );
  const heading = (
    <span className="flex flex-wrap items-center gap-x-3">
      <H className="text-lg font-semibold text-ink">Products as filed{items.length ? ` · ${items.length}` : ""}</H>
      {/* The mark had no legend here: the definition is on the mark itself, on hover and focus. */}
      {items.length ? (
        <Define term="Source pending" className="inline-flex no-underline">
          <PendingMark />
        </Define>
      ) : null}
    </span>
  );
  return (
    <div className="flex flex-col gap-5">
      {items.length === 0 ? (
        <section className="flex flex-col gap-2">
          {heading}
          <p className="text-base text-ink-2">Not published. Ask in your RFQ.</p>
        </section>
      ) : (
        <details open={open || undefined} className="group/filed flex flex-col gap-2">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
            <CaretRight size={16} className="shrink-0 text-ink-3 transition-transform group-open/filed:rotate-90 motion-reduce:transition-none" aria-hidden />
            {heading}
          </summary>
          <ul data-product-list="true" className="mt-2 flex flex-col overflow-clip rounded-lg border border-line">
            {shown.map(row)}
          </ul>
          {rest.length > 0 ? (
            <details className="group/more mt-2 flex flex-col gap-2">
              <summary className={cn(LINK, "w-fit cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden")}>
                <span className="group-open/more:hidden">Show all {items.length} as declared</span>
                <span className="hidden group-open/more:inline">Show fewer</span>
              </summary>
              <ul className="mt-2 flex flex-col overflow-clip rounded-lg border border-line">{rest.map(row)}</ul>
            </details>
          ) : null}
        </details>
      )}
      <section className="flex flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3">
          <H className="text-base font-semibold text-ink">Export lines (EPB){p.lines > 0 ? ` · ${p.lines}` : ""}</H>
          {p.exporterHref ? (
            <a href={p.exporterHref} className={cn(LINK, "text-xs")}>
              Exporter page {p.exporterRef}
            </a>
          ) : null}
        </header>
        {p.linesUnknown ? (
          <p className="text-base text-ink-2">The export lines could not be read.</p>
        ) : p.lines === 0 ? (
          <p className="text-base text-ink-2">{p.onEpb ? "On the EPB exporter register · no lines on file." : "Products they export: not on the EPB exporter list."}</p>
        ) : (
          <>
            <ul className="flex flex-col overflow-clip rounded-lg border border-line">
              {p.tiles.map((t) => (
                <li key={t.hs} className="border-b border-line last:border-b-0">
                  <Link href={model.lineHref(t.hs)} prefetch={false} scroll={false} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-sm text-ink-2">{t.hs}</span>
                      <span className="text-base font-medium text-ink">{t.short}</span>
                    </span>
                    <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            {p.allLinesHref ? (
              <Link href={p.allLinesHref} prefetch={false} scroll={false} className={cn(LINK, "w-fit text-sm")}>
                All {p.lines} lines
              </Link>
            ) : null}
          </>
        )}
      </section>
      {model.volza ? <VolzaSection v={model.volza} level={H} /> : null}
    </div>
  );
}

/**
 * Bangladesh customs export records (0137), drawn with the Exports pattern (03 Patterns · 14). The
 * database sends them only to admins and paying plans, and only for an exact name match. The
 * provider is named on /legal/data-sources, not here (founder, 11 Oct 2026).
 */
function VolzaSection({ v, level: H }: { v: VolzaExports; level: Level }) {
  return (
    <section aria-label="Customs shipments" className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        <H className="text-base font-semibold text-ink">Customs shipments</H>
        <p className="text-sm text-ink-3">Garment exports (HS 61 and 62) cleared through Bangladesh customs{v.volza_name ? `, filed as ${v.volza_name.replace(/\.+$/, "")}` : ""}.</p>
        <SourceLine>{volzaSource(v)}</SourceLine>
      </header>
      <ExportsSummary stats={volzaStats(v)} />
    </section>
  );
}

/* ------------------------------------------------------------------- rfqs */

/** The buyer's own RFQs to this supplier, under the Overview's facts: an unread list says so. */
export function RecordRfqs({ model, level = "h3" }: { model: SupplierSheetModel; level?: Level }) {
  const { rfqs } = model;
  return (
    <section aria-label="Your RFQs" className="flex flex-col gap-1">
      <Eyebrow level={level}>{rfqs.count === null ? "Your RFQs" : `Your RFQs · ${rfqs.count}`}</Eyebrow>
      {rfqs.rows.length === 0 ? (
        <p className="text-base text-ink-2">{rfqs.empty}</p>
      ) : (
        <ul className="flex flex-col overflow-clip rounded-lg border border-line">
          {rfqs.rows.map((r: RecordRfqRow) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={r.href} prefetch={false} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
                <span className="flex flex-col">
                  <span className="text-base font-medium text-ink">{r.title}</span>
                  <span className="text-xs text-ink-3">{[r.quantity, r.sent ? `sent ${r.sent}` : null, r.shipBy ? `ship by ${r.shipBy}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-sm text-ink-2">{r.status.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
