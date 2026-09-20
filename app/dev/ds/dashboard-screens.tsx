// The six buyer dashboard v3.2 screens in the gallery (REZ-A, handoff §7.1),
// each rendered inside the app shell at 1440 from the real records loaded by
// `lib/dashboard/gallery-data.ts`. Sheets and the dialog sit over the results
// on a fixed-height stage, as the artifact renders them.

import type { ReactNode } from "react";
import {
  AppShell,
  MissingFlag,
  Panel,
  PanelFooter,
  PanelHeader,
  ProductSheet,
  ResultsTable,
  RfqComposer,
  RfqList,
  Scrim,
  SearchComposer,
  Stage,
  SupplierResultCard,
  SupplierSheet,
  type RfqComposerModel,
  type SidebarModel,
  type TopbarModel,
} from "@/components/dashboard";
import { certStateLabel, formatDay } from "@/lib/dashboard/facts";
import { GALLERY_QUERY, topbarCaption, type GalleryData } from "@/lib/dashboard/gallery-data";
import { heading4, hsShortLabel } from "@/lib/dashboard/hs-photos";

export const SCREEN_WIDTH = 1440;

function shellModels(d: GalleryData, active: SidebarModel["active"]): { sidebar: SidebarModel; topbar: TopbarModel } {
  const sidebar: SidebarModel = {
    active,
    // Every count here is the RPC's or absent. A read that failed renders no
    // pill at all: a "0" beside RFQs is a claim about the account, and this
    // sidebar is on all six screens.
    // The sidebar counts the account's RFQs, not the rows on this page —
    // `sent` is the figure `rfq_list` supports, and it is null when the read
    // failed. `saved` needs `buyer_dashboard.saved_count` (REZ-C), so it is
    // unknown rather than zero.
    counts: { suppliers: d.published, rfqs: d.rfqError ? null : d.rfqs.sent, saved: null },
    recent: d.total !== null ? [{ label: GALLERY_QUERY.title, count: d.total, href: "#results-list" }] : [],
    // No billing exists yet: the plan line names the beta, never a plan or renewal date (handoff §3.10).
    plan: { name: d.plan ?? "Free · public beta" },
  };
  // "4 records on this page, read …" is true of the screens that draw those
  // four supplier records. The RFQ list draws five RFQs and no supplier
  // record at all, and `rfq_list` returns no read date of any kind, so the
  // clause is dropped there rather than carried by a shared shell. Making the
  // caption specific is what made it false on one screen.
  const drawsRecords = active !== "rfqs";
  const topbar: TopbarModel = {
    caption: topbarCaption(drawsRecords ? d : { published: d.published, recordsReadOn: null, recordsRead: null }),
    initial: null,
  };
  return { sidebar, topbar };
}

/**
 * The results-table screen's own topbar. It is the one screen that draws
 * `extra` rows beside the four named records (`rowRecords` in
 * `gallery-data.ts`), so it is the one screen whose caption may state a
 * record count above 4 — every other caller of `shellModels` above shares one
 * topbar built from the narrower, named-only span.
 */
function tableTopbarModel(d: GalleryData): TopbarModel {
  return { caption: topbarCaption({ published: d.published, recordsReadOn: d.tableRecordsReadOn, recordsRead: d.tableRecordsRead }), initial: null };
}

/** What the gallery's panel actually holds, for the header caption. */
const SELECTION = "the named test records of the rebuild spec";

function header(d: GalleryData, view: "cards" | "table", shown: number) {
  // The count is the RPC's; when the RPC failed it is unknown (null), never 0.
  // `selection` because these rows are hand-picked: Zaheen and A.R. Fashion
  // hold no GOTS certificate, so they are not among the 42 the query returns,
  // and "1–4" would be a range claim over a set they are not in.
  return { title: GALLERY_QUERY.title, total: d.discoverError ? null : d.total, shown, sortLabel: "Most sources", view, selection: SELECTION };
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
        <div style={{ width: SCREEN_WIDTH, minHeight: height }} data-screen={id}>
          {children}
        </div>
      </div>
    </figure>
  );
}

function ResultsHeaderNote(d: GalleryData): string {
  const total = d.total === null ? "the live count could not be read" : `${d.total} suppliers match the text "${GALLERY_QUERY.q}" with a GOTS certificate in production`;
  return `The named test records of the rebuild spec, shown in the query's frame: ${d.cards.map((c) => c.name).join(" · ")} — hand-picked, not the query's first page (Zaheen and A.R. Fashion hold no GOTS certificate, so the RPC does not return them). ${total}. Zaheen is rendered as a labelled sanctioned SAMPLE — no company is sanctioned in production. Read ${formatDay(d.today.toISOString())}.`;
}

export function DashboardScreens({ data: d }: { data: GalleryData }) {
  // Only the filters this page really passed to `discover_suppliers`: the text
  // and the GOTS certificate kind. The HS-heading and certificate-state filters
  // the artifact shows arrive with REZ-B's RPC parameters; a chip for one the
  // RPC never received says the result set was narrowed when it was not.
  const composerChips = [{ label: `Text · ${GALLERY_QUERY.q}` }, { label: "Certificate · GOTS" }];
  const results = shellModels(d, "suppliers");
  const cardsPanel = (
    <Panel>
      <PanelHeader model={header(d, "cards", d.cards.length)} />
      {d.cards.map((c) => (
        <SupplierResultCard key={c.slug} card={c} />
      ))}
      {/* The gallery renders the four named records, not a page of 25: a pager
          here would offer a page 2 that does not exist. */}
      <PanelFooter shown={d.cards.length} total={d.discoverError ? null : d.total} note={SELECTION} />
    </Panel>
  );

  const composer = d.records.aboni ? composerModel(d) : null;

  return (
    <div className="space-y-10">
      <Frame id="results-list" title="ResultsList — result cards" note={ResultsHeaderNote(d)}>
        <AppShell sidebar={results.sidebar} topbar={results.topbar} mainId="results-list-main">
          <SearchComposer chips={composerChips} askEnabled={false} />
          {cardsPanel}
        </AppShell>
      </Frame>

      <Frame id="results-table" title="ResultsTable — the toggle's other state" note={`Same header and footer, 36px rows, ${d.rows.length} rows: the same named records as the card view. The screens render from fixtures, so the query's own top matches are not loaded here.`}>
        <AppShell sidebar={results.sidebar} topbar={tableTopbarModel(d)} mainId="results-table-main">
          <SearchComposer chips={composerChips} askEnabled={false} />
          <Panel>
            <PanelHeader model={header(d, "table", d.rows.length)} />
            <ResultsTable rows={d.rows} />
            <PanelFooter shown={d.rows.length} total={d.discoverError ? null : d.total} note={SELECTION} />
          </Panel>
        </AppShell>
      </Frame>

      {d.sheet ? (
        <Frame id="supplier-sheet" title="SupplierSheet — the record over the results" note={`${d.sheet.name}: ${d.sheet.sourceCount} sources, ${d.sheet.certs.length} certificates, ${d.sheet.products.lines} HS lines, read ${d.sheet.readDate ?? "—"}. Contact details locked (striped, never blurred).`} height={1240}>
          <Stage
            height={1240}
            behind={
              <AppShell sidebar={results.sidebar} topbar={results.topbar} mainId="supplier-sheet-behind">
                <SearchComposer chips={composerChips} askEnabled={false} />
                {cardsPanel}
              </AppShell>
            }
          >
            <Scrim />
            <SupplierSheet model={d.sheet} />
          </Stage>
        </Frame>
      ) : null}

      {d.productSheet ? (
        <Frame id="product-sheet" title="ProductSheet — one HS export line" note={`HS ${d.productSheet.hs} on ${d.productSheet.supplierName}'s EPB exporter page. The photo is the catalogue's illustrative photo for the heading, never the supplier's own.`} height={760}>
          <Stage
            height={760}
            behind={
              <AppShell sidebar={results.sidebar} topbar={results.topbar} mainId="product-sheet-behind">
                <SearchComposer chips={composerChips} askEnabled={false} />
                {cardsPanel}
              </AppShell>
            }
          >
            <Scrim />
            <ProductSheet model={d.productSheet} />
          </Stage>
        </Frame>
      ) : null}

      {composer ? (
        <Frame id="rfq-composer" title="RFQComposer — rail, editor with variables, preview" note="A sample draft to the Aboni record: the certificate number, expiry and HS line in the message are the record's real facts; the product, quantity and dates are the buyer's own draft fields, shown here as a sample. AI is off in this build, so the V2 surfaces (Improve wording, Follow-up rules) are absent." height={860}>
          <Stage
            height={860}
            behind={
              <AppShell sidebar={results.sidebar} topbar={results.topbar} mainId="rfq-composer-behind">
                <SearchComposer chips={composerChips} askEnabled={false} />
                {cardsPanel}
              </AppShell>
            }
          >
            <Scrim />
            <RfqComposer model={composer} aiEnabled={false} />
          </Stage>
        </Frame>
      ) : null}

      <Frame
        id="rfq-list"
        title="RFQList — status chips, table, empty state"
        note={`The viewer's own RFQs from rfq_list: ${d.rfqs.rows.length} real rows, newest first. Production holds seven across three buyers and rfq_list is scoped to auth.uid(), so these five — one buyer's own — are the longest list it can return to anybody. A viewer who owns none reads the empty state instead, "Your first RFQ lands here." — never "0 sent".`}
        height={700}
      >
        <Stage height={700}>
          <AppShell {...shellModels(d, "rfqs")} contentClassName="gap-5" mainId="rfq-list-main">
            <RfqList model={d.rfqs} />
          </AppShell>
        </Stage>
      </Frame>
    </div>
  );
}

/** "Valid to 12 May 2027" → "valid to 12 May 2027": the month keeps its capital. */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The composer's draft, built on the Aboni record's real facts. */
export function composerModel(d: GalleryData): RfqComposerModel {
  const rec = d.records.aboni!;
  const name = d.sheet?.name ?? rec.input.profile.supplier.company_name;
  const gots = d.sheet?.certs.find((c) => c.kind.toUpperCase() === "GOTS" && c.state !== "expired") ?? null;
  // The HS line comes from a line the record really carries; with none read, the draft names no line.
  const lines = rec.input.hscodes.map((h) => heading4(h.code));
  const hs: string | null = lines.includes("6105") ? "6105" : (lines[0] ?? null);
  // `certChipLabel` reads "GOTS · no expiry on file"; stripping the scheme off
  // the front left the sentence reading "… is · no expiry on file".
  const certLine = gots
    ? `your ${gots.scheme} certificate ${gots.number ?? ""} is ${lowerFirst(certStateLabel(gots))}`.replace(/\s+/g, " ").trim()
    : "no certificate on file";
  const product = hs ? `Men's knitted piqué polo · HS ${hs}` : "Men's knitted piqué polo";
  // One list, read by the rail, the footer and the preview. The rail used to
  // carry its own literals — "Reply-by date and destination missing" and
  // "2/6" — beside a footer that said "4 fields missing — target price,
  // reply-by date, incoterm, destination". At most one of the three could be
  // right, and nothing tied them together.
  // The spec's Details step tracks six fields (design/dashboard-ux-flow.md
  // §6: "RFQ name, reply-by date, incoterm, destination, currency,
  // attachments"). None of the last four have a source on this draft —
  // the preview footer already says "no attachments" — so all four are
  // carried as missing rather than invented.
  const missing = [...(hs ? [] : ["HS line"]), "target price", "reply-by date", "incoterm", "destination", "currency", "attachments"];
  const DETAIL_FIELDS = ["Name", "Reply-by date", "Incoterm", "Destination", "Currency", "Attachments"];
  const detailMissing = DETAIL_FIELDS.filter((f) => missing.includes(f.toLowerCase()));
  const listWords = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  return {
    title: "New RFQ",
    context: `to ${name} · first contact${hs ? ` · HS ${hs}` : ""} · sample draft`,
    // The draft's targets carry the record's own sanction state, so the
    // composer shows the banner and refuses Send on the screens too.
    targets: [{ name, sanctioned: d.sheet?.sanctioned ?? false, sanctionSample: d.sheet?.sanctionSample }],
    draftSaved: null,
    steps: [
      { label: "Suppliers", detail: `${name} · first contact`, count: "1" },
      {
        label: "Product",
        detail: product,
        missing: `${listWords(missing.filter((m) => m === "target price" || m === "HS line").map((m, i) => (i === 0 ? m[0]!.toUpperCase() + m.slice(1) : m)))} missing`,
        count: hs,
      },
      {
        label: "Details",
        detail: DETAIL_FIELDS.join(", "),
        missing: detailMissing.length === 0 ? undefined : `${listWords(detailMissing.map((f, i) => (i === 0 ? f : f.toLowerCase())))} missing`,
        count: `${DETAIL_FIELDS.length - detailMissing.length}/${DETAIL_FIELDS.length}`,
        active: true,
      },
      { label: "Questions", detail: "5 required on first contact", count: "10" },
      { label: "Follow-up rules", detail: "Draft a follow-up if no reply in 5 days", v2: true },
    ],
    template: "first",
    subject: ["RFQ · ", { label: "Product" }, " · ", { label: "Quantity" }, " · reply by ", { label: "Reply-by date", missing: true }],
    body: [
      ["Dear ", { label: "Supplier contact" }, ","],
      [
        "We read your record on SourceBD — ",
        { label: "Certificate line" },
        ...(hs ? [", HS ", { label: "HS code" }, " on your EPB exporter page"] : []),
        " — and would like a quotation for the line below, delivered ",
        { label: "Incoterm", missing: true },
        " to ",
        { label: "Destination", missing: true },
        ".",
      ],
      ["Please answer the five questions under the table. Reply inside SourceBD by ", { label: "Reply-by date", missing: true }, "."],
    ],
    products: [{ product: hs ? `Men's knitted piqué polo, 220 gsm, 100 % cotton (${hsShortLabel(hs)})` : "Men's knitted piqué polo, 220 gsm, 100 % cotton", hs, quantity: "12,000 pcs", targetPrice: null, shipBy: "15 Dec 2026" }],
    questions: [
      { text: "Unit price at 12,000 pcs, FOB Chattogram", on: true, required: true },
      { text: "Minimum order quantity per colour", on: true, required: true },
      { text: "Sample lead time and cost", on: true, required: true },
      { text: gots?.number ? `Is ${gots.number} the scope this line ships under?` : "Which certificate scope does this line ship under?", on: true, required: true },
    ],
    moreQuestions: { count: 6, required: 1 },
    preview: {
      from: "From your workspace · reply inside SourceBD",
      subject: (
        <>
          RFQ · Men&apos;s knitted piqué polo · 12,000 pcs · reply by <MissingFlag>date missing</MissingFlag>
        </>
      ),
      paragraphs: [
        <span key="1">Dear {name},</span>,
        <span key="2">
          We read your record on SourceBD — {certLine}
          {hs ? `; HS ${hs} is on your EPB exporter page` : ""} — and would like a quotation for the line below, delivered{" "}
          <MissingFlag>incoterm</MissingFlag> to <MissingFlag>destination</MissingFlag>.
        </span>,
        <span key="3">
          Please answer the five questions under the table. Reply inside SourceBD by <MissingFlag>date missing</MissingFlag>.
        </span>,
      ],
      footer: "1 product line · 10 questions · no attachments",
    },
    missing,
  };
}
