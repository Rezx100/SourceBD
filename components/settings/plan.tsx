// Plan and usage (Paper `10 · Settings · Plan and usage`): a server component over the `settings_get`
// document. It says what is true today and leaves out what is design only: Paper's "This month" counts
// but one (evidence packs downloaded, 0114; no read gives the others), the sessions and the audit
// log. Team and roles is `components/team/`.

import { Check, Envelope } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/kit";
import type { SettingsDoc } from "./doc";
import { Section } from "./shell";
import { planWords, rowLine } from "./words";

export const SUPPORT = "mailto:support@sourcebd.net";
export const PLAN_CAPTION = "Free while SourceBD is in beta.";
export const FREE_INCLUDES = "Search, saved suppliers, RFQs, messages and the compliance hub.";
export const BILLING_NOTE = "Billing isn't set up yet.";
// Only what exists: team seats with roles (gap 4, 4b). Single sign-on, an audit log and evidence packs for a
// team are not built, and a list on a plan page is a promise (founder, 5 Oct 2026: keep seats, drop the other three).
export const ENTERPRISE = ["Team seats with roles"] as const;

/** Paper `11 · Plan and usage`: what the free plan holds, and the billing line. */
export const FREE_INCLUDES_PHONE = "Search, saved suppliers, RFQs, messages, orders and the compliance hub";
export const BILLING_PHONE = "Not set up. Nothing is charged.";

/** "1 to 11 Oct": this month so far, in UTC as the count is ("1 Oct" on the 1st). */
export function monthSoFar(now: Date): string {
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(now);
  const day = now.getUTCDate();
  return day === 1 ? `1 ${month}` : `1 to ${day} ${month}`;
}

function PhoneHead({ title, aside, first }: { title: string; aside: ReactNode; first?: boolean }) {
  return (
    <div className={first ? "flex items-baseline justify-between gap-3 pb-3.5 pt-4" : "flex items-baseline justify-between gap-3 pb-3.5 pt-6"}>
      <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
      <p className="text-sm text-ink-3">{aside}</p>
    </div>
  );
}

/** The phone's page (Paper `11 · Plan and usage`): the plan as a card, the month's one count, and support. Enterprise is not drawn here. */
function PhonePlan({ doc, packs, free, now }: { doc: SettingsDoc; packs: number | null; free: boolean; now: Date }) {
  const term = "w-24 shrink-0 text-base text-ink-2";
  return (
    <div className="md:hidden">
      <section aria-label="Your plan">
        <PhoneHead title="Your plan" aside={rowLine("plan", doc)} first />
        <dl className="overflow-clip rounded-[10px] border border-line">
          {free ? (
            <div className="flex gap-2.5 px-4 py-3.5">
              <dt className={term}>Includes</dt>
              <dd className="grow basis-0 text-base text-ink">{FREE_INCLUDES_PHONE}</dd>
            </div>
          ) : null}
          <div className="flex gap-2.5 border-t border-line px-4 py-3.5 first:border-t-0">
            <dt className={term}>Billing</dt>
            <dd className="grow basis-0 text-base text-ink-3">{BILLING_PHONE}</dd>
          </div>
        </dl>
      </section>
      {packs !== null ? (
        <section aria-label="This month">
          <PhoneHead title="This month" aside={monthSoFar(now)} />
          <div className="flex flex-col gap-1 rounded-[10px] border border-line px-3.5 pb-3 pt-3.5">
            <p className="text-sm text-ink-3">Evidence packs</p>
            <p className="text-xl font-medium tabular-nums tracking-tighter text-ink">{packs}</p>
          </div>
        </section>
      ) : null}
      <div className="flex pt-5">
        <a href={`${SUPPORT}?subject=SourceBD%20plan`} className={buttonClass({ kind: "quiet", className: "h-11 grow gap-1.5 rounded-full bg-sunken px-3.5 text-ink hover:bg-sunken active:bg-line" })}>
          <Envelope size={16} aria-hidden />
          Contact support about your plan
        </a>
      </div>
    </div>
  );
}

/** `packs` is "Evidence packs downloaded" this month; null (not counted) draws nothing, so no "0" stands in for a failed read. */
export function PlanPanel({ doc, packs = null, now = new Date() }: { doc: SettingsDoc; packs?: number | null; now?: Date }) {
  const free = planWords(doc) === "Free during the beta";
  return (
    <>
      <PhonePlan doc={doc} packs={packs} free={free} now={now} />
      <div className="max-md:hidden">
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
      </div>
    </>
  );
}
