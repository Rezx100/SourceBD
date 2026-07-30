// Admin evidence worklist — citations that no longer check out.
//
// Every stored fact carries a URL, a locator and a verbatim excerpt, and the
// verifier re-reads them. This page is where the failures land. It exists because
// a green scraper run and a healthy citation are different things: BGMEA can
// return 200 every night while the row we cited for a factory's worker count
// quietly disappears, and only one of those is visible in a run report.
//
// The organising principle is the distinction the verifier is careful to keep and
// the UI must not lose: "we checked and the fact is gone" is a data problem,
// "we could not reach the page" is an operations problem. They are separated
// visually and given different first actions, because treating an outage as a
// retraction is how a data moat quietly loses facts it still has evidence for.

import Link from "next/link";

import { AdminEvidenceDecideButton } from "@/components/admin-evidence-decide-button";
import {
  ADMIN_SELECT_CLASS,
  AdminActionLink,
  AdminEmptyState,
  AdminField,
  AdminFilterPanel,
  AdminPage,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  formatAdminDate,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  CLAIM_STATUS_LABELS,
  citationHref,
  claimAdvice,
  consecutiveFailures,
  isTransientlyUnreachable,
  transientReason,
  type ClaimStatus,
  type EvidenceSummary,
  type ProblemClaim,
  type ProblemClaimsPage,
} from "@/lib/admin/evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUS_FILTERS = ["all", "stale", "orphaned", "contradicted"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All problems",
  stale: "Value changed",
  orphaned: "Link gone",
  contradicted: "Contradicted",
};

function asStr(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function asInt(value: string | string[] | undefined): number | null {
  const raw = asStr(value);
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function AdminEvidencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = asStr(sp.status) || "all";
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(statusRaw)
    ? (statusRaw as StatusFilter)
    : "all";
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const [claims, summary] = await Promise.all([
    supabase.rpc("admin_evidence_problem_claims", {
      p_status: status === "all" ? null : status,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc("admin_evidence_summary"),
  ]);

  if (claims.error || claims.data == null) {
    return (
      <AdminPage maxWidth="5xl">
        <EvidenceHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load the evidence worklist
            {claims.error?.message ? <>: {claims.error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const doc = claims.data as ProblemClaimsPage;
  const health = (summary.data as EvidenceSummary | null) ?? null;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  // Two piles, because they call for different actions. A page we could not
  // reach needs a re-check or a look at the source; a fact that has actually
  // moved needs a scraper run or a retirement.
  const unreachable = doc.rows.filter(isTransientlyUnreachable);
  const drifted = doc.rows.filter((row) => !isTransientlyUnreachable(row));

  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (n > 1) query.set("page", String(n));
    const qs = query.toString();
    return qs ? `/admin/evidence?${qs}` : "/admin/evidence";
  };

  return (
    <AdminPage maxWidth="5xl">
      <EvidenceHeader total={doc.total} />

      {health ? <HealthStrip summary={health} /> : null}

      <AdminFilterPanel
        title="Filter the worklist"
        description="Unreviewed problems come first, most recently changed at the top."
      >
        <form
          method="get"
          action="/admin/evidence"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <AdminField label="Problem type">
            <select name="status" defaultValue={status} className={ADMIN_SELECT_CLASS}>
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_FILTER_LABELS[value]}
                </option>
              ))}
            </select>
          </AdminField>
          <div className="flex items-end">
            <button
              type="submit"
              className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
            >
              Apply
            </button>
          </div>
        </form>
      </AdminFilterPanel>

      {doc.rows.length === 0 ? (
        <AdminPanel title="Nothing to review">
          <AdminEmptyState
            title="Every citation currently checks out"
            description="No stored fact is missing from the page it was cited on. Run the verify-evidence job to re-check the long tail."
          />
        </AdminPanel>
      ) : null}

      {unreachable.length > 0 ? (
        <AdminPanel
          title={`Could not be checked (${unreachable.length})`}
          description="The source did not answer at check time — a timeout, a block, or a 5xx. This says nothing about whether the fact is still published, so the stored value and its citation are untouched. Re-check, or look at why the source is refusing us."
          padded={false}
        >
          <div className="divide-y divide-neutral-200">
            {unreachable.map((claim) => (
              <ClaimRow key={claim.claim_id} claim={claim} unreachable />
            ))}
          </div>
        </AdminPanel>
      ) : null}

      {drifted.length > 0 ? (
        <AdminPanel
          title={`Checked and no longer supported (${drifted.length})`}
          description="We reached the page and the value we cited is not on it. These are real data problems: the fact is being asserted on evidence that no longer holds."
          padded={false}
        >
          <div className="divide-y divide-neutral-200">
            {drifted.map((claim) => (
              <ClaimRow key={claim.claim_id} claim={claim} />
            ))}
          </div>
        </AdminPanel>
      ) : null}

      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

function HealthStrip({ summary }: { summary: EvidenceSummary }) {
  const { claims, documents, monitors } = summary;
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
        <Stat
          label="Confirmed claims"
          value={claims.active.toLocaleString()}
          hint={`of ${claims.total.toLocaleString()}`}
        />
        <Stat
          label="Needs review"
          value={claims.needs_review.toLocaleString()}
          hint={`${claims.stale.toLocaleString()} changed · ${claims.orphaned.toLocaleString()} gone`}
          tone={claims.needs_review > 0 ? "red" : "green"}
        />
        <Stat
          label="Dead pages"
          value={documents.dead.toLocaleString()}
          hint={`${documents.total.toLocaleString()} tracked`}
          tone={documents.dead > 0 ? "red" : "green"}
        />
        <Stat
          label="Monitors on"
          value={
            monitors.total === 0 ? "None" : `${monitors.enabled}/${monitors.total}`
          }
          hint={
            monitors.last_check_at
              ? `last check ${formatAdminDate(monitors.last_check_at)}`
              : "no check recorded"
          }
          tone={monitors.total === 0 ? "amber" : "neutral"}
        />
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "green" | "red" | "amber";
}) {
  const colour =
    tone === "red"
      ? "text-sem-red"
      : tone === "green"
        ? "text-sem-green"
        : tone === "amber"
          ? "text-sem-amber"
          : "text-ink-primary";
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
        {label}
      </p>
      <p className={`font-display text-xl font-semibold tracking-[-0.02em] ${colour}`}>
        {value}
      </p>
      <p className="font-mono text-[12px] text-ink-tertiary">{hint}</p>
    </div>
  );
}

function ClaimRow({
  claim,
  unreachable = false,
}: {
  claim: ProblemClaim;
  unreachable?: boolean;
}) {
  const href = citationHref(claim);
  const isArchived = claim.evidence.verify_status === "dead";
  const failures = consecutiveFailures(claim);

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {claim.supplier?.id ? (
            <Link
              href={`/admin/suppliers/${claim.supplier.id}`}
              className="text-sm font-semibold text-ink-primary hover:underline"
            >
              {claim.supplier.company_name ?? "Unnamed supplier"}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-ink-primary">
              {claim.subject_table}
            </span>
          )}
          <Badge tone={unreachable ? "neutral" : "alert"}>
            {unreachable ? "unchecked" : CLAIM_STATUS_LABELS[claim.status as ClaimStatus]}
          </Badge>
          <Tag tone="neutral">{claim.evidence.scraper_code}</Tag>
          {claim.source_tier != null ? <Tag>Tier {claim.source_tier}</Tag> : null}
          {claim.reviewed_at ? <Tag tone="muted">reviewed</Tag> : null}
        </div>

        <p className="font-mono text-[13px] text-ink-secondary">
          {claim.field_key} = {claim.field_value ?? "—"}
        </p>

        {claim.excerpt ? (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-[13px] italic text-ink-secondary">
            &ldquo;{claim.excerpt}&rdquo;
          </p>
        ) : (
          <p className="text-[13px] text-ink-tertiary">
            No excerpt was captured for this claim — it is confirmed by file digest
            rather than by quoting text.
          </p>
        )}

        <p className="text-[13px] text-ink-secondary">
          {unreachable
            ? `The last ${failures || 1} check${failures === 1 ? "" : "s"} could not reach the page (${transientReason(claim) ?? "unknown reason"}). The stored value is unchanged and its citation still stands; nothing has been retired.`
            : claimAdvice(claim)}
        </p>

        <p className="font-mono text-[12px] text-ink-tertiary">
          {claim.locator ? <>{claim.locator} · </> : null}
          last confirmed{" "}
          {claim.last_confirmed_at ? formatAdminDate(claim.last_confirmed_at) : "never"}
          {claim.evidence.last_verified_at ? (
            <> · last checked {formatAdminDate(claim.evidence.last_verified_at)}</>
          ) : null}
          {claim.evidence.http_status != null ? (
            <> · HTTP {claim.evidence.http_status}</>
          ) : null}
        </p>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-mono text-[12px] text-accent-indigo hover:underline"
          >
            {isArchived
              ? `archived snapshot (page captured ${formatAdminDate(claim.evidence.fetched_at)})`
              : claim.evidence.final_url ?? claim.evidence.url}
          </a>
        ) : (
          <p className="font-mono text-[12px] text-ink-tertiary">
            {claim.evidence.url} · no archived copy available
          </p>
        )}

        {claim.review_note ? (
          <p className="text-[13px] text-ink-tertiary">Note: {claim.review_note}</p>
        ) : null}
      </div>

      <div className="shrink-0">
        <AdminEvidenceDecideButton
          claimId={claim.claim_id}
          label={`${claim.field_key} · ${claim.evidence.scraper_code}`}
        />
      </div>
    </div>
  );
}

function EvidenceHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Evidence"
      title="Citation health"
      description={`Stored facts whose citation no longer checks out against the live page.${typeof total === "number" ? ` ${total} in the current filter.` : ""} A page we could not reach is listed separately from a fact that has actually moved.`}
      actions={<AdminActionLink href="/admin/sources">Sources &amp; ingestion</AdminActionLink>}
    />
  );
}
