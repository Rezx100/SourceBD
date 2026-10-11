"use client";

// What the Team page does (Paper `10 · Settings · Team and roles`): change a role, remove a person,
// leave, resend and cancel an invite, open Invite people. One provider holds the one running call,
// the one sentence it left (an error says what failed and nothing changed; a success says what
// happened, quietly), and the remove question (a dialog; a sheet on a phone). A failure is said
// beside the table, never as a toast.

import { DotsThree, Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, IconButton, Menu, MenuItem, Select, Sheet } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { browserFetch } from "@/components/settings/transport";
import { cn } from "@/lib/utils";
import { InviteDialog } from "./invite";
import { LEAVE_BODY, LEAVE_TITLE, REMOVE_BODY, RESENT_WORDS, TEAM_ROLES, inviteSummary, memberName, removeTitle, resultsOf, roleLabel, type Invite, type Member, type TeamRole } from "./model";
import { cancelInvite, removeMember, resendInvite, setRole, type Posted } from "./transport";

type Asking = { userId: string; name: string; leaving: boolean };

type Ctx = {
  openInvite: () => void;
  changeRole: (m: Member, role: TeamRole) => void;
  askRemove: (m: Member) => void;
  askLeave: (m: Member) => void;
  resend: (i: Invite) => void;
  cancel: (i: Invite) => void;
  busy: string | null;
  error: string | null;
  note: string | null;
};

const TeamActions = createContext<Ctx | null>(null);
const NONE: Ctx = { openInvite() {}, changeRole() {}, askRemove() {}, askLeave() {}, resend() {}, cancel() {}, busy: null, error: null, note: null };
export const useTeamActions = (): Ctx => useContext(TeamActions) ?? NONE;

const deps = { fetch: browserFetch };

export function TeamActionsProvider({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const phone = useIsPhone();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [inviting, setInviting] = useState(0);
  const working = useRef(false);

  const act = useCallback(
    async (key: string, call: () => Promise<Posted>, done?: (r: Posted) => { error?: string; note?: string }): Promise<boolean> => {
      if (working.current) return false;
      working.current = true;
      setBusy(key);
      setError(null);
      setNote(null);
      const r = await call();
      working.current = false;
      setBusy(null);
      if (!r.ok) {
        setError(r.message);
        return false;
      }
      const said = done?.(r) ?? {};
      if (said.error) setError(said.error);
      if (said.note) setNote(said.note);
      router.refresh();
      return true;
    },
    [router],
  );

  const value = useMemo<Ctx>(
    () => ({
      openInvite: () => {
        setError(null);
        setNote(null);
        setInviting((n) => n + 1);
      },
      changeRole: (m, role) => void act(`role:${m.userId}`, () => setRole(m.userId, role, deps), () => ({ note: `${memberName(m)} is now ${roleLabel(role)}.` })),
      askRemove: (m) => setAsking({ userId: m.userId, name: memberName(m), leaving: false }),
      askLeave: (m) => setAsking({ userId: m.userId, name: memberName(m), leaving: true }),
      resend: (i) =>
        void act(`resend:${i.id}`, () => resendInvite(i.id, deps), (r) => {
          const problem = inviteSummary(resultsOf(r.json)).problems[0];
          return problem ? { error: problem.words } : { note: RESENT_WORDS(i.email) };
        }),
      cancel: (i) => void act(`cancel:${i.id}`, () => cancelInvite(i.id, deps), () => ({ note: `The invite to ${i.email} was cancelled.` })),
      busy,
      error,
      note,
    }),
    [act, busy, error, note],
  );

  const confirm = async () => {
    if (!asking) return;
    const who = asking;
    const ok = await act(`remove:${who.userId}`, () => removeMember(who.userId, who.leaving, deps), () => ({ note: who.leaving ? "You left the team." : `${who.name} was removed from your team.` }));
    if (ok) setAsking(null);
  };
  const close = (open: boolean) => {
    if (!open && !working.current) setAsking(null);
  };
  const title = asking ? (asking.leaving ? LEAVE_TITLE : removeTitle(asking.name)) : "";
  const verb = asking?.leaving ? "Leave team" : "Remove";
  const keep = asking?.leaving ? "Stay on the team" : "Keep them";
  const body = (
    <>
      <p>{asking?.leaving ? LEAVE_BODY : REMOVE_BODY}</p>
      {error && asking ? (
        <p role="alert" className="pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );

  return (
    <TeamActions.Provider value={value}>
      {children}
      {inviting > 0 ? (
        <InviteDialog
          key={inviting}
          onClose={() => setInviting(0)}
          onSent={(words) => {
            setNote(words);
            setInviting(0);
            router.refresh();
          }}
        />
      ) : null}
      {phone ? (
        <Sheet
          open={asking !== null}
          onOpenChange={close}
          kind="confirm"
          title={title}
          footer={
            <>
              <Button kind="danger" size="touch" full loading={busy !== null} loadingLabel="Removing" onClick={confirm}>
                {verb}
              </Button>
              <Button kind="secondary" size="touch" full data-autofocus onClick={() => close(false)}>
                {keep}
              </Button>
            </>
          }
        >
          {body}
        </Sheet>
      ) : (
        <Dialog
          open={asking !== null}
          onOpenChange={close}
          kind="confirm"
          title={title}
          footer={
            <>
              <Button kind="secondary" data-autofocus onClick={() => close(false)}>
                {keep}
              </Button>
              <Button kind="danger" loading={busy !== null} loadingLabel="Removing" onClick={confirm}>
                {verb}
              </Button>
            </>
          }
        >
          {body}
        </Dialog>
      )}
    </TeamActions.Provider>
  );
}

/** What the last action said: a failure as an alert, a success as a quiet status line. */
export function TeamLines() {
  const { error, note } = useTeamActions();
  return (
    <>
      {error ? (
        <p role="alert" className="pb-3 text-base text-danger">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className={note ? "pb-3 text-base text-ink-2" : "sr-only"}>
        {note ?? ""}
      </p>
    </>
  );
}

/** `phone`: the full-width button in the bar at the foot of the phone page (Paper `11 · Team and roles`). */
export function InviteButton({ className, phone }: { className?: string; phone?: boolean }) {
  const { openInvite } = useTeamActions();
  if (phone)
    return (
      <Button kind="primary" size="touch" full icon={Plus} onClick={openInvite} className="rounded-lg">
        Invite people
      </Button>
    );
  return (
    <Button kind="primary" onClick={openInvite} className={cn("max-md:h-input-touch max-md:w-full max-md:text-md", className)}>
      Invite people
    </Button>
  );
}

export function LeaveButton({ me, phone }: { me: Member; phone?: boolean }) {
  const { askLeave } = useTeamActions();
  return (
    <Button kind="secondary" size={phone ? "touch" : "md"} full={phone} onClick={() => askLeave(me)} className={phone ? "rounded-lg" : "max-md:h-input-touch max-md:w-full max-md:text-md"}>
      Leave team
    </Button>
  );
}

const ROLE_OPTIONS = TEAM_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

/** The owner's role chooser for one member (a 128 field on a desktop row; on a phone row Paper's 44 "Approver ⌄"). */
export function RoleCell({ member, phone }: { member: Member; phone?: boolean }) {
  const { changeRole, busy } = useTeamActions();
  return (
    <Select
      options={ROLE_OPTIONS}
      value={member.role}
      onValueChange={(v) => v !== member.role && changeRole(member, v as TeamRole)}
      disabled={busy !== null}
      aria-label={`Role of ${memberName(member)}`}
      className={phone ? "h-11 w-auto gap-1 rounded-lg border-line pl-3 pr-2.5 font-medium" : "w-32"}
    />
  );
}

/** A member's menu: Remove (the role is changed in the chooser beside it). */
export function MemberMenu({ member }: { member: Member }) {
  const { askRemove } = useTeamActions();
  return (
    <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${memberName(member)}`} kind="quiet" className="max-md:size-11 max-md:shrink-0" />}>
      <MenuItem onSelect={() => askRemove(member)}>Remove from team</MenuItem>
    </Menu>
  );
}

/** Desktop: "Resend" and "Cancel" as the links Paper draws. Resend is left out when the invite has been sent five times. */
export function InviteLinks({ invite }: { invite: Invite }) {
  const { resend, cancel, busy } = useTeamActions();
  const link = "font-medium underline decoration-1 underline-offset-2 hover:decoration-2 disabled:cursor-not-allowed disabled:text-disabled";
  return (
    <span className="flex gap-3">
      {invite.canResend ? (
        <button type="button" disabled={busy !== null} onClick={() => resend(invite)} className={cn(link, "text-brand-ink")}>
          Resend<span className="sr-only"> invite to {invite.email}</span>
        </button>
      ) : null}
      <button type="button" disabled={busy !== null} onClick={() => cancel(invite)} className={cn(link, "text-ink-2")}>
        Cancel<span className="sr-only"> invite to {invite.email}</span>
      </button>
    </span>
  );
}

/** Phone: "Resend invite" and "Cancel invite" as Paper's two 44 pills. Resend is left out when the invite has been sent five times. */
export function InvitePills({ invite }: { invite: Invite }) {
  const { resend, cancel, busy } = useTeamActions();
  return (
    <span className="flex flex-wrap gap-2">
      {invite.canResend ? (
        <Button kind="quiet" disabled={busy !== null} loading={busy === `resend:${invite.id}`} loadingLabel="Sending" onClick={() => resend(invite)} className="h-11 rounded-full bg-sunken px-3.5 text-ink hover:bg-sunken active:bg-line">
          Resend invite<span className="sr-only"> to {invite.email}</span>
        </Button>
      ) : null}
      <Button kind="quiet" disabled={busy !== null} loading={busy === `cancel:${invite.id}`} loadingLabel="Cancelling" onClick={() => cancel(invite)} className="h-11 rounded-full px-3.5">
        Cancel invite<span className="sr-only"> to {invite.email}</span>
      </Button>
    </span>
  );
}
