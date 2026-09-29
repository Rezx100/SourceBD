// Phase 7 P4 — Founder beta analytics dashboard.

import Link from "next/link";

import {
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDateTime,
} from "@/components/admin/admin-ui";
import { StatStrip } from "@/components/ui/page-kit";
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
      <AdminPage maxWidth="5xl">
        <AdminPageHeader
          kicker="Admin · Beta"
          title="Founder analytics"
          description="Signup → saved supplier → RFQ funnel and top saved suppliers."
        />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load beta dashboard{error?.message ? `: ${error.message}` : ""}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const doc = data as Doc;
  const f = doc.funnel;

  return (
    <AdminPage maxWidth="5xl" className="space-y-8">
      <AdminPageHeader
        kicker="Admin · Beta"
        title="Founder analytics"
        description="Read-only funnel over existing tables — no new ETL. Saved suppliers proxy buyer intent until a dedicated view log ships."
        actions={
          <p className="font-mono text-[12px] text-ink-tertiary">
            {formatAdminDateTime(doc.generated_at)} UTC
          </p>
        }
      />

      <StatStrip
        columns={4}
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

      <AdminPanel
        title="Top saved suppliers"
        description="Ranked by unique buyer saves (proxy for profile interest during beta)."
        padded={false}
      >
        {doc.top_saved_suppliers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-tertiary">No saves yet.</p>
        ) : (
          <ol className="m-0 divide-y divide-neutral-200 p-0">
            {doc.top_saved_suppliers.map((s, i) => (
              <li key={s.supplier_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <span className="mr-2 font-mono text-[12px] text-ink-tertiary">#{i + 1}</span>
                  <Link
                    href={`/admin/suppliers/${s.supplier_id}`}
                    className="font-medium text-brand-forest hover:underline"
                  >
                    {s.company_name}
                  </Link>
                </div>
                <span className="shrink-0 font-mono text-sm tabular-nums text-ink-primary">
                  {s.save_count.toLocaleString()} saves
                </span>
              </li>
            ))}
          </ol>
        )}
      </AdminPanel>
    </AdminPage>
  );
}
