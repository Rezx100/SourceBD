// Team and roles (gap 4; Paper `10 · Settings · Team and roles`, `Invite people dialog`): the shape
// `workspace_team()` returns, read defensively, and every sentence the page and the invite say. Kept
// out of React so a test reads them. A reply that is not the shape is null, never a half-drawn team.

import { formatDay } from "@/lib/dashboard/facts";

export type TeamRole = "approver" | "editor" | "viewer";
export type Role = TeamRole | "owner";

export const TEAM_ROLES: readonly TeamRole[] = ["approver", "editor", "viewer"];

/** Paper's "What each role can do", in its order, and the line the invite's role cards carry. */
export const ROLES: readonly { key: Role; label: string; line: string }[] = [
  { key: "owner", label: "Owner", line: "Everything, plus the plan and the team." },
  { key: "approver", label: "Approver", line: "Signs off quotes and the modern slavery statement." },
  { key: "editor", label: "Editor", line: "Searches, saves suppliers, sends RFQs, accepts quotes." },
  { key: "viewer", label: "Viewer", line: "Reads records and downloads evidence. Can't send RFQs." },
];

export const roleLabel = (r: Role): string => ROLES.find((x) => x.key === r)?.label ?? "Member";

export type Member = { userId: string; name: string | null; email: string; role: Role; lastActiveAt: string | null; isYou: boolean };
export type Invite = { id: string; email: string; role: TeamRole; sentAt: string; expiresAt: string; expired: boolean; canResend: boolean };
export type TeamDoc = { ownerId: string; myRole: Role; members: Member[]; invites: Invite[] };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const isRole = (v: unknown): v is Role => v === "owner" || TEAM_ROLES.includes(v as TeamRole);

/** `workspace_team()` as the page uses it, or null when the reply is not that shape. */
export function parseTeam(raw: unknown): TeamDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ownerId = str(r.owner_id);
  if (!ownerId || !isRole(r.my_role) || !Array.isArray(r.members) || !Array.isArray(r.invites)) return null;
  const members: Member[] = [];
  for (const m of r.members as Record<string, unknown>[]) {
    const userId = str(m?.user_id);
    const email = str(m?.email);
    if (!userId || !email || !isRole(m.role)) return null;
    members.push({ userId, name: str(m.name), email, role: m.role, lastActiveAt: str(m.last_active_at), isYou: m.is_you === true });
  }
  const invites: Invite[] = [];
  for (const i of r.invites as Record<string, unknown>[]) {
    const id = str(i?.id);
    const email = str(i?.email);
    const sentAt = str(i?.sent_at);
    const expiresAt = str(i?.expires_at);
    if (!id || !email || !sentAt || !expiresAt || !TEAM_ROLES.includes(i.role as TeamRole)) return null;
    invites.push({ id, email, role: i.role as TeamRole, sentAt, expiresAt, expired: i.expired === true, canResend: i.can_resend === true });
  }
  return { ownerId, myRole: r.my_role, members, invites };
}

export const isOwner = (t: TeamDoc): boolean => t.myRole === "owner";
export const memberName = (m: Pick<Member, "name" | "email">): string => m.name?.trim() || m.email;

/** "3 people · 1 invite waiting". */
export function countsLine(t: TeamDoc): string {
  const n = t.members.length;
  const people = `${n} ${n === 1 ? "person" : "people"}`;
  const m = t.invites.length;
  return m > 0 ? `${people} · ${m} ${m === 1 ? "invite" : "invites"} waiting` : people;
}

const ACTIVE_NOW_MS = 10 * 60 * 1000;

/** "Active now" inside ten minutes (the stamp is written no more often than that), else the day, else "Not yet". */
export function lastActiveWords(iso: string | null, now: Date): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "Not yet";
  return now.getTime() - t < ACTIVE_NOW_MS ? "Active now" : (formatDay(iso) ?? "Not yet");
}

/** The phone row's line and the desktop row's two parts. */
export const inviteSentWords = (i: Pick<Invite, "sentAt">): string => `Invite sent ${formatDay(i.sentAt) ?? "recently"}`;
export const inviteExpiryWords = (i: Pick<Invite, "expiresAt" | "expired">): string => `${i.expired ? "expired" : "expires"} ${formatDay(i.expiresAt) ?? "soon"}`;

/** Paper's two-letter tile on a phone row: the name's first and last initials, else the email's first two letters. */
export function initialsOf(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
  return ((words[0] ?? email.replace(/@.*/, "")).slice(0, 2) || "?").toUpperCase();
}

/** The banner a person sees once, after joining: "You joined Alex Morgan's team as Editor." */
export function joinedWords(t: TeamDoc): string | null {
  if (isOwner(t)) return null;
  const owner = t.members.find((m) => m.role === "owner");
  return `You joined ${owner ? memberName(owner) : "a"}'s team as ${roleLabel(t.myRole)}.`;
}

// ------------------------------------------------------------------ Invite people

export const MAX_INVITES = 20;
export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const INVITE_NOTE = "They get an email with a link. It expires in 7 days.";

/** What was typed or pasted, split on commas, semicolons and spaces, lower case, `<>` around an address dropped. */
export const splitEmails = (text: string): string[] =>
  text
    .split(/[\s,;]+/)
    .map((s) => s.replace(/^<|>$/g, "").trim().toLowerCase())
    .filter(Boolean);

/** Adds what was typed to the addresses already chosen: a valid new one joins, a repeat is dropped, anything else is returned as `bad`. */
export function addEmails(have: readonly string[], text: string): { list: string[]; bad: string[] } {
  const list = [...have];
  const bad: string[] = [];
  for (const e of splitEmails(text)) {
    if (!EMAIL_RE.test(e) || e.length > 254) bad.push(e);
    else if (!list.includes(e)) list.push(e);
  }
  return { list, bad };
}

export const sendLabel = (n: number): string => (n === 1 ? "Send 1 invite" : n > 1 ? `Send ${n} invites` : "Send invites");

export type InviteStatus = "sent" | "already_member" | "recently_sent" | "you" | "not_emailed";
export type InviteResult = { email: string; status: InviteStatus };

const STATUSES: readonly string[] = ["sent", "already_member", "recently_sent", "you", "not_emailed"];

/** The route's `results`, read defensively. */
export const resultsOf = (json: unknown): InviteResult[] => {
  const raw = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): InviteResult[] => (typeof r?.email === "string" && STATUSES.includes(r?.status) ? [{ email: r.email, status: r.status as InviteStatus }] : []));
};

const PROBLEM: Record<Exclude<InviteStatus, "sent">, string> = {
  already_member: "is already on your team.",
  recently_sent: "was invited a moment ago. You can send it again in 10 minutes.",
  you: "is your own address.",
  not_emailed: "has an invite, but the email could not be sent. Resend it in 10 minutes, or cancel it and invite again.",
};

/** How many went out, and one sentence for each address that did not. */
export function inviteSummary(results: readonly InviteResult[]): { sent: number; sentWords: string | null; problems: { email: string; words: string }[] } {
  const sent = results.filter((r) => r.status === "sent").length;
  return {
    sent,
    sentWords: sent > 0 ? `${sent} ${sent === 1 ? "invite" : "invites"} sent.` : null,
    problems: results.flatMap((r) => (r.status === "sent" ? [] : [{ email: r.email, words: `${r.email} ${PROBLEM[r.status]}` }])),
  };
}

export const RESENT_WORDS = (email: string) => `Invite sent again to ${email}.`;

// ------------------------------------------------------------------ Remove and leave

export const removeTitle = (name: string): string => `Remove ${name} from your team?`;
export const REMOVE_BODY = "They will no longer be on your team. You can invite them again later.";
export const LEAVE_TITLE = "Leave this team?";
export const LEAVE_BODY = "You will no longer be on this team. You keep your own account, and the owner can invite you again.";

export const TEAM_ERROR_TITLE = "We couldn't load your team.";
export const TEAM_ERROR_BODY = "Check your connection. Nothing on your team has changed.";

/** What the roles card says about today, so a role is never read as more than it does. */
export const ROLES_NOTE = "Each person still works in their own account. Sharing saved suppliers, RFQs and the rest by role comes next.";

// ------------------------------------------------------------------ The invite link's page

export type InviteRefusal = "not_found" | "expired" | "wrong_email" | "has_team" | "failed";

export const REFUSALS: Record<InviteRefusal, { title: string; body: string }> = {
  not_found: { title: "This invite link doesn't work.", body: "It may have been used already, cancelled, or replaced by a newer one. Ask whoever invited you to send it again." },
  expired: { title: "This invite has expired.", body: "Invites last 7 days. Ask whoever invited you to send a new one." },
  wrong_email: { title: "This invite was sent to a different address.", body: "Sign out, then open the link in the email again and sign in or sign up with the address it was sent to." },
  has_team: { title: "You can't join this team.", body: "You are already on a team, or you have invited people of your own. A person can be on one team at a time." },
  failed: { title: "We couldn't check this invite.", body: "Nothing was changed. Try the link again in a moment." },
};

/** The word the database refused with (`not_found`, `expired`, `wrong_email`, `has_team`), else `failed`. */
export const refusalOf = (message: string | null | undefined): InviteRefusal => {
  const m = (message ?? "").trim();
  return m === "not_found" || m === "expired" || m === "wrong_email" || m === "has_team" ? m : "failed";
};

export const INVITE_TOKEN_RE = /^[0-9a-f]{64}$/;
