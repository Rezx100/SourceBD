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

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_dashboard");

  if (error || data == null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminHeader />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load admin dashboard
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const doc = data as Doc;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminHeader generatedAt={doc.generated_at} />

      <section
        aria-label="Headline stats"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile
          label="Users"
          value={doc.users.total}
          meta={`+${doc.users.signups_7d} last 7d · +${doc.users.signups_30d} last 30d`}
        />
        <StatTile
          label="Suppliers (published)"
          value={doc.suppliers.published}
          meta={`${doc.suppliers.total.toLocaleString()} total · ${doc.suppliers.claimed.toLocaleString()} claimed`}
        />
        <StatTile
          label="Open RFQs"
          value={doc.rfqs.open}
          meta={`${doc.rfqs.accepted_30d} accepted · ${doc.rfqs.closed_30d} closed (30d)`}
        />
        <StatTile
          label="Message threads"
          value={doc.messages.threads}
          meta={`${doc.messages.messages_7d.toLocaleString()} messages last 7d`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
            <CardMeta>public.profiles</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <KvList
              rows={[
                ["Admins",    doc.users.by_role.admin    ?? 0],
                ["Buyers",    doc.users.by_role.buyer    ?? 0],
                ["Suppliers", doc.users.by_role.supplier ?? 0],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Tag tone="muted">Saved-supplier rows: {doc.saved_suppliers.total.toLocaleString()}</Tag>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardMeta>entity type · tier-source coverage</CardMeta>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div>
              <p className="text-[11px] text-ink-tertiary">
                By entity type
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                {Object.entries(doc.suppliers.by_entity_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([et, n]) => (
                    <Badge key={et} tone={et === "factory" ? "active" : "neutral"}>
                      {et}: {n.toLocaleString()}
                    </Badge>
                  ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-ink-tertiary">
                Tier-source coverage
              </p>
              <KvList
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
              <Tag tone="red">
                Sanctioned: {doc.suppliers.sanctioned.toLocaleString()}
              </Tag>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Queues</CardTitle>
            <CardMeta>pending admin action</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="m-0 flex list-none flex-col p-0">
              <QueueRow
                label="Claim requests"
                value={doc.queues.claims_pending}
                href="/admin/claims"
              />
              <QueueRow
                label="Sanctions hits (active)"
                value={doc.queues.sanctions_active}
                tone={doc.queues.sanctions_active > 0 ? "amber" : "neutral"}
              />
              <QueueRow
                label="Verification queue (total)"
                value={doc.queues.verification_queue_total}
                tone={doc.queues.verification_queue_total > 0 ? "amber" : "neutral"}
              />
              {Object.entries(doc.queues.verification_queue_by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([qt, n]) => (
                  <QueueRow
                    key={qt}
                    label={`  · ${qt.replace(/_/g, " ")}`}
                    value={n}
                    indent
                  />
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance documents</CardTitle>
            <CardMeta>mirrored to Bunny CDN</CardMeta>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-ink-tertiary">
                Documents
              </span>
              <span className="font-display text-2xl font-semibold tabular-nums text-ink-primary">
                {doc.data_moat.compliance_documents.count.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-ink-tertiary">
                Total mirrored
              </span>
              <span className="font-display text-base font-semibold tabular-nums text-ink-primary">
                {formatBytes(doc.data_moat.compliance_documents.total_bytes)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source records by source</CardTitle>
            <CardMeta>active rows only</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <CountList rows={doc.data_moat.source_records_by_source.map(r => [r.code, r.count])} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certifications by kind</CardTitle>
            <CardMeta>public.certifications</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <CountList rows={doc.data_moat.certifications_by_kind.map(r => [r.kind, r.count])} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function AdminHeader({ generatedAt }: { generatedAt?: string }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] text-ink-tertiary">
          Admin
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Overview
        </h1>
      </div>
      {generatedAt ? (
        <p className="font-mono text-[11px] text-ink-tertiary">
          generated {new Date(generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC
        </p>
      ) : null}
    </header>
  );
}

function StatTile({
  label,
  value,
  meta,
}: {
  label: string;
  value: number;
  meta: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-[11px] text-ink-tertiary">
          {label}
        </p>
        <p className="font-display text-3xl font-semibold tabular-nums text-ink-primary">
          {value.toLocaleString()}
        </p>
        <p className="text-[12px] text-ink-tertiary">{meta}</p>
      </CardContent>
    </Card>
  );
}

function KvList({ rows }: { rows: ReadonlyArray<readonly [string, number]> }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
      {rows.map(([k, v]) => (
        <li key={k} className="flex items-baseline justify-between gap-3">
          <span className="text-ink-secondary">{k}</span>
          <span className="font-mono tabular-nums text-ink-primary">
            {v.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CountList({ rows }: { rows: ReadonlyArray<readonly [string, number]> }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-ink-tertiary">No rows.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
      {rows.map(([k, v]) => (
        <li
          key={k}
          className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-b-0"
        >
          <span className="font-mono text-[12px] text-ink-secondary">{k}</span>
          <span className="font-mono tabular-nums text-ink-primary">
            {v.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function QueueRow({
  label,
  value,
  href,
  tone,
  indent,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "amber" | "neutral";
  indent?: boolean;
}) {
  const valueNode = (
    <span className="font-mono tabular-nums text-ink-primary">
      {value.toLocaleString()}
    </span>
  );
  const inner = (
    <div
      className={
        "flex items-center justify-between gap-3 border-b border-hairline px-1 py-2 text-[13px] last:border-b-0" +
        (indent ? " pl-4 text-ink-secondary" : "")
      }
    >
      <span>
        {label}
        {tone === "amber" && value > 0 ? (
          <span className="ml-2 inline-block">
            <Tag tone="amber">review</Tag>
          </span>
        ) : null}
      </span>
      {valueNode}
    </div>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="block rounded-input transition hover:bg-bg-l1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
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
