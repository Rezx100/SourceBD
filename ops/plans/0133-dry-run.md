# 0133 — a fingerprint for every file sent in a message

Moderation and evidence plan, item 1c. Migration `supabase/migrations/0133_message_file_fingerprints.sql`:
two columns on `message_attachments` and one function, `message_attachment_fingerprint`, which the
sender (and nobody else) uses once per file. The server computes the sha256 by reading the file back
from the bucket right after the send (`lib/ledger/file-fingerprint.ts`), so the value is the server's
reading of the stored bytes.

Versions for RFQs, quotes and orders, and the fingerprint of a message's text, came with 0131: every
edit is kept with the row before and after.

## Status: NOT RUN against production (6 Oct 2026)

No dry-run script: the migration adds two nullable columns and one function and changes no row. The
read-only check before applying is how many files exist and so have no fingerprint:

```
select count(*) as files_without_fingerprint from public.message_attachments;
```

Those keep no fingerprint (nothing is invented after the fact); the desk says "no fingerprint" for them.
Every file sent after the deploy gets one. CI executes the behaviour on every push:
`supabase/ci/assert-0133.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0133" (after 0131; needs 0112's table, which the migration checks for and otherwise skips
with a notice). Deploy order does not matter: a send before the migration logs "fingerprint refused"
and stays sent.

Rollback: the REVERSE section of the migration.
