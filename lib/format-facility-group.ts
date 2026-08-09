/** REZ-73 — display formatting for SQL group metrics (no arithmetic). */

export type GroupMetric = {
  own: number | null;
  known_sum: number | null;
  facility_count: number;
  building_count: number;
  unknown_count: number;
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
