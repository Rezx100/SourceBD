// Shapes returned by the admin_evidence_* RPCs, plus the small amount of
// judgement the console needs on top of them.
//
// The distinction this file exists to preserve is between a citation that is
// wrong and one that could not be checked. Both are "not confirmed", and
// collapsing them is how an evidence console becomes noise: a source that has
// been timing out for a week would read exactly like a registry that quietly
// deleted a factory's worker count. Only the second is a data problem.

export type ClaimStatus =
  | "active"
  | "stale"
  | "superseded"
  | "contradicted"
  | "orphaned";
export type VerifyStatus = "live" | "changed" | "dead" | "unverified";
export type FetchStatus = "ok" | "not_found" | "error" | "blocked" | "timeout";

export type EvidenceSummary = {
  documents: {
    total: number;
    live: number;
    changed: number;
    dead: number;
    unverified: number;
    oldest_unverified_at: string | null;
    verified_last_7d: number;
  };
  claims: {
    total: number;
    active: number;
    stale: number;
    /**
     * Retired because the page was fetched again, or another page agrees.
     * Deliberately absent from `needs_review` — see migration 0087.
     */
    superseded: number;
    contradicted: number;
    orphaned: number;
    needs_review: number;
    confirmed_last_7d: number;
  };
  credits: {
    last_24h: number;
    last_30d: number;
    month_to_date: number;
    all_time: number;
  };
  monitors: {
    total: number;
    enabled: number;
    erroring: number;
    last_check_at: string | null;
    pending_webhook_events: number;
  };
  generated_at: string;
};

export type EvidenceByScraperRow = {
  adapter: string | null;
  documents: number;
  last_document_at: string | null;
  dead_documents: number;
  changed_documents: number;
  unverified_documents: number;
  credits_month: number;
  credits_24h: number;
  claims: number;
  active_claims: number;
  claims_needing_review: number;
};

export type EvidenceByScraper = Record<string, EvidenceByScraperRow>;

export type ProblemClaim = {
  claim_id: string;
  status: ClaimStatus;
  field_key: string;
  field_value: string | null;
  locator: string | null;
  excerpt: string | null;
  subject_table: string;
  subject_id: string;
  source_tier: number | null;
  first_seen_at: string;
  last_confirmed_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  supplier: { id: string; slug: string | null; company_name: string | null } | null;
  evidence: {
    id: string;
    scraper_code: string;
    url: string;
    final_url: string | null;
    http_status: number | null;
    fetch_status: FetchStatus;
    verify_status: VerifyStatus;
    last_verified_at: string | null;
    fetched_at: string;
    raw_html_mirror_url: string | null;
    screenshot_mirror_url: string | null;
    file_mirror_url: string | null;
    verify_detail: Record<string, unknown> | null;
  };
};

export type ProblemClaimsPage = {
  total: number;
  limit: number;
  offset: number;
  rows: ProblemClaim[];
  generated_at: string;
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  active: "Confirmed",
  stale: "Value changed",
  superseded: "Replaced by a newer citation",
  contradicted: "Contradicted",
  orphaned: "Link gone",
};

/**
 * What an operator should actually do about a claim, in a sentence.
 *
 * Written as instructions rather than status names because the console is read
 * by whoever is on duty, not by whoever wrote the verifier.
 */
export function claimAdvice(claim: ProblemClaim): string {
  const scraper = claim.evidence.scraper_code;
  switch (claim.status) {
    case "orphaned":
      return `The page we cited returned ${claim.evidence.http_status ?? "a not-found"} and is gone. The archived snapshot still shows the value, but nothing live supports it — retire the claim, or re-run ${scraper} if the source has simply moved.`;
    case "stale":
      return `The page is still live but no longer contains this value. Re-run ${scraper} to pick up the current figure, then retire this claim if the source has dropped the field entirely.`;
    case "contradicted":
      return `Another page states something different for this same field. Check whether both records really describe this company — a supplier holding two registry records is usually a bad merge, not a source disagreement — then keep the higher tier per the source trust hierarchy.`;
    case "superseded":
      return "A newer citation replaced this one. Kept for history; no action needed.";
    case "active":
      return "Confirmed against the live page.";
  }
}

/** The best link to show an operator: the live page if it still resolves. */
export function citationHref(claim: ProblemClaim): string | null {
  if (claim.evidence.verify_status === "dead") {
    return (
      claim.evidence.raw_html_mirror_url ??
      claim.evidence.file_mirror_url ??
      claim.evidence.screenshot_mirror_url ??
      null
    );
  }
  return claim.evidence.final_url ?? claim.evidence.url;
}

/**
 * Whether a document's last check failed for reasons that say nothing about the
 * facts on it.
 *
 * Recorded by the verifier as `needs_attention` plus a transient reason. Shown
 * separately from drift so an outage cannot be mistaken for a retraction — the
 * REZ-30 lesson, carried into the UI.
 */
export function isTransientlyUnreachable(claim: ProblemClaim): boolean {
  const detail = claim.evidence.verify_detail;
  return Boolean(detail && typeof detail === "object" && "last_transient" in detail);
}

export function transientReason(claim: ProblemClaim): string | null {
  const detail = claim.evidence.verify_detail;
  if (!detail || typeof detail !== "object") return null;
  const reason = (detail as Record<string, unknown>).last_transient;
  return typeof reason === "string" ? reason : null;
}

export function consecutiveFailures(claim: ProblemClaim): number {
  const detail = claim.evidence.verify_detail;
  if (!detail || typeof detail !== "object") return 0;
  const value = (detail as Record<string, unknown>).consecutive_transient_failures;
  return typeof value === "number" ? value : 0;
}

/** Share of documents confirmed in the last 7 days, as a percentage. */
export function verifiedShare(summary: EvidenceSummary): number {
  const total = summary.documents.total;
  if (total === 0) return 0;
  return Math.round((summary.documents.verified_last_7d / total) * 100);
}

export function formatCredits(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString();
}
