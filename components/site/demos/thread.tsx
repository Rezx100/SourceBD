"use client";

// Messages (critique 22 Oct: the RFQs page's thread and the home's half row were 3 Oct screenshots): a supplier's
// reply lands under the RFQ it answers, the RFQ's four facts on the strip above the thread, as Messages draws them
// (`ThreadHead`, `RfqBar` and the chat pattern's `Bubble`, components/messages and components/patterns/chat.tsx).
// The supplier is the snapshot's; the RFQ, the quote and both messages are examples, as the Ask demo's are, and the
// window says so.

import { Bubble, DateLine, FileChip, SampleLabel } from "@/components/patterns";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName } from "@/lib/dashboard/facts";
import { READ_AT, SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Demo, Window, type Frame } from "./stage";

const SUPPLIER = displayName(SNAPSHOT.search.rows[0]!.name);

/** Every company the demo names. */
export const NAMES = [SUPPLIER];

/** The example RFQ the Ask demo sends, as the strip above the thread words it (`rfqStrip`). */
const STRIP: [string, string][] = [
  ["RFQ sent", READ_AT],
  ["Quantity", "12,000 pieces"],
  ["Ship by", "15 Jan 2027"],
  ["Quote", "US$6.15 per piece"],
];

type S = CursorState & { reply: boolean; read: boolean; file: boolean };
export const STEPS: Step<S>[] = [
  { at: 0, state: { reply: false, read: false, file: false } },
  { at: 900, state: { reply: false, read: true, file: false } },
  { at: 2100, state: { reply: true, read: true, file: false } },
  { at: 3000, state: { reply: true, read: true, file: true } },
];

export function DemoThread(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`A conversation with ${SUPPLIER} under the RFQ it answers: the RFQ's quantity, ship-by date and quote above, an example question and the supplier's example reply with a file.`}>
      {(s) => (
        <Window>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-md font-semibold text-ink">{SUPPLIER}</p>
              <p className="truncate text-xs text-ink-3">RFQ · Men&apos;s cotton trousers</p>
            </div>
            <SampleLabel>Example messages</SampleLabel>
          </header>
          <dl className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-2.5">
            {STRIP.map(([k, v], i) => (
              <div key={k} className={cn("flex flex-col", i > 0 && "border-l border-line pl-4")}>
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="text-base font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-1 flex-col gap-4 px-5 py-4">
            <DateLine>{READ_AT}</DateLine>
            <Bubble from="you" meta="You · 09:40" read={s.read}>
              Could you confirm the lead time for 12,000 pieces, and send your GOTS scope certificate?
            </Bubble>
            <div className={cn("transition-opacity duration-slow motion-reduce:transition-none", s.reply ? "opacity-100" : "opacity-0")}>
              <Bubble from="them" meta={`${SUPPLIER} · 11:05`}>
                Forty-five days from the approved sample. The scope certificate is attached.
                {s.file ? <FileChip name="GOTS scope certificate.pdf" detail="PDF" /> : null}
              </Bubble>
            </div>
          </div>
        </Window>
      )}
    </Demo>
  );
}
