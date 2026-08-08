// Public supplier-profile route group (REZ-72). Same marketing chrome as
// `app/(marketing)`, but deliberately WITHOUT any `loading.tsx` in the chain:
// a Suspense fallback anywhere above the page lets Next flush the shell with
// HTTP 200 before notFound()/permanentRedirect() can set the status, which is
// how the profile routes shipped a soft-200 for missing slugs and facility
// redirects. With no boundary above it, the page's miss handling emits the
// real 404/308 on the wire.

import { MarketingChrome, marketingMetadata } from "@/components/marketing/chrome";

export const metadata = marketingMetadata;

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingChrome>{children}</MarketingChrome>;
}
