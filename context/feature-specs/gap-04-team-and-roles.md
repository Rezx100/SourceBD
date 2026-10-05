# Gap 4 — Team and roles (data and access)

Paper gap list row 4. Boards: `10-App-Desktop-Products-settings/Settings-Team-and-roles-…[IOJ-0]`,
`Invite-people-dialog-…[IUW-0]` and their phone twins in `11-…`. Status: **migration written and dry-run, not
applied** (`0111_workspace_team.sql`, `ops/plans/0111-dry-run.md`). Screens are Sonnet's, below.

## What is stored

- A workspace is a buyer's account; its id is the owner's user id (one owner, never handed over).
- `workspace_members(owner_id, member_id, role approver|editor|viewer, invited_by, joined_at)`. A person is in at
  most one other workspace, and someone who owns a team (members or open invites) cannot join another.
- `workspace_invites`: email (lower case), role, sha256 of the token, sent_at, send_count (max 5), expires_at
  (7 days), accepted_at / cancelled_at (rows kept for the daily cap).
- `profiles.last_active_at`, stamped by `profile_touch()` at most every 10 minutes.
- Caps: 20 emails a call, 50 people (members plus open invites), 50 new invites a day, 5 sends per invite, a
  resend at most every 10 minutes.

## The calls (all `authenticated`, none `anon`)

| Call | Who | Returns |
| --- | --- | --- |
| `workspace_team()` | anyone signed in | `{owner_id, my_role, members[{user_id,name,email,role,joined_at,last_active_at,is_you}], invites[{id,email,role,sent_at,expires_at,expired,can_resend}]}`; owner first; invites only for the owner |
| `workspace_invite(emails[], role)` | owner | per email `{email, status: sent\|already_member\|recently_sent\|you, id, token}`; the raw token is for the email link, never stored |
| `workspace_invite_resend(id)` | owner | `{id, email, role, token}` (new token; the old link stops working) |
| `workspace_invite_cancel(id)` | owner | nothing |
| `workspace_invite_accept(token)` | the invited buyer, signed in with that email | `{owner_id, role}`; refusals say `not_found`, `expired`, `wrong_email`, `has_team` |
| `workspace_member_set_role(member, role)` | owner | nothing |
| `workspace_member_remove(member)` | owner, or the member themselves (Leave team) | nothing |
| `profile_touch()` | anyone signed in | nothing; call from the buyer layout, fire and forget |

Errors: `42501` not allowed, `22023` bad input, `54000` a cap, `P0002` no such invite or member.

## For Sonnet (the screens)

1. Team and roles page: `workspace_team()`; "N people · M invites waiting"; Last active = "Active now" within
   10 minutes, else the date, else "Not yet"; Resend and Cancel on each invite (owner only; Resend hidden when
   `can_resend` is false); role menu and Remove on members (owner only); Leave team for a member; the "What each
   role can do" list as drawn. Drop the "Contact support" fallback once 0111 is applied.
2. Invite people dialog → a POST route that calls `workspace_invite` under the user's session and sends one email
   per `sent` row with the link `/invite/<token>` (`lib/email/send.ts`; the route is under `/api/v1`, so
   `api_write` limits it). Never log or return the token to the browser.
3. `/invite/[token]`: signed out → sign in or sign up, then back; signed in → `workspace_invite_accept`, then the
   app with a "You joined <owner's company> as Editor" note; each refusal word gets its own plain sentence.
4. `profile_touch()` from the buyer layout.

## Next: gap 4b (Opus), what a role lets a member see and do

Nothing here changes what a member sees: every buyer table and RPC is keyed by `auth.uid()`. 4b reads by workspace,
one table group per migration, saved suppliers first (onboarding data map, step 10), then saved searches, RFQs and
quotes, orders, products, messages, compliance, settings. Each adds the role checks from the board (Viewer reads
and downloads, Editor also saves, sends RFQs and accepts quotes, Approver also signs off quotes and the statement,
Owner also the plan and the team). Not decided: whether seats wait for an Enterprise plan (the beta is free; no
gate is built).
