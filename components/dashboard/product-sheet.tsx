// ProductSheet (REZ-A, handoff §3.4): one HS export line as a nested sheet
// with Back and a breadcrumb. Left the 320px illustrative photo with its
// caption; right the eyebrow, the official heading, a FactsPanel, and the two
// actions. Price · MOQ · lead time are supplier-attested (V2) and read
// "Not on file" until attested.

/* eslint-disable @next/next/no-img-element -- static catalogue file under /public */
import { formatCount } from "@/lib/dashboard/facts";
import type { ProductSheetModel } from "@/lib/dashboard/models";
import { Button } from "./controls";
import { Icon } from "./icons";
import { PHOTO_CAPTION } from "./photo-tiles";
import { FactsPanel, SanctionBanner, Sheet, SheetBar, SheetScroll } from "./sheet";
import { Caption, Code, Eyebrow, Heading } from "./type";

export function ProductSheet({ model, assertModal }: { model: ProductSheetModel; assertModal?: boolean }) {
  return (
    <Sheet label="Product line" assertModal={assertModal}>
      <SheetBar>
        <Button variant="ghost" aria-label="Back">
          <Icon name="chev-l" /> Back
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          {model.supplierName} <span className="text-ink-subtle">/</span> <Code className="text-ink-strong">HS {model.hs}</Code>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost">
            <Icon name="share" /> Share
          </Button>
          <Button variant="ghost" icon aria-label="Close">
            <Icon name="x" />
          </Button>
        </span>
      </SheetBar>
      {model.sanctioned ? <SanctionBanner sample={model.sanctionSample} /> : null}
      <SheetScroll>
        <div className="grid grid-cols-[320px_1fr] items-start gap-6 p-6">
          <div>
            <div className="size-[320px] overflow-hidden rounded-sm border border-line-subtle bg-surface-sunken">
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
              supplier-attested upload replaces it (V2).
            </Caption>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              {/* "EPB export line" is a claim about this record's EPB page. A
                  heading the record does not export gets the plain eyebrow. */}
              <Eyebrow>HS {model.hs}{model.exported ? " · EPB export line" : " · not on this record's EPB page"}</Eyebrow>
              <Heading level="h" as="h1" className="mt-1">
                {model.heading}
              </Heading>
            </div>
            <FactsPanel rows={model.facts} />
            <div className="flex items-center gap-2">
              <Button variant="primary" lg disabled={model.sanctioned}>
                <Icon name="send" /> Send RFQ for this line
              </Button>
              <Button lg>
                Other exporters of {model.hs}
                {model.otherExporters !== null ? (
                  <span className="font-mono text-ink-subtle">{formatCount(model.otherExporters)}</span>
                ) : null}
              </Button>
            </div>
          </div>
        </div>
      </SheetScroll>
    </Sheet>
  );
}
