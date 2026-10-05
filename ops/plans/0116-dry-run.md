# 0116 — Sharing by workspace, part 1 (roles and saved suppliers): dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`) on project `stnrfxrxfonwexzcvvpv`: one `do` block that
runs the migration's own text (the three helpers, the three policies, the patch of the seven live functions),
reports what the patch did, reads as the buyer with the most saved suppliers (JWT claims set, role switched to
`authenticated`), and then raises, so everything rolled back. Nothing committed. (No Python here, so the
`ops/dry_run_*.py --print` form was not used.)

```
workspace helpers before     0     (none existed)
the seven live functions     buyer_dashboard, buyer_saved_list, compliance_expired_certs,
                             compliance_expiring_certs, compliance_msa_inputs, compliance_uflpa_tracker,
                             evidence_pack: each now filters saved_suppliers by workspace_owner(), none still
                             by v_uid or auth.uid()   (the patch stopped nothing: every one had a filter)
saved rows visible, as the buyer with the most saved suppliers (new policy)    17
compliance_msa_inputs().total_saved, same buyer                                17   (unchanged for an owner)
workspace_members rows       0     (nobody is on a team yet, so no buyer's view changes)
```

Why the patch edits live definitions: production's copies of several of these functions are ahead of the repo's
(0105's finding), so a `create or replace` from the repo would delete what is only live. The patch changes only
the saved_suppliers filter, and stops the migration (rolling it back) if a function has no such filter to
change. Behaviour (a team member acts for the owner, the role matrix, a team reads the owner's list and a
stranger reads nothing of it, editors and up save and unsave, a viewer cannot, nobody writes another
workspace's rows, the dashboard and compliance totals count the workspace's) is executed by CI on every push:
`supabase/ci/assert-0116.sql`.

Nothing a buyer sees changes on applying: with no member in any workspace (0 rows in `workspace_members`) every
helper answers the caller's own id and own list, as before. The first visible change is when the first invite is
accepted.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0116". The agent re-runs this dry run (still 0 helpers, every function matched) and applies the file
through the Supabase MCP `apply_migration`. The saved-supplier writes in `ds-v4` read `workspace_owner()` with a
fallback to the person's own id, so they work before and after.

Rollback: the lines in the migration's header (policies back to the owner's own rows; the patch run with the two
strings swapped).
