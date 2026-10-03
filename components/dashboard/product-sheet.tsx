// ProductSheet (REZ-A, handoff §3.4): one HS export line as a nested sheet
// with Back and a breadcrumb. Left the 320px illustrative photo with its
// caption; right the eyebrow, the official heading, a FactsPanel, and the two
// actions. Price · MOQ · lead time are supplier-attested and read
// "Not attested" until attested.

/* eslint-disable @next/next/no-img-element -- static catalogue file under /public */
import { formatCount } from "@/lib/dashboard/facts";
import type { ProductSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { Button } from "./controls";
import { Icon } from "./icons";
import { PHOTO_CAPTION } from "./photo-tiles";
import { FactsPanel, SanctionBanner, Sheet, SheetBar, SheetScroll } from "./sheet";
import { Caption, Code, Eyebrow, Heading } from "./type";

export function ProductSheet({
  model,
  mode = "pane",
}: {
  model: ProductSheetModel;
  /** `pane` beside the results (the default); `page` on the full line page. */
  mode?: "pane" | "page";
}) {
  return (
    <Sheet label="Product line" mode={mode}>
      <SheetBar>
        {model.backHref ? (
          <Button variant="ghost" aria-label="Back to the record" href={model.backHref} clientNav scroll={false}>
            <Icon name="chev-l" /> Back
          </Button>
        ) : (
          <Button variant="ghost" aria-label="Back" disabled>
            <Icon name="chev-l" /> Back
          </Button>
        )}
        {/* The company's name on one line, cut at the end with the whole
            name in its title (the One-Line Name Rule); the HS code never cut. */}
        <span className="inline-flex min-w-0 items-center gap-x-1.5 text-sm text-ink-muted">
          <span data-name="" title={model.supplierName} className="min-w-0 truncate">
            {model.supplierName}
          </span>
          <span className="text-ink-subtle">/</span>
          <Code className="shrink-0 text-ink-strong">HS {model.hs}</Code>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {model.closeHref ? (
            <Button variant="ghost" icon aria-label="Close" href={model.closeHref} clientNav scroll={false}>
              <Icon name="x" />
            </Button>
          ) : null}
        </span>
      </SheetBar>
      {model.sanctioned ? <SanctionBanner sample={model.sanctionSample} /> : null}
      <SheetScroll measure={mode === "page"}>
        {/* The photo beside the facts where there is room. The pane is a share
            of the content region, so beside the results that waits for `xl`. */}
        {/* The pane is a share of the content region, not the viewport, so a
            grid keyed on `xl:` clipped the facts at 1440. In the pane the photo
            sits above the facts at 200px; the page keeps the two columns. */}
        <div className={cn("grid items-start gap-6 p-6", mode === "page" && "md:grid-cols-[320px_1fr]")}>
          <div>
            <div className={cn("aspect-square w-full overflow-hidden rounded-sm bg-surface-sunken", mode === "page" ? "max-w-[320px]" : "max-w-[200px]")}>
              {model.photo.src ? (
                <img src={model.photo.src} alt="" className="size-full origin-[50%_46%] scale-[1.32] object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-0.5 text-ink-subtle">
                  <Code className="text-title text-ink-muted">{model.hs}</Code>
                  <Caption>no photo yet</Caption>
                </div>
              )}
            </div>
            <Caption className="mt-2 block">
              {PHOTO_CAPTION} {model.hs}
              {model.generatedOn ? `, generated ${model.generatedOn}` : ""}. Not the supplier&apos;s own product; a
              a photo from the supplier replaces it once they upload one.
            </Caption>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              {/* "EPB export line" is a claim about this record's EPB page. A
                  heading the record does not export gets the plain eyebrow. */}
              <Eyebrow>
                HS {model.hs}
                {model.exported ? " · EPB export line" : model.linesUnknown ? " · EPB lines could not be read" : " · not on this record's EPB page"}
              </Eyebrow>
              <Heading level="h" as="h1" className="mt-1">
                {model.heading}
              </Heading>
            </div>
            <FactsPanel rows={model.facts} />
            {/* Wraps: the two large buttons are 352px side by side, wider than
                the column at 320px, and the whole sheet scrolled sideways. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                lg
                disabled={model.sanctioned}
                href={model.sanctioned ? undefined : (model.rfqHref ?? undefined)}
                clientNav
                scroll={false}
              >
                <Icon name="send" /> Send RFQ for this line
              </Button>
              {/* "Exporters", not "Other exporters": the count is what the
                  search behind it returns, and that includes this record. */}
              <Button lg href={`/app/discover?hs=${model.hs}`}>
                Exporters of {model.hs}
                {model.exporters !== null ? (
                  <span className="font-mono text-ink-subtle">· {formatCount(model.exporters)}</span>
                ) : null}
              </Button>
            </div>
          </div>
        </div>
      </SheetScroll>
    </Sheet>
  );
}
