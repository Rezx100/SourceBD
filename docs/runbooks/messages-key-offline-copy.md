# The message key: an offline copy, and point-in-time recovery

Moderation and evidence plan, item 0c. Two founder actions; nothing here is run by code.

## 1. Why

Every message body is encrypted at rest with one key (`pgp_sym_encrypt`, migration 0027). The
key lives in one place: the database setting `app.messages_key`, or, where that could not be
set, one row of `public.app_private_settings` (migration 0078). If that row is lost, every
message ever sent is unreadable, and no backup of the messages helps, because the backup holds
the same ciphertext. A record for a court that cannot be read is no record.

## 2. The offline copy (once; again after any rotation)

1. In the Supabase SQL editor, as the project owner, run:

   ```
   select public._messages_key();
   ```

   It returns one 64-character hex string. Do not paste it anywhere else in the editor, a chat,
   a ticket or this repository.

2. Store it in two places the company does not control from the same login:
   - the founder's password manager, as a secure note named `SourceBD messages key (production)`
     with today's date; and
   - a printed copy in a sealed envelope, dated and signed across the seal, kept where the
     company's other paper records are kept.

3. Prove the copy is right, without revealing it: in the SQL editor run

   ```
   select md5(public._messages_key());
   ```

   and write that md5 on the envelope and in the note. Anyone can later check a copy against it
   without seeing the key.

4. Record the date and the md5 (not the key) in `context/current-state.md` under the production
   migration ledger, so the next person knows a copy exists.

If the key is ever rotated (`ops/configure_messages_key.py --rotate`), the old messages stay
encrypted under the OLD key: keep the old copy and add the new one. Rotation is not planned.

## 3. Point-in-time recovery (PITR)

The backup runbook (`docs/runbooks/backup-restore.md`) says the recovery point is 24 hours: one
nightly backup, so up to a day of records could be lost in a failure. For an evidence record a
day is too much. Supabase offers PITR as an add-on on the Pro plan (Dashboard → Project
Settings → Add-ons → Point in Time Recovery), with a recovery point of about two minutes.

1. Confirm the project's plan and whether PITR is on (Dashboard → Project Settings → Add-ons).
2. If it is off, turn it on (it is a paid add-on; the founder decides) and note the day it
   started: recovery is possible only from that day forward.
3. Update `docs/runbooks/backup-restore.md`: the RPO line, and a PITR restore step (Dashboard →
   Database → Backups → Point in time → choose the time).
4. Record the answer (on since <date>, or off and why) in `context/current-state.md`.

## 4. What the activity record adds later

The hourly seals (plan phase 1e) are emailed daily to a mailbox outside the company's control,
so even a database restored to an earlier point can be checked against the seal chain: a
restore that lost entries shows as a broken seal, and the pack says so.
