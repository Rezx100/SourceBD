import {
  ProfileActionLink,
  ProfileCard,
  ProfileCardHeader,
  ProfileEvidenceRow,
  ProfileFootnote,
  ProfileSourceMark,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import { formatProfileDate } from "@/lib/format-supplier-profile";

export type BrandAttributionRow = {
  source_code?: string;
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
        <div>
          {brands.map((b, i) => (
            <ProfileEvidenceRow
              key={i}
              mark={<ProfileSourceMark tag={b.source_code ?? `BRAND_${b.display_name}`} label={b.display_name} />}
              title={b.display_name}
              meta={
                <>
                  Disclosed on {b.display_name}&apos;s published supplier list.
                  <span className="ml-1 font-mono">
                    Last verified {formatProfileDate(b.last_seen_at)}
                  </span>
                </>
              }
              action={
                b.source_url ? (
                  <ProfileActionLink href={b.source_url}>Brand source</ProfileActionLink>
                ) : null
              }
            />
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
