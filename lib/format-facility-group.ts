/** REZ-73 — display formatting + allowlist sanitize for SQL group metrics. */

export type GroupMetric = {
  own: number | null;
  known_sum: number | null;
  facility_count: number;
  building_count: number;
  unknown_count: number;
};

export type FacilityRow = { name: string };

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

/** Drop anything beyond the REZ-73 allowlist before it enters the RSC tree. */
export function sanitizeFacilityPanel(raw: FacilityPanel): FacilityPanel {
  return {
    facility_count: Number(raw.facility_count) || 0,
    facilities: (raw.facilities ?? [])
      .map((f) => ({ name: String((f as FacilityRow)?.name ?? "") }))
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
