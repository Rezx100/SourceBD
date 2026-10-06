// Every Team change, out of React so a test can run it with an injected `fetch` (the pattern of
// `components/settings/transport.ts`, whose `send` this uses). One route, `POST /api/v1/team {action, …}`.
// A sentence the route wrote is shown as it is; anything else is the action's own sentence below.

import { send, type Fetch, type Posted } from "@/components/settings/transport";
import type { TeamRole } from "./model";

export type { Fetch, Posted };

const post = (body: Record<string, unknown>, failed: string, deps: { fetch: Fetch }) =>
  send("/api/v1/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, failed, deps);

export const FAILED = {
  invite: "Could not send the invites. Nothing was sent.",
  resend: "Could not resend the invite.",
  cancel: "Could not cancel the invite.",
  role: "Could not change the role. Nothing was changed.",
  remove: "Could not remove them. Nothing was changed.",
  leave: "Could not leave the team. Nothing was changed.",
} as const;

export const inviteEmails = (emails: readonly string[], role: TeamRole, deps: { fetch: Fetch }) => post({ action: "invite", emails, role }, FAILED.invite, deps);
export const resendInvite = (id: string, deps: { fetch: Fetch }) => post({ action: "resend", id }, FAILED.resend, deps);
export const cancelInvite = (id: string, deps: { fetch: Fetch }) => post({ action: "cancel", id }, FAILED.cancel, deps);
export const setRole = (member: string, role: TeamRole, deps: { fetch: Fetch }) => post({ action: "set_role", member, role }, FAILED.role, deps);
export const removeMember = (member: string, leaving: boolean, deps: { fetch: Fetch }) => post({ action: "remove", member }, leaving ? FAILED.leave : FAILED.remove, deps);
