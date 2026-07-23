// Idea 5 — Authority strip mirror. One supplier header, then identical
// live authority logo rows under Buyer A and Buyer B. No twin cards.

import { ProfileSourceMark } from "@/components/supplier/profile-ui";

export type OneRecordEvidence = {
  name: string;
  entityLabel: string;
  location: string | null;
  t13: number;
  authorityCodes: string[];
};

function AuthorityRow({
  buyer,
  codes,
}: {
  buyer: string;
  codes: string[];
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-600">
        {buyer}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((code) => (
          <ProfileSourceMark
            key={`${buyer}-${code}`}
            tag={code}
            size="sm"
            className="!size-8 !rounded-md"
          />
        ))}
      </div>
    </div>
  );
}

export function OneRecordMirror({ evidence }: { evidence: OneRecordEvidence }) {
  const meta = [evidence.entityLabel, evidence.location]
    .filter(Boolean)
    .join(" · ");
  const monogram = evidence.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      role="img"
      aria-label={`Identical authority marks for ${evidence.name} under Buyer A and Buyer B`}
      className="flex w-full flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand-forest/12 bg-gradient-to-br from-brand-forest/[0.1] via-brand-forest/[0.05] to-white font-display text-[14px] font-bold text-neutral-600"
        >
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14px] font-bold leading-tight tracking-tight text-neutral-900">
            {evidence.name}
          </p>
          {meta ? (
            <p className="mt-0.5 truncate text-[12px] leading-snug text-neutral-500">
              {meta}
            </p>
          ) : null}
          <p className="mt-1 text-[12px] font-semibold tabular-nums text-brand-forest">
            Verified by {evidence.t13}{" "}
            {evidence.t13 === 1 ? "source" : "sources"}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-neutral-200/80 pt-3">
        <AuthorityRow buyer="Buyer A" codes={evidence.authorityCodes} />
        <div
          aria-hidden
          className="w-px self-stretch bg-neutral-200"
        />
        <AuthorityRow buyer="Buyer B" codes={evidence.authorityCodes} />
      </div>
    </div>
  );
}
