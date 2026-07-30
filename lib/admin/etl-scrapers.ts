export type ScraperGroup =
  | "registries"
  | "rsc"
  | "certifications"
  | "sanctions"
  | "brands"
  | "maintenance";

export type ScraperRisk = "low" | "medium" | "high";

export type ScraperCatalogItem = {
  code: string;
  label: string;
  group: ScraperGroup;
  sourceTier: string;
  risk: ScraperRisk;
  suggestedIntervalMinutes: number;
  updates: string;
  operatorNote: string;
};

export const SCRAPER_GROUP_LABELS: Record<ScraperGroup, string> = {
  registries: "Registry sources",
  rsc: "RSC compliance",
  certifications: "Certifications",
  sanctions: "Sanctions checks",
  brands: "Brand disclosures",
  maintenance: "Evidence maintenance",
};

export const SCRAPER_CATALOG = [
  {
    code: "bgmea_buying_house",
    label: "BGMEA buying houses",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "BGMEA associate member (buying house) records from the official PDF.",
    operatorNote: "Run after replacing etl/raw/BGMEA_Associate_Members.pdf with a fresh download.",
  },
  {
    code: "bgmea_web",
    label: "BGMEA web",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "BGMEA web directory supplier evidence and contact fields.",
    operatorNote: "Use weekly unless BGMEA publishes a visible directory update.",
  },
  {
    code: "bkmea_web",
    label: "BKMEA list",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "BKMEA member list records.",
    operatorNote: "Run before BKMEA detail enrichment.",
  },
  {
    code: "bkmea_detail",
    label: "BKMEA details",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "Detailed BKMEA addresses, contacts, and factory attributes.",
    operatorNote: "Run after the BKMEA list scraper has fresh records.",
  },
  {
    code: "bgapmea_web",
    label: "BGAPMEA web",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "BGAPMEA accessory supplier registry evidence.",
    operatorNote: "Good weekly refresh for trims and packaging suppliers.",
  },
  {
    code: "epb_web",
    label: "EPB web",
    group: "registries",
    sourceTier: "Tier 1",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "EPB exporter registry evidence.",
    operatorNote: "Tier 1 source. Review failures quickly.",
  },
  {
    code: "btma_spinning",
    label: "BTMA spinning",
    group: "registries",
    sourceTier: "Tier 2",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "BTMA spinning mill registry records from prepared raw JSON.",
    operatorNote: "Run when the BTMA raw capture has been refreshed.",
  },
  {
    code: "rsc",
    label: "RSC factories",
    group: "rsc",
    sourceTier: "Tier 1",
    risk: "high",
    suggestedIntervalMinutes: 10080,
    updates: "RSC factory identities and remediation fields.",
    operatorNote: "Tier 1 safety source. Treat failures as launch-impacting.",
  },
  {
    code: "rsc_reports",
    label: "RSC reports",
    group: "rsc",
    sourceTier: "Tier 1",
    risk: "medium",
    suggestedIntervalMinutes: 43200,
    updates: "Monthly RSC industry metrics.",
    operatorNote: "Monthly is enough unless RSC publishes a new report.",
  },
  {
    code: "rsc_updates",
    label: "RSC updates",
    group: "rsc",
    sourceTier: "Tier 1",
    risk: "medium",
    suggestedIntervalMinutes: 10080,
    updates: "RSC update feed and recent compliance changes.",
    operatorNote: "Use weekly to keep public status fresh.",
  },
  {
    code: "rsc_documents",
    label: "RSC documents",
    group: "rsc",
    sourceTier: "Tier 1",
    risk: "high",
    suggestedIntervalMinutes: 43200,
    updates: "Mirrored RSC fire, electrical, structural, boiler and CAP documents.",
    operatorNote: "Can be slow. Run when document coverage needs a refresh.",
  },
  {
    code: "wrap",
    label: "WRAP",
    group: "certifications",
    sourceTier: "Tier 3",
    risk: "medium",
    suggestedIntervalMinutes: 43200,
    updates: "WRAP certified facility records and certificate expiry dates.",
    operatorNote: "Run monthly or when WRAP changes its certified-facility list.",
  },
  {
    code: "oeko_tex",
    label: "OEKO-TEX",
    group: "certifications",
    sourceTier: "Tier 3",
    risk: "medium",
    suggestedIntervalMinutes: 43200,
    updates: "OEKO-TEX certification evidence and document URLs.",
    operatorNote: "Monthly is usually enough for certificate refreshes.",
  },
  {
    code: "gots",
    label: "GOTS",
    group: "certifications",
    sourceTier: "Tier 3",
    risk: "medium",
    suggestedIntervalMinutes: 43200,
    updates: "GOTS certification evidence and expiry dates.",
    operatorNote: "Run monthly, or after a known GOTS registry update.",
  },
  {
    code: "sa8000",
    label: "SA8000",
    group: "certifications",
    sourceTier: "Tier 3",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "SA8000 certification records.",
    operatorNote: "Small source. Monthly refresh is enough.",
  },
  {
    code: "uflpa",
    label: "UFLPA Entity List",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 1440,
    updates: "UFLPA forced-labor list entries and supplier screening matches.",
    operatorNote: "Run daily. Active hits require immediate admin review.",
  },
  {
    code: "cbp_wro",
    label: "CBP WRO",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 1440,
    updates: "US CBP Withhold Release Order entries and matches.",
    operatorNote: "Run daily. Active hits require immediate admin review.",
  },
  {
    code: "ofac_sdn",
    label: "OFAC SDN",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 1440,
    updates: "OFAC SDN entries and supplier screening matches.",
    operatorNote: "Run daily. Active hits require immediate admin review.",
  },
  {
    code: "uk_ofsi",
    label: "UK OFSI",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 1440,
    updates: "UK OFSI sanctions entries and supplier screening matches.",
    operatorNote: "Run daily for buyer due-diligence coverage.",
  },
  {
    code: "eu_sanctions",
    label: "EU sanctions",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 1440,
    updates: "EU sanctions entries and supplier screening matches.",
    operatorNote: "Run daily for EU buyer diligence coverage.",
  },
  {
    code: "ilab_tvpra",
    label: "ILAB TVPRA",
    group: "sanctions",
    sourceTier: "Tier 5",
    risk: "high",
    suggestedIntervalMinutes: 10080,
    updates: "US DOL TVPRA forced-labor goods evidence.",
    operatorNote: "Weekly is enough unless DOL publishes an update.",
  },
  {
    code: "brand_hm",
    label: "H&M disclosure",
    group: "brands",
    sourceTier: "Tier 4",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "H&M published supplier disclosure matches.",
    operatorNote: "Brand lists are supporting evidence, not endorsement.",
  },
  // brand_inditex retired 29 Jul 2026: Inditex publishes no factory-level
  // supplier list, only aggregate per-country counts, and shares the real list
  // privately with IndustriALL Global Union. The page we scraped now redirects to
  // their homepage and answers 200. Do not re-add without a public list.
  {
    code: "brand_primark",
    label: "Primark disclosure",
    group: "brands",
    sourceTier: "Tier 4",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "Primark published supplier disclosure matches.",
    operatorNote: "Brand lists are supporting evidence, not endorsement.",
  },
  {
    code: "brand_asos",
    label: "ASOS disclosure",
    group: "brands",
    sourceTier: "Tier 4",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "ASOS published supplier disclosure matches.",
    operatorNote: "Brand lists are supporting evidence, not endorsement.",
  },
  {
    code: "brand_ms",
    label: "M&S disclosure",
    group: "brands",
    sourceTier: "Tier 4",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "M&S published supplier disclosure matches.",
    operatorNote: "Brand lists are supporting evidence, not endorsement.",
  },
  {
    code: "brand_next",
    label: "Next disclosure",
    group: "brands",
    sourceTier: "Tier 4",
    risk: "low",
    suggestedIntervalMinutes: 43200,
    updates: "Next published supplier disclosure matches.",
    operatorNote: "Brand lists are supporting evidence, not endorsement.",
  },
  // Maintenance jobs. They ingest nothing, but they run through the same queue,
  // timer UI and run history so an operator has one place to look — and so
  // "verification has not run for three weeks" is as visible as a failed scrape.
  {
    code: "verify_evidence",
    label: "Verify citations",
    group: "maintenance",
    sourceTier: "—",
    risk: "low",
    suggestedIntervalMinutes: 1440,
    updates:
      "Re-checks recorded citations: is the link still live, and does the page still state the cited value.",
    operatorNote:
      "Run daily. A timeout or block never retires a citation, so a red count here means real drift, not a flaky source.",
  },
  {
    code: "refresh_monitors",
    label: "Refresh monitors",
    group: "maintenance",
    sourceTier: "—",
    risk: "low",
    suggestedIntervalMinutes: 10080,
    updates:
      "Reconciles Firecrawl monitors with the index pages each source declares.",
    operatorNote:
      "Idempotent. Run after adding a source or changing a registry entry point.",
  },
] as const satisfies readonly ScraperCatalogItem[];

export type ScraperCode = (typeof SCRAPER_CATALOG)[number]["code"];

/**
 * How each source acquires its bytes. Mirrors the `transport` attribute on the
 * Python scraper classes.
 *
 * Surfaced in the admin console because the transport determines what a failure
 * means and what an operator can do about it: a Firecrawl source failing may be
 * a vendor outage or an exhausted credit balance, a direct source failing is the
 * publisher blocking us, and a file source failing means nobody has staged a
 * fresh extract. One "failed" badge for all three would hide that.
 *
 * Typed as an exhaustive record, so adding a source without declaring its
 * transport is a compile error rather than a blank badge.
 */
export type ScraperTransport = "firecrawl" | "direct" | "file" | "job";

export const SCRAPER_TRANSPORT: Record<ScraperCode, ScraperTransport> = {
  bgmea_buying_house: "file",
  btma_spinning: "file",
  bgmea_web: "firecrawl",
  bkmea_web: "firecrawl",
  bkmea_detail: "firecrawl",
  bgapmea_web: "firecrawl",
  rsc_reports: "firecrawl",
  rsc_updates: "firecrawl",
  sa8000: "firecrawl",
  uflpa: "firecrawl",
  cbp_wro: "firecrawl",
  ilab_tvpra: "firecrawl",
  brand_hm: "firecrawl",
  brand_primark: "firecrawl",
  brand_asos: "firecrawl",
  brand_next: "firecrawl",
  // M&S is the one brand that cannot move: reading the OSH embed token needs a
  // real browser observing real network traffic, so it keeps Playwright.
  brand_ms: "direct",
  epb_web: "direct",
  rsc: "direct",
  rsc_documents: "direct",
  wrap: "direct",
  oeko_tex: "direct",
  gots: "direct",
  ofac_sdn: "direct",
  uk_ofsi: "direct",
  eu_sanctions: "direct",
  verify_evidence: "job",
  refresh_monitors: "job",
};

export const SCRAPER_TRANSPORT_LABELS: Record<ScraperTransport, string> = {
  firecrawl: "Firecrawl",
  direct: "Direct",
  file: "File",
  job: "Job",
};

export function scraperTransport(code: string): ScraperTransport | null {
  return (SCRAPER_TRANSPORT as Record<string, ScraperTransport>)[code] ?? null;
}

/** Maintenance jobs, which have no source and no records to report. */
export function isMaintenanceCode(code: string): boolean {
  return SCRAPER_BY_CODE.get(code)?.group === "maintenance";
}

export const SCRAPER_CODES = SCRAPER_CATALOG.map((scraper) => scraper.code);

export const SCRAPER_BY_CODE = new Map<string, ScraperCatalogItem>(
  SCRAPER_CATALOG.map((scraper) => [scraper.code, scraper]),
);

export function isScraperCode(value: unknown): value is ScraperCode {
  return typeof value === "string" && SCRAPER_BY_CODE.has(value);
}

export function formatInterval(minutes: number): string {
  if (minutes % 43200 === 0) return `${minutes / 43200} mo`;
  if (minutes % 10080 === 0) return `${minutes / 10080} wk`;
  if (minutes % 1440 === 0) return `${minutes / 1440} d`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}
