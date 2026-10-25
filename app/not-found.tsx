// Not found: one message, one way on, one way back, in the marketing site's design (25 Oct 2026): the site's bar and
// footer around home's head on the day ground. It does not read the session (that would make every unknown address
// dynamic), so "Go to Search" lands a signed-out person on the sign-in page and brings them back. The words "Page not
// found" are the HTTP-boundary guard's marker for a styled 404 (scripts/test-profile-http-boundary.mjs).

import Link from "next/link";
import { MarketingChrome } from "@/components/site/chrome";
import { HomeMain } from "@/components/site/home-main";
import { PageHead } from "@/components/site/sections/inner";
import { secondary } from "@/components/site/sections/ui";
import { ButtonLink } from "@/components/kit";

export default function NotFound() {
  return (
    <MarketingChrome>
      <HomeMain className="font-sans antialiased">
        <PageHead tone="day" label="Page not found" title="We can't find that page" lede="The link may be old, or the address has a typo. Error 404.">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ButtonLink href="/app" prefetch={false} kind="primary" size="lg" className="h-10 rounded-full px-5 text-site-item">
              Go to Search
            </ButtonLink>
            <Link href="/" prefetch={false} className={secondary}>
              Go to the home page
            </Link>
          </div>
        </PageHead>
      </HomeMain>
    </MarketingChrome>
  );
}
