// SupplierSheet (REZ-A, handoff §3.3): the record as an 880px sheet over the
// results. Bar · head (initials, name in heading-lg that wraps, meta with a
// mark per fact, the full mark row with names) · tabs with mono counts ·
// Overview (summary + FactsPanel beside the locked contact card) · Products
// (four stats + six-up grid) · Certificates · Safety · the sticky action bar.
// A sanctioned record adds the banner under the bar and disables Send RFQ.

import { onFileLabel } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { Button } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { PhotoGrid } from "./photo-tiles";
import {
  ActionBar,
  CertGrid,
  FactsPanel,
  LockCard,
  RscBlock,
  SanctionBanner,
  Sheet,
  SheetBar,
  SheetScroll,
  SheetSection,
  SheetTabs,
  Stats,
} from "./sheet";
import { MetaLine } from "./supplier-result-card";
import { Caption, Heading, Label } from "./type";

export function SupplierSheet({ model }: { model: SupplierSheetModel }) {
  const p = model.products;
  const everyMarkLinks =
    model.marks.every((m) => Boolean(m.href)) && model.facts.every((f) => f.value === null || (f.marks ?? []).every((m) => Boolean(m.href)));
  return (
    <Sheet label="Supplier record">
      <SheetBar>
        <Button variant="ghost" icon aria-label="Close">
          <Icon name="x" />
        </Button>
        <Label className="text-ink-strong">Supplier record</Label>
        <Caption>
          {model.readDate ? `Read ${model.readDate} · ` : ""}
          {model.sourceCount} {model.sourceCount === 1 ? "source" : "sources"}
          {model.pagesUnchanged === true ? " · pages unchanged since read" : model.pagesUnchanged === false ? " · a source page changed since read" : ""}
        </Caption>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost">
            <Icon name="share" /> Share
          </Button>
          <Button variant="ghost" icon aria-label="More">
            <Icon name="dots" />
          </Button>
        </span>
      </SheetBar>
      {model.sanctioned ? <SanctionBanner sample={model.sanctionSample} /> : null}
      <SheetScroll>
        <div className="flex flex-col gap-3 px-6 pt-5">
          <div className="flex items-start gap-4">
            <LogoTile initials={model.initials} tier={model.topTier} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Heading level="lg" as="h1">
                {model.name}
              </Heading>
              <MetaLine facts={model.meta} />
              <SourceMarks marks={model.marks} caption="names" className="mt-0.5" />
            </div>
          </div>
        </div>
        <SheetTabs tabs={model.tabs} />
        <SheetSection id="overview">
          <div className="grid grid-cols-[1fr_300px] items-start gap-6">
            <div className="flex flex-col gap-4">
              {model.summary ? <p className="m-0 max-w-prose text-base text-ink">{model.summary}</p> : null}
              <FactsPanel rows={model.facts} />
            </div>
            <div className="flex flex-col gap-3">
              <LockCard hidden={model.contact.hidden} plan={model.contact.plan} />
              {model.readDates ? (
                <Caption>
                  Read dates: {model.readDates}.{" "}
                  <a href="#sources" className="text-brand-ink">
                    Sources tab
                  </a>
                </Caption>
              ) : null}
            </div>
          </div>
        </SheetSection>
        <SheetSection
          id="products"
          title="Products"
          caption={
            <>
              {p.linesUnknown
                ? "EPB export lines could not be read"
                : p.lines > 0
                  ? "EPB export lines"
                  : p.onEpb
                    ? "On the EPB exporter register · no lines on file"
                    : "Not on the EPB exporter list"}
              {p.exporterHref ? (
                <>
                  {" · "}
                  <a href={p.exporterHref} className="text-brand-ink">
                    exporter page {p.exporterRef}
                  </a>
                </>
              ) : null}
            </>
          }
          action={
            p.lines > 0 ? (
              <a href="#products" className="inline-flex items-center gap-0.5 text-brand-ink">
                All {p.lines} lines <Icon name="chev-r" small />
              </a>
            ) : null
          }
        >
          <Stats
            items={[
              { key: "HS lines", value: p.lines > 0 ? String(p.lines) : "—", sub: p.linesUnknown ? "could not be read" : p.lines > 0 ? `EPB${p.chapter ? `, chapter ${p.chapter}` : ""}` : p.onEpb ? "none on the EPB page" : "not on the EPB list" },
              { key: "Product list", value: p.productListCount > 0 ? String(p.productListCount) : "—", sub: p.productListCount > 0 ? "items on file · source pending" : "none on file" },
              { key: "Certified scope", value: p.certifiedScope?.scheme ?? "—", sub: p.certifiedScope?.scope ?? "no scope certificate" },
              { key: "Buyer lists", value: p.buyerLists.length > 0 ? String(p.buyerLists.length) : "—", sub: p.buyerLists.length > 0 ? p.buyerLists.join(" · ") : "not on 6 brand lists" },
            ]}
          />
          {p.tiles.length > 0 ? (
            <>
              <PhotoGrid tiles={p.tiles} />
              <Caption>Photos are illustrative, one per HS heading. A supplier-attested upload replaces them (V2).</Caption>
            </>
          ) : null}
        </SheetSection>
        <SheetSection id="certificates" title="Certificates" caption={model.certsCaption ?? (model.certs.length ? onFileLabel(model.certs.length) : "none on 4 registers")}>
          {model.certs.length > 0 ? (
            <CertGrid certs={model.certs} />
          ) : (
            <span className="inline-flex h-[26px] items-center rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink">
              No certificate on any register
            </span>
          )}
        </SheetSection>
        <SheetSection
          id="safety"
          title="Safety"
          caption={
            model.rsc
              ? `RSC${model.rsc.ref ? ` factory ${model.rsc.ref}` : ""}${model.rsc.readDate ? ` · read ${model.rsc.readDate}` : ""}`
              : model.rscBuildings.length > 0
                ? `RSC covers ${model.rscBuildings.join(", ")} — the buildings, not this record`
                : "No active RSC record on file"
          }
        >
          {model.rsc ? (
            <RscBlock progress={model.rsc.progress} status={model.rsc.status} training={model.rsc.training} links={model.rsc.links} />
          ) : (
            <span className="inline-flex h-[26px] items-center rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink">
              {model.rscBuildings.length > 0 ? "No active RSC record for this company itself" : "No active RSC record on file"}
            </span>
          )}
        </SheetSection>
      </SheetScroll>
      <ActionBar sanctioned={model.sanctioned} everyMarkLinks={everyMarkLinks} />
    </Sheet>
  );
}
