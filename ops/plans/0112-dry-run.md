# 0112 — Messages: unread, read ticks, the last line, files: dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`), the SQL printed by
`python ops/dry_run_0112_messages_unread_files.py --print`. One `do` block that
applies the migration and then raises, so everything rolled back. Nothing committed.

Migration text md5 (LF, whole-line comments and blank lines removed, as run):
`4a53d76e66283a2f7d534426aa1b691b`. Live `thread_list` before: md5 `7cc12e95…`,
live `thread_messages`: md5 `a2efb30b…` (both replaced by this migration).

```
existed_before        column false, table false, bucket false, new functions false
                      participants 12, conversations 7, messages 5
participants_stamped  12      (every read marker set to the moment of applying)
attachments_rls_on    true
attachments_grants    0
bucket_public         false
storage_policies      2       (participant insert into own folder, participant read)
functions_ok          true    (5: SECURITY DEFINER, authenticated yes, anon no)
participants_read     12
reads_as_expected     true    (for all 12: badge 0, every conversation 0 unread,
                               thread_messages returns every message as before)
```

The only existing rows that change are the 12 read markers (null to now), so no
old conversation lights up as unread. Behaviour (a reply is unread until marked
read, the list's last line, a file message with its name and size, "read" once
the other side reads, another person's file, a missing file, a stranger and anon
refused) is executed by CI on every push: `supabase/ci/assert-0112.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0112". The agent re-runs this dry run (still `existed_before` all
false, live md5s as above) and applies the file through the Supabase MCP
`apply_migration`. Safe before the new inbox ships: the old pages ignore the
added keys. Note: `thread_list` and `thread_messages` stop being callable by
`anon` (they returned nothing to anon before).

Rollback: the lines in the migration's header, then 0035's `thread_list` and
0027's `thread_messages`.
