// Two-step sign-in (row 6): is this session still owed its code? Supabase Auth reports an authenticator
// assurance level for the session: `currentLevel` is what it has given (aal1: the password or the email
// link; aal2: and the code), `nextLevel` is what the account's factors ask for (aal2 once a verified factor
// exists). Owed means the account asks for aal2 and the session has only aal1.
//
// An answer that could not be read is NOT owed: the read is a local decode of the session, so a failure is
// not an outage to lock people out on, and the sign-in page asks for the code on its own too.

export type Aal = { currentLevel?: string | null; nextLevel?: string | null } | null | undefined;

export function needsSecondStep(aal: Aal): boolean {
  return aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** The session's level from a Supabase client, soft: null when it could not be read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a Supabase client of either kind (server or middleware).
export async function readAal(supabase: any): Promise<Aal> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return error ? null : (data as Aal);
  } catch {
    return null;
  }
}
