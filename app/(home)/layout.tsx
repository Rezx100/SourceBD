// The home page's own route group: the same marketing chrome as every other page, with the announcement bar above
// the navigation (until its dismiss cookie is set) and no chrome footer, because `/` draws the footer itself (the
// Mercury footer, or the night footer when the film is shown). Kept apart from `(marketing)` so no other page
// changes; there is no loading.tsx here, as there is none above any marketing page.

import { cookies } from "next/headers";
import { Announcement } from "@/components/site/home/announcement";
import { ANNOUNCE_COOKIE } from "@/components/site/home/cookie";
import { MarketingChrome, marketingMetadata } from "@/components/site/chrome";

export const metadata = marketingMetadata;

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const dismissed = (await cookies()).get(ANNOUNCE_COOKIE)?.value === "1";
  return (
    <MarketingChrome top={dismissed ? null : <Announcement />} footer={false}>
      {children}
    </MarketingChrome>
  );
}
