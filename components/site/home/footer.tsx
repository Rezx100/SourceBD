// 19 · The home page's footer (Paper `1F2K-0` / `1FEE-0`): the wordmark and its line, five columns of real routes,
// and the promise. Every address is a page of the site (`home.test.ts` checks each one has a route); the board's
// "Orders" has no public page, so it is not linked. Cookie settings reopen the banner, as on every other page.

import Link from "next/link";
import { CookieSettingsButton } from "@/components/site/cookie-banner";
import { cn } from "@/lib/utils";
import { measure, ring } from "./ui";

export const FOOT: [string, [string, string][]][] = [
  ["Product", [["Search", "/product/search"], ["Supplier records", "/product/records"], ["RFQs and quotes", "/product/rfqs"], ["Messages", "/product/rfqs"], ["Compliance hub", "/product/compliance"]]],
  ["Solutions", [["Sourcing teams", "/solutions/sourcing"], ["Compliance teams", "/solutions/compliance"], ["For suppliers", "/suppliers"]]],
  ["Learn", [["Methodology", "/methodology"], ["Compliance guides", "/compliance"], ["Data status", "/status"], ["Security", "/security"]]],
  ["Company", [["About", "/about"], ["Pricing", "/pricing"], ["Contact", "/contact"]]],
  ["Legal", [["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"], ["Cookies", "/legal/cookies"]]],
];

export function HomeFooter({ year }: { year: number }) {
  return (
    <footer className={cn(measure, "flex flex-col gap-10 pb-16 md:gap-14")}>
      <div className="flex flex-col gap-10 border-t border-line pt-14 lg:flex-row lg:justify-between">
        <div className="flex flex-col gap-3 lg:w-[280px] lg:shrink-0">
          <Link href="/" className={cn("w-fit text-[22px] font-semibold leading-[22px] tracking-[-0.01em] text-brand", ring)}>
            SourceBD
          </Link>
          <p className="text-[14px] leading-[22px] text-ink-muted">Verified Bangladesh garment suppliers, every fact with its receipt.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:flex lg:gap-14">
          {FOOT.map(([title, links]) => (
            <div key={title} className="flex flex-col gap-3">
              <h2 className="text-[14px] font-medium leading-[18px] text-ink-strong">{title}</h2>
              <ul className="flex flex-col">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} prefetch={false} className={cn("inline-flex min-h-6 items-center text-[14px] leading-6 text-ink-muted hover:text-ink-strong max-md:min-h-11", ring)}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="flex flex-col gap-3 text-[14px] leading-5 text-ink-subtle md:flex-row md:items-center md:justify-between">
        <p>&copy; {year} SourceBD. Facts come from named public registers; we do not score, grade or rate suppliers.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>UK GDPR · ICO registration pending</span>
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
