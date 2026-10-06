# 0135 — hourly seals, the daily outside stamp, and Verify

Moderation and evidence plan, item 1e. Migration `supabase/migrations/0135_ledger_seals.sql`.

## What it does

- **Seals.** `ledger_seal()` writes one `activity_seals` row per finished hour: the sha256 of every entry in
  the hour (one line each, in id order) and a seal hash that also takes in the previous seal's hash. Change
  any old entry and its hour's hash changes, so that seal and every seal after it no longer match. A seal is
  never rewritten; its only later change is its outside stamp, once.
- **Stamp.** Each day the job asks an RFC 3161 timestamp authority (`LEDGER_TSA_URL`, default
  freetsa.org; founder's decision 2) to sign the newest seal's hash, stores the token on the seal, and emails
  the seal, the chain's verdict and the token (.tsr) to `LEDGER_STAMP_MAILBOX`, which must be outside the
  company's control. The email goes even when the authority is down: a dated third-party copy of the hash
  is the point.
- **Verify.** `ledger_verify()` recomputes every seal from the entries and the chain and names the first
  break. The daily job runs it; the "Verify now" button on the admin Audit log page runs it on demand; the
  page shows the last verdict, the last seal and the last stamp.

## Status: NOT RUN against production (6 Oct 2026)

The migration adds one table and seven functions, writes nothing, and changes no row. Nothing to dry-run
beyond the CI replay (`supabase/ci/assert-0135.sql`: three past hours become chained seals and the
current hour is left alone; sealing again writes nothing; verify says ok; the stamp is stored once and the
mailing noted once; a seal cannot be rewritten or deleted; a tampered seal is named; a buyer is refused).

## Founder steps, in order

1. Say "apply 0135" (after 0131 to 0134).
2. In `.env` on the VPS: `LEDGER_STAMP_MAILBOX=<an address outside the company>`; `LEDGER_TSA_URL` only to
   change the authority (freetsa.org is the default; DigiCert's `http://timestamp.digicert.com` is another
   free one). `JOB_SECRET` is already set for the Monday email.
3. Add the two cron lines from the top of `ops/ledger_cron.sh` (hourly `seal`, daily `stamp`).
4. The first `seal` run writes every hour since the record's first entry; the first `stamp` run mails the
   first seal. Keep that email: it is the first outside copy.
5. On `/admin/audit-log`, press Verify now once and read "Every seal matched".

## The honest limits

- The newest hour is never sealed: a seal covers a finished hour, five minutes after it ended. If a dispute
  ever turns on the last hour, move to per-minute seals (`ponytail:` note in the plan).
- A stamp proves the seal's hash existed at the authority's time. It does not prove the entries were true,
  only that they were not changed after.
- The token's signature is verified by the checking script (phase 5) with `openssl ts -verify`, not here.

Rollback: the REVERSE section of the migration. Seals already emailed stay where they were sent.
