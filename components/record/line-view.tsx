// One export line of a record (B11b, on the v4 kit; Paper `10 · Record pane` and `Record full page`):
// the page for ONE HS heading. The photo (the catalogue's, captioned as illustrative, or the code
// where there is none), what the line is, the facts the record holds about it, and two actions: Send
// RFQ for this line and every exporter of the heading. One view for the pane beside the results and
// the full page, as the record's own. A sanctioned record keeps its solid band and the refusal in
// words in place of Send RFQ; nothing is scored and no contact value is in the model.

/* eslint-disable @next/next/no-img-element -- static catalogue file under /public */
import { ArrowLeft, ArrowSquareOut, CaretLeft, Clock, FileText, Globe, Info, Storefront, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { CertChip, buttonClass, ring } from "@/components/kit";
import { FactList, FactRow, REFUSAL, Refusal, SanctionBanner } from "@/components/patterns";
import { customsWindow, formatCount, formatUsdShort } from "@/lib/dashboard/facts";
import type { ProductSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { lineShipments, marketShares, recordsEnd, shortDay, windowSpan } from "./phone-words";
import { PHOTO_CAPTION, lineEyebrow, lineFacts, type LineFact } from "./words";

const LINK =
  "rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** "From BGMEA · read 12 Aug 2026", each register a link where the record carries its page */
function sourceOf(fact: LineFact): ReactNode {
  const from = fact.marks.length ? (
    <>
      From{" "}
      {fact.marks.map((m, i) => (
        <span key={m.code}>
          {i > 0 ? ", " : ""}
          {m.href ? (
            <a href={m.href} title={m.name} className={LINK}>
              {m.label}
            </a>
          ) : (
            <span title={m.name}>{m.label}</span>
          )}
        </span>
      ))}
    </>
  ) : null;
  if (!from && !fact.note) return null;
  return (
    <>
      {from}
      {from && fact.note ? " · " : null}
      {fact.note}
    </>
  );
}

export function LineView({ model, mode, today = new Date() }: { model: ProductSheetModel; mode: "pane" | "page"; /** For the age of the customs records on a phone. */ today?: Date }) {
  const page = mode === "page";
  // The search's own title is the page's h1 beside a pane.
  const Title = page ? "h1" : "h2";
  const facts = lineFacts(model.facts);
  const factList = (
    <FactList>
      {facts.map((f) => (
        <FactRow
          key={f.label}
          label={f.label}
          values={f.values.map((v, i) => ({
            value: v.href ? (
              <a href={v.href} className={cn(LINK, "inline-flex items-center gap-1 [overflow-wrap:anywhere]")}>
                {v.text}
                <ArrowSquareOut size={14} className="shrink-0" aria-hidden />
              </a>
            ) : (
              v.text
            ),
            mono: v.mono,
            source: i === f.values.length - 1 ? sourceOf(f) : null,
          }))}
          chip={f.badge ? <CertChip state={f.badge.state}>{f.badge.label}</CertChip> : undefined}
          empty={f.empty}
        />
      ))}
    </FactList>
  );
  return (
    // Beside the results the labelled region is what focus moves into, so it is announced by its name (`PaneFocus`).
    <section
      aria-label="Product line"
      data-detail={page ? "" : undefined}
      data-record-pane={page ? undefined : ""}
      tabIndex={page ? undefined : -1}
      className={cn("flex min-h-0 flex-1 flex-col bg-surface outline-none", page && "max-sm:pb-[calc(theme(spacing.action-bar)_+_env(safe-area-inset-bottom))]")}
    >
      {model.sanctioned ? (
        <SanctionBanner title={`Sanctioned${model.sanctionSample ? " · sample record" : ""}: matched on a sanctions screen.`} detail={REFUSAL} />
      ) : null}

      <div className={cn("flex min-h-12 items-center justify-between gap-3 px-4 max-sm:hidden sm:px-6", page && "lg:px-8")}>
        {model.backHref ? (
          <Link
            href={model.backHref}
            aria-label="Back to the record"
            scroll={false}
            prefetch={false}
            className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-md font-medium text-ink outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:text-sm sm:text-brand-ink sm:underline sm:decoration-1 sm:[text-underline-position:from-font]"
          >
            <CaretLeft size={20} className="shrink-0 sm:hidden" aria-hidden />
            <CaretLeft size={14} className="hidden shrink-0 sm:block" aria-hidden />
            Back
          </Link>
        ) : (
          <span />
        )}
        {!page && model.closeHref ? (
          // Under 1280 the pane is the kit's drawer, which draws its own close.
          <Link href={model.closeHref} scroll={false} aria-label="Close" className={buttonClass({ kind: "quiet", size: "icon-32", className: "max-xl:hidden" })}>
            <X size={20} aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className={cn("flex min-h-0 flex-col gap-5 px-4 pb-8 max-sm:hidden sm:px-6", page && "mx-auto w-full max-w-[1120px] lg:px-8")}>
        <header className="flex flex-col gap-1">
          <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">
            {model.supplierName} / <span className="font-mono">HS {model.hs}</span>
          </p>
          <p className="text-xs font-semibold text-ink-3">{lineEyebrow(model)}</p>
          <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-2xl">{model.heading}</Title>
        </header>

        <div className={cn("grid items-start gap-6", page && "md:grid-cols-[320px_1fr]")}>
          <div className="flex flex-col gap-2">
            <div className={cn("aspect-square w-full overflow-hidden rounded-md bg-sunken", page ? "max-w-[320px]" : "max-w-[200px]")}>
              {model.photo.src ? (
                <img src={model.photo.src} alt="" className="size-full origin-[50%_46%] scale-[1.32] object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-0.5 text-ink-3">
                  <span className="font-mono text-lg text-ink-2">{model.hs}</span>
                  <span className="text-xs">no photo yet</span>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-3 max-sm:text-sm">
              {PHOTO_CAPTION} {model.hs}
              {model.generatedOn ? `, generated ${model.generatedOn}` : ""}. Not the supplier&apos;s own product; a photo from the supplier replaces it once they upload one.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {factList}

            <div className="flex flex-wrap items-center gap-2">
              {model.sanctioned ? (
                <Refusal />
              ) : model.rfqHref ? (
                <Link href={model.rfqHref} prefetch={false} scroll={false} className={buttonClass({ kind: "primary" })}>
                  Send RFQ for this line
                </Link>
              ) : null}
              {/* "Exporters", not "Other exporters": the count is what the search behind it returns, and that includes this record. */}
              <Link href={`/app/discover?hs=${model.hs}`} className={buttonClass({ kind: "secondary" })}>
                Exporters of {model.hs}
                {model.exporters !== null ? <span className="font-mono text-ink-3">· {formatCount(model.exporters)}</span> : null}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PhoneLine model={model} page={page} today={today} factList={factList} />
    </section>
  );
}

const P_TITLE = "text-lg font-medium tracking-tight text-ink";
const P_CARD = "flex flex-col overflow-clip rounded-[10px] border border-line";
const P_NUM = "[font-variant-numeric:tabular-nums]";

/**
 * One export line on a phone (Paper page 36, `export-line`): the way back and the supplier, what the line
 * is, then the supplier's customs totals and its markets. Those totals are the supplier's, every line
 * together: customs data is per supplier and per market, never per HS code, and the note says so. The
 * only per-line customs facts are the stored top shipments whose own code is this heading.
 */
function PhoneLine({ model, page, today, factList }: { model: ProductSheetModel; page: boolean; today: Date; factList: ReactNode }) {
  const H = page ? "h2" : "h3";
  const v = model.volza ?? null;
  const markets = v ? marketShares(v).filter((m) => m.buyers !== null) : [];
  const shipped = v ? lineShipments(v, model.hs) : [];
  const behind = v ? recordsEnd(v, today) : null;
  const countries = v?.summary?.count_of_unique_destination_countries ?? null;
  const lines = model.lines ?? 0;
  const head = (title: string, aside: string | null) => (
    <div className="flex items-baseline justify-between gap-3 pb-3.5 pt-6">
      <H className={P_TITLE}>{title}</H>
      {aside ? <span className="text-sm text-ink-3">{aside}</span> : null}
    </div>
  );
  const name = "text-xl/[30px] font-semibold tracking-[-0.025em] text-ink [overflow-wrap:anywhere]";
  return (
    <div data-line-phone="" className="flex flex-col sm:hidden">
      <div className="flex min-h-14 items-center gap-3 px-4 pb-2.5 pt-1.5">
        {model.backHref ? (
          <Link href={model.backHref} aria-label="Back to the record" scroll={false} className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 before:absolute before:-inset-1 active:bg-line", ring)}>
            <ArrowLeft size={17} weight="thin" aria-hidden />
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {page ? <h1 className={name}>{model.supplierName}</h1> : <p className={name}>{model.supplierName}</p>}
          <p className="text-sm text-ink-3">
            <span className="font-mono text-ink-2">HS {model.hs}</span> · {model.heading}
          </p>
        </div>
      </div>

      <div className="flex flex-col px-5 pb-8 pt-1">
        <div className="flex flex-col gap-1.5 text-base text-ink-2">
          <p className="flex items-start gap-2">
            <FileText size={16} weight="thin" className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            {model.exported && lines > 0 ? `One of ${lines} ${lines === 1 ? "line" : "lines"} on its EPB exporter page` : lineEyebrow(model)}
          </p>
          {model.place ? (
            <p className="flex items-start gap-2">
              <Storefront size={16} weight="thin" className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              {model.place}
            </p>
          ) : null}
        </div>

        {v ? (
          <section aria-label="Customs records" className={cn("flex flex-col", P_NUM)}>
            {head("Customs records", customsWindow(v))}
            <div className="flex flex-col gap-3">
              <dl className={P_CARD}>
                {v.fob_usd !== null ? (
                  <div className="flex flex-col gap-1 border-b border-line px-3.5 pb-3 pt-3.5">
                    <dt className="text-sm text-ink-3">Exported in {windowSpan(v)}</dt>
                    <dd className="text-xl font-medium tracking-tighter text-ink">{formatUsdShort(v.fob_usd)}</dd>
                    <dd className="text-sm text-ink-2">Free on board, across {lines > 1 ? `all ${lines} lines` : "every line"}</dd>
                  </div>
                ) : null}
                <div className="flex">
                  <div className="flex flex-1 flex-col gap-1 border-r border-line px-3.5 pb-3 pt-3.5">
                    <dt className="text-sm text-ink-3">Shipments</dt>
                    <dd className="text-xl font-medium tracking-tighter text-ink">{v.shipments.toLocaleString("en-GB")}</dd>
                    {countries ? (
                      <dd className="text-sm text-ink-2">
                        to {countries} {countries === 1 ? "country" : "countries"}
                      </dd>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3 pt-3.5">
                    <dt className="text-sm text-ink-3">Buyers</dt>
                    <dd className="text-xl font-medium tracking-tighter text-ink">{v.buyers !== null ? v.buyers.toLocaleString("en-GB") : "Not counted"}</dd>
                    <dd className="text-sm text-ink-2">named on the records</dd>
                  </div>
                </div>
              </dl>
              <p data-line-customs-note="" className="flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-sm text-ink-2">
                <Info size={16} weight="thin" className="mt-px shrink-0 text-ink-3" aria-hidden />
                <span>
                  These totals are the supplier&apos;s, every line together: customs records are not split by HS code.{shipped.length ? ` The shipments below are the ones coded ${model.hs}.` : ""}
                </span>
              </p>
            </div>

            {markets.length > 0 ? (
              <>
                {head("By market", "Largest first")}
                <ul className={P_CARD}>
                  {markets.map((m) => (
                    <li key={m.name} className="flex min-h-12 items-center gap-2.5 border-t border-line px-4 py-3 first:border-t-0">
                      <Globe size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
                      <span className="min-w-0 flex-1 text-base text-ink-2">{m.name}</span>
                      <span className="flex flex-col items-end">
                        {m.value ? <span className="text-base font-medium text-ink">{m.value}</span> : null}
                        <span className="text-xs text-ink-3">
                          {m.shipments.toLocaleString("en-GB")} shipments · {m.buyers} buyers
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {shipped.length > 0 ? (
              <>
                {head(`Shipments coded ${model.hs}`, "Top one per market")}
                <ul className={P_CARD}>
                  {shipped.map((x) => (
                    <li key={`${x.market}-${x.code}-${x.day}`} className="flex gap-3 border-t border-line p-4 first:border-t-0">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-md/[22px] font-medium text-ink">{x.buyer ?? `A buyer in ${x.market}`}</span>
                        <span className="text-sm text-ink-2">{x.what}</span>
                        <span className="text-xs text-ink-3">
                          <span className="font-mono">{x.code}</span>
                          {x.day ? ` · ${x.day}` : ""}
                        </span>
                      </span>
                      {x.value ? <span className="shrink-0 text-md/[22px] font-medium text-ink">{x.value}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        {head("On the record", null)}
        {factList}

        {v ? (
          <p className="flex flex-wrap items-center gap-1.5 pt-4 text-xs text-ink-3">
            <FileText size={14} weight="thin" className="shrink-0" aria-hidden />
            Customs records · read {shortDay(v.fetched_at, today) ?? "date unknown"}
            {behind !== null ? (
              <span className="flex items-center gap-1 font-medium text-caution">
                <Clock size={12} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
                ends {behind} days ago
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* The line's two actions, fixed to the foot of the screen on the page as the record's are; in the drawer they stick to its scroll. */}
      <div data-line-actions="" className={cn("bottom-0", page ? "fixed inset-x-0 z-sticky [transform:translateZ(0)]" : "sticky")}>
        {model.sanctioned ? (
          <div role="status" className="flex min-h-action-bar items-center gap-3 border-t-2 border-sanction bg-sanction-tint px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <p className="text-base font-medium text-sanction">{REFUSAL}</p>
          </div>
        ) : (
          <div className="box-content flex h-[calc(theme(spacing.action-bar)_-_1px)] items-center gap-2 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)]">
            <Link href={`/app/discover?hs=${model.hs}`} className={cn("flex h-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line px-3.5 active:bg-sunken", ring)}>
              <span className="text-base/[18px] font-medium text-ink">Exporters</span>
              {model.exporters !== null ? <span className={cn("text-xs/[14px] text-ink-3", P_NUM)}>{formatCount(model.exporters)}</span> : null}
            </Link>
            {model.rfqHref ? (
              <div className="min-w-0 flex-1">
                <Link href={model.rfqHref} scroll={false} className={buttonClass({ kind: "primary", size: "touch", full: true })}>
                  Send RFQ for this line
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
