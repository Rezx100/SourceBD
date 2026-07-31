"use client";

// Evidence worklist — grouped by company, with optimistic claim removal.
//
// The flat per-claim list was the source of two problems:
//   1. The same company appeared 8+ times in a row with no visual grouping,
//      making it hard to understand the scope of a source refresh.
//   2. After resolving one claim the page hard-refreshed, the list reordered
//      (reviewed items sort to the back) and operators couldn't tell if their
//      action had worked.
//
// This component fixes both: claims are grouped under their company header, and
// a resolved claim is removed from the local list immediately — the
// router.refresh() that follows is a background sync, not the primary feedback.

import Link from "next/link";
import { useCallback, useState } from "react";

import { AdminEvidenceDecideButton } from "@/components/admin-evidence-decide-button";
import { AdminPanel, formatAdminDate } from "@/components/admin/admin-ui";
import { Tag } from "@/components/ui/tag";
import {
  citationHref,
  claimAdvice,
  consecutiveFailures,
  isTransientlyUnreachable,
  transientReason,
  type ClaimStatus,
  type ProblemClaim,
} from "@/lib/admin/evidence";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Field label lookup — strips the scraper prefix and uses human language.
// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
  bkmea_mailing_address: "Mailing address",
  bkmea_reg_number: "Registration no.",
  bkmea_factory_address: "Factory address",
  bkmea_membership_no: "Membership no.",
  bkmea_membership_category: "Membership category",
  bkmea_employees_total: "Employees (total)",
  bkmea_employees_male: "Employees (male)",
  bkmea_employees_female: "Employees (female)",
  bkmea_machines_dyeing: "Dyeing machines",
  bkmea_machines_knitting: "Knitting machines",
  bkmea_machines_sewing: "Sewing machines",
  bkmea_production_capacity: "Production capacity",
  epb_factory_address: "Factory address",
  epb_office_address: "Office address",
  epb_reg_no: "EPB reg. no.",
  epb_logo: "Logo file",
  rsc_workers_count: "Worker count",
  rsc_factory_name: "Factory name",
  rsc_status_name: "Status",
  rsc_remediation_status: "Remediation",
  rsc_progress_pct: "Progress %",
  rsc_parent_group: "Parent group",
  rsc_parent_group_factory_count: "Group factories",
  rsc_electrical_inspection_url: "Electrical inspection",
  rsc_fire_inspection_url: "Fire inspection",
  rsc_structural_inspection_url: "Structural inspection",
  rsc_training_status: "Training status",
  rsc_cap_url: "CAP document",
};

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const stripped = key.replace(/^[a-z]+_/, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1).replace(/_/g, " ");
}

// Compact status labels for the tight single-line badge.
const COMPACT_STATUS: Record<ClaimStatus, string> = {
  active: "OK",
  stale: "Changed",
  contradicted: "Conflict",
  orphaned: "Gone",
};

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------
type CompanyGroup = {
  key: string;
  supplier: ProblemClaim["supplier"] | null;
  subject_table: string;
  claims: ProblemClaim[];
};

function groupByCompany(rows: ProblemClaim[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();
  for (const claim of rows) {
    const key = claim.supplier?.id ?? `__${claim.subject_table}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        supplier: claim.supplier ?? null,
        subject_table: claim.subject_table,
        claims: [],
      });
    }
    map.get(key)!.claims.push(claim);
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export function EvidenceClaimsList({
  rows,
  emptyDescription,
}: {
  rows: ProblemClaim[];
  emptyDescription?: string;
}) {
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(new Set());

  const handleResolved = useCallback(
    (claimId: string) => {
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.add(claimId);
        return next;
      });
      // router.refresh() is called inside AdminEvidenceDecideButton after the
      // API succeeds, so the server state will catch up asynchronously while
      // the optimistic removal makes the row vanish immediately.
    },
    [],
  );

  // Filter resolved claims out of the visible list immediately.
  const visibleRows = rows.filter((r) => !resolvedIds.has(r.claim_id));

  if (visibleRows.length === 0) {
    return (
      <AdminPanel title="Nothing to review">
        <p className="text-[14px] text-ink-secondary">
          {emptyDescription ??
            "Every citation currently checks out. Run the verify-evidence job to re-check the long tail."}
        </p>
      </AdminPanel>
    );
  }

  // Split into real data problems vs transient unreachable.
  const driftedRows = visibleRows.filter((r) => !isTransientlyUnreachable(r));
  const unreachableRows = visibleRows.filter(isTransientlyUnreachable);

  const driftedGroups = groupByCompany(driftedRows);
  const unreachableGroups = groupByCompany(unreachableRows);

  return (
    <div className="space-y-4">
      {driftedGroups.length > 0 && (
        <section>
          <div className="mb-2 px-1">
            <h3 className="text-[13px] font-semibold text-ink-primary">
              Checked and no longer supported ({driftedGroups.length}{" "}
              {driftedGroups.length === 1 ? "company" : "companies"},{" "}
              {driftedRows.length} {driftedRows.length === 1 ? "field" : "fields"})
            </h3>
            <p className="text-[13px] text-ink-secondary">
              We reached the page and the value we cited is not on it. Re-run the scraper
              to pick up current data, or retire if the field no longer exists.
            </p>
          </div>
          <div className="space-y-3">
            {driftedGroups.map((group) => (
              <CompanyClaimGroup
                key={group.key}
                group={group}
                onResolved={handleResolved}
              />
            ))}
          </div>
        </section>
      )}

      {unreachableGroups.length > 0 && (
        <section>
          <div className="mb-2 px-1">
            <h3 className="text-[13px] font-semibold text-ink-primary">
              Could not be checked ({unreachableGroups.length}{" "}
              {unreachableGroups.length === 1 ? "company" : "companies"},{" "}
              {unreachableRows.length} {unreachableRows.length === 1 ? "field" : "fields"})
            </h3>
            <p className="text-[13px] text-ink-secondary">
              The source did not answer — a timeout, block, or 5xx. The stored value is
              unchanged and its citation still stands. Re-check before treating as a data
              problem.
            </p>
          </div>
          <div className="space-y-3">
            {unreachableGroups.map((group) => (
              <CompanyClaimGroup
                key={group.key}
                group={group}
                onResolved={handleResolved}
                unreachable
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company group card
// ---------------------------------------------------------------------------
function CompanyClaimGroup({
  group,
  onResolved,
  unreachable = false,
}: {
  group: CompanyGroup;
  onResolved: (claimId: string) => void;
  unreachable?: boolean;
}) {
  const { supplier, claims, subject_table } = group;

  // Unique scrapers and tier (all claims in a group are usually from one source).
  const scrapers = [...new Set(claims.map((c) => c.evidence.scraper_code))];
  const tier = claims[0]?.source_tier;

  return (
    <AdminPanel padded={false}>
      {/* Company header row */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {supplier?.id ? (
            <Link
              href={`/admin/suppliers/${supplier.id}`}
              className="font-display text-[14px] font-semibold text-ink-primary hover:underline"
            >
              {supplier.company_name ?? "Unnamed supplier"}
            </Link>
          ) : (
            <span className="font-display text-[14px] font-semibold text-ink-primary">
              {subject_table}
            </span>
          )}
          {scrapers.map((s) => (
            <Tag key={s} tone="neutral" className="py-0.5 text-[12px]">
              {s}
            </Tag>
          ))}
          {tier != null && (
            <Tag tone="neutral" className="py-0.5 text-[12px]">
              Tier {tier}
            </Tag>
          )}
        </div>
        <span className="font-mono text-[12px] tabular-nums text-ink-tertiary">
          {claims.length} {claims.length === 1 ? "field" : "fields"}
        </span>
      </div>

      {/* Per-field claim rows */}
      <div className="divide-y divide-neutral-100">
        {claims.map((claim) => (
          <ClaimSubRow
            key={claim.claim_id}
            claim={claim}
            onResolved={onResolved}
            unreachable={unreachable}
            companyName={supplier?.company_name ?? subject_table}
          />
        ))}
      </div>
    </AdminPanel>
  );
}

// ---------------------------------------------------------------------------
// Single field row within a company group
// ---------------------------------------------------------------------------
function ClaimSubRow({
  claim,
  onResolved,
  unreachable,
  companyName,
}: {
  claim: ProblemClaim;
  onResolved: (claimId: string) => void;
  unreachable: boolean;
  companyName: string;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const isTransient = isTransientlyUnreachable(claim);
  const label = fieldLabel(claim.field_key);
  const value = claim.field_value;
  const href = citationHref(claim);
  const failures = consecutiveFailures(claim);

  // Compact status pill styling.
  const statusText = isTransient
    ? "Unchecked"
    : COMPACT_STATUS[claim.status as ClaimStatus] ?? claim.status;
  const statusClass = isTransient
    ? "bg-neutral-100 text-ink-tertiary border-neutral-200"
    : claim.status === "orphaned"
      ? "bg-sem-red-soft text-sem-red border-sem-red/25"
      : "bg-amber-50 text-amber-700 border-amber-200";

  // Short advice for the secondary line.
  const advice = isTransient
    ? `Could not reach page (${transientReason(claim) ?? "unknown reason"})${failures > 1 ? ` · ${failures} consecutive` : ""}`
    : claimAdvice(claim);

  return (
    <div>
      {/* Primary line: status + field + value + resolve */}
      <div
        className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
        onClick={() => setDetailOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen((v) => !v);
          }
        }}
        aria-expanded={detailOpen}
      >
        {/* Status badge */}
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
            statusClass,
          )}
        >
          {statusText}
        </span>

        {/* Field label */}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-primary">
          {label}
        </span>

        {/* Stored value (truncated) */}
        {value != null && value.length > 0 && (
          <span className="hidden max-w-[200px] truncate font-mono text-[12px] text-ink-tertiary sm:block">
            {value.length > 40 ? `${value.slice(0, 40)}…` : value}
          </span>
        )}

        {/* Expand chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={cn(
            "shrink-0 text-ink-tertiary transition-transform",
            detailOpen && "rotate-180",
          )}
          aria-hidden
        >
          <path
            d="M3 5l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Resolve button — stop propagation so clicking it doesn't toggle expand */}
        <span
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <AdminEvidenceDecideButton
            claimId={claim.claim_id}
            label={`${label} · ${companyName}`}
            onResolved={onResolved}
          />
        </span>
      </div>

      {/* Detail panel — expands inline, no context lost */}
      {detailOpen && (
        <div className="mx-4 mb-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
          {/* Advice sentence */}
          <p className="text-[13px] text-ink-secondary">{advice}</p>

          {/* Excerpt if available */}
          {claim.excerpt ? (
            <p className="rounded border border-neutral-200 bg-white px-2 py-1.5 font-mono text-[12px] italic text-ink-tertiary">
              &ldquo;{claim.excerpt.length > 200 ? `${claim.excerpt.slice(0, 200)}…` : claim.excerpt}&rdquo;
            </p>
          ) : (
            <p className="text-[12px] text-ink-tertiary">
              No excerpt captured — confirmed by file digest.
            </p>
          )}

          {/* Meta row: dates + http status */}
          <p className="font-mono text-[11px] text-ink-tertiary">
            {claim.locator && <span className="mr-2">{claim.locator}</span>}
            last confirmed{" "}
            {claim.last_confirmed_at ? formatAdminDate(claim.last_confirmed_at) : "never"}
            {claim.evidence.last_verified_at && (
              <> · checked {formatAdminDate(claim.evidence.last_verified_at)}</>
            )}
            {claim.evidence.http_status != null && (
              <> · HTTP {claim.evidence.http_status}</>
            )}
          </p>

          {/* Citation link */}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-mono text-[12px] text-accent-indigo hover:underline"
            >
              {claim.evidence.verify_status === "dead"
                ? `Archived snapshot (captured ${formatAdminDate(claim.evidence.fetched_at)})`
                : (claim.evidence.final_url ?? claim.evidence.url)}
            </a>
          ) : (
            <p className="truncate font-mono text-[12px] text-ink-tertiary">
              {claim.evidence.url} · no archived copy
            </p>
          )}

          {claim.review_note && (
            <p className="text-[12px] text-ink-tertiary">Note: {claim.review_note}</p>
          )}
        </div>
      )}
    </div>
  );
}
