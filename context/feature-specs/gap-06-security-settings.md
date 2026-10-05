# Gap 6 — Security: two-step sign-in, where you're signed in, sign out everywhere else

Paper gap list row 6. Boards: `10-…/Settings-Security-two-step-sign-in-and-sessions-Design-only-desktop [K3Z-0]`, phone
`[HVY-0]`, `[JOZ-0]`. Status: **migration written and dry-run, not applied** (`0115_account_sessions.sql`,
`ops/plans/0115-dry-run.md`); the screens work once it is applied. Two-step sign-in needs TOTP switched on in the
Supabase project (Authentication → Multi-factor, on by default); it is a dashboard setting, not code.

## What each part rests on

| Part | Rests on | New data |
| --- | --- | --- |
| Two-step sign-in (an authenticator app) | Supabase Auth MFA, TOTP: `auth.mfa.enroll`, `challenge`, `verify`, `unenroll`, `listFactors` | none |
| Where you're signed in | `account_sessions()` (0115): the caller's live sessions | the function |
| Sign out one other device | `account_session_end(id)` (0115) | the function |
| Sign out everywhere else | Auth: `signOut({ scope: 'others' })` | none |
| Password | the Profile page (ST-03 asks for the current one); the page links there | none |
| Single sign-on (SAML) | nothing; "Coming with Enterprise. Talk to us" (a line, no setting) | none |

## Decisions (recommended defaults, built)

1. **Two-step is optional.** Nobody is forced; a buyer turns it on. Once on, the sign-in asks for the code after the
   password or the email link, and every signed-in page and call refuses a session that has not given it (the
   middleware checks `aal`: a user with a verified factor and a session below `aal2` goes to `/login/code`, an API call
   gets 401 `two-step required`).
2. **No recovery codes.** Supabase's TOTP has none. The page says so on turning it on: "If you lose your phone, contact
   support." Support removes the factor in the Supabase dashboard. This is the risk of the feature; the alternative
   (not building it) leaves accounts on a password alone.
3. **Devices are named from the browser's own user agent.** Sign-in happens in a server action, so Auth would record the
   server's agent ("node"); the sign-in actions and the callback pass the visitor's `User-Agent` to Auth on the client
   they sign in with (`createSupabaseServerClient({ userAgent })`). Sessions that began before this show "A browser
   session" with the dates. The address is not shown anywhere: `account_sessions()` does not return it.
4. **No place names** ("London, UK" on Paper): nothing here knows where a session is, and a guessed place is worse than
   none. A device line is "Chrome on Windows" and "last active 2 Oct 2026" (or "active now" for this one).
5. **No "Last changed" date on Password**: Auth does not record when a password changed. The row says "Change it on
   your Profile" and links there.
6. Ending a session removes its refresh tokens at once; its access token can work for up to an hour. The row is gone
   from the list when it is ended; the page does not claim more.

## For the build

- Settings navigation: Security between Profile and Emails ("Your account"), `/app/settings/security`.
- The page: Two-step card (off: "Turn on", a dialog with the QR code and the secret, a 6-digit field, "Turn on";
  on: "On · authenticator app", "Turn off" asks for a current code), Password row, Where you're signed in (this one
  first, the others with Sign out each, "Sign out everywhere else"), the SSO line.
- `/login/code`: "Enter the code from your authenticator app", six digits, "Use a different account" (signs out).
- Every failure is a sentence under the field; a failed list is "We couldn't load your devices", never "No devices".

Not built: a signed-in-from-here location, recovery codes, SAML.
