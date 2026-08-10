/** REZ-73/109 — display formatting + allowlist sanitize for facility panel. */

export type GroupMetric = {
  own: number | null;
  known_sum: number | null;
  facility_count: number;
  building_count: number;
  unknown_count: number;
};

export type FacilityAddress = {
  kind: string;
  address: string;
  source_code: string;
};

export type FacilityPill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean;
  source_url: string | null;
};

export type FacilityRsc = {
  progress_pct: number | null;
  workers_count: number | null;
  remediation_status: string | null;
  training_status: string | null;
};

export type FacilityRow = {
  name: string;
  addresses: FacilityAddress[];
  pills: FacilityPill[];
  rsc: FacilityRsc | null;
};

export type FacilityPanel = {
  facility_count: number;
  facilities: FacilityRow[];
  group: {
    employees_total: GroupMetric;
    machines_sewing: GroupMetric;
    production_capacity_pcs_day: GroupMetric;
    production_capacity_dozen_yearly: GroupMetric;
  };
};

export function formatGroupMetric(m: GroupMetric): string {
  const n = (v: number) => v.toLocaleString("en-US");
  if (m.facility_count === 0) {
    return m.own == null ? "unknown" : n(m.own);
  }
  if (m.known_sum == null) {
    return `unknown across ${m.building_count} buildings, ${m.unknown_count} unknown`;
  }
  if (m.unknown_count > 0) {
    return `at least ${n(m.known_sum)} across ${m.building_count} buildings, ${m.unknown_count} unknown`;
  }
  return `${n(m.known_sum)} across ${m.building_count} buildings`;
}

function sanitizeAddresses(raw: unknown): FacilityAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: FacilityAddress[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const address = String(r.address ?? "").trim();
    if (!address) continue;
    out.push({
      kind: String(r.kind ?? ""),
      address,
      source_code: String(r.source_code ?? ""),
    });
  }
  return out;
}

function sanitizePills(raw: unknown): FacilityPill[] {
  if (!Array.isArray(raw)) return [];
  const out: FacilityPill[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    out.push({
      source_code: String(r.source_code ?? ""),
      label: String(r.label ?? ""),
      value: r.value == null ? null : String(r.value),
      verified: Boolean(r.verified),
      source_url: r.source_url == null ? null : String(r.source_url),
    });
  }
  return out;
}

function sanitizeRsc(raw: unknown): FacilityRsc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    progress_pct:
      r.progress_pct == null || r.progress_pct === ""
        ? null
        : Number(r.progress_pct),
    workers_count:
      r.workers_count == null || r.workers_count === ""
        ? null
        : Number(r.workers_count),
    remediation_status:
      r.remediation_status == null ? null : String(r.remediation_status),
    training_status:
      r.training_status == null ? null : String(r.training_status),
  };
}

/** Drop anything beyond the allowlist before it enters the RSC tree. */
export function sanitizeFacilityPanel(raw: FacilityPanel): FacilityPanel {
  return {
    facility_count: Number(raw.facility_count) || 0,
    facilities: (raw.facilities ?? [])
      .map((f) => {
        const row = f as FacilityRow & Record<string, unknown>;
        return {
          name: String(row?.name ?? ""),
          addresses: sanitizeAddresses(row?.addresses),
          pills: sanitizePills(row?.pills),
          rsc: sanitizeRsc(row?.rsc),
        };
      })
      .filter((f) => f.name),
    group: {
      employees_total: raw.group.employees_total,
      machines_sewing: raw.group.machines_sewing,
      production_capacity_pcs_day: raw.group.production_capacity_pcs_day,
      production_capacity_dozen_yearly:
        raw.group.production_capacity_dozen_yearly,
    },
  };
}
