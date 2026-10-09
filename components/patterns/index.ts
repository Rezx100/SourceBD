// SourceBD v4 patterns (B2): the pieces of Paper's `03 Patterns` that SourceBD owns, built on
// `components/kit`. Presentational: each takes what it shows as props, so a page decides the
// data and these decide the look and the words. Shells are B3.

export { ChatThread, Bubble, DateLine, FileChip } from "./chat";
export { CertStateChip, CertTable, type CertRowData } from "./certificate";
export { CertSummaryCell } from "./cert-summary";
export { LinkPending } from "./link-pending";
export { LockedContact, LockedContactRow, onFileWords } from "./contact";
export { NeedsAttention, type AttentionItem } from "./attention";
export { ExportsFreshness, ExportsSummary, ExportsTable, type ExportRow, type ExportStat } from "./exports";
export { FactList, FactRow, type FactValue } from "./fact";
export { MapCard, Pin, PinLegend, SiteList, type Site } from "./locations";
export { AcceptSummary, QuoteComparison, SampleLabel, sortQuotes, type Quote } from "./quotes";
export { RSC_REPORTS, RscBlock, type RscBlockData, type RscReportName } from "./rsc";
export { REFUSAL, Refusal, SanctionBanner, SanctionDropped, SanctionTag, sanctionRowClass } from "./sanction";
export { PendingMark, SourceChip, SourceGroups, SourceLine, SourceList, SourceMark, SourcesCell, TIER_LABEL, tierOf, type SourceEntry } from "./source-mark";
export { ClaimRail, ConfirmedClaim, OpenClaim, downloadBlockedWords } from "./statement";
export { SupplierRow } from "./supplier-row";
export { Timeline, type Milestone } from "./timeline";
export { ABSENT, CERT_ORDER, SITE_WORDS, certHeading, certLine, certShort, certSummary, certWords, isApproximate, lateWords, moqWarning, rankCerts, usd, vsTarget, type CertInput, type CertLine, type CertSummary, type SiteKind } from "./words";
