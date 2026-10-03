// Did this session sign in (password, email link, reset link) within the last
// `maxAgeSec`? Read from the access token's `amr` claim, whose entries carry
// the time each method was used. Token refreshes do not move those times, so a
// session cookie lifted days ago never looks fresh (ST-03).
//
// The RFC-8176 form (`amr` as plain strings) carries no time and counts as
// not recent: refusing a fresh session costs one more reset email; accepting a
// stale one hands a stolen cookie the password.

export const RESET_WINDOW_SEC = 15 * 60;

export function signedInWithin(
  amr: unknown,
  maxAgeSec: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as { timestamp?: unknown }).timestamp === "number" &&
      nowSec - (e as { timestamp: number }).timestamp <= maxAgeSec &&
      (e as { timestamp: number }).timestamp <= nowSec + 60,
  );
}
