/**
 * Pure grouping helpers for Compliance tab building sections (REZ-111).
 * Display-only — does not change discover, pills RPC, or source_records.
 */

/** Normalise REZ-110 array or legacy single RSC object from the profile RPC. */
export function asRscSites<T extends object>(raw: unknown): T[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw as T[]) : null;
  }
  if (typeof raw === "object") return [raw as T];
  return null;
}

export const MAIN_PLANT_LABEL = "Main plant";

/** Stable key + buyer-facing label for a building_name field. */
export function buildingGroupKey(buildingName: string | null | undefined): {
  key: string;
  label: string;
} {
  const trimmed = buildingName?.trim() || "";
  if (!trimmed) return { key: "__main__", label: MAIN_PLANT_LABEL };
  return { key: trimmed.toLowerCase(), label: trimmed };
}

export type BuildingGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

/**
 * Group rows by building_name. Main plant (no building_name) first, then
 * buildings in first-seen order. Empty input → empty array.
 */
export function groupByBuilding<T extends { building_name?: string | null }>(
  rows: readonly T[],
): BuildingGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, BuildingGroup<T>>();
  for (const row of rows) {
    const { key, label } = buildingGroupKey(row.building_name);
    let g = map.get(key);
    if (!g) {
      g = { key, label, items: [] };
      map.set(key, g);
      order.push(key);
    }
    g.items.push(row);
  }
  // Main plant first when present
  order.sort((a, b) => {
    if (a === "__main__") return -1;
    if (b === "__main__") return 1;
    return 0;
  });
  return order.map((k) => map.get(k)!);
}

/** Clamp RSC progress for display; null/NaN stay null. */
export function rscProgressPct(
  progressPct: number | null | undefined,
): number | null {
  if (progressPct == null) return null;
  const n = Number(progressPct);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function shouldShowBuildingSectionHeading(
  groupCount: number,
  groupKey: string,
): boolean {
  return groupCount > 1 || groupKey !== "__main__";
}

/**
 * RSC row title: suppress "Main plant" when there is only one unlabelled site
 * (mirrors Registries/Docs heading gate).
 */
export function rscRowTitle(
  buildingName: string | null | undefined,
  siteCount: number,
): string | null {
  const { key, label } = buildingGroupKey(buildingName);
  if (siteCount <= 1 && key === "__main__") return null;
  return label;
}

/** Short site label for compact RSC rows (always returns a string). */
export function rscSiteLabel(
  buildingName: string | null | undefined,
): string {
  return buildingGroupKey(buildingName).label;
}
