// Source rank for the dashboard's marks (dashboard v3.2 kit, REZ-A).
//
// A source mark is a small square coloured by rank — government darkest,
// foreign regulators lightest — with a two-letter code inside. The rank ramp
// is neutral on purpose (spec §9): it reads without a legend and leaves colour
// free for status. The codes below are the artifact's (SourceMarks README);
// full names come from `lib/source-full-names.ts` for the hover.

import type { TierRank } from "@/lib/design/tokens";
import { sourceFullName } from "@/lib/source-full-names";

export type SourceMarkModel = {
  /** The database source code, e.g. `BGMEA`, `EPB`, `BRAND_HM`. */
  code: string;
  /** Rank 1 (government) … 5 (foreign regulators). */
  tier: TierRank;
  /** The two-letter stamp shown inside the square. */
  mark: string;
  /** The short label a buyer reads: `BGMEA`, `H&M`, `OEKO-TEX`. */
  label: string;
  /** Full authority name for the hover; falls back to the label. */
  name: string;
  /** The register page the mark links to, when the record carries one. */
  href?: string | null;
  /**
   * What `href` opens: the register's page about this record, or a brand's
   * whole disclosure list. The accessible name must say which.
   */
  opens?: "record" | "list";
};

const REGISTRY: Record<string, { tier: TierRank; mark: string; label: string }> = {
  // Tier 1 — government / statutory
  EPB: { tier: 1, mark: "EP", label: "EPB" },
  RSC: { tier: 1, mark: "RS", label: "RSC" },
  DIFE: { tier: 1, mark: "DF", label: "DIFE" },
  RJSC: { tier: 1, mark: "RJ", label: "RJSC" },
  BEPZA: { tier: 1, mark: "BZ", label: "BEPZA" },
  BIN: { tier: 1, mark: "BN", label: "BIN" },
  // Tier 2 — industry bodies
  BGMEA: { tier: 2, mark: "BG", label: "BGMEA" },
  BKMEA: { tier: 2, mark: "BK", label: "BKMEA" },
  BGAPMEA: { tier: 2, mark: "BA", label: "BGAPMEA" },
  BTMA: { tier: 2, mark: "BT", label: "BTMA" },
  // Tier 3 — certification bodies
  GOTS: { tier: 3, mark: "GO", label: "GOTS" },
  OEKO_TEX: { tier: 3, mark: "OT", label: "OEKO-TEX" },
  "OEKO-TEX": { tier: 3, mark: "OT", label: "OEKO-TEX" },
  WRAP: { tier: 3, mark: "WR", label: "WRAP" },
  SA8000: { tier: 3, mark: "SA", label: "SA8000" },
  GRS: { tier: 3, mark: "GR", label: "GRS" },
  RCS: { tier: 3, mark: "RC", label: "RCS" },
  OCS: { tier: 3, mark: "OC", label: "OCS" },
  // Tier 4 — brand disclosure lists
  BRAND_HM: { tier: 4, mark: "HM", label: "H&M" },
  BRAND_ASOS: { tier: 4, mark: "AS", label: "ASOS" },
  BRAND_NEXT: { tier: 4, mark: "NX", label: "NEXT" },
  BRAND_MS: { tier: 4, mark: "MS", label: "M&S" },
  BRAND_INDITEX: { tier: 4, mark: "IN", label: "Inditex" },
  BRAND_PRIMARK: { tier: 4, mark: "PR", label: "Primark" },
  // Tier 5 — foreign regulators / sanctions lists
  OFAC: { tier: 5, mark: "OF", label: "OFAC" },
  UFLPA: { tier: 5, mark: "UF", label: "UFLPA" },
  US_WRO: { tier: 5, mark: "WO", label: "US WRO" },
  UK_OFSI: { tier: 5, mark: "UK", label: "UK OFSI" },
  EU_SANC: { tier: 5, mark: "EU", label: "EU sanctions" },
  // `public.sources` registers this one as `ILAB`, not `ILAB_TVPRA` (SQL,
  // 25 Sep 2026). With only the long form here, `isKnownSource("ILAB")` was
  // false and the Sources section would have printed "not in the trust table"
  // over a tier-5 foreign regulator. Both spellings, one entry.
  ILAB: { tier: 5, mark: "IL", label: "ILAB" },
  ILAB_TVPRA: { tier: 5, mark: "IL", label: "ILAB" },
};

function fallback(code: string): { tier: TierRank; mark: string; label: string } {
  const upper = code.toUpperCase();
  if (upper.startsWith("BRAND_")) {
    const raw = upper.slice(6).replace(/_/g, " ").trim();
    const label = raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : code;
    return { tier: 4, mark: raw.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "BR", label };
  }
  const letters = upper.replace(/[^A-Z0-9]/g, "");
  // Unknown codes rank as cross-check only (the lightest square) so an
  // unmapped source can never look more trusted than a mapped one.
  return { tier: 5, mark: letters.slice(0, 2) || "??", label: code };
}

/**
 * Whether a URL is a page about THIS record rather than the register's front
 * door, its search form or a bulk listing. A mark's accessible name promises
 * "opens the register page", so anything else may not be linked from one.
 *
 * Rejected, with the production shapes that forced each rule:
 * - no URL, or not http(s) — `javascript:` and protocol-relative included;
 * - an empty path: `https://bgapmea.org/`, `https://www.bkmea.com/`,
 *   `https://www.rsc-bd.org/` (4,348 pill rows between them);
 * - a search form: `https://sa-intl.org/sa8000-search/` (7 records) — the
 *   digits in "sa8000" made it look like a record id;
 * - a bulk API listing: the Marks & Spencer source is one
 *   `opensupplyhub.org/api/facilities/?…&pageSize=50` URL shared by all 67
 *   records on that list;
 * - a path with nothing record-shaped in it at all — no digits, no query, not
 *   a document.
 *
 * `lib/epb-hscodes.ts` applies the same rule to the EPB pill.
 */
export function recordPage(url: string | null | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    if (path === "" || path === "/") return false;
    if (/(?:^|\/)(?:search|find|lookup|directory)(?:[-_/]|$)|[-_]search(?:[-_/]|$)/i.test(path)) return false;
    if (/(?:^|\/)api(?:\/|$)/i.test(path)) return false;
    return /\d/.test(path) || u.search !== "" || /\.(?:pdf|xlsx|xls|csv)$/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Rank, stamp and names for one source code. Unknown codes rank 5.
 *
 * Every mark's link goes through `recordPage`, here and nowhere else: three
 * call sites used to build a mark straight from a raw `source_url`, so the
 * same register could be an unlinked square in the head and a link to its
 * homepage in the facts panel of the same record.
 */
/**
 * A tier-4 brand disclosure list is one file listing every supplier on it, so
 * its URL is never a page about one record — `recordPage`'s URL rules cannot
 * see that (ASOS's `factory-list-april-2026.pdf`, NEXT's `T1 2025.pdf` and
 * H&M's `…-May-2026 .xlsx` all carry a year, which reads as a record id), and
 * 267 published records were getting "opens the register page" on a file of
 * everybody. The file is real evidence and stays reachable; what changes is
 * what the link is called.
 */
function opensA(code: string): "record" | "list" {
  return code.toUpperCase().startsWith("BRAND_") ? "list" : "record";
}

export function sourceMark(code: string, href: string | null = null): SourceMarkModel {
  const key = code.toUpperCase();
  const entry = REGISTRY[key] ?? REGISTRY[code] ?? fallback(code);
  return {
    code,
    tier: entry.tier,
    mark: entry.mark,
    label: entry.label,
    name: sourceFullName(code) ?? entry.label,
    href: recordPage(href) ? href! : null,
    opens: opensA(code),
  };
}

/** The tier rank behind a provenance row's `tier` slug (`tier1_gov`, `tier4_brand`, …). */
export function tierFromSlug(slug: string): TierRank {
  const m = /tier([1-6])/.exec(slug.toLowerCase());
  if (m && m[1]) {
    const n = Number(m[1]);
    return (n >= 5 ? 5 : n) as TierRank;
  }
  return 5;
}

/**
 * The mark row for a record: one mark per distinct source code, best rank
 * first, then the artifact's order within a rank (`registry` codes before
 * certifiers' alphabetical). Cross-check-only codes are kept at the end.
 */
export function marksFromTags(tags: readonly string[], hrefs: Readonly<Record<string, string | null>> = {}): SourceMarkModel[] {
  const seen = new Set<string>();
  const out: SourceMarkModel[] = [];
  for (const tag of tags) {
    const m = sourceMark(tag, hrefs[tag.toUpperCase()] ?? null);
    const k = m.label.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out.sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
}

/** The best-ranked mark of a record — the initials tile takes its colour. */
export function topTier(tags: readonly string[]): TierRank {
  return marksFromTags(tags)[0]?.tier ?? 5;
}

/** "11 sources" / "1 source". */
export function sourceCountLabel(n: number): string {
  return `${n} ${n === 1 ? "source" : "sources"}`;
}

/**
 * AGENTS rule 5's hierarchy has SIX ranks; `TierRank` has five, because it is
 * the colour ramp and tier 6 has never been drawn. The Sources section prints
 * the tier in words, which is a claim about trust rather than a colour, so the
 * words need the sixth.
 */
export type TrustRank = TierRank | 6;

/** The rank a provenance row's `tier` slug names, tier 6 included. */
export function trustRankFromSlug(slug: string): TrustRank | null {
  const m = /tier([1-6])/.exec(slug.toLowerCase());
  if (!m || !m[1]) return null;
  return Number(m[1]) as TrustRank;
}

/** Whether the trust table knows this source code at all. */
export function isKnownSource(code: string): boolean {
  return Boolean(REGISTRY[code.toUpperCase()]);
}

/**
 * The trust tier in the words a buyer reads. AGENTS rule 5 names the hierarchy
 * by rank; `tier1_gov` is not English.
 *
 * `null` is an unmapped code. `fallback()` ranks those 5 so an unknown source
 * can never look more trusted than a mapped one — but 5 is "foreign regulator",
 * a real and specific claim, and printing it over a source we do not recognise
 * says something we cannot support. Rule 5's own words for the bottom of the
 * hierarchy are cross-check only.
 */
export function tierWords(rank: TrustRank | null, code?: string): string {
  switch (rank) {
    case 1:
      // The RMG Sustainability Council is an industry-led programme, not a
      // government body; its rank (1) is the founder's call, its words are not.
      return code?.toUpperCase() === "RSC" ? "Industry-led programme" : "Government register";
    case 2:
      return "Industry body";
    case 3:
      return "Certification body";
    case 4:
      return "Brand disclosure list";
    case 5:
      return "Foreign regulator";
    case 6:
      return "Cross-check only";
    default:
      return "Source not in the trust table · cross-check only";
  }
}
