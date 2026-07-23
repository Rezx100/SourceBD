// RSC safety-remediation band — surfaces the post-Rana-Plaza dataset the
// homepage previously never mentioned (audit gap d4).
//
// Every number is live:
//   * tracked   — discover_suppliers with p_rsc_min = 0 (published suppliers
//                 holding an active rsc_remediation row)
//   * high      — same query at p_rsc_min = 90
//   * documents — marketing_stats.compliance_documents_mirrored (passed in)
// No static aggregates from spec snapshots; if the RPC fails the section
// renders nothing rather than a guessed figure.

import { FileText, Buildings, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { Kicker } from "@/components/marketing/home/kicker";
import { fetchDiscoverTotal } from "@/components/marketing/home/discover-count";

export async function SafetyRemediationBand({
  documentsMirrored,
}: {
  documentsMirrored: number | null;
}) {
  const [tracked, high] = await Promise.all([
    fetchDiscoverTotal({ p_rsc_min: 0 }),
    fetchDiscoverTotal({ p_rsc_min: 90 }),
  ]);

  if (tracked == null || tracked === 0) return null;

  const share =
    high != null && tracked > 0
      ? Math.round((high / tracked) * 100)
      : null;

  const tiles = [
    {
      icon: <Buildings size={22} weight="duotone" aria-hidden />,
      value: tracked,
      label: "factories with active RSC remediation tracking",
    },
    high != null
      ? {
          icon: <ShieldCheck size={22} weight="duotone" aria-hidden />,
          value: high,
          label: "at 90% or higher remediation progress",
        }
      : null,
    documentsMirrored != null
      ? {
          icon: <FileText size={22} weight="duotone" aria-hidden />,
          value: documentsMirrored,
          label: "inspection documents mirrored",
        }
      : null,
  ].filter(Boolean) as { icon: React.ReactNode; value: number; label: string }[];

  return (
    <section
      aria-label="Safety remediation"
      className="border-b border-neutral-200 bg-neutral-50 py-16 md:py-20"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <Kicker>Safety, on the record</Kicker>
          <h2 className="mt-3 text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-3xl">
            Remediation progress from the RSC, factory by factory.
          </h2>
          <p className="mt-5 max-w-lg text-body leading-relaxed text-neutral-600">
            Fire, structural and electrical inspection reports, boiler
            checks and corrective-action plans are mirrored from the RMG
            Sustainability Council and attached to each factory&apos;s
            profile — with remediation progress reported as the RSC
            publishes it.
          </p>

          {share != null ? (
            <div className="mt-8 max-w-lg">
              <div
                role="img"
                aria-label={`${share}% of tracked factories are at 90% or higher remediation progress`}
                className="h-2 overflow-hidden rounded-pill bg-neutral-200"
              >
                <div
                  className="h-full rounded-pill bg-brand-forest"
                  style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-neutral-500">
                {share}% of tracked factories at 90%+ progress
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-forest-soft text-brand-forest">
                {tile.icon}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-neutral-900">
                {tile.value.toLocaleString()}
              </span>
              <span className="mt-1 text-[13px] leading-snug text-neutral-500">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
