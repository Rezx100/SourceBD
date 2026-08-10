/**
 * REZ-114 — single selection + aggregation API for workers, machines, capacity.
 * Pure functions only. RSC is authority when present (not REZ-101 floor).
 */

export type WorkerSource = "RSC" | "registry";

export type SiteWorkerInput = {
  label: string;
  employees_total: number | null;
  /** Active RSC workers_count; null = no RSC authority for this site. */
  rsc_workers_count: number | null;
  rsc_fetched_at?: string | null;
};

export type SelectedWorkers = {
  value: number | null;
  source: WorkerSource | null;
  fetchedAt: string | null;
};

export type GroupWorkersMode = "group" | "unknown" | "per_site";

export type SiteWorkersSelection = SelectedWorkers & { label: string };

export type GroupWorkersResult = {
  value: number | null;
  source: WorkerSource | null;
  mode: GroupWorkersMode;
  includedCount: number;
  totalCount: number;
  excludedLabels: string[];
  sites: SiteWorkersSelection[];
  fetchedAt: string | null;
};

/** Same shape as format-facility-group GroupMetric (null ≠ 0). */
export type GroupMetric = {
  own: number | null;
  known_sum: number | null;
  facility_count: number;
  building_count: number;
  unknown_count: number;
};

export type OwnMetric = { value: number | null };

/** Site: RSC when present → else registry → else null. Never invent. Never mix. */
export function selectSiteWorkers(site: SiteWorkerInput): SelectedWorkers {
  if (site.rsc_workers_count != null) {
    return {
      value: site.rsc_workers_count,
      source: "RSC",
      fetchedAt: site.rsc_fetched_at ?? null,
    };
  }
  if (site.employees_total != null) {
    return { value: site.employees_total, source: "registry", fetchedAt: null };
  }
  return { value: null, source: null, fetchedAt: null };
}

/**
 * Mother + buildings: one source only. Prefer RSC sum when any RSC exists;
 * else registry sum. Coverage N of M; excluded labels listed. Never RSC+registry.
 */
export function groupWorkers(sites: SiteWorkerInput[]): GroupWorkersResult {
  const selected: SiteWorkersSelection[] = sites.map((s) => ({
    label: s.label,
    ...selectSiteWorkers(s),
  }));
  const totalCount = selected.length;

  if (totalCount === 0) {
    return emptyGroup("per_site", selected);
  }

  if (selected.every((s) => s.value == null)) {
    return {
      value: null,
      source: null,
      mode: "unknown",
      includedCount: 0,
      totalCount,
      excludedLabels: selected.map((s) => s.label),
      sites: selected,
      fetchedAt: null,
    };
  }

  const preferRsc = selected.some((s) => s.source === "RSC");
  const source: WorkerSource = preferRsc ? "RSC" : "registry";
  const included = selected.filter((s) => s.source === source);
  const excludedLabels = selected
    .filter((s) => s.source !== source)
    .map((s) => s.label);

  if (included.length === 0) {
    return {
      value: null,
      source: null,
      mode: "per_site",
      includedCount: 0,
      totalCount,
      excludedLabels: selected.map((s) => s.label),
      sites: selected,
      fetchedAt: null,
    };
  }

  let value = 0;
  let fetchedAt: string | null = null;
  for (const s of included) {
    value += s.value as number;
    if (s.fetchedAt && (!fetchedAt || s.fetchedAt > fetchedAt)) {
      fetchedAt = s.fetchedAt;
    }
  }

  return {
    value,
    source,
    mode: "group",
    includedCount: included.length,
    totalCount,
    excludedLabels,
    sites: selected,
    fetchedAt: source === "RSC" ? fetchedAt : null,
  };
}

/** Mother alone = site selection; mother with buildings = group result. */
export function headlineWorkers(
  mother: SiteWorkerInput,
  buildings: SiteWorkerInput[] = [],
): SelectedWorkers | GroupWorkersResult {
  if (buildings.length === 0) return selectSiteWorkers(mother);
  return groupWorkers([mother, ...buildings]);
}

export function formatWorkersHeadline(group: GroupWorkersResult): string {
  if (group.mode === "unknown" || group.value == null) {
    if (group.mode === "per_site") return "Per-site figures";
    return unknownWorkersLabel();
  }
  const n = group.value.toLocaleString("en-US");
  return `${n} across ${group.includedCount} of ${group.totalCount} sites`;
}

export function formatSourceLabel(
  source: WorkerSource | null,
  fetchedAt?: string | null,
): string {
  if (!source) return "";
  if (source === "registry") return "registry";
  if (!fetchedAt) return "RSC";
  const d = formatFetchDate(fetchedAt);
  return d ? `RSC · fetched ${d}` : "RSC";
}

export function unknownWorkersLabel(): string {
  return "Unknown";
}

/** Observable header/card text for the Production workers fact. */
export function formatProfileWorkersFact(workers: {
  value: number | null;
  caption: string;
}): { valueText: string; caption: string } {
  return {
    valueText:
      workers.value != null
        ? workers.value.toLocaleString("en-US")
        : unknownWorkersLabel(),
    caption: workers.caption,
  };
}

/** True when result is a group aggregate (mother + buildings). */
export function isGroupWorkers(
  h: SelectedWorkers | GroupWorkersResult,
): h is GroupWorkersResult {
  return "mode" in h && "totalCount" in h;
}

/** Display value for header / capacity: group sum or site value. */
export function workersDisplayValue(
  h: SelectedWorkers | GroupWorkersResult,
): number | null {
  return h.value;
}

/** Caption under the number: source + optional coverage. */
export function workersCaption(
  h: SelectedWorkers | GroupWorkersResult,
): string {
  if (h.value == null) {
    return "No authority has published a workforce figure";
  }
  const src = formatSourceLabel(h.source, h.fetchedAt);
  if (isGroupWorkers(h) && h.totalCount > 1) {
    const cov = `${h.includedCount} of ${h.totalCount} sites`;
    const excl =
      h.excludedLabels.length > 0
        ? ` · excluded: ${h.excludedLabels.join(", ")}`
        : "";
    return src ? `${src} · ${cov}${excl}` : `${cov}${excl}`;
  }
  return src;
}

/** Aggregate machines/capacity: null ≠ 0; unknown_count tracks missing sites. */
export function aggregateGroupMetric(
  own: number | null,
  buildings: Array<number | null>,
): GroupMetric {
  const all = [own, ...buildings];
  let known_sum: number | null = null;
  let unknown_count = 0;
  for (const v of all) {
    if (v == null) unknown_count += 1;
    else known_sum = (known_sum ?? 0) + v;
  }
  return {
    own,
    known_sum,
    facility_count: buildings.length,
    building_count: all.length,
    unknown_count,
  };
}

/** Mother's own figure stays visible alongside the group total. */
export function selectOwnMachine(own: number | null): OwnMetric {
  return { value: own };
}

/** Lower bound when unknown_count > 0; never treat null as 0. */
export function formatMachineGroup(m: GroupMetric): string {
  const n = (v: number) => v.toLocaleString("en-US");
  if (m.facility_count === 0) {
    return m.own == null ? unknownWorkersLabel().toLowerCase() : n(m.own);
  }
  if (m.known_sum == null) {
    return `unknown across ${m.building_count} sites, ${m.unknown_count} unknown`;
  }
  if (m.unknown_count > 0) {
    return `at least ${n(m.known_sum)} across ${m.building_count} sites, ${m.unknown_count} unknown`;
  }
  return `${n(m.known_sum)} across ${m.building_count} sites`;
}

function emptyGroup(
  mode: GroupWorkersMode,
  sites: SiteWorkersSelection[],
): GroupWorkersResult {
  return {
    value: null,
    source: null,
    mode,
    includedCount: 0,
    totalCount: sites.length,
    excludedLabels: [],
    sites,
    fetchedAt: null,
  };
}

function formatFetchDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
