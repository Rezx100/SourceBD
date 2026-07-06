// Full authority names for corroborating-source tooltips. Short codes
// (BGMEA, EPB, OEKO-TEX, …) are legible as chip labels but not as tooltips —
// a buyer hovering a mark should see who the authority actually is. Mirrors
// the "Display name" column of the source registry in context/logos.lock.md;
// keep the two in sync when a new source is onboarded.

const SOURCE_FULL_NAMES: Record<string, string> = {
  BEPZA: "Bangladesh Export Processing Zones Authority",
  DIFE: "Dept. of Inspection for Factories & Establishments",
  EPB: "Export Promotion Bureau",
  RJSC: "Registrar of Joint Stock Companies & Firms",
  RSC: "RMG Sustainability Council",
  BIN: "Business Identification Number registry",
  BGMEA: "Bangladesh Garment Manufacturers & Exporters Association",
  BKMEA: "Bangladesh Knitwear Manufacturers & Exporters Association",
  BTMA: "Bangladesh Textile Mills Association",
  BGAPMEA: "Bangladesh Garment Accessories & Packaging Manufacturers & Exporters Association",
  WRAP: "Worldwide Responsible Accredited Production",
  GOTS: "Global Organic Textile Standard",
  OEKO_TEX: "OEKO-TEX",
  "OEKO-TEX": "OEKO-TEX",
  GRS: "Global Recycled Standard",
  RCS: "Recycled Claim Standard",
  OCS: "Organic Content Standard",
  BSCI: "amfori BSCI",
  AMFORI: "amfori BSCI",
  OFAC: "US OFAC Specially Designated Nationals List",
  ofac_sdn: "US OFAC Specially Designated Nationals List",
  UFLPA: "US CBP UFLPA Entity List",
  uflpa: "US CBP UFLPA Entity List",
  US_WRO: "US CBP Withhold Release Orders & Findings",
  us_wro: "US CBP Withhold Release Orders & Findings",
  UK_OFSI: "UK OFSI Consolidated Sanctions List",
  uk_ofsi: "UK OFSI Consolidated Sanctions List",
  EU_SANC: "EU Sanctions Map",
  eu_sanctions: "EU Sanctions Map",
  ILAB_TVPRA: "US DOL ILAB List of Goods Produced by Child Labor or Forced Labor",
  ilab_tvpra: "US DOL ILAB List of Goods Produced by Child Labor or Forced Labor",
};

/** Full authority name for a source/tag code, or null when unknown (caller
 *  falls back to the abbreviated label). */
export function sourceFullName(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return SOURCE_FULL_NAMES[tag] ?? SOURCE_FULL_NAMES[tag.toUpperCase()] ?? null;
}
