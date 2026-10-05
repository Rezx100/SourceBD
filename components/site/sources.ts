// The 25 sources the methodology page lists, by tier (`public.sources`, the codes the database holds). What each one
// gives us is in words; the counts and the day each was last read come from the database (`SiteFacts.sources`) and are
// left out when they were not read. A source with no records yet says so.

export type TierKey = "tier1_gov" | "tier2_industry" | "tier3_cert" | "tier4_brand" | "tier5_regulatory";

export type SourceInfo = { code: string; name: string; full: string; gives: string };

export type Tier = { key: TierKey; n: number; label: string; ladder: string; note: string; sources: SourceInfo[] };

const brand = "Factory named on the brand's own list";
const none = "Nothing to read until they publish one";

export const TIERS: Tier[] = [
  {
    key: "tier1_gov",
    n: 1,
    label: "Government and RSC",
    ladder: "EPB, RSC, BEPZA, DIFE, RJSC",
    note: "RSC is an industry council, not a government register. It sits here because its inspectors visit the factory.",
    sources: [
      { code: "EPB", name: "EPB", full: "Export Promotion Bureau", gives: "Exporter number and products exported, by HS code" },
      { code: "RSC", name: "RSC", full: "RMG Sustainability Council", gives: "Safety inspections, remediation progress, workers counted" },
      { code: "BEPZA", name: "BEPZA", full: "Bangladesh Export Processing Zones Authority", gives: "Factories inside export processing zones" },
      { code: "DIFE", name: "DIFE", full: "Department of Inspection for Factories and Establishments", gives: "Factory licences" },
      { code: "RJSC", name: "RJSC", full: "Registrar of Joint Stock Companies", gives: "Company registration" },
    ],
  },
  {
    key: "tier2_industry",
    n: 2,
    label: "Trade bodies",
    ladder: "BGMEA, BKMEA, BGAPMEA, BTMA",
    note: "Membership registers. Capacity and products are as declared by the member.",
    sources: [
      { code: "BGMEA", name: "BGMEA", full: "Garment Manufacturers and Exporters Association", gives: "Membership, reg. no., declared capacity and products" },
      { code: "BKMEA", name: "BKMEA", full: "Knitwear Manufacturers and Exporters Association", gives: "Membership and member number" },
      { code: "BGAPMEA", name: "BGAPMEA", full: "Garment Accessories and Packaging Association", gives: "Membership of accessory and packaging makers" },
      { code: "BTMA", name: "BTMA", full: "Bangladesh Textile Mills Association", gives: "Membership of spinning, weaving and dyeing mills" },
    ],
  },
  {
    key: "tier3_cert",
    n: 3,
    label: "Certification bodies",
    ladder: "OEKO-TEX, GOTS, WRAP, SA8000",
    note: "Each gives certificate number, issued by, valid until and scope.",
    sources: [
      { code: "OEKO_TEX", name: "OEKO-TEX", full: "OEKO-TEX label check", gives: "STANDARD 100 certificates" },
      { code: "GOTS", name: "GOTS", full: "Global Organic Textile Standard", gives: "Scope certificates, operations and products" },
      { code: "WRAP", name: "WRAP", full: "Worldwide Responsible Accredited Production", gives: "Certified facilities and expiry dates" },
      { code: "SA8000", name: "SA8000", full: "SAAS certified organisations directory", gives: "SA8000 social certificates" },
    ],
  },
  {
    key: "tier4_brand",
    n: 4,
    label: "Brand supplier lists",
    ladder: "H&M Group, Next, Marks & Spencer, ASOS, Inditex, Primark",
    note: "The brand names this factory as a supplier. Names in type, never logos.",
    sources: [
      { code: "BRAND_HM", name: "H&M Group", full: "Published supplier list", gives: brand },
      { code: "BRAND_NEXT", name: "Next", full: "Tier 1 manufacturing sites", gives: brand },
      { code: "BRAND_MS", name: "Marks & Spencer", full: "Interactive supplier map", gives: "Factory named on the brand's own map" },
      { code: "BRAND_ASOS", name: "ASOS", full: "Factory list", gives: brand },
      { code: "BRAND_INDITEX", name: "Inditex", full: "No per-factory list published on their own site", gives: none },
      { code: "BRAND_PRIMARK", name: "Primark", full: "No per-factory list published on their own site", gives: none },
    ],
  },
  {
    key: "tier5_regulatory",
    n: 5,
    label: "Foreign regulators",
    ladder: "UFLPA Entity List, OFAC, UK OFSI, EU sanctions, US WRO, US ILAB",
    note: "Lists we check every supplier against.",
    sources: [
      { code: "UFLPA", name: "UFLPA Entity List", full: "US Department of Homeland Security", gives: "" },
      { code: "OFAC", name: "SDN list", full: "US Treasury, OFAC", gives: "" },
      { code: "UK_OFSI", name: "Financial sanctions targets", full: "UK Treasury, OFSI", gives: "" },
      { code: "EU_SANC", name: "EU sanctions map", full: "European Union", gives: "" },
      { code: "US_WRO", name: "Withhold Release Orders", full: "US Customs and Border Protection", gives: "" },
      { code: "ILAB", name: "Goods made with child or forced labour", full: "US Department of Labor, ILAB", gives: "" },
    ],
  },
];

export const SOURCE_COUNT = TIERS.reduce((n, t) => n + t.sources.length, 0);
