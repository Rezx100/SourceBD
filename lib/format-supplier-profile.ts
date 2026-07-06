/** Shared display helpers for supplier / company profile surfaces. */

export type ProvenanceLike = {
  display_name: string;
  last_seen_at: string;
};

/** Most recently fetched provenance row (not tier-priority order). */
export function latestProvenanceRecord<T extends ProvenanceLike>(
  rows: readonly T[],
): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) =>
    row.last_seen_at > best.last_seen_at ? row : best,
  );
}

/** Whole years elapsed since an ISO date, accounting for month/day. */
export function yearsElapsedSince(date: string): number {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** Join factory types for facts / capacity rows (shows all types). */
export function formatFactoryTypesList(types: readonly string[]): string {
  return types.filter(Boolean).join(" · ");
}

/** Narrative factory-kind phrase from all declared types. */
export function factoryTypesNarrative(types: readonly string[]): string | null {
  const clean = types.filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return `${clean[0]!.toLowerCase()} manufacturer`;
  if (clean.length === 2) {
    return `${clean[0]!.toLowerCase()} and ${clean[1]!.toLowerCase()} manufacturer`;
  }
  const head = clean
    .slice(0, -1)
    .map((t) => t.toLowerCase())
    .join(", ");
  const tail = clean[clean.length - 1]!.toLowerCase();
  return `${head}, and ${tail} manufacturer`;
}

/**
 * Buyer-facing label for a provenance / registry reference.
 * Strips internal harvest prefixes where we can infer the official ID.
 */
export function formatProvenanceRef(
  sourceCode: string,
  ref: string | null | undefined,
): string | null {
  const trimmed = ref?.trim();
  if (!trimmed) return null;

  const code = sourceCode.toUpperCase();
  const general = trimmed.match(/^general-(\d+)$/i);
  if (general && (code === "BGMEA" || code === "BKMEA" || code === "BGAPMEA")) {
    return `Member #${general[1]}`;
  }

  const certPrefix = trimmed.match(/^(gots|wrap|oeko[_-]?tex|sa8000|grs|rcs|ocs)-(.+)$/i);
  if (certPrefix) return certPrefix[2]!;

  return trimmed;
}

/** Buyer-facing date format for profile tables and metadata: "18 Dec 2022".
 *  Never render a raw ISO string — falls back to the raw input only when it
 *  doesn't parse as a date at all. */
export function formatProfileDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Month + year only, for facts where the day is irrelevant (e.g.
 *  "Established"): "Dec 2022". Free-text columns like `established_date`
 *  sometimes arrive as a bare year ("1999") — falls back to that year
 *  rather than inventing a month. */
export function formatMonthYear(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short" });
  }
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
}

/** "a" / "an" for a noun phrase, so generated copy never reads "a accessories
 *  manufacturer". */
export function articleFor(phrase: string): "a" | "an" {
  return /^[aeiou]/i.test(phrase.trim()) ? "an" : "a";
}

/** One canonical trust line, reused verbatim across the header, the Company
 *  overview card, and the Provenance tab so the three surfaces never quote
 *  different counts or different nouns for the same numbers. */
export function trustLine(authorityCount: number, recordCount: number): string {
  const authorities = authorityCount === 1 ? "authority" : "authorities";
  const records = recordCount === 1 ? "record" : "records";
  return `Verified by ${authorityCount} ${authorities} · ${recordCount} source ${records}`;
}

/** Compact header badge — same authority count as `trustLine`, no record
 *  count (space-constrained, sits next to the company name). */
export function verifiedBadgeLabel(authorityCount: number): string {
  return `Verified · ${authorityCount} ${authorityCount === 1 ? "authority" : "authorities"}`;
}

/** Narrowest header badge — phones only, sits in a single line next to the
 *  entity-type and location chips so all three never wrap. */
export function verifiedBadgeLabelCompact(authorityCount: number): string {
  return `Verified · ${authorityCount}`;
}

/** Header badge with the latest verification date folded in. */
export function verifiedBadgeLabelWithDate(
  authorityCount: number,
  verifiedDateLabel: string,
): string {
  return `${verifiedBadgeLabel(authorityCount)} · ${verifiedDateLabel}`;
}

export type ProvenanceAuthorityGroup = {
  sourceCode: string;
  displayName: string;
  recordCount: number;
};

/** Group provenance rows by authority for the header verified popover. */
export function groupProvenanceAuthorities(
  rows: readonly { source_code: string; display_name: string; tier: string }[],
): ProvenanceAuthorityGroup[] {
  const map = new Map<string, ProvenanceAuthorityGroup>();
  for (const row of rows) {
    const tier = provenanceTierShort(row.tier);
    if (tier === "t4") continue;
    const existing = map.get(row.source_code);
    if (existing) {
      existing.recordCount += 1;
    } else {
      map.set(row.source_code, {
        sourceCode: row.source_code,
        displayName: row.display_name,
        recordCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Provenance tier badge slug. */
export function provenanceTierShort(tier: string): "t1" | "t2" | "t3" | "t4" {
  const t = tier.toLowerCase();
  if (t.includes("tier1") || t.includes("gov") || t.includes("regulator"))
    return "t1";
  if (t.includes("tier2") || t.includes("assoc")) return "t2";
  if (t.includes("tier4") || t.includes("brand")) return "t4";
  if (t.includes("tier3") || t.includes("cert")) return "t3";
  if (tier.includes("tier1")) return "t1";
  if (tier.includes("tier2")) return "t2";
  if (tier.includes("tier4")) return "t4";
  return "t3";
}

const TIER_GROUP_LABEL: Record<ReturnType<typeof provenanceTierShort>, string> = {
  t1: "Government",
  t2: "Trade body",
  t3: "Certifier",
  t4: "Brand list",
};

/** Plain-English stand-in for the internal "T1"/"T2" tier slug — the
 *  Provenance tab is buyer-facing, and the raw tier codes read as
 *  unexplained internal jargon there. */
export function tierGroupLabel(tier: string): string {
  return TIER_GROUP_LABEL[provenanceTierShort(tier)];
}

/** Registry pill value shown in compliance cards (official register ID). */
export function formatRegistryIdLabel(sourceCode: string): string {
  switch (sourceCode.toUpperCase()) {
    case "EPB":
      return "Export reg. no.";
    case "RJSC":
      return "RJSC no.";
    case "BIN":
      return "BIN";
    default:
      return "Registry ID";
  }
}
