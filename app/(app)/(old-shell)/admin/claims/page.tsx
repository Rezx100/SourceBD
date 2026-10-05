// Admin claim queue (Spec S1 — minimal stub).
//
// Lists `email_verified` claims (`manual_review` method that has cleared
// email verification and is awaiting an admin decision). The full
// admin-console page lands in spec A3 (Phase 4); this stub gives admins a
// way to act on S1 traffic now.

import { Empty, InlineError, TabLink, Table, TableFrame, TableScroll, Td, Th, Tr, TypeChip } from "@/components/kit";
import {
  HeadLink,
  QueueColumn,
  QueueHead,
  SupplierLink,
  humanizeAdminToken,
} from "@/components/admin/queue-parts";
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
    <QueueColumn>
      <QueueHead
        title="Supplier claims"
        lede={`Manual-review claims that have cleared email verification. Current state: ${humanizeAdminToken(status)}.`}
        actions={<HeadLink href="/admin/queue">Review hub</HeadLink>}
      />

      <nav aria-label="Claim states" className="flex gap-1 overflow-x-auto border-b border-line">
        {(["email_verified", "approved", "rejected", "all"] as const).map((s) => (
          <TabLink key={s} href={`/admin/claims?status=${s}`} current={s === status} prefetch={false}>
            {humanizeAdminToken(s)}
          </TabLink>
        ))}
      </nav>

      {error ? <InlineError>Failed to load: {error.message}</InlineError> : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">Claim queue</h2>
          <p className="text-sm text-ink-3">{`${rows.length} shown in the current state`}</p>
        </div>
        {rows.length === 0 ? (
          <Empty title="No claims in this state" />
        ) : (
          <TableFrame>
            <TableScroll>
              <Table>
                <caption className="sr-only">Supplier claims</caption>
                <thead>
                  <tr>
                    <Th>Supplier</Th>
                    <Th>Entity</Th>
                    <Th>Proof</Th>
                    <Th>Verified</Th>
                    <Th align="right">
                      <span className="sr-only">Action</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.id} className="align-top">
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <SupplierLink id={r.supplier.id}>{r.supplier.company_name}</SupplierLink>
                          <TypeChip>{r.method === "domain_email" ? "Domain" : "Manual"}</TypeChip>
                          <TypeChip>{humanizeAdminToken(r.status)}</TypeChip>
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-3">
                          {humanizeAdminToken(r.supplier.entity_type)} ·{" "}
                          {[r.supplier.city, r.supplier.district].filter(Boolean).join(", ") || "—"}
                          {r.supplier.website ? ` · ${r.supplier.website}` : ""}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-2">
                          <span className="font-mono text-ink">{r.proof_email}</span> · claimant{" "}
                          <span className="font-mono">{r.claimant_email}</span>
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-3">
                          {r.email_verified_at ? new Date(r.email_verified_at).toLocaleDateString() : "—"}
                          {r.decided_at ? ` · decided ${new Date(r.decided_at).toLocaleDateString()}` : ""}
                          {r.note ? <span className="block text-ink-2">{r.note}</span> : null}
                          {r.decision_note ? <span className="block">Decision: {r.decision_note}</span> : null}
                        </span>
                      </Td>
                      <Td align="right">
                        {r.status === "email_verified" ? (
                          <ClaimAdminDecideButton id={r.id} label={r.supplier.company_name} />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          </TableFrame>
        )}
      </section>
    </QueueColumn>
  );
}
