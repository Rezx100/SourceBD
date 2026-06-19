// Provider logo resolver for Discover + company-preview cards.
//
// Maps a `source_tags` value (registry membership codes + certification
// codes, uppercase as they arrive from the `discover_suppliers` RPC) to a
// stable CDN logo. Mirrors the LOGO_BY_CODE / LOGO_BY_CERT maps used on the
// full supplier dossier so a buyer sees the same marks everywhere.
//
// Returns null when no logo exists — the caller renders a plain text pill.

const CDN = "https://sourcebd-docs.b-cdn.net/inapp-logos";

const SOURCE_LOGOS: Record<string, string> = {
  // Registries / associations
  BGMEA: `${CDN}/bgmea.png`,
  BKMEA: `${CDN}/bkmea.png`,
  BTMA: `${CDN}/BTMA.webp`,
  RSC: `${CDN}/RSC.png`,
  // Certifications
  WRAP: `${CDN}/wrap.png`,
  GOTS: `${CDN}/gost.png`,
  OEKO_TEX: `${CDN}/okeo100.png`,
  "OEKO-TEX": `${CDN}/okeo100.png`,
  GRS: `${CDN}/GRS.png`,
  RCS: `${CDN}/RCS.png`,
  OCS: `${CDN}/OCS.png`,
  BSCI: `${CDN}/amfori.jpg`,
  AMFORI: `${CDN}/amfori.jpg`,
};

/** Resolve a CDN logo URL for a source tag, or null when none is known. */
export function sourceLogo(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return SOURCE_LOGOS[tag] ?? SOURCE_LOGOS[tag.toUpperCase()] ?? null;
}
