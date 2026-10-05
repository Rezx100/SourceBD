# Gap 4b — Sharing by workspace: what each role can read and change

Paper gap list row 4b. Follows gap 4 (Team and roles, `0111`, applied 5 Oct), which lists people and invites and
changes nothing else. Today every buyer table and call is keyed by `auth.uid()`: a member of a team sees an empty
account of their own. 4b makes a member work on the owner's data, by role. Status: **part 1 written and dry-run, not
applied** (`0116_workspace_sharing_saved_suppliers.sql`, `ops/plans/0116-dry-run.md`).

## The model (decided; the rest of 4b follows it)

- A workspace is the owner's account; its id is the owner's user id (0111). A person is in at most one other
  workspace. `workspace_owner()` answers "whose data am I working on": the owner of the workspace they were invited
  into, or themselves.
- Reads and writes of a shared table are keyed by `workspace_owner()`, never by a caller-supplied id. A member's rows
  from before joining are kept and not shown while they are on a team; leaving or being removed brings them back.
- Roles include the ones below them. One function, `workspace_can(action)`, is the matrix, so no group invents
  its own words:

| Action | Viewer | Editor | Approver | Owner |
| --- | --- | --- | --- | --- |
| read (records, saved, RFQs, orders, evidence, compliance) | yes | yes | yes | yes |
| save, send RFQs, orders, messages, accept quotes (`save`, `rfq_send`, `order`, `message`, `quote_accept`) | no | yes | yes | yes |
| sign off (`sign_off`: quotes and the modern slavery statement) | no | no | yes | yes |
| company details, team, plan (`company`, `team`, `plan`) | no | no | no | yes |

  An action that is not in the list is refused. Paper's line for the Editor says "accepts quotes" and for the Approver
  "signs off quotes": both are in the table; "sign off" has no screen yet.
- A member's own sending identity stays theirs: messages and RFQs are written under the owner's workspace and name the
  member who made them (`created_by`, added with each group), so the owner can see who did what.

## The groups, one migration each

| # | Group | Tables and calls (keyed by `auth.uid()` today) | Status |
| --- | --- | --- | --- |
| 1 | Roles, saved suppliers, and the totals over them | `workspace_owner/role/can`; `saved_suppliers` policies; `buyer_saved_list`, `buyer_dashboard`, `compliance_*` (4), `evidence_pack` | **0116, written, dry-run** |
| 2 | Saved searches and the last search | `saved_searches` policies, `buyer_last_search*`, the alert job's owner email | next |
| 3 | RFQs and quotes | `rfqs`, `rfq_quotes` reads, `rfq_*` calls, drafts | after 2 |
| 4 | Messages | `message_threads`, participants (a thread belongs to the workspace, each member reads it) | after 3 |
| 5 | Orders | `orders`, `order_*` calls | after 3 |
| 6 | Products, settings | `buyer_products`, `buyer_settings` (company details owner only), RFQ templates | last |

Each group: the policies or calls, `assert-NNNN.sql` that a Viewer cannot write and a stranger cannot read, a dry run,
then "apply". Functions that exist live and differ from the repo are patched in place, not rewritten (0116's patch
shows how, and stops when a function has nothing to change).

## Group 1, what is built

- `workspace_owner()`, `workspace_role()`, `workspace_can(action)`; three `saved_suppliers` policies (read the owner's,
  editor and up save and unsave); the seven live functions that total saved suppliers now count the workspace's.
- The app: the save and unsave routes write `owner_id` as `workspace_owner()` (fallback: the person's own id, so they
  work before 0116 is applied) and answer 403 "Your role can't save suppliers." for a Viewer
  (`lib/workspace.ts`, `lib/saved-suppliers.ts`, `app/api/v1/saved/route.ts`).

## For Sonnet, once 0116 is applied

1. The role in the shell: a read of `workspace_role()` beside the layout's other reads, and Save, Remove and the
   bulk bar's "Remove from saved" drawn disabled for a Viewer with the reason, instead of a 403 after the click.
2. Team and roles: drop the line "Each person still works in their own account until gap 4b shares data by role" once
   group 1 is applied, and say what each role can do now (the table above).
3. Settings: a member who is not the owner sees Company details, Team, Plan read-only (group 6).

Not decided: whether seats wait for an Enterprise plan (the beta is free; no gate is built).
