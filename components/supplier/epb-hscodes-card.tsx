import {
  ProfileActionLink,
  ProfileCard,
  ProfileCardHeader,
  ProfileEvidenceRow,
  ProfileFootnote,
  ProfileSourceMark,
} from "@/components/supplier/profile-ui";
import { EpbHscodesUnavailable } from "@/components/supplier/epb-buyer-links";
import type { ProfileEpbHscode } from "@/lib/epb-hscodes";

/** Buyer Compliance card for EPB Harmonised System codes. */
export function ProfileEpbHscodesCard({
  hscodes,
  loadError = false,
}: {
  hscodes: readonly ProfileEpbHscode[];
  loadError?: boolean;
}) {
  if (loadError) {
    return (
      <ProfileCard hoverable>
        <ProfileCardHeader title="EPB export products" />
        <EpbHscodesUnavailable />
      </ProfileCard>
    );
  }
  if (hscodes.length === 0) return null;
  return (
    <ProfileCard hoverable>
      <ProfileCardHeader
        title="EPB export products"
        meta={`${hscodes.length} HS code${hscodes.length === 1 ? "" : "s"}`}
      />
      <div data-epb-hscodes="">
        {hscodes.map((row) => (
          <div key={row.code} data-epb-hscode={row.code}>
            <ProfileEvidenceRow
              markSize="lg"
              pillAlign="top"
              mark={<ProfileSourceMark tag="EPB" size="lg" />}
              title={
                <span className="font-mono text-[13px] font-medium text-neutral-700">
                  {row.code}
                </span>
              }
              meta={row.description}
              action={
                row.source_url ? (
                  <ProfileActionLink href={row.source_url}>
                    View list entry
                  </ProfileActionLink>
                ) : null
              }
            />
          </div>
        ))}
      </div>
      <ProfileFootnote>
        Harmonised System codes from the Export Promotion Bureau exporter
        database. EPB is a government register, independent of BGMEA or BKMEA
        membership.
      </ProfileFootnote>
    </ProfileCard>
  );
}
