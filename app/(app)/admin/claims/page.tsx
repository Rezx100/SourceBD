// Admin claim queue (Spec S1 — minimal stub).
//
// Lists `email_verified` claims (`manual_review` method that has cleared
// email verification and is awaiting an admin decision). The full
// admin-console page lands in spec A3 (Phase 4); this stub gives admins a
// way to act on S1 traffic now.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-ink-tertiary">
            Admin
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            Supplier claims
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Manual-review claims that have cleared email verification.
            Filter: <strong>{status}</strong>.
          </p>
        </div>
        <nav className="flex gap-2 text-xs">
          {(["email_verified", "approved", "rejected", "all"] as const).map(
            (s) => (
              <Link
                key={s}
                href={`/admin/claims?status=${s}`}
                className={`rounded-pill border px-2 py-1 ${
                  s === status
                    ? "border-accent-indigo text-accent-indigo"
                    : "border-hairline text-ink-tertiary hover:text-ink-primary"
                }`}
              >
                {s.replace("_", " ")}
              </Link>
            ),
          )}
        </nav>
      </header>

      {error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-sem-red">
              Failed to load: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardMeta>{rows.length} shown</CardMeta>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No claims in this state.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/suppliers/${r.supplier.slug}`}
                        className="text-sm font-semibold text-ink-primary hover:underline"
                        target="_blank"
                      >
                        {r.supplier.company_name}
                      </Link>
                      <Tag>{r.method === "domain_email" ? "Domain" : "Manual"}</Tag>
                      <Tag>{r.status}</Tag>
                    </div>
                    <p className="text-xs text-ink-tertiary">
                      {r.supplier.entity_type.replace(/_/g, " ")} ·{" "}
                      {[r.supplier.city, r.supplier.district]
                        .filter(Boolean)
                        .join(", ") || "—"}
                      {r.supplier.website ? ` · ${r.supplier.website}` : ""}
                    </p>
                    <p className="text-xs text-ink-secondary">
                      <span className="font-mono text-ink-primary">
                        {r.proof_email}
                      </span>{" "}
                      · claimant{" "}
                      <span className="font-mono">{r.claimant_email}</span>
                    </p>
                    <p className="text-[11px] text-ink-tertiary">
                      Verified{" "}
                      {r.email_verified_at
                        ? new Date(r.email_verified_at).toLocaleString()
                        : "—"}
                      {r.decided_at
                        ? ` · decided ${new Date(r.decided_at).toLocaleString()}`
                        : ""}
                    </p>
                    {r.note ? (
                      <p className="mt-2 rounded-input border border-hairline bg-bg-l0 p-2 text-xs text-ink-secondary">
                        {r.note}
                      </p>
                    ) : null}
                    {r.decision_note ? (
                      <p className="mt-1 text-[11px] text-ink-tertiary">
                        Decision: {r.decision_note}
                      </p>
                    ) : null}
                  </div>
                  {r.status === "email_verified" ? (
                    <ClaimAdminDecideButton id={r.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
