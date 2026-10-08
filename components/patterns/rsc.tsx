// RSC block (`03 Patterns · 4`): the RSC mark, the factory number, a coverage chip, three
// facts as text (remediation, training, workers) and five report links. A missing report is a
// plain ink-3 line. Never a progress bar. Phone: the links are 48px rows. Server-safe.

import { CheckCircle, MinusCircle } from "@phosphor-icons/react/dist/ssr";
import { Chip } from "@/components/kit";
import { cn } from "@/lib/utils";
import { SourceChip } from "./source-mark";

export const RSC_REPORTS = ["Fire", "Electrical", "Structural", "Boiler", "Corrective action plan"] as const;
export type RscReportName = (typeof RSC_REPORTS)[number];

export type RscBlockData = {
  /** The RSC factory number; null when the record does not carry it, and the heading then says no number. */
  factoryId: string | null;
  covered: boolean;
  /** "42% of initial items fixed" */
  remediation: string | null;
  /** "Completed", "Yet to start" */
  training: string | null;
  /** "2,662 workers"; undefined when the record carries no RSC head count, and the row is then left out rather than said to be unpublished. */
  workers?: string | null;
  /** href per report, null when RSC lists none. */
  reports: Record<RscReportName, string | null>;
  /** "30 Jul 2026"; null when no date was recorded. */
  checkedOn: string | null;
};

const LINK =
  "rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function RscBlock({ data, className }: { data: RscBlockData; className?: string }) {
  const facts = (
    [
      ["Remediation", data.remediation],
      ["Safety training", data.training],
      ["Workers counted", data.workers],
    ] as [string, string | null | undefined][]
  ).filter(([, v]) => v !== undefined);
  return (
    <section aria-label="Safety inspections" className={cn("flex flex-col rounded-lg border border-line bg-surface", className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <SourceChip source="RSC" />
        <h3 className="min-w-0 flex-1 text-base font-semibold text-ink">Safety inspections{data.factoryId ? ` · factory ${data.factoryId}` : ""}</h3>
        {data.covered ? (
          <Chip icon={CheckCircle}>Covered by RSC</Chip>
        ) : (
          <Chip tone="caution" icon={MinusCircle}>
            No longer covered by RSC
          </Chip>
        )}
      </header>
      <dl className="flex flex-col px-4 py-1">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
            <dt className="text-sm text-ink-3 sm:w-[180px] sm:shrink-0 sm:leading-5">{label}</dt>
            <dd className="text-md font-medium text-ink sm:text-base">{value ?? <span className="font-normal text-ink-3">Not published</span>}</dd>
          </div>
        ))}
      </dl>
      <footer className="flex flex-col gap-2 border-t border-line px-4 pb-4 pt-3">
        <p className="text-xs font-medium text-ink-3">{data.covered ? "Inspection reports" : "Last inspection reports RSC published"}</p>
        <ul className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
          {RSC_REPORTS.map((name) => {
            const href = data.reports[name];
            return (
              <li key={name} className="flex min-h-12 items-center border-b border-line last:border-b-0 sm:h-6 sm:min-h-0 sm:border-b-0">
                {href ? (
                  <a href={href} className={cn(LINK, "max-sm:text-base")}>
                    {name}
                  </a>
                ) : (
                  <span className="text-sm text-ink-3 max-sm:text-base">{name === "Corrective action plan" ? "Corrective action plan: none published" : `${name}: no report published`}</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-3">{[data.factoryId ? `RSC factory ${data.factoryId}` : "RSC", data.checkedOn ? `checked ${data.checkedOn}` : null].filter(Boolean).join(" · ")}</p>
      </footer>
    </section>
  );
}
