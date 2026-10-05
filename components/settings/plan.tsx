// Plan and usage (Paper `10 · Settings · Plan and usage`): a server component over the `settings_get`
// document. It says what is true today and leaves out what is design only: Paper's "This month" counts
// but one (evidence packs downloaded, 0114; no read gives the others), the sessions and the audit
// log. Team and roles is `components/team/`.

import { Check } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/kit";
import type { SettingsDoc } from "./doc";
import { Section } from "./shell";
import { planWords } from "./words";

export const SUPPORT = "mailto:support@sourcebd.net";
export const PLAN_CAPTION = "Free while SourceBD is in beta.";
export const FREE_INCLUDES = "Search, saved suppliers, RFQs, messages and the compliance hub.";
export const BILLING_NOTE = "Billing isn't set up yet.";
export const ENTERPRISE = ["Team seats with roles", "Single sign-on", "Audit log", "Evidence packs for auditors"] as const;

/** `packs` is "Evidence packs downloaded" this month; null (not counted) draws nothing, so no "0" stands in for a failed read. */
export function PlanPanel({ doc, packs = null }: { doc: SettingsDoc; packs?: number | null }) {
  const free = planWords(doc) === "Free during the beta";
  return (
    <>
      <Section title="Your plan">
        <div className="flex max-w-[560px] flex-col gap-3 rounded-lg border border-line p-5">
          <p className="text-lg font-semibold text-ink">{planWords(doc)}</p>
          {free ? <p className="text-base text-ink-2">{FREE_INCLUDES}</p> : null}
          <p className="text-base text-ink-2">{BILLING_NOTE}</p>
          <div>
            <a href={`${SUPPORT}?subject=SourceBD%20plan`} className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch max-md:w-full" })}>
              Contact support to change plan
            </a>
          </div>
        </div>
      </Section>
      {packs !== null ? (
        <Section title="This month">
          <dl className="flex max-w-[560px] flex-col">
            <div className="flex justify-between gap-3 border-b border-line py-2">
              <dt className="text-base text-ink-2">Evidence packs downloaded</dt>
              <dd className="text-base font-semibold tabular-nums text-ink">{packs}</dd>
            </div>
          </dl>
        </Section>
      ) : null}
      <Section title="Enterprise · talk to us">
        <div className="flex max-w-[560px] flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {ENTERPRISE.map((f) => (
              <li key={f} className="flex items-center gap-2 text-base text-ink">
                <Check size={16} className="shrink-0 text-ink-2" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div>
            <a href={`${SUPPORT}?subject=SourceBD%20Enterprise`} className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch max-md:w-full" })}>
              Talk to us
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
