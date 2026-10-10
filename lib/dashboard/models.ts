// View models the dashboard kit renders (REZ-A). Screens build these from
// the RPC payloads (`lib/dashboard/build-models.ts`); components only read
// them, so a boundary test can construct one and assert the rendered HTML.

import type { TierRank } from "@/lib/design/tokens";
import type { CertChecks, CertModel, CertState, VolzaExports } from "./facts";
import type { PhotoTileModel } from "./hs-photos";
import type { SourceMarkModel } from "./source-tiers";

/** The words a model uses for the icon beside a chip, a status or a rail item. The v4 views map them to their own glyphs. */
export type IconName = "search" | "bookmark" | "send" | "building" | "tag" | "list" | "funnel" | "chat" | "box" | "shield" | "gear" | "check-c" | "clock" | "warn";

/** The words a model uses for what a fact is (a place, a year, workers). The record's views read only `address`. */
export type SbIconName =
  | "address"
  | "established"
  | "workers"
  | "register"
  | "company"
  | "factory"
  | "buying-house"
  | "group"
  | "zone"
  | "women-men"
  | "machines"
  | "capacity"
  | "receipt"
  | "certificate"
  | "brand-list";

/** A chip's tone: facts in status hues, never a score. */
export type ChipTone = "positive" | "caution" | "neutral" | "quiet" | "sanction" | "on";

/** A fact on a meta line: its words and the mark of the register it came from. */
export type FactWithMark = {
  text: string;
  mark: SourceMarkModel | null;
  /** SourceBD's icon for what the fact is (a place, a year, workers), drawn before it. */
  icon?: SbIconName;
  /** The fact's whole words when the line shows a short form ("1,300 workers · on the supplier record"): its hover title and what a screen reader reads. */
  title?: string;
  /** A second figure drawn in brackets right after the fact before it: "1,300 workers (3,546 with buildings)". */
  aside?: boolean;
  /** Quiet: "District, year and workers not on file". */
  quiet?: boolean;
  /** Set in mono (a register number). */
  code?: boolean;
};

export type HighlightChip = {
  tone: ChipTone;
  icon?: IconName;
  label: string;
  /** Where the chip leads on the record (its certificates, its export lines), carried over from the tiles it replaced. */
  href?: string | null;
};

export type SupplierCardModel = {
  slug: string;
  name: string;
  initials: string;
  topTier: TierRank;
  marks: SourceMarkModel[];
  meta: FactWithMark[];
  sanctioned: boolean;
  /** Only the /dev/ds gallery sets this: a labelled sample, not a production flag. */
  sanctionSample?: boolean;
  /** Every status chip, in order; the card draws four and says "+N" for the rest, naming them on hover. */
  chips: HighlightChip[];
  /**
   * The marks row's one caption, separating the two populations it draws:
   * "8 registers & certifiers · 3 brand lists". The first figure is the one the
   * default sort and the minimum-sources filter use.
   */
  sourcesCaption: string;
  /**
   * What the Registers and Listed by tiles said that the marks cannot: a
   * register's number and grade, or the careful negative ("not on 4 brand
   * lists read"). The caption's hover title and read to a screen reader, so no
   * fact the tiles carried is dropped. Null when the marks say it all.
   */
  sourcesNote: string | null;
  photos: PhotoTileModel[];
  totalLines: number;
  /** The lines could not be read (RPC failure): the slot says so instead of "no lines". */
  linesUnknown?: boolean;
  /** Read date of the EPB register when EPB holds a record for this supplier; null otherwise. */
  epbReadDate: string | null;
  /** The supplier is on the EPB register; empty lines mean unrecorded, not absent. */
  onEpbRegister: boolean;
  /** V2 only: the facts that met the filters. Null → the band is not rendered. */
  why: string[] | null;
  selected?: boolean;
  /** Buyer Discover: this record is on the caller's saved list. Gallery leaves unset. */
  saved?: boolean;
  /** Buyer Discover sets these so Save / Send RFQ are real controls. The gallery leaves them unset. */
  supplierId?: string;
  rfqHref?: string | null;
  /**
   * Where "Open record" and the name go. Discover passes `?record=<slug>` on
   * the search's own URL, so opening a record keeps the search behind it and
   * closing returns to it without a re-run. Unset → the record's full page.
   */
  recordHref?: string | null;
};

export type TableRowModel = {
  slug: string;
  name: string;
  place: string | null;
  initials: string;
  topTier: TierRank;
  sourceCount: number;
  marks: SourceMarkModel[];
  /** Up to two certificate chips, then "+N". */
  certs: CertModel[];
  certsEmptyReason: string | null;
  photos: PhotoTileModel[];
  totalLines: number;
  linesEmptyReason: string | null;
  type: string;
  workers: number | null;
  /** What the figure is: a source, or "1 of 2 sites" when it is a group sum. */
  workersCoverage: string | null;
  /** Discover only: the profile's figure, when it differs from the headline. */
  workersSecond?: string | null;
  /** The second figure in a few words for the cell ("793 RSC"); shown under the first wherever the two differ. */
  workersSecondShort?: string | null;
  sanctioned: boolean;
  sanctionSample?: boolean;
  selected?: boolean;
  saved?: boolean;
  supplierId?: string;
  rfqHref?: string | null;
  /** As `SupplierCardModel.recordHref`. */
  recordHref?: string | null;
};

export type FactRow = {
  label: string;
  value: string | null;
  /** SourceBD's icon for the fact, before its label (`factIcon`); the model carries it, not the view. */
  icon?: SbIconName;
  /** A fact a buyer reads first (registered name, type, workers, address): its value is set in medium. */
  lead?: boolean;
  /** Quiet reason when the value is missing: "6 registers checked". */
  checked?: string | null;
  code?: boolean;
  marks?: SourceMarkModel[];
  /** The payload does not attribute this field to a register yet: the row says "source pending". */
  pendingSource?: boolean;
  /** A link inside the value. */
  href?: string | null;
  note?: string | null;
  badge?: { tone: "positive" | "caution" | "type"; label: string } | null;
  /** What a missing value reads as. Defaults to "Not on file", which claims the registers were read; "Not attested" and "Could not be read" do not. */
  empty?: string;
  /**
   * A value that is a list, one item a line with its own mark (the Registers
   * row: "BGMEA General 6843" beside the BGMEA square). `value` still carries
   * the whole list as one string for the CSV, the tests and a screen reader.
   */
  items?: { label: string; code: string | null; mark: SourceMarkModel | null }[];
};

/**
 * How much contact detail the record holds (0105, REZ-C §4.3). Counts only:
 * `supplier_contact_counts` selects no contact value and returns none, so
 * there is nothing for the browser to un-hide.
 */
export type ContactCounts = {
  emails: number;
  phones: number;
  representatives: number;
  website: boolean;
};

/** One row of the Sources section: a register that filed something on this record. */
export type SourceRow = {
  mark: SourceMarkModel;
  /** The register spelled out, as the mark row spells it. */
  name: string;
  /** "Government register", "Industry body", … — the tier in the founder's words, never `tier1_gov`. */
  tier: string;
  /** The record's own numbers on that register (registration, membership, certificate), never our key for the read. */
  refs: string[];
  readDate: string | null;
};

/** One extension building: its name, its first filed address (contact details stripped) and its worker figure. */
export type FacilityRowModel = { name: string; address: string | null; workers: string | null };

/** Where the geocode cache puts a premises (`address_geocodes`, filled by the ETL; the page never geocodes). */
export type SitePin = {
  latitude: number;
  longitude: number;
  /** The geocoder's own confidence in the match; null when the cache row predates it. */
  confidencePct: number | null;
  addressStatus: string | null;
};

/** One premises on the Locations section, after the address matcher has merged spellings. */
export type LocationRow = {
  kind: string;
  address: string;
  marks: SourceMarkModel[];
  /** The other spellings the registers filed for the same premises. */
  alsoRecordedAs: string[];
  /** No register filed it as a factory: a registered or mailing address. Set only when the record is built with pins. */
  office?: boolean;
  /** Its place on the map, or null when the cache holds none. Absent when pins were not read. */
  pin?: SitePin | null;
};

/**
 * One watchlist hit behind the sanction banner. The page this sheet replaced
 * showed the list, the matched name, the entry reference, the screening date
 * and a link to the entry; the banner alone asserts a match and evidences
 * nothing, which on this record of all records is the wrong way round.
 */
export type SanctionRow = {
  list: string;
  matchedName: string;
  ref: string | null;
  screenedOn: string | null;
  listedOn: string | null;
  href: string | null;
  /**
   * What `href` opens: the entry itself (the URL is anchored at it), or the
   * whole watchlist. The same discipline the brand marks follow — a link never
   * promises more than it delivers.
   */
  opens: "entry" | "list";
};

/** One of the calling buyer's RFQs that names this supplier. */
export type RecordRfqRow = {
  id: string;
  title: string;
  quantity: string | null;
  status: { tone: "positive" | "caution" | "type"; label: string };
  sent: string | null;
  shipBy: string | null;
  href: string;
};

export type SupplierSheetModel = {
  slug: string;
  name: string;
  initials: string;
  topTier: TierRank;
  marks: SourceMarkModel[];
  meta: FactWithMark[];
  readDate: string | null;
  sourceCount: number;
  sanctioned: boolean;
  sanctionSample?: boolean;
  /** `href` is null for a tab whose section the sheet does not render yet: the link is inert, never a dead fragment. */
  tabs: { label: string; count: string | null; href: string | null; active?: boolean }[];
  summary: string | null;
  facts: FactRow[];
  /**
   * The locked card. `counts` is what `supplier_contact_counts` returned, or
   * null when that read failed — never zeros, because "no phone number on
   * file" is a claim about the record and a failed count does not support it.
   * No contact VALUE ever reaches this model.
   */
  contact: { hidden: string; plan: string | null; counts: ContactCounts | null; held: string | null };
  readDates: string | null;
  products: {
    lines: number;
    linesUnknown?: boolean;
    /** The record is on the EPB exporter register (number or provenance row). */
    onEpb: boolean;
    exporterHref: string | null;
    exporterRef: string | null;
    /** Every distinct 4-digit chapter the lines span, ascending. */
    chapters: string[];
    productListCount: number;
    /** The product list itself, as filed, so the count above is a count of something the buyer can read (§3.3: principal products + also-produces). */
    productList: string[];
    certifiedScope: { scheme: string; scope: string; state: CertState } | null;
    /** What to say where the scope would have gone; never a negative over a payload that holds certificates. */
    certifiedScopeEmpty: string;
    buyerLists: string[];
    /** What to say when `buyerLists` is empty: the bare negative, or the building that is listed. */
    buyerListsEmpty: string;
    tiles: PhotoTileModel[];
    /**
     * Where "All N lines ›" goes. The grid shows six tiles, so on a record with
     * more headings than that the rest were reachable from nowhere. Null when
     * every line is already on screen.
     */
    allLinesHref: string | null;
  };
  certs: CertModel[];
  certsCaption: string | null;
  /** What the caption says when the record holds no certificate of its own: the bare negative, or the building that holds one. */
  certsEmpty: string;
  /** The same absence as a sentence: "No certificate on 4 registers", never "on any register". */
  certsEmptyChip: string;
  /** The mother's own RSC row; every row the RPC returns is active (the inactive state is REZ-C's). */
  rsc: {
    ref: string | null;
    readDate: string | null;
    progress: number | null;
    status: string | null;
    training: string | null;
    links: { label: string; href: string | null }[];
  } | null;
  /** Buildings with their own RSC row (labelled, never merged into the mother). */
  rscBuildings: string[];
  /** Each of those rows in full, so the register's receipts for a building are not dropped. */
  rscBuildingBlocks: {
    name: string;
    readDate: string | null;
    progress: number | null;
    status: string | null;
    training: string | null;
    links: { label: string; href: string | null }[];
  }[];
  /** REZ-C: every register that filed something on this record, best rank first. */
  sources: SourceRow[];
  sourcesCaption: string;
  /** REZ-C: one row per premises, spellings merged by the matcher the profile's Locations section uses. */
  locations: LocationRow[];
  /** What the Locations section says when the payload carries no address. */
  locationsEmpty: string;
  /**
   * REZ-C: the record's extension buildings, from REZ-73's
   * `buyer_supplier_facility_panel` — the list the page this replaced and the
   * public profile both show. `count` is null when the panel was not read,
   * and `empty` then says so: "no buildings" is a claim an unread panel cannot make.
   */
  facilities: { count: number | null; rows: FacilityRowModel[]; empty: string };
  /** Each building's own certificates, by building — shown, not counted as the record's. */
  buildingCerts: { building: string; certs: CertModel[] }[];
  /**
   * REZ-C: the calling buyer's own RFQs naming this supplier. `count` is null
   * when the read failed — an unread list has no count, and 0 is a claim.
   */
  rfqs: { count: number | null; rows: RecordRfqRow[]; empty: string; error?: boolean };
  /** Where Send RFQ goes; null on a sanctioned record, where the control is disabled. */
  rfqHref: string | null;
  /** Where the sheet's Save control posts. Null on the gallery, which has no session. */
  supplierId: string | null;
  /** This record is on the caller's saved list. */
  saved: boolean;
  /** The full record page — what Share copies. */
  fullHref: string;
  /** Where the overlay's Close returns to. Null on the full page, which has nothing to close. */
  closeHref: string | null;
  /**
   * Where one export line opens. A function, because the answer depends on
   * where this sheet is: over the results it is a nested sheet on the same
   * search URL, so the search survives the drill-down; on the full record page
   * it is the line's own page.
   */
  lineHref: (hs: string) => string;
  /** The watchlist rows behind the banner. Empty on a record that is not sanctioned. */
  sanctions: SanctionRow[];
  /** What the Safety/compliance area says when the record is flagged but the payload carries no row. */
  sanctionsEmpty: string;
  /** When the daily sanctions lists were last all read in full (ISO), or null when unknown. */
  sanctionsReadAt: string | null;
  /** `supplier_cert_checks` (0122): when each certificate's body last showed it; null when unread. */
  certChecks: CertChecks | null;
  /** `supplier_volza_exports` (0137): customs shipments for paying readers; null otherwise. */
  volza: VolzaExports | null;
};

export type ProductSheetModel = {
  supplierName: string;
  sanctioned: boolean;
  sanctionSample?: boolean;
  hs: string;
  /** The record's own EPB page carries this line. False → the sheet never calls it an EPB export line. */
  exported: boolean;
  /** `supplier_epb_hscodes` failed: whether the record exports this line is unknown, and the sheet says so rather than "not on the EPB page". */
  linesUnknown: boolean;
  heading: string;
  photo: PhotoTileModel;
  generatedOn: string | null;
  facts: FactRow[];
  /**
   * How many suppliers the linked search returns for this heading — INCLUDING
   * this one. It was that minus one, under a label reading "Other exporters",
   * which was honest about the word and dishonest about the link: the control
   * became a real link in REZ-C, and `/app/discover?hs=6105` returns 1,634
   * while the button said 1,633. The founder's rule of 24 Sep is that a
   * products count equals the search it links to, so the number stayed whole
   * and the label dropped "Other".
   */
  exporters: number | null;
  /** Back to the record this line belongs to. Null on the gallery, which has no route behind it. */
  backHref: string | null;
  /** Where Close returns to; null when nothing sits behind the sheet. */
  closeHref: string | null;
  /** Send RFQ for this line — the composer with the HS code prefilled. */
  rfqHref: string | null;
};

export type RfqRowModel = {
  id: string;
  name: string;
  hs: string | null;
  /** Null until the supplier is resolved (rfq_list carries only the count — REZ-D). */
  supplierName: string | null;
  supplierInitials: string | null;
  supplierTier: TierRank | null;
  supplierCount: number;
  /** A sanctioned target shows on this row too — a sanction may not be hidden by layout (spec §2). */
  sanctioned: boolean;
  sanctionSample?: boolean;
  quantity: string;
  status: { tone: "positive" | "caution" | "type"; label: string; icon?: IconName };
  sent: string | null;
  shipBy: string | null;
  action: "Continue" | "Open";
};

export type RfqListModel = {
  /** Null when `rfq_list` failed: an unread list has no count, and 0 is a claim. */
  sent: number | null;
  quotes: number | null;
  chips: { label: string; count: number | null; on?: boolean }[];
  rows: RfqRowModel[];
  footer: string;
  toast: { text: string; href: string | null } | null;
  /**
   * `rfq_list` failed. Without this an unread list renders the empty state —
   * which sells the feature by stating "you have no RFQs yet", a fact the
   * failed read does not support.
   */
  error?: boolean;
};
