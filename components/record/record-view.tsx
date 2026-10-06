// The supplier record (B4c, Paper `10 · Record pane`, `Record full page`, `11 · Record`): one
// view for the pane beside the results and the full page. A header with the name and the two
// actions, a five-cell summary of what the registers hold, six tabs (each a link, so the tab
// is in the address and the search behind a pane survives it), and the six sections stacked
// under them: a tab jumps to its section and the scroll moves the marked tab. A sanctioned
// record adds a solid band above everything and replaces Send RFQ with the refusal in words;
// nothing here is scored and no contact value is in the model, only how many are on file.
//
// Desktop pane: header, summary, tabs, panel, and a foot line that says what is locked. Full
// page from 1024: the same, with Contact and Sources in a 344 column. On a phone the summary
// is five rows, the tabs stick under the top, and a 64-tall action bar sits at the foot.

import { CaretLeft, Clock, XCircle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClass } from "@/components/kit";
import { LockedContact, REFUSAL, SanctionBanner, SourceList, onFileWords, type SourceEntry } from "@/components/patterns";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { CertificatesPanel, OverviewPanel, ProductsPanel, RecordRfqs, SafetyPanel, SitesPanel, SourcesPanel } from "./panels";
import { SourceCheckListener } from "@/components/onboarding/source-check";
import { RecordSave } from "./save-button";
import { SectionTabs } from "./section-tabs";
import { TABS, dayOfWords, recordSubline, summaryCells, tabCount, type SummaryCell, type TabId } from "./words";

export type RecordViewProps = {
  model: SupplierSheetModel;
  /** `pane` beside the results, `page` at /app/suppliers/[slug]. */
  mode: "pane" | "page";
  tab: TabId;
  /** Where a tab goes: the same record, on the same search, with that tab. */
  tabHref: (tab: TabId) => string;
  today: Date;
  /** The list with this record open beside it: Back to results on the page, and what Open full page carries on the pane. */
  backHref?: string | null;
  /** `?site=` as the page read it: the site selected on the Sites tab on first paint. */
  site?: number | null;
};

const TABULAR = "[font-variant-numeric:tabular-nums]";

function Cell({ c }: { c: SummaryCell }) {
  const Glyph = c.tone === "danger" ? XCircle : c.tone === "caution" ? Clock : null;
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0 sm:flex-auto sm:flex-col sm:justify-start sm:gap-0.5 sm:border-r sm:border-t-0 sm:py-3 sm:pl-3 sm:pr-2 sm:last:border-r-0",
        c.tone === "sanction" && "sm:bg-sanction-tint",
      )}
    >
      <dt className="text-md text-ink sm:text-xs sm:text-ink-3">{c.label}</dt>
      <dd className="flex flex-col items-end gap-0.5 text-right sm:items-start sm:text-left">
        <span
          className={cn(
            "flex items-center gap-1.5 text-md font-semibold",
            c.tone !== "sanction" && "sm:whitespace-nowrap",
            c.tone === "danger" ? "text-danger" : c.tone === "caution" ? "text-caution" : c.tone === "sanction" ? "text-sanction" : "text-ink",
          )}
        >
          {Glyph ? <Glyph size={16} weight="fill" className={cn("shrink-0", c.tone === "caution" && "text-caution-icon")} aria-hidden /> : null}
          {c.value}
        </span>
        {c.sub ? <span className="text-xs text-ink-3 max-sm:text-sm">{c.sub}</span> : null}
      </dd>
    </div>
  );
}

/** The five cells: a bordered strip from 640, five rows with their words on the right on a phone. */
export function Summary({ cells }: { cells: SummaryCell[] }) {
  return (
    <dl aria-label="Summary" className={cn("flex flex-col sm:flex-row sm:rounded-lg sm:border sm:border-line", TABULAR)}>
      {cells.map((c) => (
        <Cell key={c.key} c={c} />
      ))}
    </dl>
  );
}

function Contact({ model }: { model: SupplierSheetModel }) {
  const counts = model.contact.counts;
  if (counts) return <LockedContact {...counts} />;
  // An unread count says only that the details are locked: "none on file" would be a claim.
  return (
    <section aria-label="Contact" className="flex w-full max-w-details flex-col gap-2 rounded-lg border border-line p-4">
      <h3 className="text-base font-semibold text-ink">Contact</h3>
      <p className="text-sm text-ink-2">Contact details are locked. Send an RFQ and the supplier replies here.</p>
    </section>
  );
}

const sendClass = buttonClass({ kind: "primary" });

export function RecordView({ model, mode, tab, tabHref, today, backHref = null, site = null }: RecordViewProps) {
  const page = mode === "page";
  // The search's own title is the page's h1 beside a pane.
  const Title = page ? "h1" : "h2";
  const cells = summaryCells(model, today);
  const list = model.sanctions[0] ?? null;
  const listName = list?.list ?? "sanctions list";
  const expandHref = backHref ? `${model.fullHref}${model.fullHref.includes("?") ? "&" : "?"}back=${encodeURIComponent(backHref)}` : model.fullHref;
  const counts = model.contact.counts;
  const locked = counts ? onFileWords(counts.emails, counts.phones, counts.website, counts.representatives) : null;
  const sources: SourceEntry[] = model.sources.map((s) => ({ source: s.mark.code, label: s.mark.label, fullName: s.name, checkedOn: dayOfWords(s.readDate) }));

  const actions = (
    <>
      {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} className="max-sm:hidden" /> : null}
      {model.sanctioned ? (
        <span className="flex items-center gap-2 text-base font-medium text-sanction max-sm:hidden">{REFUSAL}</span>
      ) : model.rfqHref ? (
        <Link href={model.rfqHref} prefetch={false} className={cn(sendClass, "max-sm:hidden")}>
          Send RFQ
        </Link>
      ) : null}
    </>
  );

  return (
    <section aria-label="Supplier record" data-record={mode} data-detail={page ? "" : undefined} className="flex flex-1 flex-col bg-surface">
      <SourceCheckListener />
      {model.sanctioned ? (
        <SanctionBanner
          title={`On the ${listName}${list?.listedOn ? ` since ${list.listedOn}` : ""}.`}
          detail={`${REFUSAL} From the ${listName}${list?.screenedOn ? ` · checked ${list.screenedOn}` : ""}.`}
        />
      ) : null}

      {page && backHref ? (
        <div className="flex h-12 items-center px-4 sm:h-auto sm:px-6 sm:pt-3 lg:px-8">
          <Link href={backHref} className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-md font-medium text-ink outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-sm sm:text-brand sm:underline sm:decoration-1 sm:[text-underline-position:from-font]">
            <CaretLeft size={20} className="shrink-0 sm:hidden" aria-hidden />
            <CaretLeft size={14} className="hidden shrink-0 sm:block" aria-hidden />
            <span className="sm:hidden">Search</span>
            <span className="max-sm:hidden">Back to results</span>
          </Link>
        </div>
      ) : null}

      <header className={cn("flex flex-col gap-1.5 px-4 pb-3 pt-3 sm:sticky sm:top-0 sm:z-raised sm:border-b sm:border-line sm:bg-surface sm:px-6", page ? "sm:pt-3 lg:px-8" : "sm:pt-5")}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <Title className="min-w-0 flex-1 basis-60 text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-2xl">{model.name}</Title>
          <div className="flex shrink-0 items-center gap-2">
            {!page ? (
              <Link href={expandHref} className="rounded-sm p-1.5 text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:hidden">
                Open full page
              </Link>
            ) : null}
            {actions}
            {!page && model.closeHref ? (
              // Under 1280 the pane is the kit's drawer, which draws its own close.
              <Link href={model.closeHref} scroll={false} aria-label="Close" className={buttonClass({ kind: "quiet", size: "icon-32", className: "max-xl:hidden" })}>
                <X size={20} aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
        <p className="text-base text-ink-2 max-sm:text-md">{recordSubline(model)}</p>
      </header>

      <div className={cn("flex gap-8 px-4 pb-8 pt-4 sm:px-6", page && "lg:px-8")}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {model.sanctionSample ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <span className="rounded-sm border border-dashed border-line-strong px-2 py-0.5 font-semibold text-ink">Sample state</span>
              No published supplier is on a sanctions list today. Placeholders only; no real company is shown.
            </p>
          ) : null}
          <Summary cells={cells} />

          {/* Keyed by record: a pane that opens another supplier starts again at its tab. */}
          <SectionTabs
            key={model.fullHref}
            initial={tab}
            tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: `${tabHref(t.id)}#record-${t.id}`, count: tabCount(model, t.id) ?? undefined }))}
          />

          {/* Every section, in tab order: the tabs jump to one and follow the scroll through them. */}
          {TABS.map((t) => (
            <div key={t.id} id={`record-${t.id}`} role="region" aria-label={t.label} className="scroll-mt-[var(--record-offset,0px)]">
              {t.id === "overview" ? (
                <div className="flex flex-col gap-5">
                  <OverviewPanel model={model} today={today} />
                  <RecordRfqs model={model} />
                </div>
              ) : t.id === "certificates" ? (
                <CertificatesPanel model={model} today={today} compact={!page} />
              ) : t.id === "safety" ? (
                <SafetyPanel model={model} />
              ) : t.id === "sites" ? (
                <SitesPanel model={model} tabHref={tabHref} site={site} wide={page} />
              ) : t.id === "sources" ? (
                <SourcesPanel model={model} today={today} />
              ) : (
                <ProductsPanel model={model} />
              )}
            </div>
          ))}
          <div data-record-end="" aria-hidden />
        </div>

        {page ? (
          <aside aria-label="Contact and sources" className="hidden w-details shrink-0 flex-col gap-4 pt-1 lg:flex">
            <Contact model={model} />
            {tab !== "sources" && sources.length > 0 ? <SourceList sources={sources} today={today} /> : null}
          </aside>
        ) : null}
      </div>

      {/* Where the contact column is not: what is locked, in one line (a phone: a row above the action bar). */}
      {locked ? (
        <p className={cn("flex min-h-16 items-center gap-1 border-t border-line px-4 text-sm text-ink-3 sm:sticky sm:bottom-0 sm:bg-surface sm:px-6", page && "lg:hidden")}>
          {locked} · locked
        </p>
      ) : null}

      {/* A phone's one action: Save beside the primary, or the refusal in its place. */}
      <div className="sticky bottom-0 sm:hidden">
        {model.sanctioned ? (
          <div role="status" className="flex min-h-16 items-center gap-3 border-t-2 border-sanction bg-sanction-tint px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} appearance="icon" /> : null}
            <p className="text-base font-medium text-sanction">{REFUSAL}</p>
          </div>
        ) : (
          <div className="flex min-h-action-bar items-center gap-2 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)]">
            {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} appearance="icon" /> : null}
            {model.rfqHref ? (
              <div className="min-w-0 flex-1">
                <Link href={model.rfqHref} prefetch={false} className={buttonClass({ kind: "primary", size: "touch", full: true })}>
                  Send RFQ
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
