// Admin dashboard — Spec A1 (/admin).
//
// Calls `public.admin_dashboard()` (migration 0037) under the caller's
// session and renders aggregate platform stats. Aggregate counts only —
// the RPC excludes SBI numerics, contact PII, message bodies and claim
// secrets, and this file consumes only the keys the RPC exposes.
//
// Role gating: middleware enforces `/admin/*` is admin-only; the RPC
// re-checks role internally and raises `insufficient_privilege` for
// non-admin / anon (which surfaces as a Postgres error here → handled
// by the error tile below).

import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Chip, FactChip, InlineError, TypeChip, ringInset } from "@/components/kit";
import {
  FigureList,
  QueueColumn,
  QueueHead,
  QueueSection,
  StatRow,
} from "@/components/admin/queue-parts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Users = {
  total: number;
  by_role: Record<string, number>;
  signups_7d: number;
  signups_30d: number;
};

type Suppliers = {
  total: number;
  published: number;
  claimed: number;
  sanctioned: number;
  by_entity_type: Record<string, number>;
  tier_coverage: {
    has_tier1: number;
    has_tier2: number;
    has_tier3: number;
    tier13_ge_1: number;
    tier13_ge_2: number;
    tier13_ge_3: number;
  };
};

type Rfqs = { open: number; accepted_30d: number; closed_30d: number };
type Messages = { threads: number; messages_7d: number };
type SavedSuppliers = { total: number };

type Queues = {
  claims_pending: number;
  sanctions_active: number;
  verification_queue_total: number;
  verification_queue_by_type: Record<string, number>;
};

type DataMoat = {
  source_records_by_source: Array<{ code: string; count: number }>;
  certifications_by_kind: Array<{ kind: string; count: number }>;
  compliance_documents: { count: number; total_bytes: number };
};

type Doc = {
  users: Users;
  suppliers: Suppliers;
  rfqs: Rfqs;
  messages: Messages;
  saved_suppliers: SavedSuppliers;
  queues: Queues;
  data_moat: DataMoat;
  generated_at: string;
};

const LEDE = "Platform-wide stats, moderation queues and verified index coverage.";

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_dashboard");

  if (error || data == null) {
    return (
      <QueueColumn>
        <QueueHead title="Overview" lede={LEDE} />
        <InlineError>
          Could not load admin dashboard
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </QueueColumn>
    );
  }

  const doc = data as Doc;

  return (
    <QueueColumn>
      <QueueHead
        title="Overview"
        lede={LEDE}
        actions={
          <p className="font-mono text-sm text-ink-3">
            generated{" "}
            {new Date(doc.generated_at).toISOString().replace("T", " ").slice(0, 19)} UTC
          </p>
        }
      />

      <StatRow
        items={[
          {
            label: "Users",
            value: doc.users.total,
            hint: `+${doc.users.signups_7d} last 7 days`,
          },
          {
            label: "Suppliers published",
            value: doc.suppliers.published,
            hint: `${doc.suppliers.total.toLocaleString()} total · ${doc.suppliers.claimed.toLocaleString()} claimed`,
          },
          {
            label: "Open RFQs",
            value: doc.rfqs.open,
            hint: `${doc.rfqs.accepted_30d} accepted · ${doc.rfqs.closed_30d} closed (30d)`,
          },
          {
            label: "Message threads",
            value: doc.messages.threads,
            hint: `${doc.messages.messages_7d.toLocaleString()} messages last 7d`,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QueueSection title="Users by role" meta="Buyer, supplier, and admin accounts">
          <FigureList
            rows={[
              ["Admins", doc.users.by_role.admin ?? 0],
              ["Buyers", doc.users.by_role.buyer ?? 0],
              ["Suppliers", doc.users.by_role.supplier ?? 0],
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <TypeChip>Saved-supplier rows: {doc.saved_suppliers.total.toLocaleString()}</TypeChip>
          </div>
        </QueueSection>

        <QueueSection title="Suppliers" meta="entity type · tier-source coverage">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-ink-3">By entity type</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(doc.suppliers.by_entity_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([et, n]) => (
                    <TypeChip key={et}>
                      {et}: {n.toLocaleString()}
                    </TypeChip>
                  ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-ink-3">Tier-source coverage</p>
              <FigureList
                rows={[
                  ["≥1 Tier 1–3 source", doc.suppliers.tier_coverage.tier13_ge_1],
                  ["≥2 Tier 1–3 sources", doc.suppliers.tier_coverage.tier13_ge_2],
                  ["≥3 Tier 1–3 sources", doc.suppliers.tier_coverage.tier13_ge_3],
                  ["Has any Tier 1 (gov)", doc.suppliers.tier_coverage.has_tier1],
                  ["Has any Tier 2 (industry)", doc.suppliers.tier_coverage.has_tier2],
                  ["Has any Tier 3 (cert)", doc.suppliers.tier_coverage.has_tier3],
                ]}
              />
            </div>
            {doc.suppliers.sanctioned > 0 ? (
              <FactChip state="disagree">
                Sanctioned: {doc.suppliers.sanctioned.toLocaleString()}
              </FactChip>
            ) : null}
          </div>
        </QueueSection>

        <QueueSection title="Queues" meta="pending admin action">
          <ul className="m-0 flex list-none flex-col p-0">
            <QueueRow
              label="Claim requests"
              value={doc.queues.claims_pending}
              href="/admin/claims"
            />
            <QueueRow
              label="Sanctions hits (active)"
              value={doc.queues.sanctions_active}
              href="/admin/sanctions"
              review={doc.queues.sanctions_active > 0}
            />
            <QueueRow
              label="Verification queue (total)"
              value={doc.queues.verification_queue_total}
              href="/admin/queue"
              review={doc.queues.verification_queue_total > 0}
            />
            {Object.entries(doc.queues.verification_queue_by_type)
              .sort(([, a], [, b]) => b - a)
              .map(([qt, n]) => (
                <QueueRow
                  key={qt}
                  label={`  · ${qt.replace(/_/g, " ")}`}
                  value={n}
                  href={`/admin/queue?type=${encodeURIComponent(qt)}`}
                  indent
                />
              ))}
          </ul>
        </QueueSection>

        <QueueSection title="Compliance documents" meta="mirrored to Bunny CDN">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-3">Documents</span>
              <span className="text-2xl font-semibold tabular-nums text-ink">
                {doc.data_moat.compliance_documents.count.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-3">Total mirrored</span>
              <span className="text-md font-semibold tabular-nums text-ink">
                {formatBytes(doc.data_moat.compliance_documents.total_bytes)}
              </span>
            </div>
          </div>
        </QueueSection>

        <QueueSection title="Source records by source" meta="active rows only">
          <CountList rows={doc.data_moat.source_records_by_source.map((r) => [r.code, r.count])} />
        </QueueSection>

        <QueueSection title="Certifications by kind" meta="Verified supplier certifications">
          <CountList rows={doc.data_moat.certifications_by_kind.map((r) => [r.kind, r.count])} />
        </QueueSection>
      </div>
    </QueueColumn>
  );
}

function CountList({ rows }: { rows: ReadonlyArray<readonly [string, number]> }) {
  if (rows.length === 0) {
    return <p className="text-base text-ink-3">No rows.</p>;
  }
  return <FigureList rows={rows} mono />;
}

function QueueRow({
  label,
  value,
  href,
  review,
  indent,
}: {
  label: string;
  value: number;
  href: string;
  review?: boolean;
  indent?: boolean;
}) {
  const displayLabel = label
    .replace("group parent review", "Group / parent review")
    .replace("fuzzy match review", "Fuzzy supplier match review")
    .replace("brand disclosure match review", "Brand disclosure review")
    .replace("cert doc review", "Certification document review")
    .replace("claim review", "Supplier claim review")
    .replace("sanctions hit", "Sanctions hit review");
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between gap-3 border-b border-line px-1 py-2 text-base text-ink outline-none hover:bg-brand-wash",
          ringInset,
          indent && "pl-4 text-ink-2",
        )}
      >
        <span className="flex items-center gap-2">
          {displayLabel}
          {review && value > 0 ? (
            <Chip tone="caution" icon={Warning}>
              review
            </Chip>
          ) : null}
        </span>
        <span className="font-mono tabular-nums text-ink">{value.toLocaleString()}</span>
      </Link>
    </li>
  );
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
