import { SourcesExplainer } from "@/components/supplier/sources-explainer";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import {
  formatProfileDate,
  formatProvenanceRef,
  provenanceTierShort,
} from "@/lib/format-supplier-profile";

export type ProvenanceRow = {
  source_code: string;
  display_name: string;
  tier: string;
  source_ref: string | null;
  last_seen_at: string;
};

export function ProfileProvenanceTab({
  provenance,
}: {
  provenance: readonly ProvenanceRow[];
}) {
  const distinct = new Set(provenance.map((p) => p.source_code)).size;
  return (
    <ProfileTabStack>
      <ProfileCard id="provenance">
        <ProfileCardHeader
          title="Source records"
          meta={`${provenance.length} records · ${distinct} sources`}
        />
        <div className="profile-data-table">
          <div className="profile-data-head" aria-hidden>
            <span>Source</span>
            <span>Authority</span>
            <span>Reference</span>
            <span>Last verified</span>
            <span>Tier</span>
          </div>
          <div className="prov-list">
            {provenance.map((p, i) => {
              const refLabel = formatProvenanceRef(p.source_code, p.source_ref);
              return (
                <div key={i} className="prov-row">
                  <span className="prov-source">{p.source_code}</span>
                  <span className="prov-name">{p.display_name}</span>
                  <span
                    className="prov-ref"
                    title={refLabel ? "Source reference" : undefined}
                  >
                    {refLabel ?? "—"}
                  </span>
                  <span className="prov-seen">
                    {formatProfileDate(p.last_seen_at)}
                  </span>
                  <span
                    className={`tier-badge ${provenanceTierShort(p.tier)}`}
                  >
                    {provenanceTierShort(p.tier).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <SourcesExplainer variant="footer" />
      </ProfileCard>
    </ProfileTabStack>
  );
}
