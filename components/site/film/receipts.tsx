// The receipt roll (handoff-home-film §3.9): paper, not glass. Each claim in the factory's words, then the receipt
// that checks it: the source, its number, the day we read it, in mono type, one receipt per perforation. On the
// full tier the roll prints out of its slot as the scroll moves (`--print`, written by engine/chapters.ts, moves
// the sheet's end, the clip on the ink and the torn edge together); on the other tiers it is whole. Server component.

export type Receipt = { claim: string; source: string; fields: [string, string][] };

/** The torn edge: twenty teeth across the roll, closed along the top so the fill is the sheet's own. */
const TEAR = `M0 0${Array.from({ length: 20 }, (_, i) => `L${i * 20 + 10} 9L${i * 20 + 20} 0`).join("")}`;

export function ReceiptRoll({ receipts }: { receipts: Receipt[] }) {
  return (
    <div data-roll className="relative w-[360px] max-w-full">
      <div aria-hidden className="roll-slot" />
      <div className="relative mx-2.5">
        <div aria-hidden className="roll-sheet" />
        <div data-paper className="roll-print">
          {receipts.map((r) => (
            <article key={r.source} data-receipt className="receipt">
              <p className="font-mono text-xs text-ink-3">The claim</p>
              <p className="text-base text-ink-3">{r.claim}</p>
              <p data-tie-from className="mt-1 text-base font-semibold text-ink">
                {r.source}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 font-mono text-xs leading-4">
                {r.fields.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <svg aria-hidden viewBox="0 0 400 10" preserveAspectRatio="none" className="roll-tear">
          <path d={`${TEAR}Z`} className="fill-surface" />
          <path d={TEAR} className="fill-none stroke-line" strokeWidth={0.8} />
        </svg>
      </div>
    </div>
  );
}
