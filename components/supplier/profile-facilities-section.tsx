import {
  describeGroupMetric,
  projectFacilityGroup,
  type FacilityRollupBuilding,
  type FacilityRollupOwn,
} from "@/lib/facility-rollup";
import { formatCompanyName } from "@/lib/format-company-name";
import { toTitleCaseAddress } from "@/lib/format-location";

import { ProfileCard, ProfileCardHeader, ProfileFootnote } from "./profile-ui";

/**
 * REZ-73 — Facilities section on the mother profile (widened 8 Aug 2026:
 * the REZ-92 group roll-up renders here as separate labelled figures, never
 * one combined total, and never replacing the mother's own figures).
 *
 * Every row is one attached extension building: its own name (suffix kept —
 * that suffix is the building's identity), its own PII-stripped addresses,
 * its own registry pills, its own RSC progress. No links: a facility is
 * unpublished, its URL 308-redirects here (REZ-72), so there is nothing to
 * link to. With zero facilities the section renders nothing at all — the
 * profile is byte-identical to before B1.
 */

export type ProfileFacilityAddress = {
  kind: string;
  address: string;
  source_code: string;
  fetched_at: string;
};

export type ProfileFacilityPill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean;
  source_url: string | null;
};

export type ProfileFacilityRsc = {
  progress_pct: number | null;
  workers_count: number | null;
  remediation_status: string | null;
  training_status: string | null;
};

export type ProfileFacility = FacilityRollupBuilding & {
  addresses: ProfileFacilityAddress[];
  pills: ProfileFacilityPill[];
  rsc: ProfileFacilityRsc | null;
};

const ROLLUP_FIGURES: {
  column: keyof FacilityRollupOwn;
  label: string;
}[] = [
  { column: "employees_total", label: "Employees — group total" },
  { column: "machines_sewing", label: "Sewing machines — group total" },
  {
    column: "production_capacity_pcs_day",
    label: "Daily capacity (pcs) — group total",
  },
  {
    column: "production_capacity_dozen_yearly",
    label: "Yearly capacity (dozen) — group total",
  },
];

function FacilityRscLine({ rsc }: { rsc: ProfileFacilityRsc }) {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  const parts: string[] = [];
  if (pct != null) parts.push(`${pct.toFixed(0)}% remediated`);
  if (rsc.remediation_status) parts.push(rsc.remediation_status);
  if (parts.length === 0) return null;
  return (
    <p className="text-[13px] leading-5 text-neutral-600">
      <span className="font-semibold text-neutral-700">RSC:</span>{" "}
      {parts.join(" · ")}
    </p>
  );
}

export function ProfileFacilitiesSection({
  own,
  facilities,
}: {
  own: FacilityRollupOwn;
  facilities: readonly ProfileFacility[];
}) {
  if (facilities.length === 0) return null;

  const projection = projectFacilityGroup(own, facilities);
  const buildingCount = projection.facilityCount + 1;

  return (
    <ProfileCard id="facilities">
      <ProfileCardHeader
        title="Facilities"
        meta={`${facilities.length} extension ${
          facilities.length === 1 ? "building" : "buildings"
        } · ${buildingCount} buildings in total`}
      />

      {/* Group roll-up — separate labelled figures, each summing only
          reported values; unknowns are stated, never coerced to zero. */}
      <dl className="flex flex-col divide-y divide-neutral-100 border-t border-neutral-100">
        {ROLLUP_FIGURES.map(({ column, label }) => {
          const metric = projection.metrics[column];
          return (
            <div
              key={column}
              className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <dt className="text-[13px] font-semibold text-neutral-600">
                {label}
              </dt>
              <dd className="font-mono text-[13.5px] font-medium text-neutral-900 sm:text-right">
                {describeGroupMetric(metric)}
              </dd>
            </div>
          );
        })}
      </dl>
      <ProfileFootnote>
        Group figures add this profile&apos;s own numbers to those reported
        for each extension building. Buildings that have not reported a
        figure are counted as unknown, never as zero.
      </ProfileFootnote>

      {/* Per-building rows. Same-named siblings are a real population
          (REZ-105), so keys use the array index — the SQL orders
          deterministically by (name, id) — and duplicate display strings
          from two sources holding one address collapse to one line. */}
      <ul className="mt-5 flex flex-col gap-4 border-t border-neutral-100 pt-5">
        {facilities.map((facility, index) => {
          const name = formatCompanyName(facility.name);
          const addresses = [
            ...new Set(
              facility.addresses
                .map((a) => toTitleCaseAddress(a.address))
                .filter((a): a is string => Boolean(a)),
            ),
          ];
          return (
            <li key={`${index}:${facility.name}`} className="flex flex-col gap-1.5">
              <h3 className="text-[15px] font-semibold leading-6 text-neutral-900">
                {name}
              </h3>
              {addresses.length > 0 ? (
                <p className="text-[13px] leading-5 text-neutral-600">
                  {addresses.join(" · ")}
                </p>
              ) : null}
              {facility.pills.length > 0 ? (
                <p className="font-mono text-[12.5px] leading-5 text-neutral-500">
                  {facility.pills
                    .map((p) => (p.value ? `${p.label} ${p.value}` : p.label))
                    .join(" · ")}
                </p>
              ) : null}
              {facility.rsc ? <FacilityRscLine rsc={facility.rsc} /> : null}
            </li>
          );
        })}
      </ul>
    </ProfileCard>
  );
}
