// The top of the statement page and its failure states (B6c-2). Server components.

import Link from "next/link";
import { BackToHub } from "@/components/compliance/hub";
import { ErrorPanel, InlineError, Skeleton, buttonClass } from "@/components/kit";
import { MSA_HREF } from "@/components/compliance/words";

export function StatementHead() {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-line px-6 py-4 max-md:border-b-0 max-md:px-4 max-md:pb-2 max-md:pt-1">
      <BackToHub />
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-ink max-md:hidden">Modern slavery statement</h1>
        <p className="text-base text-ink-3">UK Modern Slavery Act 2015, section 54 · composed from your saved suppliers · nothing leaves your browser</p>
      </div>
    </header>
  );
}

/** The footprint did not load: nothing can be drafted from a count that was not read. */
export function StatementError() {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title="We couldn't load the statement inputs."
        retry={
          <Link href={MSA_HREF} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        Nothing has been lost. Your saved suppliers are safe.
      </ErrorPanel>
    </div>
  );
}

/** The UFLPA tracker did not load: the draft leaves its result as a claim for the buyer to confirm. */
export function ScreeningNote() {
  return (
    <div className="px-6 pt-3 max-md:px-4">
      <InlineError
        retry={
          <Link href={MSA_HREF} prefetch={false} className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        The UFLPA check did not load, so the draft leaves its result for you to confirm.
      </InlineError>
    </div>
  );
}

export function StatementSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the statement" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-6 py-4 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Modern slavery statement</h1>
        <Skeleton className="h-3 w-[360px]" />
      </div>
      <div className="mx-6 mt-5 flex flex-col gap-3 rounded-lg border border-line p-8 max-md:mx-4 max-md:p-4" aria-hidden>
        <Skeleton className="h-3 w-[120px]" />
        <Skeleton className="h-5 w-[260px]" />
        <Skeleton tone="subtle" className="h-3 w-full" />
        <Skeleton tone="subtle" className="h-3 w-[90%]" />
        <Skeleton tone="subtle" className="h-3 w-[70%]" />
      </div>
    </div>
  );
}
