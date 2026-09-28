// A worker figure in a list cell, with its second figure under it wherever
// the two differ (`workersSecondShort` in `lib/dashboard/build-discover-row.ts`).
// One component for the search's ledger and the Saved list, so the same
// supplier reads the same two numbers on both (founder's walkthrough,
// 28 Sep 2026). The full words for each figure travel in the title.
//
// No hooks and no server-only imports: the results table (a client
// component) and the Saved list (a server component) both render it.

import { formatCount } from "@/lib/dashboard/facts";

export function WorkersCell({
  own,
  ownWords,
  second,
  secondWords,
}: {
  /** The supplier record's own figure: the one the Workers sort and filter use. */
  own: number | null;
  /** "on the supplier record" — what the first figure counts. */
  ownWords?: string | null;
  /** The profile's figure in a few words ("793 RSC"), when it differs. */
  second?: string | null;
  /** The profile's figure in full ("793 workers · RSC inspection"). */
  secondWords?: string | null;
}) {
  const title = [own === null ? null : `${formatCount(own)} workers${ownWords ? ` · ${ownWords}` : ""}`, secondWords].filter(Boolean).join(" · ") || undefined;
  return (
    <span className="inline-flex flex-col items-end leading-tight" title={title} data-workers-cell="">
      {own === null ? <span className="text-quiet-ink">—</span> : <span className="text-ink-strong">{formatCount(own)}</span>}
      {second ? <span className="whitespace-nowrap text-xs font-normal text-ink-subtle">{second}</span> : null}
    </span>
  );
}
