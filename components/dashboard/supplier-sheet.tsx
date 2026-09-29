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
import type { FactRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { Button } from "./controls";
import { CopyLinkButton } from "./copy-link-button";
import { Icon } from "./icons";
import { SbIcon } from "./sb-icons";
import { LogoTile, SourceMarks } from "./marks";
import { PhotoList } from "./photo-tiles";
import { ReportProblem } from "./report-problem";
import {
  ActionBar,
  AffiliationNote,
  CertGrid,
  FactsLegend,
  FactsPanel,
  FacilitiesList,
  LocationsList,
  LockCard,
  PendingMark,
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
import { Caption, Eyebrow, Heading, Label } from "./type";

/**
 * The product list as the register filed it, made readable: spellings that
 * differ only in case or spacing merge (founder, 25 Sep), the list sorts,
 * the first eight show and the rest fold behind "+N as filed". Nothing is
 * dropped and nothing is invented; the source is still pending per item.
 */
export function groupProductList(items: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of items) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (!seen.has(key)) seen.set(key, text);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

const PRODUCT_LIST_SHOWN = 8;

function ProductList({ items }: { items: readonly string[] }) {
  const list = groupProductList(items);
  const shown = list.slice(0, PRODUCT_LIST_SHOWN);
  const rest = list.slice(PRODUCT_LIST_SHOWN);
  const chip = (item: string) => (
    <li key={item} className="rounded-sm bg-surface-sunken px-2 py-0.5 text-sm text-ink">
      {item}
    </li>
  );
  return (
    <div className="flex flex-col gap-1.5" data-product-list="true">
      <Caption className="inline-flex items-center gap-1.5">
        {list.length} {list.length === 1 ? "item" : "items"} as filed <PendingMark />
      </Caption>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{shown.map(chip)}</ul>
      {rest.length > 0 ? (
        <details className="group/pl">
          <summary className="cursor-pointer list-none text-sm font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open/pl:hidden">+{rest.length} more as filed</span>
            <span className="hidden group-open/pl:inline">Show fewer</span>
          </summary>
          <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">{rest.map(chip)}</ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * The Overview's facts, in the groups a buyer reads them by: who the company
 * is, where it is, how big it is, and what it is registered with. One flat
 * list of eleven rows with a mark at each end read as a wall of text
 * (founder's walkthrough, 28 Sep 2026). A row the model adds that no group
 * names joins the first group rather than disappearing.
 */
export const FACT_GROUPS: readonly { title: string; labels: readonly string[] }[] = [
  { title: "Company", labels: ["Registered name", "Type", "Parent group", "Established", "EPZ zone"] },
  { title: "Location", labels: ["Factory address"] },
  { title: "Workforce and capacity", labels: ["Workers", "Women · men", "Sewing machines", "Capacity, as filed"] },
  { title: "Registrations", labels: ["Registers"] },
];

export function groupFacts(facts: readonly FactRow[]): { title: string; rows: FactRow[] }[] {
  const named = new Set(FACT_GROUPS.flatMap((g) => g.labels));
  const groups = FACT_GROUPS.map((g) => ({ title: g.title, rows: facts.filter((f) => g.labels.includes(f.label)) }));
  const loose = facts.filter((f) => !named.has(f.label));
  if (loose.length > 0) groups[0]!.rows.push(...loose);
  return groups.filter((g) => g.rows.length > 0);
}

/** "61 and 62" · "52, 55, 59 and 60" — a list a buyer reads, not an array. */
function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function SupplierSheet({
  model,
  mode = "pane",
  save,
  backHref,
}: {
  model: SupplierSheetModel;
  /** `pane` beside the results (the default); `page` on the full record page. */
  mode?: "pane" | "page";
  /** The real Save control. A caller with no session (the gallery) passes none and the bar shows it disabled. */
  save?: ReactNode;
  /**
   * The list with this record open beside it. In the pane, Expand carries it
   * to the full page; on the full page it is where "Back to results" goes.
   */
  backHref?: string | null;
}) {
  const p = model.products;
  const expandHref = backHref ? `${model.fullHref}${model.fullHref.includes("?") ? "&" : "?"}back=${encodeURIComponent(backHref)}` : model.fullHref;
  return (
    <Sheet label="Supplier record" mode={mode}>
      <SheetBar>
        {/* Close returns to the results the overlay sits over. The full page
            has nothing to close; opened by Expand, it goes back to the list
            with the record open, which is where the buyer came from. */}
        {model.closeHref ? (
          <Button variant="ghost" icon aria-label="Close" href={model.closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
        ) : mode === "page" && backHref ? (
          <Button variant="ghost" size="sm" href={backHref} clientNav>
            <Icon name="chev-l" />
            Back to results
          </Button>
        ) : null}
        {/* One line: at half the region (524px at 1280) it broke as "Supplier / record". */}
        <Label className="shrink-0 whitespace-nowrap text-ink-strong">Supplier record</Label>
        <Caption>
          {model.readDate ? `Read ${model.readDate} · ` : ""}
          {model.sourceCount} {model.sourceCount === 1 ? "source" : "sources"}
        </Caption>
        <span className="ml-auto flex items-center gap-2">
          {/* Share copies the record's own page on both: in the overlay that is
              `fullHref`, not the search URL underneath. */}
          <CopyLinkButton href={model.fullHref} />
          <ReportProblem page={model.fullHref} />
          {/* The record over the whole content region (founder's video, 29 Sep
              2026); with the rail collapsed it is the full-screen view. */}
          {mode === "pane" ? (
            <Button variant="ghost" icon aria-label="Expand to full page" title="Expand to full page" href={expandHref} clientNav>
              <SbIcon name="expand" />
            </Button>
          ) : null}
        </span>
      </SheetBar>
      {model.sanctioned ? <SanctionBanner sample={model.sanctionSample} evidenceHref="#sanctions" /> : null}
      <SheetScroll measure={mode === "page"}>
        <div className="flex flex-col gap-3 px-6 pt-5">
          <div className="flex items-start gap-4">
            <LogoTile initials={model.initials} tier={model.topTier} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Heading level="lg" as="h1">
                {model.name}
              </Heading>
              <MetaLine facts={model.meta} inRow={new Set(model.marks.map((m) => m.code))} />
              {/* Each source once (founder's pick, 29 Sep 2026): the facts line
                  is plain and every source is a square in this one row, which
                  names itself on hover and to a screen reader. The names were
                  once spelled beside the squares and again in the Registers
                  row, so the head said a register three times. */}
              <SourceMarks marks={model.marks} caption="count" className="mt-0.5" />
            </div>
          </div>
        </div>
        <SheetTabs tabs={model.tabs} />
        <SheetSection id="overview">
          {/* The facts take the pane's whole width. The locked contact card
              used to sit beside them in a 300px column from 1536px — a
              breakpoint of the VIEWPORT, while the pane is a share of the
              content region — so on a 1600px display it squeezed every value
              into a thin column ("Not" / "on file", the registers a word a
              line). It is a strip under the facts now. */}
          <div className="flex flex-col gap-5">
            {model.summary ? <p className="m-0 max-w-prose text-base text-ink">{model.summary}</p> : null}
            <div className={cn("grid gap-x-10 gap-y-5", mode === "page" && "lg:grid-cols-2")}>
              {groupFacts(model.facts).map((g) => (
                <div key={g.title} className="flex min-w-0 flex-col gap-1.5">
                  <Eyebrow>{g.title}</Eyebrow>
                  <FactsPanel rows={g.rows} legend={false} />
                </div>
              ))}
            </div>
            {model.facts.some((r) => r.value !== null && r.pendingSource && !(r.marks && r.marks.length > 0)) ? <FactsLegend /> : null}
            <LockCard hidden={model.contact.hidden} plan={model.contact.plan} held={model.contact.held} counts={model.contact.counts} sanctioned={model.sanctioned} />
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
              { key: "Product list", value: p.productListCount > 0 ? String(p.productListCount) : "—", sub: p.productListCount > 0 ? "as filed" : "none on file" },
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
          {p.productList.length > 0 ? <ProductList items={p.productList} /> : null}
          {/* One row per heading, each photo tagged as an illustration; the
              caption under a grid of photos said the same once for all. */}
          {p.tiles.length > 0 ? <PhotoList tiles={p.tiles} lineHref={(hs) => model.lineHref(hs)} /> : null}
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
          {/* A building's certificate is not this record's, and is not counted
              as its; it is shown here under the building's name, because the
              building's own URL redirects to this record. */}
          {model.buildingCerts.map((b) => (
            <div key={b.building} className="mt-4 flex flex-col gap-2" data-building-certs={b.building}>
              <Caption>Held by {b.building} · the building&apos;s own, not counted above</Caption>
              <CertGrid certs={b.certs} />
            </div>
          ))}
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
            <div key={b.name} className="flex flex-col gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3.5">
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
        <SheetSection id="sources" title="Sources" caption={model.sourcesCaption} collapsible>
          {model.sources.length > 0 ? (
            <SourcesList rows={model.sources} />
          ) : (
            <QuietEmpty>No register has filed a record for this company</QuietEmpty>
          )}
        </SheetSection>
        <SheetSection
          id="locations"
          collapsible
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
          collapsible
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
          collapsible
          title="RFQs"
          caption={model.rfqs.count === null ? null : `${model.rfqs.count} from your account`}
        >
          {model.rfqs.rows.length > 0 ? <RecordRfqList rows={model.rfqs.rows} /> : <QuietEmpty>{model.rfqs.empty}</QuietEmpty>}
        </SheetSection>
        <AffiliationNote />
      </SheetScroll>
      <ActionBar sanctioned={model.sanctioned} rfqHref={model.rfqHref} save={save} />
    </Sheet>
  );
}
