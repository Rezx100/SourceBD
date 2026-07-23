import { SourcesExplainer } from "@/components/supplier/sources-explainer";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileEvidenceRow,
  ProfileSourceMark,
  ProfileStatusBadge,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import {
  formatProfileDate,
  formatProvenanceRef,
  tierGroupLabel,
  trustLine,
} from "@/lib/format-supplier-profile";

export type ProvenanceRow = {
  source_code: string;
  display_name: string;
  tier: string;
  source_ref: string | null;
  source_url?: string | null;
  last_seen_at: string;
};

export function ProfileProvenanceTab({
  provenance,
  t13SourceCount,
}: {
  provenance: readonly ProvenanceRow[];
  /** Same authority count shown in the header + Overview card — keeps the
   *  canonical trust line consistent everywhere it's quoted. */
  t13SourceCount: number;
}) {
  return (
    <ProfileTabStack>
      <ProfileCard id="provenance">
        <ProfileCardHeader
          title="Source records"
          meta={trustLine(t13SourceCount, provenance.length)}
        />
        <div>
            {provenance.map((p, i) => {
              const refLabel = formatProvenanceRef(p.source_code, p.source_ref);
              return (
                <ProfileEvidenceRow
                  key={i}
                  pillAlign="top"
                  mark={<ProfileSourceMark tag={p.source_code} label={p.display_name} />}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{p.display_name}</span>
                      <span className="font-mono text-[13px] font-semibold text-neutral-500">
                        {p.source_code}
                      </span>
                    </span>
                  }
                  meta={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {refLabel ? (
                        <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-neutral-700">
                          Ref {refLabel}
                        </span>
                      ) : null}
                      <span className="font-mono">
                        Last verified {formatProfileDate(p.last_seen_at)}
                      </span>
                    </span>
                  }
                  status={
                    <ProfileStatusBadge tone="neutral">{tierGroupLabel(p.tier)}</ProfileStatusBadge>
                  }
                />
              );
            })}
        </div>
        <SourcesExplainer variant="footer" />
      </ProfileCard>
    </ProfileTabStack>
  );
}
