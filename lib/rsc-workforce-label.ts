/** Pure RSC Compliance workforce labels — REZ-110 durable guards. */

/** Format RSC workforce — null stays "unknown", never coerced to "0". */
export function rscWorkforceLabel(workersCount: number | null | undefined): string {
  if (workersCount == null) return "unknown";
  return `${Number(workersCount).toLocaleString()} workers`;
}

/** Whether the RSC detail block (workforce + statuses) should render. */
export function rscDetailBlockVisible(rsc: {
  progress_pct?: number | null;
  workers_count?: number | null;
  remediation_status?: string | null;
  training_status?: string | null;
}): boolean {
  const pct =
    rsc.progress_pct != null
      ? Math.max(0, Math.min(100, Number(rsc.progress_pct)))
      : null;
  return (
    pct != null ||
    rsc.workers_count != null ||
    Boolean(rsc.remediation_status) ||
    Boolean(rsc.training_status)
  );
}
