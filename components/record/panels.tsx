// The panels of the supplier record (B4c, Paper `10 · Record` and `11 · Record`): Overview,
// Certificates, Safety, Sites, Sources, Products. Each takes the record's model and says only
// what it holds: a missing figure is a sentence ("Not published. Ask in your RFQ."), never a
// zero, and no contact value is in the model at all. Server-safe; links are real links.

import { CaretRight, Clock, FileText, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CertChip, FactChip } from "@/components/kit";
import { CertTable, FactList, FactRow, RSC_REPORTS, RscBlock, SourceChip, certWords, type RscBlockData, type RscReportName } from "@/components/patterns";
import type { RecordRfqRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { SitesView } from "./sites-view";
import { certRows, isStale, keyFacts, needsLook, siteCards, type TabId } from "./words";

const LINK =
  "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const names = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The small caption over a group of rows ("Needs a look", "Key facts"). */
function Eyebrow({ children, className }: { children: string; className?: string }) {
  return <h3 className={cn("pb-1 pt-5 text-xs font-semibold text-ink-2", className)}>{children}</h3>;
}

/** A line of prose that is not a fact: the record's summary, a note under a list. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-ink-2">{children}</p>;
}

/* ---------------------------------------------------------------- overview */

/** The certificates that need a look: one row each, problems first, no frame (Paper `Needs a look`). */
function ProblemRows({ model, today }: { model: SupplierSheetModel; today: Date }) {
  const rows = needsLook(certRows(model), today);
  if (rows.length === 0) return null;
  return (
    <section aria-label="Needs a look">
      <h3 className="py-2 text-xs font-semibold text-ink-3">Needs a look</h3>
      <ul>
        {rows.map((c, i) => {
          const w = certWords(c.expiresOn, today);
          return (
            <li key={`${c.scheme}-${c.number}-${i}`} className="relative flex scroll-mt-16 flex-col gap-1.5 border-b border-line py-3 target:bg-brand-tint sm:min-h-14 sm:flex-row sm:items-center sm:gap-4 sm:py-2">
              <span className="flex flex-col max-sm:order-2 max-sm:flex-row max-sm:items-baseline max-sm:gap-2 sm:w-[110px] sm:shrink-0">
                <span className="text-md font-medium text-ink sm:text-base">{c.scheme}</span>
                {c.number ? <span className="font-mono text-sm text-ink-2">{c.number}</span> : null}
              </span>
              <span className="text-sm text-ink-2 max-sm:order-3 sm:min-w-0 sm:flex-1 sm:text-base">{c.issuer ?? <span className="text-ink-3">Issuer not published</span>}</span>
              <span className="flex max-sm:order-1 sm:shrink-0">
                <CertChip state={w.state} className="whitespace-nowrap">
                  {w.label}
                </CertChip>
              </span>
              {c.documentUrl ? (
                <span className="flex h-8 items-center gap-1.5 max-sm:order-4 sm:w-[124px] sm:shrink-0">
                  <FileText size={16} className="shrink-0 text-brand" aria-hidden />
                  <a href={c.documentUrl} className={cn(LINK, "text-sm max-sm:after:absolute max-sm:after:inset-0")}>
                    {c.documentLabel ?? "Open certificate"}
                  </a>
                </span>
              ) : (
                <span className="text-sm text-ink-3 max-sm:order-4 sm:w-[124px] sm:shrink-0">{c.documentNote}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What the watchlist matched, where a buyer reads it: the banner asserts, this evidences. */
function SanctionEvidence({ model }: { model: SupplierSheetModel }) {
  return (
    <section aria-label="Sanctions matches" id="sanctions" className="flex flex-col gap-2">
      <h3 className="pt-1 text-xs font-semibold text-ink-2">Sanctions matches{model.sanctions.length ? ` · ${model.sanctions.length}` : ""}</h3>
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

export function OverviewPanel({ model, today }: { model: SupplierSheetModel; today: Date }) {
  const facts = keyFacts(model);
  return (
    <div className="flex flex-col gap-1">
      {model.summary ? <Note>{model.summary}</Note> : null}
      {model.sanctioned ? <SanctionEvidence model={model} /> : null}
      <ProblemRows model={model} today={today} />
      <Eyebrow>Key facts</Eyebrow>
      <FactList>
        {facts.map((f) => (
          <FactRow
            key={f.label}
            label={f.label}
            values={f.values.map((v, i) => ({ value: v.text, mono: v.mono, source: i === f.values.length - 1 ? f.source : null }))}
            empty={f.empty}
          />
        ))}
      </FactList>
    </div>
  );
}

/* ------------------------------------------------------------ certificates */

/** "From GOTS, OEKO-TEX and WRAP": the schemes the certificates are of. */
function certFrom(model: SupplierSheetModel): string | undefined {
  const schemes = [...new Set(model.certs.map((c) => c.scheme.split(" ")[0]!))];
  return schemes.length ? `From ${names(schemes)}` : undefined;
}

export function CertificatesPanel({ model, today, compact = false }: { model: SupplierSheetModel; today: Date; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {model.certs.length > 0 ? (
        <CertTable certs={certRows(model)} today={today} from={certFrom(model)} compact={compact} />
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-ink">Certificates</h3>
          <FactChip state="notOnFile">{model.certsEmptyChip}</FactChip>
          <p className="text-base text-ink-2">{model.certsEmpty}</p>
        </div>
      )}
      {/* A building's certificate is not this record's: it is shown under the building's name and is not counted above. */}
      {model.buildingCerts.map((b) => (
        <CertTable
          key={b.building}
          certs={certRows({ ...model, certs: b.certs })}
          today={today}
          compact={compact}
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

export function SafetyPanel({ model }: { model: SupplierSheetModel }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-ink">Safety (RSC)</h3>
      {model.rsc ? (
        <RscBlock data={rscData(model.rsc)} />
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
              <h4 className="text-base font-medium text-ink">{b.name} · RSC record for this building</h4>
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
export function SitesPanel({ model, tabHref, site = null, wide = true }: { model: SupplierSheetModel; tabHref: (tab: TabId) => string; site?: number | null; wide?: boolean }) {
  const { locations, facilities } = model;
  const cards = siteCards(locations);
  const base = tabHref("sites");
  return (
    <div className="flex flex-col gap-5">
      <section id="locations" className="flex flex-col gap-2">
        {locations.length === 0 ? (
          <>
            <h3 className="text-base font-semibold text-ink">Sites</h3>
            <p className="text-base text-ink-2">{model.locationsEmpty}</p>
          </>
        ) : (
          <SitesView
            cards={cards}
            slug={model.slug}
            baseHref={base}
            initial={site}
            wide={wide}
            mapKey={Boolean(process.env.NEXT_PUBLIC_BARIKOI_API_KEY)}
          />
        )}
      </section>
      {/* The extension buildings: an unread list says so, and never says there are none. */}
      <section id="facilities" className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-ink">Extension buildings{facilities.count ? ` · ${facilities.count}` : ""}</h3>
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

export function SourcesPanel({ model, today }: { model: SupplierSheetModel; today: Date }) {
  return (
    <section aria-label="Sources" className="flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-base font-semibold text-ink">Sources · {model.sources.length}</h3>
        <p className="text-xs text-ink-3">{model.sourcesCaption}</p>
      </header>
      {model.sources.length === 0 ? (
        <p className="text-base text-ink-2">No register has filed a record for this company.</p>
      ) : (
        <ul className="flex flex-col overflow-clip rounded-lg border border-line">
          {model.sources.map((s) => {
            const stale = isStale(s.readDate, today);
            return (
              <li key={s.mark.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                  <SourceChip source={s.mark.code} name={s.mark.label} />
                  <span className="pl-[30px] text-xs text-ink-3">{s.name}</span>
                </span>
                <span className="w-40 text-sm text-ink-2">{s.tier}</span>
                <span className="w-32 font-mono text-sm text-ink-2">{s.ref ?? ""}</span>
                <span className={cn("flex w-[100px] items-center justify-end gap-1 text-xs", stale ? "font-medium text-caution" : "text-ink-2")}>
                  {stale ? <Clock size={12} weight="fill" className="text-caution-icon" aria-hidden /> : null}
                  {s.readDate ?? "Not dated"}
                </span>
                {s.mark.href ? (
                  <a href={s.mark.href} className={cn(LINK, "text-sm")}>
                    {s.mark.opens === "list" ? "Open the list" : "Open the register page"}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
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

export function ProductsPanel({ model }: { model: SupplierSheetModel }) {
  const p = model.products;
  const items = productItems(p.productList);
  const shown = items.slice(0, PRODUCTS_SHOWN);
  const rest = items.slice(PRODUCTS_SHOWN);
  const row = (t: string) => (
    <li key={t} className="border-b border-line px-4 py-2.5 text-base font-medium text-ink last:border-b-0 [overflow-wrap:anywhere]">
      {t}
    </li>
  );
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-lg font-semibold text-ink">Products as filed{items.length ? ` · ${items.length}` : ""}</h3>
          {items.length ? <p className="text-xs text-ink-3">Source not linked yet</p> : null}
        </header>
        {items.length === 0 ? (
          <p className="text-base text-ink-2">Not published. Ask in your RFQ.</p>
        ) : (
          <>
            <ul data-product-list="true" className="flex flex-col overflow-clip rounded-lg border border-line">
              {shown.map(row)}
            </ul>
            {rest.length > 0 ? (
              <details className="group/more flex flex-col gap-2">
                <summary className={cn(LINK, "w-fit cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden")}>
                  <span className="group-open/more:hidden">Show all {items.length} as declared</span>
                  <span className="hidden group-open/more:inline">Show fewer</span>
                </summary>
                <ul className="mt-2 flex flex-col overflow-clip rounded-lg border border-line">{rest.map(row)}</ul>
              </details>
            ) : null}
          </>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <header className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-base font-semibold text-ink">Export lines (EPB){p.lines > 0 ? ` · ${p.lines}` : ""}</h3>
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
                  <Link href={model.lineHref(t.hs)} prefetch={false} scroll={false} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
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
    </div>
  );
}

/* ------------------------------------------------------------------- rfqs */

/** The buyer's own RFQs to this supplier, under the Overview's facts: an unread list says so. */
export function RecordRfqs({ model }: { model: SupplierSheetModel }) {
  const { rfqs } = model;
  return (
    <section aria-label="Your RFQs" className="flex flex-col gap-1">
      <Eyebrow>{rfqs.count === null ? "Your RFQs" : `Your RFQs · ${rfqs.count}`}</Eyebrow>
      {rfqs.rows.length === 0 ? (
        <p className="text-base text-ink-2">{rfqs.empty}</p>
      ) : (
        <ul className="flex flex-col overflow-clip rounded-lg border border-line">
          {rfqs.rows.map((r: RecordRfqRow) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <Link href={r.href} prefetch={false} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2 hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
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
