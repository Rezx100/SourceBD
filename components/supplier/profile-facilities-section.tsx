/**
 * REZ-73 — Facilities section: building list + labelled group figures.
 * Arithmetic lives in buyer_supplier_facility_panel (SQL); this only renders.
 */
import {
  ProfileCard,
  ProfileCardHeader,
} from "@/components/supplier/profile-ui";

export type FacilityAddress = {
  kind: string;
  address: string;
  source_code: string;
};

export type FacilityPill = {
  source_code: string;
  label: string;
  value: string | null;
};

export type FacilityRow = {
  name: string;
  employees_total: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly: number | null;
  addresses: FacilityAddress[];
  rsc_progress_pct: number | null;
  pills: FacilityPill[];
};

export type GroupMetric = {
  own: number | null;
  known_sum: number | null;
  facility_count: number;
  building_count: number;
  unknown_count: number;
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

const FIGURES: {
  key: keyof FacilityPanel["group"];
  label: string;
}[] = [
  { key: "employees_total", label: "Production workers — group total" },
  { key: "machines_sewing", label: "Sewing machines — group total" },
  { key: "production_capacity_pcs_day", label: "Daily output — group total" },
  {
    key: "production_capacity_dozen_yearly",
    label: "Annual output — group total",
  },
];

/** Format a SQL group metric for display (no arithmetic). */
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

export function ProfileFacilitiesSection({ panel }: { panel: FacilityPanel }) {
  if (!panel.facilities.length) return null;
  const n = panel.facilities.length;
  return (
    <ProfileCard id="facilities">
      <ProfileCardHeader
        title="Facilities"
        meta={`${n} extension building${n === 1 ? "" : "s"} · ${n + 1} buildings in total`}
      />
      <ul className="divide-y divide-neutral-200">
        {panel.facilities.map((f) => (
          <li key={f.name} className="py-4 first:pt-0 last:pb-0">
            <p className="text-[15px] font-semibold text-neutral-900">{f.name}</p>
            {f.addresses[0]?.address ? (
              <p className="mt-1 text-[13px] text-neutral-600">
                {f.addresses[0].address}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-neutral-500">
              {f.rsc_progress_pct != null ? (
                <span>
                  {Math.max(0, Math.min(100, Number(f.rsc_progress_pct)))}%
                  remediated
                </span>
              ) : null}
              {f.pills.map((p) => (
                <span key={`${p.source_code}-${p.value ?? p.label}`}>
                  {p.label}
                  {p.value ? ` ${p.value}` : ""}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-neutral-200 pt-4">
        <p className="text-[12.5px] font-semibold text-neutral-500">
          Group figures
        </p>
        <p className="mt-1 max-w-[68ch] text-[13px] leading-5 text-neutral-500">
          Group figures add this profile&apos;s own numbers to those reported
          for the buildings above. Unknowns stay unknown — they are never
          treated as zero.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {FIGURES.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-[12px] font-semibold text-neutral-500">
                {label}
              </dt>
              <dd className="mt-0.5 text-[14px] text-neutral-800">
                {formatGroupMetric(panel.group[key])}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ProfileCard>
  );
}
