/**
 * REZ-73 / REZ-109 / REZ-114 — Facilities section: buildings + group figures.
 * Worker group totals come from profile-metrics (via workersGroupLabel), not
 * panel.group.employees_total declared mix.
 */
import {
  ProfileCard,
  ProfileCardHeader,
} from "@/components/supplier/profile-ui";
import { formatCompanyName } from "@/lib/format-company-name";
import {
  formatGroupMetric,
  type FacilityPanel,
  type FacilityRsc,
} from "@/lib/format-facility-group";
import { toTitleCaseAddress } from "@/lib/format-location";

export type { FacilityPanel, FacilityRow } from "@/lib/format-facility-group";
export { sanitizeFacilityPanel } from "@/lib/format-facility-group";

const CAPACITY_FIGURES: {
  key: Exclude<keyof FacilityPanel["group"], "employees_total">;
  label: string;
}[] = [
  { key: "machines_sewing", label: "Sewing machines — group total" },
  { key: "production_capacity_pcs_day", label: "Daily output — group total" },
  {
    key: "production_capacity_dozen_yearly",
    label: "Annual output — group total",
  },
];

function FacilityRscLine({ rsc }: { rsc: FacilityRsc }) {
  const raw =
    rsc.progress_pct == null ? null : Number(rsc.progress_pct);
  const pct =
    raw != null && Number.isFinite(raw)
      ? Math.max(0, Math.min(100, raw))
      : null;
  const parts: string[] = [];
  if (pct != null) parts.push(`${pct.toFixed(0)}% remediated`);
  if (rsc.remediation_status) parts.push(rsc.remediation_status);
  if (parts.length === 0) return null;
  return (
    <p className="mt-1 text-[13px] leading-5 text-neutral-600">
      <span className="font-semibold text-neutral-700">RSC:</span>{" "}
      {parts.join(" · ")}
    </p>
  );
}

export function FacilitiesUnavailable() {
  return (
    <p
      data-facilities-error=""
      className="text-[14px] leading-6 text-neutral-600"
    >
      Facilities could not load just now.
    </p>
  );
}

export function ProfileFacilitiesSection({
  panel,
  workersGroupLabel,
}: {
  panel: FacilityPanel;
  /** REZ-114 — formatWorkersHeadline result; never panel.group.employees_total. */
  workersGroupLabel?: string;
}) {
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
        {panel.facilities.map((f, i) => {
          const addresses = [
            ...new Set(
              f.addresses
                .map((a) => toTitleCaseAddress(a.address))
                .filter((a): a is string => Boolean(a)),
            ),
          ];
          return (
            <li key={`${f.name}-${i}`} className="py-4 first:pt-0 last:pb-0">
              <p className="text-[15px] font-semibold text-neutral-900">
                {formatCompanyName(f.name)}
              </p>
              {addresses.length > 0 ? (
                <p className="mt-1 text-[13px] leading-5 text-neutral-600">
                  {addresses.join(" · ")}
                </p>
              ) : null}
              {f.pills.length > 0 ? (
                <p className="mt-1 font-mono text-[12.5px] leading-5 text-neutral-500">
                  {f.pills
                    .map((p) => (p.value ? `${p.label} ${p.value}` : p.label))
                    .join(" · ")}
                </p>
              ) : null}
              {f.rsc ? <FacilityRscLine rsc={f.rsc} /> : null}
            </li>
          );
        })}
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
          <div>
            <dt className="text-[12px] font-semibold text-neutral-500">
              Production workers — group total
            </dt>
            <dd className="mt-0.5 text-[14px] text-neutral-800">
              {workersGroupLabel ?? "Unknown"}
            </dd>
          </div>
          {CAPACITY_FIGURES.map(({ key, label }) => (
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
