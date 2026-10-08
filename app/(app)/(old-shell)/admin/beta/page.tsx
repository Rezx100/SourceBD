// Phase 7 P4 — Founder beta analytics dashboard.

import Link from "next/link";

import { Empty, InlineError } from "@/components/kit";
import {
  QueueColumn,
  QueueHead,
  QueueSection,
  StatRow,
  formatAdminDateTime,
} from "@/components/admin/queue-parts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Funnel = {
  signups_total: number;
  signups_7d: number;
  signups_30d: number;
  with_saved_supplier: number;
  with_rfq: number;
  signup_to_saved_pct: number;
  signup_to_rfq_pct: number;
};

type TopSupplier = {
  supplier_id: string;
  company_name: string;
  slug: string;
  save_count: number;
};

type Doc = {
  funnel: Funnel;
  top_saved_suppliers: TopSupplier[];
  generated_at: string;
};

export default async function AdminBetaPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_beta_dashboard", {});

  if (error || !data) {
    return (
      <QueueColumn>
        <QueueHead
          title="Founder analytics"
          lede="Signup → saved supplier → RFQ funnel and top saved suppliers."
        />
        <InlineError>
          Could not load beta dashboard{error?.message ? `: ${error.message}` : ""}.
        </InlineError>
      </QueueColumn>
    );
  }

  const doc = data as Doc;
  const f = doc.funnel;

  return (
    <QueueColumn>
      <QueueHead
        title="Founder analytics"
        lede="Read-only funnel over existing tables — no new ETL. Saved suppliers proxy buyer intent until a dedicated view log ships."
        actions={
          <p className="font-mono text-sm text-ink-3">
            {formatAdminDateTime(doc.generated_at)} UTC
          </p>
        }
      />

      <StatRow
        items={[
          { label: "Buyer signups (total)", value: f.signups_total },
          { label: "Signups (7d)", value: f.signups_7d },
          {
            label: "Saved ≥1 supplier",
            value: f.with_saved_supplier,
            hint: `${f.signup_to_saved_pct}% of signups`,
          },
          {
            label: "Created ≥1 RFQ",
            value: f.with_rfq,
            hint: `${f.signup_to_rfq_pct}% of signups`,
          },
        ]}
      />

      <QueueSection
        title="Top saved suppliers"
        meta="Ranked by unique buyer saves (proxy for profile interest during beta)."
        bare
      >
        {doc.top_saved_suppliers.length === 0 ? (
          <Empty title="No saves yet." />
        ) : (
          <ol className="m-0 list-none divide-y divide-line rounded-md border border-line p-0">
            {doc.top_saved_suppliers.map((s, i) => (
              <li key={s.supplier_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="mr-2 font-mono text-sm text-ink-3">#{i + 1}</span>
                  <Link
                    href={`/admin/suppliers/${s.supplier_id}`}
                    className="rounded-sm font-medium text-brand-ink underline decoration-1 hover:decoration-2"
                  >
                    {s.company_name}
                  </Link>
                </div>
                <span className="shrink-0 font-mono text-base tabular-nums text-ink">
                  {s.save_count.toLocaleString()} saves
                </span>
              </li>
            ))}
          </ol>
        )}
      </QueueSection>
    </QueueColumn>
  );
}
