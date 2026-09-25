// SupplierSheet (REZ-A, handoff §3.3): the record as an 880px sheet over the
// results. Bar · head (initials, name in heading-lg that wraps, meta with a
// mark per fact, the full mark row with names) · tabs with mono counts ·
// Overview (summary + FactsPanel beside the locked contact card) · Products
// (four stats + six-up grid) · Certificates · Safety · the sticky action bar.
// A sanctioned record adds the banner under the bar and disables Send RFQ.
//
// REZ-C adds the last four sections — Sources, Locations, Facilities and
// RFQs — so every tab now leads somewhere, and turns the bar and the action
// bar into real controls (Close, Share, Send RFQ, Save). The same component
// serves the overlay over the results (`?record=<slug>`) and the full page at
// `/app/suppliers/[slug]`; `closeHref` is what tells them apart.

import Link from "next/link";
import type { ReactNode } from "react";
import { onFileLabel } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { Button } from "./controls";
import { CopyLinkButton } from "./copy-link-button";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { PHOTO_CAPTION, PhotoGrid } from "./photo-tiles";
import { ReportProblem } from "./report-problem";
import {
  ActionBar,
  AffiliationNote,
  CertGrid,
  FactsPanel,
  FacilitiesList,
  LocationsList,
  LockCard,
  QuietEmpty,
  RecordRfqList,
  RscBlock,
  SanctionBanner,
  SanctionEvidence,
  Sheet,
  SheetBar,
  SheetScroll,
  SheetSection,
  SheetTabs,
  SourcesList,
  Stats,
} from "./sheet";
import { MetaLine } from "./supplier-result-card";
import { Caption, Heading, Label } from "./type";

/** "61 and 62" · "52, 55, 59 and 60" — a list a buyer reads, not an array. */
function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function SupplierSheet({
  model,
  assertModal,
  dialog,
  save,
}: {
  model: SupplierSheetModel;
  assertModal?: boolean;
  /** False on the full record page, which is not a dialog. */
  dialog?: boolean;
  /** The real Save control. A caller with no session (the gallery) passes none and the bar shows it disabled. */
  save?: ReactNode;
}) {
  const p = model.products;
  return (
    <Sheet label="Supplier record" assertModal={assertModal} dialog={dialog}>
      <SheetBar>
        {/* Close returns to the results the overlay sits over. The full page
            has nothing to close, so it offers no dead control. */}
        {model.closeHref ? (
          <Button variant="ghost" icon aria-label="Close" href={model.closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
        ) : null}
        <Label className="text-ink-strong">Supplier record</Label>
        <Caption>
          {model.readDate ? `Read ${model.readDate} · ` : ""}
          {model.sourceCount} {model.sourceCount === 1 ? "source" : "sources"}
        </Caption>
        <span className="ml-auto flex items-center gap-2">
          {/* Share copies the record's own page on both: in the overlay that is
              `fullHref`, not the search URL underneath. */}
          <CopyLinkButton href={model.fullHref} />
          <ReportProblem page={model.fullHref} />
        </span>
      </SheetBar>
      {model.sanctioned ? <SanctionBanner sample={model.sanctionSample} evidenceHref="#sanctions" /> : null}
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
          {/* The locked card sits beside the facts on a desktop and under them on a
              phone: a fixed 300px column left 20px for the facts at 320px. */}
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              {model.summary ? <p className="m-0 max-w-prose text-base text-ink">{model.summary}</p> : null}
              <FactsPanel rows={model.facts} />
            </div>
            <div className="flex flex-col gap-3">
              <LockCard hidden={model.contact.hidden} plan={model.contact.plan} held={model.contact.held} sanctioned={model.sanctioned} />
              {/* The dates per register are the Sources section's own rows;
                  this line is the summary beside the locked card. */}
              {model.readDates ? <Caption>Read dates: {model.readDates}.</Caption> : null}
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
            /* Was `href="#products"` — a link from the Products section to the
               Products section. The grid shows six tiles; a record with twelve
               headings had six lines reachable from nowhere. This lists every
               heading the record exports. */
            p.lines > 0 && p.allLinesHref ? (
              <Link prefetch={false} scroll={false} href={p.allLinesHref} className="inline-flex items-center gap-0.5 text-brand-ink">
                All {p.lines} lines <Icon name="chev-r" small />
              </Link>
            ) : null
          }
        >
          <Stats
            items={[
              {
                key: "HS lines",
                value: p.lines > 0 ? String(p.lines) : "—",
                sub: p.linesUnknown
                  ? "could not be read"
                  : p.lines > 0
                    ? `EPB${p.chapters.length ? `, ${p.chapters.length === 1 ? "chapter" : "chapters"} ${listWords(p.chapters)}` : ""}`
                    : p.onEpb
                      ? "none on the EPB page"
                      : "not on the EPB list",
              },
              { key: "Product list", value: p.productListCount > 0 ? String(p.productListCount) : "—", sub: p.productListCount > 0 ? "items on file · source pending" : "none on file" },
              {
                key: "Certified scope",
                // An expired scope is still the record's scope; discarding it
                // printed "no scope certificate" over a certificate on file.
                value: p.certifiedScope ? (p.certifiedScope.state === "expired" ? `${p.certifiedScope.scheme} · expired` : p.certifiedScope.scheme) : "—",
                sub: p.certifiedScope?.scope ?? p.certifiedScopeEmpty,
              },
              { key: "Buyer lists", value: p.buyerLists.length > 0 ? String(p.buyerLists.length) : "—", sub: p.buyerLists.length > 0 ? p.buyerLists.join(" · ") : p.buyerListsEmpty },
            ]}
          />
          {/* The list the "Product list" stat counts. With no EPB lines there
              are no tiles and no line sheets, so this is the only place a
              buyer can read what the company says it makes. */}
          {p.productList.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Caption>Product list · as filed · source pending</Caption>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" data-product-list="true">
                {p.productList.map((item, i) => (
                  <li key={`${i}-${item}`} className="rounded-sm border border-line px-2 py-0.5 text-sm text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.tiles.length > 0 ? (
            <>
              <PhotoGrid tiles={p.tiles} lineHref={(hs) => model.lineHref(hs)} />
              <Caption>{PHOTO_CAPTION}. A supplier-attested upload replaces it (V2).</Caption>
            </>
          ) : null}
        </SheetSection>
        <SheetSection id="certificates" title="Certificates" caption={model.certsCaption ?? (model.certs.length ? onFileLabel(model.certs.length) : model.certsEmpty)}>
          {model.certs.length > 0 ? (
            <CertGrid certs={model.certs} />
          ) : (
            /* The bare "No certificate on any register" stood over a payload
               carrying a building's certificate; the card already said which
               building, and the sheet now says it in the same breath. */
            <span className="inline-flex h-[26px] items-center rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink">
              {model.certsEmptyChip}
            </span>
          )}
          {/* A building's certificate is not this record's, but saying nothing
              about it leaves "none on 4 registers" over a payload that holds one. */}
          {model.certBuildings.length > 0 ? (
            <Caption>
              {model.certBuildings.join(", ")} {model.certBuildings.length === 1 ? "holds a certificate" : "hold certificates"} of its own —
              shown on the building, not counted here.
            </Caption>
          ) : null}
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
            <RscBlock of={model.name} progress={model.rsc.progress} status={model.rsc.status} training={model.rsc.training} links={model.rsc.links} />
          ) : (
            <span className="inline-flex h-[26px] items-center rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink">
              {model.rscBuildings.length > 0 ? "No active RSC record for this company itself" : "No active RSC record on file"}
            </span>
          )}
          {/* The building's own row, labelled as the building's. The register
              published a percentage, a status and up to five reports for it;
              naming the building and dropping all of them told the buyer less
              than the register holds. */}
          {model.rscBuildingBlocks.map((b) => (
            <div key={b.name} className="flex flex-col gap-2 rounded-sm border border-line px-3.5 py-3">
              <Caption>
                {b.name} — the building&apos;s own RSC record{b.readDate ? ` · read ${b.readDate}` : ""}
              </Caption>
              <RscBlock of={b.name} progress={b.progress} status={b.status} training={b.training} links={b.links} />
            </div>
          ))}
        </SheetSection>
        {/* The banner asserts the match; this is where a buyer reads it. The
            page this sheet replaced carried these rows on its Compliance tab,
            and the banner's own copy pointed at them. */}
        {model.sanctioned ? (
          <SheetSection
            id="sanctions"
            title="Sanctions matches"
            caption={model.sanctions.length > 0 ? `${model.sanctions.length} on file` : null}
          >
            {model.sanctions.length > 0 ? (
              <SanctionEvidence rows={model.sanctions} />
            ) : (
              <QuietEmpty>{model.sanctionsEmpty}</QuietEmpty>
            )}
          </SheetSection>
        ) : null}
        <SheetSection id="sources" title="Sources" caption={model.sourcesCaption}>
          {model.sources.length > 0 ? (
            <SourcesList rows={model.sources} />
          ) : (
            <QuietEmpty>No register has filed a record for this company</QuietEmpty>
          )}
        </SheetSection>
        <SheetSection
          id="locations"
          title="Locations"
          caption={
            model.locations.length > 0
              ? `${model.locations.length} ${model.locations.length === 1 ? "premises" : "premises"} · registry spellings merged`
              : null
          }
        >
          {model.locations.length > 0 ? (
            <LocationsList rows={model.locations} />
          ) : (
            <QuietEmpty>{model.locationsEmpty}</QuietEmpty>
          )}
        </SheetSection>
        {/* REZ-73's buildings (`buyer_supplier_facility_panel`), as the page
            this replaced and the public profile list them. An unread panel
            says so; it never says the company has no buildings. */}
        <SheetSection
          id="facilities"
          title="Facilities"
          caption={model.facilities.count ? `${model.facilities.count} extension building${model.facilities.count === 1 ? "" : "s"}` : null}
        >
          {model.facilities.rows.length > 0 ? (
            <FacilitiesList rows={model.facilities.rows} />
          ) : (
            <QuietEmpty>{model.facilities.empty}</QuietEmpty>
          )}
        </SheetSection>
        <SheetSection
          id="rfqs"
          title="RFQs"
          caption={model.rfqs.count === null ? null : `${model.rfqs.count} from your account`}
        >
          {model.rfqs.rows.length > 0 ? <RecordRfqList rows={model.rfqs.rows} /> : <QuietEmpty>{model.rfqs.empty}</QuietEmpty>}
        </SheetSection>
        <AffiliationNote />
      </SheetScroll>
      <ActionBar sanctioned={model.sanctioned} everyMarkLinks={model.everyMarkLinks} rfqHref={model.rfqHref} save={save} />
    </Sheet>
  );
}
