"use client";

// Claim, for suppliers (handoff-mercury-motion-sitewide.md §4.3): the company is found by its BGMEA number, the
// claim is asked for with an email at the company, and the record shows Claimed. The words are the ones audit slice
// 2 settled (`components/site/sections/suppliers.tsx`): an address at the company's domain approves the claim when
// the link is opened; any other goes to a person; no product editing. The company is the snapshot's record.

import { ClaimStatusChip, ClaimSteps } from "@/components/claim/parts";
import { buttonClass } from "@/components/kit";
import { SourceMark } from "@/components/patterns";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName } from "@/lib/dashboard/facts";
import { motion } from "@/lib/design/tokens";
import { SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { Bar, Demo, Field, Window, endOf, typed, type Frame } from "./stage";

const { check } = SNAPSHOT;
const NAME = displayName(check.name);
/** Found by its BGMEA number when the register filed one, else by name. */
const QUERY = check.bgmea ?? NAME;

/** Every company the demo names. */
export const NAMES = [NAME];

/** The sentence audit slice 2 settled; the home page and the suppliers page say the same. */
export const APPROVAL = "If its domain matches the company's, opening our link approves the claim; if not, a person reviews it.";

type S = CursorState & { typed: string; found: boolean; step: 0 | 1 | 2 | 3 };

const still = (over: Partial<S>): S => ({ typed: QUERY, found: true, step: 3, ...over });
const typing = typed(QUERY, 500, (typed) => still({ typed, found: false, step: 0 }));
const t1 = endOf(typing) + 400;
const t2 = t1 + 700;
const t3 = t2 + motion.cursorMs + motion.clickMs + 1800;
const t4 = t3 + motion.cursorMs + motion.clickMs + 1600;

export const STEPS: Step<S>[] = [
  { at: 0, state: still({ typed: "", found: false, step: 0 }) },
  ...typing,
  { at: t1, state: still({ step: 0 }) },
  { at: t2, state: still({ step: 0, cursor: "claim" }) },
  { at: t2 + motion.cursorMs, state: still({ step: 0, cursor: "claim", click: true }) },
  { at: t2 + motion.cursorMs + motion.clickMs, state: still({ step: 1 }) },
  { at: t3, state: still({ step: 1, cursor: "send-link" }) },
  { at: t3 + motion.cursorMs, state: still({ step: 1, cursor: "send-link", click: true }) },
  { at: t3 + motion.cursorMs + motion.clickMs, state: still({ step: 2 }) },
  { at: t4, state: still({ step: 3 }) },
];

export function DemoClaim(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`${NAME} found by its BGMEA number, a claim asked for with an email at the company, and the record marked Claimed.`}>
      {(s) => (
        <Window>
          <Bar title="Claim your company" />
          <div className="flex flex-col gap-5 p-5">
            <ClaimSteps current={Math.min(2, s.step)} />
            {s.step === 0 ? (
              <>
                <Field label="Find your company" value={s.typed} placeholder="Name, BGMEA number or EPB number" typing={!s.found} />
                {s.found ? (
                  <div className="flex animate-swap-in items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 motion-reduce:animate-none">
                    <span className="flex min-w-0 items-center gap-3">
                      <SourceMark source="BGMEA" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-medium text-ink">{NAME}</span>
                        <span className="truncate text-xs text-ink-3">
                          {[check.type, check.place].filter(Boolean).join(" · ")}
                          {check.bgmea ? ` · BGMEA member ${check.bgmea}` : ""}
                        </span>
                      </span>
                    </span>
                    <span data-cursor="claim" className={buttonClass({ kind: "primary" })}>
                      Claim this record
                    </span>
                  </div>
                ) : null}
              </>
            ) : s.step === 1 ? (
              <div className="flex animate-swap-in flex-col gap-4 motion-reduce:animate-none">
                <div className="flex flex-col gap-1">
                  <p className="text-base font-semibold text-ink">{NAME}</p>
                  <p className="text-sm text-ink-2">Give an email at your company. {APPROVAL}</p>
                </div>
                <Field label="Work email at your company" value="" placeholder="you@your-company.com" />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-3">Claiming is free. You update your profile and contacts and answer RFQs; nothing else on the record is edited.</p>
                  <span data-cursor="send-link" className={buttonClass({ kind: "primary" })}>
                    Send the link
                  </span>
                </div>
              </div>
            ) : s.step === 2 ? (
              <div className="flex animate-swap-in flex-col gap-2 rounded-lg border border-line p-4 motion-reduce:animate-none">
                <p className="text-base font-semibold text-ink">Check your inbox.</p>
                <p className="text-sm text-ink-2">{APPROVAL}</p>
              </div>
            ) : (
              <div className="flex animate-swap-in flex-col gap-3 rounded-lg border border-line p-4 motion-reduce:animate-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-lg font-semibold tracking-tight text-ink">{NAME}</span>
                    <span className="truncate text-sm text-ink-2">{[check.type, check.place].filter(Boolean).join(" · ")}</span>
                  </span>
                  <ClaimStatusChip status="approved">Claimed</ClaimStatusChip>
                </div>
                <p className="text-sm text-ink-2">{"Keep your profile and contacts current, quote on buyers' RFQs and reply in Messages, at no cost."}</p>
                <p className="text-xs text-ink-3">{APPROVAL}</p>
              </div>
            )}
          </div>
        </Window>
      )}
    </Demo>
  );
}
