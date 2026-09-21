// The buyer dashboard v3.2 kit (REZ-A). Server components; Tailwind classes
// only; every colour a token role from `lib/design/tokens.ts`. Not
// `components/ui/*` — that is the old system and is off-limits for new work.

export { AppShell, Sidebar, Topbar, type NavKey, type SidebarModel, type TopbarModel } from "./app-shell";
export { Badge, Chip, Chips, type BadgeTone, type ChipTone } from "./chips";
export { Button, Checkbox, Count, Kbd, LiveDot, Meter, Seg, V2Tag, type ButtonVariant } from "./controls";
export { Icon, ICONS, type IconName } from "./icons";
export { LogoTile, SourceMark, SourceMarks, TIER_FILL } from "./marks";
export { NoLinesSlot, PHOTO_NOTE, PhotoGrid, PhotoStrip, PhotoThumbs, PhotoTile } from "./photo-tiles";
export { ProductSheet } from "./product-sheet";
export { Panel, PanelFooter, PanelHeader, type PanelHeaderModel } from "./results-panel";
export { ResultsTable, Td, Th } from "./results-table";
export {
  Dialog,
  MissingFlag,
  RfqComposer,
  Variable,
  type ProductLine,
  type QuestionRow,
  type RailStep,
  type RfqComposerModel,
  type VariableChip,
} from "./rfq-composer";
export { RFQ_EMPTY_COPY, RfqList, Toast } from "./rfq-list";
export { SearchComposer, type FilterChipModel } from "./search-composer";
export {
  ActionBar,
  CertCard,
  CertGrid,
  FactsPanel,
  LockCard,
  RscBlock,
  SanctionBanner,
  Scrim,
  Sheet,
  SheetBar,
  SheetScroll,
  SheetSection,
  SheetTabs,
  Stage,
  Stats,
} from "./sheet";
export { MetaLine, SanctionLine, SupplierResultCard } from "./supplier-result-card";
export { SupplierSheet } from "./supplier-sheet";
export { Caption, Code, Eyebrow, Heading, Label, Title } from "./type";
