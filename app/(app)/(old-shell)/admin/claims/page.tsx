// Admin claim queue (Spec S1; 0129: the whole claim, not only the verified ones).
//
// Default: every open claim (waiting for its email, or verified and waiting for the admin). Each row names
// who is claiming, with a link to their user file, how far the verification email got (the email journal
// row for this claim, and whether the link has expired), and offers Resend and a decision at any open
// stage. Every write goes through the 0129 RPCs, which re-check the admin role and the reason rules.

import Link from "next/link";

import { Empty, InlineError, TabLink, Table, TableFrame, TableScroll, Td, Th, Tr, TypeChip, linkClass } from "@/components/kit";
import {
  HeadLink,
  QueueColumn,
  QueueHead,
  SupplierLink,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/queue-parts";
import { ClaimAdminDecideButton } from "@/components/claim-admin-decide-button";
import { ClaimAdminResendButton } from "@/components/claim-admin-resend-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EmailJournal = { status: "sent" | "failed"; error: string | null; sent_at: string; template: string } | null;

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
  /** 0129: the link to the user file. Absent on a row from before the migration. */
  claimant_user_id?: string | null;
  token_expires_at?: string | null;
  link_expired?: boolean | null;
  email?: EmailJournal;
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

const STATES = ["open", "pending_email", "email_verified", "approved", "rejected", "all"] as const;
type State = (typeof STATES)[number];

const STATE_LABEL: Record<State, string> = {
  open: "Open",
  pending_email: "Waiting for the email",
  email_verified: "Email Verified",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};

const LEDE = "Who is claiming which company, how far the email proof got, and the decision.";

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "open";
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
        lede={`${LEDE} Showing: ${stateLabel(status)}.`}
        actions={<HeadLink href="/admin/queue">Review hub</HeadLink>}
      />

      <nav aria-label="Claim states" className="flex gap-1 overflow-x-auto border-b border-line">
        {STATES.map((s) => (
          <TabLink key={s} href={s === "open" ? "/admin/claims" : `/admin/claims?status=${s}`} current={s === status} prefetch={false}>
            {STATE_LABEL[s]}
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
                    <Th>Claimant</Th>
                    <Th>Verification email</Th>
                    <Th>Dates</Th>
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
                        <span className="block text-sm text-ink-3">
                          {humanizeAdminToken(r.supplier.entity_type)} ·{" "}
                          {[r.supplier.city, r.supplier.district].filter(Boolean).join(", ") || "—"}
                          {r.supplier.website ? ` · ${r.supplier.website}` : ""}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-2">
                          {r.claimant_user_id ? (
                            <Link href={`/admin/users/${r.claimant_user_id}`} className={cn(linkClass, "font-mono text-sm")}>
                              {r.claimant_email}
                            </Link>
                          ) : (
                            <span className="font-mono">{r.claimant_email}</span>
                          )}
                          <span className="block text-ink-3">
                            proof <span className="font-mono text-ink">{r.proof_email}</span>
                          </span>
                          {r.note ? <span className="block text-ink-2">{r.note}</span> : null}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-2">{emailWords(r)}</span>
                        <span className="block text-sm text-ink-3">{linkWords(r)}</span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-3">
                          Started {formatAdminDateTime(r.created_at)}
                          {r.email_verified_at ? <span className="block">Verified {formatAdminDateTime(r.email_verified_at)}</span> : null}
                          {r.decided_at ? <span className="block">Decided {formatAdminDateTime(r.decided_at)}</span> : null}
                          {r.decision_note ? <span className="block text-ink-2">Decision: {r.decision_note}</span> : null}
                        </span>
                      </Td>
                      <Td align="right">
                        <RowActions r={r} />
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

function RowActions({ r }: { r: AdminRow }) {
  const waiting = r.status === "pending_email" || r.status === "expired";
  if (!waiting && r.status !== "email_verified") return <span className="text-ink-3">—</span>;
  return (
    <span className="flex flex-col items-end gap-2">
      {waiting ? <ClaimAdminResendButton id={r.id} /> : null}
      <ClaimAdminDecideButton
        id={r.id}
        label={r.supplier.company_name}
        stage={r.status === "email_verified" ? "email_verified" : r.status === "expired" ? "expired" : "pending_email"}
      />
    </span>
  );
}

/** What became of the verification email, from the journal row the claim's id points at. */
function emailWords(r: AdminRow): string {
  const e = r.email;
  if (!e) {
    return r.status === "pending_email" || r.status === "expired"
      ? "No record of the email (sent before the journal, or never sent)"
      : "No record of the email";
  }
  if (e.status === "sent") return `Sent ${formatAdminDateTime(e.sent_at)}`;
  return `Failed ${formatAdminDateTime(e.sent_at)}: ${e.error ?? "unknown"}`;
}

/** Whether the link can still be clicked. */
function linkWords(r: AdminRow): string {
  if (r.status === "pending_email" && r.link_expired) return `Link expired ${formatAdminDateTime(r.token_expires_at)}`;
  if (r.status === "pending_email" && r.token_expires_at) return `Link expires ${formatAdminDateTime(r.token_expires_at)}`;
  if (r.status === "expired") return "Link expired";
  return "";
}

function stateLabel(status: string): string {
  return (STATES as readonly string[]).includes(status) ? STATE_LABEL[status as State] : humanizeAdminToken(status);
}
