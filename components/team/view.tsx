// The Team page's body (Paper `10 · Settings · Team and roles`, `11 · Team and roles`): the people in a
// table from 768 (name, email, role, last active), the invites waiting as shaded rows under them, and on
// a phone (Paper `11 · Team and roles`) the people as a card, each other person's role chooser at the
// row's end, the invites waiting as cards with Resend and Cancel; then "What each role can do". Server component; the
// controls in it are the client islands of `actions.tsx`. The owner changes roles and removes people; a
// member sees the same table with nothing to change.

import { Envelope } from "@phosphor-icons/react/dist/ssr";
import { ErrorPanel, Table, TableFrame, Td, Th, Tr, buttonClass } from "@/components/kit";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { InviteLinks, InvitePills, MemberMenu, RoleCell, TeamLines } from "./actions";
import { ROLES, ROLES_NOTE, TEAM_ERROR_BODY, TEAM_ERROR_TITLE, initialsOf, inviteEndsWords, inviteExpiryWords, inviteSentWords, isOwner, joinsAsWords, lastActiveWords, memberName, phoneActiveWords, roleLabel, type Invite, type Member, type TeamDoc } from "./model";

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

/** A phone section's head (Paper `11 · Team and roles`): its name and, beside it, how many. */
function PhoneHead({ title, count, first }: { title: string; count?: number; first?: boolean }) {
  return (
    <h2 className={cn("flex items-baseline gap-2 pb-3.5 text-lg font-medium tracking-tight text-ink", first ? "pt-4" : "pt-6")}>
      {title}
      {count !== undefined ? <span className="font-normal tracking-normal text-ink-3">{count}</span> : null}
    </h2>
  );
}

function PhoneMember({ m, manage, now }: { m: Member; manage: boolean; now: Date }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-t border-line py-2.5 pl-4 pr-3 first:border-t-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-sm/[16px] font-semibold text-ink-2" aria-hidden>
        {initialsOf(m.name, m.email)}
      </span>
      <span className="flex min-w-0 grow basis-0 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 text-md/[22px] font-medium text-ink [overflow-wrap:anywhere]">{memberName(m)}</span>
          {m.isYou ? <span className="text-xs font-medium text-ink-3">you</span> : null}
        </span>
        <span className="text-sm text-ink-3">{phoneActiveWords(m.lastActiveAt, now)}</span>
      </span>
      {manage && m.role !== "owner" ? (
        <span className="flex shrink-0 items-center">
          <RoleCell member={m} phone />
          <MemberMenu member={m} />
        </span>
      ) : (
        <span className="shrink-0 px-1 text-base font-medium text-ink-2">{roleLabel(m.role)}</span>
      )}
    </li>
  );
}

function PhoneInvite({ i }: { i: Invite }) {
  return (
    <li data-invite={i.id} className="flex flex-col gap-2.5 rounded-[10px] border border-line p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <Envelope size={16} className="shrink-0" aria-hidden />
        <span>
          {inviteSentWords(i)} · <span className={i.expired ? "text-danger" : undefined}>{inviteEndsWords(i)}</span>
        </span>
      </span>
      <span className="text-md/[22px] font-medium text-ink [overflow-wrap:anywhere]">{i.email}</span>
      <span className="text-sm text-ink-2">{joinsAsWords(i.role)}</span>
      <InvitePills invite={i} />
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
      <div className="md:hidden">
        <PhoneHead title="People" count={team.members.length} first />
        <ul aria-label="People" className="overflow-clip rounded-[10px] border border-line md:hidden">
          {team.members.map((m) => (
            <PhoneMember key={m.userId} m={m} manage={manage} now={now} />
          ))}
        </ul>
        {manage && team.invites.length > 0 ? (
          <>
            <PhoneHead title="Waiting" count={team.invites.length} />
            <ul aria-label="Invites waiting" className="flex flex-col gap-3">
              {team.invites.map((i) => (
                <PhoneInvite key={i.id} i={i} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <section aria-label="What each role can do" className="mt-6 flex max-w-[560px] flex-col rounded-lg border border-line max-md:mt-0 max-md:rounded-none max-md:border-0">
        <h2 className="border-b border-line px-4 py-3 text-base font-semibold text-ink max-md:border-0 max-md:px-0 max-md:pb-3.5 max-md:pt-6 max-md:text-lg max-md:font-medium max-md:tracking-tight">What each role can do</h2>
        <dl className="max-md:overflow-clip max-md:rounded-[10px] max-md:border max-md:border-line">
          {ROLES.map((r) => (
            <div key={r.key} className="flex gap-4 border-b border-line px-4 py-2.5 last:border-b-0 max-md:gap-2.5 max-md:py-3">
              <dt className="w-[88px] shrink-0 text-base font-medium text-ink max-md:w-24">{r.label}</dt>
              <dd className="text-base text-ink-2 max-md:text-sm/[20px]">{r.line}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line bg-subtle px-4 py-3 text-sm text-ink-2 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:pb-0 max-md:pt-4 max-md:text-xs max-md:text-ink-3">{ROLES_NOTE}</p>
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
