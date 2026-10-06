# Privacy Notice and Terms change notice — 6 October 2026

Moderation and evidence plan, item 0a. The Privacy Notice promises 30 days' notice of a
material change (section 11). The founder sends this to every active account holder on
6 October 2026; the changes take effect on **5 November 2026**. Nothing in the plan that reads
private content, records IP addresses, or enforces the ladder is switched on before that day.

The wording is a draft for the UK and Bangladesh lawyers to confirm (plan section 4.10). Send it
once they have; if that is after 6 October, move the effective day to 30 days after the day it
is actually sent and update section 11 of the notice and section 6 of the terms to match.

## How to send

Resend (the platform's email provider) has a Broadcasts feature for one email to many people;
the audience is every row of `auth.users` with a confirmed email whose profile is not suspended.
Export that list from the Supabase SQL editor (read-only):

```
select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
 where u.email_confirmed_at is not null
   and coalesce(p.is_suspended, false) = false;
```

Keep the sent broadcast's id and the send time: they are the proof the notice went out. Once the
activity record exists (plan phase 1), record the send there too (kind `notice.sent`, content =
this text and the broadcast id).

## Subject

Changes to how SourceBD keeps records, effective 5 November 2026

## Body

Hello,

We are writing because SourceBD is changing how it keeps records of what happens on the
platform. Nothing changes for 30 days: the new rules take effect on 5 November 2026. Here is
what changes and why.

**A record of activity.** From 5 November, every action on the platform is written down once,
at the moment it happens: sign-ins, searches, supplier profiles opened, RFQs, quotes, messages,
files, orders, claims and settings changes, with the time, the account, the session, the IP
address and the browser or device it came from. The record cannot be edited or deleted, and it
is sealed every hour so that any later change to it would show. It exists so that if there is a
dispute between a buyer and a supplier, or a fraud, there is a trustworthy account of what was
said and done, and when.

**Keeping records for 7 years.** Records of dealings (RFQs, quotes, messages, files, orders and
claims) are kept for 7 years after an account closes, and personal details are then removed.
Until now the notice said 12 months. An account with dealings on record is closed rather than
deleted, so that the other side's record stays whole. Where a dispute or a legal request is
open, the records involved are kept until it closes.

**Moderation.** From 5 November, SourceBD staff may open and read RFQs, quotes, messages and
attached files where that is needed to look into a report from another user, suspected fraud or
scraping, a dispute, a breach of the terms, or a request from a court, the police or a regulator.
Every such access is made for a stated reason and is itself written to the record. Staff do not
read private content for any other reason. Where we act on what we find, in steps from a warning
to a ban, we tell you what was done and why, and you can appeal once.

**Your dealings as evidence.** The terms now say that the platform's record is the agreed
record of what was sent, offered, accepted and changed on it, and may be relied on in a dispute.

**Reporting.** You will be able to report a message, an RFQ, a supplier profile or an order from
within the platform, and to block a company from contacting you.

The full text is at sourcebd.net/legal/privacy (sections 3, 7, 9 and 11) and
sourcebd.net/legal/terms (sections 4, 6, 7 and 10). If you have a question, or you do not
agree, write to privacy@sourcebd.net before 5 November 2026; you can close your account at any
time from your settings.

Thank you for using SourceBD.

The SourceBD team

## Also to do (plan section 4.10)

- [ ] Record terms acceptance for suppliers too, and re-acceptance when the version changes
      (planned with the account events of the activity record, phase 1d).
- [ ] A written procedure for requests from police, courts and lawyers: who answers, what is
      checked, what is logged (drafted with the evidence pack, phase 5).
- [ ] Finish the ICO registration and the UK representative, both still "Pending" on the notice.
- [ ] Lawyer review, UK and Bangladesh: this notice, the two legal pages, and the records
      certificate wording. Ask them also whether EU and UK platform-safety rules apply to our
      messaging.
