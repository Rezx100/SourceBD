// View models the dashboard kit renders (REZ-A). Screens build these from
// the RPC payloads (`lib/dashboard/build-models.ts`); components only read
// them, so a boundary test can construct one and assert the rendered HTML.

import type { IconName } from "@/components/dashboard/icons";
import type { ChipTone } from "@/components/dashboard/chips";
import type { TierRank } from "@/lib/design/tokens";
import type { CertModel } from "./facts";
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
  /** V2 only: the facts that met the filters. Null → the band is not rendered. */
  why: string[] | null;
  selected?: boolean;
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
  sanctioned: boolean;
  sanctionSample?: boolean;
  selected?: boolean;
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
  /** Whether every source page is unchanged since read; null until the hash comparison exists (REZ-C §4.3). */
  pagesUnchanged: boolean | null;
  sanctioned: boolean;
  sanctionSample?: boolean;
  tabs: { label: string; count: string | null; active?: boolean }[];
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
    chapter: string | null;
    productListCount: number;
    certifiedScope: { scheme: string; scope: string } | null;
    buyerLists: string[];
    tiles: PhotoTileModel[];
  };
  certs: CertModel[];
  certsCaption: string | null;
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
};

export type ProductSheetModel = {
  supplierName: string;
  sanctioned: boolean;
  sanctionSample?: boolean;
  hs: string;
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
  quantity: string;
  status: { tone: "positive" | "caution" | "type"; label: string; icon?: IconName };
  sent: string | null;
  shipBy: string | null;
  action: "Continue" | "Open";
};

export type RfqListModel = {
  sent: number;
  quotes: number;
  chips: { label: string; count: number; on?: boolean }[];
  rows: RfqRowModel[];
  footer: string;
  toast: { text: string; href: string | null } | null;
};
