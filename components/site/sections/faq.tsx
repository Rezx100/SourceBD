// The site's one FAQ (Paper `1F1G-0` / `1FDA-0`): a centred heading over native <details> sharing one `name`, so one
// answer is open at a time with no script and every answer is in the page for a search engine. The home page passes
// its six answers (`FAQ_ITEMS`, with the live counts where they were read); pricing passes its own.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { H2, measure, ring } from "./ui";

export type FaqItem = { q: string; a: ReactNode };

export function Faq({ items, id = "faq", title = "Questions buyers ask.", after }: { items: FaqItem[]; id?: string; title?: ReactNode; after?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn(measure, "flex flex-col items-center gap-8 py-14 md:gap-14 md:py-section")}>
      <H2 id={id} className="text-center">
        {title}
      </H2>
      <div className="w-full max-w-[800px] border-t border-line">
        {items.map((item, i) => (
          <details key={item.q} name={id} open={i === 0} className="group border-b border-line-subtle">
            <summary className={cn("flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 text-site-title font-medium text-ink-strong [&::-webkit-details-marker]:hidden", ring)}>
              {item.q}
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                <path d="M5 12h14" />
                <path d="M12 5v14" className="group-open:hidden" />
              </svg>
            </summary>
            <div className="max-w-[720px] pb-6 text-md text-ink-muted">{item.a}</div>
          </details>
        ))}
      </div>
      {after}
    </section>
  );
}
