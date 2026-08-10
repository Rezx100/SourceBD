import {
  ProfileCard,
  ProfileCardHeader,
  ProfileEmptyState,
  ProfileFootnote,
  ProfileKpiGrid,
  ProfileTabStack,
  type ProfileKpiItem,
} from "@/components/supplier/profile-ui";
import {
  hasCapacityData as hasCapacityDataGate,
  type CapacityGateSupplier,
} from "@/lib/has-capacity-data";
import type { WorkerSource } from "@/lib/profile-metrics";

type SupplierCapacity = CapacityGateSupplier;

/** REZ-114 — selected workers headline (never raw employees_total alone). */
export type CapacityWorkersProp = {
  value: number | null;
  caption: string;
  source: WorkerSource | null;
};

function pickWorkforce(
  total: number | null,
  female: number | null,
  male: number | null,
): {
  total: number | null;
  femaleCount: number | null;
  maleCount: number | null;
  femalePct: number | null;
  showGenderSplit: boolean;
  note: string | null;
} {
  const t = total != null && total > 0 ? total : null;
  const f = female != null && female > 0 ? female : null;
  const m = male != null && male > 0 ? male : null;

  if (t == null && f == null && m == null) {
    return {
      total: null,
      femaleCount: null,
      maleCount: null,
      femalePct: null,
      showGenderSplit: false,
      note: null,
    };
  }

  if (t != null && f != null && m != null) {
    // Cross-source consistency guard — keep it. employees_total and
    // employees_male/female each win their column independently (highest trust,
    // then most recent), so the total can come from BKMEA while the split comes
    // from BGMEA. When the split cannot account for the total the split is not
    // describable, so it is withheld rather than shown against a total it
    // contradicts. This is what suppressed coast-to-coast's split while
    // employees_total was inflated to 1,360 against 510 + 200 (REZ-95).
    const sum = f + m;
    const ratio = sum / t;
    if (ratio < 0.9 || ratio > 1.1) {
      return {
        total: t,
        femaleCount: null,
        maleCount: null,
        femalePct: null,
        showGenderSplit: false,
        note: "gender split unavailable",
      };
    }
    return {
      total: t,
      femaleCount: f,
      maleCount: m,
      femalePct: Math.round((f / t) * 100),
      showGenderSplit: true,
      note: null,
    };
  }

  if (t != null && f != null && m == null) {
    if (f > t) {
      return {
        total: t,
        femaleCount: null,
        maleCount: null,
        femalePct: null,
        showGenderSplit: false,
        note: "gender split unavailable",
      };
    }
    return {
      total: t,
      femaleCount: f,
      maleCount: t - f > 0 ? t - f : null,
      femalePct: Math.round((f / t) * 100),
      showGenderSplit: true,
      note: null,
    };
  }

  if (t != null && m != null && f == null) {
    if (m > t) {
      return {
        total: t,
        femaleCount: null,
        maleCount: null,
        femalePct: null,
        showGenderSplit: false,
        note: "gender split unavailable",
      };
    }
    return {
      total: t,
      femaleCount: t - m > 0 ? t - m : null,
      maleCount: m,
      femalePct: t > 0 ? Math.round(((t - m) / t) * 100) : null,
      showGenderSplit: true,
      note: null,
    };
  }

  if (t == null && f != null && m != null) {
    const inferred = f + m;
    return {
      total: inferred,
      femaleCount: f,
      maleCount: m,
      femalePct: Math.round((f / inferred) * 100),
      showGenderSplit: true,
      note: "total inferred",
    };
  }

  return {
    total: t,
    femaleCount: null,
    maleCount: null,
    femalePct: null,
    showGenderSplit: false,
    note: null,
  };
}

function buildCapacityKpis(
  s: SupplierCapacity,
  workers?: CapacityWorkersProp,
): ProfileKpiItem[] {
  const useSelected = workers !== undefined;
  // When RSC is the selected authority, gender split is from registry and
  // must not be shown against an RSC total.
  const suppressGender = useSelected && workers.source === "RSC";
  const wf = suppressGender
    ? {
        total: workers.value,
        femaleCount: null,
        maleCount: null,
        femalePct: null,
        showGenderSplit: false,
        note: null as string | null,
      }
    : pickWorkforce(
        useSelected ? workers.value : s.employees_total,
        s.employees_female,
        s.employees_male,
      );

  // Selected path: headline total is always workers.value (Unknown when null).
  // Legacy path (no workers prop): keep prior omit-when-null behaviour.
  if (useSelected) {
    wf.total = workers.value;
    if (workers.value == null) {
      wf.showGenderSplit = false;
      wf.femaleCount = null;
      wf.maleCount = null;
      wf.femalePct = null;
    }
  }

  const items: ProfileKpiItem[] = [];

  if (useSelected) {
    items.push({
      key: "workforce-total",
      label: "Production workers",
      value: workers.value != null ? workers.value.toLocaleString() : "Unknown",
      numValue: workers.value ?? undefined,
    });
  } else if (wf.total != null) {
    items.push({
      key: "workforce-total",
      // The figure is Employee Male + Employee Female, so it excludes staff.
      // "Total workforce" / "workers + staff" both claimed otherwise (REZ-95).
      label: "Production workers",
      value: wf.total.toLocaleString(),
      numValue: wf.total,
    });
  }
  if (wf.showGenderSplit && wf.femalePct != null) {
    items.push({
      key: "workforce-female",
      label: "Female share",
      value: `${wf.femalePct}%`,
      sub:
        wf.femaleCount != null
          ? `${wf.femaleCount.toLocaleString()} workers`
          : undefined,
    });
  }
  if (wf.showGenderSplit && wf.maleCount != null) {
    items.push({
      key: "workforce-male",
      label: "Male workers",
      value: wf.maleCount.toLocaleString(),
      numValue: wf.maleCount,
    });
  }
  if (s.machines_sewing != null) {
    items.push({
      key: "sewing",
      label: "Sewing machines",
      value: s.machines_sewing.toLocaleString(),
      numValue: s.machines_sewing,
    });
  }
  if (s.production_capacity_pcs_day != null) {
    items.push({
      key: "daily",
      label: "Daily output",
      value: s.production_capacity_pcs_day.toLocaleString(),
      numValue: s.production_capacity_pcs_day,
      sub: "pieces / day",
    });
  }
  if (s.production_capacity_dozen_yearly != null) {
    items.push({
      key: "yearly",
      label: "Annual output",
      value: s.production_capacity_dozen_yearly.toLocaleString(),
      numValue: s.production_capacity_dozen_yearly,
      sub: "dozen / year",
    });
  }
  if (s.bepza_zone) {
    items.push({
      key: "epz",
      label: "EPZ zone",
      value: s.bepza_zone,
    });
  }
  return items;
}

export function ProfileCapacityTab({
  supplier: s,
  workers,
}: {
  supplier: SupplierCapacity;
  /** REZ-114 — when provided, KPI total uses this (not raw employees_total). */
  workers?: CapacityWorkersProp;
}) {
  const useSelected = workers !== undefined;
  const suppressGender = useSelected && workers.source === "RSC";
  const wf = suppressGender
    ? {
        total: workers.value,
        femaleCount: null,
        maleCount: null,
        femalePct: null,
        showGenderSplit: false,
        note: null as string | null,
      }
    : pickWorkforce(
        useSelected ? workers.value : s.employees_total,
        s.employees_female,
        s.employees_male,
      );
  const kpis = buildCapacityKpis(s, workers);
  const meta =
    (useSelected && workers.caption ? workers.caption : null) ??
    wf.note ??
    (kpis.length > 0 || s.factory_types.length > 0
      ? "self-disclosed · registry sources"
      : "no data on file");

  return (
    <ProfileTabStack>
      <ProfileCard>
        <ProfileCardHeader title="Capacity & workforce" meta={meta} />
        {kpis.length > 0 || s.factory_types.length > 0 ? (
          <>
            <ProfileKpiGrid items={kpis} />
            {s.factory_types.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.factory_types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-[13px] font-semibold text-neutral-600"
                  >
                    {type}
                  </span>
                ))}
              </div>
            ) : null}
            <ProfileFootnote>
              Capacity figures are rendered only when a source provides them;
              SourceBD does not infer throughput from partial fields.
            </ProfileFootnote>
          </>
        ) : (
          <ProfileEmptyState>
            No workforce, output, or site capacity data is on file for this
            supplier yet. Registry sources may add figures after the next sync.
          </ProfileEmptyState>
        )}
      </ProfileCard>
    </ProfileTabStack>
  );
}

export function hasCapacityData(
  s: SupplierCapacity,
  workers?: CapacityWorkersProp,
): boolean {
  return hasCapacityDataGate(s, workers);
}
