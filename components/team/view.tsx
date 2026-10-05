// The Team page's body (Paper `10 · Settings · Team and roles`, `11 · Team and roles`): the people in a
// table from 768 (name, email, role, last active), the invites waiting as shaded rows under them, and on
// a phone one row each with the menu at its end; then "What each role can do". Server component; the
// controls in it are the client islands of `actions.tsx`. The owner changes roles and removes people; a
// member sees the same table with nothing to change.

import { Envelope } from "@phosphor-icons/react/dist/ssr";
import { ErrorPanel, Table, TableFrame, Td, Th, Tr, buttonClass } from "@/components/kit";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { InviteLinks, InviteMenu, MemberMenu, RoleCell, TeamLines } from "./actions";
import { ROLES, ROLES_NOTE, TEAM_ERROR_BODY, TEAM_ERROR_TITLE, initialsOf, inviteExpiryWords, inviteSentWords, isOwner, lastActiveWords, memberName, roleLabel, type Invite, type Member, type TeamDoc } from "./model";

const YOU = <span className="text-xs font-normal text-ink-3">you</span>;

function MemberRows({ team, now }: { team: TeamDoc; now: Date }) {
  const manage = isOwner(team);
  return (
    <>
      {team.members.map((m) => {
        const editable = manage && m.role !== "owner";
        return (
          <Tr key={m.userId} data-member={m.userId}>
            <Td>
              <span className="flex items-center gap-2">
                <span className="font-medium text-ink [overflow-wrap:anywhere]">{memberName(m)}</span>
                {m.isYou ? YOU : null}
              </span>
            </Td>
            <Td className="[overflow-wrap:anywhere]">{m.email}</Td>
            <Td className="text-ink">{editable ? <RoleCell member={m} /> : roleLabel(m.role)}</Td>
            <Td className="whitespace-nowrap">{lastActiveWords(m.lastActiveAt, now)}</Td>
            <td className="w-12 border-b border-line p-0 text-center align-middle">{editable ? <MemberMenu member={m} /> : null}</td>
          </Tr>
        );
      })}
    </>
  );
}

function InviteRows({ invites }: { invites: readonly Invite[] }) {
  return (
    <>
      {invites.map((i) => (
        <Tr key={i.id} data-invite={i.id} className="bg-subtle hover:bg-subtle">
          <Td>
            <span className="block whitespace-nowrap">{inviteSentWords(i)}</span>
            <span className={cn("block text-xs", i.expired ? "text-danger" : "text-ink-3")}>{inviteExpiryWords(i)}</span>
          </Td>
          <Td className="[overflow-wrap:anywhere]">{i.email}</Td>
          <Td className="text-ink">{roleLabel(i.role)}</Td>
          <Td>
            <InviteLinks invite={i} />
          </Td>
          <td className="w-12 border-b border-line p-0" />
        </Tr>
      ))}
    </>
  );
}

function PhoneMember({ m, manage, now }: { m: Member; manage: boolean; now: Date }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-line py-2 pl-4 pr-1">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-base font-semibold text-ink-2" aria-hidden>
        {initialsOf(m.name, m.email)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-md font-medium leading-[22px] text-ink [overflow-wrap:anywhere]">
          {memberName(m)}
          {m.isYou ? " (you)" : ""}
        </span>
        <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{m.email}</span>
        <span className="text-sm font-medium text-ink-2">
          {roleLabel(m.role)}
          <span className="font-normal text-ink-3"> · {lastActiveWords(m.lastActiveAt, now)}</span>
        </span>
      </span>
      {manage && m.role !== "owner" ? <MemberMenu member={m} phone /> : <span className="size-11 shrink-0" />}
    </li>
  );
}

function PhoneInvite({ i }: { i: Invite }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-line py-2 pl-4 pr-1">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-3" aria-hidden>
        <Envelope size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-md font-medium leading-[22px] text-ink [overflow-wrap:anywhere]">{i.email}</span>
        <span className="text-sm text-ink-3">
          {inviteSentWords(i)} · <span className={i.expired ? "text-danger" : undefined}>{inviteExpiryWords(i)}</span>
        </span>
        <span className="text-sm font-medium text-ink-2">{roleLabel(i.role)}</span>
      </span>
      <InviteMenu invite={i} />
    </li>
  );
}

export function TeamView({ team, now, joined }: { team: TeamDoc; now: Date; joined?: string | null }) {
  const manage = isOwner(team);
  return (
    <>
      {joined ? (
        <p role="status" className="mb-4 rounded-md bg-info-tint p-3 text-base text-info">
          {joined}
        </p>
      ) : null}
      <TeamLines />
      <TableFrame className="max-md:hidden">
        <Table aria-label="People">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="w-[260px]">Email</Th>
              <Th className="w-[160px]">Role</Th>
              <Th className="w-[150px]">Last active</Th>
              <th scope="col" className="sticky top-0 z-raised h-row-head w-12 border-b border-line bg-subtle p-0">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <MemberRows team={team} now={now} />
            {manage ? <InviteRows invites={team.invites} /> : null}
          </tbody>
        </Table>
      </TableFrame>
      <ul aria-label="People" className="border-t border-line md:hidden">
        {team.members.map((m) => (
          <PhoneMember key={m.userId} m={m} manage={manage} now={now} />
        ))}
        {manage ? team.invites.map((i) => <PhoneInvite key={i.id} i={i} />) : null}
      </ul>
      <section aria-label="What each role can do" className="mt-6 flex max-w-[560px] flex-col rounded-lg border border-line max-md:mt-5">
        <h2 className="border-b border-line px-4 py-3 text-base font-semibold text-ink">What each role can do</h2>
        <dl>
          {ROLES.map((r) => (
            <div key={r.key} className="flex gap-4 border-b border-line px-4 py-2.5 last:border-b-0 max-md:flex-col max-md:gap-0.5">
              <dt className="w-[88px] shrink-0 text-base font-medium text-ink">{r.label}</dt>
              <dd className="text-base text-ink-2">{r.line}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line bg-subtle px-4 py-3 text-sm text-ink-2">{ROLES_NOTE}</p>
      </section>
    </>
  );
}

/** `workspace_team()` failed: an error, never a team of one drawn from nothing. */
export function TeamError() {
  return (
    <ErrorPanel
      title={TEAM_ERROR_TITLE}
      retry={
        <Link href="/app/settings/members" prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
          Try again
        </Link>
      }
    >
      {TEAM_ERROR_BODY}
    </ErrorPanel>
  );
}
