/** REZ-114 — when to show the Capacity tab (selected workers count as data). */

export type CapacityGateSupplier = {
  machines_sewing: number | null;
  production_capacity_dozen_yearly: number | null;
  production_capacity_pcs_day: number | null;
  employees_total: number | null;
  employees_male: number | null;
  employees_female: number | null;
  bepza_zone: string | null;
  factory_types: string[];
};

export type CapacityGateWorkers = {
  value: number | null;
};

export function hasCapacityData(
  s: CapacityGateSupplier,
  workers?: CapacityGateWorkers,
): boolean {
  return (
    s.machines_sewing != null ||
    s.production_capacity_dozen_yearly != null ||
    s.production_capacity_pcs_day != null ||
    s.employees_total != null ||
    (workers !== undefined && workers.value != null) ||
    s.employees_male != null ||
    s.employees_female != null ||
    Boolean(s.bepza_zone) ||
    s.factory_types.length > 0
  );
}
