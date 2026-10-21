// The product demos that play on the marketing site (M2): four for the home page's tour, one for suppliers, the
// four vignettes of the home's grid and the two of the product pages (M4), and, since the 22 Oct critique, the parts
// that replaced the 3 Oct screenshots (the filter pane, the quotes at full size, the review before an RFQ goes, a
// thread under its RFQ, the statement draft, and the search's end frame for the home's hero). Every one is fed by the
// committed snapshot of real records (`lib/marketing/demo-snapshot.json`).

export { DemoSearch, SearchEnd } from "./search";
export { DemoRecord, type RecordTab } from "./record";
export { DemoQuotes, DemoReview, DemoRfq } from "./rfq";
export { DemoCompliance, type ComplianceView } from "./compliance";
export { DemoClaim } from "./claim";
export { DemoFilters } from "./filters";
export { DemoStatement } from "./statement";
export { DemoThread } from "./thread";
export { VIGNETTES, VignetteExpiry, VignetteMarks, VignetteQuotes, VignetteReceipts, VignetteSanction, VignetteSearch } from "./vignettes";
