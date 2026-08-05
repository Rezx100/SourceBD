import {
  ProfileCard,
  ProfileCardHeader,
  ProfileEmptyState,
  ProfileFootnote,
  ProfileKpiGrid,
  ProfileTabStack,
  type ProfileKpiItem,
} from "@/components/supplier/profile-ui";

type SupplierCapacity = {
  bepza_zone: string | null;
  factory_types: string[];
  employees_total: number | null;
  employees_male: number | null;
  employees_female: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly: number | null;
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

function buildCapacityKpis(s: SupplierCapacity): ProfileKpiItem[] {
  const wf = pickWorkforce(
    s.employees_total,
    s.employees_female,
    s.employees_male,
  );
  const items: ProfileKpiItem[] = [];

  if (wf.total != null) {
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

export function ProfileCapacityTab({ supplier: s }: { supplier: SupplierCapacity }) {
  const wf = pickWorkforce(
    s.employees_total,
    s.employees_female,
    s.employees_male,
  );
  const kpis = buildCapacityKpis(s);
  const meta =
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

export function hasCapacityData(s: SupplierCapacity): boolean {
  return (
    s.machines_sewing != null ||
    s.production_capacity_dozen_yearly != null ||
    s.production_capacity_pcs_day != null ||
    s.employees_total != null ||
    s.employees_male != null ||
    s.employees_female != null ||
    Boolean(s.bepza_zone) ||
    s.factory_types.length > 0
  );
}
