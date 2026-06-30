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

/** Header chip budget — returns visible types and overflow count. */
export function factoryTypesForHeader(
  types: readonly string[],
  limit = 2,
): { visible: string[]; overflow: number } {
  const clean = types.filter(Boolean);
  if (clean.length <= limit) {
    return { visible: clean, overflow: 0 };
  }
  return { visible: clean.slice(0, limit), overflow: clean.length - limit };
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

/** Buyer-facing date format for profile tables and metadata. */
export function formatProfileDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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
