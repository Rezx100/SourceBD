// Fact row (`03 Patterns · 2`): label, value with its unit, the source in words with the
// date we checked it. A state chip shows only when something is wrong. Phone: label above
// the value at 16px, the chip under the source so nothing truncates, both figures of a
// disagreement visible. Server-safe.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SourceLine } from "./source-mark";

export type FactValue = {
  value: ReactNode;
  /** Register, member and HS numbers are the only mono text. */
  mono?: boolean;
  /** "From BGMEA · checked 24 Jul 2026". Missing means the fact has no source line yet. */
  source?: ReactNode;
};

/** `<dl>` of fact rows. Rows are at least 56 tall on desktop. */
export function FactList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col sm:border-t sm:border-line", className)}>{children}</dl>;
}

export function FactRow({
  label,
  values,
  chip,
  empty,
  className,
}: {
  label: string;
  values?: FactValue[];
  /** Only when something is wrong (a FactChip). */
  chip?: ReactNode;
  /** In place of a value when there is none: "Ask in your RFQ." */
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 border-b border-line py-3 sm:min-h-14 sm:flex-row sm:items-start sm:gap-4", className)}>
      <dt className="text-sm text-ink-3 sm:w-40 sm:shrink-0 sm:leading-5">{label}</dt>
      <dd className="flex flex-1 flex-col gap-1.5 sm:gap-2">
        {values?.length ? (
          values.map((v, i) => (
            <span key={i} className="flex flex-col gap-0.5">
              <span className={cn("text-md font-medium text-ink sm:text-base", v.mono && "font-mono")}>{v.value}</span>
              {v.source ? <SourceLine>{v.source}</SourceLine> : null}
            </span>
          ))
        ) : (
          <span className="text-md text-ink-2 sm:text-base">{empty}</span>
        )}
        {chip ? <span className="mt-0.5 self-start sm:hidden">{chip}</span> : null}
      </dd>
      {chip ? <span className="hidden shrink-0 sm:block">{chip}</span> : null}
    </div>
  );
}
