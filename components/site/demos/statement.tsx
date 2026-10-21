"use client";

// The modern slavery statement draft (critique 22 Oct: the compliance pages said it in words alone): two of the
// draft's sections with the claims only the buyer can know marked "[Confirm: …]", the rail counting what stops the
// download, and each claim confirmed in turn until Download opens. The words are the draft's own
// (`lib/msa-statement.ts`, sections 5 and 6) and the chat's patterns (`OpenClaim`, `ConfirmedClaim`,
// `downloadBlockedWords`); the company is "your company" and every answer is an example, as the window says.

import { buttonClass } from "@/components/kit";
import { ConfirmedClaim, OpenClaim, SampleLabel, downloadBlockedWords } from "@/components/patterns";
import type { CursorState, Step } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, type Frame } from "./stage";

const ORG = "your company";
const YEAR = "the financial year";

/** The two claims the demo confirms: what the draft asks, and the example answer a buyer types. */
const CLAIMS = [
  { section: "Section 5", heading: "Training", label: "Training", ask: `the training on modern slavery ${ORG} gave during ${YEAR}: who received it and how often. If none was given, say so.`, answer: "Every buyer on the sourcing team completed a two-hour course on forced labour risks in March." },
  { section: "Section 6", heading: "Effectiveness — key performance indicators", label: "Key performance indicators", ask: `how ${ORG} measures whether these steps are working, and what changed during ${YEAR}.`, answer: "We count the saved suppliers whose certificates we checked before each order, and the share renewed on time." },
];

type S = CursorState & { confirmed: number };
const t1 = 1600;
export const STEPS: Step<S>[] = [
  { at: 0, state: { confirmed: 0 } },
  { at: 900, state: { confirmed: 0, cursor: "fill-0" } },
  { at: 900 + motion.cursorMs, state: { confirmed: 0, cursor: "fill-0", click: true } },
  { at: t1 + motion.cursorMs, state: { confirmed: 1 } },
  { at: t1 + motion.cursorMs + 900, state: { confirmed: 1, cursor: "fill-1" } },
  { at: t1 + 2 * motion.cursorMs + 900, state: { confirmed: 1, cursor: "fill-1", click: true } },
  { at: t1 + 2 * motion.cursorMs + 2200, state: { confirmed: 2 } },
];

export function DemoStatement(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description="A modern slavery statement draft: two claims only the buyer can know are marked to confirm, and Download opens once both are confirmed. The answers are examples.">
      {(s) => {
        const open = CLAIMS.length - s.confirmed;
        return (
          <Window>
            <Bar title="Modern slavery statement">
              <SampleLabel>Example answers</SampleLabel>
            </Bar>
            <div className="flex flex-1 flex-col gap-4 p-4 [@container_(min-width:640px)]:flex-row">
              <article className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-line bg-surface p-5">
                {CLAIMS.map((c, i) => (
                  <section key={c.section} className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-ink-3">{c.section}</p>
                    <h3 className="text-lg font-semibold text-ink">{c.heading}</h3>
                    <p className="leading-relaxed">{i < s.confirmed ? <ConfirmedClaim>{c.answer}</ConfirmedClaim> : <OpenClaim focused={s.cursor === `fill-${i}`}>{c.ask}</OpenClaim>}</p>
                  </section>
                ))}
                <p className="text-xs text-ink-3">Dashed amber: only you can confirm it. Underlined: you confirmed it.</p>
              </article>
              <aside aria-label="Claims to confirm" className="flex shrink-0 flex-col gap-3 rounded-lg border border-line p-4 [@container_(min-width:640px)]:w-[220px]">
                <p className="text-md font-semibold text-ink">Before you download{open ? ` · ${open} ${open === 1 ? "claim" : "claims"} to confirm` : ""}</p>
                <ul>
                  {CLAIMS.map((c, i) => (
                    <li key={c.label} className="flex items-center justify-between gap-2 border-t border-line py-2 last:border-b">
                      <span className={cn("text-sm", i < s.confirmed ? "text-ink-3 line-through" : "text-ink")}>{c.label}</span>
                      {i < s.confirmed ? null : (
                        <span data-cursor={`fill-${i}`} className={buttonClass({ kind: "secondary" })}>
                          Fill in
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <span className={buttonClass({ kind: "primary", className: cn("w-full", open && "pointer-events-none opacity-50") })}>Download statement</span>
                {open ? <p className="text-xs text-ink-3">{downloadBlockedWords(open)}</p> : null}
              </aside>
            </div>
          </Window>
        );
      }}
    </Demo>
  );
}
