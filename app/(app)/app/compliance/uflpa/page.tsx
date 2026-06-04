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
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      <header className="space-y-2">
        <Link
          href="/app/compliance"
          className="inline-flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink-secondary"
        >
          <ArrowLeft size={12} /> Compliance
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink-primary">
          UFLPA traceability tracker
        </h1>
        <p className="text-sm text-ink-secondary">
          Cross-references your saved suppliers against the U.S. Department of
          Homeland Security&apos;s UFLPA Entity List. A row is{" "}
          <span className="font-semibold">hit</span> when the supplier has an
          active match in <code className="font-mono text-[12px]">sanctions_screening</code>,{" "}
          <span className="font-semibold">region flag</span> when supplier
          fields mention Xinjiang/XUAR/Uyghur exposure, otherwise{" "}
          <span className="font-semibold">clear</span>.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load UFLPA tracker.
          </CardContent>
        </Card>
      ) : null}

      {payload ? (
        <section className="grid grid-cols-3 gap-4">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
                    <th className="py-2 pr-4">Supplier</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Parent group</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.rows.map((r) => (
                    <tr
                      key={r.supplier_id}
                      className="border-b border-hairline/60 last:border-0 align-top"
                    >
                      <td className="py-2 pr-4">
                        <Link
                          href={`/app/suppliers/${r.supplier_slug}`}
                          className="font-medium text-ink-primary underline-offset-2 hover:underline"
                        >
                          {r.company_name}
                        </Link>
                        <div className="text-[11px] text-ink-tertiary capitalize">
                          {r.entity_type.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-ink-secondary">
                        {[r.city, r.district, r.country]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-4 text-ink-secondary">
                        {r.parent_group_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusTag status={r.status} />
                      </td>
                      <td className="py-2">
                        {r.uflpa_hits.length === 0 ? (
                          <span className="text-[12px] text-ink-tertiary">
                            {r.status === "region_flag"
                              ? "Xinjiang-linked text in supplier fields"
                              : "No active UFLPA matches"}
                          </span>
                        ) : (
                          <ul className="space-y-1 text-[12px]">
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
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

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
      <CardContent className="flex items-center gap-3 py-4">
        <Icon size={24} weight="fill" className={color} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
            {label}
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-primary">
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
