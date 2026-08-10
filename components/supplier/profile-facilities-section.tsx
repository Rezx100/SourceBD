/**
 * REZ-73 — Facilities section: building list + labelled group figures.
 * Arithmetic lives in buyer_supplier_facility_panel (SQL); this only renders.
 */
import {
  ProfileCard,
  ProfileCardHeader,
} from "@/components/supplier/profile-ui";
import {
  formatGroupMetric,
  type FacilityPanel,
} from "@/lib/format-facility-group";

export type { FacilityPanel, FacilityRow } from "@/lib/format-facility-group";
export { sanitizeFacilityPanel } from "@/lib/format-facility-group";

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

export function ProfileFacilitiesSection({ panel }: { panel: FacilityPanel }) {
  if (!panel.facilities.length) return null;
  const n = panel.facilities.length;
  const buildings = panel.group.employees_total.building_count;
  return (
    <ProfileCard id="facilities">
      <ProfileCardHeader
        title="Facilities"
        meta={`${n} extension building${n === 1 ? "" : "s"} · ${buildings} buildings in total`}
      />
      <ul className="divide-y divide-neutral-200">
        {panel.facilities.map((f, i) => (
          <li key={`${f.name}-${i}`} className="py-4 first:pt-0 last:pb-0">
            <p className="text-[15px] font-semibold text-neutral-900">{f.name}</p>
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
