import {
  ProfileCard,
  ProfileCardHeader,
  ProfileFootnote,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import { formatProfileDate } from "@/lib/format-supplier-profile";

export type BrandAttributionRow = {
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
};

export function ProfileBrandsTab({
  brands,
}: {
  brands: readonly BrandAttributionRow[];
}) {
  return (
    <ProfileTabStack>
      <ProfileCard>
        <ProfileCardHeader
          title="Brand attribution"
          meta={`${brands.length} brand${brands.length === 1 ? "" : "s"} · per-factory authenticity`}
        />
        <div className="brand-list">
          {brands.map((b, i) => (
            <div key={i} className="brand-row">
              <div className="brand-id">
                <div className="brand-mark">
                  {b.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="brand-text">
                  <span className="brand-name">{b.display_name}</span>
                  <span className="brand-since">
                    Last verified {formatProfileDate(b.last_seen_at)}
                  </span>
                </div>
              </div>
              <p className="brand-desc">
                Named on{" "}
                <strong>
                  {b.display_name}&apos;s published BD supplier list
                </strong>
                . Disclosure does not imply endorsement.
              </p>
              <span className="brand-meta">{formatProfileDate(b.last_seen_at)}</span>
              <div className="brand-actions">
                {b.source_url ? (
                  <a
                    className="doc-action"
                    href={b.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Brand source ↗
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <ProfileFootnote>
          Per-factory authenticity rule: a brand attribution attaches only when
          the brand&apos;s own publication names this specific factory.
        </ProfileFootnote>
      </ProfileCard>
    </ProfileTabStack>
  );
}
