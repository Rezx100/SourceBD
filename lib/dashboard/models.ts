// View models the dashboard kit renders (REZ-A). Screens build these from
// the RPC payloads (`lib/dashboard/build-models.ts`); components only read
// them, so a boundary test can construct one and assert the rendered HTML.

import type { IconName } from "@/components/dashboard/icons";
import type { ChipTone } from "@/components/dashboard/chips";
import type { TierRank } from "@/lib/design/tokens";
import type { CertModel, CertState } from "./facts";
import type { PhotoTileModel } from "./hs-photos";
import type { SourceMarkModel } from "./source-tiers";

/** A fact on a meta line: its words and the mark of the register it came from. */
export type FactWithMark = {
  text: string;
  mark: SourceMarkModel | null;
  /** Quiet: "District, year and workers not on file". */
  quiet?: boolean;
  /** Set in mono (a register number). */
  code?: boolean;
};

export type HighlightChip = {
  tone: ChipTone;
  icon?: IconName;
  label: string;
};

/** One of the card's four tiles. `value` null → "—" in quiet ink with the reason in `sub`. */
export type TileModel = {
  label: string;
  value: string | null;
  sub: string | null;
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
  chips: HighlightChip[];
  moreChips: number;
  tiles: [TileModel, TileModel, TileModel, TileModel];
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
  /** "1 of 2 sites" when the figure is a group sum; null when it is this site's. */
  workersCoverage: string | null;
  /** A second line under the figure: the group roll-up, when it differs from it. */
  workersGroup?: string | null;
  sanctioned: boolean;
  sanctionSample?: boolean;
  selected?: boolean;
  saved?: boolean;
  supplierId?: string;
  rfqHref?: string | null;
};

export type FactRow = {
  label: string;
  value: string | null;
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
  /** What the locked card may claim today: only that details on the record are hidden. Kinds and registers arrive with `contact_counts` (REZ-C §4.3). */
  contact: { hidden: string; plan: string | null };
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
    certifiedScope: { scheme: string; scope: string; state: CertState } | null;
    /** What to say where the scope would have gone; never a negative over a payload that holds certificates. */
    certifiedScopeEmpty: string;
    buyerLists: string[];
    /** What to say when `buyerLists` is empty: the bare negative, or the building that is listed. */
    buyerListsEmpty: string;
    tiles: PhotoTileModel[];
  };
  certs: CertModel[];
  certsCaption: string | null;
  /** What the caption says when the record holds no certificate of its own: the bare negative, or the building that holds one. */
  certsEmpty: string;
  /** The same absence as a sentence: "No certificate on 4 registers", never "on any register". */
  certsEmptyChip: string;
  /**
   * Whether every source mark this sheet renders links to a record page —
   * the mark row, the attributed fact rows AND the certificate cards. It is
   * computed here rather than in the component because a surface that forgets
   * one mark set makes the action bar's strongest sentence false.
   */
  everyMarkLinks: boolean;
  /** Buildings holding a certificate of their own; named so the record does not appear to hold it, and so "none" is never printed over one. */
  certBuildings: string[];
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
};

export type ProductSheetModel = {
  supplierName: string;
  sanctioned: boolean;
  sanctionSample?: boolean;
  hs: string;
  /** The record's own EPB page carries this line. False → the sheet never calls it an EPB export line. */
  exported: boolean;
  heading: string;
  photo: PhotoTileModel;
  generatedOn: string | null;
  facts: FactRow[];
  otherExporters: number | null;
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
