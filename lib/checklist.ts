// The getting-started checklist (Paper `20 Onboarding` 7), out of React: the six steps, what makes each one
// done, and the line the card prints. Every fact is read by `components/onboarding/checklist-load.ts`; a
// fact that could not be read is null here, and a step is only ever "done" on a fact that was read. The
// card never claims a step it could not check, and never hides itself on a failed read (it simply has no
// progress to show), so a failure draws no tick rather than a wrong one.

export type StepKey = "save" | "source" | "rfq" | "alerts" | "template" | "invite";

export type Facts = {
  /** Suppliers the buyer has saved. */
  saved: number | null;
  /** `onboarding_state.source_checked_at` is set: they opened a source from a record. */
  sourceChecked: boolean | null;
  /** RFQs the buyer has sent or drafted. */
  rfqs: number | null;
  /** The saved-supplier certificate alerts setting. */
  alertsOn: boolean | null;
  /** They saved an RFQ template of their own. */
  template: boolean | null;
  /** People on their team plus invites waiting, other than themselves. */
  invited: number | null;
  /** They hid the card. */
  dismissed: boolean;
};

export type Step = { key: StepKey; label: string; href: string; done: boolean; detail: string | null };
export type Checklist = { steps: Step[]; done: number; total: number };

export const SAVE_TARGET = 3;

const STEPS: readonly { key: StepKey; label: string; href: string }[] = [
  { key: "save", label: "Save 3 suppliers", href: "/app" },
  { key: "source", label: "Check a source", href: "/app/discover" },
  { key: "rfq", label: "Send your first RFQ", href: "/app/rfqs/new" },
  { key: "alerts", label: "Turn on certificate alerts", href: "/app/settings/notifications" },
  { key: "template", label: "Set your RFQ template", href: "/app/settings/inquiry" },
  { key: "invite", label: "Invite a colleague", href: "/app/settings/members" },
];

/** Null when the card should not be drawn: hidden by the buyer, or every step done. */
export function checklistOf(f: Facts): Checklist | null {
  if (f.dismissed) return null;
  const done: Record<StepKey, boolean> = {
    save: f.saved !== null && f.saved >= SAVE_TARGET,
    source: f.sourceChecked === true,
    rfq: f.rfqs !== null && f.rfqs > 0,
    alerts: f.alertsOn === true,
    template: f.template === true,
    invite: f.invited !== null && f.invited > 0,
  };
  const steps: Step[] = STEPS.map((s) => ({
    ...s,
    done: done[s.key],
    // Paper: "Save 3 suppliers · 1 saved". Only when some are saved and the step is not done.
    detail: s.key === "save" && !done.save && f.saved !== null && f.saved > 0 ? `${f.saved} saved` : null,
  }));
  const n = steps.filter((s) => s.done).length;
  return n === steps.length ? null : { steps, done: n, total: steps.length };
}

/** "1 of 6 done". */
export const progressLine = (c: Checklist) => `${c.done} of ${c.total} done`;
