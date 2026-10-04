// The saved-search route's refusal strings, in one place: the route sends
// them and the form maps them to sentences, so they cannot drift apart.
export const SAVED_SEARCH_ERROR = {
  invalidName: "invalid name",
  tooLong: "search too long to save",
  limitReached: "saved search limit reached",
} as const;

/**
 * What the form says for a refused save, and whether it is the NAME's fault (only then is the
 * name field marked invalid, WCAG 3.3.1). One function for the old form and the v4 one.
 */
export function saveSearchError(status: number, error: string | undefined): { message: string; onName: boolean } {
  if (status === 401) return { message: "Sign in to save a search.", onName: false };
  if (status === 409) return { message: "You have reached the limit of 200 saved searches. Delete one to save this.", onName: false };
  if (status === 400 && error === SAVED_SEARCH_ERROR.invalidName) return { message: "Give the search a name (up to 120 characters).", onName: true };
  if (status === 400 && error === SAVED_SEARCH_ERROR.tooLong) {
    return { message: "This search is too long to save. Remove some filters or shorten the words.", onName: false };
  }
  return { message: "Could not save this search.", onName: false };
}
