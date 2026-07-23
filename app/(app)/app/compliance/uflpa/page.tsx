// UFLPA traceability tracker — Spec B9 (/app/compliance/uflpa).
//
// Server component. Calls compliance_uflpa_tracker() and renders one row
// per saved supplier with status (hit / region_flag / clear) and any
// matched DHS UFLPA entity list references.

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  ResponsiveTable,
  type Column,
} from "@/components/ui/responsive-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

type UflpaHit = {
  matched_name: string | null;
  list_entry_ref: string | null;
  screened_at: string | null;
  source_url: string | null;
  listed_date: string | null;
  entity_name: string | null;
  aliases: string[] | null;
};
type UflpaRow = {
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  country: string | null;
  parent_group_name: string | null;
  saved_at: string;
  uflpa_hits: UflpaHit[];
  status: "hit" | "region_flag" | "clear";
};
type UflpaPayload = {
  total: number;
  hits: number;
  flags: number;
  clear: number;
  rows: UflpaRow[];
};

export default async function UflpaPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compliance_uflpa_tracker");
  const payload = (data ?? null) as UflpaPayload | null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/app/compliance"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary transition-colors hover:text-ink-primary"
        >
          <ArrowLeft size={17} weight="bold" aria-hidden /> Compliance
        </Link>
        <PageHeader
          kicker="Compliance"
          title="UFLPA traceability tracker"
          description={
            <>
              Cross-references your saved suppliers against the U.S. Department of
              Homeland Security&apos;s UFLPA Entity List. A row is{" "}
              <span className="font-semibold">hit</span> when the supplier has an
              active match in <code className="font-mono text-[13px]">sanctions_screening</code>,{" "}
              <span className="font-semibold">region flag</span> when supplier
              fields mention Xinjiang/XUAR/Uyghur exposure, otherwise{" "}
              <span className="font-semibold">clear</span>.
            </>
          }
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load UFLPA tracker.
          </CardContent>
        </Card>
      ) : null}

      {payload ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <Stat
            label="Hits"
            value={payload.hits}
            tone="red"
            Icon={XCircle}
          />
          <Stat
            label="Region flags"
            value={payload.flags}
            tone="amber"
            Icon={WarningCircle}
          />
          <Stat
            label="Clear"
            value={payload.clear}
            tone="green"
            Icon={CheckCircle}
          />
        </section>
      ) : null}

      {payload && payload.total === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-ink-secondary">
            You haven&apos;t saved any suppliers yet.
          </CardContent>
        </Card>
      ) : null}

      {payload && payload.rows.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <ResponsiveTable
              mode="stacked"
              columns={UFLPA_COLUMNS}
              rows={payload.rows}
              rowKey={(r) => r.supplier_id}
              caption="UFLPA traceability"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

const UFLPA_COLUMNS: Column<UflpaRow>[] = [
  {
    key: "supplier",
    label: "Supplier",
    render: (r) => (
      <>
        <Link
          href={`/app/suppliers/${r.supplier_slug}`}
          className="font-medium text-ink-primary underline-offset-2 hover:underline"
        >
          {r.company_name}
        </Link>
        <div className="text-[12px] text-ink-tertiary capitalize">
          {r.entity_type.replace(/_/g, " ")}
        </div>
      </>
    ),
  },
  {
    key: "location",
    label: "Location",
    render: (r) => (
      <span className="text-ink-secondary">
        {[r.city, r.district, r.country].filter(Boolean).join(", ") || "—"}
      </span>
    ),
  },
  {
    key: "parent",
    label: "Parent group",
    render: (r) => (
      <span className="text-ink-secondary">{r.parent_group_name ?? "—"}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <StatusTag status={r.status} />,
  },
  {
    key: "evidence",
    label: "Evidence",
    render: (r) =>
      r.uflpa_hits.length === 0 ? (
        <span className="text-[13px] text-ink-tertiary">
          {r.status === "region_flag"
            ? "Xinjiang-linked text in supplier fields"
            : "No active UFLPA matches"}
        </span>
      ) : (
        <ul className="space-y-1 text-[13px]">
          {r.uflpa_hits.map((h, i) => (
            <li key={`${h.list_entry_ref ?? "x"}-${i}`}>
              <span className="font-medium text-ink-primary">
                {h.matched_name ?? h.entity_name ?? "match"}
              </span>
              {h.list_entry_ref ? (
                <span className="ml-1 font-mono text-ink-tertiary">
                  [{h.list_entry_ref}]
                </span>
              ) : null}
              {h.source_url ? (
                <>
                  {" "}·{" "}
                  <a
                    href={h.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-indigo underline-offset-2 hover:underline"
                  >
                    DHS entry
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ),
  },
];

type IconCmp = React.ComponentType<{
  size?: number;
  weight?: "regular" | "fill" | "duotone";
  className?: string;
}>;

function Stat({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "green";
  Icon: IconCmp;
}) {
  const color =
    tone === "red"
      ? "text-sem-red"
      : tone === "amber"
        ? "text-sem-amber"
        : "text-sem-green";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3 sm:py-4">
        <Icon size={22} weight="fill" className={color} />
        <div>
          <p className="text-[12px] text-ink-tertiary">
            {label}
          </p>
          <p className="font-display text-xl font-semibold tabular-nums text-ink-primary sm:text-2xl">
            {value.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusTag({ status }: { status: "hit" | "region_flag" | "clear" }) {
  if (status === "hit") return <Tag tone="red">Hit</Tag>;
  if (status === "region_flag") return <Tag tone="amber">Region flag</Tag>;
  return <Tag tone="green">Clear</Tag>;
}
