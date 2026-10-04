// Plan and usage and Team and roles (Paper `10 · Settings · Plan and usage`, `· Team and roles`). Server
// components over the same `settings_get` document. Both say what is true today and leave out what is
// design only: Paper's "This month" counts (no read gives them), the invite dialog, the role chooser,
// the sessions and the audit log. Team and roles is the one person who is signed in.

import { Check } from "@phosphor-icons/react/dist/ssr";
import { Table, TableFrame, Td, Th, Tr, buttonClass } from "@/components/kit";
import type { SettingsDoc } from "./doc";
import { Section } from "./shell";
import { planWords } from "./words";

export const SUPPORT = "mailto:support@sourcebd.net";
export const PLAN_CAPTION = "Free while SourceBD is in beta.";
export const FREE_INCLUDES = "Search, saved suppliers, RFQs, messages and the compliance hub.";
export const BILLING_NOTE = "Billing isn't set up yet.";
export const ENTERPRISE = ["Team seats with roles", "Single sign-on", "Audit log", "Evidence packs for auditors"] as const;

export function PlanPanel({ doc }: { doc: SettingsDoc }) {
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

export const TEAM_CAPTION = "One person today: you.";
export const TEAM_NOTE_TITLE = "Today, in the product";
export const TEAM_NOTE = "Team seats come with the Enterprise plan. Contact support to add colleagues now.";

export function TeamPanel({ doc }: { doc: SettingsDoc }) {
  const name = doc.display_name?.trim() || null;
  return (
    <>
      <TableFrame className="max-md:hidden">
        <Table aria-label="People">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th className="w-[140px]">Role</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td>
                <span className="font-medium text-ink">{name ?? "No display name"}</span> <span className="text-ink-3">you</span>
              </Td>
              <Td className="[overflow-wrap:anywhere]">{doc.email || "—"}</Td>
              <Td>Owner</Td>
            </Tr>
          </tbody>
        </Table>
      </TableFrame>
      <ul className="border-t border-line md:hidden">
        <li className="flex flex-col gap-0.5 border-b border-line py-3">
          <span className="text-md font-medium text-ink">
            {name ?? "No display name"} <span className="text-sm font-normal text-ink-3">you</span>
          </span>
          <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{doc.email || "—"}</span>
          <span className="text-sm text-ink-2">Owner</span>
        </li>
      </ul>
      <div className="mt-6 flex max-w-[560px] flex-col gap-2 rounded-lg border border-line p-5">
        <p className="text-md font-semibold text-ink">{TEAM_NOTE_TITLE}</p>
        <p className="text-base text-ink-2">{TEAM_NOTE}</p>
        <div className="pt-1">
          <a href={`${SUPPORT}?subject=SourceBD%20team%20seats`} className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch max-md:w-full" })}>
            Contact support
          </a>
        </div>
      </div>
    </>
  );
}
