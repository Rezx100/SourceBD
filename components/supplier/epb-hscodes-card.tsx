import {
  ProfileCard,
  ProfileCardHeader,
  ProfileFootnote,
} from "@/components/supplier/profile-ui";
import { EpbHscodesUnavailable } from "@/components/supplier/epb-buyer-links";
import type { ProfileEpbHscode } from "@/lib/epb-hscodes";
import {
  groupEpbHscodes,
  hsOverviewLede,
} from "@/lib/epb-hscode-labels";

/** Overview card: HS codes as a buyer scan, no outbound source links. */
export function ProfileEpbHscodesCard({
  hscodes,
  loadError = false,
}: {
  hscodes: readonly ProfileEpbHscode[];
  loadError?: boolean;
}) {
  if (loadError) {
    return (
      <ProfileCard>
        <ProfileCardHeader title="Export products" />
        <EpbHscodesUnavailable />
      </ProfileCard>
    );
  }
  if (hscodes.length === 0) return null;
  const groups = groupEpbHscodes(hscodes);
  return (
    <ProfileCard id="export-products">
      <ProfileCardHeader
        title="Export products"
        meta={`${hscodes.length} HS code${hscodes.length === 1 ? "" : "s"}`}
      />
      <p className="max-w-[72ch] text-[15px] leading-7 text-neutral-700">
        {hsOverviewLede(groups)}
      </p>
      <div data-epb-hscodes="">
        {groups.map((group) => (
          <div key={group.chapter} className="mt-5">
            <p className="text-[12.5px] font-semibold text-neutral-500">
              {group.label}{" "}
              <span className="font-medium text-neutral-400">
                · {group.items.length}
              </span>
            </p>
            <ul className="mt-1.5">
              {group.items.map((row) => (
                <li
                  key={row.code}
                  data-epb-hscode={row.code}
                  className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-3 border-t border-neutral-100 py-2.5 first:border-t-0 first:pt-2"
                >
                  <span className="font-mono text-[13px] font-medium tabular-nums text-neutral-700">
                    {row.code}
                  </span>
                  <span className="text-[14px] leading-5 text-neutral-800">
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
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
