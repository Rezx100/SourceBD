// /api/v1/team — Team and roles (gap 4, migration 0111).
//
// POST {action:'invite', emails, role}  → workspace_invite, then one email per new invite
// POST {action:'resend', id}            → workspace_invite_resend, then the email
// POST {action:'cancel', id}            → workspace_invite_cancel
// POST {action:'set_role', member, role}→ workspace_member_set_role
// POST {action:'remove', member}        → workspace_member_remove (the owner removes; a member leaves)
//
// Every call runs under the signed-in user's session: the database says who may do what, and its refusal
// words (owner only, a cap, no such invite) become plain sentences here. The raw invite token comes back
// from the database once, goes into the email's link and nowhere else: it is never logged and never
// leaves in a response. `/api/v1` POSTs are `api_write` limited by the middleware.

import { NextResponse } from "next/server";

import { TEAM_ROLES, roleLabel, type InviteStatus, type TeamRole } from "@/components/team/model";
import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { EmailError, sendEmail } from "@/lib/email/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type DbError = { message: string; code?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;
const MAX_EMAILS = 20;

const refuse = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** A database refusal as a sentence. The migration wrote the words for caps and bad input; the rest are ours. */
function refusal(err: DbError): NextResponse {
  const said = err.message.trim().replace(/^./, (c) => c.toUpperCase());
  switch (err.code) {
    case "42501":
      return refuse("Only the account owner can change the team.", 403);
    case "P0002":
      return refuse("That invite or person is no longer there. Refresh the page.", 404);
    case "54000":
      return refuse(said.endsWith(".") ? said : `${said}.`, 409);
    case "22023":
      return refuse(said.endsWith(".") ? said : `${said}.`, 400);
    default:
      return NextResponse.json({ error: "team call failed", detail: err.message }, { status: 502 });
  }
}

/** Who the email says invited them: the display name, else the email, and the company if there is one. Best effort. */
async function inviterOf(supabase: Sb): Promise<{ name: string; company: string | null }> {
  try {
    const { data } = await supabase.rpc("settings_get");
    const s = (data ?? {}) as { display_name?: unknown; email?: unknown; workspace?: { company_name?: unknown } | null };
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return { name: text(s.display_name) ?? text(s.email) ?? "A colleague", company: text(s.workspace?.company_name) };
  } catch {
    return { name: "A colleague", company: null };
  }
}

/** One invite's email. A failed send is a status, never a throw: the invite exists and can be resent. */
async function emailInvite(opts: { to: string; token: unknown; role: TeamRole; inviteId: unknown; origin: string; inviter: { name: string; company: string | null } }): Promise<InviteStatus> {
  if (typeof opts.token !== "string" || !TOKEN_RE.test(opts.token)) return "not_emailed";
  try {
    await sendEmail({
      to: opts.to,
      template: "team_invite",
      data: { link: `${opts.origin}/invite/${opts.token}`, inviterName: opts.inviter.name, companyName: opts.inviter.company, roleLabel: roleLabel(opts.role) },
      refId: typeof opts.inviteId === "string" ? `team_invite:${opts.inviteId}` : null,
    });
    return "sent";
  } catch (err) {
    console.warn(`[team-invite] send failed: ${err instanceof EmailError ? err.message : "unknown error"}`);
    return "not_emailed";
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refuse("unauthorised", 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return refuse("invalid json");
  }
  const action = typeof body.action === "string" ? body.action : "";
  const role = TEAM_ROLES.find((r) => r === body.role);
  const uuid = (key: string): string | null => (typeof body[key] === "string" && UUID_RE.test(body[key] as string) ? (body[key] as string) : null);

  if (action === "invite") {
    const raw = body.emails;
    if (!Array.isArray(raw) || raw.length === 0 || raw.some((e) => typeof e !== "string")) return refuse("Give at least one email address.");
    const emails = [...new Set((raw as string[]).map((e) => e.trim().toLowerCase()))];
    if (emails.length > MAX_EMAILS) return refuse(`You can invite up to ${MAX_EMAILS} people at a time.`);
    if (emails.some((e) => !EMAIL_RE.test(e) || e.length > 254)) return refuse("One of the emails is not an email address.");
    if (!role) return refuse("Choose a role for them.");
    // The link's address is settled before any invite exists: a missing origin must not leave an invite nobody was told of.
    let origin: string;
    try {
      origin = getCanonicalAppOrigin(req.headers);
    } catch (err) {
      return NextResponse.json({ error: "app_origin_unavailable", detail: err instanceof AppOriginError ? err.message : "no origin" }, { status: 500 });
    }
    const { data, error } = await supabase.rpc("workspace_invite", { p_emails: emails, p_role: role });
    if (error) return refusal(error);
    const inviter = await inviterOf(supabase);
    const results: { email: string; status: InviteStatus }[] = [];
    for (const row of Array.isArray(data) ? (data as Record<string, unknown>[]) : []) {
      if (typeof row?.email !== "string") continue;
      if (row.status === "sent") {
        results.push({ email: row.email, status: await emailInvite({ to: row.email, token: row.token, role, inviteId: row.id, origin, inviter }) });
      } else if (row.status === "already_member" || row.status === "recently_sent" || row.status === "you") {
        results.push({ email: row.email, status: row.status });
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  if (action === "resend") {
    const id = uuid("id");
    if (!id) return refuse("That invite could not be found.");
    let origin: string;
    try {
      origin = getCanonicalAppOrigin(req.headers);
    } catch (err) {
      return NextResponse.json({ error: "app_origin_unavailable", detail: err instanceof AppOriginError ? err.message : "no origin" }, { status: 500 });
    }
    const { data, error } = await supabase.rpc("workspace_invite_resend", { p_id: id });
    if (error) return refusal(error);
    const row = (data ?? {}) as Record<string, unknown>;
    const inviteRole = TEAM_ROLES.find((r) => r === row.role) ?? "viewer";
    const email = typeof row.email === "string" ? row.email : "";
    const status = email ? await emailInvite({ to: email, token: row.token, role: inviteRole, inviteId: row.id, origin, inviter: await inviterOf(supabase) }) : "not_emailed";
    return NextResponse.json({ ok: true, results: [{ email, status }] });
  }

  if (action === "cancel") {
    const id = uuid("id");
    if (!id) return refuse("That invite could not be found.");
    const { error } = await supabase.rpc("workspace_invite_cancel", { p_id: id });
    return error ? refusal(error) : NextResponse.json({ ok: true });
  }

  if (action === "set_role") {
    const member = uuid("member");
    if (!member) return refuse("That person could not be found.");
    if (!role) return refuse("Choose Approver, Editor or Viewer.");
    const { error } = await supabase.rpc("workspace_member_set_role", { p_member: member, p_role: role });
    return error ? refusal(error) : NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    const member = uuid("member");
    if (!member) return refuse("That person could not be found.");
    const { error } = await supabase.rpc("workspace_member_remove", { p_member: member });
    return error ? refusal(error) : NextResponse.json({ ok: true });
  }

  return refuse("unknown action; expected one of invite|resend|cancel|set_role|remove");
}
