// Freshness per source on /admin/sources (spec-etl-freshness S3, §4.9): age against the
// limit its facts may reach, the last five runs, failures in a row, the last safety stop,
// credits this month and rows no longer listed. Server-safe; words in lib/admin/source-freshness.

import { AdminSection, StatusChip } from "@/components/admin/data-ui";
import { creditsWords, freshnessLines, type FreshnessDoc } from "@/lib/admin/source-freshness";

export function SourceFreshness({ doc }: { doc: FreshnessDoc | null }) {
  if (!doc) {
    return (
      <AdminSection title="Freshness">
        <p className="text-base text-ink-3">Freshness could not be read (migration 0123 applies it).</p>
      </AdminSection>
    );
  }
  const lines = freshnessLines(doc);
  return (
    <AdminSection title="Freshness" description="How old each source's facts are against the limit they may reach." meta={creditsWords(doc)} flush>
      <ul>
        {lines.map((l) => (
          <li key={l.code} className="grid grid-cols-1 gap-1 border-b border-line px-4 py-2 last:border-b-0 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,140px)] sm:items-center sm:gap-4">
            <span className="font-mono text-sm text-ink">{l.code}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              {l.tone === "danger" || l.tone === "caution" ? <StatusChip tone={l.tone}>{l.age}</StatusChip> : <span className={l.tone === "quiet" ? "text-ink-3" : undefined}>{l.age}</span>}
              {[l.failures, l.breaker, l.removed, l.credits].filter(Boolean).map((w) => (
                <span key={w} className="text-ink-3">
                  · {w}
                </span>
              ))}
            </span>
            <span className="flex justify-between gap-2 font-mono text-xs text-ink-3 sm:flex-col sm:items-end">
              <span>{l.cadence}</span>
              <span aria-label="Last five runs, newest first">{l.runs}</span>
            </span>
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}
