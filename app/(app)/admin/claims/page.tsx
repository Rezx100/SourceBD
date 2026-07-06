// Admin claim queue (Spec S1 — minimal stub).
//
// Lists `email_verified` claims (`manual_review` method that has cleared
// email verification and is awaiting an admin decision). The full
// admin-console page lands in spec A3 (Phase 4); this stub gives admins a
// way to act on S1 traffic now.

import Link from "next/link";

import {
  AdminActionLink,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminTabs,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Tag } from "@/components/ui/tag";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { ClaimAdminDecideButton } from "@/components/claim-admin-decide-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  status: string;
  method: string;
  proof_email: string;
  note: string | null;
  created_at: string;
  email_verified_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  claimant_email: string;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
    website: string | null;
  };
};

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "email_verified";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_admin_list", {
    p_status: status,
  });
  const rows = ((data as { results?: AdminRow[] } | null)?.results ??
    []) as AdminRow[];

  return (
    <AdminPage maxWidth="5xl">
      <AdminPageHeader
        kicker="Admin · Claims"
        title="Supplier claims"
        description={`Manual-review claims that have cleared email verification. Current state: ${humanizeAdminToken(status)}.`}
        actions={<AdminActionLink href="/admin/queue">Review hub</AdminActionLink>}
      />

      <AdminTabs
        label="Claim states"
        items={(["email_verified", "approved", "rejected", "all"] as const).map((s) => ({
          href: `/admin/claims?status=${s}`,
          label: humanizeAdminToken(s),
          active: s === status,
        }))}
      />

      {error ? (
        <AdminPanel>
            <p className="text-sm text-sem-red">
              Failed to load: {error.message}
            </p>
        </AdminPanel>
      ) : null}

      <AdminPanel
        title="Claim queue"
        meta={`${rows.length} shown in the current state`}
        padded={false}
      >
          {rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState title="No claims in this state" />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={CLAIM_COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              caption="Supplier claims"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>
    </AdminPage>
  );
}

const CLAIM_COLUMNS: Column<AdminRow>[] = [
  {
    key: "supplier",
    label: "Supplier",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/admin/suppliers/${r.supplier.id}`}
          className="text-sm font-semibold text-ink-primary hover:underline"
        >
          {r.supplier.company_name}
        </Link>
        <Tag>{r.method === "domain_email" ? "Domain" : "Manual"}</Tag>
        <Tag>{humanizeAdminToken(r.status)}</Tag>
      </span>
    ),
  },
  {
    key: "where",
    label: "Entity",
    render: (r) => (
      <span className="block text-xs text-ink-tertiary">
        {humanizeAdminToken(r.supplier.entity_type)} ·{" "}
        {[r.supplier.city, r.supplier.district].filter(Boolean).join(", ") ||
          "—"}
        {r.supplier.website ? ` · ${r.supplier.website}` : ""}
      </span>
    ),
  },
  {
    key: "proof",
    label: "Proof",
    render: (r) => (
      <span className="block text-xs text-ink-secondary">
        <span className="font-mono text-ink-primary">{r.proof_email}</span> ·
        claimant <span className="font-mono">{r.claimant_email}</span>
      </span>
    ),
  },
  {
    key: "meta",
    label: "Verified",
    render: (r) => (
      <span className="block text-[12px] text-ink-tertiary">
        {r.email_verified_at
          ? new Date(r.email_verified_at).toLocaleDateString()
          : "—"}
        {r.decided_at
          ? ` · decided ${new Date(r.decided_at).toLocaleDateString()}`
          : ""}
        {r.note ? <span className="block text-ink-secondary">{r.note}</span> : null}
        {r.decision_note ? (
          <span className="block">Decision: {r.decision_note}</span>
        ) : null}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    numeric: true,
    render: (r) =>
      r.status === "email_verified" ? (
        <ClaimAdminDecideButton id={r.id} label={r.supplier.company_name} />
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];

