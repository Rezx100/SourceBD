// 17 · FAQ (Paper `1F1G-0` / `1FDA-0`): the site's six answers (`FAQ_ITEMS`, with the live counts where they were
// read), the first open. Native <details> sharing one `name`, so one is open at a time with no script and every
// answer is in the page.

import { FAQ_ITEMS } from "@/components/site/home";
import type { SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { H2, measure, ring } from "./ui";

export function HomeFaq({ facts }: { facts: SiteFacts }) {
  return (
    <section aria-labelledby="home-faq" className={cn(measure, "flex flex-col items-center gap-8 py-14 md:gap-14 md:py-[120px]")}>
      <H2 id="home-faq" className="text-center">
        Questions buyers ask.
      </H2>
      <div className="w-full max-w-[800px] border-t border-line">
        {FAQ_ITEMS(facts).map((item, i) => (
          <details key={item.q} name="home-faq" open={i === 0} className="group border-b border-line-subtle">
            <summary className={cn("flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-[18px] text-[17px] font-medium leading-6 text-ink-strong md:py-[22px] md:text-[19px] [&::-webkit-details-marker]:hidden", ring)}>
              {item.q}
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                <path d="M5 12h14" />
                <path d="M12 5v14" className="group-open:hidden" />
              </svg>
            </summary>
            <p className="max-w-[720px] pb-[22px] text-[16px] leading-6 text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
