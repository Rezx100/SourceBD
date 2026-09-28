// The buyer screens in the gallery, each rendered inside the app shell at
// 1440 from the real records loaded by `lib/dashboard/gallery-data.ts`, laid
// out the way /app/discover draws them since the enterprise pass (27 Sep
// 2026): the ledger grid first, the thumbnail cards as the switch's other
// stop, and every record, line, composer and filter set in a pane BESIDE the
// results — never a dialog over them. The RFQ list is the body /app/rfqs
// renders.

import type { ReactNode } from "react";
import {
  AppShell,
  DiscoverFilters,
  Panel,
  PanelFooter,
  PanelHeader,
  ProductSheet,
  RecordPane,
  ResultsColumn,
  ResultsTable,
  RfqComposer,
  RfqListBody,
  SearchComposer,
  SupplierResultCard,
  SupplierSheet,
  Workbench,
  type ComposerPrefill,
  type ComposerTarget,
  type ResultsSortKey,
  type SidebarModel,
  type TopbarModel,
} from "@/components/dashboard";
import { Page } from "@/components/dashboard/page";
import type { RfqRow } from "@/components/dashboard/rfq-pages";
import { buildTableRow } from "@/lib/dashboard/build-models";
import { formatDay } from "@/lib/dashboard/facts";
import { GALLERY_QUERY, topbarCaption, type GalleryData, type GalleryRecord } from "@/lib/dashboard/gallery-data";
import { heading4 } from "@/lib/dashboard/hs-photos";
import type { TableRowModel } from "@/lib/dashboard/models";
import { discoverHref, parseDiscoverState, type DiscoverState } from "@/lib/discover-v32-state";

export const SCREEN_WIDTH = 1440;

/** The frames, in the order the gallery draws them (and the screenshot harness shoots them). */
export const SCREENS = ["results-table", "results-list", "supplier-sheet", "product-sheet", "rfq-composer", "filter-pane", "rfq-list"] as const;

function shellModels(d: GalleryData, active: SidebarModel["active"]): { sidebar: SidebarModel; topbar: TopbarModel } {
  const sidebar: SidebarModel = {
    active,
    // Every count here is the RPC's or absent. A read that failed renders no
    // pill at all: a "0" beside RFQs is a claim about the account, and this
    // sidebar is on every screen.
    // The sidebar counts the account's RFQs, not the rows on this page —
    // `sent` is the figure `rfq_list` supports, and it is null when the read
    // failed. `saved` needs `buyer_dashboard.saved_count` (REZ-C), so it is
    // unknown rather than zero.
    counts: { suppliers: d.published, rfqs: d.rfqError ? null : d.rfqs.sent, saved: null },
    recent: d.total !== null ? [{ label: GALLERY_QUERY.title, count: d.total, href: "#results-table" }] : [],
    // No billing exists yet: the plan line names the beta, never a plan or renewal date (handoff §3.10).
    plan: { name: d.plan ?? "Free · public beta" },
  };
  // "4 records on this page, read …" is true of the screens that draw those
  // supplier records. The RFQ list draws RFQs and no supplier record at all,
  // and `rfq_list` returns no read date of any kind, so the clause is dropped
  // there rather than carried by a shared shell.
  const drawsRecords = active !== "rfqs";
  const topbar: TopbarModel = {
    caption: topbarCaption(drawsRecords ? d : { published: d.published, recordsReadOn: null, recordsRead: null }),
    initial: null,
  };
  return { sidebar, topbar };
}

/**
 * The ledger screen's own topbar. It is the one screen that draws `extra`
 * rows beside the four named records (`rowRecords` in `gallery-data.ts`), so
 * it is the one screen whose caption may state a record count above 4 —
 * every other screen draws only the named records, and shares the narrower
 * span.
 */
function tableTopbarModel(d: GalleryData): TopbarModel {
  return { caption: topbarCaption({ published: d.published, recordsReadOn: d.tableRecordsReadOn, recordsRead: d.tableRecordsRead }), initial: null };
}

/** What the gallery's card panel actually holds, for the header caption. */
const SELECTION = "the named test records of the rebuild spec";

/**
 * What the ledger actually holds. `rows` is the named records plus up to four
 * `extra` discovery rows the ledger draws and nothing else does (see
 * `tableRecordsRead` in `gallery-data.ts`); on a live read those extra rows
 * are routinely present, so a caption calling them all "hand-picked" is false
 * the moment `extra` is non-empty.
 */
function tableSelection(d: GalleryData): string {
  const extraCount = d.rows.length - d.cards.length;
  if (extraCount <= 0) return SELECTION;
  return `the named test records of the rebuild spec, plus discovery's next ${extraCount} live match${extraCount === 1 ? "" : "es"}`;
}

function header(d: GalleryData, view: "cards" | "table", shown: number, selection: string) {
  // The count is the RPC's; when the RPC failed it is unknown (null), never 0.
  // `selection` because these rows are hand-picked: Zaheen and A.R. Fashion
  // hold no GOTS certificate, so they are not among the 42 the query returns,
  // and "1–4" would be a range claim over a set they are not in.
  return { title: GALLERY_QUERY.title, total: d.discoverError ? null : d.total, shown, sortLabel: "Most sources", view, selection };
}

/** The search these screens show, as the URL state /app/discover would parse: the text and the GOTS certificate kind, nothing else. */
export function galleryState(): DiscoverState {
  return parseDiscoverState(new URLSearchParams({ q: GALLERY_QUERY.q, cert: GALLERY_QUERY.certKinds.join(",") }));
}

/** The ledger's column sorts, as the URLs /app/discover would take. */
const sortHrefs = Object.fromEntries(
  (["name", "sources", "cert_expiry", "hs_lines", "workers"] as const).map((key) => [
    key,
    discoverHref(galleryState(), { sort: key as DiscoverState["sort"], page: 1 }),
  ]),
) as Record<ResultsSortKey, string>;

/** A record's row slug: the profile's own, which is what the ledger keys rows on. */
function slugOf(r: GalleryRecord | null): string | null {
  return r?.input.profile.supplier.slug ?? null;
}

function Frame({ id, title, note, height, children }: { id: string; title: string; note: string; height?: number; children: ReactNode }) {
  return (
    <figure id={id} className="m-0 space-y-2">
      <figcaption className="space-y-0.5">
        <span className="block text-sm font-medium text-ink-strong">{title}</span>
        <span className="block max-w-prose text-xs text-ink-subtle">{note}</span>
      </figcaption>
      {/* Breaks out of the gallery's 1200px column so a 1440 screen shows whole on a wide display; narrower displays scroll it. */}
      <div className="relative left-1/2 w-[min(100vw-2rem,1440px)] -translate-x-1/2 overflow-x-auto rounded-md border border-line bg-canvas">
        {/* `height`, not a minimum: the shell inside is `md:h-full`, so a
            framed screen is exactly this tall and its panes scroll inside it,
            as they do in a viewport. Without a height the shell grows to its
            content and the frame shows the whole page. */}
        <div style={{ width: SCREEN_WIDTH, height }} data-screen={id}>
          {children}
        </div>
      </div>
    </figure>
  );
}

/**
 * The search's workbench, as /app/discover lays it out: the results column
 * scrolls on its own and, when something is open, a pane sits on its right.
 * The gallery has no URL to close to, so its panes carry no `closeHref`.
 */
function Bench({ results, pane }: { results: ReactNode; pane?: ReactNode }) {
  return (
    <Workbench>
      <ResultsColumn besideRecord={Boolean(pane)}>{results}</ResultsColumn>
      {pane}
    </Workbench>
  );
}

function resultsNote(d: GalleryData): string {
  const total =
    d.total === null ? "the live count could not be read" : `${d.total} suppliers match the text "${GALLERY_QUERY.q}" with a GOTS certificate in production`;
  const names = d.cards.map((c) => c.name).join(" · ");
  return [
    `The named test records of the rebuild spec, shown in the query's frame: ${names} — hand-picked, not the query's first page`,
    "(Zaheen and A.R. Fashion hold no GOTS certificate, so the RPC does not return them).",
    `${total}. Zaheen is rendered as a labelled sanctioned SAMPLE — no company is sanctioned in production. Read ${formatDay(d.today.toISOString())}.`,
  ].join(" ");
}

/** The Aboni record as the composer's target: facts only, the same fields the routes read from the suppliers table. */
export function composerTargets(d: GalleryData): ComposerTarget[] {
  const rec = d.records.aboni;
  if (!rec) return [];
  const row = buildTableRow(rec.input);
  return [
    {
      id: rec.input.profile.supplier.id,
      slug: row.slug,
      name: row.name,
      initials: row.initials,
      tier: row.topTier,
      marks: row.marks,
      place: row.place,
      type: row.type,
      sanctioned: row.sanctioned,
      sanctionSample: row.sanctionSample,
    },
  ];
}

/**
 * The buyer's own draft fields, as a sample: the product, its quantity and
 * its ship-by date are what a buyer types, so no record can supply them. The
 * HS line is one the record really carries; with none read, the draft names
 * no line.
 */
export function composerPrefill(d: GalleryData): ComposerPrefill {
  const lines = (d.records.aboni?.input.hscodes ?? []).map((h) => heading4(h.code));
  const hs = lines.includes("6105") ? "6105" : (lines[0] ?? null);
  const shipBy = new Date(d.today.getTime() + 80 * 86_400_000).toISOString().slice(0, 10);
  return { title: "Men's knitted piqué polo, 220 gsm", quantity: "12000", unit: "pcs", hs, shipBy };
}

/**
 * Three RFQs in the shape `rfq_list` returns them, for the list /app/rfqs
 * renders. A sample: the gallery's loader keeps `rfq_list`'s rows only as the
 * sidebar's models (`GalleryData.rfqs`), not as the rows `RfqListBody` takes.
 * An unread list is null, never an empty one.
 */
export function sampleRfqRows(d: GalleryData): RfqRow[] | null {
  if (d.rfqError) return null;
  const at = (days: number) => new Date(d.today.getTime() - days * 86_400_000).toISOString();
  const base = { quantity_unit: "pcs", viewer_role: "buyer" as const };
  return [
    {
      ...base,
      id: "5a1e0000-0000-4000-8000-000000000001",
      product_title: "Men's knitted piqué polo, 220 gsm",
      quantity: 12000,
      ship_by: at(-80).slice(0, 10),
      status: "open",
      target_supplier_count: 3,
      quote_count: 0,
      created_at: at(2),
      updated_at: at(2),
    },
    {
      ...base,
      id: "5a1e0000-0000-4000-8000-000000000002",
      product_title: "Organic cotton crew-neck T-shirt",
      quantity: 8000,
      ship_by: at(-60).slice(0, 10),
      status: "open",
      target_supplier_count: 2,
      quote_count: 2,
      created_at: at(9),
      updated_at: at(1),
    },
    {
      ...base,
      id: "5a1e0000-0000-4000-8000-000000000003",
      product_title: "Brushed fleece hoodie, 320 gsm",
      quantity: 5000,
      ship_by: at(-30).slice(0, 10),
      status: "accepted",
      target_supplier_count: 1,
      quote_count: 1,
      created_at: at(21),
      updated_at: at(6),
    },
  ];
}

export function DashboardScreens({ data: d }: { data: GalleryData }) {
  // Only the filters this page really passed to `discover_suppliers`: the text
  // and the GOTS certificate kind. A chip for one the RPC never received says
  // the result set was narrowed when it was not.
  const composerChips = [{ label: `Text · ${GALLERY_QUERY.q}` }, { label: "Certificate · GOTS" }];
  const search = <SearchComposer chips={composerChips} askEnabled={false} filtersHref="#filter-pane" />;
  const results = shellModels(d, "suppliers");
  const sort = { key: "sources", dir: "desc" as const };
  const aboni = slugOf(d.records.aboni);
  // The ledger shows the selection and the open row: two ticked, one current.
  const picked = new Set([slugOf(d.records.sm), slugOf(d.records.ar)].filter((s): s is string => s !== null));
  const ledgerRows: TableRowModel[] = d.rows.map((r) => (picked.has(r.slug) ? { ...r, selected: true } : r));
  // Beside a pane the results are the named records only: every screen but
  // the ledger draws those four, and states their span in its topbar.
  const namedRows = d.rows.filter((r) => d.cards.some((c) => c.slug === r.slug));
  const beside = (currentSlug: string | null) => (
    <>
      {search}
      <Panel>
        {/* A record beside the results is the page's h1; the search steps down to h2. */}
        <PanelHeader as={currentSlug ? "h2" : "h1"} model={header(d, "table", namedRows.length, SELECTION)} />
        <ResultsTable rows={namedRows} compact currentSlug={currentSlug} sort={sort} sortHrefs={sortHrefs} />
        <PanelFooter shown={namedRows.length} total={d.discoverError ? null : d.total} note={SELECTION} />
      </Panel>
    </>
  );
  const targets = composerTargets(d);
  const rfqRows = sampleRfqRows(d);

  return (
    <div className="space-y-10">
      <Frame
        id="results-table"
        title="ResultsTable — the ledger grid"
        // `tableSelection(d)`, not a second copy of its arithmetic: a
        // hard-coded "four" survived any read where fewer than four named
        // records loaded, and disagreed with the panel header the moment
        // discovery rows joined the table (cycle 19).
        note={`The default view: 36px rows under a sticky, sortable header, ${d.rows.length} rows: ${tableSelection(d)}. Two rows are ticked (the brand rule on the left) and one is marked as the record open beside the results. Hover or focus a row for its actions.`}
      >
        <AppShell className="md:h-full" sidebar={results.sidebar} topbar={tableTopbarModel(d)} mainId="results-table-main" screenLabel="results table">
          <Bench
            results={
              <>
                {search}
                <Panel>
                  <PanelHeader model={header(d, "table", d.rows.length, tableSelection(d))} />
                  <ResultsTable rows={ledgerRows} currentSlug={aboni} sort={sort} sortHrefs={sortHrefs} />
                  <PanelFooter shown={d.rows.length} total={d.discoverError ? null : d.total} note={tableSelection(d)} />
                </Panel>
              </>
            }
          />
        </AppShell>
      </Frame>

      <Frame id="results-list" title="ResultsList — the thumbnail cards" note={resultsNote(d)}>
        <AppShell className="md:h-full" sidebar={results.sidebar} topbar={results.topbar} mainId="results-list-main" screenLabel="results list">
          <Bench
            results={
              <>
                {search}
                <Panel>
                  <PanelHeader model={header(d, "cards", d.cards.length, SELECTION)} />
                  {d.cards.map((c) => (
                    <SupplierResultCard key={c.slug} card={c} />
                  ))}
                  {/* The gallery renders the four named records, not a page of 25: a pager
                      here would offer a page 2 that does not exist. */}
                  <PanelFooter shown={d.cards.length} total={d.discoverError ? null : d.total} note={SELECTION} />
                </Panel>
              </>
            }
          />
        </AppShell>
      </Frame>

      {d.sheet ? (
        <Frame
          id="supplier-sheet"
          title="SupplierSheet — the record beside the results"
          note={`${d.sheet.name}: ${d.sheet.sourceCount} sources, ${d.sheet.certs.length} certificates, ${d.sheet.products.lines} HS lines, read ${d.sheet.readDate ?? "—"}. Contact details locked (striped, never blurred). The results narrow to the ledger's three essential columns and keep their own scroll; the open row is marked.`}
          height={1240}
        >
          <AppShell className="md:h-full" sidebar={results.sidebar} topbar={results.topbar} mainId="supplier-sheet-main" screenLabel="supplier record">
            <Bench
              results={beside(aboni)}
              pane={
                <RecordPane openKey="supplier-sheet">
                  <SupplierSheet model={d.sheet} />
                </RecordPane>
              }
            />
          </AppShell>
        </Frame>
      ) : null}

      {d.productSheet ? (
        <Frame
          id="product-sheet"
          title="ProductSheet — one HS export line"
          // `model.exported` (correctness, cycle 19): the sheet itself
          // downgrades to "not on this record's EPB page" the moment the line
          // isn't on it, and the caption must not claim the EPB page over it.
          note={`HS ${d.productSheet.hs}${d.productSheet.exported ? ` on ${d.productSheet.supplierName}'s EPB exporter page` : `, not on ${d.productSheet.supplierName}'s EPB exporter page`}. The photo is the catalogue's illustrative photo for the heading, never the supplier's own.`}
          height={760}
        >
          <AppShell className="md:h-full" sidebar={results.sidebar} topbar={results.topbar} mainId="product-sheet-main" screenLabel="product line">
            <Bench
              results={beside(aboni)}
              pane={
                <RecordPane openKey="product-sheet">
                  <ProductSheet model={d.productSheet} />
                </RecordPane>
              }
            />
          </AppShell>
        </Frame>
      ) : null}

      {targets.length > 0 ? (
        <Frame
          id="rfq-composer"
          title="RfqComposer — the composer in the pane beside the results"
          note={`A sample draft to ${targets[0]!.name}, opened from the results (/app/discover?rfq=…): the supplier's name, marks, type and place are the record's own; the product, quantity and ship-by date are the buyer's draft fields, shown here as a sample. The gallery has no workspace, so the template names its missing facts in brackets rather than inventing them.`}
          height={860}
        >
          <AppShell className="md:h-full" sidebar={results.sidebar} topbar={results.topbar} mainId="rfq-composer-main" screenLabel="RFQ composer">
            <Bench
              results={beside(null)}
              pane={
                <RecordPane openKey="rfq-composer" wide>
                  {/* The frame's own id, not a bare "#": the gallery has no search
                      to close to, and a "#" link scrolls the page to the top. */}
                  <RfqComposer targets={targets} prefill={composerPrefill(d)} workspace={null} closeHref="#rfq-composer" />
                </RecordPane>
              }
            />
          </AppShell>
        </Frame>
      ) : null}

      <Frame
        id="filter-pane"
        title="Filters — the filter pane"
        note={`/app/discover?filters=1 over this search: the two filters it carries (the text "${GALLERY_QUERY.q}" and the GOTS certificate) are set in the pane's typed fields. Apply submits the search; each chip in the bar removes one filter.`}
        height={860}
      >
        <AppShell className="md:h-full" sidebar={results.sidebar} topbar={results.topbar} mainId="filter-pane-main" screenLabel="filters">
          <Bench
            results={beside(null)}
            pane={
              <RecordPane openKey="filters">
                <DiscoverFilters state={galleryState()} closeHref="#filter-pane" />
              </RecordPane>
            }
          />
        </AppShell>
      </Frame>

      <Frame
        id="rfq-list"
        title="RFQ list"
        note={
          rfqRows === null
            ? "rfq_list could not be read, so the list says so: no count, and no empty state standing in for an unread list."
            : `RfqListBody, the list /app/rfqs renders, over ${rfqRows.length} sample RFQs in the shape rfq_list returns (the gallery's loader keeps the viewer's real rows only as the sidebar's count, which is the real one). The tabs are the RFQ's own status and its quote count; each row opens its RFQ.`
        }
        height={700}
      >
        <AppShell className="md:h-full" {...shellModels(d, "rfqs")} mainId="rfq-list-main" screenLabel="RFQ list">
          <Page>
            <RfqListBody rows={rfqRows} tab="all" today={d.today} />
          </Page>
        </AppShell>
      </Frame>
    </div>
  );
}
