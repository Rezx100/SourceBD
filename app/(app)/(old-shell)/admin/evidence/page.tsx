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

import {
  AdminColumn,
  AdminHead,
  AdminSection,
  adminFieldClass,
  formatAdminDate,
} from "@/components/admin/data-ui";
import { EvidenceClaimsList } from "@/components/admin/evidence-claims-list";
import { Button, ButtonLink, Field, InlineError, Pagination } from "@/components/kit";
import {
  type EvidenceSummary,
  type ProblemClaimsPage,
} from "@/lib/admin/evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
      <AdminColumn>
        <EvidenceHeader />
        <InlineError>
          Could not load the evidence worklist
          {claims.error?.message ? <>: {claims.error.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const doc = claims.data as ProblemClaimsPage;
  const health = (summary.data as EvidenceSummary | null) ?? null;

  // The RPC returns all problem claims sorted with reviewed at the back.
  // We filter to unreviewed-only here so the worklist only shows actionable items.
  // The reviewed ones still exist in the DB; the operator can see them via the
  // full-detail supplier page.
  const unreviewedRows = doc.rows.filter((r) => r.reviewed_at === null);

  // Use the summary's needs_review count as the canonical "to do" number;
  // doc.total includes already-reviewed claims which are not shown.
  const needsReviewTotal = health?.claims.needs_review ?? unreviewedRows.length;

  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (n > 1) query.set("page", String(n));
    const qs = query.toString();
    return qs ? `/admin/evidence?${qs}` : "/admin/evidence";
  };

  return (
    <AdminColumn>
      <EvidenceHeader total={needsReviewTotal} />

      {health ? <HealthStrip summary={health} /> : null}

      <AdminSection
        title="Filter the worklist"
        description="Unreviewed problems only — acknowledged or re-checked claims drop out immediately."
      >
        <form method="get" action="/admin/evidence" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Problem type">
            {(a) => (
              <select {...a} name="status" defaultValue={status} className={adminFieldClass}>
                {STATUS_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_FILTER_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="flex items-end">
            <Button type="submit" kind="primary">Apply</Button>
          </div>
        </form>
      </AdminSection>

      <EvidenceClaimsList
        rows={unreviewedRows}
        emptyDescription="No unreviewed problems in the current filter. Run the verify-evidence job to re-check the long tail."
      />

      {totalPages > 1 ? (
        <Pagination
          noun="problem claims"
          from={offset + 1}
          to={offset + doc.rows.length}
          total={doc.total}
          page={page}
          pages={totalPages}
          prevHref={page > 1 ? pageHref(page - 1) : undefined}
          nextHref={page < totalPages ? pageHref(page + 1) : undefined}
        />
      ) : null}
    </AdminColumn>
  );
}

function HealthStrip({ summary }: { summary: EvidenceSummary }) {
  const { claims, documents, monitors } = summary;
  return (
    <section aria-label="Citation health" className="grid grid-cols-2 gap-4 rounded-lg border border-line p-4 sm:grid-cols-4">
      <Stat
        label="Confirmed claims"
        value={claims.active.toLocaleString()}
        hint={`of ${claims.total.toLocaleString()} total`}
      />
      <Stat
        label="Needs review"
        value={claims.needs_review.toLocaleString()}
        hint={`${claims.stale.toLocaleString()} changed · ${claims.orphaned.toLocaleString()} gone`}
        tone={claims.needs_review > 0 ? "danger" : "neutral"}
      />
      <Stat
        label="Dead pages"
        value={documents.dead.toLocaleString()}
        hint={`${documents.total.toLocaleString()} tracked`}
        tone={documents.dead > 0 ? "danger" : "neutral"}
      />
      <Stat
        label="Monitors"
        value={monitors.total === 0 ? "None" : `${monitors.enabled}/${monitors.total}`}
        hint={
          monitors.last_check_at
            ? `last check ${formatAdminDate(monitors.last_check_at)}`
            : "no check recorded"
        }
        tone={monitors.total === 0 ? "caution" : "neutral"}
      />
    </section>
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
  tone?: "neutral" | "danger" | "caution";
}) {
  return (
    <div>
      <p className="text-sm text-ink-3">{label}</p>
      <p className={cn("text-xl font-semibold tracking-tight", tone === "danger" ? "text-danger" : tone === "caution" ? "text-caution" : "text-ink")}>
        {value}
      </p>
      <p className="text-sm text-ink-3">{hint}</p>
    </div>
  );
}

function EvidenceHeader({ total }: { total?: number }) {
  return (
    <AdminHead
      title="Citation health"
      lede={`Stored facts whose citation no longer checks out against the live page.${typeof total === "number" ? ` ${total.toLocaleString()} unreviewed.` : ""} Grouped by company — click a field row to see the excerpt and source URL.`}
      actions={<ButtonLink href="/admin/sources">Sources &amp; ingestion</ButtonLink>}
    />
  );
}
