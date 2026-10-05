// One export line of a record (B11b, on the v4 kit; Paper `10 · Record pane` and `Record full page`):
// the page for ONE HS heading. The photo (the catalogue's, captioned as illustrative, or the code
// where there is none), what the line is, the facts the record holds about it, and two actions: Send
// RFQ for this line and every exporter of the heading. One view for the pane beside the results and
// the full page, as the record's own. A sanctioned record keeps its solid band and the refusal in
// words in place of Send RFQ; nothing is scored and no contact value is in the model.

/* eslint-disable @next/next/no-img-element -- static catalogue file under /public */
import { ArrowSquareOut, CaretLeft, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { CertChip, buttonClass } from "@/components/kit";
import { FactList, FactRow, REFUSAL, Refusal, SanctionBanner } from "@/components/patterns";
import { formatCount } from "@/lib/dashboard/facts";
import type { ProductSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { PHOTO_CAPTION, lineEyebrow, lineFacts, type LineFact } from "./words";

const LINK =
  "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** "From BGMEA · read 12 Aug 2026", each register a link where the record carries its page; or that the source is not linked yet. */
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
  ) : fact.pending ? (
    "Source not linked yet"
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

export function LineView({ model, mode }: { model: ProductSheetModel; mode: "pane" | "page" }) {
  const page = mode === "page";
  // The search's own title is the page's h1 beside a pane.
  const Title = page ? "h1" : "h2";
  const facts = lineFacts(model.facts);
  return (
    // Beside the results the labelled region is what focus moves into, so it is announced by its name (`PaneFocus`).
    <section
      aria-label="Product line"
      data-detail={page ? "" : undefined}
      data-record-pane={page ? undefined : ""}
      tabIndex={page ? undefined : -1}
      className="flex min-h-0 flex-1 flex-col bg-surface outline-none"
    >
      {model.sanctioned ? (
        <SanctionBanner title={`Sanctioned${model.sanctionSample ? " · sample record" : ""}: matched on a sanctions screen.`} detail={REFUSAL} />
      ) : null}

      <div className={cn("flex min-h-12 items-center justify-between gap-3 px-4 sm:px-6", page && "lg:px-8")}>
        {model.backHref ? (
          <Link
            href={model.backHref}
            aria-label="Back to the record"
            scroll={false}
            prefetch={false}
            className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-md font-medium text-ink outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-sm sm:text-brand sm:underline sm:decoration-1 sm:[text-underline-position:from-font]"
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

      <div className={cn("flex min-h-0 flex-col gap-5 px-4 pb-8 sm:px-6", page && "mx-auto w-full max-w-[1120px] lg:px-8")}>
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
    </section>
  );
}
