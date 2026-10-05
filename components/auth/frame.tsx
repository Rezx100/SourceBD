// The split page of sign-up, sign-in and the reset (Paper `20 Onboarding`): the form in the left column,
// what the product is in a 640 panel from 1280. Server component: it reads the published count.
// Pages that are one message (S4 to S9) use `state.tsx`, which reads nothing.

import type { ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import { readPublishedCount } from "@/lib/dashboard/load-buyer-shell";

const POINTS = [
  { title: "Every fact shows where it came from", body: "“From BGMEA · checked 24 Jul 2026”, one tap from the source page." },
  { title: "Certificates with their exact dates", body: "Each one shows when it expires, and we say so when it already has." },
  { title: "One RFQ to up to 50 suppliers", body: "Replies land in Messages, with the record beside them." },
] as const;

/** What the product is. The count is the live published one; unread, the line is left out, never a 0. */
export function PanelBody({ published }: { published: number | null }) {
  const count = formatCount(published);
  return (
    <>
      {count ? <p className="text-3xl font-semibold tracking-tighter text-ink">{count} suppliers</p> : null}
      <ul className="flex w-full max-w-[440px] flex-col gap-5">
        {POINTS.map((p) => (
          <li key={p.title} className="flex flex-col gap-0.5 border-l-2 border-line pl-4">
            <span className="text-md font-medium text-ink">{p.title}</span>
            <span className="text-base text-ink-2">{p.body}</span>
          </li>
        ))}
      </ul>
      <p className="max-w-[440px] text-sm text-ink-3">We never score or rate a supplier. You see the receipts and decide.</p>
    </>
  );
}

/** The form column and the panel. Under 1280 the panel is gone and the count sits under the form, as on Paper's phone. */
export async function AuthSplit({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const published = await readPublishedCount();
  const count = formatCount(published);
  return (
    <div className="flex min-h-dvh bg-surface font-sans text-ink antialiased">
      <div className="flex min-w-0 flex-1 flex-col">
        {bar}
        <main id="main-content" className="flex flex-1 flex-col justify-center gap-8 px-4 pb-14 pt-4 sm:px-10 xl:pl-40">
          <div className="flex w-full max-w-[420px] flex-col gap-8">{children}</div>
          {count ? <p className="max-w-[420px] border-t border-line pt-4 text-sm text-ink-3 xl:hidden">{count} suppliers, each with the sources it came from.</p> : null}
        </main>
      </div>
      <aside aria-label="About SourceBD" className="hidden w-pane shrink-0 flex-col justify-center gap-8 border-l border-line bg-subtle px-20 xl:flex">
        <PanelBody published={published} />
      </aside>
    </div>
  );
}
